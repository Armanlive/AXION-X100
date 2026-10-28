import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncChange, type SyncStatus } from '../services/memorySync.ts';

/** Lightweight cloud-sync status for a small header/drawer indicator. */
export function useCloudSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  useEffect(() => onSyncChange(setStatus), []);
  return status;
}
