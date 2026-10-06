use crate::workspace::{WorkspaceError, WorkspaceManager};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

pub type HmacSha256 = Hmac<Sha256>;

pub const AUTH_MAGIC_HEADER: [u8; 4] = *b"AXS1";
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

    #[error("Metadata authentication failed for snapshot '{0}': invalid or tampered HMAC signature")]
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

/// Injected 256-bit cryptographic authentication key for snapshot metadata HMAC-SHA-256 verification.
///
/// Trust Model Note:
/// In this core-library step, the authentication key is backend-owned and injected
/// into `SnapshotVault` constructors. Tests generate ephemeral keys via `VaultAuthKey::generate_ephemeral()`.
/// Persistent OS keyring / credential storage wiring is deferred to the Tauri application integration.
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
            VaultError::SecurityViolation(format!("Failed to generate cryptographic randomness: {}", e))
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
/// - Snapshots are stored plaintext at rest (NOT encrypted).
/// - Payload integrity is protected with SHA-256 content hashes.
/// - Metadata authenticity is protected with standard HMAC<Sha256> over unambiguous binary length-prefixed fields.
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

/// Test synchronization hook for deterministic race/TOCTOU tests.
#[cfg(test)]
pub static TEST_RACE_HOOK: std::sync::Mutex<Option<Box<dyn Fn() + Send + Sync>>> =
    std::sync::Mutex::new(None);

#[cfg(test)]
pub fn set_test_race_hook<F: Fn() + Send + Sync + 'static>(f: F) {
    let mut guard = TEST_RACE_HOOK.lock().unwrap();
    *guard = Some(Box::new(f));
}

#[cfg(test)]
pub fn clear_test_race_hook() {
    let mut guard = TEST_RACE_HOOK.lock().unwrap();
    *guard = None;
}

#[cfg(test)]
fn trigger_test_race_hook() {
    let guard = TEST_RACE_HOOK.lock().unwrap();
    if let Some(ref hook) = *guard {
        hook();
    }
}

#[cfg(not(test))]
#[inline(always)]
fn trigger_test_race_hook() {}

/// Internal secure directory abstraction anchored to an open OS directory descriptor/handle.
///
/// Ensures child operations remain anchored to the opened directory object,
/// preventing path-swap races from escaping the containment tree.
pub struct SecureDir {
    pub path: PathBuf,
    #[cfg(unix)]
    raw_fd: std::os::fd::RawFd,
}

impl SecureDir {
    /// Opens a trusted directory with strict no-follow directory semantics.
    pub fn open_canonical(path: &Path) -> Result<Self, VaultError> {
        let meta = fs::symlink_metadata(path)
            .map_err(|e| VaultError::SecurityViolation(format!("Cannot inspect directory {}: {}", path.display(), e)))?;

        if meta.file_type().is_symlink() {
            return Err(VaultError::SecurityViolation(format!(
                "Directory is a symlink: {}",
                path.display()
            )));
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if meta.file_attributes() & 0x400 != 0 {
                return Err(VaultError::SecurityViolation(format!(
                    "Directory is a Windows reparse point/junction: {}",
                    path.display()
                )));
            }
        }

        if !meta.is_dir() {
            return Err(VaultError::SecurityViolation(format!(
                "Path is not a directory: {}",
                path.display()
            )));
        }

        let canonical = fs::canonicalize(path)
            .map_err(|e| VaultError::IoError(format!("Cannot canonicalize directory {}: {}", path.display(), e)))?;

        #[cfg(unix)]
        {
            use std::ffi::CString;
            let c_path = CString::new(canonical.to_string_lossy().as_bytes())
                .map_err(|_| VaultError::SecurityViolation("Invalid path encoding".to_string()))?;

            let fd = unsafe {
                libc::open(
                    c_path.as_ptr(),
                    libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW | libc::O_RDONLY,
                )
            };

            if fd < 0 {
                return Err(VaultError::IoError(format!(
                    "Failed to open directory descriptor for {}: errno {}",
                    canonical.display(),
                    std::io::Error::last_os_error()
                )));
            }

            Ok(Self {
                path: canonical,
                raw_fd: fd,
            })
        }

        #[cfg(not(unix))]
        {
            Ok(Self { path: canonical })
        }
    }

    /// Opens or traverses into a child directory anchored to this descriptor.
    pub fn open_or_create_child_dir(&self, name: &str) -> Result<SecureDir, VaultError> {
        let child_path = self.path.join(name);

        if !child_path.exists() {
            fs::create_dir(&child_path).map_err(|e| {
                VaultError::IoError(format!("Failed to create child directory {}: {}", child_path.display(), e))
            })?;
        }

        Self::open_canonical(&child_path)
    }

    /// Creates an exclusive temporary file anchored to this directory.
    pub fn create_exclusive_file(&self, filename: &str) -> Result<File, VaultError> {
        let file_path = self.path.join(filename);

        #[cfg(unix)]
        {
            use std::ffi::CString;
            use std::os::fd::FromRawFd;

            let c_name = CString::new(filename)
                .map_err(|_| VaultError::SecurityViolation("Invalid filename encoding".to_string()))?;

            let fd = unsafe {
                libc::openat(
                    self.raw_fd,
                    c_name.as_ptr(),
                    libc::O_CREAT | libc::O_EXCL | libc::O_WRONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
                    0o600,
                )
            };

            if fd < 0 {
                return Err(VaultError::IoError(format!(
                    "Failed to create exclusive file {} in directory {}: {}",
                    filename,
                    self.path.display(),
                    std::io::Error::last_os_error()
                )));
            }

            Ok(unsafe { File::from_raw_fd(fd) })
        }

        #[cfg(not(unix))]
        {
            fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&file_path)
                .map_err(|e| VaultError::IoError(format!("Failed to create exclusive file: {}", e)))
        }
    }

    /// Atomically replaces target child file with temporary child file anchored to this directory descriptor.
    pub fn atomic_replace_child(&self, temp_filename: &str, target_filename: &str) -> Result<(), VaultError> {
        trigger_test_race_hook();

        #[cfg(unix)]
        {
            use std::ffi::CString;
            let c_temp = CString::new(temp_filename)
                .map_err(|_| VaultError::SecurityViolation("Invalid temp name encoding".to_string()))?;
            let c_target = CString::new(target_filename)
                .map_err(|_| VaultError::SecurityViolation("Invalid target name encoding".to_string()))?;

            let res = unsafe {
                libc::renameat(
                    self.raw_fd,
                    c_temp.as_ptr(),
                    self.raw_fd,
                    c_target.as_ptr(),
                )
            };

            if res != 0 {
                return Err(VaultError::IoError(format!(
                    "Failed to atomically rename {} to {} in {}: {}",
                    temp_filename,
                    target_filename,
                    self.path.display(),
                    std::io::Error::last_os_error()
                )));
            }

            // Sync directory metadata
            unsafe {
                libc::fsync(self.raw_fd);
            }

            Ok(())
        }

        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::Storage::FileSystem::{
                MoveFileExW, ReplaceFileW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
                REPLACEFILE_WRITE_THROUGH,
            };

            let temp_path = self.path.join(temp_filename);
            let target_path = self.path.join(target_filename);

            let temp_w: Vec<u16> = temp_path.as_os_str().encode_wide().chain(Some(0)).collect();
            let target_w: Vec<u16> = target_path.as_os_str().encode_wide().chain(Some(0)).collect();

            if target_path.exists() {
                let success = unsafe {
                    ReplaceFileW(
                        target_w.as_ptr(),
                        temp_w.as_ptr(),
                        std::ptr::null(),
                        REPLACEFILE_WRITE_THROUGH,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                    )
                };

                if success == 0 {
                    return Err(VaultError::IoError(format!(
                        "ReplaceFileW failed on Windows: {}",
                        std::io::Error::last_os_error()
                    )));
                }
            } else {
                let success = unsafe {
                    MoveFileExW(
                        temp_w.as_ptr(),
                        target_w.as_ptr(),
                        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
                    )
                };

                if success == 0 {
                    return Err(VaultError::IoError(format!(
                        "MoveFileExW failed on Windows: {}",
                        std::io::Error::last_os_error()
                    )));
                }
            }

            Ok(())
        }

        #[cfg(not(any(unix, windows)))]
        {
            let temp_path = self.path.join(temp_filename);
            let target_path = self.path.join(target_filename);
            fs::rename(&temp_path, &target_path)
                .map_err(|e| VaultError::IoError(format!("Atomic replace fallback failed: {}", e)))
        }
    }

    /// Removes a child file safely.
    pub fn remove_child_file(&self, filename: &str) {
        #[cfg(unix)]
        {
            use std::ffi::CString;
            if let Ok(c_name) = CString::new(filename) {
                unsafe {
                    libc::unlinkat(self.raw_fd, c_name.as_ptr(), 0);
                }
            }
        }
        #[cfg(not(unix))]
        {
            let _ = fs::remove_file(self.path.join(filename));
        }
    }
}

#[cfg(unix)]
impl Drop for SecureDir {
    fn drop(&mut self) {
        if self.raw_fd >= 0 {
            unsafe {
                libc::close(self.raw_fd);
            }
        }
    }
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
    pub fn new_with_key<P: AsRef<Path>>(
        vault_root: P,
        auth_key: VaultAuthKey,
    ) -> Result<Self, VaultError> {
        let root = vault_root.as_ref();
        if root.exists() {
            let initial_meta = fs::symlink_metadata(root)
                .map_err(|e| VaultError::SecurityViolation(format!("Cannot inspect vault root: {}", e)))?;
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
                        "Vault root is a Windows reparse point/junction (redirection rejected)".to_string(),
                    ));
                }
            }
        } else {
            fs::create_dir_all(root)
                .map_err(|e| VaultError::IoError(format!("Failed to create vault root: {}", e)))?;
        }

        let canonical_root = fs::canonicalize(root)
            .map_err(|e| VaultError::IoError(format!("Failed to canonicalize vault root: {}", e)))?;

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
    pub fn validate_workspace_isolation(&self, workspace_root: &Path) -> Result<(), VaultError> {
        let canonical_ws = if workspace_root.exists() {
            fs::canonicalize(workspace_root)
                .map_err(|e| VaultError::IoError(format!("Failed to canonicalize workspace: {}", e)))?
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
        let meta = fs::symlink_metadata(vault_root)
            .map_err(|e| VaultError::SecurityViolation(format!("Cannot inspect vault root: {}", e)))?;
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
                    "Vault root is a Windows reparse point/junction (redirection rejected)".to_string(),
                ));
            }
        }
        if !meta.is_dir() {
            return Err(VaultError::SecurityViolation(
                "Vault root is not a directory".to_string(),
            ));
        }

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
                VaultError::SecurityViolation(format!("Cannot canonicalize snapshots directory: {}", e))
            })?;
            if canon_snap != vault_root.join("snapshots") && !canon_snap.starts_with(vault_root) {
                return Err(VaultError::SecurityViolation(
                    "Snapshots directory escapes canonical vault root".to_string(),
                ));
            }
        }

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
    pub fn create_snapshot(
        &self,
        workspace_manager: &WorkspaceManager,
        relative_path: &str,
    ) -> Result<SnapshotMetadata, VaultError> {
        let active_root = workspace_manager.get_active_root()?;
        let canonical_root_str = active_root.to_string_lossy().to_string();

        self.validate_vault_tree()?;
        self.validate_workspace_isolation(active_root)?;

        let trimmed_rel = relative_path.trim().replace('\\', "/");
        if trimmed_rel.is_empty() || trimmed_rel == "." {
            return Err(VaultError::IsADirectory(relative_path.to_string()));
        }

        let validation_res = workspace_manager.resolve_and_validate_path(&trimmed_rel);

        let (file_existed, file_bytes, sha256_hash, size_bytes) = match validation_res {
            Ok(resolved_path) => {
                let meta = fs::symlink_metadata(&resolved_path)
                    .map_err(|e| VaultError::IoError(format!("Failed to read file metadata: {}", e)))?;
                if meta.is_dir() {
                    return Err(VaultError::IsADirectory(trimmed_rel));
                }
                if meta.file_type().is_symlink() {
                    let canon = fs::canonicalize(&resolved_path).map_err(|e| {
                        VaultError::SecurityViolation(format!("Failed to canonicalize target symlink: {}", e))
                    })?;
                    if !canon.starts_with(active_root) {
                        return Err(VaultError::SecurityViolation(format!(
                            "Source symlink escapes workspace root: {}",
                            trimmed_rel
                        )));
                    }
                }

                let bytes = fs::read(&resolved_path)
                    .map_err(|e| VaultError::IoError(format!("Failed to read source file: {}", e)))?;
                let hash = format!("{:x}", Sha256::digest(&bytes));
                let len = bytes.len() as u64;

                (true, Some(bytes), Some(hash), len)
            }
            Err(WorkspaceError::FileNotFound(_)) => (false, None, None, 0u64),
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

        let snapshot_id = Self::generate_snapshot_id()?;

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
        let hmac_sig = Self::compute_hmac_hex(self.auth_key.as_bytes(), &auth_payload)?;

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

        self.persist_snapshot_atomic(&metadata, file_bytes.as_deref())?;

        Ok(metadata)
    }

    /// Retrieves and verifies trusted snapshot metadata by ID.
    pub fn get_snapshot_metadata(&self, snapshot_id: &str) -> Result<SnapshotMetadata, VaultError> {
        Self::validate_snapshot_id(snapshot_id)?;
        self.validate_vault_tree()?;

        let meta_file = self.vault_root.join("snapshots").join(format!("{}.meta.json", snapshot_id));

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

        let meta: SnapshotMetadata = serde_json::from_str(&content)
            .map_err(|e| VaultError::IoError(format!("Failed to parse snapshot metadata: {}", e)))?;

        self.verify_metadata_authenticity(&meta)?;

        Ok(meta)
    }

    /// Lists snapshot metadata, filtered by optional workspace canonical root.
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
        let entries = fs::read_dir(&snapshots_dir)
            .map_err(|e| VaultError::IoError(format!("Failed to read snapshots directory: {}", e)))?;

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

        results.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
        Ok(results)
    }

    /// Restores a snapshot back into the active workspace using handle-anchored directory primitives.
    pub fn restore_snapshot(
        &self,
        workspace_manager: &WorkspaceManager,
        snapshot_id: &str,
    ) -> Result<SnapshotMetadata, VaultError> {
        Self::validate_snapshot_id(snapshot_id)?;
        self.validate_vault_tree()?;

        let metadata = self.get_snapshot_metadata(snapshot_id)?;

        if metadata.schema_version != CURRENT_SCHEMA_VERSION {
            return Err(VaultError::UnsupportedSchemaVersion(
                metadata.schema_version,
                snapshot_id.to_string(),
            ));
        }

        let active_root = workspace_manager.get_active_root()?;
        let canonical_active_root = fs::canonicalize(active_root)
            .map_err(|e| VaultError::IoError(format!("Failed to canonicalize active root: {}", e)))?;

        self.validate_workspace_isolation(&canonical_active_root)?;

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

        if !metadata.file_existed {
            return Err(VaultError::NonExistentFileRollbackNotImplemented);
        }

        let data_file = self.vault_root.join("snapshots").join(format!("{}.data", snapshot_id));
        if !data_file.exists() {
            return Err(VaultError::IoError(format!(
                "Snapshot content payload missing for ID: {}",
                snapshot_id
            )));
        }

        let data_sym = fs::symlink_metadata(&data_file)
            .map_err(|e| VaultError::IoError(format!("Cannot inspect snapshot data file: {}", e)))?;
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

        // Open secure handle anchored to destination directory
        let (secure_parent, target_file_name) =
            Self::traverse_and_open_parent_dir(&canonical_active_root, &metadata.relative_path)?;

        let random_suffix = Self::generate_random_hex_16()?;
        let temp_filename = format!(".axion_restore_{}_{}.tmp", snapshot_id, random_suffix);

        // Exclusive write into temp file anchored in secure_parent
        let mut temp_file = secure_parent.create_exclusive_file(&temp_filename)?;
        let write_res = temp_file
            .write_all(&stored_bytes)
            .and_then(|_| temp_file.sync_all());

        if let Err(e) = write_res {
            secure_parent.remove_child_file(&temp_filename);
            return Err(VaultError::IoError(format!("Failed to write restored temp file: {}", e)));
        }
        drop(temp_file);

        // Perform race-resistant atomic replace
        if let Err(e) = secure_parent.atomic_replace_child(&temp_filename, &target_file_name) {
            secure_parent.remove_child_file(&temp_filename);
            return Err(e);
        }

        // Verify that restored file exists and matches size
        let final_path = secure_parent.path.join(&target_file_name);
        let verify_meta = fs::metadata(&final_path)
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

    fn validate_vault_tree(&self) -> Result<(), VaultError> {
        Self::validate_vault_hierarchy(&self.vault_root)
    }

    /// Verifies the HMAC-SHA-256 signature using the standard HMAC crate in constant time.
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

        if meta.hmac_signature.len() != 64 {
            return Err(VaultError::MetadataAuthenticationFailed(meta.id.clone()));
        }

        let mut expected_sig = [0u8; 32];
        for i in 0..32 {
            expected_sig[i] = u8::from_str_radix(&meta.hmac_signature[i * 2..i * 2 + 2], 16)
                .map_err(|_| VaultError::MetadataAuthenticationFailed(meta.id.clone()))?;
        }

        let mut mac = HmacSha256::new_from_slice(self.auth_key.as_bytes())
            .map_err(|e| VaultError::SecurityViolation(format!("HMAC initialization failed: {}", e)))?;
        mac.update(&auth_payload);

        mac.verify_slice(&expected_sig)
            .map_err(|_| VaultError::MetadataAuthenticationFailed(meta.id.clone()))?;

        Ok(())
    }

    /// Transactionally persists snapshot data and metadata.
    pub fn persist_snapshot_atomic(
        &self,
        meta: &SnapshotMetadata,
        content_bytes: Option<&[u8]>,
    ) -> Result<(), VaultError> {
        let snapshots_secure = SecureDir::open_canonical(&self.vault_root.join("snapshots"))?;
        let tmp_secure = SecureDir::open_canonical(&self.vault_root.join("tmp"))?;

        let tmp_data_name = format!("{}.data.tmp", meta.id);
        let tmp_meta_name = format!("{}.meta.json.tmp", meta.id);
        let final_data_name = format!("{}.data", meta.id);
        let final_meta_name = format!("{}.meta.json", meta.id);

        if snapshots_secure.path.join(&final_meta_name).exists()
            || snapshots_secure.path.join(&final_data_name).exists()
        {
            return Err(VaultError::SnapshotCollision(meta.id.clone()));
        }

        // 1. Write payload
        if let Some(bytes) = content_bytes {
            let mut f = tmp_secure.create_exclusive_file(&tmp_data_name)?;
            f.write_all(bytes)
                .and_then(|_| f.sync_all())
                .map_err(|e| VaultError::IoError(format!("Failed to write tmp snapshot data: {}", e)))?;
            drop(f);

            // Commit data payload
            fs::rename(
                tmp_secure.path.join(&tmp_data_name),
                snapshots_secure.path.join(&final_data_name),
            )
            .map_err(|e| VaultError::IoError(format!("Failed to commit snapshot data: {}", e)))?;
        }

        // 2. Write metadata JSON
        let meta_json = serde_json::to_string_pretty(meta)
            .map_err(|e| VaultError::IoError(format!("Failed to serialize metadata: {}", e)))?;

        let mut f_meta = tmp_secure.create_exclusive_file(&tmp_meta_name)?;
        f_meta
            .write_all(meta_json.as_bytes())
            .and_then(|_| f_meta.sync_all())
            .map_err(|e| VaultError::IoError(format!("Failed to write tmp snapshot meta: {}", e)))?;
        drop(f_meta);

        // 3. Commit metadata JSON (authoritative validity marker)
        fs::rename(
            tmp_secure.path.join(&tmp_meta_name),
            snapshots_secure.path.join(&final_meta_name),
        )
        .map_err(|e| VaultError::IoError(format!("Failed to commit snapshot metadata: {}", e)))?;

        Ok(())
    }

    /// Traverses and opens the target directory handle anchored securely from the canonical root.
    fn traverse_and_open_parent_dir(
        active_root: &Path,
        relative_path: &str,
    ) -> Result<(SecureDir, String), VaultError> {
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
            .ok_or_else(|| VaultError::SecurityViolation("Invalid relative path target".to_string()))?
            .to_string_lossy()
            .to_string();

        let parent_rel = rel.parent();

        let mut current_secure = SecureDir::open_canonical(active_root)?;

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
                        return Err(VaultError::SecurityViolation(
                            "Path traversal rejected in restore destination".to_string(),
                        ));
                    }
                    Component::Normal(c) => {
                        let c_str = c.to_string_lossy();
                        current_secure = current_secure.open_or_create_child_dir(&c_str)?;
                        if !current_secure.path.starts_with(active_root) {
                            return Err(VaultError::SecurityViolation(
                                "Parent directory escapes workspace root".to_string(),
                            ));
                        }
                    }
                }
            }
        }

        Ok((current_secure, file_name))
    }

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

    fn generate_snapshot_id() -> Result<String, VaultError> {
        let mut random_bytes = [0u8; 16];
        getrandom::fill(&mut random_bytes).map_err(|e| {
            VaultError::SecurityViolation(format!("Failed to generate cryptographic randomness: {}", e))
        })?;
        let mut hex = String::with_capacity(37);
        hex.push_str("snap_");
        for b in random_bytes {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        Ok(hex)
    }

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

    /// Unambiguous, deterministic length-prefixed binary framing for HMAC-SHA-256 metadata authentication.
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
        let id_bytes = id.as_bytes();
        let ws_bytes = workspace_root.as_bytes();
        let rel_bytes = relative_path.as_bytes();

        let mut buf = Vec::with_capacity(4 + 4 + 4 + id_bytes.len() + 4 + ws_bytes.len() + 4 + rel_bytes.len() + 1 + 8 + 8 + 1 + 68);

        buf.extend_from_slice(&AUTH_MAGIC_HEADER);
        buf.extend_from_slice(&schema_version.to_be_bytes());

        buf.extend_from_slice(&(id_bytes.len() as u32).to_be_bytes());
        buf.extend_from_slice(id_bytes);

        buf.extend_from_slice(&(ws_bytes.len() as u32).to_be_bytes());
        buf.extend_from_slice(ws_bytes);

        buf.extend_from_slice(&(rel_bytes.len() as u32).to_be_bytes());
        buf.extend_from_slice(rel_bytes);

        buf.push(if file_existed { 1u8 } else { 0u8 });
        buf.extend_from_slice(&created_at_ms.to_be_bytes());
        buf.extend_from_slice(&size_bytes.to_be_bytes());

        match sha256_hash {
            Some(hash_str) => {
                buf.push(1u8);
                let hash_bytes = hash_str.as_bytes();
                buf.extend_from_slice(&(hash_bytes.len() as u32).to_be_bytes());
                buf.extend_from_slice(hash_bytes);
            }
            None => {
                buf.push(0u8);
            }
        }

        buf
    }

    /// Computes HMAC-SHA-256 hex signature using standard HMAC crate.
    pub fn compute_hmac_hex(key: &[u8; 32], payload: &[u8]) -> Result<String, VaultError> {
        let mut mac = HmacSha256::new_from_slice(key)
            .map_err(|e| VaultError::SecurityViolation(format!("HMAC key initialization failed: {}", e)))?;
        mac.update(payload);
        let result = mac.finalize().into_bytes();
        let mut hex = String::with_capacity(64);
        for b in result {
            use std::fmt::Write;
            let _ = write!(hex, "{:02x}", b);
        }
        Ok(hex)
    }
}
