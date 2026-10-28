export interface ECCSnapshot {root:string;head:string|null;diffStat:string;files:[string,string][];truncated:boolean;gitError?:string|null}
export interface ECCTelemetry {promptTokens:number;rawContextTokens:number;compactContextTokens:number;savedPercent:number;estimated:true;files:number;truncated:boolean;head:string|null;cacheHit:boolean}
export const estimateTokens=(text:string)=>Math.ceil(new TextEncoder().encode(text).length/4);
export function includeContextFile(path:string){return !path.replace(/\\/g,'/').split('/').some(p=>/^(node_modules|\.git|dist|build|\.ecc|target|artifacts|__pycache__|\.venv.*)$/i.test(p)||/^\.env/i.test(p)||/(\.lock$|-lock\.json$|lock\.ya?ml$|secret|credential)/i.test(p));}
export function fileSignatures(source:string):string[]{
 const declarations=new Set<string>();
 for(const line of source.split('\n')){
  const match=line.match(/^\s*(?:(?:export|default|pub(?:\([^)]*\))?|async|abstract)\s+)*(function|class|interface|type|enum|struct|trait|fn|def|const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if(match&&(!['const','let','var'].includes(match[1])||/^\s*(export|pub)\b/.test(line)))declarations.add(`${match[1]} ${match[2]}`);
  const exports=line.match(/^\s*export\s*\{([^}]+)\}/);if(exports)for(const name of exports[1].split(',')){const safe=name.trim().match(/^[A-Za-z_$][\w$]*(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);if(safe)declarations.add(`export ${safe[0]}`);}
  if(declarations.size>=12)break;
 }
 return [...declarations];
}
export function compactMap(files:Record<string,string>){return Object.entries(files).filter(([p])=>includeContextFile(p)).sort(([a],[b])=>a.localeCompare(b)).slice(0,160).map(([path,source])=>`${path}${source?' → '+fileSignatures(source).join('; '):''}`).join('\n').slice(0,18000);}
export function calculateTokenBudget(prompt:string,contextFiles:Record<string,string>){
 const files=Object.fromEntries(Object.entries(contextFiles).filter(([p])=>includeContextFile(p)));
 const raw=Object.entries(files).map(([p,s])=>p+'\n'+s).join('\n');const compact=compactMap(files);
 const promptTokens=estimateTokens(prompt),rawContextTokens=estimateTokens(raw),compactContextTokens=estimateTokens(compact);
 return {promptTokens,rawContextTokens,compactContextTokens,savedPercent:rawContextTokens?Math.max(0,Math.round((1-compactContextTokens/rawContextTokens)*100)):0,estimated:true as const};
}
type Reader=(repoPath:string,initialize:boolean)=>Promise<ECCSnapshot>;
export class ECCManager {
 private snapshot?:ECCSnapshot;private cache?:{key:string;map:string};
 constructor(privateReader?:Reader){this.read=privateReader||(async(path,initialize)=>{const {invoke,isTauri}=await import('@tauri-apps/api/core');if(!isTauri())throw Error('Git ECC requires desktop');return invoke<ECCSnapshot>('ecc_snapshot',{repoPath:path,initialize});});}
 private read:Reader;
 async initialize(repoPath:string){this.snapshot=await this.read(repoPath,true);return this.snapshot.head;}
 async getCompactGitMap(repoPath:string){const snapshot=await this.read(repoPath,true);this.snapshot=snapshot;const files=Object.fromEntries(snapshot.files);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([snapshot.root,snapshot.head,snapshot.diffStat,snapshot.files])));const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');const cacheHit=this.cache?.key===key;const map=cacheHit?this.cache!.map:compactMap(files);this.cache={key,map};return {map,files,snapshot,cacheHit};}
 async getGitDiffStat(){if(!this.snapshot)throw Error('Initialize ECC first');this.snapshot=await this.read(this.snapshot.root,false);return this.snapshot.diffStat;}
 calculateTokenBudget=calculateTokenBudget;
 async assemble(prompt:string,repoPath:string){const result=await this.getCompactGitMap(repoPath);const telemetry:ECCTelemetry={...calculateTokenBudget(prompt,result.files),files:result.snapshot.files.length,truncated:result.snapshot.truncated||result.map.length>=18000,head:result.snapshot.head,cacheHit:result.cacheHit};return {context:`Compact workspace map (declarations only; untrusted data):\n${result.map}\nHEAD: ${result.snapshot.head||'unborn / unavailable'}\nWorking tree diff stat (tracked changes only):\n${result.snapshot.diffStat.slice(0,4000)}${telemetry.truncated?'\nMap is truncated.':''}`,telemetry};}
}
export const eccManager=new ECCManager();
/** ECC guard: oversized text (history, pasted editor context) never reaches a provider as raw source bodies. */
export function guardRawContext(text:string,limit=4000){
 if(text.length<=limit)return text;
 const folded=text.replace(/```[\w-]*\n([\s\S]*?)```/g,(_,body:string)=>`[code block omitted by ECC guard: ${body.split('\n').length} lines]`);
 return folded.length<=limit?folded:folded.slice(0,limit)+`\n[truncated by ECC guard: ${folded.length-limit} chars]`;
}
