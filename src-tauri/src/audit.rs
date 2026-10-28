//! Real data for "scan / audit this project": what is in it (languages, structure, size),
//! its stack and scripts, dependencies declared but not installed, tests, docs, git history
//! and timeline, TODO/FIXME notes, and likely hard-coded secrets (location and kind only,
//! never the value). Read-only; the model turns this into the audit report.
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::{State, WebviewWindow};
use walkdir::WalkDir;

const SKIP: [&str; 13] = ["node_modules", ".git", "dist", "build", "target", ".next", ".turbo", ".cache", "coverage", ".venv", "venv", "__pycache__", ".axion-shadow.json"];
const MAX_FILES: usize = 20_000;
const MAX_SCAN_BYTES: u64 = 1024 * 1024;
const BUDGET: Duration = Duration::from_secs(25);

#[derive(Serialize, Debug, Default)]
pub struct LangStat { pub language: String, pub files: usize, pub lines: usize }
#[derive(Serialize, Debug)]
pub struct FileStat { pub path: String, pub lines: usize }
#[derive(Serialize, Debug)]
pub struct Note { pub path: String, pub line: usize, pub text: String }
#[derive(Serialize, Debug)]
pub struct Finding { pub path: String, pub line: usize, pub kind: String }
#[derive(Serialize, Debug)]
pub struct GitInfo { pub branch: String, pub commits: usize, pub first_commit: Option<String>, pub last_commit: Option<String>, pub uncommitted_files: usize, pub remote: Option<String> }

#[derive(Serialize, Debug, Default)]
pub struct Inventory {
    pub name: String,
    pub files: usize,
    pub lines: usize,
    pub languages: Vec<LangStat>,
    /// Top-level folders and files with how many files each holds.
    pub structure: Vec<(String, usize)>,
    pub largest_files: Vec<FileStat>,
    pub manifests: Vec<String>,
    pub scripts: Vec<(String, String)>,
    pub dependencies: Vec<String>,
    pub dev_dependencies: Vec<String>,
    /// Declared in package.json but missing from node_modules (npm install not run or incomplete).
    pub not_installed: Vec<String>,
    pub test_files: usize,
    pub has_readme: bool,
    pub env_files: Vec<String>,
    pub env_ignored_by_git: bool,
    pub todos: Vec<Note>,
    pub todo_count: usize,
    pub secrets: Vec<Finding>,
    pub git: Option<GitInfo>,
    pub oldest_file_date: Option<String>,
    pub newest_file_date: Option<String>,
    pub partial: bool,
}

fn language(ext: &str) -> Option<&'static str> {
    Some(match ext {
        "ts" | "tsx" | "mts" | "cts" => "TypeScript",
        "js" | "jsx" | "mjs" | "cjs" => "JavaScript",
        "rs" => "Rust", "py" => "Python", "go" => "Go", "java" => "Java", "kt" => "Kotlin",
        "cs" => "C#", "cpp" | "cc" | "hpp" | "h" | "c" => "C/C++", "swift" => "Swift", "dart" => "Dart",
        "php" => "PHP", "rb" => "Ruby", "vue" => "Vue", "svelte" => "Svelte",
        "html" | "htm" => "HTML", "css" | "scss" | "sass" | "less" => "CSS",
        "json" => "JSON", "md" | "mdx" => "Markdown", "sql" => "SQL", "sh" | "ps1" | "bat" => "Shell",
        "yml" | "yaml" | "toml" => "Config",
        _ => return None,
    })
}

fn is_test(path: &str) -> bool {
    let p = path.to_lowercase();
    p.contains(".test.") || p.contains(".spec.") || p.contains("/tests/") || p.contains("/__tests__/") || p.starts_with("tests/") || p.contains("_test.") || p.rsplit('/').next().is_some_and(|f| f.starts_with("test_"))
}

fn date_of(ms: u128) -> String {
    // Civil date from Unix time (days since epoch), no chrono dependency.
    let days = (ms / 86_400_000) as i64;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

/// Likely secrets in source: returns the kind when a known key shape appears in the line.
pub fn secret_kind(line: &str) -> Option<&'static str> {
    let run = |s: &str, ok: fn(char) -> bool| s.chars().take_while(|c| ok(*c)).count();
    let key_char = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '-';
    for (prefix, len, kind) in [("AIza", 35, "Google API key"), ("sk-", 20, "OpenAI-style secret key"), ("ghp_", 30, "GitHub token"), ("xoxb-", 20, "Slack token"), ("AKIA", 16, "AWS access key")] {
        let mut rest = line;
        while let Some(i) = rest.find(prefix) {
            let after = &rest[i + prefix.len()..];
            if run(after, key_char) >= len { return Some(kind); }
            rest = after;
        }
    }
    if line.contains("PRIVATE KEY-----") { return Some("Private key"); }
    None
}

fn git(root: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(root).stdin(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    { use std::os::windows::process::CommandExt; cmd.creation_flags(0x0800_0000); }
    let out = cmd.output().ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn git_info(root: &Path) -> Option<GitInfo> {
    if !root.join(".git").exists() { return None; }
    let commits = git(root, &["rev-list", "--count", "HEAD"]).and_then(|c| c.parse().ok()).unwrap_or(0);
    let dates = |args: &[&str]| git(root, args).filter(|s| !s.is_empty());
    Some(GitInfo {
        branch: git(root, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_else(|| "(no commits yet)".into()),
        commits,
        first_commit: if commits > 0 { dates(&["log", "--reverse", "--format=%ad", "--date=short"]).and_then(|s| s.lines().next().map(str::to_string)) } else { None },
        last_commit: if commits > 0 { dates(&["log", "-1", "--format=%ad", "--date=short"]) } else { None },
        uncommitted_files: git(root, &["status", "--porcelain"]).map(|s| s.lines().count()).unwrap_or(0),
        remote: git(root, &["remote", "get-url", "origin"]).filter(|s| !s.is_empty()),
    })
}

fn package_json(root: &Path, inv: &mut Inventory) {
    let Ok(text) = std::fs::read_to_string(root.join("package.json")) else { return };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else { return };
    let keys = |field: &str| json.get(field).and_then(|d| d.as_object()).map(|o| o.keys().cloned().collect::<Vec<_>>()).unwrap_or_default();
    inv.dependencies = keys("dependencies");
    inv.dev_dependencies = keys("devDependencies");
    if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
        inv.scripts = scripts.iter().map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").chars().take(120).collect())).collect();
    }
    let modules = root.join("node_modules");
    inv.not_installed = inv.dependencies.iter().chain(&inv.dev_dependencies)
        .filter(|d| !modules.join(d).join("package.json").exists())
        .cloned().collect();
}

pub fn inventory(root: &Path) -> Inventory {
    let started = Instant::now();
    let mut inv = Inventory { name: root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(), ..Default::default() };
    let mut langs: HashMap<&'static str, LangStat> = HashMap::new();
    let mut structure: BTreeMap<String, usize> = BTreeMap::new();
    let mut sizes: Vec<FileStat> = Vec::new();
    let (mut oldest, mut newest) = (u128::MAX, 0u128);
    for name in ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "setup.py", "go.mod", "pom.xml", "build.gradle", "composer.json", "Gemfile", "tsconfig.json", "vite.config.ts", "tauri.conf.json", "Dockerfile"] {
        if root.join(name).exists() { inv.manifests.push(name.into()); }
    }
    let walker = WalkDir::new(root).min_depth(1).follow_links(false).into_iter()
        .filter_entry(|e| !(e.file_type().is_dir() && SKIP.contains(&e.file_name().to_string_lossy().as_ref())));
    for entry in walker.flatten() {
        if inv.files >= MAX_FILES || started.elapsed() > BUDGET { inv.partial = true; break; }
        if !entry.file_type().is_file() { continue; }
        let Ok(rel) = entry.path().strip_prefix(root) else { continue };
        let rel = rel.to_string_lossy().replace('\\', "/");
        let top = rel.split('/').next().unwrap_or("").to_string();
        *structure.entry(if rel.contains('/') { format!("{top}/") } else { top }).or_default() += 1;
        inv.files += 1;
        let file_name = entry.file_name().to_string_lossy().to_lowercase();
        if file_name.starts_with("readme") { inv.has_readme = true; }
        if file_name == ".env" || file_name.starts_with(".env.") { inv.env_files.push(rel.clone()); }
        if is_test(&rel) { inv.test_files += 1; }
        let meta = entry.metadata().ok();
        if let Some(ms) = meta.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis()) {
            oldest = oldest.min(ms);
            newest = newest.max(ms);
        }
        let ext = entry.path().extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        let Some(lang) = language(&ext) else { continue };
        if meta.as_ref().map(|m| m.len()).unwrap_or(0) > MAX_SCAN_BYTES || file_name.ends_with("-lock.json") || file_name.ends_with(".lock") { continue; }
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        let lines = text.lines().count();
        inv.lines += lines;
        let stat = langs.entry(lang).or_insert_with(|| LangStat { language: lang.into(), ..Default::default() });
        stat.files += 1;
        stat.lines += lines;
        if !matches!(lang, "JSON" | "Markdown" | "Config") { sizes.push(FileStat { path: rel.clone(), lines }); }
        for (i, line) in text.lines().enumerate() {
            let upper = line.to_uppercase();
            if (upper.contains("TODO") || upper.contains("FIXME") || upper.contains("HACK")) && line.len() < 400 {
                inv.todo_count += 1;
                if inv.todos.len() < 25 { inv.todos.push(Note { path: rel.clone(), line: i + 1, text: line.trim().chars().take(160).collect() }); }
            }
            if inv.secrets.len() < 25 {
                if let Some(kind) = secret_kind(line) { inv.secrets.push(Finding { path: rel.clone(), line: i + 1, kind: kind.into() }); }
            }
        }
    }
    let mut languages: Vec<LangStat> = langs.into_values().collect();
    languages.sort_by(|a, b| b.lines.cmp(&a.lines));
    inv.languages = languages;
    let mut structure: Vec<(String, usize)> = structure.into_iter().collect();
    structure.sort_by(|a, b| b.1.cmp(&a.1));
    structure.truncate(25);
    inv.structure = structure;
    sizes.sort_by(|a, b| b.lines.cmp(&a.lines));
    sizes.truncate(10);
    inv.largest_files = sizes;
    if newest > 0 { inv.oldest_file_date = Some(date_of(oldest)); inv.newest_file_date = Some(date_of(newest)); }
    package_json(root, &mut inv);
    inv.env_ignored_by_git = std::fs::read_to_string(root.join(".gitignore")).map(|g| g.lines().any(|l| { let l = l.trim(); l == ".env" || l == ".env*" || l == "*.env" || l == ".env.*" || l == ".env.local" })).unwrap_or(false);
    inv.git = git_info(root);
    inv
}

/// Git arguments for one read-only question about the project; None when the input is unsafe.
pub fn git_args(kind: &str, path: Option<&str>, rev: Option<&str>) -> Option<Vec<String>> {
    let safe_rev = |r: &str| !r.is_empty() && r.len() <= 80 && !r.starts_with('-') && r.chars().all(|c| c.is_ascii_alphanumeric() || "._/-~^".contains(c));
    let safe_path = |p: &str| { let p = p.trim(); !p.is_empty() && p.len() <= 300 && !p.starts_with('-') && !p.contains("..") && !p.starts_with('/') && !p.contains(':') };
    let owned = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    match kind {
        "status" => Some(owned(&["status", "--short", "--branch"])),
        "branches" => Some(owned(&["branch", "-a", "-vv"])),
        "log" => match path {
            Some(p) if safe_path(p) => Some(owned(&["log", "--all", "--oneline", "-n", "30", "--date=short", "--format=%h %ad %d %s", "--", p.trim()])),
            Some(_) => None,
            None => Some(owned(&["log", "--all", "--oneline", "-n", "30", "--date=short", "--format=%h %ad %d %s"])),
        },
        "diff" => match path {
            Some(p) if safe_path(p) => Some(owned(&["diff", "--no-ext-diff", "HEAD", "--", p.trim()])),
            Some(_) => None,
            None => Some(owned(&["diff", "--no-ext-diff", "--stat", "HEAD"])),
        },
        "stash" => Some(owned(&["stash", "list"])),
        "show" => {
            let (p, r) = (path?, rev?);
            (safe_path(p) && safe_rev(r)).then(|| vec!["show".into(), format!("{}:{}", r, p.trim().replace('\\', "/"))])
        }
        _ => None,
    }
}

/// Read-only git for AXION's research: status, branches, history, diffs, stashes and
/// old versions of a file. Never changes the repository.
#[tauri::command]
pub async fn project_git(window: WebviewWindow, state: State<'_, crate::AppState>, kind: String, path: Option<String>, rev: Option<String>) -> Result<String, String> {
    crate::terminal::trusted(&window)?;
    let root: PathBuf = {
        let mgr = state.workspace_manager.lock().map_err(|e| format!("Lock poison error: {e}"))?;
        mgr.get_active_root().map_err(|_| "No project is connected".to_string())?.to_path_buf()
    };
    let args = git_args(&kind, path.as_deref(), rev.as_deref()).ok_or("Unsupported or unsafe git request")?;
    tauri::async_runtime::spawn_blocking(move || {
        if !root.join(".git").exists() { return Err("This project is not a git repository".to_string()); }
        let mut cmd = Command::new("git");
        cmd.args(["-c", "core.fsmonitor=false", "--no-pager"]).args(&args).current_dir(&root).stdin(Stdio::null());
        #[cfg(windows)]
        { use std::os::windows::process::CommandExt; cmd.creation_flags(0x0800_0000); }
        let out = cmd.output().map_err(|_| "Git is not installed".to_string())?;
        let text = if out.status.success() { String::from_utf8_lossy(&out.stdout).into_owned() } else { format!("git error: {}", String::from_utf8_lossy(&out.stderr).trim()) };
        Ok(text.chars().take(40_000).collect())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn project_inventory(window: WebviewWindow, state: State<'_, crate::AppState>) -> Result<Inventory, String> {
    crate::terminal::trusted(&window)?;
    let root: PathBuf = {
        let mgr = state.workspace_manager.lock().map_err(|e| format!("Lock poison error: {e}"))?;
        mgr.get_active_root().map_err(|_| "No project is connected".to_string())?.to_path_buf()
    };
    tauri::async_runtime::spawn_blocking(move || inventory(&root)).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inventories_a_project() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::create_dir_all(root.join("node_modules/react")).unwrap();
        std::fs::write(root.join("node_modules/react/package.json"), "{}").unwrap();
        std::fs::write(root.join("package.json"), r#"{"scripts":{"build":"vite build"},"dependencies":{"react":"19"},"devDependencies":{"typescript":"5"}}"#).unwrap();
        std::fs::write(root.join("src/App.tsx"), "export const App = () => null;\n// TODO: real UI\nconst k = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';\n").unwrap();
        std::fs::write(root.join("src/App.test.tsx"), "test('x', () => {});\n").unwrap();
        std::fs::write(root.join(".env"), "KEY=1").unwrap();
        std::fs::write(root.join(".gitignore"), "node_modules\n.env\n").unwrap();
        std::fs::write(root.join("README.md"), "# demo").unwrap();
        let inv = inventory(root);
        assert_eq!(inv.languages[0].language, "TypeScript");
        assert_eq!(inv.test_files, 1);
        assert!(inv.has_readme && inv.env_ignored_by_git);
        assert_eq!(inv.env_files, vec![".env".to_string()]);
        assert_eq!(inv.not_installed, vec!["typescript".to_string()]);
        assert_eq!(inv.scripts, vec![("build".to_string(), "vite build".to_string())]);
        assert_eq!(inv.todo_count, 1);
        assert_eq!(inv.secrets.len(), 1);
        assert_eq!((inv.secrets[0].path.as_str(), inv.secrets[0].line, inv.secrets[0].kind.as_str()), ("src/App.tsx", 3, "Google API key"));
        assert!(inv.structure.iter().any(|(p, n)| p == "src/" && *n == 2));
        assert!(!inv.structure.iter().any(|(p, _)| p.starts_with("node_modules")));
    }
    #[test]
    fn git_requests_are_read_only_and_validated() {
        assert_eq!(git_args("show", Some("src/a.tsx"), Some("main~2")).unwrap(), vec!["show".to_string(), "main~2:src/a.tsx".to_string()]);
        assert!(git_args("log", Some("src/a.tsx"), None).unwrap().contains(&"--all".to_string()));
        for (k, p, r) in [("push", None, None), ("reset", None, None), ("show", Some("../x"), Some("main")), ("show", Some("a.ts"), Some("--output=x")), ("log", Some("--exec=x"), None), ("show", Some("C:/x"), Some("main"))] {
            assert!(git_args(k, p, r).is_none(), "{k} {p:?} {r:?}");
        }
    }
    #[test]
    fn dates_and_secret_shapes() {
        assert_eq!(date_of(0), "1970-01-01");
        assert_eq!(date_of(1_792_540_800_000), "2026-10-21");
        assert_eq!(secret_kind("const a = 'sk-short'"), None);
        assert_eq!(secret_kind("-----BEGIN RSA PRIVATE KEY-----"), Some("Private key"));
    }
}

#[cfg(test)]
mod live {
    /// `cargo test --lib -- --ignored --nocapture inventory_live` with AXION_AUDIT_DIR set.
    #[test]
    #[ignore]
    fn inventory_live() {
        let dir = std::env::var("AXION_AUDIT_DIR").expect("set AXION_AUDIT_DIR");
        println!("{}", serde_json::to_string_pretty(&super::inventory(std::path::Path::new(&dir))).unwrap());
    }
}
