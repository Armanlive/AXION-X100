import React from 'react';
import { useAxionStore, TabType } from '../store/useAxionStore';
import {
  MessageSquareCode,
  Users2,
  GitCompare,
  Terminal,
  Cpu,
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentTab, setCurrentTab, activeDiff, snapshots, pilotTasks } = useAxionStore();

  const passedPilotCount = pilotTasks.filter((t) => t.status === 'passed').length;

  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }[] = [
    {
      id: 'workspace',
      label: 'Engineering Chat',
      icon: <MessageSquareCode className="w-4 h-4" />
    },
    {
      id: 'agents',
      label: '17 Specialist Agents',
      icon: <Users2 className="w-4 h-4" />,
      badge: '17'
    },
    {
      id: 'diffs',
      label: 'Diff Safety Gate',
      icon: <GitCompare className="w-4 h-4" />,
      badge: activeDiff ? '1 Pending' : undefined,
      badgeColor: activeDiff ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : undefined
    },
    {
      id: 'terminal',
      label: 'Terminal & Audit',
      icon: <Terminal className="w-4 h-4" />
    },
    {
      id: 'router',
      label: 'Zero-Cost Router',
      icon: <Cpu className="w-4 h-4" />,
      badge: '$0.00',
      badgeColor: 'bg-emerald-500/20 text-emerald-400'
    },
    {
      id: 'rollback',
      label: 'Rollback Vault',
      icon: <History className="w-4 h-4" />,
      badge: snapshots.length
    },
    {
      id: 'pilot',
      label: 'Pilot Quality Suite',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: `${passedPilotCount}/10`,
      badgeColor: 'bg-blue-500/20 text-blue-400'
    }
  ];

  return (
    <aside className="w-60 bg-[#0b101c] border-r border-[#1a2438] flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
          Workspaces & Agents
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131b2c]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-blue-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    item.badgeColor || (isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-[#182338] text-slate-400')
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Safety Policy Card */}
      <div className="p-3 m-3 rounded-lg bg-[#0e1626] border border-[#1f2d47] text-[11px] space-y-1.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Native Boundary Guard</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          Zero silent writes. Changes run isolated in sandbox until explicit diff signature.
        </p>
        <div className="flex items-center justify-between pt-1 border-t border-[#1a253a] text-[10px] font-mono text-slate-400">
          <span>Boundary:</span>
          <span className="text-emerald-400">STRICT_ENFORCE</span>
        </div>
      </div>
    </aside>
  );
};
