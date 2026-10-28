//! Read-only desktop helpers AXION can use on Sir's request: find a project folder by
//! name, launch an installed app from its Start Menu shortcut, and report what fills a
//! drive. Nothing here deletes or changes files; the renderer sends names, never paths.
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;
use walkdir::WalkDir;

const SKIP_DIRS: [&str; 14] = [
    "windows", "program files", "program files (x86)", "programdata", "$recycle.bin",
    "system volume information", "appdata", "node_modules", ".git", "target", "dist",
    "$windows.~ws", "recovery", "perflogs",
];
const PROJECT_MARKERS: [&str; 8] = [
    "package.json", "Cargo.toml", ".git", "pyproject.toml", "requirements.txt", "go.mod", "pom.xml", "build.gradle",
];

fn valid_desktop_folder_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    !name.is_empty() && name.len() <= 120 && name == name.trim()
        && !name.ends_with('.') && !name.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        && name != "." && name != ".."
        && !["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"].contains(&stem.as_str())
        && !(stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT")))
}

/// One empty child of the OS Desktop, with native confirmation. No arbitrary paths,
/// parent creation, replacement, shell execution or model-granted authority.
#[tauri::command]
pub async fn create_desktop_folder(window: WebviewWindow, name: String) -> Result<String, String> {
    crate::terminal::trusted(&window)?;
    if !valid_desktop_folder_name(&name) { return Err("Use a simple folder name without paths or special characters.".into()); }
    let desktop = window.app_handle().path().desktop_dir().map_err(|e| e.to_string())?
        .canonicalize().map_err(|e| e.to_string())?;
    let target = desktop.join(&name);
    let description = format!("Create this empty folder?\n\n{}\n\nExisting files and folders will not be replaced.", target.display());
    let approved = tauri::async_runtime::spawn_blocking(move || rfd::MessageDialog::new()
        .set_title("AXION — Create Desktop folder").set_description(description)
        .set_buttons(rfd::MessageButtons::OkCancel).show()).await.map_err(|e| e.to_string())?;
    if approved != rfd::MessageDialogResult::Ok { return Err("Cancelled. Nothing was created.".into()); }
    crate::terminal::trusted(&window)?;
    if desktop.canonicalize().map_err(|e| e.to_string())? != desktop { return Err("Desktop location changed. Try again.".into()); }
    std::fs::create_dir(&target).map_err(|e| format!("Could not create folder (nothing replaced): {e}"))?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod desktop_folder_tests {
    use super::*;
    #[test]
    fn restricts_creation_to_single_normal_child() {
        for name in ["../escape", "C:\\folder", "a/b", "..", "CON.txt", "LPT1", "bad.", " bad", "", "a:b"] {
            assert!(!valid_desktop_folder_name(name), "{name}");
        }
        assert!(valid_desktop_folder_name("Sana AI"));
        assert!(valid_desktop_folder_name("New Folder"));
    }
}

fn normalize(name: &str) -> String {
    name.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).collect()
}

/// Higher is better; 0 means no match.
fn name_score(candidate: &str, query: &str) -> u32 {
    let (c, q) = (normalize(candidate), normalize(query));
    if q.is_empty() || c.is_empty() { return 0; }
    if c == q { 100 } else if c.starts_with(&q) { 70 } else if c.contains(&q) { 50 } else if q.contains(&c) && c.len() >= 4 { 30 } else { 0 }
}

fn drive_root(letter: &str) -> Result<PathBuf, String> {
    let l = letter.trim().trim_end_matches([':', '\\', '/']);
    let mut chars = l.chars();
    match (chars.next(), chars.next()) {
        (Some(c), None) if c.is_ascii_alphabetic() => Ok(PathBuf::from(format!("{}:\\", c.to_ascii_uppercase()))),
        _ => Err("Drive must be a single letter like E".into()),
    }
}

fn existing_drives() -> Vec<PathBuf> {
    ('A'..='Z').map(|c| PathBuf::from(format!("{c}:\\"))).filter(|p| p.is_dir()).collect()
}

#[derive(Serialize, Clone, Debug)]
pub struct ProjectMatch { pub name: String, pub path: String, pub is_project: bool }

/// Folders up to three levels deep whose name matches `query`, best first.
pub fn search_projects(roots: &[PathBuf], query: &str, budget: Duration) -> Vec<ProjectMatch> {
    let started = Instant::now();
    let mut found: Vec<(u32, ProjectMatch)> = Vec::new();
    for root in roots {
        let walker = WalkDir::new(root).min_depth(1).max_depth(3).into_iter().filter_entry(|e| {
            !(e.file_type().is_dir() && SKIP_DIRS.contains(&e.file_name().to_string_lossy().to_lowercase().as_str()))
        });
        for entry in walker.flatten() {
            if started.elapsed() > budget { break; }
            if !entry.file_type().is_dir() { continue; }
            let name = entry.file_name().to_string_lossy().into_owned();
            let score = name_score(&name, query);
            if score == 0 { continue; }
            let is_project = PROJECT_MARKERS.iter().any(|m| entry.path().join(m).exists());
            let depth_penalty = entry.depth() as u32;
            found.push((score + if is_project { 20 } else { 0 } - depth_penalty, ProjectMatch {
                name, path: entry.path().to_string_lossy().into_owned(), is_project,
            }));
        }
    }
    found.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.path.len().cmp(&b.1.path.len())));
    found.into_iter().take(5).map(|(_, m)| m).collect()
}

#[tauri::command]
pub async fn find_project(window: WebviewWindow, query: String, drive: Option<String>) -> Result<Vec<ProjectMatch>, String> {
    crate::terminal::trusted(&window)?;
    let query = query.trim().to_string();
    if query.is_empty() || query.chars().count() > 80 { return Err("Project name is empty or too long".into()); }
    let roots = match drive.as_deref().filter(|d| !d.trim().is_empty()) {
        Some(d) => { let r = drive_root(d)?; if !r.is_dir() { return Err(format!("Drive {} not found", r.display())); } vec![r] }
        None => existing_drives(),
    };
    tauri::async_runtime::spawn_blocking(move || search_projects(&roots, &query, Duration::from_secs(10)))
        .await
        .map_err(|e| e.to_string())
}

fn start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(p) = std::env::var("ProgramData") { dirs.push(Path::new(&p).join(r"Microsoft\Windows\Start Menu\Programs")); }
    if let Ok(p) = std::env::var("APPDATA") { dirs.push(Path::new(&p).join(r"Microsoft\Windows\Start Menu\Programs")); }
    dirs
}

/// Start Menu shortcuts by display name (uninstallers and help links left out).
pub fn installed_apps(dirs: &[PathBuf]) -> Vec<(String, PathBuf)> {
    let mut apps = Vec::new();
    for dir in dirs {
        for entry in WalkDir::new(dir).max_depth(4).into_iter().flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("lnk")) != Some(true) { continue; }
            let name = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
            let lower = name.to_lowercase();
            if lower.contains("uninstall") || lower.contains("readme") || lower.contains("help") { continue; }
            apps.push((name, path.to_path_buf()));
        }
    }
    apps
}

pub fn best_app<'a>(apps: &'a [(String, PathBuf)], query: &str) -> Option<&'a (String, PathBuf)> {
    apps.iter()
        .map(|a| (name_score(&a.0, query), a))
        .filter(|(s, _)| *s > 0)
        .max_by(|x, y| x.0.cmp(&y.0).then(y.1 .0.len().cmp(&x.1 .0.len())))
        .map(|(_, a)| a)
}

/// Short names people say for apps whose shortcut has a longer name.
fn expand_alias(query: &str) -> &str {
    match normalize(query).as_str() {
        "vscode" | "code" | "vsc" => "Visual Studio Code",
        "ppt" | "powerpoint" => "PowerPoint",
        "msword" => "Word",
        "msexcel" => "Excel",
        _ => query,
    }
}

/// Built-in Windows apps without Start Menu shortcuts: fixed executables or URIs only.
fn system_app(query: &str) -> Option<(&'static str, &'static str)> {
    Some(match normalize(query).as_str() {
        "notepad" => ("Notepad", "notepad.exe"),
        "calculator" | "calc" => ("Calculator", "calc.exe"),
        "paint" | "mspaint" => ("Paint", "mspaint.exe"),
        "commandprompt" | "cmd" => ("Command Prompt", "cmd.exe"),
        "powershell" => ("PowerShell", "powershell.exe"),
        "taskmanager" | "taskmgr" => ("Task Manager", "taskmgr.exe"),
        "controlpanel" => ("Control Panel", "control.exe"),
        "settings" | "windowssettings" => ("Settings", "ms-settings:"),
        _ => return None,
    })
}

/// Launches a built-in Windows app, or the best-matching Start Menu app, and returns its name.
#[tauri::command]
pub fn open_installed_app(window: WebviewWindow, name: String) -> Result<String, String> {
    crate::terminal::trusted(&window)?;
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 { return Err("App name is empty or too long".into()); }
    if let Some((display, target)) = system_app(name) {
        let opened = if target.ends_with(':') {
            window.app_handle().opener().open_url(target, None::<&str>).map_err(|e| e.to_string())
        } else {
            std::process::Command::new(target).spawn().map(|_| ()).map_err(|e| e.to_string())
        };
        return opened.map(|_| display.to_string()).map_err(|_| format!("Could not start {display}"));
    }
    let name = expand_alias(name);
    let apps = installed_apps(&start_menu_dirs());
    let (display, shortcut) = best_app(&apps, name).ok_or_else(|| format!("No installed app named \"{name}\" in the Start Menu"))?;
    window.app_handle().opener().open_path(shortcut.to_string_lossy(), None::<&str>)
        .map_err(|_| format!("Could not start {display}"))?;
    Ok(display.clone())
}

#[derive(Serialize, Debug)]
pub struct FolderSize { pub path: String, pub bytes: u64 }

#[derive(Serialize, Debug)]
pub struct DriveReport {
    pub drive: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub top_folders: Vec<FolderSize>,
    pub largest_subfolders: Vec<FolderSize>,
    /// True when the scan stopped at its time budget; sizes are then lower bounds.
    pub partial: bool,
}

#[cfg(windows)]
fn disk_space(root: &Path) -> Result<(u64, u64), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = root.as_os_str().encode_wide().chain(Some(0)).collect();
    let (mut free, mut total, mut total_free) = (0u64, 0u64, 0u64);
    let ok = unsafe { GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, &mut total, &mut total_free) };
    if ok == 0 { return Err("Could not read drive size".into()); }
    Ok((total, total_free))
}
#[cfg(not(windows))]
fn disk_space(_root: &Path) -> Result<(u64, u64), String> { Err("Drive reports are Windows-only".into()) }

/// Sizes of the first two folder levels under `root`, within a time budget.
pub fn folder_sizes(root: &Path, budget: Duration) -> (Vec<FolderSize>, Vec<FolderSize>, bool) {
    let started = Instant::now();
    let mut top: HashMap<PathBuf, u64> = HashMap::new();
    let mut second: HashMap<PathBuf, u64> = HashMap::new();
    let mut partial = false;
    for entry in WalkDir::new(root).min_depth(1).into_iter().flatten() {
        if started.elapsed() > budget { partial = true; break; }
        if !entry.file_type().is_file() { continue; }
        let Ok(rel) = entry.path().strip_prefix(root) else { continue };
        let mut parts = rel.components();
        let Some(first) = parts.next() else { continue };
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let first = root.join(first);
        if rel.components().count() == 1 { continue; } // loose files in the root
        *top.entry(first.clone()).or_default() += size;
        if let Some(sub) = parts.next() { if rel.components().count() > 2 { *second.entry(first.join(sub)).or_default() += size; } }
    }
    let sorted = |m: HashMap<PathBuf, u64>| {
        let mut v: Vec<FolderSize> = m.into_iter().map(|(p, bytes)| FolderSize { path: p.to_string_lossy().into_owned(), bytes }).collect();
        v.sort_by(|a, b| b.bytes.cmp(&a.bytes));
        v.truncate(8);
        v
    };
    (sorted(top), sorted(second), partial)
}

#[tauri::command]
pub async fn drive_report(window: WebviewWindow, drive: String) -> Result<DriveReport, String> {
    crate::terminal::trusted(&window)?;
    let root = drive_root(&drive)?;
    if !root.is_dir() { return Err(format!("Drive {} not found", root.display())); }
    let (total_bytes, free_bytes) = disk_space(&root)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (top_folders, largest_subfolders, partial) = folder_sizes(&root, Duration::from_secs(40));
        DriveReport { drive: root.to_string_lossy().into_owned(), total_bytes, free_bytes, top_folders, largest_subfolders, partial }
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_match_loosely_and_drives_are_letters_only() {
        assert_eq!(name_score("Sana-ai-voice-assistant", "sana ai"), 70);
        assert_eq!(name_score("AXION-X100", "axion x100"), 100);
        assert_eq!(name_score("photos", "sana"), 0);
        assert!(drive_root("e").unwrap().ends_with("E:\\"));
        assert!(drive_root("E:").is_ok());
        assert!(drive_root("..\\").is_err());
        assert!(drive_root("C:\\Windows").is_err());
    }
    #[test]
    fn finds_projects_and_sizes_folders() {
        let dir = tempfile::tempdir().unwrap();
        let proj = dir.path().join("work").join("Sana-AI");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(proj.join("package.json"), "{}").unwrap();
        std::fs::create_dir_all(dir.path().join("node_modules").join("sana")).unwrap();
        std::fs::write(dir.path().join("work").join("big.bin"), vec![0u8; 4096]).unwrap();
        let found = search_projects(&[dir.path().to_path_buf()], "sana", Duration::from_secs(5));
        assert_eq!(found.len(), 1, "node_modules is skipped");
        assert!(found[0].is_project);
        let (top, second, partial) = folder_sizes(dir.path(), Duration::from_secs(5));
        assert!(!partial);
        assert_eq!(top[0].bytes, 4096 + 2);
        assert!(second.iter().any(|f| f.path.ends_with("Sana-AI") && f.bytes == 2));
    }
    #[test]
    fn picks_the_closest_app_name() {
        let apps = vec![("Visual Studio Code".to_string(), PathBuf::from("a.lnk")), ("Code Runner".to_string(), PathBuf::from("b.lnk")), ("Excel".to_string(), PathBuf::from("c.lnk"))];
        assert_eq!(best_app(&apps, "excel").unwrap().0, "Excel");
        assert_eq!(best_app(&apps, "visual studio").unwrap().0, "Visual Studio Code");
        assert!(best_app(&apps, "photoshop").is_none());
        assert_eq!(best_app(&apps, expand_alias("VS Code")).unwrap().0, "Visual Studio Code");
        assert_eq!(system_app("calculator").unwrap().1, "calc.exe");
        assert!(system_app("rm -rf").is_none());
    }
}
