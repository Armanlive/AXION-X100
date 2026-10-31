#!/usr/bin/env bash
# Explicit cloud maintenance entry point: validate an isolated candidate, then publish named files.
set -euo pipefail
[ "$#" -ge 2 ] || { echo 'Usage: bash scripts/verified-sync.sh "commit message" path [path ...]' >&2; exit 2; }
message=$1
shift
cd "$(git rev-parse --show-toplevel)"
repo=$PWD
[ "$(git branch --show-current)" = main ] || { echo 'Run from main.' >&2; exit 1; }
git diff --cached --quiet || { echo 'Preserve existing staged work before syncing.' >&2; exit 1; }
for path in "$@"; do
 case "$path" in /*|*..*|.git*|.env*) echo 'Unsafe sync path.' >&2; exit 1;; esac
 [ -f "$path" ] || { echo "Missing file: $path" >&2; exit 1; }
done
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
# Copy only the Git source tree plus explicitly named new files, never credentials/caches.
git archive HEAD | tar -x -C "$scratch"
for path in "$@"; do mkdir -p "$scratch/$(dirname "$path")"; cp -- "$path" "$scratch/$path"; done
ln -s "$PWD/node_modules" "$scratch/node_modules"
(cd "$scratch" && npm run lint && npm run build && npm test)
# Native and Python changes must pass their own suites too (frontend checks do not cover them).
for path in "$@"; do
 case "$path" in
  src-tauri/*) need_rust=1;;
  src-python/*) need_python=1;;
 esac
done
if [ -n "${need_rust:-}" ]; then
 (cd "$scratch/src-tauri" && CARGO_TARGET_DIR="$repo/src-tauri/target" cargo test --locked) || { echo 'Rust tests failed; nothing published.' >&2; exit 1; }
fi
if [ -n "${need_python:-}" ]; then
 (cd "$scratch/src-python" && python3 -m pytest -q tests) || { echo 'Python tests failed; nothing published.' >&2; exit 1; }
fi
# Do not publish a candidate that changed while validation was running.
for path in "$@"; do cmp -- "$path" "$scratch/$path"; done
git add -- "$@"
git diff --cached --check
git commit -m "$message"
git push origin main
