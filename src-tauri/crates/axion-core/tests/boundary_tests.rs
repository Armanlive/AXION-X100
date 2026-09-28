use axion_core::workspace::{WorkspaceError, WorkspaceManager};
use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;

#[test]
fn test_integration_valid_file_inside_workspace() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let file_path = root.join("app.config.json");
    let mut f = File::create(&file_path).expect("Failed to create file");
    writeln!(f, "{{\"port\": 3000}}").expect("Failed to write");

    let mut mgr = WorkspaceManager::new();
    let info = mgr.set_workspace_root(&root).expect("Set workspace failed");
    assert_eq!(info.canonical_root, root.to_string_lossy());

    let resolved = mgr.resolve_and_validate_path("app.config.json").expect("Allowed");
    assert_eq!(resolved, file_path);

    let text = mgr.read_text_file("app.config.json").expect("Read text failed");
    assert!(text.contains("3000"));
}

#[test]
fn test_integration_valid_nested_file() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let nested_dir = root.join("packages").join("core").join("src");
    fs::create_dir_all(&nested_dir).expect("Failed to create nested dirs");

    let index_file = nested_dir.join("index.ts");
    let mut f = File::create(&index_file).expect("Failed to create index.ts");
    writeln!(f, "export const VERSION = '1.0.0';").expect("Write failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");

    let resolved = mgr
        .resolve_and_validate_path("packages/core/src/index.ts")
        .expect("Allowed nested");
    assert_eq!(resolved, index_file);

    let text = mgr.read_text_file("packages/core/src/index.ts").expect("Read failed");
    assert!(text.contains("VERSION"));
}

#[test]
fn test_integration_parent_traversal_rejected() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");

    let err1 = mgr.resolve_and_validate_path("../outside.txt");
    assert!(matches!(err1, Err(WorkspaceError::SecurityEscapeViolation { .. })));

    let err2 = mgr.resolve_and_validate_path("src/../../outside.txt");
    assert!(matches!(err2, Err(WorkspaceError::SecurityEscapeViolation { .. })));

    let err3 = mgr.resolve_and_validate_path("....//....//etc//passwd");
    assert!(err3.is_err());
}

#[test]
fn test_integration_absolute_outside_path_rejected() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let other_dir = tempdir().expect("Failed to create other tempdir");
    let other_file = other_dir.path().join("id_rsa");
    File::create(&other_file).expect("Failed to create file");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");

    let outside_path_str = other_file.to_string_lossy().to_string();
    let err = mgr.resolve_and_validate_path(&outside_path_str);
    assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
}

#[test]
fn test_integration_nonexistent_file_returns_structured_error() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");

    let err = mgr.resolve_and_validate_path("does_not_exist.txt");
    assert_eq!(err, Err(WorkspaceError::FileNotFound("does_not_exist.txt".to_string())));
}

#[cfg(unix)]
#[test]
fn test_integration_symlink_escape_outside_workspace_rejected() {
    use std::os::unix::fs::symlink;

    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let outside_dir = tempdir().expect("Failed to create outside tempdir");
    let outside_target = outside_dir.path().join("confidential.env");
    let mut f = File::create(&outside_target).expect("Failed to create outside file");
    writeln!(f, "SECRET_KEY=12345").expect("Write failed");

    let symlink_path = root.join("sneaky_symlink.env");
    symlink(&outside_target, &symlink_path).expect("Create symlink failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");

    let err = mgr.resolve_and_validate_path("sneaky_symlink.env");
    assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));

    let read_err = mgr.read_text_file("sneaky_symlink.env");
    assert!(matches!(read_err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
}
