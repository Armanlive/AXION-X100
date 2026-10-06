use axion_core::vault::{SnapshotMetadata, SnapshotVault, VaultError};
use axion_core::workspace::WorkspaceManager;
use std::fs;
use tempfile::tempdir;

// ============================================================
// BASIC LIFECYCLE & INTEGRITY TESTS
// ============================================================

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

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None)
        .expect("Create vault failed");

    // 1. Create snapshot
    let snapshot = vault
        .create_snapshot(&mgr, "server.ts")
        .expect("Create snapshot failed");
    assert!(snapshot.file_existed);
    assert_eq!(snapshot.relative_path, "server.ts");
    assert_eq!(snapshot.size_bytes, original_bytes.len() as u64);
    assert!(!snapshot.hmac_signature.is_empty());

    // 2. Corrupt/change workspace file
    fs::write(&file_path, b"SYNTAX ERROR IN RUNTIME!").expect("Corrupt file failed");
    assert_eq!(fs::read(&file_path).unwrap(), b"SYNTAX ERROR IN RUNTIME!");

    // 3. Restore snapshot (R: exact bytes restored)
    let restored = vault
        .restore_snapshot(&mgr, &snapshot.id)
        .expect("Restore failed");
    assert_eq!(restored.id, snapshot.id);

    // 4. Verify original bytes restored on disk
    let restored_bytes = fs::read(&file_path).expect("Read restored file failed");
    assert_eq!(restored_bytes, original_bytes);
}

// S: corrupted payload fails closed
#[test]
fn test_integration_vault_integrity_failing_closed() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let file_path = ws_root.join("data.json");
    fs::write(&file_path, b"{\"valid\": true}").expect("Write original failed");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None)
        .expect("Create vault failed");

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

// T: snapshot from Workspace A rejected under Workspace B
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

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None)
        .expect("Create vault failed");

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

// V: nonexistent-original rollback remains unsupported and non-destructive
#[test]
fn test_integration_vault_nonexistent_file_handling() {
    let ws_dir = tempdir().expect("Failed to create ws_dir");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
    let vault_dir = tempdir().expect("Failed to create vault_dir");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("Set root failed");

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None)
        .expect("Create vault failed");

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

// ============================================================
// ADVERSARIAL TESTS A - V
// ============================================================

// A: vault root overlapping workspace rejected
#[test]
fn test_adversarial_a_vault_root_overlapping_workspace_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).expect("ws canonical");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).expect("set root");

    // Vault initialized directly at workspace root
    let vault = SnapshotVault::new_with_custom_root_for_test(&ws_root, None).unwrap();
    let err = vault.create_snapshot(&mgr, "any.txt");
    assert!(matches!(err, Err(VaultError::WorkspaceVaultOverlap { .. })));
}

// B: workspace inside vault / vault inside workspace dangerous overlap rejected
#[test]
fn test_adversarial_b_dangerous_overlap_rejected() {
    let parent_dir = tempdir().expect("parent");
    let parent_root = fs::canonicalize(parent_dir.path()).unwrap();

    let ws_nested = parent_root.join("ws_nested");
    fs::create_dir_all(&ws_nested).unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_nested).unwrap();

    // Vault is parent of workspace
    let vault_parent = SnapshotVault::new_with_custom_root_for_test(&parent_root, None).unwrap();
    let err = vault_parent.create_snapshot(&mgr, "test.txt");
    assert!(matches!(err, Err(VaultError::WorkspaceVaultOverlap { .. })));

    // Workspace is parent of vault
    let vault_nested = ws_nested.join("vault_nested");
    fs::create_dir_all(&vault_nested).unwrap();
    let vault_child = SnapshotVault::new_with_custom_root_for_test(&vault_nested, None).unwrap();
    let err2 = vault_child.create_snapshot(&mgr, "test.txt");
    assert!(matches!(
        err2,
        Err(VaultError::WorkspaceVaultOverlap { .. })
    ));
}

// C: vault root symlink redirection rejected (Unix)
#[cfg(unix)]
#[test]
fn test_adversarial_c_vault_root_symlink_redirection_rejected() {
    use std::os::unix::fs::symlink;
    let real_dir = tempdir().expect("real");
    let link_parent = tempdir().expect("link parent");
    let symlink_vault = link_parent.path().join("symlink_vault");
    symlink(real_dir.path(), &symlink_vault).expect("symlink");

    let vault_res = SnapshotVault::new_with_custom_root_for_test(&symlink_vault, None);
    assert!(matches!(vault_res, Err(VaultError::SecurityViolation(_))));
}

// D: snapshots directory symlink redirection rejected (Unix)
#[cfg(unix)]
#[test]
fn test_adversarial_d_snapshots_dir_symlink_redirection_rejected() {
    use std::os::unix::fs::symlink;
    let vault_dir = tempdir().expect("vault");
    let outside_dir = tempdir().expect("outside");

    let snapshots_symlink = vault_dir.path().join("snapshots");
    symlink(outside_dir.path(), &snapshots_symlink).expect("symlink");

    let vault_res = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None);
    assert!(matches!(vault_res, Err(VaultError::SecurityViolation(_))));
}

// E: tmp directory symlink redirection rejected (Unix)
#[cfg(unix)]
#[test]
fn test_adversarial_e_tmp_dir_symlink_redirection_rejected() {
    use std::os::unix::fs::symlink;
    let vault_dir = tempdir().expect("vault");
    let outside_dir = tempdir().expect("outside");

    let tmp_symlink = vault_dir.path().join("tmp");
    symlink(outside_dir.path(), &tmp_symlink).expect("symlink");

    let vault_res = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None);
    assert!(matches!(vault_res, Err(VaultError::SecurityViolation(_))));
}

// F: Windows vault junction/reparse redirection using established fail-hard setup
#[cfg(windows)]
#[test]
fn test_adversarial_f_windows_vault_junction_redirection_rejected() {
    use std::os::windows::fs::symlink_dir;
    let outside_dir = tempdir().expect("outside");
    let vault_dir = tempdir().expect("vault");
    let junction_snapshots = vault_dir.path().join("snapshots");

    let created = {
        let status = std::process::Command::new("cmd")
            .args([
                "/C",
                "mklink",
                "/J",
                &junction_snapshots.to_string_lossy(),
                &outside_dir.path().to_string_lossy(),
            ])
            .output();
        match status {
            Ok(out) if out.status.success() => Ok(()),
            _ => symlink_dir(outside_dir.path(), &junction_snapshots),
        }
    };

    match created {
        Ok(_) => {
            let vault_res = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None);
            assert!(
                matches!(vault_res, Err(VaultError::SecurityViolation(_))),
                "Expected SecurityViolation for Windows vault junction redirection, got: {:?}",
                vault_res
            );
        }
        Err(e) => {
            panic!(
                "Failed to create Windows NTFS directory junction: {}. Security cannot be verified without a functional reparse point.",
                e
            );
        }
    }
}

// G: metadata relative_path tampering rejected
#[test]
fn test_adversarial_g_metadata_relative_path_tampering_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("target.txt");
    fs::write(&file_path, b"Real content").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "target.txt").unwrap();

    // Tamper relative_path in .meta.json
    let meta_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.meta.json", snap.id));
    let mut meta: SnapshotMetadata =
        serde_json::from_str(&fs::read_to_string(&meta_file).unwrap()).unwrap();
    meta.relative_path = "hacked.txt".to_string();
    fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(
        err,
        Err(VaultError::MetadataAuthenticationFailed(_))
    ));
}

// H: metadata workspace binding tampering rejected
#[test]
fn test_adversarial_h_metadata_workspace_binding_tampering_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("target.txt");
    fs::write(&file_path, b"Real content").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "target.txt").unwrap();

    let meta_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.meta.json", snap.id));
    let mut meta: SnapshotMetadata =
        serde_json::from_str(&fs::read_to_string(&meta_file).unwrap()).unwrap();
    meta.workspace_root = "/etc/fake_workspace".to_string();
    fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(
        err,
        Err(VaultError::MetadataAuthenticationFailed(_))
    ));
}

// I: metadata payload hash tampering rejected
#[test]
fn test_adversarial_i_metadata_payload_hash_tampering_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("target.txt");
    fs::write(&file_path, b"Real content").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "target.txt").unwrap();

    let meta_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.meta.json", snap.id));
    let mut meta: SnapshotMetadata =
        serde_json::from_str(&fs::read_to_string(&meta_file).unwrap()).unwrap();
    meta.sha256_hash =
        Some("0000000000000000000000000000000000000000000000000000000000000000".to_string());
    fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(
        err,
        Err(VaultError::MetadataAuthenticationFailed(_))
    ));
}

// J: metadata size tampering rejected
#[test]
fn test_adversarial_j_metadata_size_tampering_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("target.txt");
    fs::write(&file_path, b"Real content").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "target.txt").unwrap();

    let meta_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.meta.json", snap.id));
    let mut meta: SnapshotMetadata =
        serde_json::from_str(&fs::read_to_string(&meta_file).unwrap()).unwrap();
    meta.size_bytes = 99999;
    fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(
        err,
        Err(VaultError::MetadataAuthenticationFailed(_))
    ));
}

// K: payload + hash metadata tampering still rejected because metadata MAC fails
#[test]
fn test_adversarial_k_payload_and_hash_tampering_rejected_by_mac() {
    use sha2::{Digest, Sha256};
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("target.txt");
    fs::write(&file_path, b"Real content").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "target.txt").unwrap();

    // Attacker modifies both payload file AND the hash inside metadata
    let attacker_bytes = b"Attacker injected payload";
    let attacker_hash = format!("{:x}", Sha256::digest(attacker_bytes));

    let data_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.data", snap.id));
    fs::write(&data_file, attacker_bytes).unwrap();

    let meta_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.meta.json", snap.id));
    let mut meta: SnapshotMetadata =
        serde_json::from_str(&fs::read_to_string(&meta_file).unwrap()).unwrap();
    meta.sha256_hash = Some(attacker_hash);
    meta.size_bytes = attacker_bytes.len() as u64;
    fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

    // Verification must fail closed because HMAC signature does not match
    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(
        err,
        Err(VaultError::MetadataAuthenticationFailed(_))
    ));
}

// L: unknown/random snapshot ID rejected
#[test]
fn test_adversarial_l_unknown_snapshot_id_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();

    // Invalid format ID
    let err1 = vault.restore_snapshot(&mgr, "../escaped_id");
    assert!(matches!(err1, Err(VaultError::InvalidSnapshotId(_))));

    // Valid format but nonexistent ID
    let err2 = vault.restore_snapshot(&mgr, "snap_0123456789abcdef0123456789abcdef");
    assert!(matches!(err2, Err(VaultError::SnapshotNotFound(_))));
}

// M: pre-existing .data collision cannot be overwritten
#[test]
fn test_adversarial_m_preexisting_data_collision_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("test.txt");
    fs::write(&file_path, b"Original").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "test.txt").unwrap();

    // Plant colliding data file with new ID
    let dummy_id = "snap_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let data_file = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.data", dummy_id));
    fs::write(&data_file, b"Pre-existing collision").unwrap();

    let mut coll_meta = snap.clone();
    coll_meta.id = dummy_id.to_string();

    let err = vault.persist_snapshot_atomic(&coll_meta, Some(b"New data"));
    assert!(matches!(err, Err(VaultError::SnapshotCollision(_))));
}

// N: pre-existing .meta.json collision cannot be overwritten
#[test]
fn test_adversarial_n_preexisting_meta_collision_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let file_path = ws_root.join("test.txt");
    fs::write(&file_path, b"Original").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "test.txt").unwrap();

    let err = vault.persist_snapshot_atomic(&snap, Some(b"Duplicate"));
    assert!(matches!(err, Err(VaultError::SnapshotCollision(_))));
}

// O: restore destination symlink attack rejected (Unix)
#[cfg(unix)]
#[test]
fn test_adversarial_o_restore_destination_symlink_attack_rejected() {
    use std::os::unix::fs::symlink;
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let outside_dir = tempdir().expect("outside");
    let victim_file = outside_dir.path().join("victim.env");
    fs::write(&victim_file, b"VICTIM=untouched").unwrap();

    let file_path = ws_root.join("app.env");
    fs::write(&file_path, b"ORIGINAL=safe").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault.create_snapshot(&mgr, "app.env").unwrap();

    // Attacker replaces app.env in workspace with symlink to outside victim file
    fs::remove_file(&file_path).unwrap();
    symlink(&victim_file, &file_path).unwrap();

    // Restore must reject the escaping symlink target
    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(err, Err(VaultError::SecurityViolation(_))));

    // Outside victim file must remain untouched
    assert_eq!(fs::read(&victim_file).unwrap(), b"VICTIM=untouched");
}

// P: restore parent symlink/junction attack rejected (Unix)
#[cfg(unix)]
#[test]
fn test_adversarial_p_restore_parent_symlink_attack_rejected() {
    use std::os::unix::fs::symlink;
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let nested_dir = ws_root.join("packages").join("core");
    fs::create_dir_all(&nested_dir).unwrap();
    let file_path = nested_dir.join("index.ts");
    fs::write(&file_path, b"export const SAFE = 1;").unwrap();

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();
    let snap = vault
        .create_snapshot(&mgr, "packages/core/index.ts")
        .unwrap();

    // Attacker replaces 'packages' with a symlink to outside dir
    let outside_dir = tempdir().expect("outside");
    fs::remove_dir_all(ws_root.join("packages")).unwrap();
    symlink(outside_dir.path(), ws_root.join("packages")).unwrap();

    // Restore must detect parent directory is a symlink and fail closed
    let err = vault.restore_snapshot(&mgr, &snap.id);
    assert!(matches!(err, Err(VaultError::SecurityViolation(_))));
}

// Q: destination/parent directory validation
#[test]
fn test_adversarial_q_parent_traversal_rejected() {
    let ws_dir = tempdir().expect("ws");
    let ws_root = fs::canonicalize(ws_dir.path()).unwrap();
    let vault_dir = tempdir().expect("vault");

    let mut mgr = WorkspaceManager::new();
    mgr.set_workspace_root(&ws_root).unwrap();

    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();

    let err = vault.create_snapshot(&mgr, "../outside.txt");
    assert!(matches!(err, Err(VaultError::SecurityViolation(_))));
}

// U: incomplete/orphan payload is never considered a valid snapshot
#[test]
fn test_adversarial_u_orphan_payload_not_valid_snapshot() {
    let vault_dir = tempdir().expect("vault");
    let vault = SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).unwrap();

    // Write orphan data file into snapshots/ without any metadata file
    let orphan_id = "snap_11112222333344445555666677778888";
    let data_path = vault_dir
        .path()
        .join("snapshots")
        .join(format!("{}.data", orphan_id));
    fs::write(&data_path, b"Orphan data").unwrap();

    // 1. get_snapshot_metadata fails
    let get_err = vault.get_snapshot_metadata(orphan_id);
    assert!(matches!(get_err, Err(VaultError::SnapshotNotFound(_))));

    // 2. list_snapshots does not include orphan
    let list = vault.list_snapshots(None).unwrap();
    assert!(list.iter().all(|s| s.id != orphan_id));
}
