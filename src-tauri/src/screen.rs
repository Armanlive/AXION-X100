//! On-request screenshot for "AXION, what's on my screen?". Runs only when the
//! renderer asks (after Sir's consent), never in the background; nothing is saved.
use serde::Serialize;
use tauri::WebviewWindow;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenCapture {
    /// Foreground window title, base64 UTF-8 (decoded by the renderer).
    title_base64: String,
    /// JPEG, base64, at most 1600px wide.
    jpeg_base64: String,
}

const SCRIPT: &str = include_str!("capture_screen.ps1");
const MAX_BASE64: usize = 2_000_000;

fn is_base64(s: &str) -> bool {
    s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=')
}

#[cfg(windows)]
fn run_capture() -> Result<ScreenCapture, String> {
    use std::{io::Write, os::windows::process::CommandExt, process::Command};
    let mut script = tempfile::Builder::new().prefix("axion-capture-").suffix(".ps1").tempfile().map_err(|_| "Cannot prepare screen capture")?;
    script.write_all(SCRIPT.as_bytes()).map_err(|_| "Cannot prepare screen capture")?;
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script.path())
        .creation_flags(0x08000000)
        .output()
        .map_err(|_| "Screen capture could not start")?;
    if !output.status.success() {
        return Err("Screen capture failed".into());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
    let (title, jpeg) = (lines.next().unwrap_or_default(), lines.next().unwrap_or_default());
    if jpeg.is_empty() || !is_base64(title) || !is_base64(jpeg) {
        return Err("Screen capture returned no image".into());
    }
    if jpeg.len() > MAX_BASE64 {
        return Err("Screenshot is too large to send".into());
    }
    Ok(ScreenCapture { title_base64: title.to_string(), jpeg_base64: jpeg.to_string() })
}

#[cfg(not(windows))]
fn run_capture() -> Result<ScreenCapture, String> {
    Err("Screen capture is currently supported on Windows".into())
}

#[tauri::command]
pub async fn capture_screen(window: WebviewWindow) -> Result<ScreenCapture, String> {
    crate::terminal::trusted(&window)?;
    tauri::async_runtime::spawn_blocking(run_capture).await.map_err(|_| "Screen capture interrupted".to_string())?
}
