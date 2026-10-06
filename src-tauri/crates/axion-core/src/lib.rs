pub mod vault;
pub mod workspace;

pub use vault::{SnapshotMetadata, SnapshotVault, VaultError};
pub use workspace::{
    NativeFileEntry, NativeFileMetadata, WorkspaceError, WorkspaceInfo, WorkspaceManager,
};
