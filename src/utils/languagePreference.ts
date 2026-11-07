/**
 * The language the user chose to talk to AXION in (during "Meet AXION" or later). It sets
 * how AXION replies, which language the speech recognizer listens for, and the script
 * Hindi is written in (Devanagari or Roman/Hinglish). A plain preference, not profile
 * data, so it is stored unencrypted and works before any profile exists.
 */
export interface LanguageOption {
  id: string;
  /** English name, used in prompts. */
  name: string;
  /** Name in the language itself, shown in the UI. */
  native: string;
  /** BCP-47 locale for speech recognition and voices. */
  locale: string;
  /** Lower-case words a user may say for it (English, native, romanized). */
  aliases: string[];
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'en', name: 'English', native: 'English', locale: 'en-IN', aliases: ['english', 'angrezi', 'inglish', 'अंग्रेज़ी', 'अंग्रेजी', 'इंग्लिश'] },
  { id: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', aliases: ['hindi', 'हिंदी', 'हिन्दी'] },
  { id: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', locale: 'kn-IN', aliases: ['kannada', 'kanada', 'kannad', 'ಕನ್ನಡ', 'कन्नड़', 'कन्नड'] },
  { id: 'ta', name: 'Tamil', native: 'தமிழ்', locale: 'ta-IN', aliases: ['tamil', 'தமிழ்', 'तमिल'] },
  { id: 'te', name: 'Telugu', native: 'తెలుగు', locale: 'te-IN', aliases: ['telugu', 'telgu', 'తెలుగు', 'तेलुगु'] },
  { id: 'ml', name: 'Malayalam', native: 'മലയാളം', locale: 'ml-IN', aliases: ['malayalam', 'മലയാളം', 'मलयालम'] },
  { id: 'mr', name: 'Marathi', native: 'मराठी', locale: 'mr-IN', aliases: ['marathi', 'मराठी'] },
  { id: 'bn', name: 'Bengali', native: 'বাংলা', locale: 'bn-IN', aliases: ['bengali', 'bangla', 'বাংলা', 'बंगाली', 'बांग्ला'] },
  { id: 'gu', name: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN', aliases: ['gujarati', 'ગુજરાતી', 'गुजराती'] },
  { id: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', locale: 'pa-IN', aliases: ['punjabi', 'panjabi', 'ਪੰਜਾਬੀ', 'पंजाबी'] },
  { id: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', locale: 'or-IN', aliases: ['odia', 'oriya', 'ଓଡ଼ିଆ', 'उड़िया', 'ओड़िया'] },
  { id: 'ur', name: 'Urdu', native: 'اردو', locale: 'ur-IN', aliases: ['urdu', 'اردو', 'उर्दू'] },
  { id: 'zh', name: 'Chinese', native: '中文', locale: 'zh-CN', aliases: ['chinese', 'mandarin', '中文', '普通话', 'चाइनीज़', 'चाइनीस', 'चीनी'] },
  { id: 'ja', name: 'Japanese', native: '日本語', locale: 'ja-JP', aliases: ['japanese', '日本語', 'जापानी', 'जापानीज़', 'जापानीस'] },
  { id: 'ko', name: 'Korean', native: '한국어', locale: 'ko-KR', aliases: ['korean', '한국어', 'कोरियन'] },
  { id: 'fr', name: 'French', native: 'Français', locale: 'fr-FR', aliases: ['french', 'francais', 'français', 'फ्रेंच'] },
  { id: 'de', name: 'German', native: 'Deutsch', locale: 'de-DE', aliases: ['german', 'deutsch', 'जर्मन'] },
  { id: 'es', name: 'Spanish', native: 'Español', locale: 'es-ES', aliases: ['spanish', 'espanol', 'español', 'स्पैनिश'] },
  { id: 'pt', name: 'Portuguese', native: 'Português', locale: 'pt-BR', aliases: ['portuguese', 'portugues', 'português'] },
  { id: 'it', name: 'Italian', native: 'Italiano', locale: 'it-IT', aliases: ['italian', 'italiano'] },
  { id: 'ru', name: 'Russian', native: 'Русский', locale: 'ru-RU', aliases: ['russian', 'русский', 'रशियन'] },
  { id: 'ar', name: 'Arabic', native: 'العربية', locale: 'ar-SA', aliases: ['arabic', 'العربية', 'अरबी'] },
];

export type HindiScript = 'deva' | 'latn';
export interface LanguagePreference { id: string; script?: HindiScript }

const KEY = 'axion.language.v1';

export function languageById(id: string): LanguageOption | undefined { return LANGUAGES.find((l) => l.id === id); }

/** "Roman Hindi" is Hindi in Latin letters (Hinglish); "pure Hindi" is Devanagari. */
export function parseHindiScript(text: string): HindiScript | null {
  const t = text.toLowerCase();
  if (/\b(?:roman|hinglish|english (?:letters|script)|latin)\b|रोमन|हिंग्लिश/u.test(t)) return 'latn';
  if (/\b(?:pure|shuddh|shudh|devanagari|proper)\b|शुद्ध|प्योर|देवनागरी|असली/u.test(t)) return 'deva';
  return null;
}

/**
 * The language named in a spoken or typed answer ("Hindi please", "मुझे कन्नड़ में",
 * "roman hindi"). Returns the preference, `{id:'hi'}` without a script when Hindi still
 * needs the pure/Roman choice, or null when no language was recognized.
 */
/** Drops languages the user rejected: "not English", "English nahi", "अंग्रेज़ी नहीं". */
function withoutNegated(t: string): string {
  return t.replace(/ (?:not|no|don'?t|dont) \S+/g, ' ').replace(/ \S+ (?:nahi|nahin|mat|नहीं|मत)(?= )/gu, ' ');
}

export function parseLanguageAnswer(text: string): LanguagePreference | null {
  const t = withoutNegated(` ${text.toLowerCase().normalize('NFC').replace(/[.,!?।"()]/gu, ' ').replace(/\s+/g, ' ')} `);
  if (/\b(?:roman|hinglish)\b|रोमन|हिंग्लिश/u.test(t)) return { id: 'hi', script: 'latn' };
  const found = LANGUAGES
    .map((lang) => ({ lang, at: Math.min(...lang.aliases.map((a) => { const i = /^[a-z]/.test(a) ? t.indexOf(` ${a} `) : t.indexOf(a); return i < 0 ? Infinity : i; })) }))
    .filter((f) => f.at !== Infinity).sort((a, b) => a.at - b.at);
  const lang = found[0]?.lang;
  if (!lang) return null;
  if (lang.id !== 'hi') return { id: lang.id };
  const script = parseHindiScript(t);
  return script ? { id: 'hi', script } : { id: 'hi' };
}

export function loadLanguagePreference(): LanguagePreference | null {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    if (!v || typeof v.id !== 'string' || !languageById(v.id)) return null;
    return v.id === 'hi' ? { id: 'hi', script: v.script === 'deva' ? 'deva' : 'latn' } : { id: v.id };
  } catch { return null; }
}

export function saveLanguagePreference(pref: LanguagePreference): void {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(pref)); } catch { /* session only */ }
}

/** Human label, e.g. "Roman Hindi (Hinglish)". */
export function languageLabel(pref: LanguagePreference): string {
  if (pref.id === 'hi') return pref.script === 'deva' ? 'Hindi (Devanagari)' : 'Roman Hindi (Hinglish)';
  return languageById(pref.id)?.name ?? 'English';
}

/** Locale the recognizer should listen in. */
export function preferenceLocale(pref: LanguagePreference): string {
  return languageById(pref.id)?.locale ?? 'en-IN';
}

/** Closest setting of the existing voice language selector. */
export function voiceSettingFor(pref: LanguagePreference): 'en' | 'hi' | 'hinglish' | 'auto' {
  if (pref.id === 'en') return 'en';
  if (pref.id === 'hi') return pref.script === 'deva' ? 'hi' : 'hinglish';
  return 'auto';
}

/** System-prompt line so replies start in the chosen language. */
export function languageRule(pref: LanguagePreference | null = loadLanguagePreference()): string {
  if (!pref) return '';
  const how = pref.id === 'hi'
    ? pref.script === 'deva' ? 'Hindi written in Devanagari script' : 'Roman Hindi (Hinglish): Hindi written in Latin letters, mixed with English words the way Indians type'
    : `${languageById(pref.id)?.name ?? 'English'}, in its usual script`;
  return `PREFERRED LANGUAGE: the user chose ${how}. Reply in it by default; only switch if the user clearly writes or speaks in another language. `;
}
