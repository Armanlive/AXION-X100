pub mod vault;
pub mod workspace;

pub use vault::{
    SnapshotMetadata, SnapshotVault, VaultAuthKey, VaultError, CURRENT_SCHEMA_VERSION,
};
pub use workspace::{
    NativeFileEntry, NativeFileMetadata, WorkspaceError, WorkspaceInfo, WorkspaceManager,
};
