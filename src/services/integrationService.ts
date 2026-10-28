import {invoke,isTauri} from '@tauri-apps/api/core';
import {requiresLocalInference} from '../utils/hybridMode.ts';
export const INTEGRATIONS=[
 {id:'github',name:'GitHub',credential:'Fine-grained access token',scope:'Repository metadata and Issues read/write',write:'Create issue',resource:'owner/repository'},
 {id:'supabase',name:'Supabase',credential:'Project API key (RLS permissions apply)',scope:'Read and insert rows in the configured table',write:'Insert one JSON row',resource:'Table name'},
 {id:'gmail',name:'Gmail',credential:'Google OAuth access token',scope:'gmail.readonly and gmail.compose',write:'Create email draft (does not send)',resource:'Recipient email'},
 {id:'drive',name:'Google Drive',credential:'Google OAuth access token',scope:'drive.file (only files granted to AXION)',write:'Create folder',resource:'Not required'},
 {id:'notion',name:'Notion',credential:'Internal integration token',scope:'Read/insert content; share target pages with the integration',write:'Create child page',resource:'Parent page ID'},
 {id:'canva',name:'Canva',credential:'Canva OAuth access token',scope:'profile:read, design:meta:read and design:content:write',write:'Create blank 1080 × 1080 design',resource:'Not required'},
 {id:'dropbox',name:'Dropbox',credential:'Dropbox scoped OAuth access token',scope:'account_info.read, files.metadata.read and files.content.write',write:'Upload text file under /AXION',resource:'Not required'},
] as const;
export type IntegrationId=typeof INTEGRATIONS[number]['id'];
export interface IntegrationResult {summary:string;items:{id:string;title:string}[]}
export function integrationId(value:unknown):value is IntegrationId{return INTEGRATIONS.some(p=>p.id===value);}
function native(){if(!isTauri())throw Error('Secure integrations require the Windows AXION desktop app. No credential is saved in browser storage.');}
function online(){if(requiresLocalInference())throw Error('Integrations need online mode. Local desktop tools remain available offline.');}
export async function connections():Promise<string[]>{native();return invoke('integration_connections');}
export async function connectIntegration(service:IntegrationId,token:string,project='',resource=''):Promise<IntegrationResult>{native();online();return invoke('integration_connect',{service,token,project,resource});}
export async function disconnectIntegration(service:IntegrationId){native();return invoke('integration_disconnect',{service});}
export async function requestIntegration(service:IntegrationId,operation:'read'|'write',resource='',title='',content=''):Promise<IntegrationResult>{
 native();online();if(!integrationId(service)||!['read','write'].includes(operation))throw Error('Unsupported integration operation.');
 return invoke('integration_request',{service,operation,resource,title,content});
}
