/**
 * Lets AXION change project files the way a coding assistant does: the model returns
 * targeted edits (replace an exact snippet, or write a whole new file) in its JSON reply,
 * and they become diffs that Sir approves in the existing Diff Safety Gate, which takes a
 * snapshot, writes, verifies and can roll back. Nothing is written without approval.
 */
import type { DiffHunk } from '../types/index.ts';
import { replyFields } from './conversationLanguage.ts';

export type CodeEdit =
  | { path: string; find: string; replace: string }
  | { path: string; content: string };

export interface ProposedEdits { diffs: DiffHunk[]; problems: string[] }

const MAX_EDITS = 12;
const MAX_TEXT = 200_000;

/** Workspace-relative paths only: no drive letters, no leading slash, no "..". */
export function isSafeRelativePath(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  if (!p || p.length > 300 || p.startsWith('/') || /^[a-z]:/i.test(p) || p.includes('\0')) return false;
  const parts = p.split('/');
  if (parts.some((s) => s === '..' || s === '')) return false;
  // Secrets and VCS internals are never edited by the model.
  return !parts.some((s) => s === '.git' || s === 'node_modules') && !/^\.env(\..*)?$/i.test(parts[parts.length - 1]);
}

function validEdit(value: unknown): CodeEdit | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Record<string, unknown>;
  if (typeof e.path !== 'string' || !isSafeRelativePath(e.path.trim())) return null;
  const path = e.path.trim().replace(/\\/g, '/');
  if (typeof e.find === 'string' && typeof e.replace === 'string' && e.find.length > 0 && e.find.length <= MAX_TEXT && e.replace.length <= MAX_TEXT) {
    return { path, find: e.find, replace: e.replace };
  }
  if (typeof e.content === 'string' && e.content.length <= MAX_TEXT) return { path, content: e.content };
  return null;
}

/** Reads the "edits" list from a raw model reply; malformed entries are dropped. */
export function parseCodeEdits(raw: string): CodeEdit[] {
  const edits = replyFields(raw).edits;
  if (!Array.isArray(edits)) return [];
  return edits.slice(0, MAX_EDITS).map(validEdit).filter((e): e is CodeEdit => e !== null);
}

const trimLineEnds = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');

/**
 * Replaces `find` once. Models often get line endings or trailing spaces slightly wrong,
 * so an exact miss is retried with those normalised. Ambiguous (repeated) snippets fail.
 */
export function replaceOnce(source: string, find: string, replace: string): { ok: true; text: string } | { ok: false; reason: string } {
  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  const exact = count(source, find);
  if (exact === 1) return { ok: true, text: source.replace(find, () => replace) };
  if (exact > 1) return { ok: false, reason: 'the text to replace appears more than once; include more surrounding lines' };
  const crlf = source.includes('\r\n');
  const normSource = trimLineEnds(source);
  const normFind = trimLineEnds(find);
  const loose = count(normSource, normFind);
  if (loose !== 1) return { ok: false, reason: loose > 1 ? 'the text to replace appears more than once' : 'the text to replace was not found in the current file' };
  const next = normSource.replace(normFind, () => trimLineEnds(replace));
  return { ok: true, text: crlf ? next.replace(/\n/g, '\r\n') : next };
}

/**
 * Applies edits in order to a copy of `files` (several edits to one file stack up).
 * Used across rounds of the build-and-test loop, so later rounds edit earlier results.
 */
export function applyEdits(files: Record<string, string>, edits: CodeEdit[]): { files: Record<string, string>; touched: string[]; problems: string[] } {
  const next = { ...files };
  const touched = new Set<string>();
  const problems: string[] = [];
  for (const edit of edits) {
    if ('content' in edit) { next[edit.path] = edit.content; touched.add(edit.path); continue; }
    const current = next[edit.path];
    if (current === undefined) { problems.push(`${edit.path}: file is not in the connected project`); continue; }
    const result = replaceOnce(current, edit.find, edit.replace);
    if (!result.ok) { problems.push(`${edit.path}: ${result.reason}`); continue; }
    next[edit.path] = result.text;
    touched.add(edit.path);
  }
  return { files: next, touched: [...touched], problems };
}

/** One reviewable diff per changed file, comparing the real files with the final result. */
export function diffsBetween(original: Record<string, string>, final: Record<string, string>, paths: string[], summary: string, taskId: string, now = Date.now()): DiffHunk[] {
  const stamp = new Date(now).toLocaleTimeString();
  const diffs: DiffHunk[] = [];
  let i = 0;
  for (const filePath of [...new Set(paths)]) {
    const old = original[filePath];
    const next = final[filePath];
    if (next === undefined || old === next) continue;
    diffs.push({
      id: `diff-ai-${now}-${i++}`,
      taskId,
      filePath,
      oldContent: old ?? '',
      newContent: next,
      summary: `${old === undefined ? 'Create' : 'Update'} ${filePath}: ${summary}`.slice(0, 300),
      status: 'pending_approval',
      timestamp: stamp,
    });
  }
  return diffs;
}

/** Turns one set of edits into diffs against the current files. */
export function buildEditDiffs(edits: CodeEdit[], files: Record<string, string>, summary: string, taskId: string, now = Date.now()): ProposedEdits {
  const applied = applyEdits(files, edits);
  return { diffs: diffsBetween(files, applied.files, applied.touched, summary, taskId, now), problems: applied.problems };
}

/** System-prompt rules for proposing file changes. */
export const CODE_EDIT_RULES = `EDITING PROJECT FILES:
- When the user asks you to change, fix, refactor or create code in the connected project, make the change yourself: add an "edits" array to your JSON reply (next to "text" and "speechText"). Each item is either
  * {"path":"src/file.ts","find":"<exact existing text, a few whole lines>","replace":"<new text>"} to change part of an existing file, or
  * {"path":"src/new-file.ts","content":"<entire file>"} to create a new file or fully rewrite a small one.
- Paths are relative to the project root, exactly as listed in the project map. Only edit files whose current contents you were given in SOURCE FILES; "find" must be copied exactly from them and be unique in the file. If you need a file you were not given, name its path and ask for it instead of guessing.
- Keep edits minimal and correct, match the file's existing style, and update every place the change needs (imports, types, callers).
- In "text", briefly say what you changed and why. The user reviews each file's diff and approves it before anything is written, so never claim the files are already saved.
- Your edits are first applied to a scratch copy of the project and checked there (type-check, tests, build). If a check fails you will be sent its real output and the current file contents: fix the real cause with new edits. Never weaken or delete tests just to make them pass. The user only sees the final, tested result and approves it before anything is written.
- BIG FEATURES (e.g. a new gesture, a workspace tool, a Rust command plus its UI): plan them as small modular steps (types, core logic, native/Rust side, UI, tests). Put the plan in "text", send the first step's edits now, and add "next_step": "<the next step>" to your JSON. You will be asked to continue with the updated files; omit "next_step" when the feature is complete. Add tests for new logic where the project has a test setup.
- Never edit .env files, secrets, .git or node_modules.`;
