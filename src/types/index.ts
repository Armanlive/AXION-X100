export type AgentCategory =
  | 'COMMAND'
  | 'CODING'
  | 'RESEARCH'
  | 'WRITING'
  | 'VISUAL'
  | 'DATA'
  | 'MEDIA'
  | 'PRODUCTIVITY'
  | 'STRATEGY'
  | 'QUALITY'
  | 'management'
  | 'engineering'
  | 'research'
  | 'custom';

export type AgentRole = string;

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  category: AgentCategory;
  avatar: string;
  badge: string;
  description: string;
  systemPrompt: string;
  preferredModel: string;
  status: 'idle' | 'thinking' | 'working' | 'ready';
  enabled?: boolean;
  isCustom?: boolean;
}

export type ModelTier = 'free' | 'paid_blocked' | 'paid_allowed';

export interface AIModel {
  id: string;
  name: string;
  displayName?: string;
  provider: string;
  providerModelId?: string;
  tier: ModelTier;
  costPer1kTokens: string;
  inputCost?: string;
  outputCost?: string;
  contextWindow: string;
  status: 'healthy' | 'degraded' | 'rate_limited' | 'offline' | 'untested';
  latencyMs?: number;
  capabilities?: ('coding' | 'reasoning' | 'vision' | 'tool_use' | 'fast')[];
  codingScore?: number;
  isLocal?: boolean;
  online?: boolean;
  availability?: 'available' | 'requires_key' | 'requires_auth' | 'offline';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'boss_agent' | 'specialist_agent' | 'system';
  agentName?: string;
  agentRole?: string;
  text: string;
  timestamp: string;
  taskId?: string;
  voiceTranscript?: {
    original: string;
    normalizedEnglish: string;
    language: 'en' | 'hi-hinglish' | 'hi';
  };
  reasoningSteps?: {
    agent: string;
    action: string;
    status: 'pending' | 'completed';
  }[];
  proposedDiff?: DiffHunk;
  buildStatus?: 'idle' | 'building' | 'passed' | 'failed';
  buildErrorLogs?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface DiffHunk {
  id: string;
  taskId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  summary: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'reverted';
  timestamp: string;
}

export interface TaskSnapshot {
  id?: string;
  taskId: string;
  timestamp: string;
  title: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  reverted: boolean;
  exitCode: number;
  origin?: 'manual' | 'boss-agent' | 'specialist-agent';
  workspaceId?: string;
  workspacePath?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: 'USER' | 'BOSS_AGENT' | 'SPECIALIST_AGENT' | 'SYSTEM';
  action:
    | 'WORKSPACE_SELECT'
    | 'FILE_READ'
    | 'FILE_OPEN'
    | 'FILE_EDIT_STARTED'
    | 'DIFF_CREATED'
    | 'DIFF_APPROVED'
    | 'DIFF_REJECTED'
    | 'FILE_WRITE'
    | 'FILE_CREATE'
    | 'FILE_RENAME'
    | 'FILE_DELETE'
    | 'ROLLBACK'
    | 'PATCH_GENERATED'
    | 'USER_APPROVED'
    | 'TERMINAL_EXEC'
    | 'COMMAND_PROPOSED'
    | 'COMMAND_APPROVED'
    | 'COMMAND_REJECTED'
    | 'COMMAND_STARTED'
    | 'COMMAND_FINISHED'
    | 'COMMAND_FAILED'
    | 'PROCESS_KILLED'
    | 'UNDO_ROLLBACK'
    | 'MODEL_FAILOVER'
    | 'PAID_OVERRIDE'
    | 'PROVIDER_CONNECT'
    | 'SPEECH_SESSION';
  targetPath?: string;
  command?: string;
  cwd?: string;
  origin?: 'manual' | 'boss-agent' | 'specialist-agent' | 'system' | 'user';
  details: string;
  exitCode?: number;
  durationMs?: number;
  status: 'SUCCESS' | 'WARN' | 'BLOCKED';
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  children?: WorkspaceFile[];
}

export interface ProjectFileEntry {
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  modifiedTimestamp?: number;
  isDirectory: boolean;
  content?: string;
  isLoaded?: boolean;
}

export interface ActiveWorkspace {
  id: string;
  name: string;
  absolutePath: string;
  projectType: string;
  framework: string;
  packageManager: string;
  gitBranch: string;
  gitRepository: boolean;
  indexedFileCount: number;
  selectedAt: string;
  lastOpenedAt: string;
  status: 'ready' | 'scanning' | 'error' | 'disconnected';
  runtimeMode?: 'native-tauri' | 'web-sandbox' | 'memory-only';
  scripts?: Record<string, string>;
  dependenciesCount?: number;
  dirHandle?: any; // Native FileSystemDirectoryHandle when in browser
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  branch: string;
  isLocalTauri?: boolean;
  runtimeMode?: 'native-tauri' | 'web-sandbox' | 'memory-only';
  lastOpened?: string;
  projectType?: string;
  framework?: string;
  indexedFileCount?: number;
}

export interface PilotTask {
  id: number;
  title: string;
  description: string;
  targetScenario: string;
  suggestedPrompt: string;
  voicePromptHinglish?: string;
  status: 'ready' | 'running' | 'passed' | 'failed';
  score?: number; // /50
  breakdown?: {
    requirementUnderstanding: number;
    contextFileSelection: number;
    diffQuality: number;
    safetyPermissionGate: number;
    timeSaved: number;
  };
  binaryGates: {
    terminalBuild: 'PASS' | 'FAIL' | 'PENDING';
    rollbackTested: 'YES' | 'NO' | 'N/A';
  };
}

export type PanelDockPosition = 'bottom' | 'left' | 'right';

export interface TerminalSession {
  id: string;
  name: string;
  type: 'powershell' | 'cmd' | 'git-bash' | 'wsl' | 'bash' | 'opencode' | 'gemini-cli' | 'custom';
  shell?: string;
  cwd: string;
  pid?: number;
  status: 'idle' | 'running' | 'terminated' | 'error';
  logs: string[];
  history: string[];
  historyIndex?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastExitCode?: number;
  durationMs?: number;
  activeProcessName?: string;
}

export interface OutputLogEvent {
  id: string;
  timestamp: string;
  category: 'BUILD' | 'LINT' | 'TEST' | 'DEV_SERVER' | 'WORKSPACE' | 'AI' | 'SECURITY' | 'PROCESS';
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
  exitCode?: number;
  details?: string;
}

export interface ProposedTerminalCommand {
  id: string;
  command: string;
  cwd: string;
  isDangerous: boolean;
  riskReason?: string;
  origin: 'manual' | 'boss-agent' | 'specialist-agent' | 'system' | 'user';
  agentName?: string;
  sessionId?: string;
  timestamp: string;
}

export interface PreviewRuntime {
  workspaceId: string;
  processId?: number | string;
  sessionId?: string;
  command: string;
  cwd: string;
  url: string | null;
  port: number | null;
  status: 'idle' | 'starting' | 'running' | 'error' | 'stopped';
  startedAt?: string;
  framework?: string;
  errorLogs?: string;
  exitCode?: number;
}

// Compute & Cloud Brain
export type ComputeMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

export interface CloudProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'gemini' | 'openrouter' | 'groq' | 'cloudflare' | 'nvidia' | 'ollama' | 'custom';
  apiKey?: string;
  isConnected: boolean;
  isPrimary: boolean;
  status: 'connected' | 'disconnected' | 'rate_limited' | 'error' | 'not_configured' | 'untested';
  tier: 'free' | 'paid';
  models: string[];
  latencyMs?: number;
  pingResult?: string;
}

// Voice & Speech Mode
export type SpeechMode = 'chat' | 'speech';
export type SpeechState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'understanding'
  | 'thinking'
  | 'speaking'
  | 'parsing'
  | 'working'
  | 'ready'
  | 'paused'
  | 'error';

export interface VoiceSettings {
  language: 'auto' | 'en' | 'hi' | 'hinglish';
  voiceName: string;
  speed: number;
  autoSpeak: boolean;
  listeningMode: 'push-to-talk' | 'continuous';
}

// Orchestration Activity
export interface OrchestrationActivity {
  id: string;
  step: string;
  agent: string;
  detail: string;
  timestamp: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
