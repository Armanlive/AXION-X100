import { PilotTask } from '../types';

export const INITIAL_PILOT_TASKS: PilotTask[] = [
  {
    id: 1,
    title: 'Project Understanding',
    description: 'Architecture & tech stack scanning across repository structure.',
    targetScenario: 'Initial workspace onboarding and AST understanding.',
    suggestedPrompt: 'Mere project ka main App component explain karo aur dependencies batao',
    voicePromptHinglish: 'Bhai mere project ka App component explain karo',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 2,
    title: 'Simple UI Change',
    description: 'Header compact height & date right side alignment with live diff.',
    targetScenario: 'Precision UI refactor with zero visual or layout regressions.',
    suggestedPrompt: 'Header ko compact karo aur date right side daal do',
    voicePromptHinglish: 'Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 3,
    title: 'Voice Coding (Hinglish)',
    description: 'Natural speech-to-text with Hinglish normalizer parsing colloquial commands.',
    targetScenario: 'Hands-free voice instruction parsing and execution.',
    suggestedPrompt: 'Bhai sidebar ko compact kar de aur icons prominent bana',
    voicePromptHinglish: 'Bhai sidebar ko compact kar de',
    status: 'passed',
    score: 49,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 9,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 4,
    title: 'Multi-File Modification',
    description: 'Coordinated updates across component, store, and styles.',
    targetScenario: 'Atomically patching multiple dependent files without state mismatch.',
    suggestedPrompt: 'Ek naya StatsCard component banao aur App.tsx me mount karo',
    voicePromptHinglish: 'Ek naya statscard component banao',
    status: 'passed',
    score: 48,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 9,
      safetyPermissionGate: 10,
      timeSaved: 9
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 5,
    title: 'Build Error Recovery',
    description: 'Self-healing build diagnosis & 1-click Ask Boss Agent to Fix recovery.',
    targetScenario: 'Catching syntax/type errors in terminal and applying patch.',
    suggestedPrompt: 'Trigger intentional syntax error and run Ask Boss Agent to Fix',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 6,
    title: 'Zero-Cost Router & Failover',
    description: 'Priority routing to Gemini 2.0 Flash + failover to OpenRouter / Local Ollama.',
    targetScenario: 'Zero-cost enforcement, blocking paid models without approval.',
    suggestedPrompt: 'Simulate Gemini rate limit to verify automatic failover to Llama 3.3',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'N/A'
    }
  },
  {
    id: 7,
    title: 'Diff Review & Safety Gate',
    description: 'Strict prohibition of silent disk writes; user must inspect diff and approve.',
    targetScenario: 'Safe file modifications with explicit visual verification.',
    suggestedPrompt: 'Inspect side-by-side diff preview and verify safety gate.',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  },
  {
    id: 8,
    title: 'Security Containment',
    description: 'Restricts AI file access strictly to user-approved workspace boundary.',
    targetScenario: 'Intercepting path traversal attacks (e.g. ../../Windows/System32).',
    suggestedPrompt: 'Attempt access to external system path C:/Windows/System32',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'N/A'
    }
  },
  {
    id: 9,
    title: 'Long Session & Memory Cleanup',
    description: 'Process management, cache trimming, and zero memory leaks.',
    targetScenario: 'Running prolonged agent loops without RAM degradation.',
    suggestedPrompt: 'Run memory and process garbage collection verification.',
    status: 'passed',
    score: 49,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 9
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'N/A'
    }
  },
  {
    id: 10,
    title: 'Task Snapshots & 1-Click Rollback',
    description: 'Pre-modification snapshots bound to Task IDs (#AX-1042) with isolated rollback.',
    targetScenario: 'Restoring original file state with a single click.',
    suggestedPrompt: 'Apply patch to Header.tsx and immediately execute 1-Click Rollback',
    status: 'passed',
    score: 50,
    breakdown: {
      requirementUnderstanding: 10,
      contextFileSelection: 10,
      diffQuality: 10,
      safetyPermissionGate: 10,
      timeSaved: 10
    },
    binaryGates: {
      terminalBuild: 'PASS',
      rollbackTested: 'YES'
    }
  }
];
