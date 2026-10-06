use crate::workspace::{WorkspaceError, WorkspaceManager};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum VaultError {
    #[error("No active workspace is currently selected")]
    NoActiveWorkspace,

    #[error("Snapshot not found: {0}")]
    SnapshotNotFound(String),

    #[error("Invalid snapshot ID: {0}")]
    InvalidSnapshotId(String),

    #[error("Snapshot ID collision: snapshot '{0}' already exists")]
    SnapshotCollision(String),

    #[error(
        "Metadata authentication failed for snapshot '{0}': invalid or tampered HMAC signature"
    )]
    MetadataAuthenticationFailed(String),

    #[error("Unsupported schema version {0} for snapshot '{1}'")]
    UnsupportedSchemaVersion(u32, String),

    #[error("Dangerous overlap detected: vault root '{vault_root}' overlaps active workspace '{workspace_root}'")]
    WorkspaceVaultOverlap {
        vault_root: String,
        workspace_root: String,
    },

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

/// Injected cryptographic authentication key for snapshot metadata HMAC-SHA-256 verification.
///
/// Trust Model Note:
/// In this core-library step, the authentication key is backend-owned and injected
/// into `SnapshotVault` constructors. Tests generate ephemeral keys via `VaultAuthKey::generate_ephemeral()`.
/// Persistent OS keyring / credential storage wiring is deferred to the Tauri application crate.
#[derive(Clone)]
pub struct VaultAuthKey {
    key_bytes: [u8; 32],
}

impl VaultAuthKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { key_bytes: bytes }
    }

    /// Generates a cryptographically secure ephemeral 256-bit authentication key.
    pub fn generate_ephemeral() -> Result<Self, VaultError> {
        let mut key = [0u8; 32];
        getrandom::fill(&mut key).map_err(|e| {
            VaultError::SecurityViolation(format!(
                "Failed to generate cryptographic randomness: {}",
                e
            ))
        })?;
        Ok(Self { key_bytes: key })
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.key_bytes
    }
}

impl std::fmt::Debug for VaultAuthKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "VaultAuthKey([REDACTED])")
    }
}

/// Metadata describing a single workspace snapshot stored in the native vault.
///
/// Security note:
/// - Snapshots are stored in an application-controlled protected local filesystem directory.
/// - Snapshots are NOT encrypted at rest (plaintext bytes).
/// - Payload integrity is protected with SHA-256 content hashes.
/// - Metadata authenticity is protected with HMAC-SHA-256 over canonical schema fields.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotMetadata {
    pub schema_version: u32,
    pub id: String,
    pub workspace_root: String,
    pub relative_path: String,
    pub file_existed: bool,
    pub created_at_ms: u64,
    pub size_bytes: u64,
    pub sha256_hash: Option<String>,
    pub hmac_signature: String,
}

/// Native Snapshot Vault owned by the Tauri/Rust backend.
///
/// The vault lives in an application-controlled local directory completely isolated
/// from user workspaces.
pub struct SnapshotVault {
    vault_root: PathBuf,
    auth_key: VaultAuthKey,
}

impl SnapshotVault {
    /// Creates a new `SnapshotVault` anchored at `vault_root` with an authenticated key.
    ///
    /// Validates directory hierarchy security (no symlinks, no reparse points)
    /// and canonicalizes the vault root.
    pub fn new_with_key<P: AsRef<Path>>(
        vault_root: P,
        auth_key: VaultAuthKey,
    ) -> Result<Self, VaultError> {
        let root = vault_root.as_ref();
        if root.exists() {
            let initial_meta = fs::symlink_metadata(root).map_err(|e| {
                VaultError::SecurityViolation(format!("Cannot inspect vault root: {}", e))
            })?;
            if initial_meta.file_type().is_symlink() {
                return Err(VaultError::SecurityViolation(
                    "Vault root is a symlink (redirection rejected)".to_string(),
                ));
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if initial_meta.file_attributes() & 0x400 != 0 {
                    return Err(VaultError::SecurityViolation(
                        "Vault root is a Windows reparse point/junction (redirection rejected)"
                            .to_string(),
                    ));
                }
            }
        } else {
            fs::create_dir_all(root)
                .map_err(|e| VaultError::IoError(format!("Failed to create vault root: {}", e)))?;
        }

        let canonical_root = fs::canonicalize(root).map_err(|e| {
            VaultError::IoError(format!("Failed to canonicalize vault root: {}", e))
        })?;

        let snapshots_dir = canonical_root.join("snapshots");
        let tmp_dir = canonical_root.join("tmp");

        if !snapshots_dir.exists() {
            fs::create_dir_all(&snapshots_dir).map_err(|e| {
                VaultError::IoError(format!("Failed to create snapshots directory: {}", e))
            })?;
        }
        if !tmp_dir.exists() {
            fs::create_dir_all(&tmp_dir).map_err(|e| {
                VaultError::IoError(format!("Failed to create tmp directory: {}", e))
            })?;
        }

        Self::validate_vault_hierarchy(&canonical_root)?;

        Ok(Self {
            vault_root: canonical_root,
            auth_key,
        })
    }

    /// Explicit constructor for tests / internal testing with optional custom key.
    ///
    /// Note: This must NEVER be exposed as a public IPC command to the frontend.
    pub fn new_with_custom_root_for_test<P: AsRef<Path>>(
        vault_root: P,
        auth_key: Option<VaultAuthKey>,
    ) -> Result<Self, VaultError> {
        let key = match auth_key {
            Some(k) => k,
            None => VaultAuthKey::generate_ephemeral()?,
        };
        Self::new_with_key(vault_root, key)
    }

    /// Returns the canonical path to the vault storage root.
    pub fn vault_root(&self) -> &Path {
        &self.vault_root
    }

    /// Validates that the vault root and the workspace root do NOT overlap.
    ///
    /// Fails closed if vault_root == workspace_root or either is a parent/child of the other.
    pub fn validate_workspace_isolation(&self, workspace_root: &Path) -> Result<(), VaultError> {
        let canonical_ws = if workspace_root.exists() {
            fs::canonicalize(workspace_root).map_err(|e| {
                VaultError::IoError(format!("Failed to canonicalize workspace: {}", e))
            })?
        } else {
            workspace_root.to_path_buf()
        };

        let canonical_vault = &self.vault_root;

        if canonical_vault == &canonical_ws
            || canonical_vault.starts_with(&canonical_ws)
            || canonical_ws.starts_with(canonical_vault)
        {
            return Err(VaultError::WorkspaceVaultOverlap {
                vault_root: canonical_vault.to_string_lossy().to_string(),
                workspace_root: canonical_ws.to_string_lossy().to_string(),
            });
        }

        Ok(())
    }

    /// Hardens and validates the vault directory tree against symlink / junction / reparse redirection.
    pub fn validate_vault_hierarchy(vault_root: &Path) -> Result<(), VaultError> {
        // 1. Validate vault_root
        let meta = fs::symlink_metadata(vault_root).map_err(|e| {
            VaultError::SecurityViolation(format!("Cannot inspect vault root: {}", e))
        })?;
        if meta.file_type().is_symlink() {
            return Err(VaultError::SecurityViolation(
                "Vault root is a symlink (redirection rejected)".to_string(),
            ));
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if meta.file_attributes() & 0x400 != 0 {
                return Err(VaultError::SecurityViolation(
                    "Vault root is a Windows reparse point/junction (redirection rejected)"
                        .to_string(),
                ));
            }
        }
        if !meta.is_dir() {
            return Err(VaultError::SecurityViolation(
                "Vault root is not a directory".to_string(),
            ));
        }

        // 2. Validate snapshots directory
        let snapshots_dir = vault_root.join("snapshots");
        if snapshots_dir.exists() {
            let meta_snap = fs::symlink_metadata(&snapshots_dir).map_err(|e| {
                VaultError::SecurityViolation(format!("Cannot inspect snapshots directory: {}", e))
            })?;
            if meta_snap.file_type().is_symlink() {
                return Err(VaultError::SecurityViolation(
                    "Snapshots directory is a symlink (redirection rejected)".to_string(),
                ));
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta_snap.file_attributes() & 0x400 != 0 {
                    return Err(VaultError::SecurityViolation(
                        "Snapshots directory is a Windows reparse point/junction (redirection rejected)".to_string(),
                    ));
                }
            }
            let canon_snap = fs::canonicalize(&snapshots_dir).map_err(|e| {
                VaultError::SecurityViolation(format!(
                    "Cannot canonicalize snapshots directory: {}",
                    e
                ))
            })?;
            if canon_snap != vault_root.join("snapshots") && !canon_snap.starts_with(vault_root) {
                return Err(VaultError::SecurityViolation(
                    "Snapshots directory escapes canonical vault root".to_string(),
                ));
            }
        }

        // 3. Validate tmp directory
        let tmp_dir = vault_root.join("tmp");
        if tmp_dir.exists() {
            let meta_tmp = fs::symlink_metadata(&tmp_dir).map_err(|e| {
                VaultError::SecurityViolation(format!("Cannot inspect tmp directory: {}", e))
            })?;
            if meta_tmp.file_type().is_symlink() {
                return Err(VaultError::SecurityViolation(
                    "Vault tmp directory is a symlink (redirection rejected)".to_string(),
                ));
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta_tmp.file_attributes() & 0x400 != 0 {
                    return Err(VaultError::SecurityViolation(
                        "Vault tmp directory is a Windows reparse point/junction (redirection rejected)".to_string(),
                    ));
                }
            }
            let canon_tmp = fs::canonicalize(&tmp_dir).map_err(|e| {
                VaultError::SecurityViolation(format!("Cannot canonicalize tmp directory: {}", e))
            })?;
            if canon_tmp != vault_root.join("tmp") && !canon_tmp.starts_with(vault_root) {
                return Err(VaultError::SecurityViolation(
                    "Vault tmp directory escapes canonical vault root".to_string(),
                ));
            }
        }

        Ok(())
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

        // 1. Verify vault tree and overlap isolation
        self.validate_vault_tree()?;
        self.validate_workspace_isolation(active_root)?;

        let trimmed_rel = relative_path.trim().replace('\\', "/");
        if trimmed_rel.is_empty() || trimmed_rel == "." {
            return Err(VaultError::IsADirectory(relative_path.to_string()));
        }

        // 2. Validate path against active workspace boundary using authoritative Phase-1 logic
        let validation_res = workspace_manager.resolve_and_validate_path(&trimmed_rel);

        let (file_existed, file_bytes, sha256_hash, size_bytes) = match validation_res {
            Ok(resolved_path) => {
                // Check if target is directory or symlink
                let meta = fs::symlink_metadata(&resolved_path).map_err(|e| {
                    VaultError::IoError(format!("Failed to read file metadata: {}", e))
                })?;
                if meta.is_dir() {
                    return Err(VaultError::IsADirectory(trimmed_rel));
                }
                if meta.file_type().is_symlink() {
                    let canon = fs::canonicalize(&resolved_path).map_err(|e| {
                        VaultError::SecurityViolation(format!(
                            "Failed to canonicalize target symlink: {}",
                            e
                        ))
                    })?;
                    if !canon.starts_with(active_root) {
                        return Err(VaultError::SecurityViolation(format!(
                            "Source symlink escapes workspace root: {}",
                            trimmed_rel
                        )));
                    }
                }

                let bytes = fs::read(&resolved_path).map_err(|e| {
                    VaultError::IoError(format!("Failed to read source file: {}", e))
                })?;
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

        // 3. Generate cryptographic opaque snapshot ID
        let snapshot_id = Self::generate_snapshot_id()?;

        // 4. Compute HMAC-SHA256 signature for metadata
        let auth_payload = Self::canonical_auth_payload(
            CURRENT_SCHEMA_VERSION,
            &snapshot_id,
            &canonical_root_str,
            &trimmed_rel,
            file_existed,
            now_ms,
            size_bytes,
            sha256_hash.as_deref(),
        );
        let hmac_sig = Self::compute_hmac_hex(self.auth_key.as_bytes(), &auth_payload);

        let metadata = SnapshotMetadata {
            schema_version: CURRENT_SCHEMA_VERSION,
            id: snapshot_id,
            workspace_root: canonical_root_str,
            relative_path: trimmed_rel,
            file_existed,
            created_at_ms: now_ms,
            size_bytes,
            sha256_hash,
            hmac_signature: hmac_sig,
        };

        // 5. Persist transactionally with atomic commit and durability
        self.persist_snapshot_atomic(&metadata, file_bytes.as_deref())?;

        Ok(metadata)
    }

    /// Retrieves and verifies trusted snapshot metadata by ID.
    pub fn get_snapshot_metadata(&self, snapshot_id: &str) -> Result<SnapshotMetadata, VaultError> {
        Self::validate_snapshot_id(snapshot_id)?;
        self.validate_vault_tree()?;

        let meta_file = self
            .vault_root
            .join("snapshots")
            .join(format!("{}.meta.json", snapshot_id));

        if !meta_file.exists() {
            return Err(VaultError::SnapshotNotFound(snapshot_id.to_string()));
        }

        let meta_sym = fs::symlink_metadata(&meta_file)
            .map_err(|e| VaultError::IoError(format!("Cannot inspect metadata file: {}", e)))?;
        if meta_sym.file_type().is_symlink() {
            return Err(VaultError::SecurityViolation(
                "Metadata file is a symlink (rejected)".to_string(),
            ));
        }

        let content = fs::read_to_string(&meta_file)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshot metadata: {}", e)))?;

        let meta: SnapshotMetadata = serde_json::from_str(&content).map_err(|e| {
            VaultError::IoError(format!("Failed to parse snapshot metadata: {}", e))
        })?;

        // Authenticate metadata HMAC
        self.verify_metadata_authenticity(&meta)?;

        Ok(meta)
    }

    /// Lists snapshot metadata, filtered by optional workspace canonical root.
    ///
    /// Skips/ignores unauthenticated or tampered records to prevent corrupt metadata injection.
    pub fn list_snapshots(
        &self,
        workspace_root_filter: Option<&str>,
    ) -> Result<Vec<SnapshotMetadata>, VaultError> {
        self.validate_vault_tree()?;
        let snapshots_dir = self.vault_root.join("snapshots");

        if !snapshots_dir.exists() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        let entries = fs::read_dir(&snapshots_dir).map_err(|e| {
            VaultError::IoError(format!("Failed to read snapshots directory: {}", e))
        })?;

        for entry_res in entries {
            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".meta.json") {
                let snap_id = name.trim_end_matches(".meta.json");
                if Self::validate_snapshot_id(snap_id).is_err() {
                    continue;
                }

                if let Ok(meta) = self.get_snapshot_metadata(snap_id) {
                    if let Some(filter) = workspace_root_filter {
                        if meta.workspace_root != filter {
                            continue;
                        }
                    }
                    results.push(meta);
                }
            }
        }

        // Sort descending by timestamp (newest first)
        results.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        Ok(results)
    }

    /// Restores a snapshot back into the active workspace.
    ///
    /// Follows strict security order:
    /// 1. Validate snapshot ID syntax
    /// 2. Read and verify metadata HMAC authenticity
    /// 3. Verify schema version
    /// 4. Revalidate current authorized workspace and isolation from vault
    /// 5. Verify workspace binding matches active canonical root
    /// 6. Check non-existent original state
    /// 7. Read and verify payload SHA-256 integrity against metadata
    /// 8. Race-resistant destination validation: walk directory components with no-follow checks
    /// 9. Safe atomic replacement using exclusive temporary file and atomic rename
    /// 10. Verify restored file on disk
    pub fn restore_snapshot(
        &self,
        workspace_manager: &WorkspaceManager,
        snapshot_id: &str,
    ) -> Result<SnapshotMetadata, VaultError> {
        // 1. Validate snapshot ID format
        Self::validate_snapshot_id(snapshot_id)?;
        self.validate_vault_tree()?;

        // 2 & 3. Read and authenticate metadata
        let metadata = self.get_snapshot_metadata(snapshot_id)?;

        if metadata.schema_version != CURRENT_SCHEMA_VERSION {
            return Err(VaultError::UnsupportedSchemaVersion(
                metadata.schema_version,
                snapshot_id.to_string(),
            ));
        }

        // 4. Revalidate current authorized workspace
        let active_root = workspace_manager.get_active_root()?;
        let canonical_active_root = fs::canonicalize(active_root).map_err(|e| {
            VaultError::IoError(format!("Failed to canonicalize active root: {}", e))
        })?;

        self.validate_workspace_isolation(&canonical_active_root)?;

        // 5. Workspace binding check: Reject snapshots belonging to another workspace
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

        // 6. Non-existent file support check (fail closed with explicit truthful error)
        if !metadata.file_existed {
            return Err(VaultError::NonExistentFileRollbackNotImplemented);
        }

        // 7. Read stored snapshot payload data and verify cryptographic integrity
        let data_file = self
            .vault_root
            .join("snapshots")
            .join(format!("{}.data", snapshot_id));
        if !data_file.exists() {
            return Err(VaultError::IoError(format!(
                "Snapshot content payload missing for ID: {}",
                snapshot_id
            )));
        }

        let data_sym = fs::symlink_metadata(&data_file).map_err(|e| {
            VaultError::IoError(format!("Cannot inspect snapshot data file: {}", e))
        })?;
        if data_sym.file_type().is_symlink() {
            return Err(VaultError::SecurityViolation(
                "Snapshot payload data file is a symlink (rejected)".to_string(),
            ));
        }

        let stored_bytes = fs::read(&data_file)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshot data: {}", e)))?;

        if stored_bytes.len() as u64 != metadata.size_bytes {
            return Err(VaultError::IntegrityMismatch {
                id: snapshot_id.to_string(),
                expected: format!("size {} bytes", metadata.size_bytes),
                computed: format!("size {} bytes", stored_bytes.len()),
            });
        }

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
                    expected: "Valid SHA-256 hash in metadata".to_string(),
                    computed: "No hash recorded".to_string(),
                });
            }
        }

        // 8. Race-resistant destination validation and preparation
        let (parent_dir, _target_file_name, target_path) =
            Self::prepare_secure_restore_destination(
                &canonical_active_root,
                &metadata.relative_path,
            )?;

        // 9. Safe atomic replacement
        let random_suffix = Self::generate_random_hex_16()?;
        let temp_filename = format!(".axion_restore_{}_{}.tmp", snapshot_id, random_suffix);
        let temp_path = parent_dir.join(&temp_filename);

        // Ensure temp path is strictly within parent directory
        if !temp_path.starts_with(&canonical_active_root) {
            return Err(VaultError::SecurityViolation(
                "Temporary restore file path escapes workspace boundary".to_string(),
            ));
        }

        let write_res = (|| -> Result<(), VaultError> {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true) // Exclusive create (O_CREAT | O_EXCL) prevents clobbering or symlink hijack
                .open(&temp_path)
                .map_err(|e| {
                    VaultError::IoError(format!(
                        "Failed to create exclusive temp restore file: {}",
                        e
                    ))
                })?;

            file.write_all(&stored_bytes).map_err(|e| {
                VaultError::IoError(format!("Failed to write temp restore file: {}", e))
            })?;
            file.sync_all().map_err(|e| {
                VaultError::IoError(format!("Failed to sync temp restore file: {}", e))
            })?;
            Ok(())
        })();

        if let Err(e) = write_res {
            let _ = fs::remove_file(&temp_path);
            return Err(e);
        }

        // Re-verify parent directory before final rename
        if let Err(e) = Self::validate_existing_directory(&parent_dir, &canonical_active_root) {
            let _ = fs::remove_file(&temp_path);
            return Err(e);
        }

        // If target file exists, ensure it is not a directory or symlink escaping workspace
        if target_path.exists() {
            let target_sym = fs::symlink_metadata(&target_path).map_err(|e| {
                VaultError::IoError(format!("Cannot inspect existing target: {}", e))
            })?;
            if target_sym.is_dir() {
                let _ = fs::remove_file(&temp_path);
                return Err(VaultError::IsADirectory(metadata.relative_path.clone()));
            }
            if target_sym.file_type().is_symlink() {
                let canon = fs::canonicalize(&target_path).map_err(|e| {
                    VaultError::IoError(format!("Cannot canonicalize target: {}", e))
                })?;
                if !canon.starts_with(&canonical_active_root) {
                    let _ = fs::remove_file(&temp_path);
                    return Err(VaultError::SecurityViolation(
                        "Target symlink escapes workspace root".to_string(),
                    ));
                }
            }
        }

        // Atomic replace via rename
        if let Err(e) = fs::rename(&temp_path, &target_path) {
            let _ = fs::remove_file(&temp_path);
            return Err(VaultError::IoError(format!(
                "Failed to atomically commit restored file: {}",
                e
            )));
        }

        // Sync parent directory where supported
        #[cfg(unix)]
        {
            if let Ok(dir_f) = File::open(&parent_dir) {
                let _ = dir_f.sync_all();
            }
        }

        // 10. Verify that restored file exists and matches size
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

    /// Validates the vault directory hierarchy before sensitive operations.
    fn validate_vault_tree(&self) -> Result<(), VaultError> {
        Self::validate_vault_hierarchy(&self.vault_root)
    }

    /// Verifies the HMAC-SHA-256 signature of a snapshot metadata record in constant time.
    pub fn verify_metadata_authenticity(&self, meta: &SnapshotMetadata) -> Result<(), VaultError> {
        let auth_payload = Self::canonical_auth_payload(
            meta.schema_version,
            &meta.id,
            &meta.workspace_root,
            &meta.relative_path,
            meta.file_existed,
            meta.created_at_ms,
            meta.size_bytes,
            meta.sha256_hash.as_deref(),
        );

        let computed_sig = Self::compute_hmac_hex(self.auth_key.as_bytes(), &auth_payload);
        if !Self::constant_time_eq(computed_sig.as_bytes(), meta.hmac_signature.as_bytes()) {
            return Err(VaultError::MetadataAuthenticationFailed(meta.id.clone()));
        }

        Ok(())
    }

    /// Transactionally persists snapshot data and metadata.
    pub fn persist_snapshot_atomic(
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
        if final_meta_path.exists() || final_data_path.exists() {
            return Err(VaultError::SnapshotCollision(meta.id.clone()));
        }

        // 1. Write content payload if file existed
        if let Some(bytes) = content_bytes {
            let write_data_res = (|| -> Result<(), VaultError> {
                let mut f = OpenOptions::new()
                    .write(true)
                    .create_new(true) // Exclusive create
                    .open(&tmp_data_path)
                    .map_err(|e| {
                        VaultError::IoError(format!("Failed to create tmp snapshot data: {}", e))
                    })?;
                f.write_all(bytes).map_err(|e| {
                    VaultError::IoError(format!("Failed to write tmp snapshot data: {}", e))
                })?;
                f.sync_all().map_err(|e| {
                    VaultError::IoError(format!("Failed to sync tmp snapshot data: {}", e))
                })?;
                Ok(())
            })();

            if let Err(e) = write_data_res {
                let _ = fs::remove_file(&tmp_data_path);
                return Err(e);
            }

            // Commit data payload atomically
            if let Err(e) = fs::rename(&tmp_data_path, &final_data_path) {
                let _ = fs::remove_file(&tmp_data_path);
                return Err(VaultError::IoError(format!(
                    "Failed to commit snapshot data file: {}",
                    e
                )));
            }
        }

        // 2. Write metadata JSON
        let write_meta_res = (|| -> Result<(), VaultError> {
            let meta_json = serde_json::to_string_pretty(meta)
                .map_err(|e| VaultError::IoError(format!("Failed to serialize metadata: {}", e)))?;
            let mut f = OpenOptions::new()
                .write(true)
                .create_new(true) // Exclusive create
                .open(&tmp_meta_path)
                .map_err(|e| {
                    VaultError::IoError(format!("Failed to create tmp snapshot meta: {}", e))
                })?;
            f.write_all(meta_json.as_bytes()).map_err(|e| {
                VaultError::IoError(format!("Failed to write tmp snapshot meta: {}", e))
            })?;
            f.sync_all().map_err(|e| {
                VaultError::IoError(format!("Failed to sync tmp snapshot meta: {}", e))
            })?;
            Ok(())
        })();

        if let Err(e) = write_meta_res {
            let _ = fs::remove_file(&tmp_meta_path);
            if content_bytes.is_some() {
                let _ = fs::remove_file(&final_data_path);
            }
            return Err(e);
        }

        // 3. Atomic commit of metadata file (the authoritative validity marker)
        if let Err(e) = fs::rename(&tmp_meta_path, &final_meta_path) {
            let _ = fs::remove_file(&tmp_meta_path);
            if content_bytes.is_some() {
                let _ = fs::remove_file(&final_data_path);
            }
            return Err(VaultError::IoError(format!(
                "Failed to commit snapshot metadata file: {}",
                e
            )));
        }

        // Sync directory on platforms where supported
        #[cfg(unix)]
        {
            if let Ok(dir_f) = File::open(&snapshots_dir) {
                let _ = dir_f.sync_all();
            }
        }

        Ok(())
    }

    /// Prepares destination parent directory with race-resistant component inspection.
    fn prepare_secure_restore_destination(
        active_root: &Path,
        relative_path: &str,
    ) -> Result<(PathBuf, String, PathBuf), VaultError> {
        let trimmed = relative_path.trim().replace('\\', "/");
        if trimmed.is_empty() || trimmed == "." {
            return Err(VaultError::IsADirectory(relative_path.to_string()));
        }

        let rel = Path::new(&trimmed);
        if rel.is_absolute() {
            return Err(VaultError::SecurityViolation(format!(
                "Absolute destination paths rejected: '{}'",
                relative_path
            )));
        }

        let file_name = rel
            .file_name()
            .ok_or_else(|| {
                VaultError::SecurityViolation("Invalid relative path target".to_string())
            })?
            .to_string_lossy()
            .to_string();

        let parent_rel = rel.parent();

        let mut current_dir = active_root.to_path_buf();

        if let Some(parent) = parent_rel {
            for component in parent.components() {
                match component {
                    Component::Prefix(_) | Component::RootDir => {
                        return Err(VaultError::SecurityViolation(
                            "Root/prefix component rejected in relative path".to_string(),
                        ));
                    }
                    Component::CurDir => {}
                    Component::ParentDir => {
                        if !current_dir.pop() || !current_dir.starts_with(active_root) {
                            return Err(VaultError::SecurityViolation(
                                "Path traversal rejected in restore destination".to_string(),
                            ));
                        }
                    }
                    Component::Normal(c) => {
                        current_dir.push(c);
                        if current_dir.exists() {
                            Self::validate_existing_directory(&current_dir, active_root)?;
                        } else {
                            fs::create_dir(&current_dir).map_err(|e| {
                                VaultError::IoError(format!(
                                    "Failed to safely create directory: {}",
                                    e
                                ))
                            })?;
                            Self::validate_existing_directory(&current_dir, active_root)?;
                        }
                    }
                }
            }
        }

        let target_path = current_dir.join(&file_name);

        if !target_path.starts_with(active_root) {
            return Err(VaultError::SecurityViolation(
                "Target path escapes workspace root".to_string(),
            ));
        }

        Ok((current_dir, file_name, target_path))
    }

    /// Verifies that a directory component is genuine and unescaped.
    fn validate_existing_directory(dir: &Path, active_root: &Path) -> Result<(), VaultError> {
        let meta = fs::symlink_metadata(dir).map_err(|e| {
            VaultError::IoError(format!("Cannot inspect directory {}: {}", dir.display(), e))
        })?;

        if meta.file_type().is_symlink() {
            return Err(VaultError::SecurityViolation(format!(
                "Parent directory component is a symlink: {}",
                dir.display()
            )));
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if meta.file_attributes() & 0x400 != 0 {
                return Err(VaultError::SecurityViolation(format!(
                    "Parent directory component is a Windows reparse point/junction: {}",
                    dir.display()
                )));
            }
        }

        if !meta.is_dir() {
            return Err(VaultError::SecurityViolation(format!(
                "Path component is not a directory: {}",
                dir.display()
            )));
        }

        let canonical = fs::canonicalize(dir).map_err(|e| {
            VaultError::IoError(format!(
                "Cannot canonicalize directory {}: {}",
                dir.display(),
                e
            ))
        })?;

        if !canonical.starts_with(active_root) {
            return Err(VaultError::SecurityViolation(format!(
                "Parent directory escapes active workspace root: {}",
                dir.display()
            )));
        }

        Ok(())
    }

    /// Sanitizes and validates snapshot IDs against injection and traversal attacks.
    pub fn validate_snapshot_id(id: &str) -> Result<(), VaultError> {
        if id.is_empty() || id.len() != 37 {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        if !id.starts_with("snap_") {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        let hex_part = &id[5..];
        if !hex_part.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')) {
            return Err(VaultError::InvalidSnapshotId(id.to_string()));
        }
        Ok(())
    }

    /// Generates a cryptographically random opaque snapshot ID.
    fn generate_snapshot_id() -> Result<String, VaultError> {
        let mut random_bytes = [0u8; 16]; // 128 bits of cryptographic randomness
        getrandom::fill(&mut random_bytes).map_err(|e| {
            VaultError::SecurityViolation(format!(
                "Failed to generate cryptographic randomness: {}",
                e
            ))
        })?;
        let mut hex = String::with_capacity(37);
        hex.push_str("snap_");
        for b in random_bytes {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        Ok(hex)
    }

    /// Generates a random 16-hex suffix for temporary files.
    fn generate_random_hex_16() -> Result<String, VaultError> {
        let mut random_bytes = [0u8; 8];
        getrandom::fill(&mut random_bytes).map_err(|e| {
            VaultError::SecurityViolation(format!("Failed to generate random suffix: {}", e))
        })?;
        let mut hex = String::with_capacity(16);
        for b in random_bytes {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        Ok(hex)
    }

    /// Canonical serialized representation of metadata fields for HMAC-SHA-256 authentication.
    pub fn canonical_auth_payload(
        schema_version: u32,
        id: &str,
        workspace_root: &str,
        relative_path: &str,
        file_existed: bool,
        created_at_ms: u64,
        size_bytes: u64,
        sha256_hash: Option<&str>,
    ) -> Vec<u8> {
        format!(
            "axion-snapshot-auth-v1:{}:{}:{}:{}:{}:{}:{}:{}",
            schema_version,
            id,
            workspace_root,
            relative_path,
            if file_existed { "1" } else { "0" },
            created_at_ms,
            size_bytes,
            sha256_hash.unwrap_or("none")
        )
        .into_bytes()
    }

    /// Computes RFC 2104 compliant HMAC-SHA-256 over data using key.
    pub fn compute_hmac_hex(key: &[u8], data: &[u8]) -> String {
        let mac = Self::compute_hmac_bytes(key, data);
        let mut hex = String::with_capacity(64);
        for b in mac {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        hex
    }

    /// Standard RFC 2104 HMAC-SHA256 calculation on 64-byte blocks.
    fn compute_hmac_bytes(key: &[u8], data: &[u8]) -> [u8; 32] {
        let mut k_prime = [0u8; 64];
        if key.len() > 64 {
            let hash = Sha256::digest(key);
            k_prime[..32].copy_from_slice(&hash);
        } else {
            k_prime[..key.len()].copy_from_slice(key);
        }

        let mut k_ipad = [0u8; 64];
        let mut k_opad = [0u8; 64];
        for i in 0..64 {
            k_ipad[i] = k_prime[i] ^ 0x36;
            k_opad[i] = k_prime[i] ^ 0x5c;
        }

        let mut inner = Sha256::new();
        inner.update(&k_ipad);
        inner.update(data);
        let inner_hash = inner.finalize();

        let mut outer = Sha256::new();
        outer.update(&k_opad);
        outer.update(&inner_hash);
        let result = outer.finalize();

        let mut mac = [0u8; 32];
        mac.copy_from_slice(&result);
        mac
    }

    /// Constant-time slice equality comparison to protect HMAC verification against timing attacks.
    fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        let mut diff = 0u8;
        for (x, y) in a.iter().zip(b.iter()) {
            diff |= x ^ y;
        }
        diff == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::WorkspaceManager;
    use tempfile::tempdir;

    #[test]
    fn test_snapshot_normal_file_and_exact_bytes_preserved() {
        let ws_dir = tempdir().expect("ws tempdir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("canonicalize");
        let vault_dir = tempdir().expect("vault tempdir");

        let file_path = ws_root.join("config.json");
        let original_bytes = b"{\"database\": \"sqlite\", \"port\": 8080}";
        fs::write(&file_path, original_bytes).expect("write original");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("set root");

        let vault =
            SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).expect("vault");

        let snap = vault
            .create_snapshot(&mgr, "config.json")
            .expect("snapshot");
        assert!(snap.file_existed);
        assert_eq!(snap.size_bytes, original_bytes.len() as u64);
        assert!(snap.sha256_hash.is_some());
        assert!(!snap.hmac_signature.is_empty());

        let meta = vault.get_snapshot_metadata(&snap.id).expect("get metadata");
        assert_eq!(meta, snap);
    }

    #[test]
    fn test_restore_tampered_metadata_fails_closed() {
        let ws_dir = tempdir().expect("ws tempdir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("canonicalize");
        let vault_dir = tempdir().expect("vault tempdir");

        let file_path = ws_root.join("secret.txt");
        fs::write(&file_path, b"Initial data").expect("write original");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("set root");

        let vault =
            SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).expect("vault");
        let snap = vault.create_snapshot(&mgr, "secret.txt").expect("snapshot");

        // Tamper with relative_path inside metadata file
        let meta_file = vault_dir
            .path()
            .join("snapshots")
            .join(format!("{}.meta.json", snap.id));
        let content = fs::read_to_string(&meta_file).unwrap();
        let mut meta: SnapshotMetadata = serde_json::from_str(&content).unwrap();
        meta.relative_path = "escaped/path.txt".to_string();
        fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap()).unwrap();

        // Restore must fail with MetadataAuthenticationFailed
        let err = vault.restore_snapshot(&mgr, &snap.id);
        assert!(matches!(
            err,
            Err(VaultError::MetadataAuthenticationFailed(_))
        ));
    }

    #[test]
    fn test_vault_workspace_overlap_rejected() {
        let ws_dir = tempdir().expect("ws tempdir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("canonicalize");

        // 1. Vault inside workspace
        let nested_vault = ws_root.join("nested_vault");
        fs::create_dir_all(&nested_vault).unwrap();
        let vault_nested =
            SnapshotVault::new_with_custom_root_for_test(&nested_vault, None).unwrap();

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("set root");

        let err = vault_nested.create_snapshot(&mgr, "file.txt");
        assert!(matches!(err, Err(VaultError::WorkspaceVaultOverlap { .. })));

        // 2. Workspace inside vault
        let vault_parent_dir = tempdir().expect("vault dir");
        let vault_parent = fs::canonicalize(vault_parent_dir.path()).unwrap();
        let nested_ws = vault_parent.join("nested_ws");
        fs::create_dir_all(&nested_ws).unwrap();

        let mut mgr2 = WorkspaceManager::new();
        mgr2.set_workspace_root(&nested_ws).expect("set root 2");

        let vault2 = SnapshotVault::new_with_custom_root_for_test(&vault_parent, None).unwrap();
        let err2 = vault2.create_snapshot(&mgr2, "file.txt");
        assert!(matches!(
            err2,
            Err(VaultError::WorkspaceVaultOverlap { .. })
        ));
    }

    #[test]
    fn test_collision_rejection_no_clobber() {
        let ws_dir = tempdir().expect("ws tempdir");
        let ws_root = fs::canonicalize(ws_dir.path()).expect("canonicalize");
        let vault_dir = tempdir().expect("vault tempdir");

        let file_path = ws_root.join("clobber.txt");
        fs::write(&file_path, b"Test no clobber").expect("write");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&ws_root).expect("set root");

        let vault =
            SnapshotVault::new_with_custom_root_for_test(vault_dir.path(), None).expect("vault");
        let snap = vault
            .create_snapshot(&mgr, "clobber.txt")
            .expect("snapshot");

        // Attempting to persist with the exact same ID again must fail with collision
        let err = vault.persist_snapshot_atomic(&snap, Some(b"Different data"));
        assert!(matches!(err, Err(VaultError::SnapshotCollision(_))));
    }
}
