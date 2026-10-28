export interface VisualInput {mimeType:'image/jpeg';data:string;codeContext?:string;/** How the image was captured, for the model. */note?:string}
export function validateVisualInput(value:VisualInput){
 if(value.mimeType!=='image/jpeg'||value.data.length>2000000||!value.data||!/^[A-Za-z0-9+/=]+$/.test(value.data)||(value.codeContext?.length||0)>6000||(value.note?.length||0)>1000)throw Error('Invalid or oversized visual input.');
}

/**
 * A file Sir attached in chat. Kinds the model reads natively (images, PDF) carry
 * base64 `data`; everything else is extracted to `text` (spreadsheets, archives,
 * documents, code) or described by name and size when it can't be read.
 */
export interface Attachment {name:string;mimeType:string;size:number;data?:string;text?:string}
/** Provider requests are capped at 8 MB on the native side; inline files stay well under it. */
export const ATTACHMENT_LIMITS={files:8,inlineBase64:6_500_000,textChars:200_000};
export const INLINE_MIME_TYPES=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
export function validateAttachments(list:Attachment[]){
 if(list.length>ATTACHMENT_LIMITS.files)throw Error(`Attach at most ${ATTACHMENT_LIMITS.files} files at a time.`);
 let inline=0,text=0;
 for(const a of list){
  if(!a.name||a.name.length>255)throw Error('Invalid attachment name.');
  if(a.data!==undefined){
   if(!INLINE_MIME_TYPES.has(a.mimeType)||!/^[A-Za-z0-9+/=]+$/.test(a.data))throw Error(`${a.name}: unsupported inline file.`);
   inline+=a.data.length;
  }
  text+=a.text?.length||0;
 }
 if(inline>ATTACHMENT_LIMITS.inlineBase64)throw Error('Images and PDFs together are too large (about 4.5 MB max per message).');
 if(text>ATTACHMENT_LIMITS.textChars)throw Error('Attached text is too long for one message.');
}
