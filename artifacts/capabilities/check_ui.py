from pathlib import Path
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
out=Path(__file__).parent
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
class StaticHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',4173),partial(StaticHandler,directory=str(out.parents[1]/'dist')))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(channel="msedge",headless=True,args=["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"])
 context=browser.new_context(viewport={"width":1440,"height":1000},permissions=["camera","microphone"])
 context.route("**/*",lambda route:route.continue_() if urlsplit(route.request.url).hostname in {"localhost","127.0.0.1"} else route.abort())
 if os.environ.get('AXION_BROWSER_CAMERA')!='1':
  context.add_init_script("""navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#185782';ctx.fillRect(0,0,640,360);const stream=c.captureStream(10);const timer=setInterval(()=>{ctx.fillStyle='#185782';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.fillText('Synthetic AXION test frame',120,160);},100);stream.getTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;};""")
 context.add_init_script("""localStorage.setItem('axion.profile.skip','1');window.stopReasons=[];const originalStop=MediaStreamTrack.prototype.stop;MediaStreamTrack.prototype.stop=function(){window.stopReasons.push(new Error().stack);return originalStop.call(this);};window.testStreams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await get(...args);window.testStreams.push(stream);return stream;};""")
 page=context.new_page();context.new_cdp_session(page).send('Emulation.setFocusEmulationEnabled',{'enabled':True});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 print('Opening test app',flush=True)
 page.goto('http://localhost:4173');page.get_by_role('button',name='Vision',exact=True).click()
 page.get_by_role('button',name='Enable camera',exact=True).click();expect(page.get_by_text('CAMERA ON',exact=True)).to_be_visible()
 try: page.wait_for_function("document.querySelector('video')?.videoWidth>0",timeout=5000)
 except Exception:
  print(page.evaluate('window.stopReasons'))
  print(page.evaluate("({visibility:document.visibilityState,streams:window.testStreams.map(s=>s.getTracks().map(t=>t.readyState))})"))
  print(page.evaluate("[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,ready:v.readyState,paused:v.paused,src:!!v.srcObject,tracks:v.srcObject?.getTracks().map(t=>({ready:t.readyState,muted:t.muted,enabled:t.enabled}))}))"))
  print(page.locator('section[aria-label="Visual sharing"]').inner_text());print(errors)
  raise
 page.get_by_role('button',name='Capture one frame',exact=True).click()
 send=page.get_by_role('button',name='Send reviewed frame',exact=True);expect(send).to_be_disabled()
 canvas=page.locator('canvas[aria-label="Frame preview; drag to redact"]');box=canvas.bounding_box()
 page.mouse.move(box['x']+20,box['y']+20);page.mouse.down();page.mouse.move(box['x']+90,box['y']+90);page.mouse.up()
 assert page.evaluate("""(()=>{const c=document.querySelector('canvas[aria-label]'),r=c.getBoundingClientRect();return [...c.getContext('2d').getImageData(40*c.width/r.width,40*c.height/r.height,1,1).data].join(',')})()""")=="0,0,0,255"
 page.get_by_label('I reviewed/redacted this frame and authorize sending it to Gemini.').check();expect(send).to_be_enabled()
 page.screenshot(path=str(out/'visual-review-desktop.png'),full_page=True)
 print('Sending reviewed synthetic frame with external traffic blocked',flush=True)
 send.click();expect(page.get_by_role('region',name='Visual sharing')).to_have_count(0)
 assert page.evaluate("window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))")
 expect(page.get_by_text('CAMERA ON',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Vision',exact=True).click()
 page.get_by_role('button',name='Enable camera',exact=True).click();expect(page.get_by_text('CAMERA ON',exact=True)).to_be_visible()
 page.evaluate("window.testStreams.at(-1).getTracks()[0].dispatchEvent(new Event('ended'))")
 expect(page.get_by_text('Capture ended. Enable the camera or choose a screen to try again.',exact=True)).to_be_visible()
 expect(page.get_by_text('CAMERA ON',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Close vision',exact=True).click()
 # Permission-resolution race: closing the panel invalidates a pending request.
 page.get_by_role('button',name='Vision',exact=True).click()
 page.evaluate("()=>{navigator.mediaDevices.getDisplayMedia=()=>new Promise(resolve=>window.finishShare=resolve);}")
 page.get_by_role('button',name='Choose screen/window',exact=True).click();page.get_by_role('button',name='Close vision',exact=True).click()
 page.evaluate("window.lateStopped=0;window.finishShare({getTracks:()=>[{stop:()=>window.lateStopped++}]})")
 page.wait_for_function('window.lateStopped===1')
 print('Testing mobile layout',flush=True)
 page.set_viewport_size({"width":390,"height":844});page.get_by_role('button',name='Vision',exact=True).click()
 panel=page.get_by_role('region',name='Visual sharing');expect(panel).to_be_visible();b=panel.bounding_box();assert b['x']>=0 and b['x']+b['width']<=391
 page.screenshot(path=str(out/'visual-panel-mobile.png'),full_page=True)
 assert not errors,errors
 browser.close();server.shutdown();server.server_close()
 print('PASS: camera indicator, local preview, consent gate, redaction, send cleanup, stream cleanup, late permission cancellation, mobile fit; deterministic canvas video stream (AXION_BROWSER_CAMERA=1 selects the optional browser fake device); all external requests blocked.')

