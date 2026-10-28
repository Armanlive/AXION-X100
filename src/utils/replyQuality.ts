/**
 * Catches replies that sound like action but deliver nothing: a tool call AXION doesn't
 * have, "Creating it now…" with no code and no edits, or "I'll check the file around line
 * 610" with no fix. AXION has no second turn of its own: whatever the model only promises
 * never happens. So the orchestrator re-asks (a bounded number of times) until it delivers.
 */
import { replyFields, recoverConversationReply } from './conversationLanguage.ts';
import { validateAction } from './desktopActions.ts';
import { parseCodeEdits } from './codeEdits.ts';
import { validateResearch } from './agentTools.ts';

/** Requests to make, write or fix something (code, a page, a file, a bug, an error...). */
const ACT_REQUEST = /\b(make|build|create|write|generate|code|implement|fix|fixes|solve|resolve|repair|debug|correct|patch|banao|bana\s*(?:do|de|ke)|banake|bana|likh\w*|tayyar|theek|thik|sahi\s*kar\w*|sudhar\w*)\b|बनाओ|बना\s*(?:दो|के)|लिखो|लिख\s*(?:दो|के)|ठीक|सही\s*कर|सुधार/iu;
/** Promises of future work: "Creating it now", "I'll check", "let me look", "dekhta hoon". */
const PROMISE = /\b(i'?ll|i will|i am going to|i'm going to|let me|let's|going to|creating|building|writing|generating|checking|looking|reading|inspecting|investigating|examining|analy[sz]ing|fixing|working on it|on it|right away|now|first,? i)\b|\b(bana|likh|kar|dekh)\s*(raha|rahi)\b|\b(dekhta|dekhti|karta|karti|check\s*karta)\s*(hoon|hu|hun)\b|बना\s*रहा|लिख\s*रहा|देखता|देखती|करता\s*हूँ/iu;

export const MAX_DELIVERY_RETRIES = 2;

/** Added to the system prompt: the model must finish the work inside this one reply. */
export const SAME_TURN_RULE = `- ONE TURN ONLY: you cannot come back later or take a step on your own after this reply. What AXION already read for you (project map, SOURCE FILES, ERROR LOCATION) is in this message; if you need more, use a RESEARCH TOOL action and you get the result back. Never end on a plan or a promise ("I'll check…", "Let me look at…", "dekhta hoon"): do the work now and deliver the result (the fix as "edits", the code, or the answer) in this reply. If something truly is missing, name the exact file you need in one line instead of promising to look.`;

export interface ReplyProblem { kind: 'unsupported-tool' | 'empty-promise'; followUp: string }

export interface ReplyOptions {
  editsAllowed: boolean;
  /** The request was a pasted build error / stack trace: it always asks for a fix. */
  errorReport?: boolean;
}

/** True when the reply delivers something: code, edits or a valid computer action. */
function delivers(raw: string, opts: ReplyOptions): boolean {
  const text = recoverConversationReply(raw).text;
  if (/```[\s\S]{40,}```/.test(text)) return true;
  if (opts.editsAllowed && parseCodeEdits(raw).length) return true;
  const action = replyFields(raw).action;
  return !!validateAction(action) || !!validateResearch(action);
}

/** A short reply that only announces future work and delivers nothing. */
export function isPromiseOnly(raw: string, opts: ReplyOptions): boolean {
  const text = recoverConversationReply(raw).text;
  return PROMISE.test(text) && text.length < 600 && !delivers(raw, opts);
}

export function assessReply(raw: string, request: string, opts: ReplyOptions): ReplyProblem | null {
  const action = replyFields(raw).action;
  const edits = opts.editsAllowed ? parseCodeEdits(raw) : [];
  if (action !== undefined && !validateAction(action) && !validateResearch(action) && !edits.length) {
    const name = action && typeof action === 'object' && typeof (action as { type?: unknown }).type === 'string' ? (action as { type: string }).type : 'unknown';
    return {
      kind: 'unsupported-tool',
      followUp: `Your last reply called a tool AXION does not have ("${name}"), so nothing happened. Reply again using ONLY the JSON format from your instructions: the complete answer in "text" (for code, the full working code in a Markdown code block)${opts.editsAllowed ? ', "edits" to create or change project files when that is what the user wants' : ''}, and "action" only for the listed computer actions.`,
    };
  }
  if ((opts.errorReport || ACT_REQUEST.test(request)) && isPromiseOnly(raw, opts)) {
    const fix = opts.errorReport;
    return {
      kind: 'empty-promise',
      followUp: fix
        ? `You said you would check it, but your reply contains no fix${opts.editsAllowed ? ' and no "edits"' : ''}, and you get no other turn. The file contents are already in ERROR LOCATION / SOURCE FILES in your instructions: read them now, find the real cause, and deliver the fix in this reply: ${opts.editsAllowed ? '"edits" with "find" copied exactly from the file' : 'the corrected code in "text" inside a Markdown code block'}, plus one or two lines on the cause. No plans, no promises.`
        : `You said you would do it, but your reply contains no code${opts.editsAllowed ? ' and no "edits"' : ''}. Deliver it now, in this reply: ${opts.editsAllowed ? 'either "edits" that create the files, or ' : ''}the complete, working code in "text" inside a Markdown code block, with one short line before it. No apologies, no plans, no promises.`,
    };
  }
  return null;
}

export interface ContinueDecision { retry: boolean; followUp?: string; reason?: ReplyProblem['kind'] }

/**
 * Whether the orchestrator should ask the model again after `attempt` re-prompts so far.
 * Bounded so a model that keeps stalling can't loop forever; audits are never re-asked.
 */
export function decideContinuation(raw: string, request: string, attempt: number, opts: ReplyOptions & { audit?: boolean; maxRetries?: number }): ContinueDecision {
  if (opts.audit || attempt >= (opts.maxRetries ?? MAX_DELIVERY_RETRIES)) return { retry: false };
  const problem = assessReply(raw, request, opts);
  return problem ? { retry: true, followUp: problem.followUp, reason: problem.kind } : { retry: false };
}
