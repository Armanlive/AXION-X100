# Personal onboarding and encrypted profile

## Implemented behavior

A shared desktop/mobile panel opens on first launch. AXION introduces itself and asks role/industry, current projects, desired assistance, and response style one at a time. Answers can come from the panel, normal composer, or an enabled voice session. Skip, pause, resume by Hello AXION, review, redo/update, session-only use, lock and confirmed deletion are available. A saved profile opens an unlock flow rather than repeating the interview.

Interview routing happens before ordinary chat-message creation and provider calls. Profile answers are not written to chat history. The built-in conversational questions do not require a cloud model. Hindi input selects Roman Hinglish question text plus separate Devanagari speech text. Spoken questions use the existing voice engine and real state callbacks; no fabricated amplitude or new voice service. Wake onboarding continues to the next answer without requiring the wake word before every question. Profile completion returns to normal wake behavior.

An existing composer failure fallback that fabricated a dashboard command was removed; recognition failure now reports an error and submits no text.

## Persistence and privacy

Storage is the browser/Tauri webview origin's local storage under `axion.profile.encrypted.v1`, not a file under .omniroute and not the Phase-2 snapshot vault. Uses Web Crypto AES-256-GCM with a random 96-bit IV, 128-bit random salt, PBKDF2-HMAC-SHA-256 with 600,000 iterations, and authenticated format context. The passphrase requires at least 12 characters, is not persisted, and is cleared from UI fields after use. Only ciphertext and non-secret envelope metadata persist. Local decrypted profile stays in app memory until locked or the process ends. This protects stored data, not a compromised running app, malicious same-origin script, or weak passphrase.

After restart the user must unlock once; no plaintext decryption key is stored to simulate automatic unlock. Clearing origin data deletes the profile. Browser localhost and native Tauri origins have separate storage. There is no passphrase recovery or native OS-keychain integration in this implementation. An explicit encrypted-save action is required; session-only use does not replace an older saved profile.

Profile sharing with cloud AI defaults OFF. When enabled by the user, unlocked preferences are included as untrusted data in normal AI requests to guide tone, detail and workflow suggestions. When disabled or locked, profile fields are omitted. Generated AI answers may themselves mention shared context and follow ordinary chat-history behavior. Browser speech recognition may use its existing online service; this change does not make recognition offline.

## Validation

- `npm.cmd run lint`: pass.
- `npm.cmd test`: 34 tests pass, including encryption round-trip, randomization, wrong passphrase, tampering, schema validation, interview progression, no plaintext draft storage, sharing opt-in and wake resume.
- `npm.cmd run build`: pass; existing large bundle warning remains.
- `node artifacts/profile-onboarding/check-ui.mjs`: full interview, encrypted persistence, reload/unlock, wrong passphrase, update, desktop/mobile layout and confirmed deletion pass. No cloud requests during interview; fixture details/passphrase absent from local storage. Screenshots visually inspected.
- `node artifacts/profile-onboarding/check-voice.mjs`: synthetic microphone/recognition/synthesis adapters verify actual UI wake routing, next-question progression and one speech playback per question.
- `node artifacts/profile-onboarding/check-context.mjs`: intercepted AI requests verify opt-out exclusion and opt-in inclusion.

Live microphone acoustics, audible voice quality, native Tauri runtime, and real model adherence to personalization remain unverified. Existing installed Hindi voice limitations remain. No Rust, backend, PRD, mutation authority or Living Core rendering changes.

## Files

Added: src/utils/profileVault.ts; src/store/useProfileStore.ts; src/components/ProfileOnboarding.tsx; src/tests/profileVault.test.ts.
Updated: src/App.tsx; src/store/useAxionStore.ts; src/utils/aiOrchestrator.ts; src/utils/voiceEngine.ts; src/hooks/useVoiceSession.ts; src/components/WorkspaceChat.tsx; package.json.

Web Crypto reference: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
