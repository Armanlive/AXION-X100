mod integration_plan;
mod integration_client;
mod integrations;
mod terminal;
mod providers;
mod ecc;
mod apps;
mod desktop;
mod checks;
mod shadow;
mod audit;
mod screen;
mod computer;
pub use axion_core::workspace;

use axion_core::workspace::{NativeFileEntry, NativeFileMetadata, WorkspaceInfo, WorkspaceManager};
use std::sync::Mutex;
use tauri::{State, Manager};

pub struct AppState {
    pub workspace_manager: Mutex<WorkspaceManager>,
}

#[tauri::command]
fn set_workspace_root(
    state: State<'_, AppState>,
    path: String,
) -> Result<WorkspaceInfo, String> {
    let mut mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.set_workspace_root(&path).map_err(|e| e.to_string())
}

/// Native folder picker for "Open Folder". Returns None when Sir cancels.
#[tauri::command]
async fn pick_folder(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    terminal::trusted(&window)?;
    let picked = tauri::async_runtime::spawn_blocking(|| rfd::FileDialog::new().set_title("Select Project Workspace Directory").pick_folder())
        .await
        .map_err(|e| e.to_string())?;
    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
fn default_workspace_path() -> Result<String, String> {
    // Development launches originate inside src-tauri; use the project root.
    let root = if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent()
            .ok_or("Missing project root")?.to_path_buf()
    } else {
        std::env::current_dir().map_err(|e| e.to_string())?
    };
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    // Give the renderer a classic path, never a Windows verbatim `\\?\` path.
    Ok(workspace::display_root(&root))
}

#[tauri::command]
fn get_workspace_info(state: State<'_, AppState>) -> Result<WorkspaceInfo, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.get_workspace_info().map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_workspace(state: State<'_, AppState>) -> Result<(), String> {
    let mut mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.clear_workspace();
    Ok(())
}

#[tauri::command]
fn list_workspace_files(
    state: State<'_, AppState>,
    max_depth: Option<usize>,
) -> Result<Vec<NativeFileEntry>, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.list_files(max_depth).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_workspace_text_file(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<String, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.read_text_file(&relative_path).map_err(|e| e.to_string())
}

/// Writes an approved change to disk inside the workspace and returns the re-read content.
#[tauri::command]
fn write_workspace_text_file(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    relative_path: String,
    content: String,
    expected_root: String,
    expected_content: Option<String>,
) -> Result<String, String> {
    terminal::trusted(&window)?;
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    let expected = std::path::PathBuf::from(expected_root).canonicalize().map_err(|e| e.to_string())?;
    let actual = mgr.get_workspace_info().map_err(|e| e.to_string())?;
    let actual = std::path::PathBuf::from(actual.canonical_root).canonicalize().map_err(|e| e.to_string())?;
    if expected != actual { return Err("The active project changed. Reopen the proposal's project before applying it.".into()); }
    if let Some(expected) = expected_content {
        let current = mgr.read_text_file(&relative_path).map_err(|e| e.to_string())?;
        if current != expected { return Err("File changed since this proposal. Generate a fresh diff before saving.".into()); }
    }
    mgr.write_text_file(&relative_path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_file_metadata(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<NativeFileMetadata, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.get_metadata(&relative_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(terminal::TerminalManager::default())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                window.state::<terminal::TerminalManager>().close_all();
            }
        })
        .manage(AppState {
            workspace_manager: Mutex::new(WorkspaceManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            ecc::ecc_snapshot,
            apps::launch_app,
            apps::browser_open,
            apps::open_folder,
            desktop::find_project,
            desktop::open_installed_app,
            desktop::drive_report,
            desktop::create_desktop_folder,
            computer::list_open_windows,
            computer::write_user_file,
            computer::run_shell_command,
            checks::run_project_checks,
            shadow::shadow_checks,
            audit::project_inventory,
            audit::project_git,
            screen::capture_screen,
            integrations::integration_connections,
            integrations::integration_connect,
            integrations::integration_disconnect,
            integrations::integration_request,
            providers::transcribe_audio,
            providers::open_provider_dashboard,
            providers::provider_catalog,
            providers::provider_configs,
            providers::provider_save,
            providers::provider_request,
            providers::provider_cancel,
            providers::fish_audio_tts,
            providers::fish_audio_test,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_ack,
            terminal::terminal_close,
            set_workspace_root,
            get_workspace_info,
            default_workspace_path,
            pick_folder,
            clear_workspace,
            list_workspace_files,
            read_workspace_text_file,
            write_workspace_text_file,
            get_file_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
