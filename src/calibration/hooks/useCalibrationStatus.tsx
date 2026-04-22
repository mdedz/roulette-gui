import { useCallback, useEffect, useRef, useState } from 'react';
import { getStatus, type StatusResponse } from '../api';

type HookReturn = {
  status: StatusResponse | null;
  lastError: string | null;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
};

export function useCalibrationStatus(getBaseUrl: () => string): HookReturn {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollingRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const baseIntervalRef = useRef<number>(7000);
  const isMounted = useRef(true);

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
      const url = getBaseUrl();
      const res = await getStatus(url);
      if (!isMounted.current) return;
      setStatus(res);
      setLastError(null);
      backoffRef.current = 1000; // reset on success
      // choose interval based on running flag
      const running = (res as any).running === true;
      baseIntervalRef.current = running ? 500 : 7000;
    } catch (err: any) {
      if (!isMounted.current) return;
      setLastError(String(err?.message ?? err));
      // exponential backoff
      const next = Math.min(backoffRef.current * 2, 30000);
      backoffRef.current = next;
    }
    return;
  }, [getBaseUrl]);

  const loop = useCallback(async () => {
    if (!pollingRef.current) return;
    try {
      const url = getBaseUrl();
      const res = await getStatus(url);
      if (!isMounted.current) return;
      setStatus(res);
      setLastError(null);
      backoffRef.current = 1000;
      const running = (res as any).running === true;
      const interval = running ? 500 : 7000;
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
    clearTimer();
  }, []);

  const refresh = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  return {
    status,
    lastError,
    isPolling: pollingRef.current,
    startPolling,
    stopPolling,
    refresh,
  };
}

