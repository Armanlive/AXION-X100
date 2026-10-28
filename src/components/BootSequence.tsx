import React from 'react';
import './BootSequence.css';
export function BootSequence({ready=false}:{ready?:boolean}) {
 return <div className={`axion-boot ${ready?'axion-boot-exit':''}`} role="status" aria-live="polite">
  <div className="axion-boot-field" aria-hidden="true"><div className="axion-boot-ring"/><div className="axion-boot-ring inner"/><div className="axion-boot-center">AX</div></div>
  <h1>AXION<span>-X100</span></h1><p>{ready?'WORKSPACE READY':'INITIALIZING AXION HOLOGRAPHIC CORE'}</p>
  <div className="axion-boot-dots" aria-hidden="true"><i/><i/><i/></div><small>Local intelligence. Your workspace.</small>
 </div>;
}
