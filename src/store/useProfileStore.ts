import {create} from 'zustand';
import {decryptProfile,encryptProfile,PROFILE_KEY,type UserProfile} from '../utils/profileVault.ts';
import {syncProfile,clearPendingProfileSync} from '../services/memorySync.ts';
const empty=():UserProfile=>({version:1,role:'',projects:'',help:'',style:'',shareWithAI:false});
export const questions=[
 "I'm AXION, your engineering partner. I'd like to learn how you work so I can be more useful. What industry or role do you work in? You can skip any question.",
 'Thanks. What are you building or working on right now?',
 'Where would you like the most help—coding, debugging, architecture, data sync, or something else?',
 'How should I respond: concise or detailed, technical or conversational? Tell me what works for you.',
 'Thanks—that gives me a useful starting point. Review your answers below. You can edit them, use them for this session, or save an encrypted profile.'
];
const fields=['role','projects','help','style'] as const;
interface ProfileState {
 initialized:boolean;open:boolean;stage:number;speechMessage:string;profile:UserProfile|null;draft:UserProfile;locked:boolean;busy:boolean;error:string;message:string;saved:boolean;
 initialize:()=>void;show:()=>void;pause:()=>void;answer:(text:string)=>string|null;
 save:(passphrase:string)=>Promise<void>;unlock:(passphrase:string)=>Promise<void>;useSession:()=>void;lock:()=>void;forget:()=>void;edit:()=>void;setSharing:(value:boolean)=>void;
}
let generation=0;
export const useProfileStore=create<ProfileState>((set,get)=>({
 initialized:false,open:false,stage:0,speechMessage:questions[0],profile:null,draft:empty(),locked:false,busy:false,error:'',message:questions[0],saved:false,
 initialize:()=>{if(get().initialized)return;try{const saved=!!localStorage.getItem(PROFILE_KEY);const skipped=localStorage.getItem('axion.profile.skip')==='1';set({initialized:true,saved,locked:saved,open:!skipped,message:saved?'Welcome back. Unlock your local profile to restore your preferences.':questions[0]});}catch{set({initialized:true,open:true,error:'Local storage is unavailable. You can still use a session-only profile.'});}},
 show:()=>{get().initialize();set({open:true});},
 pause:()=>{set({open:false});try{localStorage.setItem('axion.profile.skip','1');}catch{}},
 answer:(text)=>{
  get().initialize();const s=get();
  const wake=/^(?:hello axion|hi axion|हेलो एक्सॉन|हेलो एक्सन)[.!?।]*$/iu.test(text.trim());
  if(wake&&!s.profile&&!s.locked){const index=Math.min(s.stage,4);set({open:true,message:questions[index],speechMessage:questions[index]});return get().message;}
  if(!s.open)return null;
  if(s.profile)return null;
  if(/^(?:stop|cancel|later|pause|बाद में)$/iu.test(text.trim())){s.pause();return 'No problem. We can get to know your workflow later.';}
  if(s.busy)return 'Please wait while your profile is processed.';
  if(s.locked)return 'Use the private passphrase field to unlock, or close this panel to continue without your profile.';
  if(s.stage>3)return s.message;
  if(text.trim().length>1200){set({error:'Please keep this answer under 1,200 characters.'});return 'Please keep this answer under 1,200 characters.';}
  const draft={...s.draft,[fields[s.stage]]:/^(?:skip|छोड़ो)$/iu.test(text.trim())?'':text.trim()};
  const next=s.stage+1;set({draft,stage:next,message:questions[next],speechMessage:questions[next],error:''});return get().message;
 },
 save:async(passphrase)=>{if(get().busy)return;const token=++generation;set({busy:true,error:''});try{const profile={...get().draft};const cipher=await encryptProfile(profile,passphrase);if(token!==generation)return;localStorage.setItem(PROFILE_KEY,cipher);localStorage.removeItem('axion.profile.skip');set({profile,saved:true,locked:false,message:'Your encrypted profile is saved on this device. I will use it while unlocked.'});if(profile.shareWithAI){syncProfile({display_name:null,role:profile.role,projects:profile.projects,help:profile.help,style:profile.style,share_with_ai:true});}}catch(e){if(token===generation)set({error:e instanceof Error?e.message:'Profile could not be saved.'});}finally{if(token===generation)set({busy:false});}},
 unlock:async(passphrase)=>{if(get().busy)return;const token=++generation;set({busy:true,error:''});try{const profile=await decryptProfile(localStorage.getItem(PROFILE_KEY)||'',passphrase);if(token!==generation)return;set({profile,draft:profile,locked:false,stage:4,message:'Welcome back. Your preferences are ready for this session.'});}catch(e){if(token===generation)set({error:e instanceof Error?e.message:'Unlock failed.'});}finally{if(token===generation)set({busy:false});}},
 useSession:()=>{set({profile:{...get().draft},message:'Your preferences are active for this session only.'});},
 lock:()=>{generation++;clearPendingProfileSync();set({profile:null,draft:empty(),speechMessage:questions[0],locked:get().saved,busy:false,stage:0,error:'',message:get().saved?'Unlock your encrypted profile to continue.':questions[0]});},
 forget:()=>{clearPendingProfileSync();try{localStorage.removeItem(PROFILE_KEY);localStorage.removeItem('axion.profile.skip');generation++;set({profile:null,draft:empty(),speechMessage:questions[0],locked:false,saved:false,busy:false,stage:0,error:'',message:questions[0]});}catch{set({error:'Could not delete the saved profile. Local storage is unavailable.'});}},
 edit:()=>{generation++;set({profile:null,draft:empty(),speechMessage:questions[0],stage:0,open:true,busy:false,message:questions[0],error:''});},
 setSharing:(shareWithAI)=>set({draft:{...get().draft,shareWithAI}})
}));
/** Profile text is untrusted preference data, never tool authority. */
export function profileContext():string{
 const profile=useProfileStore.getState().profile;
 return profile?.shareWithAI?JSON.stringify(profile):'';
}
