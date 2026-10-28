import React from 'react';
import { Folder, GitBranch } from 'lucide-react';
import { useAxionStore } from '../store/useAxionStore';

/**
 * Multi-project dropdown rendered under "Local Workspace" in the desktop sidebar.
 * Lets the user switch the active workspace on the fly without leaving the
 * current view — session context (chat, tab, terminal) is preserved.
 */
export const WorkspaceSwitcher: React.FC = () => {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useAxionStore();

  if (workspaces.length === 0) {
    return (
      <div className="ml-3 pl-3 border-l border-cyan-500/15 py-1.5 text-[10px] font-mono text-cyan-500/50 leading-relaxed">
        No projects mounted yet.
        <br />
        Open <span className="text-cyan-400/80">Local Workspace</span> to add one.
      </div>
    );
  }

  return (
    <div
      className="ml-3 pl-3 border-l border-cyan-500/15 py-1 space-y-0.5 animate-in fade-in duration-100"
      role="listbox"
      aria-label="Mounted projects"
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <button
            key={ws.id}
            role="option"
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) void switchWorkspace(ws.id);
            }}
            title={`${ws.path}${ws.branch ? ` · ${ws.branch}` : ''}`}
            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition border ${
              isActive
                ? 'bg-cyan-950/70 text-[#00f0ff] border-cyan-500/40 font-semibold shadow-[0_0_10px_rgba(0,240,255,0.12)]'
                : 'text-cyan-200/65 border-transparent hover:text-white hover:bg-cyan-950/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isActive ? 'bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]' : 'bg-cyan-600/50'
              }`}
            />
            <Folder className="w-3 h-3 shrink-0 text-[#00f0ff]/80" />
            <span className="truncate flex-1 text-left">{ws.name}</span>
            <span
              className={`flex items-center gap-0.5 shrink-0 px-1 py-0.2 rounded border text-[9px] ${
                isActive
                  ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                  : 'bg-cyan-950/40 border-cyan-700/40 text-cyan-500/70'
              }`}
            >
              <GitBranch className="w-2.5 h-2.5" />
              {ws.branch || 'main'}
            </span>
          </button>
        );
      })}
    </div>
  );
};
