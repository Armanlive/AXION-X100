# AXION-X100 — Local AI Engineering Workspace

> **"Talk to your project. Understand it. Change it. Test it."**  
> **Safety Philosophy:** *AI proposes. User approves. Native layer enforces.*

---

## 1. Overview

**AXION-X100 (v1.0.0)** is a Windows desktop AI workspace designed for local software engineering. It bridges conversational & voice AI directly with local project filesystems, specialized agent teams, native terminal execution, and intelligent zero-cost model routing—without compromising user control or data privacy.

Unlike traditional browser-based AI assistants that lack local filesystem agency, AXION-X100 operates directly on your local computer within a strictly user-approved workspace boundary.

---

## 2. Core Architecture

```text
                      AXION-X100 v1.0.0
                              │
             ┌────────────────┴────────────────┐
             │       React 18 + TS UI          │
             │ (Chats | Agent Lab | Cloud Brain)│
             └────────────────┬────────────────┘
                              │ Tauri IPC Bridge
             ┌────────────────┴────────────────┐
             │     Tauri / Rust Native Core    │
             └────────────────┬────────────────┘
                              │
    ┌──────────────────┬──────┴───────┬──────────────────┐
    │                  │              │                  │
┌───▼────────┐  ┌──────▼───────┐ ┌────▼───────┐  ┌───────▼────────┐
│ Workspace  │  │   Terminal   │ │  Security  │  │ Crash Recovery │
│ Boundary   │  │  PowerShell  │ │  & Keyring │  │ & Task Rollback│
└────────────┘  └──────────────┘ └────────────┘  └────────────────┘
```

---

## 3. Key Systems & Features

### 👑 1. Free-Only Boss Agent & Dynamic AI Router
- **Zero-Cost Priority**: Automatically routes tasks across free-tier models (`Gemini 2.0 Flash`, `OpenRouter Free`, `Local Ollama`).
- **Failover Protection**: Automatically switches to healthy backup free models upon rate limits.
- **Paid Auto-Block**: Completely prohibits automatic fallback to paid models; requests explicit user permission via an override dialog.

### 🎤 2. Voice-First Coding Engine & Hinglish Normalizer
- Real-time Speech-to-Text supporting English, Hinglish (*"Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de"*), and Hindi.
- Live audio waveform and state progression (`🔴 Listening` ➔ `🟡 Parsing` ➔ `🔵 Working` ➔ `🟢 Ready`).
- Spoken audio summaries (TTS) upon task completion.

### 🤖 3. 17 Specialist Agents + Custom Agent Creator
- **Management & Architecture**: Boss Agent, Master Planner, Requirement Analyst, Task Decomposer, Context Manager, API Architect, Final Synthesizer.
- **Engineering & Testing**: Coding Agent, Frontend Developer, Backend Developer, Database Engineer, Debug Agent, Testing Agent, File Agent.
- **Research & Data**: Research Agent, Data Analysis Agent, Documentation Agent.
- **Custom Agent Creator**: Define custom tools, system prompts, preferred models, and permissions.

### 🛡️ 4. Diff Review & User Approval Safety Gate
- **No Silent Writes**: AI prepares side-by-side or unified diff previews.
- **User Approval**: Changes are written to disk only after explicit user confirmation.
- **Validation Pipeline**: Automatically triggers native terminal builds (`npm run build`, `npm test`) with live ANSI streaming and exit code verification.

### 💾 5. Task-Bound Snapshots & 1-Click Rollback
- Automatic pre-modification snapshots bound to unique Task IDs (e.g. `#AX-1042`).
- Single-click `[ ↩ Undo Task ]` restores original file states without corrupting subsequent tasks.

### 📝 6. Enterprise Operations Audit Trail
- Timestamped audit log tracking every operation, actor (`USER`, `BOSS_AGENT`, `SPECIALIST_AGENT`, `SYSTEM`), target path, and terminal exit code.

### 🛠️ 7. Self-Healing Build Failure Recovery
- Catches compilation and test failures with friendly failure cards and actionable recovery options: `[ 🛠️ Ask Boss Agent to Fix ]`, `[ ↩ Undo Changes ]`, `[ 👁️ View Terminal ]`.

---

## 4. Getting Started

### Prerequisites
- Windows 10 / 11 (64-bit) with WebView2 (preinstalled on current Windows)
- Git and Node.js 22 LTS (v20+)
- Visual Studio Build Tools with **Desktop development with C++**
- Rust stable via [rustup](https://rustup.rs)

### Quickstart (Development Mode)
```bash
# 1. Clone repository
git clone https://github.com/Armanlive/AXION-X100.git
cd AXION-X100

# 2. Install dependencies (includes the Tauri CLI)
npm install

# 3. Launch the desktop app (starts the Vite dev server itself; do not run `npm run dev` separately)
npx @tauri-apps/cli@2 dev
```

`npm run tauri dev` is equivalent once dependencies are installed. Cloud memory sync is optional: copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Production Build
```bash
# Frontend bundle only
npm run build

# Native desktop app (runs the frontend build first)
npx @tauri-apps/cli@2 build
```

---

## 5. Verification & Test Suites

AXION-X100 has passed its defined verification suites:
- **Reality Acceptance Test Suite**: `10 / 10 PASS` (`npm run tsx src/tests/reality_test_suite.ts`)
- **Release Candidate Audit Suite**: `6 / 6 GATES PASS` (`npm run tsx src/tests/rc_audit_suite.ts`)
- **Production Bundle**: Zero TypeScript errors (`1,624 modules transformed in 2.29s`)

---

## 6. License & Philosophy

Licensed under MIT.  
**AXION-X100** — *AI proposes. User approves. Native layer enforces.*
