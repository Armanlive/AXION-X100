# Ghost Operator — observation and proposal implementation

Status: PARTIAL. Error capture and AI proposal review implemented; secure mutation / verification loop BLOCKED by the existing Phase-2 boundary.

## Implemented

- Hooks the actual Tauri PTY Channel data/error/exit events in nativeTerminal.ts. Streaming UTF-8 decoding preserves fragmented characters. The monitor continues while a native shell runs with its panel hidden; terminal teardown cancels pending detection.
- Local memory-only 16K-character rolling capture; heuristic TypeScript, Cargo, Python traceback and runtime error signatures. Captures automatically, batches trace continuation for 600ms (maximum 2 seconds under continuous output), deduplicates consecutive identical incidents. Not a guarantee of detecting every error. Only AXION PTY output is monitored, not independent OS terminals or all external processes.
- Terminal review panel shows captured logs. User can Analyze or enable automatic future analysis for the session, explicitly exposing cloud transmission. Known secret patterns are filtered, not guaranteed complete. Up to three error-referenced indexed source files are read through NativeWorkspaceService/Rust. No fallback to stale editor cache; oversized or detected-secret source files excluded.
- Uses current Gemini conversation provider configuration, respects unsupported primary provider selection instead of silently switching. The separate Python Groq helper is not wired into frontend provider routing. No fictitious specialist execution.
- Validates structured proposals against exact supplied ORIGINAL source and safe relative target paths. Displays ORIGINAL / PROPOSED, suggested validation (not run), and Reject. Limits overlapping AI requests and enforces 30-second request spacing. Workspace changes during analysis discard results.

## Why requested self-healing is incomplete

Master PRD Section 75 says Phase-2 mutation authority remains locked. Native vault.rs returns SecureMutationUnsupportedOnPlatform on Windows. The Tauri invoke handler exposes workspace reads, not a verified snapshot/apply/validation transaction. The existing frontend approval path creates a JavaScript snapshot object; this is not an authenticated native recovery snapshot.

Apply Fix is therefore visibly disabled. No recovery snapshot is claimed or created, no disk patch is applied, no validation command is launched, and no pass/fail result is fabricated. Terminal input is not used to bypass this gate. Full completion requires separately resolving and validating native Phase-2 snapshots, authenticated approval binding, stale-source checks, atomic replacement/rollback and bounded command execution with real exit/output capture. No Rust/security/PRD changes were made in this task.

## Validation

- npm.cmd run lint: pass.
- npm.cmd test: 29 tests pass, including seven new Ghost monitor/proposal boundary tests. Initial strip-only TypeScript syntax issue was corrected.
- npm.cmd run build: pass; existing >500KB chunk warning.
- node artifacts/ghost-operator/check-ui.mjs: synthetic capture, redaction, ORIGINAL/PROPOSED preview, disabled Apply, rejection and no page errors pass.
- node artifacts/ghost-operator/check-analysis.mjs: intercepted provider response and synthetic native reader confirm source context, structured proposal and workspace mismatch rejection.
- review-fixture.png is explicitly synthetic UI evidence, not a live repair.
- Native Tauri/Cargo process capture, actual Gemini diagnosis, snapshot/apply/retest NOT runtime verified.

## Files

src/utils/ghostMonitor.ts; src/utils/ghostAnalysis.ts; src/utils/nativeTerminal.ts; src/components/GhostOperatorPanel.tsx; src/components/NativeTerminalPane.tsx; src/tests/ghostMonitor.test.ts; package.json; this report and browser fixtures.
