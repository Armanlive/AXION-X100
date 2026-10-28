# AXION conversation and device voice repair

## Fixed

- Removed the hardcoded Fullstack Coder / Intent parsed / Next Steps fallback and simulated word streaming. Missing credentials and provider failures now produce explicit, actionable errors.
- Preserved original Hindi/Hinglish messages rather than coercing every Hindi phrase into an engineering task. AXION/name greetings are small local acknowledgements, not claims of AI inference.
- Wired the existing Gemini session-key form into the existing Gemini request path. No new provider or paid voice service was added. Keys remain in application memory; the previous false encrypted-storage/connected claims were corrected. Other provider routes remain unimplemented.
- Current prompt appears once in provider history. Conversation instructions support casual dialogue and concise Hindi speech, without requiring an open workspace.
- Centralized playback in the store/engine. Removed duplicate desktop/mobile reply-reading effects. Voice replies remain readable even when synthesis cannot play.
- Added a shared desktop/mobile voice session with three modes: Hold button to talk, Conversation, and Hello AXION. Push-to-talk release drains the final recognition result; mute/end abort late results.
- Added opt-in experimental double-clap activation using real microphone time-domain RMS/peak transients. Wake detection ignores background transcripts until the wake prefix. It accepts a question after the prefix or acknowledges the wake and opens a 12-second question window. After a reply it returns to wake waiting.
- Microphone indicator follows capture state. Capture stops during reply playback, on mute, on voice exit/unmount, and when the page is hidden. No system-wide background wake service was added; the Voice screen must remain open and enabled.
- Speech output selects only voices whose browser `localService` flag is true. Explicit local selection is honored; automatic selection matches language and prefers Natural/Enhanced names and Indian English where applicable. Rate/pitch remain restrained. Voice settings offer preview and a clear missing-local-voice message.
- Browser speech recognition may use its own network service; it is not advertised as fully local/offline. Clap detection processes microphone samples locally. No fake mic levels or TTS amplitude synchronization was added.

## Source files changed in this update

- src/utils/aiOrchestrator.ts
- src/utils/voiceEngine.ts
- src/utils/voiceNormalizer.ts
- src/utils/voiceActivation.ts (new)
- src/hooks/useVoiceSession.ts (new)
- src/components/voice/VoiceActivationControls.tsx (new)
- src/components/voice/VoiceTranscript.tsx
- src/components/LiveSpeechMode.tsx
- src/components/mobile/MobileVoice.tsx
- src/components/VoiceSettingsModal.tsx
- src/components/CloudRouter.tsx
- src/store/useAxionStore.ts
- src/types/index.ts
- src/tests/voiceConversation.test.ts (new)
- package.json (includes the new regression tests)

Production assets in dist were regenerated. No Rust, native security, Living Core implementation, Master PRD, or PRD PDF was changed by this voice update. Pre-edit recovery copies are in tmp/voice-baseline.

## Validation executed

- `npm.cmd run lint`: PASS, TypeScript no-emit check.
- `npm.cmd test`: PASS, 17 tests (7 workspace tests plus 10 conversation/voice regressions).
- `npm.cmd run build`: PASS, TypeScript + Vite production build. Existing large-bundle warning remains (main bundle about 1.36 MB minified / 320 KB gzip).
- `node artifacts/voice-conversation/check-browser.mjs`: PASS, 14 voice lifecycle checks and 7 conversation/provider checks. Browser speech/microphone APIs and provider responses were explicit fixtures; no real cloud request or microphone session is claimed.
- `node artifacts/voice-conversation/check-ui-integration.mjs`: PASS, 5 checks through actual UI: key configuration, actual prompt routing, one provider request, one playback, and persistent visible reply. Explicit intercepted provider/synthetic speech fixture.
- `node artifacts/voice-conversation/capture-ui.mjs`: PASS, actual desktop/mobile/settings screenshots, no horizontal mobile overflow or page errors. Microphone permission was not granted.
- Desktop/mobile screenshots visually inspected.

## Real device observation and remaining gates

The real Edge browser reported five LOCAL output voices: Microsoft David (en-US), Ravi (en-IN), Heera (en-IN), Mark (en-US), and Zira (en-US). No local hi-IN voice was reported. Hindi audio therefore requires an installed local Hindi voice, or an explicit alternative voice selection. No human-like voice-quality claim is made.

No valid Gemini account/key was used for a live response verification. General AI conversation needs a valid Gemini key through Cloud Brain → Providers → Google Gemini (session-only), or the existing VITE_GEMINI_API_KEY configuration. Model availability, permissions and quota remain provider-dependent. Greetings/panel commands do not require the provider.

Actual microphone recognition, room acoustics/double-clap reliability, audible TTS quality, and native Tauri voice support remain physically unverified. Double-clap detection is experimental and can respond to other sharp sounds. Nothing listens after leaving/muting Voice mode or hiding the page; this is not an OS background assistant.

## Using it

1. Open Voice. Choose Hold button to talk or Conversation.
2. For hands-free activation choose Hello AXION, enable microphone permission, then say “Hello AXION” / “हेलो एक्सॉन”. Optionally enable two claps.
3. Open Voice & Language Settings to choose/preview a local voice. Install a local Hindi OS voice if Hindi speech output is needed; no paid service was configured.
4. Configure Gemini in Cloud Brain for open-ended AI replies. Do not paste private API keys into shared chats.
