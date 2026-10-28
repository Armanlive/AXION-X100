import {unzipSync, strFromU8} from 'fflate';

export function githubRepository(input:string):{owner:string;repo:string;url:string} {
 const value=input.trim().replace(/\.git$/,'').replace(/\/$/,'');
 const match=/^(?:https:\/\/github\.com\/)?([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
 if(!match || match[2]==='.' || match[2]==='..')throw Error('Enter a GitHub HTTPS repository URL or owner/repository.');
 return {owner:match[1],repo:match[2],url:`https://github.com/${match[1]}/${match[2]}`};
}
export function githubSources(bytes:Uint8Array):Record<string,string>{
 let total=0;
 const entries=unzipSync(bytes,{filter:entry=>{
   total+=entry.originalSize;
   if(total>50_000_000 || entry.originalSize>5_000_000)throw Error('Repository exceeds the 50 MB import limit. Open a local clone instead.');
   return !entry.name.endsWith('/');
 }});
 const files:Record<string,string>=Object.create(null);
 for(const [name,data] of Object.entries(entries)){
  const parts=name.split('/').slice(1);
  if(!parts.length || parts.some(p=>!p || p==='.' || p==='..' || p.includes('\\')))throw Error('Unsafe repository archive path.');
  if(parts.some(p=>['.git','node_modules','target','dist'].includes(p) || /^\.env(?:\.|$)/i.test(p)))continue;
  if(data.includes(0))continue;
  files[parts.join('/')]=strFromU8(data);
 }
 if(!Object.keys(files).length)throw Error('No text source files found.');
 return files;
}
export async function importGithubProject(input:string,progress:(message:string)=>void){
 const repository=githubRepository(input);
 progress('📂 Loading public GitHub repository tree…');
 const response=await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repo}/git/trees/HEAD?recursive=1`,{signal:AbortSignal.timeout(30000),credentials:'omit'});
 if(!response.ok)throw Error(`GitHub import failed (${response.status}). Check access or rate limits; private projects require a local clone.`);
 const tree=await response.json();
 if(tree.truncated || !Array.isArray(tree.tree) || !/^[a-f0-9]{40,64}$/.test(tree.sha))throw Error('Incomplete repository tree. Open a local clone instead.');
 const sources=tree.tree.filter((entry:any)=>entry.type==='blob' && entry.mode!=='120000' && typeof entry.path==='string' && !entry.path.split('/').some((part:string)=>['.git','node_modules','dist','target'].includes(part)||/^\.env(?:\.|$)/i.test(part)));
 if(sources.length>1000 || sources.reduce((sum:number,e:any)=>sum+(e.size||0),0)>25_000_000)throw Error('Repository exceeds source import limits. Open a local clone instead.');
 const files:Record<string,string>=Object.create(null);
 for(let at=0;at<sources.length;at+=4){
  progress(`🔍 Loading source files ${at+1}–${Math.min(at+4,sources.length)} of ${sources.length}…`);
  await Promise.all(sources.slice(at,at+4).map(async(entry:any)=>{
   const parts=entry.path.split('/');
   if(parts.some((p:string)=>!p||p==='.'||p==='..'||p.includes('\\')))throw Error('Unsafe repository path.');
   const url=`https://raw.githubusercontent.com/${repository.owner}/${repository.repo}/${tree.sha}/${parts.map(encodeURIComponent).join('/')}`;
   const source=await fetch(url,{signal:AbortSignal.timeout(30000),credentials:'omit'});
   if(!source.ok)throw Error(`Could not load ${entry.path}. Import stopped without changing your project.`);
   const bytes=new Uint8Array(await source.arrayBuffer());
   if(bytes.length>5_000_000)throw Error('File exceeds source import limit.');
   if(!bytes.includes(0))files[entry.path]=strFromU8(bytes);
  }));
 }
 if(!Object.keys(files).length)throw Error('No text source files found.');
 return {...repository,files};
}
