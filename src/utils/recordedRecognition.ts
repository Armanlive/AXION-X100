/** Real, bounded utterances. Opt-in is enforced by the owning voice engine. */
export class RecordedRecognition {
 private recorder:MediaRecorder|null=null;private epoch=0;private timer:ReturnType<typeof setInterval>|undefined;
 private voiced=false;private lastVoice=0;private started=0;
 private transcribe:(bytes:number[],mime:string)=>Promise<string>;private transcript:(text:string)=>void;private error:(message:string)=>void;
 constructor(transcribe:(bytes:number[],mime:string)=>Promise<string>,transcript:(text:string)=>void,error:(message:string)=>void){this.transcribe=transcribe;this.transcript=transcript;this.error=error;}
 sample(rms:number,now:number){if(this.recorder?.state==='recording'&&rms>.015){this.voiced=true;this.lastVoice=now;}}
 start(stream:MediaStream){
  this.stop();const epoch=this.epoch;this.voiced=false;this.started=performance.now();this.lastVoice=this.started;
  try{
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
   if(!mime)throw Error('This WebView cannot record a supported audio format.');
   const recorder=this.recorder=new MediaRecorder(stream,{mimeType:mime});const chunks:Blob[]=[];let size=0;
   recorder.ondataavailable=e=>{if(e.data.size){size+=e.data.size;if(size<=2_000_000)chunks.push(e.data);else{this.stop();this.error('Recording too large. Please use a shorter utterance.');}}};
   recorder.onerror=()=>{if(epoch===this.epoch){this.stop();this.error('Microphone recording failed. Re-enable microphone to retry.');}};
   recorder.onstop=async()=>{
    if(epoch!==this.epoch)return;clearInterval(this.timer);this.recorder=null;
    if(!this.voiced){if(stream.getAudioTracks().some(t=>t.readyState==='live'))this.start(stream);return;}
    try{const buffer=await new Blob(chunks,{type:mime}).arrayBuffer();if(epoch!==this.epoch)return;
     const text=await this.transcribe(Array.from(new Uint8Array(buffer)),mime);if(epoch!==this.epoch)return;
     if(text)this.transcript(text);else if(stream.getAudioTracks().some(t=>t.readyState==='live'))this.start(stream);
    }catch(e){if(epoch===this.epoch)this.error(String(e));}
   };
   recorder.start(250);
   this.timer=setInterval(()=>{const now=performance.now();if(recorder.state==='recording'&&((this.voiced&&now-this.lastVoice>900)||now-this.started>12000))recorder.stop();},100);
  }catch(e){this.stop();this.error(String(e));}
 }
 stop(flush=false){clearInterval(this.timer);if(!flush)this.epoch++;const recorder=this.recorder;if(recorder?.state==='recording')recorder.stop();if(!flush)this.recorder=null;}
}
