/**
 * AXION-X100 Terminal Service & Execution Engine
 * Handles shell profiles, process execution, PTY abstraction,
 * dangerous command gating, secret sanitization, dev server detection,
 * and workspace synchronization.
 */

import { TerminalSession, AuditLog } from '../types';

export interface CommandAnalysis {
  command: string;
  isDangerous: boolean;
  isSafe: boolean;
  riskReason?: string;
  category: 'build' | 'test' | 'lint' | 'dev_server' | 'git' | 'filesystem' | 'destructive' | 'package_mgmt' | 'general';
  suggestedAction?: string;
}

export interface ExecutionResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string[];
  stderr: string[];
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  detectedDevUrl?: string;
  filesModifiedLikelihood: boolean;
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

// Dangerous patterns that MUST trigger the Dangerous Safety Gate
const DANGEROUS_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  { regex: /\brm\s+-(?:rf|fr|r)\b/i, reason: 'Recursive forced file and directory deletion.' },
  { regex: /\brmdir\s+\/s\b/i, reason: 'Windows recursive directory tree removal.' },
  { regex: /\bdel\s+\/[sfq]\b/i, reason: 'Windows recursive forced file deletion.' },
  { regex: /\bformat\s+[a-z]:/i, reason: 'Disk format command.' },
  { regex: /\bdiskpart\b/i, reason: 'Disk partitioning utility execution.' },
  { regex: /\bgit\s+reset\s+--hard\b/i, reason: 'Hard git reset discarding all uncommitted local code and changes.' },
  { regex: /\bgit\s+clean\s+-(?:fd|df|f)\b/i, reason: 'Untracked files and directories permanent deletion.' },
  { regex: /\bgit\s+push\s+.*--force\b/i, reason: 'Force pushing git branches overwriting remote history.' },
  { regex: /\bdrop\s+database\b/i, reason: 'SQL database drop statement.' },
  { regex: /\bdrop\s+table\b/i, reason: 'SQL table drop statement.' },
  { regex: /\btruncate\s+table\b/i, reason: 'SQL table truncate statement.' },
  { regex: /\bshutdown\b/i, reason: 'System shutdown / power-off execution.' },
  { regex: /\breg\s+delete\b/i, reason: 'Windows Registry key deletion.' },
  { regex: /\b(?:npm|pnpm|yarn|cargo)\s+publish\b/i, reason: 'Package publication to external registry.' },
  { regex: /\bchmod\s+-R\s+777\b/i, reason: 'Unsafe global permission elevation.' },
  { regex: /\bdd\s+if=/i, reason: 'Low-level raw block device write.' }
];

// Safe commands that Boss Agent can run with lightweight confirmation
const SAFE_PATTERNS = [
  /^git\s+(?:status|diff|log|branch|show)/i,
  /^(?:npm|pnpm|yarn|bun)\s+run\s+(?:build|lint|typecheck|check)/i,
  /^(?:npm|pnpm|yarn|bun)\s+test\b/i,
  /^tsc(?:\s+--noEmit)?$/i,
  /^(?:ls|dir|pwd|echo|node\s+-v|git\s+--version|npm\s+-v|cargo\s+--version)/i
];

/**
 * Classifies a command for safety and origin handling
 */
export function analyzeCommand(command: string): CommandAnalysis {
  const trimmed = command.trim();

  // Check dangerous patterns
  for (const { regex, reason } of DANGEROUS_PATTERNS) {
    if (regex.test(trimmed)) {
      return {
        command: trimmed,
        isDangerous: true,
        isSafe: false,
        riskReason: reason,
        category: 'destructive',
        suggestedAction: 'Require explicit user authorization before execution.'
      };
    }
  }

  // Check if safe
  const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(trimmed));

  let category: CommandAnalysis['category'] = 'general';
  if (/build/i.test(trimmed)) category = 'build';
  else if (/test/i.test(trimmed)) category = 'test';
  else if (/lint/i.test(trimmed) || /tsc/i.test(trimmed)) category = 'lint';
  else if (/\b(?:dev|start|serve|vite|next\s+dev)\b/i.test(trimmed)) category = 'dev_server';
  else if (/^git\b/i.test(trimmed)) category = 'git';
  else if (/^(?:npm|pnpm|yarn|bun)\s+(?:install|add|remove|update)/i.test(trimmed)) category = 'package_mgmt';
  else if (/^(?:ls|dir|pwd|cd|cat|mkdir|touch)/i.test(trimmed)) category = 'filesystem';

  return {
    command: trimmed,
    isDangerous: false,
    isSafe,
    category
  };
}

/**
 * Sanitizes secrets from logs, stdout, audit trails, and output views
 */
export function sanitizeSecrets(text: string): string {
  if (!text) return text;
  let sanitized = text;

  // Google AI / Gemini keys (AIzaSy...)
  sanitized = sanitized.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIzaSy...[REDACTED]');

  // OpenAI keys (sk-...)
  sanitized = sanitized.replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-...[REDACTED]');

  // GitHub tokens (ghp_..., github_pat_...)
  sanitized = sanitized.replace(/ghp_[A-Za-z0-9]{36}/g, 'ghp_...[REDACTED]');
  sanitized = sanitized.replace(/github_pat_[A-Za-z0-9_]{50,}/g, 'github_pat_...[REDACTED]');

  // Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+([A-Za-z0-9\-_.~+/]+=*)/gi, 'Bearer [TOKEN-REDACTED]');

  // Generic secret / password strings in urls
  sanitized = sanitized.replace(/(https?:\/\/[^:\s]+):([^@\s]+)@/g, '$1:***@');

  // Generic environment variable assignments like SECRET_KEY=xxx or API_KEY=xxx
  sanitized = sanitized.replace(/((?:API_KEY|SECRET|PASSWORD|TOKEN|AUTH|PRIVATE_KEY)\s*[:=]\s*['"]?)[^\s'"]{6,}(['"]?)/gi, '$1[REDACTED]$2');

  return sanitized;
}

/**
 * Detects running development server URLs from terminal output streams
 */
export function detectDevServerUrl(output: string): string | null {
  if (!output) return null;

  // Regex matching standard localhost / 127.0.0.1 / 0.0.0.0 URLs with ports
  const match = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]{2,5}(?:\/[^\s]*)?/i);
  if (match) {
    // Normalize 0.0.0.0 or 127.0.0.1 to localhost for browser preview friendliness
    return match[0].replace('0.0.0.0', 'localhost').replace('127.0.0.1', 'localhost');
  }

  return null;
}

/**
 * Determines whether running this command could modify project files (triggering debounced workspace rescan)
 */
export function couldModifyWorkspaceFiles(command: string): boolean {
  const c = command.trim().toLowerCase();
  return (
    c.includes('install') ||
    c.includes('build') ||
    c.includes('add') ||
    c.includes('remove') ||
    c.includes('checkout') ||
    c.includes('pull') ||
    c.includes('merge') ||
    c.includes('touch') ||
    c.includes('mkdir') ||
    c.includes('generate') ||
    c.includes('format') ||
    c.includes('prettier') ||
    c.includes('eslint --fix')
  );
}

/**
 * Shell profile definition
 */
export interface ShellProfile {
  id: string;
  name: string;
  shellType: 'powershell' | 'cmd' | 'git-bash' | 'wsl' | 'bash' | 'opencode' | 'gemini-cli' | 'custom';
  executable: string;
  promptPrefix: string;
  iconName: string;
  isDefault?: boolean;
}

export const AVAILABLE_SHELL_PROFILES: ShellProfile[] = [
  {
    id: 'powershell',
    name: 'PowerShell',
    shellType: 'powershell',
    executable: 'powershell.exe',
    promptPrefix: 'PS',
    iconName: 'Terminal',
    isDefault: true
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    shellType: 'cmd',
    executable: 'cmd.exe',
    promptPrefix: '',
    iconName: 'Terminal'
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    shellType: 'git-bash',
    executable: 'bash.exe',
    promptPrefix: '$',
    iconName: 'Terminal'
  },
  {
    id: 'wsl',
    name: 'WSL (Ubuntu)',
    shellType: 'wsl',
    executable: 'wsl.exe',
    promptPrefix: '$',
    iconName: 'Terminal'
  },
  {
    id: 'opencode',
    name: 'OpenCode CLI',
    shellType: 'opencode',
    executable: 'opencode',
    promptPrefix: 'opencode>',
    iconName: 'Sparkles'
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI Agent',
    shellType: 'gemini-cli',
    executable: 'gemini',
    promptPrefix: 'gemini>',
    iconName: 'Sparkles'
  },
  {
    id: 'bash',
    name: 'Linux / Web Shell',
    shellType: 'bash',
    executable: '/bin/bash',
    promptPrefix: '$',
    iconName: 'Terminal'
  }
];

/**
 * Formats a terminal timestamp
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toTimeString().split(' ')[0];
}
