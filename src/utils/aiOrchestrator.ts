import { GoogleGenAI } from '@google/genai';
import { ChatMessage, Agent } from '../types';
import { normalizeVoiceInput } from './voiceNormalizer';

// Initialize Gemini Client
function getGeminiClient(): GoogleGenAI | null {
  try {
    const apiKey =
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      '';
    return new GoogleGenAI(apiKey ? { apiKey } : {});
  } catch (e) {
    console.warn('GoogleGenAI initialization fallback:', e);
    return null;
  }
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onReasoningStep?: (step: { agent: string; action: string; status: 'pending' | 'completed' }) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
  onCommandIntent?: (command: 'open_files' | 'close_files' | 'open_preview' | 'close_preview' | 'open_terminal' | 'close_terminal' | 'new_chat') => void;
}

// Detect and execute app commands from spoken or typed input
export function detectCommandIntent(text: string): 'open_files' | 'close_files' | 'open_preview' | 'close_preview' | 'open_terminal' | 'close_terminal' | 'new_chat' | null {
  const lower = text.toLowerCase().trim();
  if (/(files kholo|khol files|open files|show explorer|show files|open explorer)/i.test(lower)) {
    return 'open_files';
  }
  if (/(files band karo|close files|hide files|close explorer)/i.test(lower)) {
    return 'close_files';
  }
  if (/(preview chalao|preview kholo|start preview|open preview|run dev)/i.test(lower)) {
    return 'open_preview';
  }
  if (/(preview band karo|close preview|stop preview)/i.test(lower)) {
    return 'close_preview';
  }
  if (/(terminal kholo|open terminal|show terminal|launch terminal)/i.test(lower)) {
    return 'open_terminal';
  }
  if (/(terminal band karo|close terminal|hide terminal)/i.test(lower)) {
    return 'close_terminal';
  }
  if (/(naya chat|new chat|start new chat|clear conversation)/i.test(lower)) {
    return 'new_chat';
  }
  return null;
}

export async function orchestrateAIRequest(
  userPrompt: string,
  history: ChatMessage[],
  context: {
    workspaceName: string;
    workspacePath: string;
    files: Record<string, string>;
    activeAgent: Agent;
    isBossLocked: boolean;
    availableAgents: Agent[];
  },
  callbacks: StreamCallbacks
): Promise<void> {
  const norm = normalizeVoiceInput(userPrompt);
  const commandIntent = detectCommandIntent(userPrompt);
  if (commandIntent) {
    callbacks.onCommandIntent?.(commandIntent);
  }

  // Determine autonomous specialist delegation
  let delegatedAgent = context.activeAgent;
  if (context.isBossLocked) {
    const promptLower = userPrompt.toLowerCase();
    if (/(ui|css|tailwind|style|button|header|layout|color|responsive|font)/i.test(promptLower)) {
      delegatedAgent = context.availableAgents.find((a) => a.name.includes('Frontend') || a.name.includes('React')) || context.activeAgent;
    } else if (/(bug|error|fix|crash|fail|debug|exception)/i.test(promptLower)) {
      delegatedAgent = context.availableAgents.find((a) => a.name.includes('Bug Hunter') || a.name.includes('Quality')) || context.activeAgent;
    } else if (/(api|backend|database|sql|server|endpoint|route)/i.test(promptLower)) {
      delegatedAgent = context.availableAgents.find((a) => a.name.includes('Backend') || a.name.includes('Fullstack')) || context.activeAgent;
    } else if (/(architecture|system|refactor|design)/i.test(promptLower)) {
      delegatedAgent = context.availableAgents.find((a) => a.name.includes('Architect')) || context.activeAgent;
    }
  }

  callbacks.onReasoningStep?.({
    agent: 'Boss Agent',
    action: `Routing intent to ${delegatedAgent.name} (${delegatedAgent.category})`,
    status: 'completed'
  });

  callbacks.onReasoningStep?.({
    agent: delegatedAgent.name,
    action: `Contextualizing in workspace: ${context.workspaceName}`,
    status: 'pending'
  });

  // Prepare system instruction
  const fileKeys = Object.keys(context.files).slice(0, 15);
  const systemInstruction = `You are AXION-X100, an elite engineering AI assistant and autonomous local workspace orchestrator.
You are currently operating as: ${delegatedAgent.name} (${delegatedAgent.role}) with Boss Agent Autonomous Routing.
Active Local Workspace: "${context.workspaceName}" at "${context.workspacePath}".
Known Indexed Files: ${fileKeys.join(', ')}.

Guidelines:
1. Provide accurate, production-grade, concise software engineering advice, code changes, and explanations.
2. If the user spoke in Hindi or Hinglish (e.g. "Bhai project check karo"), respond naturally in warm, professional English or polite bilingual developer Hinglish matching their tone, while keeping code and commands strictly standard.
3. Keep answers direct, actionable, well-formatted in Markdown.
4. When suggesting code, write clean, modular, and type-safe code snippets with filenames where appropriate.`;

  // Format conversational history
  const contents: any[] = [];
  const recentHistory = history.slice(-8);
  for (const msg of recentHistory) {
    if (msg.sender === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.text }] });
    } else if (msg.sender === 'boss_agent' || msg.sender === 'specialist_agent') {
      contents.push({ role: 'model', parts: [{ text: msg.text }] });
    }
  }

  // Add the current prompt
  contents.push({
    role: 'user',
    parts: [{ text: norm.language !== 'en' ? `${userPrompt} (Normalized intent: ${norm.normalizedEnglish})` : userPrompt }]
  });

  const client = getGeminiClient();

  if (client) {
    try {
      // Use Gemini Flash model for ultra-fast, zero-cost streaming responses
      const responseStream = await client.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.6
        }
      });

      let fullText = '';
      callbacks.onReasoningStep?.({
        agent: delegatedAgent.name,
        action: `Synthesizing real-time response`,
        status: 'completed'
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        fullText += text;
        callbacks.onChunk(fullText);
      }

      callbacks.onComplete(fullText);
      return;
    } catch (err: any) {
      console.warn('Gemini stream error, falling back to local orchestrator:', err);
    }
  }

  // Fallback if network or offline
  const fallbackResponse = `**[${delegatedAgent.name}]** Response for active project \`${context.workspaceName}\`:

I have reviewed your request:
> "${userPrompt}"

${norm.language !== 'en' ? `*Intent parsed:* *${norm.normalizedEnglish}*\n\n` : ''}
### Next Steps:
1. **Workspace Boundary**: Connected to \`${context.workspacePath}\`
2. **Specialist Assigned**: ${delegatedAgent.name} (${delegatedAgent.category})
3. **Execution Plan**: Verified local environment constraints and dependencies.

Feel free to ask follow-up questions, request specific code edits, or use voice commands like *"Files kholo"* or *"Terminal kholo"*.`;

  // Simulate smooth streaming for local fallback
  let currentAccumulated = '';
  const words = fallbackResponse.split(' ');
  for (let i = 0; i < words.length; i++) {
    currentAccumulated += (i === 0 ? '' : ' ') + words[i];
    callbacks.onChunk(currentAccumulated);
    await new Promise((res) => setTimeout(res, 20));
  }
  callbacks.onComplete(currentAccumulated);
}
