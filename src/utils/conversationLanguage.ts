/** Display script and speech pronunciation are deliberately independent. */
export interface ConversationReply { text: string; speechText: string }
export function parseConversationReply(raw: string): ConversationReply {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(7, -3).trim();
  } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.slice(3, -3).trim();
  }
  const value: unknown = JSON.parse(cleaned);
  if (!value || typeof value !== 'object') throw new Error('Invalid conversation response');
  const reply = value as Partial<ConversationReply>;
  if (typeof reply.text !== 'string' || !reply.text.trim() || typeof reply.speechText !== 'string' || !reply.speechText.trim()) throw new Error('Incomplete conversation response');
  return {text: reply.text.trim(), speechText: reply.speechText.trim()};
}
/** A short spoken version of a markdown reply: no code, no markup, first sentences only. */
export function spokenSummary(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = plain.match(/[^.!?।]+[.!?।]+/g) ?? [plain];
  let spoken = '';
  for (const s of sentences) {
    if (spoken && (spoken + s).length > 300) break;
    spoken += s;
  }
  return (spoken || plain).trim().slice(0, 300);
}

/** Every complete top-level JSON object in a reply, with where it sits in the text. */
function jsonSpans(raw: string): { start: number; end: number; value: Record<string, unknown> }[] {
  const spans: { start: number; end: number; value: Record<string, unknown> }[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"' && depth > 0) inString = true;
    else if (c === '{') { if (depth === 0) start = i; depth += 1; }
    else if (c === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const value: unknown = JSON.parse(raw.slice(start, i + 1));
          if (value && typeof value === 'object' && !Array.isArray(value)) spans.push({ start, end: i + 1, value: value as Record<string, unknown> });
        } catch { /* not JSON, e.g. code in prose */ }
        start = -1;
      }
    }
  }
  return spans;
}

/** Native tool-call blocks some models emit instead of JSON. */
const TOOL_BLOCK = /<\|tool_call_start\|>([\s\S]*?)(?:<\|tool_call_end\|>|$)|<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/gi;

/**
 * Function-style calls inside tool-call blocks, e.g.
 * `<|tool_call_start|>[run_checks(), open_app(name="Excel")]<|tool_call_end|>`.
 */
function pythonicCalls(raw: string): Record<string, unknown>[] {
  const calls: Record<string, unknown>[] = [];
  for (const block of raw.matchAll(TOOL_BLOCK)) {
    const body = block[1] ?? block[2] ?? '';
    for (const call of body.matchAll(/([a-z_][a-z0-9_]*)\s*\(([^()]*)\)/gi)) {
      const args: Record<string, unknown> = { type: call[1] };
      for (const arg of call[2].matchAll(/([a-z_][a-z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s)]+))/gi)) {
        args[arg[1]] = arg[2] ?? arg[3] ?? arg[4];
      }
      calls.push(args);
    }
  }
  return calls;
}

/** Removes tool-call blocks, safety metadata tags, and special tokens such as `<|im_end|>`. */
export function stripToolMarkup(text: string): string {
  return text
    .replace(TOOL_BLOCK, ' ')
    .replace(/<\|[a-z_]+\|>/gi, ' ')
    .replace(/<\/?tool_call>|<tool_call>[a-z_]*>?/gi, ' ')
    .replace(/(?:User|Response)\s*Safety\s*:\s*\w+/gi, '');
}

/**
 * The reply's fields, wherever the model put them. Some models split one answer into
 * several objects or wrap them in tool-call markup, e.g.
 * `<tool_call>action>{"type":"open_app",...}{"text":"...","speechText":"..."}` or
 * `<|tool_call_start|>[run_checks()]<|tool_call_end|>`.
 * A bare object with a "type" is taken as the action.
 */
export function replyFields(raw: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const { value } of jsonSpans(raw)) {
    for (const [key, v] of Object.entries(value)) if (!(key in merged)) merged[key] = v;
    if (typeof value.type === 'string' && !('text' in value) && !('action' in merged)) merged.action = value;
  }
  if (!('action' in merged)) {
    const [call] = pythonicCalls(raw);
    if (call) merged.action = call;
  }
  return merged;
}

/** Prose outside the JSON objects, with tool-call markup removed. */
function proseOutsideJson(raw: string): string {
  let out = '', at = 0;
  for (const { start, end } of jsonSpans(raw)) { out += raw.slice(at, start); at = end; }
  out += raw.slice(at);
  return tidy(stripToolMarkup(out).replace(/<\/?[a-z_]+>?[a-z_]*>?/gi, ' ').replace(/```(?:json)?\s*```/g, ''));
}

const tidy = (text: string) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

/**
 * Lenient reply parsing: models often wrap the JSON in prose, cut it off when the
 * answer is long, or ignore the format and answer in markdown. All of those are
 * real answers, so they are recovered instead of being treated as a failed provider.
 */
export function recoverConversationReply(raw: string): ConversationReply {
  try { return parseConversationReply(raw); } catch { /* recover below */ }
  const withSpeech = (text: string, speech?: unknown): ConversationReply => ({
    text: tidy(stripToolMarkup(text)) || text.trim(),
    speechText: typeof speech === 'string' && speech.trim() ? speech.trim() : spokenSummary(text),
  });
  const trimmed = raw.trim();
  const fields = replyFields(trimmed);
  if (typeof fields.text === 'string' && fields.text.trim()) return withSpeech(fields.text, fields.speechText);
  const spans = jsonSpans(trimmed);
  if (spans.length) {
    // Only an action or edits came back: show the prose around them, never the raw JSON.
    const prose = proseOutsideJson(trimmed);
    return withSpeech(prose || 'On it.');
  }
  // Cut-off JSON such as {"text":"## Report\n... with no closing quote.
  const partial = /^\s*(?:```(?:json)?\s*)?\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(trimmed);
  if (partial) {
    try {
      const text = JSON.parse(`"${partial[1].replace(/\\$/, '')}"`) as string;
      if (text.trim()) return withSpeech(text);
    } catch { /* fall through to plain text */ }
  }
  const plain = tidy(stripToolMarkup(trimmed.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```$/i, '$1')));
  if (plain) return withSpeech(plain);
  if (pythonicCalls(trimmed).length) return withSpeech('On it.');
  throw new Error('Empty conversation response');
}
