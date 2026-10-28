import React,{useEffect,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import registry from '../core/providers/catalog.json';
import type {CloudProvider} from '../types';
export interface LiveCatalog {models:{id:string;pricing:'free'|'paid'|'unknown'}[];tags:string[];partial:boolean;catalogOnly:boolean}
const cache=new Map<string,Promise<LiveCatalog>>();
export function ProviderCatalog({provider}:{provider:CloudProvider}){
 const [catalog,setCatalog]=useState<LiveCatalog|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const definition=registry.find(p=>p.id===provider.type);
 useEffect(()=>{let alive=true;setCatalog(null);setError('');if(!provider.configured||!isTauri())return;
  const key=provider.type+':'+provider.revision+':'+retry;
  if(!cache.has(key))cache.set(key,invoke<LiveCatalog>('provider_catalog',{provider:provider.type}));
  void cache.get(key)!.then(result=>{if(alive)setCatalog(result);}).catch(e=>{cache.delete(key);if(alive)setError(String(e));});return()=>{alive=false;};
 },[provider.type,provider.revision,provider.configured,retry]);
 return <div className="space-y-2 text-[11px] text-cyan-200/65"><div className="flex flex-wrap gap-1">{definition?.tags.map(tag=><span key={tag} className="rounded border border-cyan-800 px-1.5 py-0.5">{tag}</span>)}{definition?.catalogOnly&&<span>Discovery only · chat adapter pending</span>}</div>
 {catalog?<><p>Live catalog{catalog.partial?' (partial)':''}: {catalog.models.filter(m=>m.pricing==='free').length} free · {catalog.models.filter(m=>m.pricing==='paid').length} paid · {catalog.models.filter(m=>m.pricing==='unknown').length} pricing unknown</p><details><summary className="cursor-pointer">{catalog.models.length} available model IDs</summary><ul className="max-h-32 overflow-auto break-all">{catalog.models.map(m=><li key={m.id}>{m.id}</li>)}</ul></details></>:provider.configured?<p>{error||'Loading model catalog…'}</p>:<p>Save configuration to discover models. Catalog access does not verify chat inference.</p>}
 {provider.configured&&<button type="button" onClick={()=>setRetry(n=>n+1)} className="underline">Refresh catalog</button>}
 </div>;
}
