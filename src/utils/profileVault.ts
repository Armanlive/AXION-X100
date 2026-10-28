export interface UserProfile {version:1; role:string; projects:string; help:string; style:string; shareWithAI:boolean}
export const PROFILE_KEY='axion.profile.encrypted.v1';
const encoder=new TextEncoder();const aad=encoder.encode('AXION profile vault v1');
function base64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes));}
function bytes(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export function validateProfile(value:unknown):UserProfile {
 const p=value as UserProfile;
 if(!p||p.version!==1||typeof p.shareWithAI!=='boolean'||['role','projects','help','style'].some(k=>typeof p[k as keyof UserProfile]!=='string'||String(p[k as keyof UserProfile]).length>1200))throw Error('Invalid profile');
 return {version:1,role:p.role,projects:p.projects,help:p.help,style:p.style,shareWithAI:p.shareWithAI};
}
async function keyFor(passphrase:string,salt:Uint8Array<ArrayBuffer>){
 if(!crypto.subtle)throw Error('Encrypted storage requires a secure browser context.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptProfile(profile:UserProfile,passphrase:string):Promise<string>{
 if(passphrase.length<12)throw Error('Use a passphrase of at least 12 characters.');
 const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await keyFor(passphrase,salt);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(validateProfile(profile))));
 return JSON.stringify({version:1,salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(encrypted))});
}
export async function decryptProfile(envelope:string,passphrase:string):Promise<UserProfile>{
 try{
  if(envelope.length>20000)throw Error();const e=JSON.parse(envelope);
  if(e.version!==1||typeof e.salt!=='string'||typeof e.iv!=='string'||typeof e.data!=='string')throw Error();
  const salt=bytes(e.salt),iv=bytes(e.iv);if(salt.length!==16||iv.length!==12)throw Error();
  const key=await keyFor(passphrase,salt);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,bytes(e.data));
  return validateProfile(JSON.parse(new TextDecoder().decode(clear)));
 }catch{throw Error('Could not unlock the profile. Check your passphrase; the saved data may also be damaged.');}
}
