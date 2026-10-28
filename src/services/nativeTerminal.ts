/** AXION-X100 — Native Terminal Shell Service & Tauri v2 IPC Bridge */
import { isTauri, invoke, type Channel } from '@tauri-apps/api/core';

export interface TerminalOpenResult {
  id: string;
  cwd: string;
  output: Channel<{ kind: 'data'; bytes: number[] } | { kind: 'exit'; code: number | null } | { kind: 'error'; message: string }>;
}

export class NativeTerminalShell {
  private static terminalIdBySession = new Map<string, string>();
  private static outputChannel: Channel<{ kind: 'data'; bytes: number[] } | { kind: 'exit'; code: number | null } | { kind: 'error'; message: string }> | null = null;

  public static async openShell(sessionId: string, shellType: 'powershell' | 'cmd'): Promise<{ id: string; cwd: string }> {
    if (!isTauri()) throw new Error('Native terminal requires the AXION desktop app.');
    const result = await invoke<TerminalOpenResult>('native_terminal_open', {
      sessionId,
      shellType,
      cols: 120,
      rows: 30
    });
    this.terminalIdBySession.set(sessionId, result.id);
    this.outputChannel = result.output;
    return { id: result.id, cwd: result.cwd };
  }

  public static async write(sessionId: string, data: string): Promise<void> {
    const id = this.terminalIdBySession.get(sessionId);
    if (!id) throw new Error('No terminal session.');
    await invoke<void>('native_terminal_write', { id, data });
  }

  public static async closeSession(sessionId: string): Promise<void> {
    const id = this.terminalIdBySession.get(sessionId);
    if (id) await invoke<void>('native_terminal_close', { id });
    this.terminalIdBySession.delete(sessionId);
  }

  public static getOutputChannel(): Channel<{ kind: 'data'; bytes: number[] } | { kind: 'exit'; code: number | null } | { kind: 'error'; message: string }> | null {
    return this.outputChannel;
  }
}
