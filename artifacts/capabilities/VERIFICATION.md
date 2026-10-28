# AXION optional capabilities — verification report

Implemented: optional LiveKit microphone transport and scoped Groq STT worker; shared existing AXION conversation/device TTS; consented camera/screen frame preview with manual redaction and explicit Gemini submission; standalone approved navigation/search/extraction helper; HMAC-chained browser audit. The Living Core SVG/CSS implementation and Rust/backend security files were not edited for this work.

## Files

- `src/utils/liveKitVoice.ts`: optional transport configuration, scoped room data, PTT commit and cancellation cleanup.
- `src/utils/voiceEngine.ts`: microphone stream handoff and existing voice state integration, ignored wake transcript restart.
- `src/components/LiveKitSettings.tsx`, `src/components/VoiceSettingsModal.tsx`, `src/components/mobile/MobileVoice.tsx`: shared opt-in configuration.
- `src/components/PerceptionPanel.tsx`, `src/utils/visualInput.ts`, `src/App.tsx`: capture, preview, redaction, indicators and cleanup.
- `src/store/useAxionStore.ts`, `src/utils/aiOrchestrator.ts`: reviewed frame and optional editor-context handoff to the existing provider; visual input cannot trigger local command shortcuts.
- `package.json`, `package-lock.json`: LiveKit client dependency and test entries.
- `src-python/livekit_bridge.py`, `src-python/browser.py`, `src-python/requirements-capabilities.txt`, `src-python/.gitignore`, `src-python/CAPABILITIES.md`: optional helper implementation, dependencies and setup.
- `src/tests/liveKitVoice.test.ts`, `src/tests/visualInput.test.ts`, `src-python/tests/test_capabilities.py`: regression tests.
- This directory: repeatable browser checks and screenshots. `.axion-npm-audit.json`: dependency audit output.

## Executed checks

- `npm.cmd run lint` — TypeScript passed.
- `npm.cmd test` — 43 tests passed.
- `npm.cmd run build` — TypeScript and Vite production build passed. Vite warns about a large main chunk (~2.19 MB minified / 541 KB gzip).
- `src-python/.venv-capabilities/Scripts/python.exe -m unittest discover -s src-python/tests -q` — 22 tests passed.
- `src-python/.venv-capabilities/Scripts/python.exe artifacts/capabilities/check_browser.py` — real headless Edge against isolated network fixtures: navigation, extraction, grounded link following and audit passed; public web interaction was not tested.
- `src-python/.venv-capabilities/Scripts/python.exe artifacts/capabilities/check_ui.py` — production preview on port 4173, deterministic canvas video MediaStream, all external requests blocked: camera indicator, local preview, disabled send before consent, black-rectangle redaction, send/track cleanup, late permission cancellation, mobile fit, no page errors passed. The optional Edge fake-camera fixture intermittently emitted a track-ended event before preview (two earlier full runs passed). Cleanup correctly followed the ended event; the final deterministic video fixture separates UI consent/cleanup checks from device behavior. `AXION_BROWSER_CAMERA=1` selects that optional device fixture. Physical-device verification remains required.
- Installed Python LiveKit API signatures and microphone-only token grants verified using dummy test credentials.
- `npm.cmd audit --json` — 7 findings, 2 moderate and 5 high, in the Tailwind dependency chain. No finding listed LiveKit. Automatic suggested remediation includes a Tailwind major upgrade; no unrelated framework migration was performed.

## Runtime limits

LiveKit server connectivity, Groq/Gemini live requests, real camera/screen/mic hardware, device TTS quality, native Tauri/WebView behavior and latency were not verified. LiveKit still requires a server, scoped token and running worker. Transcription is utterance-based, not incremental full-duplex voice. Browser tools remain a separately invoked trusted helper, limited to navigation and extraction, with explicit approvals. No autonomous privileged OS control, global cross-process STOP integration, native vault authority or Phase-2 mutation is claimed. HMAC audit is not deletion-proof or a replacement for native policy enforcement. See `src-python/CAPABILITIES.md` for the exact setup and boundaries.
