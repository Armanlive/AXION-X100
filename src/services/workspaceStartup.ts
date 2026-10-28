import { invoke } from '@tauri-apps/api/core';
import { NativeWorkspaceService } from './nativeWorkspace';
import { useAxionStore } from '../store/useAxionStore';

let startup: Promise<void> | undefined;
/** One native reauthorization per page load, including React StrictMode. */
export function initializeWorkspace(): Promise<void> {
  if (!NativeWorkspaceService.isNative()) return Promise.resolve();
  return startup ??= (async () => {
    const saved = useAxionStore.getState().activeWorkspace;
    useAxionStore.setState({ activeWorkspace: null, activeWorkspaceId: '', projectPath: '' });
    try {
      const path = saved?.runtimeMode === 'native-tauri' ? saved.absolutePath : await invoke<string>('default_workspace_path');
      await useAxionStore.getState().mountNativeWorkspace(path);
    } catch (error) {
      // A stale saved path must not remain presented as authorized.
      useAxionStore.setState({ activeWorkspace: null, activeWorkspaceId: '', projectPath: '',
        scanStatusMessage: `Workspace startup failed: ${String(error)}. Select a workspace to retry.` });
    }
  })();
}
