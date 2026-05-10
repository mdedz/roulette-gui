import { useCallback, useEffect, useRef, useState } from 'react';
import { getStatus, type StatusResponse } from '../api';
import type { RuntimeStatus } from '../useCalibrationStatus';

type HookReturn = {
  status: StatusResponse | null;
  runtimeStatus: RuntimeStatus | null;
  lastError: string | null;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
};

export function useCalibrationStatus(getBaseUrl: () => string): HookReturn {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollingRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const baseIntervalRef = useRef<number>(4000);
  const isMounted = useRef(true);
  const runtimeTimerRef = useRef<number | null>(null);
  const RUNTIME_POLL_INTERVAL = 4000;
  const getBaseUrlRef = useRef(getBaseUrl);

  useEffect(() => {
    getBaseUrlRef.current = getBaseUrl;
  }, [getBaseUrl]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = (delay: number, fn: () => void) => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (!isMounted.current) return;
      fn();
    }, delay);
  };

  const fetchOnce = useCallback(async () => {
    try {
      const url = getBaseUrlRef.current();
      console.log('[calib-hook] fetchOnce requesting', url);
      const res = await getStatus(url);
      console.log('[calib-hook] fetchOnce received', { ok: (res as any)?.ok, running: (res as any)?.running });
      // runtime status is polled independently (to avoid overloading runtime when main poll is fast)
      if (!isMounted.current) return;
      setStatus(res);
      setLastError(null);
      backoffRef.current = 1000; // reset on success
      // choose interval based on running flag
      const running = (res as any).running === true;
      baseIntervalRef.current = 4000;
    } catch (err: any) {
      if (!isMounted.current) return;
      setLastError(String(err?.message ?? err));
      // exponential backoff
      const next = Math.min(backoffRef.current * 2, 30000);
      backoffRef.current = next;
    }
    return;
  }, []);

  const fetchRuntimeOnce = useCallback(async () => {
    try {
      const url = getBaseUrlRef.current();
      const runtimeUrl = `${url.replace(/\/$/, '')}/api/runtime/calibration_status`;
      console.log('[calib-hook] fetchRuntimeOnce requesting runtime at', runtimeUrl);
      const r = await fetch(runtimeUrl, { method: 'GET', mode: 'cors', cache: 'no-store' });
      const runtimeJson = await r.json().catch(() => null);
      console.log('[calib-hook] fetchRuntimeOnce received', runtimeJson);
      if (!isMounted.current) return;
      setRuntimeStatus((runtimeJson && runtimeJson.runtime_status) || null);
    } catch (e) {
      console.log('[calib-hook] fetchRuntimeOnce error', e);
      if (!isMounted.current) return;
      setRuntimeStatus(null);
    }
  }, []);

  // start independent runtime polling on mount
  useEffect(() => {
    runtimeTimerRef.current = window.setInterval(() => {
      fetchRuntimeOnce().catch(() => {});
    }, RUNTIME_POLL_INTERVAL) as unknown as number;
    // fetch immediately once
    fetchRuntimeOnce().catch(() => {});
    return () => {
      if (runtimeTimerRef.current) {
        window.clearInterval(runtimeTimerRef.current);
        runtimeTimerRef.current = null;
      }
    };
  }, [fetchRuntimeOnce]);

  const loop = useCallback(async () => {
    if (!pollingRef.current) return;
    try {
      const url = getBaseUrlRef.current();
      console.log('[calib-hook] loop requesting', url);
      const res = await getStatus(url);
      console.log('[calib-hook] loop received', { ok: (res as any)?.ok, running: (res as any)?.running });
      // runtime status is polled independently (see fetchRuntimeOnce)
      if (!isMounted.current) return;
      setStatus(res);
      setLastError(null);
      backoffRef.current = 1000;
      const running = (res as any).running === true;
      const interval = 4000;
      baseIntervalRef.current = interval;
      // schedule next poll
      scheduleNext(interval, loop);
    } catch (err: any) {
      if (!isMounted.current) return;
      setLastError(String(err?.message ?? err));
      const delay = Math.min(Math.max(backoffRef.current, 1000), 30000);
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      scheduleNext(delay, loop);
    }
  }, [getBaseUrl]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    console.log('[calib-hook] startPolling');
    // immediate fetch then start loop
    (async () => {
      try {
        await fetchOnce();
      } finally {
        if (!isMounted.current) return;
        scheduleNext(baseIntervalRef.current, loop);
      }
    })();
  }, [fetchOnce, loop]);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    console.log('[calib-hook] stopPolling');
    clearTimer();
  }, []);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  return {
    status,
    runtimeStatus,
    lastError,
    isPolling: pollingRef.current,
    startPolling,
    stopPolling,
    refresh,
  };
}

