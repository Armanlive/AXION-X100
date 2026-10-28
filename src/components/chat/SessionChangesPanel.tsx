import React from 'react';
import { FileDiff, X } from 'lucide-react';
import { useAxionStore } from '../../store/useAxionStore';
import { countChangedFiles, sortChanges, type SessionFileChange } from '../../utils/sessionChanges';
import type { ChatMessage, ChatSession, DiffHunk, TaskSnapshot } from '../../types';

/**
 * Sessions keep only change metadata, so the full diff is looked up from what is
 * still in memory: the diff attached to a chat message, the open diff modal, or the
 * pre-write snapshot taken when it was applied.
 */
function resolveDiff(
  change: SessionFileChange,
  sessions: ChatSession[],
  messages: ChatMessage[],
  snapshots: TaskSnapshot[],
  activeDiffModal: DiffHunk | null
): DiffHunk | null {
  if (activeDiffModal?.id === change.diffId) return activeDiffModal;
  for (const list of [messages, ...sessions.map((s) => s.messages)]) {
    const hit = list.find((m) => m.proposedDiff?.id === change.diffId)?.proposedDiff;
    if (hit) return hit;
  }
  const snap = snapshots.find((s) => s.taskId === change.taskId && s.filePath === change.filePath);
  if (!snap) return null;
  return {
    id: change.diffId,
    taskId: change.taskId,
    filePath: change.filePath,
    oldContent: snap.originalContent,
    newContent: snap.modifiedContent,
    summary: change.summary || snap.title,
    status: 'approved',
    timestamp: new Date(change.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}

const STATUS_STYLE: Record<SessionFileChange['status'], string> = {
  applied: 'bg-cyan-950/80 text-[#00f0ff] border-cyan-500/40',
  proposed: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
  rejected: 'bg-rose-950/60 text-rose-400 border-rose-500/40'
};

export const SessionChangesBadge: React.FC<{ changes?: SessionFileChange[]; onOpen: () => void }> = ({ changes, onOpen }) => {
  const count = countChangedFiles(changes);
  if (!count) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title="Show files changed in this session"
      className="shrink-0 flex items-center gap-0.5 px-1.5 py-px rounded border border-cyan-500/30 bg-cyan-950/60 text-[9px] font-mono text-cyan-300 hover:text-white hover:border-cyan-400/60 transition"
    >
      <FileDiff className="w-2.5 h-2.5" />
      {count} {count === 1 ? 'file' : 'files'} changed
    </button>
  );
};

export const SessionChangesPanel: React.FC<{ sessionId: string; onClose: () => void }> = ({ sessionId, onClose }) => {
  const { chatSessions, messages, snapshots, activeDiffModal, openDiffModal } = useAxionStore();
  const session = chatSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const changes = sortChanges(session.changes);

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Files changed in ${session.title}`}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#070c18] border border-cyan-500/35 rounded-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col shadow-[0_0_40px_rgba(0,240,255,0.2)] font-mono"
      >
        <div className="p-3 bg-[#0a1224] border-b border-cyan-500/25 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-cyan-200 truncate">Session changes • {session.title}</div>
            <div className="text-[10px] text-cyan-400/60">
              {countChangedFiles(session.changes)} files · {changes.length} changes
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cyan-950 text-cyan-400 hover:text-white transition" aria-label="Close session changes">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="overflow-y-auto p-2 space-y-1">
          {changes.length === 0 && <li className="p-3 text-[11px] text-cyan-400/60 text-center">No file changes in this session yet.</li>}
          {changes.map((change) => {
            const diff = resolveDiff(change, chatSessions, messages, snapshots, activeDiffModal);
            return (
              <li key={change.diffId}>
                <button
                  disabled={!diff}
                  onClick={() => diff && openDiffModal(diff)}
                  title={diff ? 'Open in diff viewer' : 'Diff contents are no longer in memory'}
                  className="w-full text-left px-2.5 py-2 rounded-lg border border-transparent hover:border-cyan-500/25 hover:bg-cyan-950/40 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:border-transparent transition"
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <FileDiff className="w-3 h-3 text-[#00f0ff] shrink-0" />
                    <span className="truncate text-white flex-1">{change.filePath}</span>
                    <span className="text-[#00f0ff]">+{change.added}</span>
                    <span className="text-rose-400">-{change.removed}</span>
                    <span className={`px-1.5 py-px rounded-full border text-[9px] uppercase ${STATUS_STYLE[change.status]}`}>{change.status}</span>
                  </div>
                  <div className="mt-0.5 pl-5 flex items-center gap-2 text-[10px] text-cyan-400/60">
                    <span>{change.taskId}</span>
                    <span>{new Date(change.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    {!diff && <span className="italic">contents not retained</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
