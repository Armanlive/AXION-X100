import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {encryptProfile,decryptProfile,validateProfile,type UserProfile} from '../utils/profileVault.ts';
import {useProfileStore,profileContext} from '../store/useProfileStore.ts';
const sample:UserProfile={version:1,role:'Automobile engineer',projects:'Dealer data sync',help:'Debugging',style:'Concise Hinglish',shareWithAI:false};
describe('Encrypted personal profile',()=>{
 it('round-trips without plaintext fields and randomizes every encryption',async()=>{
  const a=await encryptProfile(sample,'fixture-passphrase-123');const b=await encryptProfile(sample,'fixture-passphrase-123');
  assert.notEqual(a,b);assert.ok(!a.includes(sample.role));assert.deepEqual(await decryptProfile(a,'fixture-passphrase-123'),sample);
 });
 it('rejects wrong passphrase, tampered ciphertext and unsupported schema',async()=>{
  const cipher=await encryptProfile(sample,'fixture-passphrase-123');await assert.rejects(decryptProfile(cipher,'wrong password'));
  const bad=JSON.parse(cipher);bad.data=(bad.data[0]==='A'?'B':'A')+bad.data.slice(1);await assert.rejects(decryptProfile(JSON.stringify(bad),'fixture-passphrase-123'));
  await assert.rejects(decryptProfile('{"version":2}','fixture-passphrase-123'));assert.throws(()=>validateProfile({...sample,role:42}));
 });
 it('refuses short passphrases',async()=>{await assert.rejects(encryptProfile(sample,'short'));});
 it('keeps the spoken name encrypted, and older profiles without a name still open',async()=>{
  const named={...sample,name:'Arman'};const cipher=await encryptProfile(named,'fixture-passphrase-123');
  assert.ok(!cipher.includes('Arman'));assert.deepEqual(await decryptProfile(cipher,'fixture-passphrase-123'),named);
  assert.deepEqual(validateProfile(sample),sample);assert.throws(()=>validateProfile({...sample,name:'x'.repeat(101)}));
 });
});
describe('Private onboarding state',()=>{
 it('asks one question at a time, keeps drafts out of storage and requires sharing opt-in',()=>{
  const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
  const p=useProfileStore.getState();p.initialize();assert.equal(useProfileStore.getState().open,false,'new users meet AXION after a brain is connected, not at startup');p.show();assert.equal(useProfileStore.getState().open,true);
  p.answer('Automobile engineer');assert.equal(useProfileStore.getState().stage,1);
  p.answer('Dealer sync');p.answer('skip');p.answer('Concise');assert.equal(useProfileStore.getState().stage,4);assert.equal(values.size,0);
  p.useSession();assert.equal(profileContext(),'');p.edit();p.answer('Dev');p.answer('App');p.answer('Debugging');p.answer('Technical');p.setSharing(true);p.useSession();assert.ok(profileContext().includes('Technical'));p.lock();assert.equal(profileContext(),'');
 });
 it('spoken Meet AXION answers land on the review step with the name, nothing stored yet',()=>{
  const p=useProfileStore.getState();p.edit();
  p.applyInterview({name:'Arman',role:'MIS manager',projects:'',help:'coding',style:'short'});
  const s=useProfileStore.getState();assert.equal(s.stage,4);assert.equal(s.open,true);
  assert.deepEqual([s.draft.name,s.draft.role,s.draft.help],['Arman','MIS manager','coding']);assert.equal(s.profile,null);
 });
 it('wake resumes paused interview without counting the wake phrase as an answer',()=>{
  const p=useProfileStore.getState();p.edit();p.pause();p.answer('Hello AXION');assert.equal(useProfileStore.getState().open,true);assert.equal(useProfileStore.getState().stage,0);
 });
});
