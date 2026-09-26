import { Agent } from '../types';

export const INITIAL_AGENTS: Agent[] = [
  // 1. Management & Architecture
  {
    id: 'boss-agent',
    name: 'Boss Agent',
    role: 'boss',
    category: 'management',
    avatar: '👑',
    badge: 'LEAD',
    description: 'Supreme orchestrator. Triages prompts, enforces zero-cost routing, delegates to specialists, and demands safety gates.',
    systemPrompt: 'You are the AXION Boss Agent. Protect user files, prioritize free models, decompose complex objectives, and demand diff approvals.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'master-planner',
    name: 'Master Planner',
    role: 'planner',
    category: 'management',
    avatar: '🗺️',
    badge: 'PLAN',
    description: 'High-level architectural roadmapping, breaking multi-layer initiatives into verifiable, incremental steps.',
    systemPrompt: 'Decompose feature requests into atomic, dependency-ordered engineering milestones.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'requirement-analyst',
    name: 'Requirement Analyst',
    role: 'analyst',
    category: 'management',
    avatar: '🔍',
    badge: 'REQ',
    description: 'Extracts unambiguous technical specifications from spoken English, Hinglish, or informal prompts.',
    systemPrompt: 'Normalize conversational and colloquial requirements into rigorous technical acceptance criteria.',
    preferredModel: 'OpenRouter / Llama 3.3 70B (Free)',
    status: 'ready'
  },
  {
    id: 'task-decomposer',
    name: 'Task Decomposer',
    role: 'decomposer',
    category: 'management',
    avatar: '✂️',
    badge: 'TASK',
    description: 'Breaks architectural plans into micro-actions (File Reads, AST Patches, Terminal Commands).',
    systemPrompt: 'Produce linear, idempotent execution sequences safe for local terminal and filesystem execution.',
    preferredModel: 'Ollama / Qwen 2.5 Coder (Local)',
    status: 'ready'
  },
  {
    id: 'context-manager',
    name: 'Context Manager',
    role: 'context_manager',
    category: 'management',
    avatar: '🧠',
    badge: 'CTX',
    description: 'Prunes unrelated workspace files to minimize context pollution and token consumption.',
    systemPrompt: 'Curate precisely the minimal required file AST nodes and declarations for the active diff.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'api-architect',
    name: 'API Architect',
    role: 'api_architect',
    category: 'management',
    avatar: '📐',
    badge: 'API',
    description: 'Designs typed interfaces, REST/RPC endpoints, schemas, and contract boundaries.',
    systemPrompt: 'Ensure backwards-compatible interface contracts, robust error types, and clean serialization.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'final-synthesizer',
    name: 'Final Synthesizer',
    role: 'final_synthesizer',
    category: 'management',
    avatar: '⚖️',
    badge: 'SYNC',
    description: 'Reviews multi-agent outputs, performs sanity checks on combined patches, and summarizes changes for user approval.',
    systemPrompt: 'Harmonize multi-file modifications and deliver an executive summary in spoken and visual format.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },

  // 2. Engineering & Testing
  {
    id: 'coding-agent',
    name: 'Coding Agent',
    role: 'coder',
    category: 'engineering',
    avatar: '⚡',
    badge: 'CODE',
    description: 'High-precision algorithmic code generation, refactoring, and AST-level modifications.',
    systemPrompt: 'Generate production-grade, bug-free, type-safe code strictly respecting existing codebases.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    role: 'frontend',
    category: 'engineering',
    avatar: '🎨',
    badge: 'UI',
    description: 'Specialist in React, Tailwind CSS, component lifecycles, responsiveness, and accessible ergonomics.',
    systemPrompt: 'Craft elegant, responsive, dark-mode-first React interfaces with seamless micro-interactions.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    role: 'backend',
    category: 'engineering',
    avatar: '⚙️',
    badge: 'SRV',
    description: 'Express, Node runtime, IPC bridges, file handlers, and robust server-side controllers.',
    systemPrompt: 'Implement resilient backend handlers, secure input boundaries, and clean async control flows.',
    preferredModel: 'Ollama / Qwen 2.5 Coder (Local)',
    status: 'ready'
  },
  {
    id: 'database-engineer',
    name: 'Database Engineer',
    role: 'database',
    category: 'engineering',
    avatar: '🗄️',
    badge: 'DB',
    description: 'Schema modeling, migrations, indexing, transactions, and in-memory caching strategies.',
    systemPrompt: 'Structure optimized data access layers, prevent race conditions, and craft clean migrations.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'debug-agent',
    name: 'Debug Agent',
    role: 'debug',
    category: 'engineering',
    avatar: '🐞',
    badge: 'FIX',
    description: 'Diagnoses build logs, runtime stack traces, memory leaks, and logic regressions with self-healing proposals.',
    systemPrompt: 'Isolate root cause from terminal logs and generate minimal surgical repair patches.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'testing-agent',
    name: 'Testing Agent',
    role: 'testing',
    category: 'engineering',
    avatar: '🧪',
    badge: 'TEST',
    description: 'Generates unit tests, mock suites, integration verification, and terminal regression suites.',
    systemPrompt: 'Construct comprehensive test matrices, edge cases, and deterministic assertions.',
    preferredModel: 'OpenRouter / Llama 3.3 70B (Free)',
    status: 'ready'
  },
  {
    id: 'file-agent',
    name: 'File Agent',
    role: 'file_agent',
    category: 'engineering',
    avatar: '📁',
    badge: 'FS',
    description: 'Manages safe filesystem staging, atomic writes, workspace boundaries, and task snapshots.',
    systemPrompt: 'Guard filesystem invariants. Never perform write operations without signed diff verification.',
    preferredModel: 'Ollama / Qwen 2.5 Coder (Local)',
    status: 'ready'
  },

  // 3. Research & Data
  {
    id: 'research-agent',
    name: 'Research Agent',
    role: 'research',
    category: 'research',
    avatar: '🔬',
    badge: 'RES',
    description: 'Surveys modern SDKs, changelogs, RFCs, and dependency alternatives for engineering choices.',
    systemPrompt: 'Conduct thorough technical investigations and recommend optimal library and pattern choices.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  },
  {
    id: 'data-analyst',
    name: 'Data Analysis Agent',
    role: 'data_analyst',
    category: 'research',
    avatar: '📊',
    badge: 'DATA',
    description: 'Analyzes build profiles, performance metrics, memory overhead, and benchmark logs.',
    systemPrompt: 'Synthesize raw execution metrics and audit logs into clear performance insights.',
    preferredModel: 'OpenRouter / Llama 3.3 70B (Free)',
    status: 'ready'
  },
  {
    id: 'docs-agent',
    name: 'Documentation Agent',
    role: 'docs',
    category: 'research',
    avatar: '📖',
    badge: 'DOCS',
    description: 'Maintains changelogs, architecture diagrams, inline JSDoc, and README verification guides.',
    systemPrompt: 'Produce lucid, developer-centric documentation, architecture diagrams, and release notes.',
    preferredModel: 'Gemini 2.0 Flash (Free)',
    status: 'ready'
  }
];
