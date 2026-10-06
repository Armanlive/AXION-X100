use crate::workspace::{WorkspaceError, WorkspaceManager};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum VaultError {
    #[error("No active workspace is currently selected")]
    NoActiveWorkspace,

    #[error("Snapshot not found: {0}")]
    SnapshotNotFound(String),

    #[error("Invalid snapshot ID: {0}")]
    InvalidSnapshotId(String),

    #[error("Snapshot '{id}' belongs to workspace '{expected_root}', but active workspace is '{active_root}'")]
    WorkspaceMismatch {
        id: String,
        expected_root: String,
        active_root: String,
    },

    #[error("Integrity check failed for snapshot '{id}': expected SHA-256 {expected}, computed {computed}")]
    IntegrityMismatch {
        id: String,
        expected: String,
        computed: String,
    },

    #[error("Rollback for newly-created files (originally non-existent) is not implemented yet in Phase 2 Step 1")]
    NonExistentFileRollbackNotImplemented,

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Target is a directory, expected a regular file: {0}")]
    IsADirectory(String),

    #[error("Vault filesystem IO error: {0}")]
    IoError(String),
}

impl From<WorkspaceError> for VaultError {
    fn from(err: WorkspaceError) -> Self {
        match err {
            WorkspaceError::NoActiveWorkspace => VaultError::NoActiveWorkspace,
            WorkspaceError::SecurityEscapeViolation { target, root } => {
                VaultError::SecurityViolation(format!(
                    "Path '{}' escapes canonical workspace root '{}'",
                    target, root
                ))
            }
            WorkspaceError::IsADirectory(path) => VaultError::IsADirectory(path),
            other => VaultError::IoError(other.to_string()),
        }
    }
}

/// Metadata describing a single workspace snapshot stored in the native vault.
///
/// Security note: Snapshots in this atomic step are stored in an application-controlled,
/// protected local filesystem directory in plaintext with cryptographic SHA-256 integrity
/// verification. They are NOT encrypted.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotMetadata {
    pub id: String,
    pub workspace_root: String,
    pub relative_path: String,
    pub file_existed: bool,
    pub created_at_ms: u64,
    pub size_bytes: u64,
    pub sha256_hash: Option<String>,
}

/// Native Snapshot Vault owned by the Tauri/Rust backend.
///
/// The vault lives in an application-controlled local directory completely isolated
/// from user workspaces.
pub struct SnapshotVault {
    vault_root: PathBuf,
}

impl SnapshotVault {
    /// Creates a new `SnapshotVault` with storage anchored at `vault_root`.
    pub fn new<P: AsRef<Path>>(vault_root: P) -> Result<Self, VaultError> {
        let root = vault_root.as_ref().to_path_buf();
        let snapshots_dir = root.join("snapshots");
        let tmp_dir = root.join("tmp");

        fs::create_dir_all(&snapshots_dir)
            .map_err(|e| VaultError::IoError(format!("Failed to create snapshots directory: {}", e)))?;
        fs::create_dir_all(&tmp_dir)
            .map_err(|e| VaultError::IoError(format!("Failed to create tmp directory: {}", e)))?;

        Ok(Self { vault_root: root })
    }

    /// Returns the canonical path to the vault storage root.
    pub fn vault_root(&self) -> &Path {
        &self.vault_root
    }

    /// Captures a pre-mutation snapshot of a single workspace file.
    ///
    /// Validates the path strictly within the active workspace root using Phase-1 boundary rules.
    /// Handles both existing files and non-existent files (for future creation rollback).
    pub fn create_snapshot(
        &self,
        workspace_manager: &WorkspaceManager,
        relative_path: &str,
    ) -> Result<SnapshotMetadata, VaultError> {
        let active_root = workspace_manager.get_active_root()?;
        let canonical_root_str = active_root.to_string_lossy().to_string();

        let trimmed_rel = relative_path.trim().replace('\\', "/");
        if trimmed_rel.is_empty() || trimmed_rel == "." {
            return Err(VaultError::IsADirectory(relative_path.to_string()));
        }

        // Validate path against active workspace boundary using authoritative Phase-1 logic
        let validation_res = workspace_manager.resolve_and_validate_path(&trimmed_rel);

        let (file_existed, file_bytes, sha256_hash, size_bytes) = match validation_res {
            Ok(resolved_path) => {
                // File exists on disk and is within canonical root
                if resolved_path.is_dir() {
                    return Err(VaultError::IsADirectory(trimmed_rel));
                }

                let bytes = fs::read(&resolved_path)
                    .map_err(|e| VaultError::IoError(format!("Failed to read source file: {}", e)))?;
                let hash = format!("{:x}", Sha256::digest(&bytes));
                let len = bytes.len() as u64;

                (true, Some(bytes), Some(hash), len)
            }
            Err(WorkspaceError::FileNotFound(_)) => {
                // File does NOT exist, but lexical traversal validation confirmed it is within boundary
                (false, None, None, 0u64)
            }
            Err(WorkspaceError::SecurityEscapeViolation { target, root }) => {
                return Err(VaultError::SecurityViolation(format!(
                    "Path '{}' escapes canonical workspace root '{}'",
                    target, root
                )));
            }
            Err(e) => return Err(VaultError::from(e)),
        };

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Generate unique opaque snapshot ID
        let snapshot_id = Self::generate_snapshot_id(now_ms);

        let metadata = SnapshotMetadata {
            id: snapshot_id.clone(),
            workspace_root: canonical_root_str,
            relative_path: trimmed_rel,
            file_existed,
            created_at_ms: now_ms,
            size_bytes,
            sha256_hash,
        };

        // Persist transactionally: write to tmp -> sync -> rename
        self.persist_snapshot_atomic(&metadata, file_bytes.as_deref())?;

        Ok(metadata)
    }

    /// Retrieves trusted snapshot metadata by ID.
    pub fn get_snapshot_metadata(&self, snapshot_id: &str) -> Result<SnapshotMetadata, VaultError> {
        Self::validate_snapshot_id(snapshot_id)?;
        let meta_file = self.vault_root.join("snapshots").join(format!("{}.meta.json", snapshot_id));

        if !meta_file.exists() {
            return Err(VaultError::SnapshotNotFound(snapshot_id.to_string()));
        }

        let content = fs::read_to_string(&meta_file)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshot metadata: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| VaultError::IoError(format!("Failed to parse snapshot metadata: {}", e)))
    }

    /// Lists snapshot metadata, optionally filtered by workspace canonical root.
    pub fn list_snapshots(
        &self,
        workspace_root_filter: Option<&str>,
    ) -> Result<Vec<SnapshotMetadata>, VaultError> {
        let snapshots_dir = self.vault_root.join("snapshots");
        if !snapshots_dir.exists() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        let entries = fs::read_dir(&snapshots_dir)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshots directory: {}", e)))?;

        for entry_res in entries {
            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".meta.json") {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(meta) = serde_json::from_str::<SnapshotMetadata>(&content) {
                        if let Some(filter) = workspace_root_filter {
                            if meta.workspace_root != filter {
                                continue;
                            }
                        }
                        results.push(meta);
                    }
                }
            }
        }

        // Sort descending by timestamp (newest first)
        results.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        Ok(results)
    }

    /// Restores a snapshot back into the active workspace.
    ///
    /// Revalidates workspace authorization, verifies SHA-256 cryptographic integrity,
    /// checks containment against the active boundary, and performs atomic replacement.
    pub fn restore_snapshot(
        &self,
        workspace_manager: &WorkspaceManager,
        snapshot_id: &str,
    ) -> Result<SnapshotMetadata, VaultError> {
        Self::validate_snapshot_id(snapshot_id)?;
        let metadata = self.get_snapshot_metadata(snapshot_id)?;

        let active_root = workspace_manager.get_active_root()?;
        let canonical_active_root = fs::canonicalize(active_root)
            .map_err(|e| VaultError::IoError(format!("Failed to canonicalize active root: {}", e)))?;

        // 1. Workspace binding check: Reject snapshots belonging to another workspace
        let expected_root_path = PathBuf::from(&metadata.workspace_root);
        let canonical_expected_root = if expected_root_path.exists() {
            fs::canonicalize(&expected_root_path).unwrap_or(expected_root_path)
        } else {
            expected_root_path
        };

        if canonical_active_root != canonical_expected_root {
            return Err(VaultError::WorkspaceMismatch {
                id: snapshot_id.to_string(),
                expected_root: metadata.workspace_root.clone(),
                active_root: canonical_active_root.to_string_lossy().to_string(),
            });
        }

        // 2. Non-existent file support check
        if !metadata.file_existed {
            return Err(VaultError::NonExistentFileRollbackNotImplemented);
        }

        // 3. Read stored snapshot data from vault
        let data_file = self.vault_root.join("snapshots").join(format!("{}.data", snapshot_id));
        if !data_file.exists() {
            return Err(VaultError::IoError(format!(
                "Snapshot content payload missing for ID: {}",
                snapshot_id
            )));
        }

        let stored_bytes = fs::read(&data_file)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshot data: {}", e)))?;

        // 4. Verify cryptographic SHA-256 integrity (FAIL CLOSED on mismatch)
        let computed_hash = format!("{:x}", Sha256::digest(&stored_bytes));
        match metadata.sha256_hash {
            Some(ref expected_hash) => {
                if &computed_hash != expected_hash {
                    return Err(VaultError::IntegrityMismatch {
                        id: snapshot_id.to_string(),
                        expected: expected_hash.clone(),
                        computed: computed_hash,
                    });
                }
            }
            None => {
                return Err(VaultError::IntegrityMismatch {
                    id: snapshot_id.to_string(),
                    expected: "SHA-256 hash in metadata".to_string(),
                    computed: "No hash recorded".to_string(),
                });
            }
        }

        // 5. Revalidate destination path against the current active workspace boundary
        let target_path = Self::resolve_and_validate_restore_destination(
            active_root,
            &metadata.relative_path,
        )?;

        // Ensure parent directory exists in workspace
        let parent = target_path.parent().ok_or_else(|| {
            VaultError::SecurityViolation("Target path has no valid parent directory".to_string())
        })?;
        fs::create_dir_all(parent)
            .map_err(|e| VaultError::IoError(format!("Failed to create parent directory: {}", e)))?;

        // 6. Safe atomic replacement: write to temp file in destination directory, sync, atomic rename
        let temp_filename = format!(".axion_restore_{}.tmp", snapshot_id);
        let temp_path = parent.join(&temp_filename);

        // Verify temp file does not escape boundary
        if !temp_path.starts_with(active_root) {
            return Err(VaultError::SecurityViolation(
                "Restore temporary file escapes workspace boundary".to_string(),
            ));
        }

        let write_res = (|| -> Result<(), VaultError> {
            let mut file = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(&temp_path)
                .map_err(|e| VaultError::IoError(format!("Failed to create temp restore file: {}", e)))?;

            file.write_all(&stored_bytes)
                .map_err(|e| VaultError::IoError(format!("Failed to write temp restore file: {}", e)))?;
            file.sync_all()
                .map_err(|e| VaultError::IoError(format!("Failed to sync temp restore file: {}", e)))?;
            Ok(())
        })();

        if let Err(e) = write_res {
            let _ = fs::remove_file(&temp_path);
            return Err(e);
        }

        // Atomic replace via rename
        if let Err(e) = fs::rename(&temp_path, &target_path) {
            let _ = fs::remove_file(&temp_path);
            return Err(VaultError::IoError(format!(
                "Failed to atomically commit restored file: {}",
                e
            )));
        }

        // Verify that restored file exists and matches size
        let verify_meta = fs::metadata(&target_path)
            .map_err(|e| VaultError::IoError(format!("Failed to verify restored file: {}", e)))?;
        if verify_meta.len() != metadata.size_bytes {
            return Err(VaultError::IoError(format!(
                "Restored file size mismatch: expected {} bytes, found {}",
                metadata.size_bytes,
                verify_meta.len()
            )));
        }

        Ok(metadata)
    }

    /// Transactionally persists snapshot data and metadata.
    fn persist_snapshot_atomic(
        &self,
        meta: &SnapshotMetadata,
        content_bytes: Option<&[u8]>,
    ) -> Result<(), VaultError> {
        let snapshots_dir = self.vault_root.join("snapshots");
        let tmp_dir = self.vault_root.join("tmp");

        let tmp_data_path = tmp_dir.join(format!("{}.data.tmp", meta.id));
        let tmp_meta_path = tmp_dir.join(format!("{}.meta.json.tmp", meta.id));

        let final_data_path = snapshots_dir.join(format!("{}.data", meta.id));
        let final_meta_path = snapshots_dir.join(format!("{}.meta.json", meta.id));

        // Safety: ensure we never overwrite an existing snapshot ID
        if final_meta_path.exists() {
            return Err(VaultError::IoError(format!(
                "Snapshot ID '{}' collision: snapshot already exists",
                meta.id
            )));
        }

        // 1. Write content payload if file existed
        if let Some(bytes) = content_bytes {
            let write_data_res = (|| -> Result<(), VaultError> {
                let mut f = File::create(&tmp_data_path)
                    .map_err(|e| VaultError::IoError(format!("Failed to create tmp snapshot data: {}", e)))?;
                f.write_all(bytes)
                    .map_err(|e| VaultError::IoError(format!("Failed to write tmp snapshot data: {}", e)))?;
                f.sync_all()
                    .map_err(|e| VaultError::IoError(format!("Failed to sync tmp snapshot data: {}", e)))?;
                Ok(())
            })();

            if let Err(e) = write_data_res {
                let _ = fs::remove_file(&tmp_data_path);
                return Err(e);
            }
        }

        // 2. Write metadata JSON
        let write_meta_res = (|| -> Result<(), VaultError> {
            let meta_json = serde_json::to_string_pretty(meta)
                .map_err(|e| VaultError::IoError(format!("Failed to serialize metadata: {}", e)))?;
            let mut f = File::create(&tmp_meta_path)
                .map_err(|e| VaultError::IoError(format!("Failed to create tmp snapshot meta: {}", e)))?;
            f.write_all(meta_json.as_bytes())
                .map_err(|e| VaultError::IoError(format!("Failed to write tmp snapshot meta: {}", e)))?;
            f.sync_all()
                .map_err(|e| VaultError::IoError(format!("Failed to sync tmp snapshot meta: {}", e)))?;
            Ok(())
        })();

        if let Err(e) = write_meta_res {
            let _ = fs::remove_file(&tmp_data_path);
            let _ = fs::remove_file(&tmp_meta_path);
            return Err(e);
        }

        // 3. Atomic commit via rename
        if content_bytes.is_some() {
            if let Err(e) = fs::rename(&tmp_data_path, &final_data_path) {
                let _ = fs::remove_file(&tmp_data_path);
                let _ = fs::remove_file(&tmp_meta_path);
                return Err(VaultError::IoError(format!(
                    "Failed to commit snapshot data file: {}",
                    e
                )));
            }
        }

        if let Err(e) = fs::rename(&tmp_meta_path, &final_meta_path) {
            if content_bytes.is_some() {
                let _ = fs::remove_file(&final_data_path);
            }
            let _ = fs::remove_file(&tmp_meta_path);
            return Err(VaultError::IoError(format!(
                "Failed to commit snapshot metadata file: {}",
                e
            )));
        }

        Ok(())
    }

    /// Strict validation of restore target within workspace boundary.
    fn resolve_and_validate_restore_destination(
        root: &Path,
        relative_path: &str,
    ) -> Result<PathBuf, VaultError> {
        let trimmed = relative_path.trim();
        if trimmed.is_empty() || trimmed == "." {
            return Err(VaultError::IsADirectory(relative_path.to_string()));
        }

        let rel = Path::new(trimmed);
        if rel.is_absolute() {
            return Err(VaultError::SecurityViolation(format!(
                "Absolute destination paths rejected: '{}'",
                relative_path
            )));
        }

        // Normalize lexical components to detect traversal
        let mut normalized = root.to_path_buf();
        for component in rel.components() {
            match component {
                Component::Prefix(_) | Component::RootDir => {
                    return Err(VaultError::SecurityViolation(format!(
                        "Root/prefix component rejected in relative path: '{}'",
                        relative_path
                    )));
                }
                Component::CurDir => {}
                Component::ParentDir => {
                    if !normalized.pop() || !normalized.starts_with(root) {
                        return Err(VaultError::SecurityViolation(format!(
                            "Path traversal rejected: '{}'",
                            relative_path
                        )));
                    }
                }
                Component::Normal(c) => normalized.push(c),
            }
        }

        if !normalized.starts_with(root) {
            return Err(VaultError::SecurityViolation(format!(
                "Destination '{}' escapes root '{}'",
                relative_path,
                root.display()
            )));
        }

        // If target already exists on disk, check symlink/canonical escape
        if normalized.exists() {
            let canonical = fs::canonicalize(&normalized)
                .map_err(|e| VaultError::IoError(format!("Failed to canonicalize destination: {}", e)))?;
            if !canonical.starts_with(root) {
                return Err(VaultError::SecurityViolation(format!(
                    "Existing destination symlink escapes workspace root: '{}'",
                    relative_path
                )));
            }
            if canonical.is_dir() {
                return Err(VaultError::IsADirectory(relative_path.to_string()));
            }
        }

        Ok(normalized)
    }

    /// Sanitizes and validates snapshot IDs against injection and traversal attacks.
    fn validate_snapshot_id(id: &str) -> Result<(), VaultError> {
        if id.is_empty() || id.len() > 128 {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        if id.contains("..") {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        Ok(())
    }

    /// Generates a collision-resistant opaque snapshot ID.
    fn generate_snapshot_id(timestamp_ms: u64) -> String {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(1);
        let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        format!("snap_{}_{}_{:06x}", timestamp_ms, pid, seq)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_snapshot_normal_file_and_exact_bytes_preserved() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let test_file = ws_root.join("config.toml");
        let original_data = b"[package]\nname = \"axion-test\"\nversion = \"0.1.0\"\n";
        fs::write(&test_file, original_data).expect("Write test file failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // 1. Snapshot normal file inside workspace
        let meta = vault
            .create_snapshot(&mgr, "config.toml")
            .expect("Create snapshot failed");

        assert!(meta.file_existed);
        assert_eq!(meta.relative_path, "config.toml");
        assert_eq!(meta.size_bytes, original_data.len() as u64);
        assert_eq!(meta.workspace_root, ws_root.to_string_lossy());
        assert!(meta.sha256_hash.is_some());

        // 2. Exact original bytes preserved in vault
        let vault_data_file = vault_dir.path().join("snapshots").join(format!("{}.data", meta.id));
        let stored_bytes = fs::read(&vault_data_file).expect("Read stored bytes failed");
        assert_eq!(stored_bytes, original_data);

        // Metadata JSON preserved
        let loaded_meta = vault.get_snapshot_metadata(&meta.id).expect("Get meta failed");
        assert_eq!(loaded_meta, meta);
    }

    #[test]
    fn test_snapshot_traversal_request_rejected() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // Traversal attempts
        let err1 = vault.create_snapshot(&mgr, "../outside.txt");
        assert!(matches!(err1, Err(VaultError::SecurityViolation(_))));

        let err2 = vault.create_snapshot(&mgr, "sub/../../outside.txt");
        assert!(matches!(err2, Err(VaultError::SecurityViolation(_))));
    }

    #[test]
    fn test_snapshot_absolute_outside_path_rejected() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let other_dir = tempdir().expect("Failed to create other_dir");
        let outside_file = other_dir.path().join("outside.txt");
        fs::write(&outside_file, b"secret").expect("Write failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        let outside_str = outside_file.to_string_lossy().to_string();
        let err = vault.create_snapshot(&mgr, &outside_str);
        assert!(matches!(err, Err(VaultError::SecurityViolation(_))));
    }

    #[cfg(unix)]
    #[test]
    fn test_snapshot_symlink_escape_rejected_unix() {
        use std::os::unix::fs::symlink;

        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let outside_dir = tempdir().expect("Failed to create outside_dir");
        let outside_file = outside_dir.path().join("secret.key");
        fs::write(&outside_file, b"PRIVATE_KEY").expect("Write failed");

        // Symlink inside workspace pointing to outside target
        let link_path = ws_root.join("symlink_escape.key");
        symlink(&outside_file, &link_path).expect("Create symlink failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        let err = vault.create_snapshot(&mgr, "symlink_escape.key");
        assert!(matches!(err, Err(VaultError::SecurityViolation(_))));
    }

    #[cfg(windows)]
    #[test]
    fn test_snapshot_windows_junction_escape_rejected() {
        use std::os::windows::fs::symlink_dir;

        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let outside_dir = tempdir().expect("Failed to create outside_dir");
        let outside_target = outside_dir.path().join("secrets");
        fs::create_dir_all(&outside_target).expect("Create outside dir failed");
        let secret_file = outside_target.join("keys.json");
        fs::write(&secret_file, b"TOP_SECRET").expect("Write failed");

        let junction_point = ws_root.join("junction_escape");

        let created = {
            let status = std::process::Command::new("cmd")
                .args([
                    "/C",
                    "mklink",
                    "/J",
                    &junction_point.to_string_lossy(),
                    &outside_target.to_string_lossy(),
                ])
                .output();
            match status {
                Ok(out) if out.status.success() => Ok(()),
                _ => symlink_dir(&outside_target, &junction_point),
            }
        };

        match created {
            Ok(_) => {
                let mut mgr = WorkspaceManager::new();
                mgr.set_workspace_root(&ws_root).expect("Set root failed");

                let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

                let err = vault.create_snapshot(&mgr, "junction_escape/keys.json");
                assert!(
                    matches!(err, Err(VaultError::SecurityViolation(_))),
                    "Expected SecurityViolation for Windows junction escape, got: {:?}",
                    err
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

    #[test]
    fn test_snapshot_directory_rejected() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let sub_dir = ws_root.join("src");
        fs::create_dir_all(&sub_dir).expect("Create sub_dir failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        let err1 = vault.create_snapshot(&mgr, "src");
        assert!(matches!(err1, Err(VaultError::IsADirectory(_))));

        let err2 = vault.create_snapshot(&mgr, ".");
        assert!(matches!(err2, Err(VaultError::IsADirectory(_))));

        let err3 = vault.create_snapshot(&mgr, "");
        assert!(matches!(err3, Err(VaultError::IsADirectory(_))));
    }

    #[test]
    fn test_restore_unknown_snapshot_id_rejected() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        let err = vault.restore_snapshot(&mgr, "snap_nonexistent_12345");
        assert!(matches!(err, Err(VaultError::SnapshotNotFound(_))));
    }

    #[test]
    fn test_restore_corrupted_snapshot_fails_closed() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let test_file = ws_root.join("important.txt");
        let original_data = b"Original pristine text";
        fs::write(&test_file, original_data).expect("Write failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        let meta = vault
            .create_snapshot(&mgr, "important.txt")
            .expect("Create snapshot failed");

        // Mutate target file in workspace
        fs::write(&test_file, b"Mutated in workspace").expect("Mutate failed");

        // Deliberately corrupt the snapshot payload in the vault (e.g. bit rot / disk corruption)
        let data_file = vault_dir.path().join("snapshots").join(format!("{}.data", meta.id));
        fs::write(&data_file, b"Corrupted corrupted text").expect("Corrupt payload failed");

        // Restore MUST fail closed with IntegrityMismatch
        let err = vault.restore_snapshot(&mgr, &meta.id);
        assert!(matches!(err, Err(VaultError::IntegrityMismatch { .. })));

        // Critical safety verification: target file in workspace was NOT overwritten with corrupted bytes!
        let workspace_content = fs::read(&test_file).expect("Read workspace file failed");
        assert_eq!(workspace_content, b"Mutated in workspace");
    }

    #[test]
    fn test_snapshot_workspace_a_cannot_be_restored_into_workspace_b() {
        let ws_a = tempdir().expect("Failed to create ws_a");
        let root_a = fs::canonicalize(ws_a.path()).expect("Canonicalize A failed");

        let ws_b = tempdir().expect("Failed to create ws_b");
        let root_b = fs::canonicalize(ws_b.path()).expect("Canonicalize B failed");

        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let file_a = root_a.join("main.rs");
        fs::write(&file_a, b"fn main_a() {}").expect("Write A failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root_a).expect("Set root A failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // Snapshot created in Workspace A
        let meta_a = vault
            .create_snapshot(&mgr, "main.rs")
            .expect("Snapshot A failed");

        // Switch active workspace to Workspace B
        mgr.set_workspace_root(&root_b).expect("Set root B failed");

        // Attempt restore of Workspace A snapshot into Workspace B -> MUST BE REJECTED
        let err = vault.restore_snapshot(&mgr, &meta_a.id);
        assert!(matches!(err, Err(VaultError::WorkspaceMismatch { .. })));

        // Ensure file was not created/restored in Workspace B
        assert!(!root_b.join("main.rs").exists());
    }

    #[test]
    fn test_failed_snapshot_persistence_fails_closed() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let test_file = ws_root.join("data.txt");
        fs::write(&test_file, b"content").expect("Write failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // Remove the tmp directory or make snapshots dir invalid to simulate write failure
        let tmp_dir = vault_dir.path().join("tmp");
        fs::remove_dir_all(&tmp_dir).expect("Remove tmp failed");
        // Create a regular file where tmp directory was, causing write to fail
        File::create(&tmp_dir).expect("Create blocking file failed");

        let err = vault.create_snapshot(&mgr, "data.txt");
        assert!(matches!(err, Err(VaultError::IoError(_))));

        // Verify no snapshots are reported in vault
        let list = vault.list_snapshots(None).expect("List failed");
        assert_eq!(list.len(), 0);
    }

    #[test]
    fn test_successful_restore_reproduces_original_bytes_exactly() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let nested_dir = ws_root.join("src").join("engine");
        fs::create_dir_all(&nested_dir).expect("Create nested dir failed");
        let test_file = nested_dir.join("core.rs");

        let original_data = b"// Phase 2 Pristine Code\npub fn execute() -> bool { true }\n";
        fs::write(&test_file, original_data).expect("Write original file failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // 1. Capture snapshot
        let meta = vault
            .create_snapshot(&mgr, "src/engine/core.rs")
            .expect("Create snapshot failed");

        // 2. Overwrite file with new / buggy content in workspace
        let modified_data = b"// Mutated content with bugs!\npub fn execute() -> bool { false }\n";
        fs::write(&test_file, modified_data).expect("Write mutated file failed");
        assert_eq!(fs::read(&test_file).unwrap(), modified_data);

        // 3. Perform 1-click restore
        let restored_meta = vault
            .restore_snapshot(&mgr, &meta.id)
            .expect("Restore snapshot failed");
        assert_eq!(restored_meta.id, meta.id);

        // 4. Verify disk content matches original bytes exactly
        let disk_content = fs::read(&test_file).expect("Read restored file failed");
        assert_eq!(disk_content, original_data);
    }

    #[test]
    fn test_non_existent_file_snapshot_and_rollback_error() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // 1. Snapshot a file that does not exist yet (pre-creation snapshot)
        let meta = vault
            .create_snapshot(&mgr, "new_file.txt")
            .expect("Non-existent snapshot should succeed");

        assert!(!meta.file_existed);
        assert_eq!(meta.size_bytes, 0);
        assert!(meta.sha256_hash.is_none());
        assert_eq!(meta.relative_path, "new_file.txt");

        // 2. Rollback for newly-created files returns truthful unimplemented error in Phase 2 Step 1
        let restore_err = vault.restore_snapshot(&mgr, &meta.id);
        assert_eq!(
            restore_err,
            Err(VaultError::NonExistentFileRollbackNotImplemented)
        );
    }

    #[test]
    fn test_snapshot_id_path_injection_rejected() {
        let ws_dir = tempdir().expect("Failed to create ws_dir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("Canonicalize failed");
        let vault_dir = tempdir().expect("Failed to create vault_dir");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("Set root failed");

        let vault = SnapshotVault::new(vault_dir.path()).expect("Create vault failed");

        // Injection attacks via snapshot ID
        let err1 = vault.get_snapshot_metadata("../../etc/passwd");
        assert!(matches!(err1, Err(VaultError::InvalidSnapshotId(_))));

        let err2 = vault.restore_snapshot(&mgr, "snap/evil/path");
        assert!(matches!(err2, Err(VaultError::InvalidSnapshotId(_))));

        let err3 = vault.get_snapshot_metadata("");
        assert!(matches!(err3, Err(VaultError::InvalidSnapshotId(_))));
    }
}
