#!/usr/bin/env bash
# Compile the real shared API client without requiring a graphical desktop toolchain.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v cargo >/dev/null || { echo 'Install a stable Rust toolchain first.' >&2; exit 1; }
case "$PWD" in *'"'*|*'\'*) echo 'Use a source path without quotes or backslashes.' >&2; exit 1;; esac
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/src"
cp src-tauri/src/integration_plan.rs src-tauri/src/integration_client.rs "$scratch/src/"
cat > "$scratch/src/lib.rs" <<'RUST'
pub mod integration_plan;
pub mod integration_client;
RUST
cat > "$scratch/Cargo.toml" <<'TOML'
[package]
name = "axion-integration-client-check"
version = "0.1.0"
edition = "2021"
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
TOML
cargo test --manifest-path "$scratch/Cargo.toml"
