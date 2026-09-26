import { WorkspaceFile } from '../types';

export const INITIAL_WORKSPACE_FILES: Record<string, string> = {
  'src/App.tsx': `import React, { useState } from 'react';
import Header from './components/Header';
import StatsCard from './components/StatsCard';

export default function App() {
  const [activeProject, setActiveProject] = useState('Nexus-Core');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header title="AXION Workspace Project" project={activeProject} />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard title="Active Agents" value="17" trend="+3 this week" />
          <StatsCard title="Zero-Cost Tokens" value="482.9k" trend="100% Free Tier" />
          <StatsCard title="Build Integrity" value="100%" trend="Zero Regressions" />
        </div>
      </main>
    </div>
  );
}`,

  'src/components/Header.tsx': `import React from 'react';

interface HeaderProps {
  title: string;
  project: string;
}

export default function Header({ title, project }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        <h1 className="text-base font-semibold text-white tracking-wide">{title}</h1>
        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
          {project}
        </span>
      </div>
      <div className="text-xs font-mono text-slate-400">
        {currentDate}
      </div>
    </header>
  );
}`,

  'src/components/StatsCard.tsx': `import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  trend: string;
}

export default function StatsCard({ title, value, trend }: StatsCardProps) {
  return (
    <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition shadow-sm">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold font-mono text-white">{value}</span>
        <span className="text-xs font-medium text-emerald-400 font-mono">{trend}</span>
      </div>
    </div>
  );
}`,

  'package.json': `{
  "name": "nexus-core-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.475.0"
  }
}`
};
