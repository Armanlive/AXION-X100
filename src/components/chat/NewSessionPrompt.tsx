import React, { useEffect, useState } from 'react';
import { GitBranchPlus, MessageSquare } from 'lucide-react';
import { useAxionStore } from '../../store/useAxionStore';
import { detectNewTask } from '../../utils/newTaskDetection';
import type { Attachment } from '../../utils/visualInput';

export interface PendingSend {
  prompt: string;
  attachments?: Attachment[];
}

/**
 * Holds a message that looks like a new, unrelated task in a project thread and
 * asks Sir whether to move it into its own session. Nothing splits without a click.
 */
export function useNewSessionPrompt() {
  const [pending, setPending] = useState<PendingSend | null>(null);
  const activeChatId = useAxionStore((s) => s.activeChatId);

  // A held message belongs to the thread it was typed in; drop it if Sir switches away.
  useEffect(() => setPending(null), [activeChatId]);

  /** Returns true when the message was held for the prompt instead of being sent. */
  const offer = (send: PendingSend): boolean => {
    const s = useAxionStore.getState();
    const session = s.chatSessions.find((c) => c.id === s.activeChatId);
    if (!s.activeWorkspace || !session?.isWorkspaceBound) return false;
    if (!detectNewTask(send.prompt, s.messages).isNewTask) return false;
    setPending(send);
    return true;
  };

  const startNewSession = () => {
    if (!pending) return;
    const s = useAxionStore.getState();
    s.createNewChat('workspace');
    void s.executeUserPrompt(pending.prompt, false, undefined, pending.attachments);
    setPending(null);
  };

  const keepHere = () => {
    if (!pending) return;
    void useAxionStore.getState().executeUserPrompt(pending.prompt, false, undefined, pending.attachments);
    setPending(null);
  };

  return { pending, offer, startNewSession, keepHere };
}

interface NewSessionCardProps {
  pending: PendingSend;
  onNewSession: () => void;
  onKeepHere: () => void;
}

export const NewSessionCard: React.FC<NewSessionCardProps> = ({ pending, onNewSession, onKeepHere }) => (
  <div
    role="dialog"
    aria-label="Start a new session"
    className="ml-auto max-w-md rounded-xl border border-cyan-500/35 bg-[#070c18] shadow-[0_0_18px_rgba(0,240,255,0.15)] p-3 space-y-2.5 font-mono"
  >
    <div className="flex items-center gap-2 text-xs font-semibold text-[#00f0ff]">
      <GitBranchPlus className="w-3.5 h-3.5 shrink-0" />
      <span>Is this a new task? Start a new session for it?</span>
    </div>
    <p className="text-[11px] text-cyan-200/70 line-clamp-2 border-l-2 border-cyan-500/30 pl-2">{pending.prompt}</p>
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onKeepHere}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-cyan-300 hover:text-white bg-[#0a1224] hover:bg-[#0e1930] border border-cyan-500/20 transition"
      >
        <MessageSquare className="w-3 h-3" />
        Keep here
      </button>
      <button
        onClick={onNewSession}
        autoFocus
        className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] shadow-[0_0_12px_rgba(0,240,255,0.35)] transition"
      >
        <GitBranchPlus className="w-3 h-3" />
        New session
      </button>
    </div>
  </div>
);
