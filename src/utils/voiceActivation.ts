// Recognizers spell "AXION" many ways (axon, exxon, aksion, एक्सन, एक्सियन, अक्सन…),
// so the name is matched by shape rather than a fixed list. "Action"/"एक्शन" is also
// how it is often heard, but it is an everyday word: it only counts after a greeting
// or a wake verb, never on its own.
const NAME = '(?:axiom|(?:a|e|ae|ai)(?:x+|ks+h?|kh?s|cks)(?:i|y|ee)?(?:o|a|e|u)?n|[एऐअ]क्[सष](?:ि|ी)?(?:य|ि)?(?:ॉ|ो|ा|े|ऑ|ओ)?न)';
const HEARD_AS_ACTION = '(?:actions?|[एऐअ]क्शन)';
const GREET = '(?:hello|hallo|hey|hi|hai|ok|okay|arre|are|हेलो|हैलो|हलो|हाय|हे|ओके|अरे|नमस्ते)';
const WAKE_VERB = '(?:jaago|jago|jaag(?:\\s+jao)?|utho|uth(?:\\s+jao)?|uthiye|suno|wake\\s+up|जागो|जाग(?:\\s+जाओ)?|उठो|उठ(?:\\s+जाओ)?|उठिए|सुनो)';
const SEP = '[\\s,।.!-]+';
const END = '(?=$|[\\s,।.!?])';
const WAKE_PATTERNS = [
  new RegExp(`^(?:${GREET}|${WAKE_VERB})${SEP}(?:${NAME}|${HEARD_AS_ACTION})${END}(?:${SEP}${WAKE_VERB}${END})?`, 'iu'),
  new RegExp(`^(?:${NAME}|${HEARD_AS_ACTION})${SEP}${WAKE_VERB}${END}`, 'iu'),
  new RegExp(`^${NAME}${END}`, 'iu'),
];

/**
 * Wake-prefix matching: "Hello AXION", "Jaago AXION", "Utho AXION", "AXION jaago",
 * or a sentence that starts with the name ("AXION, Chrome kholo"). Speech that
 * does not start this way is never treated as a command.
 */
export function parseWakePhrase(text: string): { matched: boolean; remainder: string } {
  const trimmed = text.trim();
  for (const pattern of WAKE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { matched: true, remainder: trimmed.slice(match[0].length).replace(/^[\s,।.!?]+/u, '').trim() };
  }
  return { matched: false, remainder: text };
}

// "go to sleep", "be quiet", "AXION so jao", "chup ho jao": AXION goes
// quiet and only listens for its name. Matched on the whole (short) utterance, so
// "sleep function kaise likhe" stays a normal question.
const SLEEP_FILLER = /\b(?:please|pls|plz|bhai|sir|boss|ok|okay|ab|abhi|thoda|thodi|der|kuch|ke|liye|tum|aap|ap|now|for|a|while|bit|little|right|just|yaar|yar|zara|jara|ji)\b|(?:भाई|सर|अब|अभी|थोड़ा|थोड़ी|थोडी|देर|कुछ|के|लिए|तुम|आप|ज़रा|जरा|यार|जी|प्लीज़|प्लीज)(?=$|\s)/giu;
const SLEEP_PATTERNS: RegExp[] = [
  /^(?:go\s+(?:to\s+)?sleep|sleep(?:\s+mode)?|go\s+to\s+sleep\s+mode|take\s+(?:a\s+)?rest|rest|be\s+(?:quiet|silent)|quiet|silence|shut\s+up|stop\s+(?:listening|talking)|don'?t\s+(?:talk|speak|listen)|do\s+not\s+(?:talk|speak|listen)|mute(?:\s+yourself)?|that'?s\s+all|bye)$/iu,
  /^(?:so|sona|soja|sojao|so\s*ja(?:o|ao|iye|yie|ie)?|so\s+jaa(?:o|ao)?|sleep\s+(?:karo|kar|ho\s+jao|mode\s+(?:mein|me)\s+(?:jao|chale\s+jao)))$/iu,
  /^(?:chup|chupp|chup\s*(?:ho\s*ja(?:o|ao|iye)?|ho\s+jaa(?:o)?|raho|rho|karo|kar|reh|rah|rahiye)|khamosh|khamosh\s+(?:ho\s+ja(?:o|iye)?|raho|rahiye))$/iu,
  /^(?:(?:baat|baatein|bat)\s+mat\s+(?:karo|kar|kijiye)|mat\s+bolo|mat\s+bol|bolna\s+band\s+karo|sunna\s+band\s+karo|band\s+ho\s+ja(?:o)?|rest\s+karo|aaram\s+karo|aram\s+karo|bas\s+karo|bas)$/iu,
  /^(?:सो\s*जा(?:ओ|इए|इये|ो)?|सो|सोजा(?:ओ)?|स्लीप(?:\s+मोड)?|स्लीप\s+करो|चुप(?:\s+(?:हो\s+जा(?:ओ|इए)?|रहो|रहिए|करो|हो))?|ख़?खामोश(?:\s+(?:हो\s+जा(?:ओ|इए)?|रहो|रहिए))?|ख़ामोश(?:\s+(?:हो\s+जा(?:ओ|इए)?|रहो|रहिए))?|बात\s+मत\s+(?:करो|कीजिए)|मत\s+बोलो|आराम\s+करो|बस\s+करो|बस)$/u,
];

/** True when the user tells AXION to sleep or be quiet (English, Hindi and Hinglish phrasings). */
export function detectSleepCommand(text: string): boolean {
  const wake = parseWakePhrase(text);
  const body = (wake.matched ? wake.remainder : text)
    .toLowerCase()
    .replace(/[.,!?।"'“”]+/gu, ' ')
    .replace(SLEEP_FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!body || body.split(' ').length > 6) return false;
  // A bare "bas"/"rest"/"bye" only counts when the user addressed AXION by name.
  if (/^(?:bas|rest|bye|so|sona|that'?s all|बस|सो)$/iu.test(body) && !wake.matched) return false;
  return SLEEP_PATTERNS.some((p) => p.test(body));
}

export function sleepAcknowledgement(_text = ''): { text: string; speechText: string } {
  return { text: 'Going quiet. Say "AXION" or "AXION, wake up" when you need me.', speechText: 'Going quiet. Just say my name when you need me.' };
}

/**
 * Whisper turns silence or background noise into punctuation or stock phrases
 * ("So", "Thank you", "Thanks for watching"). Those must never reach the model.
 */
const SILENCE_HALLUCINATIONS = /^(?:so|you|uh|um|hmm|thank you|thanks|thank you for watching|thanks for watching|please subscribe|subscribe|शुक्रिया|धन्यवाद|हम्म)$/iu;
export function isNoiseTranscript(text: string): boolean {
  // \p{M} keeps Devanagari vowel signs: "हाँ" is a real answer, not one stray letter.
  const letters = text.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  if (letters.length < 2 || SILENCE_HALLUCINATIONS.test(letters)) return true;
  // One short Latin fragment ("Ech", "Hm", "Ah") is a misheard sound, not a request;
  // real one-word answers are kept.
  return /^[a-z]{1,3}$/i.test(letters) && !SHORT_ANSWERS.has(letters.toLowerCase());
}
const SHORT_ANSWERS = new Set(['yes', 'yeah', 'yep', 'no', 'nah', 'ok', 'hi', 'hey', 'bye', 'go', 'stop', 'why', 'how', 'who', 'what', 'ha', 'han', 'haa', 'hn', 'ji', 'nai', 'bas', 'one', 'two', 'six', 'ten', 'add', 'run', 'fix', 'web', 'app']);

/** Spoken right after waking, before listening for the command. */
export function wakeAcknowledgement(phrase = ''): string {
  const roused = new RegExp(WAKE_VERB, 'iu').test(phrase);
  const hour = new Date().getHours();
  if (roused) return "I'm up. What do you need?";
  return hour < 12 ? 'Good morning. What do you need?' : hour >= 21 ? 'Still up? Go ahead.' : 'Yes? Go ahead.';
}

/** Experimental transient detector, operating only on real time-domain mic samples.
 * Two short peaks separated by quiet, 180–800ms apart. Not speaker identification.
 */
export class DoubleClapDetector {
  private noise = .015;
  private peakStarted: number | null = null;
  private previousClap: number | null = null;
  private cooldownUntil = 0;
  reset() { this.noise = .015; this.peakStarted = null; this.previousClap = null; this.cooldownUntil = 0; }
  sample(rms: number, peak: number, now: number): boolean {
    if (!Number.isFinite(rms) || !Number.isFinite(peak) || now < this.cooldownUntil) return false;
    const loud = peak > .4 && rms > Math.max(.075, this.noise * 4);
    if (loud) { this.peakStarted ??= now; return false; }
    if (this.peakStarted !== null) {
      const start = this.peakStarted; this.peakStarted = null;
      const duration = now - start;
      if (duration >= 8 && duration <= 120) {
        const gap = this.previousClap === null ? Infinity : start - this.previousClap;
        this.previousClap = start;
        if (gap >= 180 && gap <= 800) {
          this.previousClap = null; this.cooldownUntil = now + 1800; return true;
        }
      } else { this.previousClap = null; }
    }
    this.noise = this.noise * .96 + Math.min(rms, .12) * .04;
    return false;
  }
}

/**
 * Instant replies that need no model: being called by name, and a plain English
 * "hi"/"hello". Greetings in other languages go to the model, which answers in kind.
 */
export function localGreeting(text: string): string | null {
  const clean = text.trim().replace(/[!?.।,]+$/u, '').trim();
  const wake = parseWakePhrase(clean);
  if (wake.matched && !wake.remainder && new RegExp(WAKE_VERB, 'iu').test(clean)) return "I'm up. What do you need?";
  if (wake.matched && !wake.remainder) return "I'm listening. Go ahead.";
  if (/^(?:hi|hello|hey)$/iu.test(clean)) return "Hey! What's on your mind?";
  return null;
}

export type DeviceVoice = { name: string; lang: string; localService: boolean; default?: boolean };
/**
 * Voice pick order: exact requested local voice → best matching local voice
 * for the reply language → any local voice → requested name (even remote) →
 * first available voice → undefined (caller speaks with the OS default).
 * Never fails a reply because of voice/locale-name mismatches.
 */
export function selectDeviceVoice<T extends DeviceVoice>(voices: T[], name: string, text: string, language = 'auto'): T | undefined {
  const lang = /[\u0900-\u097f]/u.test(text) || language === 'hi' ? 'hi' : 'en';
  const local = voices.filter(v => v.localService);
  const exact = local.find(v => v.name === name && v.lang.toLowerCase().startsWith(lang));
  if (exact) return exact;
  const matching = local.filter(v => v.lang.toLowerCase().startsWith(lang)).sort((a,b) => score(b)-score(a));
  if (matching.length) return matching[0];
  if (local.length) return local.slice().sort((a,b) => score(b)-score(a))[0];
  const named = voices.find(v => v.name === name);
  if (named) return named;
  return voices[0];
}
function score(voice: DeviceVoice) {
  return (/natural|neural|premium|enhanced/i.test(voice.name) ? 10 : 0) + (voice.default ? 2 : 0) + (voice.lang.toLowerCase()==='en-in' ? 3 : 0);
}
