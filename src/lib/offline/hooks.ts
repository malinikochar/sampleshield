'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOfflineDB } from '@/lib/offline/db';
import { syncPendingOfflineEvents, type SyncBatchSummary } from '@/lib/offline/sync-manager';
import type { CachedCourierAssignment, OfflineQueuedEvent } from '@/types/domain';

const SIMULATED_OFFLINE_STORAGE_KEY = 'sampleshield_demo_simulated_offline';

function subscribeBrowserOnline(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getBrowserOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getBrowserOnlineServerSnapshot() {
  return true;
}

function subscribeSimulatedOffline(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('sampleshield:offline-mode-changed', onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener('sampleshield:offline-mode-changed', onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function getSimulatedOfflineServerSnapshot() {
  return false;
}

export function useNetworkAndOfflineQueue(params: {
  organizationId: string;
  actorUserId: string;
  isDemoOrg: boolean;
  onSynced?: (summary: SyncBatchSummary) => void;
}) {
  const { organizationId, actorUserId, isDemoOrg, onSynced } = params;

  const browserOnline = useSyncExternalStore(
    subscribeBrowserOnline,
    getBrowserOnlineSnapshot,
    getBrowserOnlineServerSnapshot
  );

  const getSimulatedOfflineSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !isDemoOrg) return false;
    return window.sessionStorage.getItem(SIMULATED_OFFLINE_STORAGE_KEY) === 'true';
  }, [isDemoOrg]);

  const simulatedOffline = useSyncExternalStore(
    subscribeSimulatedOffline,
    getSimulatedOfflineSnapshot,
    getSimulatedOfflineServerSnapshot
  );

  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncBatchSummary | null>(null);

  const setSimulatedOffline = useCallback(
    (nextValue: boolean) => {
      if (typeof window === 'undefined' || !isDemoOrg) return;
      if (nextValue) {
        window.sessionStorage.setItem(SIMULATED_OFFLINE_STORAGE_KEY, 'true');
      } else {
        window.sessionStorage.removeItem(SIMULATED_OFFLINE_STORAGE_KEY);
      }
      window.dispatchEvent(new Event('sampleshield:offline-mode-changed'));
    },
    [isDemoOrg]
  );

  const effectiveOnline = browserOnline && !simulatedOffline;

  const rawQueuedEvents = useLiveQuery(async () => {
    if (!organizationId || !actorUserId) return [] as OfflineQueuedEvent[];
    const db = getOfflineDB();
    const rows = await db.queued_events
      .where('[organization_id+actor_user_id]')
      .equals([organizationId, actorUserId])
      .reverse()
      .sortBy('created_at_ms');
    return rows;
  }, [organizationId, actorUserId]);

  const queuedEvents = useMemo(() => rawQueuedEvents ?? [], [rawQueuedEvents]);

  const rawCachedAssignments = useLiveQuery(async () => {
    if (!organizationId || !actorUserId) return [] as CachedCourierAssignment[];
    const db = getOfflineDB();
    return db.cached_assignments
      .where('[organization_id+courier_user_id]')
      .equals([organizationId, actorUserId])
      .toArray();
  }, [organizationId, actorUserId]);

  const cachedAssignments = useMemo(
    () => rawCachedAssignments ?? [],
    [rawCachedAssignments]
  );

  const triggerSync = useCallback(
    async (forceManualRetry = false) => {
      if (!organizationId || !actorUserId) return null;
      if (!effectiveOnline && !forceManualRetry) return null;
      if (simulatedOffline && forceManualRetry) {
        return null;
      }

      setIsSyncingNow(true);
      try {
        const result = await syncPendingOfflineEvents({
          organizationId,
          actorUserId,
          forceManualRetry,
        });
        setLastSyncSummary(result);
        if (result.synced > 0 || result.conflicts > 0) {
          onSynced?.(result);
        }
        return result;
      } finally {
        setIsSyncingNow(false);
      }
    },
    [organizationId, actorUserId, effectiveOnline, simulatedOffline, onSynced]
  );

  const pendingRetryableCount = useMemo(
    () =>
      queuedEvents.filter(
        (e) => e.sync_state === 'queued' || e.sync_state === 'failed_retriable'
      ).length,
    [queuedEvents]
  );

  // Sync automatically on reconnect or foreground focus
  useEffect(() => {
    if (!effectiveOnline) return;

    let timerId: number | undefined;
    if (pendingRetryableCount > 0) {
      timerId = window.setTimeout(() => {
        void triggerSync(false);
      }, 50);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && effectiveOnline) {
        void triggerSync(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [effectiveOnline, pendingRetryableCount, triggerSync]);

  const pendingOnDeviceCount = useMemo(
    () =>
      queuedEvents.filter(
        (e) =>
          e.sync_state === 'queued' ||
          e.sync_state === 'syncing' ||
          e.sync_state === 'failed_retriable'
      ).length,
    [queuedEvents]
  );

  const conflictCount = useMemo(
    () => queuedEvents.filter((e) => e.sync_state === 'conflict').length,
    [queuedEvents]
  );

  return {
    browserOnline,
    simulatedOffline,
    setSimulatedOffline,
    effectiveOnline,
    queuedEvents,
    cachedAssignments,
    pendingOnDeviceCount,
    conflictCount,
    isSyncingNow,
    lastSyncSummary,
    triggerSync,
  };
}
