export interface NormalizationResult {
  original: string;
  normalizedEnglish: string;
  language: 'en' | 'hi-hinglish' | 'hi';
  targetComponent?: string;
  actionType: 'modify_ui' | 'create_component' | 'fix_bug' | 'explain_code' | 'general_task';
  confidence: number;
}

const HINGLISH_DICTIONARY: { [pattern: string]: { replacement: string; targetComponent?: string; actionType?: NormalizationResult['actionType'] } } = {
  'bhai dashboard ka header thoda chhota kar de aur date right side mein daal de': {
    replacement: 'Refactor dashboard header: reduce vertical height (compact) and align the date display to the right side.',
    targetComponent: 'src/components/Header.tsx',
    actionType: 'modify_ui'
  },
  'header chhota kar de': {
    replacement: 'Reduce the height and padding of Header component to make it compact.',
    targetComponent: 'src/components/Header.tsx',
    actionType: 'modify_ui'
  },
  'date right side daal do': {
    replacement: 'Align the date display element to the right side of the navbar.',
    targetComponent: 'src/components/Header.tsx',
    actionType: 'modify_ui'
  },
  'bhai sidebar ko compact kar de': {
    replacement: 'Make the workspace navigation sidebar compact and icon-first.',
    targetComponent: 'src/components/Sidebar.tsx',
    actionType: 'modify_ui'
  },
  'bhai login button blue kar do': {
    replacement: 'Change login button background color to brand blue (#2563eb).',
    targetComponent: 'src/components/LoginButton.tsx',
    actionType: 'modify_ui'
  },
  'mere project ka main app component explain karo': {
    replacement: 'Explain the architecture, state hooks, and component hierarchy of the main App component.',
    targetComponent: 'src/App.tsx',
    actionType: 'explain_code'
  },
  'ek naya statscard component banao': {
    replacement: 'Create a new modular StatsCard component with title, metric value, trend indicator, and sparkline.',
    targetComponent: 'src/components/StatsCard.tsx',
    actionType: 'create_component'
  },
  'fix the button click handler and state update': {
    replacement: 'Fix the button click handler and prevent stale closure state updates.',
    targetComponent: 'src/components/ActionButton.tsx',
    actionType: 'fix_bug'
  }
};

export function normalizeVoiceInput(input: string): NormalizationResult {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct dictionary match
  for (const [key, mapping] of Object.entries(HINGLISH_DICTIONARY)) {
    if (lower.includes(key) || key.includes(lower)) {
      const isHindi = /[\u0900-\u097F]/.test(trimmed);
      const isHinglish = /(bhai|karo|kar de|daal do|chhota|banao|mera|mere|hai|ka|ki|ko)/i.test(trimmed);
      return {
        original: trimmed,
        normalizedEnglish: mapping.replacement,
        language: isHindi ? 'hi' : isHinglish ? 'hi-hinglish' : 'en',
        targetComponent: mapping.targetComponent,
        actionType: mapping.actionType || 'general_task',
        confidence: 0.96
      };
    }
  }

  // 2. Heuristic rules for Hinglish
  const hasHinglishTokens = /(bhai|karo|kar de|karna|daal|chhota|bada|hatao|banao|fix karo|dekh|sun|karega)/i.test(trimmed);
  const isHindiScript = /[\u0900-\u097F]/.test(trimmed);

  if (hasHinglishTokens || isHindiScript) {
    let converted = lower;
    converted = converted.replace(/\bbhai\b/gi, '');
    converted = converted.replace(/\bthoda\b/gi, 'slightly');
    converted = converted.replace(/\bchhota kar de\b|\bchhota karo\b/gi, 'make more compact');
    converted = converted.replace(/\bbada kar de\b/gi, 'increase size of');
    converted = converted.replace(/\bdaal de\b|\bdaal do\b/gi, 'place / insert');
    converted = converted.replace(/\bhata de\b|\bhata do\b/gi, 'remove');
    converted = converted.replace(/\bbanao\b|\bbanaye\b/gi, 'create');
    converted = converted.replace(/\bexplain karo\b/gi, 'explain in detail');
    converted = converted.replace(/\btheek karo\b|\bfix karo\b/gi, 'fix');
    converted = converted.replace(/\bka\b|\bki\b|\bko\b/gi, 'of');
    converted = converted.replace(/\s+/g, ' ').trim();

    return {
      original: trimmed,
      normalizedEnglish: `Execute technical request: ${converted.charAt(0).toUpperCase() + converted.slice(1)}`,
      language: isHindiScript ? 'hi' : 'hi-hinglish',
      actionType: 'modify_ui',
      confidence: 0.88
    };
  }

  // 3. Plain English
  return {
    original: trimmed,
    normalizedEnglish: trimmed,
    language: 'en',
    actionType: 'general_task',
    confidence: 1.0
  };
}

export type SpokenCommandType =
  | 'OPEN_FILES'
  | 'OPEN_TERMINAL'
  | 'OPEN_PREVIEW'
  | 'OPEN_WORKSPACE'
  | 'OPEN_AGENT_LAB'
  | 'OPEN_CLOUD_BRAIN'
  | 'MUTE_MIC';

export interface SpokenCommandResult {
  isCommand: boolean;
  commandType?: SpokenCommandType;
  confirmationSpeech?: string;
}

export function detectSpokenCommand(input: string): SpokenCommandResult {
  const lower = input.toLowerCase().trim();

  if (
    lower.includes('files kholo') ||
    lower.includes('file kholo') ||
    lower.includes('open files') ||
    lower.includes('show files') ||
    lower.includes('project files') ||
    lower.includes('file explorer')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_FILES',
      confirmationSpeech: 'Files panel open kar raha hoon.'
    };
  }

  if (
    lower.includes('terminal kholo') ||
    lower.includes('open terminal') ||
    lower.includes('show terminal') ||
    lower.includes('terminal dikhao')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_TERMINAL',
      confirmationSpeech: 'Terminal open kar diya hai.'
    };
  }

  if (
    lower.includes('preview dikhao') ||
    lower.includes('preview kholo') ||
    lower.includes('preview chalao') ||
    lower.includes('open preview') ||
    lower.includes('show preview')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_PREVIEW',
      confirmationSpeech: 'Application preview open kar raha hoon.'
    };
  }

  if (
    lower.includes('workspace kholo') ||
    lower.includes('local workspace') ||
    lower.includes('open workspace')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_WORKSPACE',
      confirmationSpeech: 'Local workspace inspect kar raha hoon.'
    };
  }

  if (
    lower.includes('agent lab') ||
    lower.includes('agents dikhao') ||
    lower.includes('agent lab kholo')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_AGENT_LAB',
      confirmationSpeech: '100 Specialist Agent Lab open kar raha hoon.'
    };
  }

  if (
    lower.includes('cloud brain') ||
    lower.includes('cloud brain kholo') ||
    lower.includes('router kholo')
  ) {
    return {
      isCommand: true,
      commandType: 'OPEN_CLOUD_BRAIN',
      confirmationSpeech: 'Cloud Brain compute intelligence open kar raha hoon.'
    };
  }

  return { isCommand: false };
}

/**
 * Prepares raw markdown and code responses for natural conversational TTS
 * Leaves full text in chat, while reading a concise, natural spoken equivalent
 */
export function prepareTextForSpeech(text: string): string {
  if (!text) return '';

  let clean = text;

  // Replace full code fences with natural verbal summary
  clean = clean.replace(/```[a-z]*\n[\s\S]*?\n```/gi, ' Code update ready in your workspace. ');
  clean = clean.replace(/```[\s\S]*?```/g, ' Code snippet provided. ');

  // Replace inline backtick code snippets
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // Friendly speech for file paths: src/components/Header.tsx -> Header component
  clean = clean.replace(
    /(?:src\/[a-zA-Z0-9_\-\/]+\/)?([a-zA-Z0-9_\-]+)\.(tsx|ts|jsx|js|css|json|html)/g,
    '$1 $2 file'
  );

  // Strip markdown formatting symbols: headers, bold, italics, tables, bullet points
  clean = clean
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/---+/g, '');

  // Strip non-speech emojis
  clean = clean.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');

  // Collapse multiple whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // If the text is very long (e.g. detailed architectural plan), provide a spoken summary cap for voice brevity
  if (clean.length > 350) {
    const periodIdx = clean.indexOf('.', 200);
    if (periodIdx !== -1 && periodIdx < 400) {
      clean = clean.slice(0, periodIdx + 1);
    } else {
      clean = clean.slice(0, 320) + '... Detailed technical plan written in your chat.';
    }
  }

  return clean;
}

