//! Verifies the connected project after AXION's approved edits: type-check, tests or
//! compile, picked from the project's own files. Commands are fixed here (never sent by
//! the renderer or the model), run without a shell in the workspace root, time out, and
//! return only the tail of their output.
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{State, WebviewWindow};

const TIMEOUT: Duration = Duration::from_secs(240);
const OUTPUT_TAIL: usize = 8000;

#[derive(Debug, Clone, PartialEq)]
pub struct CheckCommand { pub label: &'static str, pub program: String, pub args: Vec<String> }

#[derive(Serialize, Debug)]
pub struct CheckResult { pub label: String, pub command: String, pub success: bool, pub exit_code: Option<i32>, pub timed_out: bool, pub output: String }

/// package.json scripts, minus npm's placeholder test script.
fn npm_scripts(root: &Path) -> Vec<String> {
    let Ok(text) = std::fs::read_to_string(root.join("package.json")) else { return vec![] };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { return vec![] };
    json.get("scripts").and_then(|s| s.as_object()).map(|o| o.iter()
        .filter(|(k, v)| { let v = v.as_str().unwrap_or("").trim(); !v.is_empty() && !(k.as_str() == "test" && v.contains("no test specified")) })
        .map(|(k, _)| k.clone()).collect()).unwrap_or_default()
}

/// The checks that fit this project, cheapest first: type-check, tests, then build.
pub fn detect_checks(root: &Path) -> Vec<CheckCommand> {
    let mut checks = Vec::new();
    if root.join("package.json").is_file() {
        let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };
        let run = |label: &'static str, script: &str| CheckCommand { label, program: npm.into(), args: vec!["run".into(), script.into()] };
        let scripts = npm_scripts(root);
        let tsc = root.join("node_modules").join("typescript").join("bin").join("tsc");
        if root.join("tsconfig.json").is_file() && tsc.is_file() {
            checks.push(CheckCommand { label: "TypeScript", program: "node".into(), args: vec![tsc.to_string_lossy().into_owned(), "--noEmit".into()] });
        } else if let Some(script) = ["typecheck", "type-check", "lint"].into_iter().find(|s| scripts.iter().any(|x| x == s)) {
            checks.push(run("Type-check / lint", script));
        }
        if scripts.iter().any(|s| s == "test") {
            checks.push(CheckCommand { label: "Tests", program: npm.into(), args: vec!["test".into()] });
        }
        if scripts.iter().any(|s| s == "build") {
            checks.push(run("Build", "build"));
        }
    }
    if root.join("Cargo.toml").is_file() {
        checks.push(CheckCommand { label: "Rust build", program: "cargo".into(), args: vec!["check".into(), "--quiet".into()] });
    }
    if root.join("pyproject.toml").is_file() || root.join("requirements.txt").is_file() || root.join("setup.py").is_file() {
        let python = if cfg!(windows) { "python" } else { "python3" };
        checks.push(CheckCommand { label: "Python syntax", program: python.into(), args: vec!["-m".into(), "compileall".into(), "-q".into(), "-x".into(), r"[\\/](\.venv|venv|node_modules|\.git)[\\/]".into(), ".".into()] });
    }
    checks
}

/// Removes terminal colour codes and keeps the end, where errors are summarised.
pub fn tail(text: &str, max: usize) -> String {
    let mut clean = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') { chars.next(); while let Some(n) = chars.next() { if n.is_ascii_alphabetic() { break; } } }
            continue;
        }
        clean.push(c);
    }
    let count = clean.chars().count();
    if count <= max { return clean; }
    let skip = count - max;
    format!("…{}", clean.chars().skip(skip).collect::<String>())
}

fn kill_tree(child: &mut std::process::Child) {
    #[cfg(windows)]
    { let _ = Command::new("taskkill").args(["/T", "/F", "/PID", &child.id().to_string()]).stdout(Stdio::null()).stderr(Stdio::null()).status(); }
    let _ = child.kill();
}

/// Variables a toolchain needs to start; everything else (API keys, tokens, cloud
/// credentials inherited by the app) is withheld from scratch-copy checks.
const ISOLATED_ENV: [&str; 22] = ["PATH", "PATHEXT", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMDATA", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "LANG", "CARGO_HOME", "RUSTUP_HOME", "OS"];

/// Keys passed through to an isolated check (case-insensitive, like Windows).
pub fn isolated_env<I: IntoIterator<Item = (String, String)>>(vars: I) -> Vec<(String, String)> {
    vars.into_iter().filter(|(k, _)| ISOLATED_ENV.iter().any(|a| a.eq_ignore_ascii_case(k))).collect()
}

pub fn run_check(root: &Path, check: &CheckCommand, timeout: Duration) -> CheckResult { run_check_with(root, check, timeout, false) }

/// For checks on the scratch copy: minimal environment and offline package managers.
/// This limits inherited secrets and accidental downloads; it is not an OS sandbox.
pub fn run_check_isolated(root: &Path, check: &CheckCommand, timeout: Duration) -> CheckResult { run_check_with(root, check, timeout, true) }

fn run_check_with(root: &Path, check: &CheckCommand, timeout: Duration, isolated: bool) -> CheckResult {
    let command = format!("{} {}", check.program, check.args.join(" "));
    let mut cmd = Command::new(&check.program);
    if isolated {
        cmd.env_clear().envs(isolated_env(std::env::vars()))
            .env("npm_config_offline", "true").env("CARGO_NET_OFFLINE", "true").env("PIP_NO_INDEX", "1");
    }
    cmd.args(&check.args).current_dir(root).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .env("CI", "1").env("NO_COLOR", "1").env("FORCE_COLOR", "0");
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; cmd.creation_flags(0x0800_0000); } // CREATE_NO_WINDOW
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return CheckResult { label: check.label.into(), command, success: false, exit_code: None, timed_out: false, output: format!("Could not start {}: {e}", check.program) },
    };
    let pipe = |r: Option<Box<dyn Read + Send>>| std::thread::spawn(move || { let mut buf = Vec::new(); if let Some(mut r) = r { let _ = r.read_to_end(&mut buf); } buf });
    let out = pipe(child.stdout.take().map(|r| Box::new(r) as Box<dyn Read + Send>));
    let err = pipe(child.stderr.take().map(|r| Box::new(r) as Box<dyn Read + Send>));
    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if started.elapsed() > timeout => { timed_out = true; kill_tree(&mut child); break child.wait().ok(); }
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => break None,
        }
    };
    let mut text = String::from_utf8_lossy(&out.join().unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&err.join().unwrap_or_default()).into_owned();
    if !stderr.trim().is_empty() { if !text.is_empty() { text.push('\n'); } text.push_str(&stderr); }
    if timed_out { text.push_str(&format!("\n[stopped after {}s]", timeout.as_secs())); }
    CheckResult {
        label: check.label.into(),
        command,
        success: !timed_out && status.map(|s| s.success()).unwrap_or(false),
        exit_code: status.and_then(|s| s.code()),
        timed_out,
        output: tail(&text, OUTPUT_TAIL),
    }
}

/// Runs the project's checks in order and stops at the first failure.
#[tauri::command]
pub async fn run_project_checks(window: WebviewWindow, state: State<'_, crate::AppState>) -> Result<Vec<CheckResult>, String> {
    crate::terminal::trusted(&window)?;
    let root: PathBuf = {
        let mgr = state.workspace_manager.lock().map_err(|e| format!("Lock poison error: {e}"))?;
        mgr.get_active_root().map_err(|_| "No project is connected".to_string())?.to_path_buf()
    };
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        for check in detect_checks(&root) {
            let result = run_check(&root, &check, TIMEOUT);
            let failed = !result.success;
            results.push(result);
            if failed { break; }
        }
        results
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn isolated_checks_get_no_secrets() {
        let vars = [("PATH", "/bin"), ("Path", "C:/x"), ("GROQ_API_KEY", "k"), ("SUPABASE_SERVICE_ROLE_KEY", "s"), ("GITHUB_TOKEN", "t"), ("AWS_SECRET_ACCESS_KEY", "a"), ("TEMP", "/tmp")];
        let kept: Vec<String> = isolated_env(vars.iter().map(|(k, v)| (k.to_string(), v.to_string()))).into_iter().map(|(k, _)| k).collect();
        assert_eq!(kept, ["PATH", "Path", "TEMP"]);
    }
    #[test]
    fn detects_checks_from_project_files() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_checks(dir.path()).is_empty());
        std::fs::write(dir.path().join("package.json"), r#"{"scripts":{"test":"echo \"Error: no test specified\" && exit 1"}}"#).unwrap();
        assert!(detect_checks(dir.path()).is_empty(), "npm's placeholder test script is not a test");
        std::fs::write(dir.path().join("package.json"), r#"{"scripts":{"test":"vitest run","build":"vite build","lint":"eslint ."}}"#).unwrap();
        std::fs::write(dir.path().join("tsconfig.json"), "{}").unwrap();
        std::fs::create_dir_all(dir.path().join("node_modules/typescript/bin")).unwrap();
        std::fs::write(dir.path().join("node_modules/typescript/bin/tsc"), "").unwrap();
        std::fs::write(dir.path().join("Cargo.toml"), "").unwrap();
        let labels: Vec<_> = detect_checks(dir.path()).iter().map(|c| c.label).collect();
        assert_eq!(labels, vec!["TypeScript", "Tests", "Build", "Rust build"]);
        std::fs::remove_dir_all(dir.path().join("node_modules")).unwrap();
        assert_eq!(detect_checks(dir.path())[0].label, "Type-check / lint", "falls back to the lint script when tsc is not installed");
    }
    /// Needs Node/npm installed: `cargo test --lib -- --ignored npm_test_runs`.
    #[test]
    #[ignore]
    fn npm_test_runs_and_reports_failure() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("package.json"), r#"{"scripts":{"test":"node -e \"console.error('boom from test'); process.exit(4)\""}}"#).unwrap();
        let check = detect_checks(dir.path()).into_iter().find(|c| c.label == "Tests").unwrap();
        let result = run_check(dir.path(), &check, Duration::from_secs(60));
        assert!(!result.success, "{result:?}");
        assert!(result.output.contains("boom from test"), "{}", result.output);
    }
    #[test]
    fn keeps_the_end_of_long_output_without_colours() {
        assert_eq!(tail("\u{1b}[31merror\u{1b}[0m here", 100), "error here");
        assert_eq!(tail("abcdef", 3), "…def");
    }
    #[test]
    fn reports_failures_and_missing_programs() {
        let dir = tempfile::tempdir().unwrap();
        let missing = run_check(dir.path(), &CheckCommand { label: "X", program: "axion-no-such-program".into(), args: vec![] }, Duration::from_secs(5));
        assert!(!missing.success && missing.output.contains("Could not start"));
        #[cfg(windows)]
        {
            let fail = run_check(dir.path(), &CheckCommand { label: "X", program: "cmd".into(), args: vec!["/C".into(), "echo broken & exit 3".into()] }, Duration::from_secs(10));
            assert!(!fail.success);
            assert_eq!(fail.exit_code, Some(3));
            assert!(fail.output.contains("broken"));
        }
    }
}
