/**
 * Desktop / browser app intent. Apps available both as a website and a desktop
 * client are never launched on a guess: an unqualified "open WhatsApp" asks the user
 * which surface he wants, and only the answer executes. Launch URLs live in the
 * native allowlist (src-tauri/src/apps.rs); the renderer only sends app ids.
 */
export type LaunchTarget = 'web' | 'desktop';
export interface LaunchableApp { id: string; name: string; aliases: string[]; desktopOnly?: boolean }
export const LAUNCHABLE_APPS: LaunchableApp[] = [
  {id:'chrome',name:'Chrome',aliases:['google chrome','chrome','क्रोम','गूगल क्रोम'],desktopOnly:true},
  {id:'edge',name:'Edge',aliases:['microsoft edge','edge','एज'],desktopOnly:true},
  {id:'whatsapp',name:'WhatsApp',aliases:['whatsapp','whats app','व्हाट्सएप','व्हाट्सऐप']},
  {id:'spotify',name:'Spotify',aliases:['spotify','स्पॉटिफाई']},
  {id:'slack',name:'Slack',aliases:['slack']},
  {id:'discord',name:'Discord',aliases:['discord']},
  {id:'telegram',name:'Telegram',aliases:['telegram','टेलीग्राम']},
  {id:'teams',name:'Microsoft Teams',aliases:['microsoft teams','ms teams','teams']},
  {id:'notion',name:'Notion',aliases:['notion']},
  {id:'zoom',name:'Zoom',aliases:['zoom']}
];
export interface AppIntent { app: LaunchableApp; target: LaunchTarget | null }

const VERBS = new Set(['open','launch','start','run','kholo','khol','kholna','chalao','chala','chalu','khol','खोलो','खोल','चलाओ','ओपन','लॉन्च','स्टार्ट','चालू']);
const WEB = new Set(['web','browser','website','site','online','chrome','edge','ब्राउज़र','वेब']);
const DESKTOP = new Set(['app','desktop','application','native','installed','client','ऐप','डेस्कटॉप']);
const FILLER = new Set(['please','pls','bhai','axion','sir','boss','the','my','in','on','into','karo','kar','do','de','dena','zara','jara','ek','baar','me','mein','par','wala','vala','करो','कर','दो','में','ज़रा','जरा','भाई','सर','प्लीज़','एक्सॉन','एक्सियन']);

const words = (text: string) => text.toLowerCase().replace(/[.,!?।"'“”]+/gu, ' ').split(/\s+/u).filter(Boolean);

/** Whole-utterance match only, so "how do I open WhatsApp chats from code?" stays a conversation. */
export function detectAppIntent(text: string): AppIntent | null {
  let clean = ` ${words(text).join(' ')} `;
  let app: LaunchableApp | undefined;
  for (const candidate of LAUNCHABLE_APPS) for (const alias of [...candidate.aliases].sort((a,b)=>b.length-a.length)) {
    if (!clean.includes(` ${alias} `)) continue;
    if (app && app.id !== candidate.id) return null;
    app = candidate; clean = clean.replace(` ${alias} `, ' ');
  }
  if (!app) return null;
  let verb = false, web = false, desktop = false;
  for (const word of words(clean)) {
    if (VERBS.has(word)) verb = true;
    else if (WEB.has(word)) web = true;
    else if (DESKTOP.has(word)) desktop = true;
    else if (!FILLER.has(word)) return null;
  }
  if (!verb) return null;
  if (app.desktopOnly) return {app, target: 'desktop'};
  return {app, target: web === desktop ? null : web ? 'web' : 'desktop'};
}

/**
 * In-browser commands after "Chrome kholo": open an allowlisted site or run a
 * Google / YouTube search. Sites and URLs are fixed natively (apps.rs).
 */
export type BrowserTarget = 'google' | 'youtube' | 'gmail' | 'github' | 'maps' | 'drive' | 'translate' | 'news' | 'search' | 'youtube_search';
export interface BrowserCommand { target: BrowserTarget; query?: string; browser?: 'chrome' | 'edge' }
const SITES: [BrowserTarget, string, string[]][] = [
  ['youtube','YouTube',['youtube','you tube','यूट्यूब']],
  ['gmail','Gmail',['gmail','g mail','जीमेल','mail']],
  ['github','GitHub',['github','git hub','गिटहब']],
  ['maps','Google Maps',['google maps','maps','मैप्स','मैप']],
  ['drive','Google Drive',['google drive','drive','ड्राइव']],
  ['translate','Google Translate',['google translate','translate','ट्रांसलेट']],
  ['news','Google News',['google news','news','न्यूज़']],
  ['google','Google',['google','गूगल']]
];
export const siteName = (target: BrowserTarget) => SITES.find(([id]) => id === target)?.[1] || target;
const ON = '(?:pe|par|per|mein|me|on|in|पे|पर|में)';
const DO = '(?:\\s+(?:karo|kar do|kar|karna|करो|कर दो|कर))?';
const SEARCH_PATTERNS: [RegExp, BrowserTarget][] = [
  [new RegExp(`^(?:youtube|यूट्यूब)\\s+${ON}\\s+(.+?)\\s+(?:chalao|lagao|bajao|play|search|dhundo|dhoondo|चलाओ|लगाओ|बजाओ|सर्च|ढूंढो)${DO}$`,'u'),'youtube_search'],
  [/^play\s+(.+?)\s+on\s+youtube$/u,'youtube_search'],
  [new RegExp(`^(?:google\\s+${ON}\\s+|गूगल\\s+${ON}\\s+)?(.+?)\\s+(?:search|dhundo|dhoondo|सर्च|ढूंढो|खोजो)${DO}$`,'u'),'search'],
  [/^(?:search(?:\s+for)?|google)\s+(.+)$/u,'search']
];

const BROWSER_SCOPE = /\b(?:chrome|edge|browser)\s+(?:mein|me|में|pe|par|पे)\b|\bin\s+(?:chrome|edge|the browser)\b|(?:क्रोम|एज|ब्राउज़र)\s+(?:में|पे|पर)/giu;
/** Whole-utterance match; anything else stays a conversation. */
export function detectBrowserCommand(text: string): BrowserCommand | null {
  const raw = words(text).join(' ');
  const browser = /\b(?:edge)\b|एज/u.test(raw) ? 'edge' : /\bchrome\b|क्रोम/u.test(raw) ? 'chrome' : undefined;
  const clean = raw.replace(BROWSER_SCOPE, ' ').replace(/^(?:(?:please|bhai|axion|sir|zara|एक्सॉन|भाई|सर|ज़रा)\s+)+/u, '').replace(/\s+/g, ' ').trim();
  for (const [pattern, target] of SEARCH_PATTERNS) {
    const query = clean.match(pattern)?.[1]?.trim();
    // "google kholo" is a site request, not a search for "kholo".
    const onlyCommandWords = !!query && words(query).every(w => VERBS.has(w) || FILLER.has(w) || WEB.has(w));
    if (query && query.length <= 300 && !onlyCommandWords) return {target, query, browser};
  }
  let rest = ` ${clean} `; let site: BrowserTarget | undefined;
  for (const [id, , aliases] of SITES) for (const alias of [...aliases].sort((a,b)=>b.length-a.length)) {
    if (!site && rest.includes(` ${alias} `)) { site = id; rest = rest.replace(` ${alias} `, ' '); }
  }
  if (!site) return null;
  let verb = false;
  for (const word of words(rest)) {
    if (VERBS.has(word)) verb = true;
    else if (!FILLER.has(word) && !WEB.has(word)) return null;
  }
  return verb ? {target: site, browser} : null;
}

/** Remembers the browser the user last opened, so "YouTube kholo" lands in Chrome after "Chrome kholo". */
let lastBrowser: 'chrome' | 'edge' | undefined;
export const rememberBrowser = (appId: string) => { if (appId === 'chrome' || appId === 'edge') lastBrowser = appId; };
export const preferredBrowser = (command: BrowserCommand) => command.browser ?? lastBrowser;

export async function openInBrowser(command: BrowserCommand): Promise<void> {
  const {invoke, isTauri} = await import('@tauri-apps/api/core');
  if (!isTauri()) throw new Error('Browser control requires the AXION desktop app');
  await invoke('browser_open', {target: command.target, query: command.query ?? null, browser: preferredBrowser(command) ?? null});
}
export function browserConfirmation(command: BrowserCommand): ClarificationReply {
  const where = preferredBrowser(command) === 'edge' ? 'Edge' : preferredBrowser(command) === 'chrome' ? 'Chrome' : 'your browser';
  const text = command.target === 'search'
    ? `Searching Google for "${command.query}".`
    : command.target === 'youtube_search'
    ? `Pulling up "${command.query}" on YouTube.`
    : `Opening ${siteName(command.target)} in ${where}.`;
  return {text, speechText: text};
}

/** Interprets the user's answer to the clarification; null means it was not an answer. */
export function parseClarificationAnswer(text: string): LaunchTarget | 'cancel' | null {
  const said = words(text);
  if (!said.length || said.length > 8) return null;
  if (said.some(w => ['cancel','nahi','nah','no','rehne','chhodo','leave','skip','mat','रहने','नहीं'].includes(w))) return 'cancel';
  const web = said.some(w => WEB.has(w) || ['first','pehla','pehle','1'].includes(w));
  const desktop = said.some(w => DESKTOP.has(w) || ['second','doosra','dusra','2'].includes(w));
  return web === desktop ? null : web ? 'web' : 'desktop';
}

export interface ClarificationReply { text: string; speechText: string }
export function clarificationQuestion(app: LaunchableApp): ClarificationReply {
  const web = app.id === 'whatsapp' || app.id === 'telegram' ? `${app.name} Web` : `${app.name}'s web version`;
  const text = `Should I open ${web} in the browser, or launch the desktop app?`;
  return {text, speechText: text.replace(', or', '... or')};
}
export function launchConfirmation(app: LaunchableApp, target: LaunchTarget): ClarificationReply {
  const surface = target === 'web' ? 'in your browser' : 'on the desktop';
  const text = app.desktopOnly ? `Opening ${app.name}. What should I pull up?` : `On it. ${app.name} is opening ${surface}.`;
  return {text, speechText: text};
}
export function launchFailure(app: LaunchableApp, target: LaunchTarget): ClarificationReply {
  const text = target === 'desktop'
    ? `I couldn't bring up the ${app.name} desktop app. It may not be installed. Want me to try the browser instead?`
    : `The browser didn't respond just now. Mind checking your default browser?`;
  return {text, speechText: text};
}

/** One pending question at a time; it expires so a stale "browser" never fires later. */
export class ClarificationSession {
  private pending?: {app: LaunchableApp; at: number};
  private ttlMs: number; private now: () => number;
  constructor(ttlMs = 120000, now = () => Date.now()) { this.ttlMs = ttlMs; this.now = now; }
  ask(app: LaunchableApp) { this.pending = {app, at: this.now()}; }
  /** Returns the resolved launch, 'cancelled', or null when the text is a fresh request. */
  resolve(text: string): {app: LaunchableApp; target: LaunchTarget} | 'cancelled' | null {
    const pending = this.pending; this.pending = undefined;
    if (!pending || this.now() - pending.at > this.ttlMs) return null;
    const answer = parseClarificationAnswer(text);
    if (answer === 'cancel') return 'cancelled';
    return answer ? {app: pending.app, target: answer} : null;
  }
}
export const appClarifications = new ClarificationSession();

/**
 * "Open my Downloads folder", "Downloads folder kholo", "open the project folder".
 * Only fixed folder names reach the desktop app (apps.rs resolves the paths).
 */
export type FolderTarget = 'desktop' | 'downloads' | 'documents' | 'pictures' | 'music' | 'videos' | 'home' | 'project';
const FOLDERS: [FolderTarget, string, string[]][] = [
  ['downloads','Downloads',['downloads','download','डाउनलोड','डाउनलोड्स']],
  ['documents','Documents',['documents','document','docs','डॉक्यूमेंट','डॉक्यूमेंट्स']],
  ['pictures','Pictures',['pictures','photos','images','पिक्चर्स','फोटो','फोटोज़']],
  ['music','Music',['music','songs','म्यूजिक','म्यूज़िक']],
  ['videos','Videos',['videos','video','वीडियो','वीडियोज़']],
  ['project','project',['project','projects','workspace','repo','प्रोजेक्ट','प्रोजेक्ट्स']],
  ['home','home',['file explorer','explorer','this pc','my computer','फाइल एक्सप्लोरर','एक्सप्लोरर']],
  ['desktop','Desktop',['desktop','डेस्कटॉप']]
];
const FOLDER_WORDS = new Set(['folder','folders','directory','dir','फ़ोल्डर','फोल्डर','ka','ki','ke','wala','wali','ye','yeh','is','this','का','की','के','ये','इस','वाला','वाली','pe','per','से','se']);
export const folderName = (target: FolderTarget) => FOLDERS.find(([id]) => id === target)?.[1] || target;
/** Whole-utterance match; "desktop" only counts as the folder when nothing else is named. */
export function detectFolderCommand(text: string): FolderTarget | null {
  let rest = ` ${words(text).join(' ')} `;
  const found: FolderTarget[] = [];
  for (const [id, , aliases] of FOLDERS) for (const alias of [...aliases].sort((a,b)=>b.length-a.length)) {
    if (!rest.includes(` ${alias} `)) continue;
    if (!found.includes(id)) found.push(id);
    rest = rest.split(` ${alias} `).join(' ');
  }
  const named = found.filter(id => id !== 'desktop');
  if (named.length > 1 || (!named.length && !found.length)) return null;
  const target = named[0] ?? 'desktop';
  let verb = false, folderWord = false;
  for (const word of words(rest)) {
    if (VERBS.has(word)) verb = true;
    else if (FOLDER_WORDS.has(word)) folderWord = true;
    else if (!FILLER.has(word) && !DESKTOP.has(word)) return null;
  }
  // "project kholo" alone may mean the app's project view; require "folder" for it.
  if (target === 'project' && !folderWord) return null;
  return verb ? target : null;
}
export async function openFolder(target: FolderTarget): Promise<void> {
  const {invoke, isTauri} = await import('@tauri-apps/api/core');
  if (!isTauri()) throw new Error('Opening folders requires the AXION desktop app');
  await invoke('open_folder', {target});
}
export function folderConfirmation(target: FolderTarget): ClarificationReply {
  const text = target === 'home' ? 'Opening File Explorer.'
    : target === 'project' ? 'Opening the project folder.'
    : `Opening your ${folderName(target)} folder.`;
  return {text, speechText: text};
}
export function folderFailure(target: FolderTarget, reason: string): ClarificationReply {
  return {text: `I couldn't open the ${target === 'project' ? 'project' : folderName(target)} folder: ${reason}`, speechText: "I couldn't open that folder."};
}

export async function launchApp(appId: string, target: LaunchTarget): Promise<void> {
  const {invoke, isTauri} = await import('@tauri-apps/api/core');
  if (!isTauri()) throw new Error('App launching requires the AXION desktop app');
  await invoke('launch_app', {app: appId, target});
}
