/**
 * "Meet AXION": the spoken first conversation after a brain is connected. AXION greets
 * the user in formal English, asks which language to use (and, for Hindi, Devanagari or
 * Roman), asks what to call them, then asks the profile questions in that language.
 * Pure state machine: the UI speaks `say`, listens, and feeds the answer back.
 */
import { languageById, languageLabel, parseHindiScript, parseLanguageAnswer, type LanguagePreference } from './languagePreference.ts';

export type MeetStage = 'language' | 'hindiScript' | 'name' | 'role' | 'projects' | 'help' | 'style' | 'done';
export const PROFILE_STAGES = ['role', 'projects', 'help', 'style'] as const;
export type ProfileField = typeof PROFILE_STAGES[number];

export interface MeetQuestions { name: string; role: string; projects: string; help: string; style: string; done: string }

export interface MeetState {
  stage: MeetStage;
  pref?: LanguagePreference;
  name: string;
  answers: Record<ProfileField, string>;
  retries: number;
}

export const GREETING = 'Hello Sir, I am AXION, your personal AI assistant. I can help you write code, work on your computer and keep track of what matters to you. Which language would you prefer to speak with me in?';
const LANGUAGE_RETRY = 'Sorry, I did not catch the language. You can say English, Hindi, Kannada, Tamil, Telugu, French, Japanese, or any other language.';
const HINDI_SCRIPT = 'Would you like pure Hindi, written in Devanagari, or Roman Hindi, written in English letters? शुद्ध हिंदी या रोमन हिंदी?';
const HINDI_SCRIPT_RETRY = 'Please say "pure Hindi" or "Roman Hindi". शुद्ध हिंदी या रोमन हिंदी?';

const EN: MeetQuestions = {
  name: 'Perfect, we will speak in English. What should I call you? For example Sir, Boss, or your name.',
  role: 'Thank you, {name}. What kind of work do you do, or what is your role? You can say skip for any question.',
  projects: 'What are you working on or building right now?',
  help: 'Where would you like the most help from me? For example coding, debugging, your daily computer work, or something else.',
  style: 'How should I reply to you: short or detailed, technical or conversational?',
  done: 'Thank you, {name}. I have noted everything. Please check your answers on the screen, correct anything I misheard, and save your profile.',
};
const HI_DEVA: MeetQuestions = {
  name: 'ठीक है, हम शुद्ध हिंदी में बात करेंगे। मैं आपको क्या कहकर बुलाऊँ? जैसे सर, बॉस, या आपका नाम।',
  role: 'धन्यवाद {name}। आप क्या काम करते हैं, या आपका रोल क्या है? किसी भी सवाल को "छोड़ो" कहकर छोड़ सकते हैं।',
  projects: 'अभी आप किस चीज़ पर काम कर रहे हैं, या क्या बना रहे हैं?',
  help: 'आपको मुझसे सबसे ज़्यादा किस चीज़ में मदद चाहिए? जैसे कोडिंग, डीबगिंग, कंप्यूटर का रोज़ का काम, या कुछ और।',
  style: 'मैं आपको जवाब कैसे दूँ: छोटे या विस्तार से, तकनीकी या बातचीत वाले अंदाज़ में?',
  done: 'धन्यवाद {name}। मैंने सब नोट कर लिया है। स्क्रीन पर अपने जवाब देख लीजिए, कुछ गलत सुना हो तो ठीक कर दीजिए, और प्रोफ़ाइल सेव कर दीजिए।',
};
const HI_LATN: MeetQuestions = {
  name: 'Theek hai, hum Roman Hindi mein baat karenge. Main aapko kya bulaun? Jaise Sir, Boss, ya aapka naam.',
  role: 'Shukriya {name}. Aap kya kaam karte hain, ya aapka role kya hai? Kisi bhi sawaal ko "skip" bol kar chhod sakte hain.',
  projects: 'Abhi aap kis cheez par kaam kar rahe hain, ya kya bana rahe hain?',
  help: 'Aapko mujhse sabse zyada kis cheez mein madad chahiye? Jaise coding, debugging, computer ka roz ka kaam, ya kuch aur.',
  style: 'Main aapko jawab kaise doon: chhote ya detail mein, technical ya baatcheet wale andaaz mein?',
  done: 'Shukriya {name}. Maine sab note kar liya hai. Screen par apne jawab dekh lijiye, kuch galat suna ho to theek kar dijiye, aur profile save kar dijiye.',
};

/** Built-in question sets; other languages are translated from English by the connected brain. */
export function builtInQuestions(pref: LanguagePreference): MeetQuestions | null {
  if (pref.id === 'en') return EN;
  if (pref.id === 'hi') return pref.script === 'deva' ? HI_DEVA : HI_LATN;
  return null;
}
export const ENGLISH_QUESTIONS = EN;

/** Asks the brain to translate the English questions; English on any failure. */
export async function translateQuestions(pref: LanguagePreference, ask: (prompt: string) => Promise<string>): Promise<MeetQuestions> {
  const built = builtInQuestions(pref);
  if (built) return built;
  const lang = languageById(pref.id)?.name ?? 'English';
  const keys = Object.keys(EN) as (keyof MeetQuestions)[];
  const source = { ...EN, name: `Perfect, we will speak in ${lang}. What should I call you? For example Sir, Boss, or your name.` };
  try {
    const raw = await ask(`Translate each value of this JSON object into natural, polite, spoken ${lang} in its usual script. Keep every {name} placeholder exactly as it is. Reply with ONLY the JSON object, same keys.\n${JSON.stringify(source)}`);
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (keys.every((k) => typeof json[k] === 'string' && json[k].trim() && json[k].length < 600)) {
      const out = Object.fromEntries(keys.map((k) => [k, json[k].trim()])) as unknown as MeetQuestions;
      if (out.role.includes('{name}') && out.done.includes('{name}')) return out;
    }
  } catch { /* fall through */ }
  return { ...source };
}

const SKIP = /^(?:skip|next|pass|chhodo|chodo|छोड़ो|छोड़िए|अगला|aage|आगे)[.!]*$/iu;

/** The name or form of address in an answer: "call me Arman", "mujhe Boss bulao", "Arman". */
export function parseName(text: string): string {
  let t = text.trim().replace(/[.!?।"]+/gu, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:you can |please )?(?:call me|my name is|i am|i'm|it's|mera naam|मेरा नाम|मुझे|mujhe|aap mujhe|आप मुझे)\s+/iu, '');
  t = t.replace(/\s+(?:hai|hain|है|bulao|bulaiye|bulaaiye|kaho|kahiye|बुलाओ|बुलाइए|कहिए|कहो|please|kehkar bulao|कहकर बुलाओ)(?:\s.*)?$/iu, '').trim();
  if (!t || SKIP.test(t) || t.length > 40) return 'Sir';
  return /^[a-z]/.test(t) ? t.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
}

const fill = (q: string, name: string) => q.split('{name}').join(name);

export function startMeet(): { state: MeetState; say: string } {
  return { state: { stage: 'language', name: '', answers: { role: '', projects: '', help: '', style: '' }, retries: 0 }, say: GREETING };
}

/**
 * Applies one answer. `questions` is the set for the chosen language; it is only needed
 * from the "name" stage on, and the caller loads it (built in or translated) when
 * `needsQuestions` comes back true.
 */
export function answerMeet(state: MeetState, text: string, questions?: MeetQuestions): { state: MeetState; say: string; needsQuestions?: boolean } {
  const answer = text.trim();
  switch (state.stage) {
    case 'language': {
      const pref = parseLanguageAnswer(answer);
      if (!pref) {
        if (state.retries >= 2) return { state: { ...state, stage: 'name', pref: { id: 'en' }, retries: 0 }, say: `I will continue in English for now; you can change it later in Voice Settings. ${EN.name.replace(/^Perfect, we will speak in English\. /, '')}` };
        return { state: { ...state, retries: state.retries + 1 }, say: LANGUAGE_RETRY };
      }
      if (pref.id === 'hi' && !pref.script) return { state: { ...state, stage: 'hindiScript', pref, retries: 0 }, say: HINDI_SCRIPT };
      return { state: { ...state, stage: 'name', pref, retries: 0 }, say: '', needsQuestions: true };
    }
    case 'hindiScript': {
      const script = parseHindiScript(answer);
      if (!script) {
        if (state.retries >= 1) return { state: { ...state, stage: 'name', pref: { id: 'hi', script: 'latn' }, retries: 0 }, say: '', needsQuestions: true };
        return { state: { ...state, retries: state.retries + 1 }, say: HINDI_SCRIPT_RETRY };
      }
      return { state: { ...state, stage: 'name', pref: { id: 'hi', script }, retries: 0 }, say: '', needsQuestions: true };
    }
    case 'name': {
      const q = questions ?? EN;
      const name = parseName(answer);
      return { state: { ...state, stage: 'role', name }, say: fill(q.role, name) };
    }
    case 'role': case 'projects': case 'help': case 'style': {
      const q = questions ?? EN;
      const value = SKIP.test(answer) ? '' : answer.slice(0, 1200);
      const answers = { ...state.answers, [state.stage]: value };
      const next = PROFILE_STAGES[PROFILE_STAGES.indexOf(state.stage) + 1];
      if (!next) return { state: { ...state, stage: 'done', answers }, say: fill(q.done, state.name || 'Sir') };
      return { state: { ...state, stage: next, answers }, say: fill(q[next], state.name || 'Sir') };
    }
    case 'done': return { state, say: '' };
  }
}

/** The first question once the language is known (asked right after it is set). */
export function nameQuestion(questions: MeetQuestions): string { return questions.name; }

export function describePreference(pref?: LanguagePreference): string { return pref ? languageLabel(pref) : 'English'; }
