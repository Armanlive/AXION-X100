/**
 * Decides whether a message sent into a project thread looks like a brand-new,
 * unrelated task rather than a follow-up. Pure and side-effect free: the chat
 * only uses the verdict to *offer* a new session; it never splits on its own.
 */

export interface ThreadMessageLike {
  sender: string;
  text: string;
}

export interface NewTaskVerdict {
  isNewTask: boolean;
  /** Keyword overlap (0..1) between the message and the recent thread. */
  overlap: number;
  reason: string;
}

// Words that tie a message back to what was just discussed (English + Hinglish).
const FOLLOW_UP_MARKERS = [
  'also', 'again', 'same', 'this', 'that', 'these', 'those', 'it', 'its', 'continue', 'now', 'then',
  'still', 'instead', 'above', 'previous', 'last', 'more', 'too', 'why', 'undo', 'revert',
  'isko', 'isse', 'ise', 'usko', 'use', 'usse', 'ye', 'yeh', 'wo', 'woh', 'vo', 'bhi', 'phir', 'fir',
  'wahi', 'yahi', 'abhi', 'aur', 'thoda', 'kyun', 'kyu', 'iska', 'uska', 'iski', 'uski', 'waisa', 'vaisa'
];

// Phrases that announce a separate piece of work.
const NEW_TASK_PHRASES = [
  /\bnew (task|feature|project|thing|topic|idea)\b/,
  /\b(another|different|separate|unrelated) (task|feature|thing|topic|question|issue)\b/,
  /\b(naya|nayi|alag|dusra|doosra|dusri) (task|kaam|feature|cheez|topic|sawal)\b/,
  /\b(switching|switch) (topic|gears|to)\b/,
  /\bon a different note\b/
];

// Verbs that start a piece of work.
const TASK_VERBS = [
  'add', 'build', 'create', 'implement', 'make', 'write', 'design', 'setup', 'set', 'migrate',
  'refactor', 'integrate', 'generate', 'develop', 'fix', 'remove', 'delete', 'rename', 'convert',
  'banao', 'bana', 'banado', 'likho', 'likh', 'jodo', 'lagao', 'hatao', 'badlo', 'karo'
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'be', 'can',
  'you', 'me', 'my', 'i', 'we', 'our', 'please', 'pls', 'hey', 'hi', 'ok', 'okay', 'so', 'do',
  'kar', 'karo', 'kardo', 'de', 'do', 'hai', 'hain', 'ho', 'ka', 'ki', 'ke', 'ko', 'se', 'mein',
  'me', 'ek', 'kya', 'na', 'sir', 'axion', 'bhai', 'yaar', 'thik', 'ab', 'mujhe', 'humein', 'tum',
  'aap', 'app', 'want', 'need', 'should', 'would', 'could', 'like', 'just', 'what', 'how'
]);

/** Lowercases, strips punctuation, and splits into tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.\/_-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-_/]+|[.\-_/]+$/g, ''))
    .filter(Boolean);
}

function stem(word: string): string {
  return word.length > 4 ? word.replace(/(ing|ed|es|s)$/, '') : word;
}

/** Content keywords: tokens minus stop words, lightly stemmed. */
export function keywords(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
      .map(stem)
  );
}

function overlapRatio(message: Set<string>, context: Set<string>): number {
  if (message.size === 0) return 1;
  let shared = 0;
  for (const word of message) if (context.has(word)) shared += 1;
  return shared / message.size;
}

/**
 * @param message the message about to be sent
 * @param thread the current thread's messages, oldest first
 */
export function detectNewTask(message: string, thread: ThreadMessageLike[]): NewTaskVerdict {
  const text = message.trim();
  const lower = text.toLowerCase();
  const priorUser = thread.filter((m) => m.sender === 'user' && m.text.trim());
  if (priorUser.length === 0) return { isNewTask: false, overlap: 0, reason: 'empty-thread' };

  const tokens = tokenize(text);
  const explicit = NEW_TASK_PHRASES.some((re) => re.test(lower));
  if (explicit) return { isNewTask: true, overlap: 0, reason: 'explicit-new-task' };

  if (tokens.length < 5) return { isNewTask: false, overlap: 1, reason: 'short-reply' };
  if (tokens.slice(0, 3).some((t) => FOLLOW_UP_MARKERS.includes(t))) {
    return { isNewTask: false, overlap: 1, reason: 'follow-up-marker' };
  }
  if (!tokens.some((t) => TASK_VERBS.includes(t))) {
    return { isNewTask: false, overlap: 1, reason: 'no-task-verb' };
  }

  // Compare against the recent conversation, user turns plus assistant replies.
  const recent = thread.slice(-8).map((m) => m.text).join(' ');
  const overlap = overlapRatio(keywords(text), keywords(recent));
  if (overlap >= 0.2) return { isNewTask: false, overlap, reason: 'related-topic' };
  return { isNewTask: true, overlap, reason: 'unrelated-topic' };
}
