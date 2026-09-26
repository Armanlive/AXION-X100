# Security Policy & Architecture Model — AXION-X100

**Product:** AXION-X100 — Local AI Engineering Workspace  
**Version:** v1.0.0  
**Core Principle:** *AI proposes. User approves. Native layer enforces.*

---

## 1. Security Architecture Overview

AXION-X100 enforces multi-layered defense to prevent unintended file modifications, data leaks, and system command misuse:

```text
       [ User Request (Voice / Text) ]
                      ↓
       [ Boss Agent & Specialist Team ]
                      ↓
       [ Side-by-Side Patch Generation ]
                      ↓
       [ 👤 User Explicit Approval Gate ]
                      ↓
   [ Rust Native Workspace Scope Boundary ]
                      ↓
   [ Sensitive File Guard (.env / Keys) ]
                      ↓
       [ Disk I/O & Terminal Execution ]
                      ↓
       [ Audit Trail & Task Snapshot ]
```

---

## 2. Security Boundaries & Containment

### 2.1 Workspace Boundary Lock
- All filesystem operations are locked to the user-selected project root directory.
- Path traversal sequences (`../`, `..\..\Windows`) and arbitrary drive references (`C:\Windows`, `C:\Users`) are rejected at the Rust native layer before reaching the operating system.

### 2.2 Sensitive Files Protection
- Direct reading or modification of sensitive files is blocked by policy:
  - Environment configs: `.env`, `.env.local`, `.env.production`
  - Private SSH & TLS keys: `id_rsa`, `id_ed25519`
  - Secrets & Credentials: `secrets.json`, `credentials.json`
- Access attempts trigger a `SECURITY_INTERCEPT` audit log.

### 2.3 Terminal Command Safety & Risk Engine
Terminal commands evaluated by AXION-X100 are classified into three risk tiers:
- **LOW** (`git status`, `ls`, `dir`, `cargo check`, `npm test`): Standard execution.
- **MEDIUM** (`npm install`, `npm run build`, `git checkout`): Execution badge logged in terminal history.
- **HIGH** (`del /s`, `rm -rf`, `git reset --hard`, destructive commands): Hard-blocked until explicit User Confirmation dialog is accepted.

### 2.4 Credential Store Security
- API keys are never stored in plaintext `localStorage` or `IndexedDB`.
- Backed by the operating system credential store (Windows Credential Manager via Keyring native bridge).

---

## 3. Reporting a Vulnerability

If you discover a potential security flaw or bypass in AXION-X100:
1. Please do not open a public GitHub issue.
2. Email security findings directly to `security@axion-ai.workspace`.
3. Provide step-by-step reproduction instructions, affected platform, and logs.
4. Security advisories and patches will be released promptly following disclosure.
