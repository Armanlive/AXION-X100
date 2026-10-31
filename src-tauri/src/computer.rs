//! Computer control for AXION's multi-step actions: see which windows are open, write
//! files in the user's own folders, and run shell commands. Reading and creating new
//! files happen without interruption; replacing a file or running a command shows the
//! exact change in a native approval dialog first, because a model's request can be
//! steered by text it read on a web page, in an email or in a file.
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::{Manager, WebviewWindow};

const MAX_WRITE_BYTES: usize = 1_000_000;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(120);
const OUTPUT_TAIL: usize = 8_000;
/// Files that run when double-clicked are never written by a model-chosen action.
const BLOCKED_EXTENSIONS: [&str; 16] = ["exe", "bat", "cmd", "com", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "msi", "scr", "lnk", "reg", "dll"];

#[derive(Serialize)]
pub struct OpenWindow { pub process: String, pub title: String }

#[derive(Serialize)]
pub struct CommandOutput { pub exit_code: Option<i32>, pub timed_out: bool, pub output: String }

fn approve(title: &'static str, description: String) -> Result<bool, String> {
    Ok(rfd::MessageDialog::new().set_title(title).set_description(description)
        .set_buttons(rfd::MessageButtons::OkCancel).show() == rfd::MessageDialogResult::Ok)
}

fn user_folder(window: &WebviewWindow, folder: &str) -> Result<PathBuf, String> {
    let paths = window.app_handle().path();
    let dir = match folder {
        "desktop" => paths.desktop_dir(),
        "documents" => paths.document_dir(),
        "downloads" => paths.download_dir(),
        _ => return Err("Folder must be desktop, documents or downloads.".into()),
    }.map_err(|e| e.to_string())?;
    dir.canonicalize().map_err(|e| e.to_string())
}

/// A plain relative path inside `base` that is safe for a model-chosen write.
pub fn writable_path(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = crate::shadow::safe_relative(relative).ok_or("Use a simple relative file path (no drive, .., .env or .git).")?;
    let ext = rel.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if BLOCKED_EXTENSIONS.contains(&ext.as_str()) { return Err(format!("AXION does not write .{ext} files; they would run when opened.")); }
    if rel.iter().count() > 8 { return Err("Path is too deep.".into()); }
    Ok(base.join(rel))
}

/// Visible top-level windows (process and title), so AXION knows what is open.
#[tauri::command]
pub async fn list_open_windows(window: WebviewWindow) -> Result<Vec<OpenWindow>, String> {
    crate::terminal::trusted(&window)?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object ProcessName,MainWindowTitle | ConvertTo-Json -Compress";
        let out = tauri::async_runtime::spawn_blocking(move || Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdin(Stdio::null()).stderr(Stdio::null()).creation_flags(0x0800_0000).output())
            .await.map_err(|e| e.to_string())?.map_err(|e| format!("Could not list windows: {e}"))?;
        let value: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap_or(serde_json::Value::Null);
        let items = match value { serde_json::Value::Array(a) => a, serde_json::Value::Null => vec![], one => vec![one] };
        Ok(items.iter().take(60).map(|v| OpenWindow {
            process: v["ProcessName"].as_str().unwrap_or_default().chars().take(80).collect(),
            title: v["MainWindowTitle"].as_str().unwrap_or_default().chars().take(200).collect(),
        }).collect())
    }
    #[cfg(not(windows))]
    { Err("Listing open windows is available on Windows.".into()) }
}

/// Creates (or, after approval, replaces) a text file under Desktop, Documents or Downloads.
#[tauri::command]
pub async fn write_user_file(window: WebviewWindow, folder: String, path: String, content: String) -> Result<String, String> {
    crate::terminal::trusted(&window)?;
    if content.len() > MAX_WRITE_BYTES { return Err("File content is larger than 1 MB.".into()); }
    let base = user_folder(&window, &folder)?;
    let target = writable_path(&base, &path)?;
    let parent = target.parent().ok_or("Invalid path")?.to_path_buf();
    std::fs::create_dir_all(&parent).map_err(|e| format!("Could not create folder: {e}"))?;
    // No link or junction may carry the write outside the chosen folder.
    if !parent.canonicalize().map_err(|e| e.to_string())?.starts_with(&base) { return Err("Path leaves the chosen folder.".into()); }
    if std::fs::symlink_metadata(&target).map(|m| m.file_type().is_symlink()).unwrap_or(false) { return Err("Refusing to write through a link.".into()); }
    if target.exists() {
        let description = format!("Replace this file?\n\n{}\n\nNew size: {} bytes. The old content will be overwritten.", target.display(), content.len());
        let ok = tauri::async_runtime::spawn_blocking(move || approve("AXION — Replace file", description)).await.map_err(|e| e.to_string())??;
        if !ok { return Err("Cancelled. The file was not changed.".into()); }
        std::fs::write(&target, content.as_bytes()).map_err(|e| format!("Write failed: {e}"))?;
    } else {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e| format!("Write failed: {e}"))?;
        file.write_all(content.as_bytes()).map_err(|e| format!("Write failed: {e}"))?;
    }
    Ok(target.to_string_lossy().into_owned())
}

/// Runs one shell command after the user approves the exact text, in the open project or home folder.
#[tauri::command]
pub async fn run_shell_command(window: WebviewWindow, state: tauri::State<'_, crate::AppState>, command: String, cwd: String) -> Result<CommandOutput, String> {
    crate::terminal::trusted(&window)?;
    let command = command.trim().to_string();
    if command.is_empty() || command.len() > 2_000 || command.contains('\0') { return Err("Invalid command.".into()); }
    let dir: PathBuf = match cwd.as_str() {
        "project" => state.workspace_manager.lock().map_err(|_| "Workspace busy")?.get_active_root().map_err(|_| "No project is open")?.to_path_buf(),
        "home" => window.app_handle().path().home_dir().map_err(|e| e.to_string())?,
        _ => return Err("cwd must be project or home.".into()),
    };
    let description = format!("AXION wants to run this command:\n\n{command}\n\nIn: {}\n\nOnly approve if you asked for this and understand it.", dir.display());
    let ok = tauri::async_runtime::spawn_blocking(move || approve("AXION — Run command", description)).await.map_err(|e| e.to_string())??;
    if !ok { return Err("Cancelled. The command did not run.".into()); }
    crate::terminal::trusted(&window)?;
    tauri::async_runtime::spawn_blocking(move || execute(&command, &dir, COMMAND_TIMEOUT)).await.map_err(|e| e.to_string())?
}

pub fn execute(command: &str, dir: &Path, timeout: Duration) -> Result<CommandOutput, String> {
    #[cfg(windows)]
    let mut cmd = { use std::os::windows::process::CommandExt; let mut c = Command::new("cmd"); c.arg("/C").raw_arg(command).creation_flags(0x0800_0000); c };
    #[cfg(not(windows))]
    let mut cmd = { let mut c = Command::new("sh"); c.args(["-c", command]); c };
    let mut child = cmd.current_dir(dir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .env("NO_COLOR", "1").spawn().map_err(|e| format!("Could not start the command: {e}"))?;
    let pipe = |r: Option<Box<dyn Read + Send>>| std::thread::spawn(move || { let mut b = Vec::new(); if let Some(r) = r { let _ = r.take(4_000_000).read_to_end(&mut b); } b });
    let out = pipe(child.stdout.take().map(|r| Box::new(r) as Box<dyn Read + Send>));
    let err = pipe(child.stderr.take().map(|r| Box::new(r) as Box<dyn Read + Send>));
    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Some(s),
            Ok(None) if started.elapsed() > timeout => {
                timed_out = true;
                #[cfg(windows)]
                { let _ = Command::new("taskkill").args(["/T", "/F", "/PID", &child.id().to_string()]).stdout(Stdio::null()).stderr(Stdio::null()).status(); }
                let _ = child.kill();
                break child.wait().ok();
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
            Err(_) => break None,
        }
    };
    let mut text = String::from_utf8_lossy(&out.join().unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&err.join().unwrap_or_default()).into_owned();
    if !stderr.trim().is_empty() { if !text.is_empty() { text.push('\n'); } text.push_str(&stderr); }
    if timed_out { text.push_str(&format!("\n[stopped after {}s]", timeout.as_secs())); }
    Ok(CommandOutput { exit_code: status.and_then(|s| s.code()), timed_out, output: crate::checks::tail(&text, OUTPUT_TAIL) })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn writes_stay_plain_and_non_executable() {
        let base = Path::new("/base");
        assert_eq!(writable_path(base, "notes/today.md").unwrap(), base.join("notes/today.md"));
        for bad in ["../x.txt", "/etc/passwd", "C:\\x.txt", "a/.env", ".git/config", "run.bat", "x.PS1", "tool.exe", "a/b.lnk", ""] {
            assert!(writable_path(base, bad).is_err(), "{bad}");
        }
    }
    #[cfg(unix)]
    #[test]
    fn runs_commands_with_output_exit_code_and_timeout() {
        let dir = tempfile::tempdir().unwrap();
        let ok = execute("echo hello && echo oops 1>&2", dir.path(), Duration::from_secs(10)).unwrap();
        assert_eq!(ok.exit_code, Some(0));
        assert!(ok.output.contains("hello") && ok.output.contains("oops"));
        assert_eq!(execute("exit 3", dir.path(), Duration::from_secs(10)).unwrap().exit_code, Some(3));
        let slow = execute("exec sleep 5", dir.path(), Duration::from_millis(200)).unwrap();
        assert!(slow.timed_out);
    }
}
