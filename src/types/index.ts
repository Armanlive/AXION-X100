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
  provider: 'Google Gemini' | 'OpenRouter' | 'Ollama Local' | 'Anthropic' | 'OpenAI' | 'Groq' | 'Cloudflare';
  tier: ModelTier;
  costPer1kTokens: string;
  contextWindow: string;
  status: 'healthy' | 'degraded' | 'rate_limited' | 'offline';
  latencyMs: number;
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
  taskId: string;
  timestamp: string;
  title: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  reverted: boolean;
  exitCode: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: 'USER' | 'BOSS_AGENT' | 'SPECIALIST_AGENT' | 'SYSTEM';
  action:
    | 'WORKSPACE_SELECT'
    | 'FILE_READ'
    | 'PATCH_GENERATED'
    | 'USER_APPROVED'
    | 'FILE_WRITE'
    | 'TERMINAL_EXEC'
    | 'UNDO_ROLLBACK'
    | 'MODEL_FAILOVER'
    | 'PAID_OVERRIDE'
    | 'PROVIDER_CONNECT'
    | 'SPEECH_SESSION';
  targetPath?: string;
  details: string;
  exitCode?: number;
  status: 'SUCCESS' | 'WARN' | 'BLOCKED';
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
  children?: WorkspaceFile[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  branch: string;
  isLocalTauri?: boolean;
  lastOpened?: string;
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
  type: 'powershell' | 'bash' | 'opencode' | 'gemini-cli' | 'custom';
  logs: string[];
  cwd?: string;
  createdAt: string;
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
  status: 'connected' | 'disconnected' | 'rate_limited' | 'error';
  tier: 'free' | 'paid';
  models: string[];
  latencyMs?: number;
}

// Voice & Speech Mode
export type SpeechMode = 'chat' | 'speech';
export type SpeechState = 'idle' | 'listening' | 'understanding' | 'thinking' | 'speaking' | 'parsing' | 'working' | 'ready';

export interface VoiceSettings {
  language: 'auto' | 'en' | 'hi' | 'hinglish';
  voiceName: string;
  speed: number;
  autoSpeak: boolean;
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
