/**
 * Picks which project files AXION should actually read for a request, so it can
 * answer "is project ko padho" or "Header.tsx fix karo" from real source instead of
 * asking Sir which project or file he means. Pure: the caller supplies the files.
 */
import { includeContextFile } from '../core/context/eccManager.ts';

export interface SourceExcerpt {
  path: string;
  content: string;
  truncated: boolean;
}

const OVERVIEW_INTENT =
  /\b(project|repo|repository|codebase|overview|architecture|structure|samjh|samjho|samajh|padh|padho|read|explain|batao|kya hai|what does|how does|workspace|scan|audit|review|analy[sz]e|analysis|analyse|bugs?|debug|issues?)\b|प्रोजेक्ट|विश्लेषण|एनालाइ[जज़स]|समझाओ|पढ़ो|दिक्कत/iu;

// Files that describe a project best, in priority order.
const OVERVIEW_FILES = [
  /^readme(\.[a-z]+)?$/i,
  /^package\.json$/i,
  /^cargo\.toml$/i,
  /^pyproject\.toml$/i,
  /^requirements\.txt$/i,
  /^(src\/)?(main|index|app)\.(tsx?|jsx?|py|rs)$/i,
  /^src\/(lib|main)\.rs$/i,
  /^(main|app)\.py$/i
];

const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|cs|kt|swift|json|toml|ya?ml|md|txt|html|css|scss|sql|sh|ps1|vue|svelte)$/i;

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_.\-/]+/).filter((w) => w.length > 2);
}

/** Scores every readable file against the prompt (plus recent user turns) and returns the best paths. */
export function selectRelevantFiles(prompt: string, recentUserTexts: string[], paths: string[], max = 8): string[] {
  const candidates = paths.filter((p) => includeContextFile(p) && TEXT_EXT.test(p));
  const promptLower = prompt.toLowerCase();
  const promptWords = new Set(words(prompt));
  const recentWords = new Set(words(recentUserTexts.slice(-3).join(' ')));
  const overview = OVERVIEW_INTENT.test(prompt) ||
    (words(prompt).length <= 6 && OVERVIEW_INTENT.test(recentUserTexts.slice(-2).join(' ')));

  const scored = candidates.map((path) => {
    const lower = path.toLowerCase();
    const base = lower.split('/').pop() || lower;
    const stem = base.replace(/\.[^.]+$/, '');
    let score = 0;
    // Named directly: "Header.tsx", "src/store/useAxionStore.ts" or "header component".
    if (promptLower.includes(lower) || promptLower.includes(base)) score += 100;
    else if (stem.length > 3 && promptWords.has(stem)) score += 60;
    else if (stem.length > 3 && recentWords.has(stem)) score += 25;
    for (const seg of lower.split('/').slice(0, -1)) if (seg.length > 3 && promptWords.has(seg)) score += 8;
    if (overview) {
      const rank = OVERVIEW_FILES.findIndex((re) => re.test(lower) || re.test(base));
      // Top-level overview files only; a README deep in node_modules-like folders is noise.
      if (rank >= 0 && lower.split('/').length <= 2) score += 40 - rank * 3;
    }
    return { path, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .slice(0, max)
    .map((s) => s.path);
}

/** Cuts the chosen files down to a character budget, largest share to the best match. */
export function buildSourceExcerpts(
  selected: string[],
  files: Record<string, string>,
  budget = 48000,
  perFile = 16000
): SourceExcerpt[] {
  const out: SourceExcerpt[] = [];
  let left = budget;
  for (const path of selected) {
    const content = files[path];
    if (!content || left <= 500) continue;
    const limit = Math.min(perFile, left);
    const truncated = content.length > limit;
    const body = truncated ? content.slice(0, limit) : content;
    out.push({ path, content: body, truncated });
    left -= body.length;
  }
  return out;
}

/** Formats excerpts for the system prompt; content is marked as untrusted data. */
export function formatSourceExcerpts(excerpts: SourceExcerpt[]): string {
  if (!excerpts.length) return '';
  return excerpts
    .map((e) => `--- FILE: ${e.path}${e.truncated ? ' (truncated)' : ''} ---\n${e.content}`)
    .join('\n\n');
}
