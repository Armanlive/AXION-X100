pub use axion_core::workspace;

use axion_core::workspace::{NativeFileEntry, NativeFileMetadata, WorkspaceInfo, WorkspaceManager};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub workspace_manager: Mutex<WorkspaceManager>,
}

#[tauri::command]
pub fn set_workspace_root(
    state: State<'_, AppState>,
    path: String,
) -> Result<WorkspaceInfo, String> {
    let mut mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.set_workspace_root(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspace_info(state: State<'_, AppState>) -> Result<WorkspaceInfo, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.get_workspace_info().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_workspace(state: State<'_, AppState>) -> Result<(), String> {
    let mut mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.clear_workspace();
    Ok(())
}

#[tauri::command]
pub fn list_workspace_files(
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
pub fn read_workspace_text_file(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<String, String> {
    let mgr = state
        .workspace_manager
        .lock()
        .map_err(|e| format!("Lock poison error: {}", e))?;
    mgr.read_text_file(&relative_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_file_metadata(
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
        .manage(AppState {
            workspace_manager: Mutex::new(WorkspaceManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            set_workspace_root,
            get_workspace_info,
            clear_workspace,
            list_workspace_files,
            read_workspace_text_file,
            get_file_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
