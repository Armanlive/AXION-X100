use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use thiserror::Error;
use walkdir::WalkDir;

const MAX_READ_BYTES: u64 = 2 * 1024 * 1024; // 2 MB safety cap
const MAX_DISCOVERY_FILES: usize = 5000;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkspaceError {
    #[error("No active workspace is currently selected")]
    NoActiveWorkspace,

    #[error("Workspace path does not exist or is not a directory: {0}")]
    InvalidWorkspacePath(String),

    #[error("Security violation: path '{target}' escapes canonical workspace root '{root}'")]
    SecurityEscapeViolation { target: String, root: String },

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Target is a directory, expected a file: {0}")]
    IsADirectory(String),

    #[error("File size ({size} bytes) exceeds maximum limit ({max} bytes): {path}")]
    FileTooLarge { path: String, size: u64, max: u64 },

    #[error("File contains binary data or invalid UTF-8 encoding: {0}")]
    BinaryOrUnsupportedEncoding(String),

    #[error("Filesystem IO error: {0}")]
    IoError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub canonical_root: String,
    pub name: String,
    pub file_count: usize,
    pub is_git: bool,
    pub detected_framework: String,
    pub detected_package_manager: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeFileEntry {
    pub relative_path: String,
    pub name: String,
    pub is_directory: bool,
    pub size_bytes: u64,
    pub modified_timestamp_ms: u64,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeFileMetadata {
    pub relative_path: String,
    pub canonical_path: String,
    pub size_bytes: u64,
    pub modified_timestamp_ms: u64,
    pub is_directory: bool,
    pub is_readonly: bool,
}

pub struct WorkspaceManager {
    active_root: Option<PathBuf>,
}

impl Default for WorkspaceManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self { active_root: None }
    }

    /// Sets and canonicalizes the active workspace root.
    pub fn set_workspace_root<P: AsRef<Path>>(&mut self, path: P) -> Result<WorkspaceInfo, WorkspaceError> {
        let p = path.as_ref();
        if !p.exists() || !p.is_dir() {
            return Err(WorkspaceError::InvalidWorkspacePath(p.to_string_lossy().to_string()));
        }

        let canonical = fs::canonicalize(p)
            .map_err(|e| WorkspaceError::IoError(format!("Failed to canonicalize workspace root: {}", e)))?;

        let name = canonical
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "workspace".to_string());

        self.active_root = Some(canonical.clone());

        let is_git = canonical.join(".git").exists();
        let (framework, package_manager) = Self::detect_project_type(&canonical);
        let file_count = Self::quick_file_count(&canonical);

        Ok(WorkspaceInfo {
            canonical_root: canonical.to_string_lossy().to_string(),
            name,
            file_count,
            is_git,
            detected_framework: framework,
            detected_package_manager: package_manager,
        })
    }

    /// Returns the active workspace info if one is set.
    pub fn get_workspace_info(&self) -> Result<WorkspaceInfo, WorkspaceError> {
        let root = self.active_root.as_ref().ok_or(WorkspaceError::NoActiveWorkspace)?;
        let name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "workspace".to_string());

        let is_git = root.join(".git").exists();
        let (framework, package_manager) = Self::detect_project_type(root);
        let file_count = Self::quick_file_count(root);

        Ok(WorkspaceInfo {
            canonical_root: root.to_string_lossy().to_string(),
            name,
            file_count,
            is_git,
            detected_framework: framework,
            detected_package_manager: package_manager,
        })
    }

    /// Clears the active workspace.
    pub fn clear_workspace(&mut self) {
        self.active_root = None;
    }

    /// Resolves and validates a target path strictly within the active workspace root.
    pub fn resolve_and_validate_path(&self, requested: &str) -> Result<PathBuf, WorkspaceError> {
        let root = self.active_root.as_ref().ok_or(WorkspaceError::NoActiveWorkspace)?;
        Self::validate_path_against_root(root, requested)
    }

    /// Pure security boundary validation against a specified canonical root.
    pub fn validate_path_against_root(root: &Path, requested: &str) -> Result<PathBuf, WorkspaceError> {
        let trimmed = requested.trim();
        if trimmed.is_empty() || trimmed == "." {
            return Ok(root.to_path_buf());
        }

        let requested_path = Path::new(trimmed);

        let candidate = if requested_path.is_absolute() {
            requested_path.to_path_buf()
        } else {
            root.join(requested_path)
        };

        if candidate.exists() {
            let canonical_target = fs::canonicalize(&candidate)
                .map_err(|e| WorkspaceError::IoError(format!("Failed to canonicalize path: {}", e)))?;

            if canonical_target.starts_with(root) {
                Ok(canonical_target)
            } else {
                Err(WorkspaceError::SecurityEscapeViolation {
                    target: requested.to_string(),
                    root: root.to_string_lossy().to_string(),
                })
            }
        } else {
            let mut normalized = root.to_path_buf();
            for component in requested_path.components() {
                match component {
                    Component::Prefix(_) => {
                        if candidate.is_absolute() && !candidate.starts_with(root) {
                            return Err(WorkspaceError::SecurityEscapeViolation {
                                target: requested.to_string(),
                                root: root.to_string_lossy().to_string(),
                            });
                        }
                    }
                    Component::RootDir => {
                        if !candidate.starts_with(root) {
                            return Err(WorkspaceError::SecurityEscapeViolation {
                                target: requested.to_string(),
                                root: root.to_string_lossy().to_string(),
                            });
                        }
                    }
                    Component::CurDir => {}
                    Component::ParentDir => {
                        if !normalized.pop() || !normalized.starts_with(root) {
                            return Err(WorkspaceError::SecurityEscapeViolation {
                                target: requested.to_string(),
                                root: root.to_string_lossy().to_string(),
                            });
                        }
                    }
                    Component::Normal(c) => {
                        normalized.push(c);
                    }
                }
            }

            if !normalized.starts_with(root) {
                return Err(WorkspaceError::SecurityEscapeViolation {
                    target: requested.to_string(),
                    root: root.to_string_lossy().to_string(),
                });
            }

            Err(WorkspaceError::FileNotFound(requested.to_string()))
        }
    }

    /// Lists files and directories inside the active workspace with standard exclusions.
    pub fn list_files(&self, max_depth: Option<usize>) -> Result<Vec<NativeFileEntry>, WorkspaceError> {
        let root = self.active_root.as_ref().ok_or(WorkspaceError::NoActiveWorkspace)?;
        let depth = max_depth.unwrap_or(10);
        let mut entries = Vec::new();

        let walker = WalkDir::new(root)
            .max_depth(depth)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| !Self::is_ignored_dir(e.file_name().to_string_lossy().as_ref()));

        for entry_res in walker {
            if entries.len() >= MAX_DISCOVERY_FILES {
                break;
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            if entry.path() == root {
                continue;
            }

            let rel_path = match entry.path().strip_prefix(root) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            let metadata = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            let is_directory = metadata.is_dir();
            let size_bytes = if is_directory { 0 } else { metadata.len() };
            let modified_timestamp_ms = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let extension = entry
                .path()
                .extension()
                .map(|ext| ext.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            let name = entry.file_name().to_string_lossy().to_string();

            entries.push(NativeFileEntry {
                relative_path: rel_path,
                name,
                is_directory,
                size_bytes,
                modified_timestamp_ms,
                extension,
            });
        }

        Ok(entries)
    }

    /// Reads a UTF-8 text file from within the workspace.
    pub fn read_text_file(&self, relative_path: &str) -> Result<String, WorkspaceError> {
        let resolved = self.resolve_and_validate_path(relative_path)?;

        if resolved.is_dir() {
            return Err(WorkspaceError::IsADirectory(relative_path.to_string()));
        }

        let metadata = fs::metadata(&resolved)
            .map_err(|e| WorkspaceError::IoError(format!("Failed to read metadata: {}", e)))?;

        let file_size = metadata.len();
        if file_size > MAX_READ_BYTES {
            return Err(WorkspaceError::FileTooLarge {
                path: relative_path.to_string(),
                size: file_size,
                max: MAX_READ_BYTES,
            });
        }

        let mut file = File::open(&resolved)
            .map_err(|e| WorkspaceError::IoError(format!("Failed to open file: {}", e)))?;

        let mut buffer = Vec::with_capacity(file_size as usize);
        file.read_to_end(&mut buffer)
            .map_err(|e| WorkspaceError::IoError(format!("Failed to read file: {}", e)))?;

        let check_len = buffer.len().min(8000);
        if buffer[..check_len].contains(&0) {
            return Err(WorkspaceError::BinaryOrUnsupportedEncoding(relative_path.to_string()));
        }

        String::from_utf8(buffer)
            .map_err(|_| WorkspaceError::BinaryOrUnsupportedEncoding(relative_path.to_string()))
    }

    /// Gets metadata for a workspace file or directory.
    pub fn get_metadata(&self, relative_path: &str) -> Result<NativeFileMetadata, WorkspaceError> {
        let resolved = self.resolve_and_validate_path(relative_path)?;

        let meta = fs::metadata(&resolved)
            .map_err(|e| WorkspaceError::IoError(format!("Failed to read metadata: {}", e)))?;

        let is_directory = meta.is_dir();
        let size_bytes = if is_directory { 0 } else { meta.len() };
        let modified_timestamp_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let is_readonly = meta.permissions().readonly();

        Ok(NativeFileMetadata {
            relative_path: relative_path.to_string(),
            canonical_path: resolved.to_string_lossy().to_string(),
            size_bytes,
            modified_timestamp_ms,
            is_directory,
            is_readonly,
        })
    }

    fn is_ignored_dir(name: &str) -> bool {
        matches!(
            name,
            "node_modules"
                | ".git"
                | "dist"
                | "build"
                | "target"
                | ".next"
                | ".turbo"
                | ".cache"
                | "coverage"
                | ".vscode"
                | ".idea"
                | "vendor"
                | "__pycache__"
                | ".venv"
                | "out"
                | ".nuxt"
                | "bin"
                | "obj"
        )
    }

    fn quick_file_count(root: &Path) -> usize {
        WalkDir::new(root)
            .max_depth(3)
            .into_iter()
            .filter_entry(|e| !Self::is_ignored_dir(e.file_name().to_string_lossy().as_ref()))
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .take(500)
            .count()
    }

    fn detect_project_type(root: &Path) -> (String, String) {
        if root.join("package.json").exists() {
            let pkg_mgr = if root.join("bun.lock").exists() || root.join("bun.lockb").exists() {
                "bun"
            } else if root.join("pnpm-lock.yaml").exists() {
                "pnpm"
            } else if root.join("yarn.lock").exists() {
                "yarn"
            } else {
                "npm"
            };

            let framework = if root.join("next.config.js").exists() || root.join("next.config.mjs").exists() || root.join("next.config.ts").exists() {
                "Next.js"
            } else if root.join("vite.config.ts").exists() || root.join("vite.config.js").exists() {
                "Vite SPA"
            } else if root.join("astro.config.mjs").exists() {
                "Astro"
            } else if root.join("svelte.config.js").exists() {
                "SvelteKit"
            } else {
                "Node.js"
            };

            return (framework.to_string(), pkg_mgr.to_string());
        }

        if root.join("Cargo.toml").exists() {
            return ("Rust Cargo".to_string(), "cargo".to_string());
        }

        if root.join("pyproject.toml").exists() || root.join("requirements.txt").exists() {
            return ("Python".to_string(), "pip".to_string());
        }

        if root.join("go.mod").exists() {
            return ("Go".to_string(), "go".to_string());
        }

        ("Generic Workspace".to_string(), "unknown".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_valid_file_inside_workspace_allowed() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let file_path = root.join("hello.txt");
        let mut f = File::create(&file_path).expect("Failed to create file");
        writeln!(f, "Hello Axion").expect("Failed to write");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let resolved = mgr.resolve_and_validate_path("hello.txt").expect("Should allow valid file");
        assert_eq!(resolved, file_path);

        let content = mgr.read_text_file("hello.txt").expect("Should read text file");
        assert!(content.contains("Hello Axion"));
    }

    #[test]
    fn test_valid_nested_file_allowed() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let sub_dir = root.join("src").join("utils");
        fs::create_dir_all(&sub_dir).expect("Failed to create sub dir");
        let file_path = sub_dir.join("test.rs");
        let mut f = File::create(&file_path).expect("Failed to create file");
        writeln!(f, "pub fn test() {{}}").expect("Failed to write");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let resolved = mgr.resolve_and_validate_path("src/utils/test.rs").expect("Should allow nested file");
        assert_eq!(resolved, file_path);

        let content = mgr.read_text_file("src/utils/test.rs").expect("Should read nested file");
        assert!(content.contains("pub fn test()"));
    }

    #[test]
    fn test_parent_traversal_outside_rejected() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let err = mgr.resolve_and_validate_path("../outside.txt");
        assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));

        let err2 = mgr.resolve_and_validate_path("foo/../../outside.txt");
        assert!(matches!(err2, Err(WorkspaceError::SecurityEscapeViolation { .. })));
    }

    #[test]
    fn test_absolute_outside_path_rejected() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let other_dir = tempdir().expect("Failed to create other tempdir");
        let other_file = other_dir.path().join("secret.txt");
        File::create(&other_file).expect("Failed to create secret file");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let outside_str = other_file.to_string_lossy().to_string();
        let err = mgr.resolve_and_validate_path(&outside_str);
        assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
    }

    #[test]
    fn test_nonexistent_file_inside_workspace_returns_structured_error() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let err = mgr.resolve_and_validate_path("nonexistent_file.txt");
        assert_eq!(err, Err(WorkspaceError::FileNotFound("nonexistent_file.txt".to_string())));
    }

    #[cfg(unix)]
    #[test]
    fn test_symlink_escape_outside_workspace_rejected() {
        use std::os::unix::fs::symlink;

        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let outside_dir = tempdir().expect("Failed to create outside tempdir");
        let outside_file = outside_dir.path().join("outside_target.txt");
        let mut f = File::create(&outside_file).expect("Failed to create outside file");
        writeln!(f, "Top Secret").expect("Write failed");

        let symlink_path = root.join("symlink_escape.txt");
        symlink(&outside_file, &symlink_path).expect("Failed to create symlink");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let err = mgr.resolve_and_validate_path("symlink_escape.txt");
        assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));

        let read_err = mgr.read_text_file("symlink_escape.txt");
        assert!(matches!(read_err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
    }

    #[cfg(windows)]
    #[test]
    fn test_windows_junction_reparse_escape_rejected() {
        use std::os::windows::fs::symlink_dir;

        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let outside_dir = tempdir().expect("Failed to create outside tempdir");
        let outside_target = outside_dir.path().join("secrets");
        fs::create_dir_all(&outside_target).expect("Failed to create outside dir");
        let secret_file = outside_target.join("keys.json");
        let mut f = File::create(&secret_file).expect("Failed to create key file");
        writeln!(f, "TOP_SECRET").expect("Write failed");

        let junction_link = root.join("junction_escape");
        match symlink_dir(&outside_target, &junction_link) {
            Ok(_) => {
                let mut mgr = WorkspaceManager::new();
                mgr.set_workspace_root(&root).expect("Failed to set root");

                let err = mgr.resolve_and_validate_path("junction_escape/keys.json");
                assert!(matches!(err, Err(WorkspaceError::SecurityEscapeViolation { .. })));
            }
            Err(e) => {
                eprintln!("Skipping junction test (privilege required): {}", e);
            }
        }
    }

    #[test]
    fn test_binary_file_detection() {
        let dir = tempdir().expect("Failed to create tempdir");
        let root = fs::canonicalize(dir.path()).expect("Canonicalize failed");

        let bin_file = root.join("image.bin");
        let mut f = File::create(&bin_file).expect("Failed to create bin file");
        f.write_all(&[0x89, 0x50, 0x4E, 0x47, 0x00, 0x01, 0x02]).expect("Write failed");

        let mut mgr = WorkspaceManager::new();
        mgr.set_workspace_root(&root).expect("Failed to set root");

        let err = mgr.read_text_file("image.bin");
        assert!(matches!(err, Err(WorkspaceError::BinaryOrUnsupportedEncoding(_))));
    }
}
