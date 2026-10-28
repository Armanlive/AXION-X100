import {requiresLocalInference} from '../utils/hybridMode.ts';
/**
 * "AXION, screen pe kya dikh raha hai?" / "camera se dekho haath mein kya hai".
 * A spoken or typed request grabs one screenshot or one camera frame, only at
 * that moment, and sends it to the vision model with the question. The first
 * time per source AXION asks before sending; "hamesha" remembers the answer.
 */
import type {VisualInput} from '../utils/visualInput';

export type VisualSource = 'screen' | 'camera';

// Whole words only (Devanagari vowel signs count as part of the word), so "screen reader" is not "read".
const word = (alts: string) => `(?<![\\p{L}\\p{M}])(?:${alts})(?![\\p{L}\\p{M}])`;
const SEE = word('dekh|dekho|dekhna|dekhiye|dekhte|dikh|dikhao|dikhai|dikhta|देख|देखो|देखिए|दिख|दिखाओ|दिखाई|दिखता|look|see|seeing|check|read|padho|पढ़ो|batao|bata|बताओ|बता|analy[sz]e|kya|क्या');
const ON = word('pe|par|per|on|mein|me|में|पर|पे');
const MY = word('my|meri|mera|the|मेरी|मेरा');
const SCREEN = word('screen|स्क्रीन');
const CAMERA_CUES = [
  /\b(?:camera|cam)\b.*\b(?:se|use|on|open|kholo|chalu|dekho|dekh|look|check|through)\b/iu,
  /कैमरा.*(?:से|यूज़|यूज|ऑन|खोलो|चालू|देखो|देख)/u,
  /\b(?:haath|hath)\s+(?:mein|me|main)\s+kya\b/iu, /हाथ\s+में\s+क्या/u,
  /\b(?:maine|mai?ne)\s+kya\s+(?:pehna|pahna|pehen)/iu, /मैंने\s+क्या\s+पहन/u,
  /\bwhat\s+am\s+i\s+(?:holding|wearing)\b/iu, /\b(?:look|see)\s+at\s+me\b/iu, /\bmujhe\s+dekho\b/iu, /मुझे\s+देखो/u,
];
const SCREEN_CUES = [
  new RegExp(`${SCREEN}\\s+${ON}.*${SEE}`, 'iu'),          // screen pe kya dikh raha hai
  new RegExp(`${SCREEN}\\s+(?:${word('ko|को')}\\s+)?${word('dekh|dekho|dekhna|dekhiye|padh|padho|padhna|देख|देखो|देखिए|पढ़|पढ़ो|see|read|check')}`, 'iu'), // kya tum screen dekh sakte ho / screen ko padho
  /\bcan\s+you\s+(?:see|read|look\s+at|check)\s+(?:my\s+|the\s+|this\s+)?screen\b/iu,
  new RegExp(`${SEE}.*${MY}\\s+${SCREEN}`, 'iu'),           // look at my screen / dekho meri screen
  new RegExp(`${MY}\\s+${SCREEN}.*${SEE}`, 'iu'),           // meri screen dekho
  new RegExp(`${word('screenshot|स्क्रीनशॉट')}.*${word('lo|le|lekar|leke|take|dekho|देखो|लो|लेकर')}`, 'iu'),
  /\bwhat(?:'s| is)\s+on\s+(?:my|the)\s+screen\b/iu,
  /\bwhat\s+am\s+i\s+(?:looking\s+at|using|doing|working\s+on)\b/iu,
  /\bwhich\s+(?:app|application|window|tab|site)\s+am\s+i\b/iu,
  /\b(?:main|mai)\s+(?:abhi\s+)?(?:kahan|kaha|kya\s+use\s+kar)\b/iu,
  /(?:\b(?:ye|yeh|is|iss|this)\s+error\b|(?:ये|इस)\s+एरर).*(?:dekho|dekh|look|check|fix|देखो|देख|ठीक)/iu,
];
/** Cameras win when both are mentioned ("camera se dekho, screen pe nahi"). */
export function detectVisualIntent(text: string): VisualSource | null {
  const t = text.trim();
  if (!t || t.length > 400) return null;
  if (CAMERA_CUES.some(p => p.test(t))) return 'camera';
  if (SCREEN_CUES.some(p => p.test(t))) return 'screen';
  return null;
}

const CONSENT_KEY = 'axion.visualConsent';
type ConsentStore = Partial<Record<VisualSource, 'always'>>;
const readConsent = (): ConsentStore => { try { return JSON.parse(globalThis.localStorage?.getItem(CONSENT_KEY) || '{}') || {}; } catch { return {}; } };
export const hasStandingConsent = (source: VisualSource) => readConsent()[source] === 'always';
export function revokeVisualConsent(source?: VisualSource) {
  try { const next = readConsent(); if (source) delete next[source]; else { delete next.screen; delete next.camera; } globalThis.localStorage?.setItem(CONSENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
}

export function parseConsentAnswer(text: string): 'once' | 'always' | 'no' | null {
  const t = text.toLowerCase().replace(/[.,!?।]+/gu, ' ').trim();
  if (!t || t.split(/\s+/).length > 6) return null;
  if (/\b(?:hamesha|always|har\s*baar|every\s*time)\b|हमेशा|हर\s*बार/u.test(t)) return 'always';
  if (/\b(?:nahi|nahin|no|mat|cancel|rehne|chhodo|stop)\b|नहीं|मत|रहने|छोड़ो/u.test(t)) return 'no';
  if (/\b(?:haan|han|ha|yes|yeah|ok|okay|sure|bhejo|kar\s*do|go|theek|thik)\b|हाँ|हां|ठीक|भेजो|कर\s*दो/u.test(t)) return 'once';
  return null;
}

/** One pending consent question; it expires so a late "haan" never sends anything. */
export class VisualConsentSession {
  private pending?: {source: VisualSource; prompt: string; at: number};
  private ttlMs: number; private now: () => number;
  constructor(ttlMs = 60000, now = () => Date.now()) { this.ttlMs = ttlMs; this.now = now; }
  ask(source: VisualSource, prompt: string) { this.pending = {source, prompt, at: this.now()}; }
  resolve(text: string): {source: VisualSource; prompt: string} | 'declined' | null {
    const pending = this.pending; this.pending = undefined;
    if (!pending || this.now() - pending.at > this.ttlMs) return null;
    const answer = parseConsentAnswer(text);
    if (answer === 'no') return 'declined';
    if (!answer) return null;
    if (answer === 'always') { try { const next = readConsent(); next[pending.source] = 'always'; globalThis.localStorage?.setItem(CONSENT_KEY, JSON.stringify(next)); } catch { /* session-only */ } }
    return {source: pending.source, prompt: pending.prompt};
  }
}
export const visualConsent = new VisualConsentSession();

export function consentQuestion(source: VisualSource) {
  const target=requiresLocalInference()?'a local Ollama vision model':'your configured vision provider';
  const text = source === 'screen'
    ? `Shall I take a screenshot and show it to ${target}? Say "yes", "always", or "no".`
    : `Shall I take one camera photo and show it to ${target}? Say "yes", "always", or "no".`;
  return {text, speechText: text};
}

const decodeTitle = (b64: string) => { try { return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))).trim(); } catch { return ''; } };

export async function captureScreen(): Promise<VisualInput> {
  const {invoke, isTauri} = await import('@tauri-apps/api/core');
  if (!isTauri()) {
    if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Screen sharing is unavailable in this runtime.');
    return frameFromMedia(await navigator.mediaDevices.getDisplayMedia({video:true,audio:false}),'One screenshot from the screen/window chosen by the user, captured at their request.');
  }
  const shot = await invoke<{titleBase64: string; jpegBase64: string}>('capture_screen');
  const title = decodeTitle(shot.titleBase64);
  return {
    mimeType: 'image/jpeg', data: shot.jpegBase64,
    note: `This is a screenshot of the user's primary screen, captured just now at their request.${title ? ` The window in front is titled: "${title.slice(0, 200)}".` : ''} Say which app or page they are in and what is on it. If an error is visible, quote it, explain the likely cause, and give the fix.`
  };
}

/** One requested frame; all acquired tracks are released on success and failure. */
export async function frameFromMedia(media:MediaStream,note:string):Promise<VisualInput>{
 let video:HTMLVideoElement|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=media;
  await Promise.race([video.play(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Video did not become ready.')),5000);})]);
  if(!video.videoWidth||!video.videoHeight)throw Error('No camera or screen pixels are available yet. Try again.');
  const scale=Math.min(1,1280/video.videoWidth,720/video.videoHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
  const context=canvas.getContext('2d');if(!context)throw Error('Image capture is unavailable.');
  context.drawImage(video,0,0,canvas.width,canvas.height);
  return {mimeType:'image/jpeg',data:canvas.toDataURL('image/jpeg',.82).split(',')[1],note};
 }finally{clearTimeout(timer);if(video){video.pause();video.srcObject=null;}media.getTracks().forEach(track=>track.stop());}
}
export async function captureCameraFrame():Promise<VisualInput>{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('No camera API in this runtime');
 return frameFromMedia(await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false}),"One photo from the user's webcam, captured just now at their request.");
}
