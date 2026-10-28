//! Allowlisted app launching. The renderer sends only an app id and a target;
//! every URL and protocol handler is fixed here, so no arbitrary URL can be opened.
use tauri::{Manager, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

fn launch_url(app: &str, target: &str) -> Option<&'static str> {
    Some(match (app, target) {
        ("whatsapp", "web") => "https://web.whatsapp.com/",
        ("whatsapp", "desktop") => "whatsapp://",
        ("spotify", "web") => "https://open.spotify.com/",
        ("spotify", "desktop") => "spotify:",
        ("slack", "web") => "https://app.slack.com/client",
        ("slack", "desktop") => "slack://open",
        ("discord", "web") => "https://discord.com/app",
        ("discord", "desktop") => "discord://",
        ("telegram", "web") => "https://web.telegram.org/",
        ("telegram", "desktop") => "tg://",
        ("teams", "web") => "https://teams.microsoft.com/",
        ("teams", "desktop") => "msteams:",
        ("notion", "web") => "https://www.notion.so/",
        ("notion", "desktop") => "notion://",
        ("zoom", "web") => "https://app.zoom.us/wc",
        ("zoom", "desktop") => "zoommtg://",
        _ => return None,
    })
}

/// Browsers are launched by their registered App Paths name.
fn browser_program(app: &str) -> Option<&'static str> {
    match app { "chrome" => Some("chrome"), "edge" => Some("msedge"), _ => None }
}

/// Fixed sites a voice command may open; searches are built here with a URL-encoded query.
fn browser_url(target: &str, query: Option<&str>) -> Result<String, String> {
    let site = match target {
        "google" => "https://www.google.com/",
        "youtube" => "https://www.youtube.com/",
        "gmail" => "https://mail.google.com/",
        "github" => "https://github.com/",
        "maps" => "https://www.google.com/maps",
        "drive" => "https://drive.google.com/",
        "translate" => "https://translate.google.com/",
        "news" => "https://news.google.com/",
        "search" | "youtube_search" => {
            let q = query.map(str::trim).filter(|q| !q.is_empty() && q.chars().count() <= 300).ok_or("Search text is empty or too long")?;
            let (base, key) = if target == "search" { ("https://www.google.com/search", "q") } else { ("https://www.youtube.com/results", "search_query") };
            return reqwest::Url::parse_with_params(base, &[(key, q)]).map(|u| u.to_string()).map_err(|_| "Invalid search".into());
        }
        _ => return Err("Unknown browser target".into()),
    };
    Ok(site.to_string())
}

fn open_in_browser(window: &WebviewWindow, url: &str, browser: Option<&str>) -> Result<(), String> {
    let opener = window.app_handle().opener();
    if let Some(program) = browser.and_then(browser_program) {
        if opener.open_url(url, Some(program)).is_ok() { return Ok(()); }
    }
    // Requested browser missing: the default browser still serves the request.
    opener.open_url(url, None::<&str>).map_err(|_| "Could not open the browser".to_string())
}

#[tauri::command]
pub fn launch_app(window: WebviewWindow, app: String, target: String) -> Result<(), String> {
    crate::terminal::trusted(&window)?;
    if let Some(program) = browser_program(&app) {
        return window.app_handle().opener().open_url("https://www.google.com/", Some(program)).map_err(|_| format!("Could not start {app}. Is it installed?"));
    }
    let url = launch_url(&app, &target).ok_or("Unknown app or launch target")?;
    window
        .app_handle()
        .opener()
        .open_url(url, None::<&str>)
        .map_err(|_| format!("Could not open {app} ({target})"))
}

#[tauri::command]
pub fn browser_open(window: WebviewWindow, target: String, query: Option<String>, browser: Option<String>) -> Result<(), String> {
    crate::terminal::trusted(&window)?;
    let url = browser_url(&target, query.as_deref())?;
    open_in_browser(&window, &url, browser.as_deref())
}

/// Folders a voice command may open. Paths are resolved here, never sent by the renderer.
const FOLDER_TARGETS: [&str; 8] = ["desktop", "downloads", "documents", "pictures", "music", "videos", "home", "project"];

#[tauri::command]
pub fn open_folder(window: WebviewWindow, state: tauri::State<'_, crate::AppState>, target: String) -> Result<(), String> {
    crate::terminal::trusted(&window)?;
    if !FOLDER_TARGETS.contains(&target.as_str()) { return Err("Unknown folder".into()); }
    let paths = window.app_handle().path();
    let dir = match target.as_str() {
        "desktop" => paths.desktop_dir(),
        "downloads" => paths.download_dir(),
        "documents" => paths.document_dir(),
        "pictures" => paths.picture_dir(),
        "music" => paths.audio_dir(),
        "videos" => paths.video_dir(),
        "home" => paths.home_dir(),
        _ => {
            let mgr = state.workspace_manager.lock().map_err(|e| format!("Lock poison error: {e}"))?;
            let info = mgr.get_workspace_info().map_err(|_| "No project is connected".to_string())?;
            Ok(std::path::PathBuf::from(info.canonical_root))
        }
    }
    .map_err(|_| format!("Could not find the {target} folder"))?;
    if !dir.is_dir() { return Err(format!("The {target} folder does not exist")); }
    window
        .app_handle()
        .opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|_| format!("Could not open the {target} folder"))
}

#[cfg(test)]
mod tests {
    use super::{browser_url, launch_url, FOLDER_TARGETS};
    #[test]
    fn folder_targets_are_fixed_names_not_paths() {
        assert!(FOLDER_TARGETS.contains(&"downloads"));
        assert!(!FOLDER_TARGETS.iter().any(|t| t.contains('/') || t.contains('\\') || t.contains("..")));
    }
    #[test]
    fn searches_are_encoded_and_sites_allowlisted() {
        assert_eq!(browser_url("search", Some("rust & tauri")).unwrap(), "https://www.google.com/search?q=rust+%26+tauri");
        assert!(browser_url("youtube_search", Some("lofi")).unwrap().starts_with("https://www.youtube.com/results?search_query=lofi"));
        assert!(browser_url("https://evil.example", None).is_err());
        assert!(browser_url("search", Some("  ")).is_err());
    }
    #[test]
    fn only_allowlisted_pairs_resolve() {
        assert_eq!(launch_url("whatsapp", "web"), Some("https://web.whatsapp.com/"));
        assert!(launch_url("whatsapp", "file").is_none());
        assert!(launch_url("https://evil.example", "web").is_none());
    }
}
