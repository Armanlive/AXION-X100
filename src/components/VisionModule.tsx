import {useEffect,useRef,useState} from 'react';
import {useAxionStore} from '../store/useAxionStore';
import {GestureEngine,gestureAction,type Gesture,type Landmark} from '../utils/gestureEngine';

/**
 * Live camera + on-device hand tracking. Frames stay in this webview: the
 * landmarker runs locally (MediaPipe WASM/GPU) and only gesture events reach
 * the workspace. Sending a frame to the Cloud Brain stays in the reviewed,
 * redactable Vision panel; nothing here uploads video.
 */
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FRAME_INTERVAL_MS=66; // ~15 fps is plenty for gestures and keeps the main thread free.
type HandLandmarker={detectForVideo(video:HTMLVideoElement,timestamp:number):{landmarks:Landmark[][]};close():void};

async function loadHandLandmarker():Promise<HandLandmarker>{
 const {HandLandmarker}=await import('@mediapipe/tasks-vision');
 const fileset={
  wasmLoaderPath:new URL('../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js',import.meta.url).href,
  wasmBinaryPath:new URL('../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',import.meta.url).href
 };
 const options=(delegate:'GPU'|'CPU')=>({baseOptions:{modelAssetPath:MODEL_URL,delegate},runningMode:'VIDEO' as const,numHands:1,minHandDetectionConfidence:.6,minTrackingConfidence:.5});
 try{return await HandLandmarker.createFromOptions(fileset,options('GPU'));}
 catch{return HandLandmarker.createFromOptions(fileset,options('CPU'));}
}

const describe=(g:Gesture)=>g.type==='tap'?'Air-tap':g.type==='zoom'?`Pinch zoom ${g.direction}`:`Swipe ${g.direction}`;

export function VisionModule(){
 const [on,setOn]=useState(false);const [status,setStatus]=useState('');const [last,setLast]=useState('');
 const [cursor,setCursor]=useState(0);const cursorRef=useRef(0);const zoom=useRef(1);
 const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
 const landmarker=useRef<HandLandmarker|null>(null);const engine=useRef(new GestureEngine({mirrored:true}));
 const epoch=useRef(0);const frame=useRef(0);
 const filesIndex=useAxionStore(s=>s.filesIndex);
 const files=filesIndex.filter(f=>!f.isDirectory).map(f=>f.relativePath);
 const filesRef=useRef(files);filesRef.current=files;

 const stop=()=>{
  epoch.current++;cancelAnimationFrame(frame.current);
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
  if(video.current)video.current.srcObject=null;
  landmarker.current?.close();landmarker.current=null;engine.current.reset();
  setOn(false);setStatus('');
 };

 const apply=(gesture:Gesture)=>{
  const store=useAxionStore.getState();
  const action=gestureAction(gesture,{files:filesRef.current,cursor:cursorRef.current,zoom:zoom.current});
  if(action.kind==='focusFile'){cursorRef.current=action.index;setCursor(action.index);store.toggleFilePanel(true);}
  else if(action.kind==='openFile')store.selectFile(action.path);
  else if(action.kind==='filePanel')store.toggleFilePanel(action.open);
  else if(action.kind==='zoom'){zoom.current=action.level;document.documentElement.style.zoom=String(action.level);}
  setLast(action.kind==='none'?`${describe(gesture)} · ${action.reason}`:describe(gesture));
 };

 const start=async()=>{
  stop();const token=epoch.current;setOn(true);setStatus('Starting camera…');
  try{
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}},audio:false});
   if(token!==epoch.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   for(const track of media.getTracks())track.onended=()=>{if(stream.current===media){stop();setStatus('Camera ended.');}};
   const v=video.current;if(!v)throw Error('no video');v.srcObject=media;await v.play();
   setStatus('Loading hand tracker…');
   const tracker=await loadHandLandmarker();
   if(token!==epoch.current){tracker.close();return;}
   landmarker.current=tracker;setStatus('Tracking');
   let lastRun=0;
   const loop=(now:number)=>{
    if(token!==epoch.current)return;
    frame.current=requestAnimationFrame(loop);
    if(now-lastRun<FRAME_INTERVAL_MS||v.readyState<2)return;
    lastRun=now;
    const started=performance.now();
    const result=tracker.detectForVideo(v,now);
    const gesture=engine.current.update(result.landmarks[0]??null,now);
    if(gesture)apply(gesture);
    // A slow device gets fewer frames instead of a janky UI.
    if(performance.now()-started>30)lastRun=now+FRAME_INTERVAL_MS;
   };
   frame.current=requestAnimationFrame(loop);
  }catch{
   if(token===epoch.current){stop();setStatus('Camera or hand tracker unavailable. Check camera permission and network access for the tracking model.');}
  }
 };

 useEffect(()=>{
  const hide=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',hide);
  return()=>{document.removeEventListener('visibilitychange',hide);stop();};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 const focused=files[cursor];
 return <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 text-[11px]">
  <div className={on?'w-56 rounded-lg bg-slate-950/95 border border-cyan-900 p-2 space-y-1':'hidden'}>
   <video ref={video} muted playsInline aria-label="Gesture camera preview" className="w-full rounded -scale-x-100"/>
   <p role="status" className="text-amber-300">CAMERA ON · {status}</p>
   {last&&<p className="text-cyan-200">{last}</p>}
   {focused&&<p className="text-slate-400 truncate" title={focused}>Focused: {focused}</p>}
   <p className="text-slate-500">Swipe ←/→ pick file · tap open · swipe ↑/↓ files panel · pinch + push/pull zoom</p>
  </div>
  {!on&&status&&<p role="alert" className="max-w-56 text-amber-300 bg-slate-950 rounded px-2 py-1">{status}</p>}
  <div className="flex gap-2 bg-slate-950 rounded px-2 py-1">
   <button onClick={()=>on?stop():void start()} className="text-cyan-200">{on?'Stop gestures':'Gestures'}</button>
   {zoom.current!==1&&<button onClick={()=>{zoom.current=1;document.documentElement.style.zoom='1';setLast('Zoom reset');}} className="text-slate-300">Reset zoom</button>}
  </div>
 </div>;
}
