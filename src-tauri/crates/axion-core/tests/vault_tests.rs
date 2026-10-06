use axion_core::vault::{SnapshotVault, VaultError};
use axion_core::workspace::WorkspaceManager;
use std::fs;
use tempfile::tempdir;

#[test]
fn test_integration_vault_lifecycle_create_and_restore() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let file_path = ws_root.join("server.ts");
    let original_bytes = b"import express from 'express';\nconst app = express();\n";
    fs::write(&file_path, original_bytes).expect("Write original failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

    // 1. Create snapshot
    let snapshot = vault
        .create_snapshot(&mgr, "server.ts")
        .expect("Create snapshot failed");
    assert!(snapshot.file_existed);
    assert_eq!(snapshot.relative_path, "server.ts");
    assert_eq!(snapshot.size_bytes, original_bytes.len() as u64);

    // 2. Corrupt/change workspace file
    fs::write(&file_path, b"SYNTAX ERROR IN RUNTIME!").expect("Corrupt file failed");
    assert_eq!(fs::read(&file_path).unwrap(), b"SYNTAX ERROR IN RUNTIME!");

    // 3. Restore snapshot
    let restored = vault
        .restore_snapshot(&mgr, &snapshot.id)
        .expect("Restore failed");
    assert_eq!(restored.id, snapshot.id);

    // 4. Verify original bytes restored on disk
    let restored_bytes = fs::read(&file_path).expect("Read restored file failed");
    assert_eq!(restored_bytes, original_bytes);
}

#[test]
fn test_integration_vault_integrity_failing_closed() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let file_path = ws_root.join("data.json");
    fs::write(&file_path, b"{\"valid\": true}").expect("Write original failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

    let snapshot = vault
        .create_snapshot(&mgr, "data.json")
        .expect("Create snapshot failed");

    // Tamper with snapshot data file in vault
    let vault_payload = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.data", snapshot.id));
    fs::write(&vault_payload, b"{\"tampered\": true}").expect("Tamper payload failed");

    // Restore must fail closed
    let err = vault.restore_snapshot(&mgr, &snapshot.id);
    assert!(matches!(err, Err(VaultError::IntegrityMismatch { .. })));

    // Workspace file should remain untouched
    assert_eq!(fs::read(&file_path).unwrap(), b"{\"valid\": true}");
}

#[test]
fn test_integration_vault_cross_workspace_isolation() {
    let ws_a = tempdir().expect("Failed to create ws_a");
    let root_a = fs::canonicalize(ws_a.path()).expect("Canonicalize A failed");

    let ws_b = tempdir().expect("Failed to create ws_b");
    let root_b = fs::canonicalize(ws_b.path()).expect("Canonicalize B failed");

    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let file_a = root_a.join("isolated.txt");
    fs::write(&file_a, b"Workspace A isolated data").expect("Write A failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&root_a).expect("Set root A failed");

    let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

    let snap_a = vault
        .create_snapshot(&mgr, "isolated.txt")
        .expect("Snapshot A failed");

    // Switch workspace to B
    mgr.set_workspace_root(&root_b).expect("Set root B failed");

    // Cross-workspace restore must fail
    let err = vault.restore_snapshot(&mgr, &snap_a.id);
    assert!(matches!(err, Err(VaultError::WorkspaceMismatch { .. })));

    // Target file was NOT written into workspace B
    assert!(!root_b.join("isolated.txt").exists());
}

#[test]
fn test_integration_vault_directory_target_rejected() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let dir_path = ws_root.join("packages");
    fs::create_dir_all(&dir_path).expect("Create dir failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

    let err = vault.create_snapshot(&mgr, "packages");
    assert!(matches!(err, Err(VaultError::IsADirectory(_))));
}

#[test]
fn test_integration_vault_nonexistent_file_handling() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

    let snap = vault
        .create_snapshot(&mgr, "future_file.ts")
        .expect("Snapshot of non-existent file should succeed");

    assert!(!snap.file_existed);
    assert_eq!(snap.size_bytes, 0);
    assert!(snap.sha256_hash.is_none());

    let restore_err = vault.restore_snapshot(&mgr, &snap.id);
    assert_eq!(
        restore_err,
        Err(VaultError::NonExistentFileRollbackNotImplemented)
    );
}
