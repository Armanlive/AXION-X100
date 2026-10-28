# Optional AXION voice, perception and browser capabilities

This is an opt-in implementation, not verification of a live deployment. Existing device/browser voice remains the default. No Rust commands, OS control permissions or Phase-2 file mutation authority are added.

## LiveKit microphone transport

Install with Python 3.12 in a local virtual environment:

```powershell
python -m venv src-python/.venv-capabilities
src-python/.venv-capabilities/Scripts/python -m pip install -r src-python/requirements-capabilities.txt
```

Run a trusted LiveKit server on localhost, or use an authenticated WSS deployment. Follow the [LiveKit server documentation](https://docs.livekit.io/transport/self-hosting/local/). Keep the API secret and Groq key only in the worker environment: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `GROQ_API_KEY`. Never put them in Vite variables or source files.

Choose a private room and distinct participant/worker identities. Start the worker in one terminal:

```powershell
src-python/.venv-capabilities/Scripts/python src-python/livekit_bridge.py worker --room axion-session --participant axion-user --worker-identity axion-stt
```

In another terminal generate a participant token locally:

```powershell
src-python/.venv-capabilities/Scripts/python src-python/livekit_bridge.py token --room axion-session --participant axion-user
```

Paste only the short-lived participant token into **Voice settings → Optional LiveKit voice transport**, alongside the server URL and worker identity. Tokens stay in memory and expire after five minutes for new connections; mint a fresh one if a subsequent turn cannot connect. The worker exits after 30 minutes. Use unique room/identity values per session. Do not share tokens in chat or logs. The worker subscribes within its scoped room and processes only the named participant; do not invite other participants to that private room.

Enable the microphone explicitly, then use the existing push-to-talk or continuous controls. The real microphone stream is cloned for WebRTC; final transcripts go back through AXION's existing conversation, onboarding and response flow. Device TTS produces the reply. No remote voice service or paid subscription is automatically configured.

The worker sends each utterance to Groq transcription, using actual PCM, a fixed energy threshold and 0.7-second silence endpointing in continuous mode. PTT commits on release. Utterances are bounded to 20 seconds. This is realtime audio transport with utterance-based transcription, not incremental streaming STT, server-side TTS or a full-duplex interruptible voice agent. Latency, acoustic echo behavior, hardware capture and live provider quality have not been measured. The threshold may need adjustment for noisy/quiet microphones. An empty/no-speech turn reports an error rather than inventing text. Tokens, audio and transcripts are not logged or persisted by the worker. Audio is transmitted to your LiveKit deployment and Groq; their retention policies apply.

The existing Core follows actual listening callbacks, application processing and device synthesis start/end. Mic level remains real analyser data; speaking decoration is not claimed to reflect output amplitude. Browser speech and installed language voices remain subject to device support.

## Camera and screen context

Use **Vision** to explicitly choose camera or screen/window capture. The active indicator reflects an acquired stream. Capture a frame, drag black rectangles to cover sensitive information, and review it before selecting **Send reviewed frame**. Sending goes to the configured Gemini conversation provider; an optional editor-context checkbox includes at most 5,000 characters of the loaded file. No capture automatically goes to the provider. No provider key means no model answer.

Close, Stop media, visibility loss or a stale permission request stops owned capture tracks. Stop media also stops microphone/TTS. Images are held in memory and are not stored in chat; generated answers follow normal chat retention and may describe image content. Redaction is manual, not automatic secret detection. Capture depends on browser/OS consent and support; native Tauri/WebView capture has not been verified. Screen selection on mobile may be unsupported. Closing an already sent request cannot retract data from the provider.

## Browser tools

The optional trusted terminal helper opens a fresh isolated Edge browser, without personal cookies or a saved profile:

```powershell
src-python/.venv-capabilities/Scripts/python src-python/browser.py --workspace E:/AXION-X100 --allow-domain example.com --allow-domain duckduckgo.com
```

Set a strong random `AXION_AUDIT_KEY` of at least 32 characters in the local helper environment first. Keep the same key to verify an existing audit; never store it in source or provide it to a model. Commands: `open URL`, `search TERMS` (DuckDuckGo), `click EXACT LINK NAME`, `extract`, `stop`. Every action prompts for `APPLY`; rejecting cannot execute it. Ctrl+C stops the helper and closes its browser. The visible helper terminal is the activity indicator. Extracted text is untrusted data, never executable instructions.

`click` deliberately follows a uniquely grounded, visible link's reviewed href; it does not run arbitrary click handlers or interact with form buttons. No purchases, submissions, credentials, typing, arbitrary JavaScript, downloads, uploads, shell commands or filesystem edits are offered. The helper is not exposed as an unauthenticated HTTP endpoint or an autonomous Boss tool. Privileged computer control remains unavailable pending native enforcement and an integrated global stop gate.

Only explicitly allowed public HTTPS hostnames on port 443 are admitted. Non-GET/HEAD traffic, service workers and WebSockets are blocked. Redirect targets/resources must also be in scope. DNS checks and Playwright routes are defense in depth, not an OS network sandbox; DNS rebinding, browser vulnerabilities and same-user filesystem races are not fully eliminated. Use only trusted public sites. GET itself is not proof a site's endpoint is free of side effects; review each target and purpose.

Audit metadata is written before/after actions under the selected workspace's `.axion-browser/audit.jsonl`. Records include time, action, target origin, result and human authorization, with an HMAC chain. Query strings, path contents and page text are omitted. Corruption, unavailable audit, a second helper session, symlinks/reparse points or a 5 MB log block new actions. The chain detects record changes but is not deletion/truncation proof and does not replace SnapshotVault or OS access control. After stopping the helper, archive/delete only this metadata explicitly as needed; never rotate the key silently. A crash may leave `session.lock`; remove it only after confirming no helper is running.

## Verification boundaries

Unit tests use fake credentials and mock provider responses. Browser UI checks use a deterministic canvas video stream with all external requests blocked. They verify consent/cleanup behavior, not live microphone, camera hardware, real screen capture, Groq/Gemini responses or deployed LiveKit connectivity. No native Tauri runtime or unrestricted computer control is claimed.
