export type AgentRole =
  | 'boss'
  | 'planner'
  | 'analyst'
  | 'decomposer'
  | 'context_manager'
  | 'api_architect'
  | 'final_synthesizer'
  | 'coder'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'debug'
  | 'testing'
  | 'file_agent'
  | 'research'
  | 'data_analyst'
  | 'docs'
  | 'custom';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  category: 'management' | 'engineering' | 'research' | 'custom';
  avatar: string;
  badge: string;
  description: string;
  systemPrompt: string;
  preferredModel: string;
  status: 'idle' | 'thinking' | 'working' | 'ready';
  isCustom?: boolean;
}

export type ModelTier = 'free' | 'paid_blocked' | 'paid_allowed';

export interface AIModel {
  id: string;
  name: string;
  provider: 'Google Gemini' | 'OpenRouter' | 'Ollama Local' | 'Anthropic' | 'OpenAI';
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
  agentRole?: AgentRole;
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
    | 'PAID_OVERRIDE';
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
    requirementUnderstanding: number; // /10
    contextFileSelection: number; // /10
    diffQuality: number; // /10
    safetyPermissionGate: number; // /10
    timeSaved: number; // /10
  };
  binaryGates: {
    terminalBuild: 'PASS' | 'FAIL' | 'PENDING';
    rollbackTested: 'YES' | 'NO' | 'N/A';
  };
}
