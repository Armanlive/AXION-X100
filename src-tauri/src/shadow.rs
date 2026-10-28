//! A scratch copy of the connected project where AXION's proposed edits are compiled and
//! tested before the user sees them. The real project is only read: sources are mirrored
//! (incrementally) into a per-project folder under the OS temp dir, dependency folders are
//! linked rather than copied, the proposed files are written over the copy, and the same
//! fixed checks as checks.rs run there.
use crate::checks::{detect_checks, run_check, CheckResult};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};
use tauri::{State, WebviewWindow};
use walkdir::WalkDir;

const TIMEOUT: Duration = Duration::from_secs(240);
const MAX_FILES: usize = 30_000;
const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const MANIFEST: &str = ".axion-shadow.json";
/// Never copied: dependencies are linked, build output and VCS data are not needed.
const SKIP: [&str; 13] = ["node_modules", ".git", "target", "dist", "build", ".next", ".turbo", ".cache", "coverage", ".venv", "venv", "__pycache__", ".axion-shadow.json"];
/// Linked into the copy so checks can resolve installed packages.
const LINKED: [&str; 1] = ["node_modules"];

#[derive(Deserialize, Debug, Clone)]
pub struct ShadowFile { pub path: String, pub content: String }

fn stable_hash(text: &str) -> String {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    text.to_lowercase().hash(&mut h);
    format!("{:016x}", h.finish())
}

/// Plain relative paths only, never secrets or VCS internals (same rule as real writes).
pub fn safe_relative(path: &str) -> Option<PathBuf> {
    let rel = Path::new(path.trim());
    let mut out = PathBuf::new();
    for c in rel.components() {
        match c { Component::Normal(s) => out.push(s), _ => return None }
    }
    let parts: Vec<String> = out.iter().map(|p| p.to_string_lossy().to_lowercase()).collect();
    let name = parts.last()?;
    if parts.iter().any(|p| p == ".git") || name == ".env" || name.starts_with(".env.") { return None; }
    Some(out)
}

fn stamp(meta: &std::fs::Metadata) -> String {
    let mtime = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis()).unwrap_or(0);
    format!("{}:{}", meta.len(), mtime)
}

fn link_dir(target: &Path, link: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // A junction needs no admin rights, unlike a directory symlink.
        let status = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"]).arg(link).arg(target)
            .stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .creation_flags(0x0800_0000)
            .status()?;
        if status.success() { Ok(()) } else { Err(std::io::Error::other("mklink /J failed")) }
    }
    #[cfg(not(windows))]
    { std::os::unix::fs::symlink(target, link) }
}

/// Mirrors `root` into `shadow`, copying only what changed since the last mirror, and
/// removing files that no longer exist (or were overridden last time).
pub fn mirror(root: &Path, shadow: &Path) -> Result<(), String> {
    std::fs::create_dir_all(shadow).map_err(|e| e.to_string())?;
    let manifest_path = shadow.join(MANIFEST);
    let previous: HashMap<String, String> = std::fs::read_to_string(&manifest_path).ok()
        .and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    let mut current: HashMap<String, String> = HashMap::new();
    let walker = WalkDir::new(root).min_depth(1).follow_links(false).into_iter()
        .filter_entry(|e| !(e.depth() >= 1 && SKIP.contains(&e.file_name().to_string_lossy().as_ref())));
    for entry in walker.flatten() {
        if current.len() >= MAX_FILES { return Err(format!("Project has more than {MAX_FILES} files; too large for a scratch copy")); }
        if !entry.file_type().is_file() { continue; }
        let Ok(meta) = entry.metadata() else { continue };
        if meta.len() > MAX_FILE_BYTES { continue; }
        let Ok(rel) = entry.path().strip_prefix(root) else { continue };
        let key = rel.to_string_lossy().replace('\\', "/");
        let s = stamp(&meta);
        let dest = shadow.join(rel);
        if previous.get(&key) != Some(&s) || !dest.exists() {
            if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
            std::fs::copy(entry.path(), &dest).map_err(|e| format!("Copy {key}: {e}"))?;
        }
        current.insert(key, s);
    }
    for gone in previous.keys().filter(|k| !current.contains_key(*k)) {
        let _ = std::fs::remove_file(shadow.join(gone));
    }
    for dir in LINKED {
        let (src, link) = (root.join(dir), shadow.join(dir));
        if src.is_dir() && std::fs::symlink_metadata(&link).is_err() { link_dir(&src, &link).map_err(|e| format!("Link {dir}: {e}"))?; }
    }
    std::fs::write(&manifest_path, serde_json::to_string(&current).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Writes the proposed files over the copy and marks them so the next mirror restores them.
pub fn overlay(shadow: &Path, files: &[ShadowFile]) -> Result<(), String> {
    let manifest_path = shadow.join(MANIFEST);
    let mut manifest: HashMap<String, String> = std::fs::read_to_string(&manifest_path).ok()
        .and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    let mut seen = HashSet::new();
    for f in files {
        let rel = safe_relative(&f.path).ok_or_else(|| format!("Refused path: {}", f.path))?;
        if !seen.insert(rel.clone()) { continue; }
        let dest = shadow.join(&rel);
        if let Some(parent) = dest.parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        std::fs::write(&dest, &f.content).map_err(|e| format!("Write {}: {e}", f.path))?;
        manifest.insert(rel.to_string_lossy().replace('\\', "/"), "overridden".into());
    }
    std::fs::write(&manifest_path, serde_json::to_string(&manifest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn shadow_dir_for(root: &Path) -> PathBuf {
    std::env::temp_dir().join("axion-shadow").join(stable_hash(&root.to_string_lossy()))
}

/// Checks the project as it would be with `files` applied, without touching the project.
#[tauri::command]
pub async fn shadow_checks(window: WebviewWindow, state: State<'_, crate::AppState>, files: Vec<ShadowFile>) -> Result<Vec<CheckResult>, String> {
    crate::terminal::trusted(&window)?;
    if files.len() > 200 { return Err("Too many files in one change".into()); }
    let root: PathBuf = {
        let mgr = state.workspace_manager.lock().map_err(|e| format!("Lock poison error: {e}"))?;
        mgr.get_active_root().map_err(|_| "No project is connected".to_string())?.to_path_buf()
    };
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<CheckResult>, String> {
        let shadow = shadow_dir_for(&root);
        mirror(&root, &shadow)?;
        overlay(&shadow, &files)?;
        let target = shadow.with_extension("target");
        let mut results = Vec::new();
        for mut check in detect_checks(&shadow) {
            if check.program == "cargo" { check.args.extend(["--target-dir".into(), target.to_string_lossy().into_owned()]); }
            let result = run_check(&shadow, &check, TIMEOUT);
            let failed = !result.success;
            results.push(result);
            if failed { break; }
        }
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mirrors_incrementally_overlays_and_restores() {
        let project = tempfile::tempdir().unwrap();
        let scratch = tempfile::tempdir().unwrap();
        let (root, shadow) = (project.path(), scratch.path().join("copy"));
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        std::fs::write(root.join("src/a.ts"), "export const a = 1;").unwrap();
        std::fs::write(root.join("old.ts"), "x").unwrap();
        mirror(root, &shadow).unwrap();
        assert_eq!(std::fs::read_to_string(shadow.join("src/a.ts")).unwrap(), "export const a = 1;");
        assert!(shadow.join("node_modules/pkg").is_dir(), "dependencies are linked, not copied");

        overlay(&shadow, &[ShadowFile { path: "src/a.ts".into(), content: "export const a = 2;".into() }, ShadowFile { path: "src/new.ts".into(), content: "n".into() }]).unwrap();
        assert_eq!(std::fs::read_to_string(shadow.join("src/a.ts")).unwrap(), "export const a = 2;");
        assert_eq!(std::fs::read_to_string(root.join("src/a.ts")).unwrap(), "export const a = 1;", "the real project is untouched");
        assert!(!root.join("src/new.ts").exists());

        std::fs::remove_file(root.join("old.ts")).unwrap();
        mirror(root, &shadow).unwrap();
        assert_eq!(std::fs::read_to_string(shadow.join("src/a.ts")).unwrap(), "export const a = 1;", "overrides are undone on the next run");
        assert!(!shadow.join("src/new.ts").exists() && !shadow.join("old.ts").exists());
        assert!(shadow.join("node_modules/pkg").is_dir());
    }
    /// End to end on this repository (needs its node_modules):
    /// `cargo test --lib -- --ignored shadow_typechecks_this_repo`.
    #[test]
    #[ignore]
    fn shadow_typechecks_this_repo() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();
        let scratch = tempfile::tempdir().unwrap();
        let shadow = scratch.path().join("copy");
        mirror(&repo, &shadow).unwrap();
        let tsc = detect_checks(&shadow).into_iter().find(|c| c.label == "TypeScript").expect("tsc via linked node_modules");
        let broken = "export const broken: number = 'not a number';\n";
        overlay(&shadow, &[ShadowFile { path: "src/utils/axionShadowProbe.ts".into(), content: broken.into() }]).unwrap();
        let failed = run_check(&shadow, &tsc, Duration::from_secs(300));
        assert!(!failed.success && failed.output.contains("axionShadowProbe"), "{}", failed.output);
        assert!(!repo.join("src/utils/axionShadowProbe.ts").exists(), "real project untouched");
        mirror(&repo, &shadow).unwrap();
        let clean = run_check(&shadow, &tsc, Duration::from_secs(300));
        assert!(clean.success, "{}", clean.output);
    }
    #[test]
    fn refuses_unsafe_overlay_paths() {
        for bad in ["../x.ts", "/abs.ts", "C:\\x.ts", ".env", "a/.env.local", ".git/config", ""] {
            assert!(safe_relative(bad).is_none(), "{bad}");
        }
        assert!(safe_relative("src/ok.ts").is_some());
    }
}
