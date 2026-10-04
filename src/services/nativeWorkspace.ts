/**
 * AXION-X100 — Native Workspace Service & Tauri v2 IPC Bridge
 *
 * Provides a clean, typed bridge between the React frontend and the Rust native
 * workspace boundary in Tauri v2.
 */

import { isTauri, invoke } from '@tauri-apps/api/core';

export interface NativeWorkspaceInfo {
  canonical_root: string;
  name: string;
  file_count: number;
  is_git: boolean;
  detected_framework: string;
  detected_package_manager: string;
}

export interface NativeFileEntry {
  relative_path: string;
  name: string;
  is_directory: boolean;
  size_bytes: number;
  modified_timestamp_ms: number;
  extension: string;
}

export interface NativeFileMetadata {
  relative_path: string;
  canonical_path: string;
  size_bytes: number;
  modified_timestamp_ms: number;
  is_directory: boolean;
  is_readonly: boolean;
}

export interface NativeMountResult {
  workspace: NativeWorkspaceInfo;
  files: NativeFileEntry[];
}

export class NativeWorkspaceService {
  /**
   * Checks whether the application is running inside a genuine Tauri desktop environment.
   */
  public static isNative(): boolean {
    try {
      return isTauri();
    } catch {
      return false;
    }
  }

  /**
   * Prompts the user to select a native folder via Tauri dialog plugin if available.
   */
  public static async selectFolderDialog(): Promise<string | null> {
    if (!this.isNative()) {
      throw new Error(
        'Native folder dialog is only available when running inside the Tauri desktop application.'
      );
    }

    try {
      // Dynamic import of plugin-dialog to prevent build failures in environments where it is optional
      // @ts-ignore
      const dialog = await import('@tauri-apps/plugin-dialog').catch(() => null);
      if (dialog && typeof dialog.open === 'function') {
        const selected = await dialog.open({
          directory: true,
          multiple: false,
          title: 'Select Project Workspace Directory',
        });
        if (typeof selected === 'string' && selected.trim()) {
          return selected.trim();
        }
      }
    } catch (e) {
      console.warn('Tauri dialog plugin error:', e);
    }

    return null;
  }

  /**
   * Sets the canonical workspace root in the native Rust runtime.
   * Rust canonicalizes the path and enforces the security boundary.
   */
  public static async setWorkspaceRoot(absolutePath: string): Promise<NativeWorkspaceInfo> {
    if (!this.isNative()) {
      throw new Error(
        'Cannot establish native workspace: Tauri desktop runtime is not active in this browser environment.'
      );
    }

    try {
      const info = await invoke<NativeWorkspaceInfo>('set_workspace_root', {
        path: absolutePath,
      });
      return info;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native Workspace Error: ${msg}`);
    }
  }

  /**
   * Gets the active workspace info from Rust state.
   */
  public static async getWorkspaceInfo(): Promise<NativeWorkspaceInfo> {
    if (!this.isNative()) {
      throw new Error('Tauri desktop runtime is not active.');
    }
    try {
      return await invoke<NativeWorkspaceInfo>('get_workspace_info');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native Workspace Error: ${msg}`);
    }
  }

  /**
   * Lists files inside the active workspace from the real disk via Rust WalkDir.
   */
  public static async listFiles(maxDepth?: number): Promise<NativeFileEntry[]> {
    if (!this.isNative()) {
      throw new Error('Tauri desktop runtime is not active.');
    }
    try {
      return await invoke<NativeFileEntry[]>('list_workspace_files', {
        maxDepth: maxDepth ?? 10,
      });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native File Listing Error: ${msg}`);
    }
  }

  /**
   * Reads a text file from disk inside the workspace boundary.
   * Enforced strictly by Rust against path traversal, symlink escapes, and binary files.
   */
  public static async readTextFile(relativePath: string): Promise<string> {
    if (!this.isNative()) {
      throw new Error('Tauri desktop runtime is not active.');
    }
    try {
      return await invoke<string>('read_workspace_text_file', {
        relativePath,
      });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native Read Error (${relativePath}): ${msg}`);
    }
  }

  /**
   * Gets metadata for a workspace path from disk.
   */
  public static async getFileMetadata(relativePath: string): Promise<NativeFileMetadata> {
    if (!this.isNative()) {
      throw new Error('Tauri desktop runtime is not active.');
    }
    try {
      return await invoke<NativeFileMetadata>('get_file_metadata', {
        relativePath,
      });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native Metadata Error (${relativePath}): ${msg}`);
    }
  }

  /**
   * Clears the active workspace in Rust memory.
   * Throws if Rust fails to clear the active boundary.
   */
  public static async clearWorkspace(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await invoke('clear_workspace');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
      throw new Error(`Native Clear Workspace Error: ${msg}`);
    }
  }
}
