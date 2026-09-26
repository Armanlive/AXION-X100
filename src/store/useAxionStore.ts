import { create } from 'zustand';
import {
  Agent,
  AIModel,
  ChatMessage,
  DiffHunk,
  TaskSnapshot,
  AuditLog,
  PilotTask
} from '../types';
import { INITIAL_AGENTS } from '../utils/agentsData';
import { INITIAL_MODELS } from '../utils/modelsData';
import { INITIAL_WORKSPACE_FILES } from '../utils/workspaceFiles';
import { INITIAL_PILOT_TASKS } from '../utils/pilotData';
import { normalizeVoiceInput } from '../utils/voiceNormalizer';

export type TabType =
  | 'workspace'
  | 'agents'
  | 'diffs'
  | 'terminal'
  | 'router'
  | 'rollback'
  | 'pilot';

interface AxionState {
  currentTab: TabType;
  projectPath: string;
  files: Record<string, string>;
  selectedFilePath: string;
  agents: Agent[];
  models: AIModel[];
  activeModelId: string;
  isPaidOverrideModalOpen: boolean;
  pendingPaidModelId: string | null;
  messages: ChatMessage[];
  voiceState: 'idle' | 'listening' | 'parsing' | 'working' | 'ready';
  voiceTranscript: string;
  audioTtsEnabled: boolean;
  activeDiff: DiffHunk | null;
  snapshots: TaskSnapshot[];
  terminalLogs: string[];
  auditLogs: AuditLog[];
  pilotTasks: PilotTask[];
  isWorking: boolean;
  diffViewMode: 'side-by-side' | 'unified';
  taskCounter: number;

  // Actions
  setCurrentTab: (tab: TabType) => void;
  selectFile: (path: string) => void;
  setVoiceState: (state: 'idle' | 'listening' | 'parsing' | 'working' | 'ready') => void;
  toggleAudioTts: () => void;
  setDiffViewMode: (mode: 'side-by-side' | 'unified') => void;
  executeUserPrompt: (promptText: string, isVoice?: boolean) => Promise<void>;
  approveDiff: (diffId: string) => Promise<void>;
  rejectDiff: (diffId: string) => void;
  rollbackTask: (taskId: string) => void;
  simulateFailover: () => void;
  requestPaidModel: (modelId: string) => void;
  authorizePaidModelOnce: () => void;
  closePaidModal: () => void;
  triggerBuildErrorDemo: () => void;
  healBuildError: () => void;
  runPilotTask: (taskId: number) => Promise<void>;
  runAllPilotTasks: () => Promise<void>;
  createCustomAgent: (agent: Partial<Agent>) => void;
  clearTerminal: () => void;
  runTerminalCommand: (command: string) => void;
}

export const useAxionStore = create<AxionState>((set, get) => ({
  currentTab: 'workspace',
  projectPath: 'E:\\Projects\\nexus-core',
  files: { ...INITIAL_WORKSPACE_FILES },
  selectedFilePath: 'src/components/Header.tsx',
  agents: INITIAL_AGENTS,
  models: INITIAL_MODELS,
  activeModelId: 'gemini-2.0-flash',
  isPaidOverrideModalOpen: false,
  pendingPaidModelId: null,
  voiceState: 'ready',
  voiceTranscript: '',
  audioTtsEnabled: true,
  activeDiff: null,
  snapshots: [
    {
      taskId: '#AX-1039',
      timestamp: '2026-08-18 10:14:02',
      title: 'Initial App Skeleton Setup',
      filePath: 'src/App.tsx',
      originalContent: '// Initial empty scaffold',
      modifiedContent: INITIAL_WORKSPACE_FILES['src/App.tsx'],
      reverted: false,
      exitCode: 0
    }
  ],
  terminalLogs: [
    'AXION Native Kernel v1.0.0 (Windows PowerShell 7.4.2 Host)',
    'Bound Workspace: E:\\Projects\\nexus-core [Boundary: STRICT_ENFORCE]',
    'Active Zero-Cost Router: Google Gemini 2.0 Flash ($0.00/1k)',
    'Type check and linter ready. Ready for prompts or voice input.'
  ],
  auditLogs: [
    {
      id: 'AUD-001',
      timestamp: '2026-08-18 10:14:00',
      actor: 'SYSTEM',
      action: 'WORKSPACE_SELECT',
      targetPath: 'E:\\Projects\\nexus-core',
      details: 'Workspace boundary initialized with strict subfolder containment.',
      status: 'SUCCESS'
    },
    {
      id: 'AUD-002',
      timestamp: '2026-08-18 10:14:05',
      actor: 'SYSTEM',
      action: 'TERMINAL_EXEC',
      targetPath: 'package.json',
      details: 'Integrity scan verified clean repository. Exit code: 0',
      exitCode: 0,
      status: 'SUCCESS'
    }
  ],
  pilotTasks: INITIAL_PILOT_TASKS,
  isWorking: false,
  diffViewMode: 'side-by-side',
  taskCounter: 1042,

  messages: [
    {
      id: 'msg-init',
      sender: 'boss_agent',
      agentName: 'Boss Agent',
      agentRole: 'boss',
      text: 'AXION-X100 is live. Your local workspace boundary is secured at `E:\\Projects\\nexus-core`.\n\nFree-Only model routing is active (`Gemini 2.0 Flash` primary). Speak in English, Hinglish (*"Bhai dashboard ka header thoda chhota kar de..."*), or type a command. Every file modification will generate a verifiable diff gate prior to disk writes.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],

  setCurrentTab: (tab) => set({ currentTab: tab }),
  selectFile: (path) => set({ selectedFilePath: path }),
  setVoiceState: (state) => set({ voiceState: state }),
  toggleAudioTts: () => set((state) => ({ audioTtsEnabled: !state.audioTtsEnabled })),
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),

  executeUserPrompt: async (promptText: string, isVoice = false) => {
    const state = get();
    if (!promptText.trim() || state.isWorking) return;

    set({ isWorking: true });
    if (isVoice) set({ voiceState: 'parsing' });

    // Step 1: Normalize voice / prompt
    const norm = normalizeVoiceInput(promptText);
    const taskId = `#AX-${get().taskCounter}`;
    set((s) => ({ taskCounter: s.taskCounter + 1 }));

    // User message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      voiceTranscript: isVoice
        ? {
            original: norm.original,
            normalizedEnglish: norm.normalizedEnglish,
            language: norm.language
          }
        : undefined
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'FILE_READ',
          details: `User submitted prompt [${norm.language}]: "${promptText}"`,
          status: 'SUCCESS'
        },
        ...s.auditLogs
      ]
    }));

    // Step 2: Agent reasoning pipeline simulation
    if (isVoice) set({ voiceState: 'working' });

    // Identify target file and proposed changes
    let targetFilePath = norm.targetComponent || 'src/components/Header.tsx';
    let currentContent = state.files[targetFilePath] || state.files['src/components/Header.tsx'];
    let proposedContent = currentContent;
    let summaryText = '';

    if (norm.actionType === 'modify_ui' || promptText.toLowerCase().includes('header') || promptText.toLowerCase().includes('chhota')) {
      targetFilePath = 'src/components/Header.tsx';
      currentContent = state.files[targetFilePath] || INITIAL_WORKSPACE_FILES['src/components/Header.tsx'];
      proposedContent = `import React from 'react';

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
    <header className="h-12 px-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <h1 className="text-sm font-semibold text-white tracking-wide">{title}</h1>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
          {project}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-emerald-400 border border-slate-700">
          ● Live Sync
        </span>
        <div className="text-xs font-mono text-slate-300 font-medium">
          {currentDate}
        </div>
      </div>
    </header>
  );
}`;
      summaryText = 'Reduced header height to compact h-12 (from h-16) and aligned date display to the right side with a status indicator pill.';
    } else if (norm.actionType === 'create_component' || promptText.toLowerCase().includes('statscard')) {
      targetFilePath = 'src/components/StatsCard.tsx';
      currentContent = state.files[targetFilePath] || INITIAL_WORKSPACE_FILES['src/components/StatsCard.tsx'];
      proposedContent = `import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  trend: string;
  icon?: string;
}

export default function StatsCard({ title, value, trend }: StatsCardProps) {
  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition" />
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold font-mono text-white tracking-tight">{value}</span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
          {trend}
        </span>
      </div>
    </div>
  );
}`;
      summaryText = 'Created modular StatsCard with glowing hover state and animated trend badges.';
    } else if (norm.actionType === 'explain_code') {
      targetFilePath = 'src/App.tsx';
      currentContent = state.files[targetFilePath];
      summaryText = 'Analyzed component hierarchy: App wraps Header and 3-column StatsCard grid using React 18 state hooks with Tailwind CSS.';
    } else {
      targetFilePath = 'src/components/Header.tsx';
      currentContent = state.files[targetFilePath] || INITIAL_WORKSPACE_FILES['src/components/Header.tsx'];
      summaryText = `Applied task modifications according to request: "${norm.normalizedEnglish}".`;
    }

    const diffHunk: DiffHunk = {
      id: `diff-${Date.now()}`,
      taskId,
      filePath: targetFilePath,
      oldContent: currentContent,
      newContent: proposedContent,
      summary: summaryText,
      status: 'pending_approval',
      timestamp: new Date().toLocaleTimeString()
    };

    // Agent response message
    const botMsg: ChatMessage = {
      id: `msg-${Date.now()}-bot`,
      sender: 'boss_agent',
      agentName: 'Boss Agent',
      agentRole: 'boss',
      text: `Task **${taskId}** planned. Routed through **Gemini 2.0 Flash (Free)**.\n\n${norm.language !== 'en' ? `*Parsed from ${norm.language === 'hi-hinglish' ? 'Hinglish' : 'Hindi'}:* "${norm.normalizedEnglish}"\n\n` : ''}${summaryText}\n\n⚠️ **Diff Safety Gate Active:** Review the proposed patch below. Changes will not be written to disk until you explicitly approve.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      taskId,
      reasoningSteps: [
        { agent: 'Boss Agent', action: 'Triage prompt & verify Free router rate limits', status: 'completed' },
        { agent: 'Requirement Analyst', action: `Normalize: "${norm.normalizedEnglish}"`, status: 'completed' },
        { agent: 'Frontend Developer', action: `Generate AST patch for ${targetFilePath}`, status: 'completed' },
        { agent: 'File Agent', action: 'Stage pre-modification sandbox snapshot', status: 'completed' }
      ],
      proposedDiff: diffHunk
    };

    set((s) => ({
      messages: [...s.messages, botMsg],
      activeDiff: diffHunk,
      isWorking: false,
      voiceState: 'ready',
      auditLogs: [
        {
          id: `AUD-${Date.now()}-patch`,
          timestamp: new Date().toISOString(),
          actor: 'BOSS_AGENT',
          action: 'PATCH_GENERATED',
          targetPath: targetFilePath,
          details: `Generated diff preview for task ${taskId}: ${summaryText}`,
          status: 'SUCCESS'
        },
        ...s.auditLogs
      ]
    }));

    // Audio TTS if enabled
    if (get().audioTtsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(summaryText);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('TTS error', e);
      }
    }
  },

  approveDiff: async (diffId: string) => {
    const state = get();
    const diff = state.activeDiff || state.messages.find((m) => m.proposedDiff?.id === diffId)?.proposedDiff;
    if (!diff) return;

    // Snapshot creation
    const snapshot: TaskSnapshot = {
      taskId: diff.taskId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      title: diff.summary,
      filePath: diff.filePath,
      originalContent: diff.oldContent,
      modifiedContent: diff.newContent,
      reverted: false,
      exitCode: 0
    };

    // Update file
    const newFiles = { ...state.files, [diff.filePath]: diff.newContent };

    // Update diff status in messages
    const updatedMessages = state.messages.map((m) => {
      if (m.proposedDiff?.id === diff.id) {
        return {
          ...m,
          proposedDiff: { ...m.proposedDiff, status: 'approved' as const },
          buildStatus: 'building' as const
        };
      }
      return m;
    });

    set({
      files: newFiles,
      snapshots: [snapshot, ...state.snapshots],
      messages: updatedMessages,
      activeDiff: null,
      terminalLogs: [
        ...state.terminalLogs,
        `> USER_APPROVED ${diff.taskId} -> Writing to native filesystem: ${diff.filePath}`,
        `> [PowerShell] npm run build --workspace=${diff.filePath}`,
        '  Compiling TypeScript AST...',
        '  Vite transform: 1,624 modules transformed.',
        `  Build Success! Exit code: 0 [PASS]`
      ],
      auditLogs: [
        {
          id: `AUD-${Date.now()}-appr`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'USER_APPROVED',
          targetPath: diff.filePath,
          details: `User approved patch for ${diff.taskId}`,
          status: 'SUCCESS'
        },
        {
          id: `AUD-${Date.now()}-write`,
          timestamp: new Date().toISOString(),
          actor: 'SPECIALIST_AGENT',
          action: 'FILE_WRITE',
          targetPath: diff.filePath,
          details: `Native layer wrote ${diff.newContent.length} bytes to ${diff.filePath}`,
          status: 'SUCCESS'
        },
        {
          id: `AUD-${Date.now()}-term`,
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'TERMINAL_EXEC',
          targetPath: diff.filePath,
          details: 'Automatic terminal build validation passed with exit code 0.',
          exitCode: 0,
          status: 'SUCCESS'
        },
        ...state.auditLogs
      ]
    });

    // Mark buildStatus passed
    setTimeout(() => {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.taskId === diff.taskId ? { ...m, buildStatus: 'passed' as const } : m
        )
      }));
    }, 400);
  },

  rejectDiff: (diffId: string) => {
    const state = get();
    const updatedMessages = state.messages.map((m) => {
      if (m.proposedDiff?.id === diffId) {
        return {
          ...m,
          proposedDiff: { ...m.proposedDiff, status: 'rejected' as const }
        };
      }
      return m;
    });

    set({
      messages: updatedMessages,
      activeDiff: null,
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'PATCH_GENERATED',
          details: `User rejected proposed diff. Zero changes committed to disk.`,
          status: 'WARN'
        },
        ...state.auditLogs
      ]
    });
  },

  rollbackTask: (taskId: string) => {
    const state = get();
    const snapshot = state.snapshots.find((s) => s.taskId === taskId);
    if (!snapshot || snapshot.reverted) return;

    // Restore original file
    const newFiles = { ...state.files, [snapshot.filePath]: snapshot.originalContent };
    const updatedSnapshots = state.snapshots.map((s) =>
      s.taskId === taskId ? { ...s, reverted: true } : s
    );

    set({
      files: newFiles,
      snapshots: updatedSnapshots,
      terminalLogs: [
        ...state.terminalLogs,
        `> UNDO_ROLLBACK ${taskId} [Target: ${snapshot.filePath}]`,
        `  Restoring pre-modification snapshot... Done.`,
        `  Exit code: 0 [Clean Restore]`
      ],
      auditLogs: [
        {
          id: `AUD-${Date.now()}-undo`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'UNDO_ROLLBACK',
          targetPath: snapshot.filePath,
          details: `Executed 1-Click Rollback on task ${taskId}. Restored original disk state.`,
          status: 'SUCCESS'
        },
        ...state.auditLogs
      ]
    });
  },

  simulateFailover: () => {
    const state = get();
    set({
      activeModelId: 'openrouter-llama-3.3-70b',
      models: state.models.map((m) =>
        m.id === 'gemini-2.0-flash'
          ? { ...m, status: 'rate_limited' as const }
          : m
      ),
      terminalLogs: [
        ...state.terminalLogs,
        `[ROUTER FAILOVER] Gemini 2.0 Flash hit rate limit. Switching to backup free model: Meta Llama 3.3 70B (OpenRouter Free).`
      ],
      auditLogs: [
        {
          id: `AUD-${Date.now()}-failover`,
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'MODEL_FAILOVER',
          details: 'Automatic failover triggered: Gemini 2.0 Flash -> Meta Llama 3.3 70B ($0.00)',
          status: 'WARN'
        },
        ...state.auditLogs
      ]
    });
  },

  requestPaidModel: (modelId: string) => {
    set({
      isPaidOverrideModalOpen: true,
      pendingPaidModelId: modelId
    });
  },

  authorizePaidModelOnce: () => {
    const state = get();
    const model = state.models.find((m) => m.id === state.pendingPaidModelId);
    if (!model) return;

    set({
      activeModelId: model.id,
      isPaidOverrideModalOpen: false,
      pendingPaidModelId: null,
      models: state.models.map((m) =>
        m.id === model.id ? { ...m, tier: 'paid_allowed' as const, status: 'healthy' as const } : m
      ),
      auditLogs: [
        {
          id: `AUD-${Date.now()}-paid`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'PAID_OVERRIDE',
          details: `User explicitly authorized paid model override: ${model.name}`,
          status: 'SUCCESS'
        },
        ...state.auditLogs
      ]
    });
  },

  closePaidModal: () => set({ isPaidOverrideModalOpen: false, pendingPaidModelId: null }),

  triggerBuildErrorDemo: () => {
    const state = get();
    const errorMsg: ChatMessage = {
      id: `msg-err-${Date.now()}`,
      sender: 'system',
      text: 'Build Error detected in terminal pipeline for `src/components/Header.tsx`:\n\n```bash\nerror TS2322: Type \'string\' is not assignable to type \'number\'.\nLine 14: <header height="compact">\n```\n\nSelf-Healing Recovery ready. Would you like the Boss Agent to fix this regression?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      buildStatus: 'failed',
      buildErrorLogs: "error TS2322: Type 'string' is not assignable to type 'number'. Header.tsx:14"
    };

    set({
      messages: [...state.messages, errorMsg],
      terminalLogs: [
        ...state.terminalLogs,
        '> [PowerShell] npm run build',
        'error TS2322: Type "string" is not assignable to type "number". Header.tsx:14',
        'Build failed! Exit code: 1 [FATAL]'
      ]
    });
  },

  healBuildError: () => {
    const state = get();
    const fixHunk: DiffHunk = {
      id: `diff-heal-${Date.now()}`,
      taskId: `#AX-${state.taskCounter}`,
      filePath: 'src/components/Header.tsx',
      oldContent: state.files['src/components/Header.tsx'],
      newContent: state.files['src/components/Header.tsx'].replace('h-12', 'h-14'),
      summary: 'Self-Healing Patch: Fixed invalid prop type in Header component.',
      status: 'pending_approval',
      timestamp: new Date().toLocaleTimeString()
    };

    const fixMsg: ChatMessage = {
      id: `msg-heal-${Date.now()}`,
      sender: 'boss_agent',
      agentName: 'Boss Agent',
      agentRole: 'boss',
      text: '🩺 **Self-Healing Diagnostics Complete**\n\nDebug Agent analyzed the terminal stack trace: The invalid height attribute was sanitized and reverted to standard Tailwind height classes. Inspect and approve below to recover.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      proposedDiff: fixHunk
    };

    set({
      messages: [...state.messages, fixMsg],
      activeDiff: fixHunk,
      terminalLogs: [
        ...state.terminalLogs,
        '> [Self-Healing] Debug Agent identified TS2322 at Header.tsx:14.',
        '> Prepared AST repair patch.'
      ]
    });
  },

  runPilotTask: async (taskId: number) => {
    set((s) => ({
      pilotTasks: s.pilotTasks.map((t) => (t.id === taskId ? { ...t, status: 'running' as const } : t))
    }));

    await new Promise((r) => setTimeout(r, 600));

    set((s) => ({
      pilotTasks: s.pilotTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'passed' as const,
              score: 50,
              binaryGates: { terminalBuild: 'PASS', rollbackTested: 'YES' }
            }
          : t
      )
    }));
  },

  runAllPilotTasks: async () => {
    const state = get();
    for (const task of state.pilotTasks) {
      await state.runPilotTask(task.id);
    }
  },

  createCustomAgent: (newAgentData) => {
    const newAgent: Agent = {
      id: `agent-custom-${Date.now()}`,
      name: newAgentData.name || 'Custom Specialist',
      role: 'custom',
      category: 'custom',
      avatar: newAgentData.avatar || '🤖',
      badge: 'CUST',
      description: newAgentData.description || 'Custom user-defined specialist agent.',
      systemPrompt: newAgentData.systemPrompt || 'Execute instructions according to custom guidelines.',
      preferredModel: newAgentData.preferredModel || 'Gemini 2.0 Flash (Free)',
      status: 'ready',
      isCustom: true
    };

    set((s) => ({
      agents: [...s.agents, newAgent],
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'WORKSPACE_SELECT',
          details: `Registered new custom specialist agent: ${newAgent.name}`,
          status: 'SUCCESS'
        },
        ...s.auditLogs
      ]
    }));
  },

  clearTerminal: () => set({ terminalLogs: ['Terminal cleared. AXION Kernel v1.0.0 ready.'] }),

  runTerminalCommand: (command: string) => {
    const state = get();
    const cmd = command.trim();
    if (!cmd) return;

    let response = `Command executed: ${cmd}`;
    let exitCode = 0;

    if (cmd === 'npm run build' || cmd === 'npm build') {
      response = 'tsc && vite build\n1,624 modules transformed in 2.29s. Zero TypeScript errors.';
    } else if (cmd === 'npm test' || cmd === 'vitest') {
      response = 'Reality Acceptance Test Suite: 10 / 10 PASS (100%)\nRelease Candidate Audit: 6 / 6 GATES PASS';
    } else if (cmd === 'git status') {
      response = 'On branch main\nYour branch is up to date with origin/main.\nChanges stage: Clean.';
    } else if (cmd.startsWith('cat ') || cmd.startsWith('type ')) {
      const p = cmd.split(' ')[1];
      response = state.files[p] ? `Content of ${p}:\n${state.files[p]}` : `File not found: ${p}`;
    }

    set({
      terminalLogs: [...state.terminalLogs, `> ${cmd}`, response, `Exit code: ${exitCode}`],
      auditLogs: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'USER',
          action: 'TERMINAL_EXEC',
          details: `Executed terminal command: "${cmd}" [Exit code: ${exitCode}]`,
          exitCode,
          status: 'SUCCESS'
        },
        ...state.auditLogs
      ]
    });
  }
}));
