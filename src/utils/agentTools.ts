/**
 * Research tools AXION's model can use inside one request, the way a coding assistant
 * looks around before answering: read a file fresh from disk, search the code, list
 * files, and ask git (history, old versions, branches, stashes, diffs). The model asks
 * for one tool per reply as an "action"; AXION runs it, sends back the result, and the
 * model continues, a bounded number of times. Everything here only reads.
 */
export type ResearchAction =
  | { type: 'read_file'; path: string }
  | { type: 'search_code'; query: string }
  | { type: 'list_files'; prefix?: string }
  | { type: 'git'; kind: GitKind; path?: string; rev?: string };

export type GitKind = 'status' | 'branches' | 'log' | 'diff' | 'stash' | 'show';
const GIT_KINDS = new Set<GitKind>(['status', 'branches', 'log', 'diff', 'stash', 'show']);

export const MAX_RESEARCH_STEPS = 6;
const READ_CHARS = 40_000;
const MAX_HITS = 40;

export interface ResearchDeps {
  /** Project files AXION already indexed (path -> content). */
  files: Record<string, string>;
  /** Fresh read from disk; may be unavailable outside the desktop app. */
  readFile?(path: string): Promise<string>;
  git?(kind: GitKind, path?: string, rev?: string): Promise<string>;
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);
const cleanPath = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '');
const safePath = (p: string) => !/^[a-z]:|^\/|(^|\/)\.\.(\/|$)/i.test(p);

export function validateResearch(value: unknown): ResearchAction | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  switch (a.type) {
    case 'read_file': { const p = text(a.path, 300); return p && safePath(cleanPath(p)) ? { type: 'read_file', path: cleanPath(p) } : null; }
    case 'search_code': { const q = text(a.query, 200); return q ? { type: 'search_code', query: q } : null; }
    case 'list_files': { const p = typeof a.prefix === 'string' ? cleanPath(a.prefix.trim()) : ''; return safePath(p) ? { type: 'list_files', ...(p ? { prefix: p } : {}) } : null; }
    case 'git': {
      const kind = a.kind as GitKind;
      if (!GIT_KINDS.has(kind)) return null;
      const path = text(a.path, 300) ? cleanPath(String(a.path).trim()) : undefined;
      const rev = text(a.rev, 80) ?? undefined;
      if (path && !safePath(path)) return null;
      if (kind === 'show' && (!path || !rev)) return null;
      return { type: 'git', kind, ...(path ? { path } : {}), ...(rev ? { rev } : {}) };
    }
    default: return null;
  }
}

export function describeResearch(a: ResearchAction): string {
  switch (a.type) {
    case 'read_file': return `Reading ${a.path}`;
    case 'search_code': return `Searching the code for "${a.query}"`;
    case 'list_files': return `Listing files${a.prefix ? ` in ${a.prefix}` : ''}`;
    case 'git': return `Checking git ${a.kind}${a.path ? ` for ${a.path}` : ''}${a.rev ? ` at ${a.rev}` : ''}`;
  }
}

/** Runs one research action and returns its result as text (never throws). */
export async function runResearch(a: ResearchAction, deps: ResearchDeps): Promise<string> {
  try {
    switch (a.type) {
      case 'read_file': {
        let content: string | undefined;
        try { content = deps.readFile ? await deps.readFile(a.path) : undefined; } catch { /* fall back to the index */ }
        content ??= deps.files[a.path];
        if (content === undefined) {
          const near = Object.keys(deps.files).filter((p) => p.toLowerCase().endsWith(a.path.split('/').pop()!.toLowerCase())).slice(0, 5);
          return `File not found: ${a.path}.${near.length ? ` Similar paths: ${near.join(', ')}` : ''}`;
        }
        const lines = content.split('\n').length;
        const shown = content.length > READ_CHARS ? `${content.slice(0, READ_CHARS)}\n…(truncated at ${READ_CHARS} chars)` : content;
        return `FILE ${a.path} (${lines} lines, ${content.length} chars, verbatim):\n${shown}`;
      }
      case 'search_code': {
        const q = a.query.toLowerCase();
        const hits: string[] = [];
        for (const [path, content] of Object.entries(deps.files)) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length && hits.length < MAX_HITS; i++) {
            if (lines[i].toLowerCase().includes(q)) hits.push(`${path}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          }
          if (hits.length >= MAX_HITS) break;
        }
        return hits.length ? `Matches for "${a.query}"${hits.length >= MAX_HITS ? ` (first ${MAX_HITS})` : ''}:\n${hits.join('\n')}` : `No matches for "${a.query}".`;
      }
      case 'list_files': {
        const paths = Object.keys(deps.files).filter((p) => !a.prefix || p.startsWith(a.prefix)).sort();
        return paths.length ? `${paths.length} files${a.prefix ? ` under ${a.prefix}` : ''}:\n${paths.slice(0, 300).join('\n')}${paths.length > 300 ? '\n…' : ''}` : 'No files found.';
      }
      case 'git': {
        if (!deps.git) return 'Git is only available in the AXION desktop app.';
        const out = await deps.git(a.kind, a.path, a.rev);
        return `git ${a.kind}${a.path ? ` ${a.path}` : ''}${a.rev ? ` @ ${a.rev}` : ''}:\n${out.trim() || '(no output)'}`;
      }
    }
  } catch (error) {
    return `That failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export const RESEARCH_RULES = `RESEARCH TOOLS (read-only; use them instead of asking the user to paste anything):
- When you need to look at something before you can answer or fix it, put ONE of these in "action" and keep "text" to a short line on what you are checking. You get the result back and continue; you can do this up to ${MAX_RESEARCH_STEPS} times, then you must answer.
  * {"type":"read_file","path":"src/x.tsx"} : the current file from disk (verbatim).
  * {"type":"search_code","query":"CeoReport"} : where something is defined or used.
  * {"type":"list_files","prefix":"src/features/"}
  * {"type":"git","kind":"status|branches|log|diff|stash|show","path":"src/x.tsx","rev":"<commit or branch, for show>"} : history and old versions, e.g. log a file, then show it at a commit to recover it.
- Think like a senior engineer: if a file looks broken, empty or replaced by an error message, check git (log, stash, other branches) and its usages before concluding; if it can't be recovered, rebuild it from how the rest of the code uses it and say so. Then deliver the fix as "edits".`;
