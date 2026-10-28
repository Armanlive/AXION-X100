# Terminal and Living Core update

## Result

Living Core motion polish is implemented and browser-verified. Interactive terminal frontend and native PTY integration are implemented, but native compilation and real shell execution are NOT VERIFIED. This is not a claim of VS Code feature parity or a verified desktop release.

## Changes

- `src/components/voice/AxionLivingCore.tsx`, `.css`: travelling path highlights, rotating energy filaments, warm atmospheric diffusion, staggered sparks and decorative wave strands. Existing microphone/state wiring stays unchanged; no fake TTS synchronization or synthetic microphone levels. Reduced-motion disables the added motion.
- `src/components/WorkspaceChat.tsx`: Core sizes against available chat space so opening/resizing the terminal does not crowd the welcome actions.
- `src/components/NativeTerminalPane.tsx` (new), `src/utils/nativeTerminal.ts` (new): xterm terminal rendering, ANSI output, bounded Unicode-safe ordered paste, output acknowledgements, resize handling, Ctrl+C, clear, restart, explicit error/exit states and session persistence across hiding/switching tabs.
- `src/components/TerminalAudit.tsx`, `src/utils/terminalService.ts`, `src/store/useAxionStore.ts`: existing tabs/split/docking use the terminal pane; unsupported fake shell profiles/version labels removed. Browser clearly reports that it cannot run local commands. Automated agent command execution remains disabled.
- `src-tauri/src/terminal.rs` (new), `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`: manual PTY bridge, native workspace lookup, local main-window checks, fixed shell profiles, explicit native opening consent, bounded output flow, per-session ownership, and Windows job-object process cleanup. A manual shell has the OS user's authority and is explicitly described as not a workspace sandbox. WorkspaceManager/SnapshotVault mutation authority was not unlocked.
- `package.json`, `package-lock.json`: xterm and Fit addon dependencies.
- Production assets regenerated in `dist/`; review artifacts saved alongside this report. Master PRD and its PDF were not changed.

## Validation actually executed

- `npm.cmd run lint` — PASS (`tsc --noEmit`).
- `npm.cmd test` — PASS, 7 existing workspace transaction tests.
- `npm.cmd run build` — PASS (`tsc && vite build`). Vite reports a large JS chunk warning: approximately 1.35 MB minified / 318 KB gzip. No performance or FPS claim is made.
- `node artifacts/terminal-core/capture.mjs` — PASS: desktop 1920/1440/1280 screenshots; mobile 360/390/404/430 checks; explicit four-state component fixture; unique SVG IDs; reduced-motion animations disabled; no page errors.
- `node artifacts/terminal-core/check-terminal.mjs` — PASS: 10 terminal frontend checks using an explicitly mocked Tauri IPC adapter: browser execution rejection, opening, large paste ordering, Unicode chunk boundaries, rendered-output acknowledgements, persistence when hidden, remount without spawning, restart after failed stdin, IPC exit status, and native close requests. These tests do NOT start a real shell or verify Rust.
- `node artifacts/terminal-core/record-motion.mjs` — actual desktop animation recording, no simulated voice state cycling.
- Full desktop and terminal screenshots visually inspected. Terminal-open welcome controls now fit above the composer.

## Remaining native gate

Rust/cargo and Microsoft C++ build tools were not found in the available environment. Native cargo check/test, dependency lockfile regeneration, Windows PTY startup, interactive PowerShell/CMD programs, actual interrupt/resize behavior, child-process termination, and packaged Tauri behavior remain unverified. Complete these checks on a configured Windows native build environment before treating terminal execution as release-ready. No real microphone or TTS session was validated in this update.

## Review artifacts

- `desktop-1920.png`: complete desktop.
- `terminal-browser.png`: actual browser terminal state, explicitly unavailable for local execution.
- `core-motion.webm`: animated desktop preview.
- `states-fixture.png`: explicit component states, not live audio evidence.
- `browser-checks.json`, `terminal-checks.json`: verification details.
