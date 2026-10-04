import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Models the fail-closed transactional workspace authorization engine.
 * Matches exact logic implemented in useAxionStore and NativeWorkspaceService.
 */
interface MockWorkspace {
  id: string;
  name: string;
  path: string;
  absolutePath: string;
}

interface MockState {
  activeWorkspace: MockWorkspace | null;
  scanStatusMessage: string | null;
  syncError: {
    phase: string;
    attemptedWorkspace: string;
    previousWorkspace?: string;
    message: string;
    rustStateUncertain: boolean;
  } | null;
}

class TransactionalWorkspaceController {
  public rustAuthorizedRoot: string | null = null;
  public state: MockState = {
    activeWorkspace: null,
    scanStatusMessage: null,
    syncError: null
  };

  // Mock injectors for testing error branches
  public setRootError: Error | null = null;
  public listFilesError: Error | null = null;
  public rollbackError: Error | null = null;
  public clearWorkspaceError: Error | null = null;

  async setWorkspaceRoot(path: string): Promise<{ canonical_root: string; name: string }> {
    if (this.setRootError) throw this.setRootError;
    this.rustAuthorizedRoot = path;
    return { canonical_root: path, name: path.split('/').pop() || path };
  }

  async listFiles(): Promise<string[]> {
    if (this.listFilesError) throw this.listFilesError;
    return ['file1.ts', 'package.json'];
  }

  async clearWorkspace(): Promise<void> {
    if (this.clearWorkspaceError) throw this.clearWorkspaceError;
    this.rustAuthorizedRoot = null;
  }

  async switchWorkspace(ws: MockWorkspace): Promise<void> {
    const prevActiveWs = this.state.activeWorkspace;
    const prevPath = prevActiveWs?.absolutePath;

    let rootSwitchedInRust = false;
    try {
      this.state.scanStatusMessage = `Activating native workspace: ${ws.path}...`;
      await this.setWorkspaceRoot(ws.path);
      rootSwitchedInRust = true;

      // Initialization step (e.g. list files)
      await this.listFiles();

      // Commit frontend state only on full success
      this.state.activeWorkspace = ws;
      this.state.scanStatusMessage = `Switched native workspace to "${ws.name}".`;
      this.state.syncError = null;
    } catch (err: any) {
      if (rootSwitchedInRust) {
        if (prevActiveWs && prevPath) {
          try {
            await this.setWorkspaceRoot(prevPath);
            // Rollback to A succeeded
            this.state.scanStatusMessage = `Failed to initialize workspace "${ws.name}": ${err.message}. Successfully rolled back authorization to "${prevActiveWs.name}".`;
            this.state.syncError = null;
            return;
          } catch (rollbackErr: any) {
            try {
              await this.clearWorkspace();
              // Emergency clear succeeded
              this.state.activeWorkspace = null;
              this.state.scanStatusMessage = `Switch to "${ws.name}" and rollback to "${prevActiveWs.name}" both failed. Rust workspace authorization was safely cleared.`;
              this.state.syncError = {
                phase: 'clear',
                attemptedWorkspace: ws.path,
                previousWorkspace: prevPath,
                message: `Switch to "${ws.path}" failed, rollback to "${prevPath}" failed. Rust authorization was safely cleared.`,
                rustStateUncertain: false
              };
              return;
            } catch (clearErr: any) {
              // Emergency clear ALSO failed: FATAL FAIL-CLOSED
              const fatal = {
                phase: 'clear',
                attemptedWorkspace: ws.path,
                previousWorkspace: prevPath,
                message: `CRITICAL: Workspace switch to "${ws.path}" failed, rollback to "${prevPath}" failed, and emergency clear_workspace also failed. Rust authorization state is uncertain. Recovery required.`,
                rustStateUncertain: true
              };
              this.state.activeWorkspace = {
                ...prevActiveWs,
                name: `[DESYNC ERROR] ${prevActiveWs.name}`
              };
              this.state.scanStatusMessage = `FATAL: Workspace synchronization failure. Rust authorization state is uncertain.`;
              this.state.syncError = fatal;
              throw new Error(fatal.message);
            }
          }
        } else {
          // First workspace activation (no previous A)
          try {
            await this.clearWorkspace();
            this.state.activeWorkspace = null;
            this.state.scanStatusMessage = `Activation of workspace "${ws.name}" failed during initialization. Rust authorization was safely cleared.`;
            this.state.syncError = null;
            return;
          } catch (clearErr: any) {
            const fatal = {
              phase: 'clear',
              attemptedWorkspace: ws.path,
              message: `CRITICAL: Activation of workspace "${ws.path}" failed during initialization, and emergency clear_workspace also failed. Rust authorization may still be active.`,
              rustStateUncertain: true
            };
            this.state.scanStatusMessage = `FATAL: Workspace initialization failed and emergency clear failed. Rust authorization may remain active.`;
            this.state.syncError = fatal;
            throw new Error(fatal.message);
          }
        }
      }

      this.state.scanStatusMessage = `Failed to switch native workspace: ${err.message}`;
    }
  }
}

describe('AXION Fail-Closed Workspace Transactional Synchronization', () => {
  const wsA: MockWorkspace = { id: 'ws-a', name: 'Workspace A', path: '/home/user/project_a', absolutePath: '/home/user/project_a' };
  const wsB: MockWorkspace = { id: 'ws-b', name: 'Workspace B', path: '/home/user/project_b', absolutePath: '/home/user/project_b' };

  it('1. successful A -> B switch commits both Rust authorization and frontend state', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = wsA;
    ctrl.rustAuthorizedRoot = wsA.absolutePath;

    await ctrl.switchWorkspace(wsB);

    assert.equal(ctrl.rustAuthorizedRoot, wsB.absolutePath);
    assert.equal(ctrl.state.activeWorkspace?.id, wsB.id);
    assert.equal(ctrl.state.syncError, null);
  });

  it('2. B set-root failure preserves previous frontend A and leaves A authorized in Rust', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = wsA;
    ctrl.rustAuthorizedRoot = wsA.absolutePath;
    ctrl.setRootError = new Error('Path traversal outside canonical root rejected');

    await ctrl.switchWorkspace(wsB);

    assert.equal(ctrl.rustAuthorizedRoot, wsA.absolutePath);
    assert.equal(ctrl.state.activeWorkspace?.id, wsA.id);
    assert.match(ctrl.state.scanStatusMessage || '', /Failed to switch native workspace/);
  });

  it('3. B initialization failure + successful rollback to A restores A and surfaces failure', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = wsA;
    ctrl.rustAuthorizedRoot = wsA.absolutePath;
    ctrl.listFilesError = new Error('I/O error reading directory B');

    await ctrl.switchWorkspace(wsB);

    assert.equal(ctrl.rustAuthorizedRoot, wsA.absolutePath);
    assert.equal(ctrl.state.activeWorkspace?.id, wsA.id);
    assert.match(ctrl.state.scanStatusMessage || '', /Successfully rolled back authorization to "Workspace A"/);
    assert.equal(ctrl.state.syncError, null);
  });

  it('4. B initialization failure + rollback A failure + successful clear disconnects cleanly', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = wsA;
    ctrl.rustAuthorizedRoot = wsA.absolutePath;
    ctrl.listFilesError = new Error('I/O error reading directory B');

    // Simulate rollback error (e.g. Workspace A was deleted from disk externally)
    ctrl.setWorkspaceRoot = async (p: string) => {
      if (p === wsA.absolutePath) throw new Error('Workspace A no longer accessible on disk');
      ctrl.rustAuthorizedRoot = p;
      return { canonical_root: p, name: 'B' };
    };

    await ctrl.switchWorkspace(wsB);

    assert.equal(ctrl.rustAuthorizedRoot, null);
    assert.equal(ctrl.state.activeWorkspace, null);
    assert.equal(ctrl.state.syncError?.rustStateUncertain, false);
    assert.match(ctrl.state.scanStatusMessage || '', /Rust workspace authorization was safely cleared/);
  });

  it('5. B initialization failure + rollback A failure + clear failure enters fatal fail-closed error state', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = wsA;
    ctrl.rustAuthorizedRoot = wsA.absolutePath;
    ctrl.listFilesError = new Error('I/O error reading directory B');

    ctrl.setWorkspaceRoot = async (p: string) => {
      if (p === wsA.absolutePath) throw new Error('Workspace A deleted on disk');
      ctrl.rustAuthorizedRoot = p;
      return { canonical_root: p, name: 'B' };
    };
    ctrl.clearWorkspaceError = new Error('IPC timeout clearing workspace in Rust');

    await assert.rejects(async () => {
      await ctrl.switchWorkspace(wsB);
    }, /CRITICAL: Workspace switch to .* failed, rollback to .* failed, and emergency clear_workspace also failed/);

    // Invariant verification:
    // MUST NOT claim disconnected
    // MUST NOT claim A is safely authorized
    // MUST NOT swallow error
    assert.notEqual(ctrl.state.activeWorkspace, null);
    assert.equal(ctrl.state.activeWorkspace?.name, '[DESYNC ERROR] Workspace A');
    assert.equal(ctrl.state.syncError?.rustStateUncertain, true);
    assert.match(ctrl.state.scanStatusMessage || '', /FATAL: Workspace synchronization failure/);
  });

  it('6. first workspace initialization failure + successful clear resets to clean disconnected state', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = null;
    ctrl.listFilesError = new Error('Permission denied scanning initial directory');

    await ctrl.switchWorkspace(wsB);

    assert.equal(ctrl.rustAuthorizedRoot, null);
    assert.equal(ctrl.state.activeWorkspace, null);
    assert.equal(ctrl.state.syncError, null);
    assert.match(ctrl.state.scanStatusMessage || '', /Rust authorization was safely cleared/);
  });

  it('7. first workspace initialization failure + clear failure enters fatal error and does NOT claim cleared', async () => {
    const ctrl = new TransactionalWorkspaceController();
    ctrl.state.activeWorkspace = null;
    ctrl.listFilesError = new Error('Permission denied scanning initial directory');
    ctrl.clearWorkspaceError = new Error('Rust clear failed');

    await assert.rejects(async () => {
      await ctrl.switchWorkspace(wsB);
    }, /CRITICAL: Activation of workspace .* failed during initialization, and emergency clear_workspace also failed/);

    assert.equal(ctrl.state.syncError?.rustStateUncertain, true);
    assert.match(ctrl.state.scanStatusMessage || '', /FATAL: Workspace initialization failed and emergency clear failed/);
  });
});
