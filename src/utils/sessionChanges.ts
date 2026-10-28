/**
 * Per-session change history: which files AXION proposed or applied changes to
 * during a chat session. Only metadata is kept (no file contents) so it can be
 * persisted alongside the chat sessions in localStorage.
 */

export type SessionChangeStatus = 'proposed' | 'applied' | 'rejected';

export interface SessionFileChange {
  diffId: string;
  taskId: string;
  filePath: string;
  added: number;
  removed: number;
  /** ISO timestamp of the latest status change. */
  timestamp: string;
  status: SessionChangeStatus;
  summary?: string;
}

interface DiffLike {
  id: string;
  taskId: string;
  filePath: string;
  oldContent?: string;
  newContent?: string;
  summary?: string;
}

interface SessionLike {
  id: string;
  changes?: SessionFileChange[];
}

const MAX_CHANGES_PER_SESSION = 200;

/** Counts added/removed lines with a multiset comparison (order-insensitive, O(n)). */
export function countLineChanges(oldContent = '', newContent = ''): { added: number; removed: number } {
  if (oldContent === newContent) return { added: 0, removed: 0 };
  const oldLines = oldContent === '' ? [] : oldContent.split('\n');
  const newLines = newContent === '' ? [] : newContent.split('\n');
  const remaining = new Map<string, number>();
  for (const line of oldLines) remaining.set(line, (remaining.get(line) || 0) + 1);
  let added = 0;
  for (const line of newLines) {
    const left = remaining.get(line) || 0;
    if (left > 0) remaining.set(line, left - 1);
    else added += 1;
  }
  let removed = 0;
  for (const left of remaining.values()) removed += left;
  return { added, removed };
}

export function toSessionChange(diff: DiffLike, status: SessionChangeStatus, now = new Date()): SessionFileChange {
  const { added, removed } = countLineChanges(diff.oldContent, diff.newContent);
  return {
    diffId: diff.id,
    taskId: diff.taskId,
    filePath: diff.filePath,
    added,
    removed,
    timestamp: now.toISOString(),
    status,
    summary: diff.summary ? diff.summary.slice(0, 160) : undefined
  };
}

/**
 * Records a change. If any session already tracks this diff, that session's entry is
 * updated (a diff proposed in one thread stays there even if approved from another);
 * otherwise the change is added to `activeChatId`.
 */
export function upsertSessionChange<T extends SessionLike>(
  sessions: T[],
  activeChatId: string,
  change: SessionFileChange
): T[] {
  const owner = sessions.find((s) => s.changes?.some((c) => c.diffId === change.diffId));
  const targetId = owner ? owner.id : activeChatId;
  if (!sessions.some((s) => s.id === targetId)) return sessions;
  return sessions.map((s) => {
    if (s.id !== targetId) return s;
    const existing = s.changes || [];
    const idx = existing.findIndex((c) => c.diffId === change.diffId);
    const next =
      idx >= 0
        ? existing.map((c, i) => (i === idx ? { ...c, ...change, added: change.added || c.added, removed: change.removed || c.removed } : c))
        : [...existing, change].slice(-MAX_CHANGES_PER_SESSION);
    return { ...s, changes: next };
  });
}

/** Number of distinct files AXION changed or proposed changes to in a session. */
export function countChangedFiles(changes: SessionFileChange[] | undefined): number {
  if (!changes?.length) return 0;
  return new Set(changes.map((c) => c.filePath)).size;
}

/** Newest first, for display. */
export function sortChanges(changes: SessionFileChange[] | undefined): SessionFileChange[] {
  return [...(changes || [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
