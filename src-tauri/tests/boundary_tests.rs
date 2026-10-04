use axion_lib::workspace::{WorkspaceError, WorkspaceManager};
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

#[test]
fn test_integration_workspace_switch_invalidates_previous_boundary() {
    let dir_a = tempdir().expect("Failed to create tempdir A");
    let root_a = fs::canonicalize(dir_a.path()).expect("Canonicalize A failed");
    let file_a = root_a.join("project_a.txt");
    let mut fa = File::create(&file_a).expect("Create A failed");
    writeln!(fa, "Project A Data").expect("Write A failed");

    let dir_b = tempdir().expect("Failed to create tempdir B");
    let root_b = fs::canonicalize(dir_b.path()).expect("Canonicalize B failed");
    let file_b = root_b.join("project_b.txt");
    let mut fb = File::create(&file_b).expect("Create B failed");
    writeln!(fb, "Project B Data").expect("Write B failed");

    let mut mgr = WorkspaceManager::new();

    // 1. Authorize Workspace A
    mgr.set_workspace_root(&root_a).expect("Set root A failed");
    let read_a = mgr.read_text_file("project_a.txt").expect("Read A ok");
    assert!(read_a.contains("Project A"));

    // 2. Switch authorization to Workspace B
    mgr.set_workspace_root(&root_b).expect("Set root B failed");
    let read_b = mgr.read_text_file("project_b.txt").expect("Read B ok");
    assert!(read_b.contains("Project B"));

    // 3. Attempt to access Workspace A path while Workspace B is active -> REJECTED
    let outside_a_str = file_a.to_string_lossy().to_string();
    let cross_access_err = mgr.resolve_and_validate_path(&outside_a_str);
    assert!(matches!(cross_access_err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
}

#[test]
fn test_integration_clear_workspace_clears_authorization() {
    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");
    let test_file = root.join("file.txt");
    let mut f = File::create(&test_file).expect("Create file failed");
    writeln!(f, "Hello").expect("Write failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root).expect("Set root failed");
    assert!(mgr.get_workspace_info().is_ok());

    // Clear workspace
    mgr.clear_workspace();

    // After clearing, operations must return NoActiveWorkspace
    assert_eq!(mgr.get_workspace_info().unwrap_err(), WorkspaceError::NoActiveWorkspace);
    assert_eq!(mgr.resolve_and_validate_path("file.txt").unwrap_err(), WorkspaceError::NoActiveWorkspace);
    assert_eq!(mgr.read_text_file("file.txt").unwrap_err(), WorkspaceError::NoActiveWorkspace);
}

#[cfg(windows)]
#[test]
fn test_integration_windows_junction_reparse_escape_rejected() {
    use std::os::windows::fs::symlink_dir;

    let dir = tempdir().expect("Failed to create tempdir");
    let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

    let outside_dir = tempdir().expect("Failed to create outside tempdir");
    let outside_target = outside_dir.path().join("secrets");
    fs::create_dir_all(&outside_target).expect("Create outside secrets dir failed");
    let secret_file = outside_target.join("credentials.json");
    let mut f = File::create(&secret_file).expect("Create secret file failed");
    writeln!(f, "{{\"api_key\": \"secret_pass\"}}").expect("Write failed");

    let junction_point = root.join("junction_to_secrets");

    let created = {
        let status = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J", &junction_point.to_string_lossy(), &outside_target.to_string_lossy()])
            .output();
        match status {
            Ok(out) if out.status.success() => Ok(()),
            _ => symlink_dir(&outside_target, &junction_point),
        }
    };

    match created {
        Ok(_) => {
            let mut mgr = WorkspaceManager::new();
            mgr.set_workspace_root(&root).expect("Set root failed");

            let err = mgr.resolve_and_validate_path("junction_to_secrets/credentials.json");
            assert!(
                matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })),
                "Expected SecurityEscapeViolation for Windows junction escape, got: {:?}",
                err
            );

            let read_err = mgr.read_text_file("junction_to_secrets/credentials.json");
            assert!(
                matches!(read_err, Err(WorkspaceError::SecurityEscapeViolation { .. })),
                "Expected SecurityEscapeViolation on read_text_file, got: {:?}",
                read_err
            );
        }
        Err(e) => {
            panic!(
                "Failed to create Windows NTFS directory junction or directory symlink: {}. \
                 Reparse point escape security cannot be verified without a functional reparse point.",
                e
            );
        }
    }
}
