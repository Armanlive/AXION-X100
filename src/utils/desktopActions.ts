/**
 * Computer actions AXION may choose for the user's request: open a project by name, launch
 * an installed app, open a folder or site, or look at what fills a drive. The model
 * picks at most one action in its JSON reply; this module validates it and runs it
 * through injected native calls. Every action only opens or reads; nothing deletes.
 */
import type { BrowserTarget, FolderTarget } from '../services/commandService.ts';
import { replyFields } from './conversationLanguage.ts';
import { summarizeChecks, type CheckResult } from './projectChecks.ts';

export type DesktopAction =
  | { type: 'open_project'; name: string; drive?: string }
  | { type: 'open_app'; name: string }
  | { type: 'open_folder'; target: FolderTarget }
  | { type: 'open_website'; target: BrowserTarget; query?: string }
  | { type: 'drive_report'; drive: string }
  | { type: 'run_checks' }
  | { type: 'create_desktop_folder'; name: string }
  | { type: 'rename_desktop_folder'; old_name: string; new_name: string };

export interface ProjectMatch { name: string; path: string; is_project: boolean }
export interface FolderSize { path: string; bytes: number }
export interface DriveReport {
  drive: string; total_bytes: number; free_bytes: number;
  top_folders: FolderSize[]; largest_subfolders: FolderSize[]; partial: boolean;
}

/** Native calls, injected so the logic is testable without the desktop app. */
export interface DesktopDeps {
  findProject(query: string, drive?: string): Promise<ProjectMatch[]>;
  openProject(path: string): Promise<void>;
  openInstalledApp(name: string): Promise<string>;
  openFolder(target: FolderTarget): Promise<void>;
  openWebsite(target: BrowserTarget, query?: string): Promise<void>;
  driveReport(drive: string): Promise<DriveReport>;
  /** Runs the connected project's own checks (type-check, tests, build); null outside the desktop app. */
  runChecks(): Promise<CheckResult[] | null>;
  /** Root of the project that is already open, if any. */
  activeProjectPath?: string;
  createDesktopFolder?(name: string): Promise<string>;
  renameDesktopFolder?(oldName: string, newName: string): Promise<string>;
}

export interface ActionResult {
  /** What AXION tells the user when no follow-up thinking is needed. */
  reply: { text: string; speechText: string };
  /** Real data for the model to reason over before answering (untrusted). */
  observation?: string;
  /** What the model should do with the observation. */
  observationTask?: string;
  /** The action succeeded and the model's own reply already says so. */
  keepModelText?: boolean;
}

const FOLDER_TARGETS = new Set(['desktop', 'downloads', 'documents', 'pictures', 'music', 'videos', 'home', 'project']);
const WEB_TARGETS = new Set(['google', 'youtube', 'gmail', 'github', 'maps', 'drive', 'translate', 'news', 'search', 'youtube_search']);
const DRIVE = /^[A-Za-z]:?$/;

const shortText = (v: unknown, max = 80) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

/** Validates an action object from the model; anything malformed is ignored. */
export function validateAction(value: unknown): DesktopAction | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  const name = shortText(a.name);
  const drive = typeof a.drive === 'string' && DRIVE.test(a.drive.trim()) ? a.drive.trim()[0].toUpperCase() : undefined;
  switch (a.type) {
    case 'open_project': return name ? { type: 'open_project', name, ...(drive ? { drive } : {}) } : null;
    case 'open_app': return name ? { type: 'open_app', name } : null;
    case 'open_folder': return typeof a.target === 'string' && FOLDER_TARGETS.has(a.target) ? { type: 'open_folder', target: a.target as FolderTarget } : null;
    case 'open_website': {
      if (typeof a.target !== 'string' || !WEB_TARGETS.has(a.target)) return null;
      const query = shortText(a.query, 300) ?? undefined;
      if ((a.target === 'search' || a.target === 'youtube_search') && !query) return null;
      return { type: 'open_website', target: a.target as BrowserTarget, ...(query ? { query } : {}) };
    }
    case 'drive_report': return drive ? { type: 'drive_report', drive } : null;
    case 'run_checks': return { type: 'run_checks' };
    case 'create_desktop_folder': return name ? { type: 'create_desktop_folder', name } : null;
    case 'rename_desktop_folder': {
      const oldName = shortText((a as any).old_name);
      const newName = shortText((a as any).new_name);
      return oldName && newName ? { type: 'rename_desktop_folder', old_name: oldName, new_name: newName } : null;
    }
    default: return null;
  }
}

/** Finds the "action" field in a raw model reply (JSON, fenced or wrapped in prose). */
export function parseDesktopAction(raw: string): DesktopAction | null {
  return validateAction(replyFields(raw).action);
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Math.max(0, bytes); let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Plain report, used as the model's observation and as the reply if the model is unavailable. */
export function describeDriveReport(r: DriveReport): string {
  const used = r.total_bytes - r.free_bytes;
  const pct = r.total_bytes ? Math.round((used / r.total_bytes) * 100) : 0;
  const list = (items: FolderSize[]) => items.slice(0, 6).map((f) => `- ${f.path}: ${formatBytes(f.bytes)}`).join('\n') || '- (nothing readable)';
  const head = `Drive ${r.drive}: ${formatBytes(used)} used of ${formatBytes(r.total_bytes)} (${pct}%), ${formatBytes(r.free_bytes)} free.`;
  const note = r.partial ? '\n(Scan hit its time limit; real sizes may be larger.)' : '';
  return `${head}\nLargest folders:\n${list(r.top_folders)}\nLargest subfolders:\n${list(r.largest_subfolders)}${note}`;
}

const say = (text: string, speechText = text) => ({ text, speechText });
const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Runs one validated action. Never throws: failures become an honest reply. When a
 * simple action succeeds, `keepModelText` tells the caller to keep the model's own
 * line, which is already in the user's language.
 */
export async function runDesktopAction(action: DesktopAction, deps: DesktopDeps): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'open_project': {
        const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
        const active = deps.activeProjectPath && norm(deps.activeProjectPath);
        const loose = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (active && loose(active.split('/').pop() ?? '') === loose(action.name)) {
          return { reply: say(`"${action.name}" is already the open project.`), keepModelText: true };
        }
        const matches = await deps.findProject(action.name, action.drive);
        const where = action.drive ? ` on the ${action.drive}: drive` : '';
        if (!matches.length) {
          return { reply: say(`I couldn't find a folder called "${action.name}"${where}. Could you say the name again?`) };
        }
        const [best, next] = matches;
        const clear = matches.length === 1 || (best.is_project && !next?.is_project) || best.name.toLowerCase() === action.name.toLowerCase();
        if (!clear) {
          const options = matches.slice(0, 4).map((m, i) => `${i + 1}. ${m.path}`).join('\n');
          return { reply: say(`I found several folders named "${action.name}":\n${options}\nWhich one should I open?`, 'I found several matching folders. Which one should I open?') };
        }
        if (active && norm(best.path) === active) return { reply: say(`"${best.name}" is already the open project.`), keepModelText: true };
        await deps.openProject(best.path);
        return { reply: say(`Done. "${best.name}" is open as the project (${best.path}). What should we do with it?`) };
      }
      case 'open_app': {
        const opened = await deps.openInstalledApp(action.name);
        return { reply: say(`Opening ${opened}.`), keepModelText: true };
      }
      case 'open_folder':
        await deps.openFolder(action.target);
        return { reply: say('The folder is open.'), keepModelText: true };
      case 'open_website':
        await deps.openWebsite(action.target, action.query);
        return { reply: say('Opened it in the browser.'), keepModelText: true };
      case 'drive_report': {
        const report = await deps.driveReport(action.drive);
        const text = describeDriveReport(report);
        return { reply: say(text, 'The drive report is ready.'), observation: text,
          observationTask: "Answer the user's request from this data like a sharp human engineer: what is taking the space, what is likely safe to clean, what to check first. Never claim you deleted anything." };
      }
      case 'run_checks': {
        const results = await deps.runChecks();
        if (results === null) return { reply: say("Running the project's checks needs the AXION desktop app.") };
        const summary = summarizeChecks(results);
        const log = summary.log ? `\n\nOutput of the failing check:\n\`\`\`\n${summary.log.slice(-6000)}\n\`\`\`` : '';
        return { reply: say(`${summary.text}${log}`, summary.status === 'passed' ? 'All checks passed.' : summary.status === 'failed' ? 'Some checks failed.' : 'No checks found for this project.'),
          observation: `${summary.text}${log}`,
          observationTask: "Report what the checks found in the user's language: the real errors (file, line, cause) and how to fix each. Combine this with what you can see in the source files you were given; add other likely bugs you notice there, clearly marked as from reading the code. If the user asked to fix them, include \"edits\" for the fixes." };
      }
      case 'create_desktop_folder': {
        if (!deps.createDesktopFolder) return { reply: say("Folder creation needs the AXION desktop app.") };
        const path = await deps.createDesktopFolder(action.name);
        return { reply: say(`Created “${action.name}” folder on your Desktop.\n\n${path}`, `Desktop par “${action.name}” folder ban gaya hai.`), keepModelText: true };
      }
      case 'rename_desktop_folder': {
        if (!deps.renameDesktopFolder) return { reply: say("Folder renaming needs the AXION desktop app.") };
        const path = await deps.renameDesktopFolder(action.old_name, action.new_name);
        return { reply: say(`Renamed Desktop folder “${action.old_name}” to “${action.new_name}”.\n\n${path}`, `Desktop par “${action.old_name}” folder ko “${action.new_name}” rename kar diya gaya hai.`), keepModelText: true };
      }
    }
  } catch (error) {
    return { reply: say(`That didn't work: ${why(error)}`, "That didn't work.") };
  }
}

/** System-prompt rules telling the model which actions exist and when to use them. */
export const DESKTOP_ACTION_RULES = `COMPUTER ACTIONS (AXION desktop app on the user's Windows PC):
- When the user asks you to do something on their computer, add an "action" key to your JSON reply, next to "text" and "speechText". Choose the ONE action that fits, thinking about what they actually want:
  * {"type":"open_project","name":"<folder name>","drive":"E"} : find a project folder by name (drive optional) and open it as the working project. E.g. "open the Sana project on the E drive".
  * {"type":"open_app","name":"<app name>"} : launch any installed app, e.g. VS Code, Excel, Photoshop, Calculator.
  * {"type":"open_folder","target":"desktop|downloads|documents|pictures|music|videos|home|project"}
  * {"type":"open_website","target":"google|youtube|gmail|github|maps|drive|translate|news|search|youtube_search","query":"<only for search>"}
  * {"type":"drive_report","drive":"C"} : measure what fills a drive, when they ask why a drive is full or what takes space.
  * {"type":"run_checks"} : run the connected project's own type-check, tests and build. Use it whenever the user asks to scan, audit, test, build or debug the project or find its bugs.
  * {"type":"create_desktop_folder","name":"<folder name>"} : create an empty folder on the user's Desktop.
  * {"type":"rename_desktop_folder","old_name":"<old name>","new_name":"<new name>"} : rename an existing folder on the Desktop.
- With an action, "text" is a short line saying what you are doing; the real result is reported after it runs. For drive_report and run_checks you will get the real output and then explain it.
- The connected project is ALREADY open: never use open_project for it. Use open_project only to switch to a different folder.
- No action for normal conversation, questions or coding. Never invent an action for things not listed (nothing can delete files).`;
