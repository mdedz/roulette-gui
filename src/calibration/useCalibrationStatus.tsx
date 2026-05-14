import { useEffect, useRef, useState } from 'react';
import { BASE_URL, StatusResponse, getStatus } from './api';

type UseCalibrationResult = {
  calibrationStatus: StatusResponse | null;
  loading: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 1500;
const FETCH_TIMEOUT_MS = 7000;

export function useCalibrationStatus(): UseCalibrationResult {
  const [calibrationStatus, setCalibrationStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[calib] useCalibrationStatus mounted');

    const fetchOnce = async () => {
      if (!mountedRef.current) return;
      if (inFlightRef.current) {
        console.log('[calib] previous fetch still in flight, skipping this tick');
        return;
      }
      inFlightRef.current = true;
      setLoading(true);
      // Abort previous
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const t0 = performance.now();
      console.log(`[calib] poll start ${new Date().toISOString()}`);
      try {
        console.log('[calib] requesting /api/calibration/status');
        const statusJson = await getStatus(undefined, FETCH_TIMEOUT_MS);

        const t1 = performance.now();
        console.log(
          `[calib] poll success (${Math.round(t1 - t0)}ms): status.ok=${Boolean((statusJson as any)?.ok)}`
        );

        if (!mountedRef.current) return;
        setCalibrationStatus(statusJson);
        setError(null);
      } catch (err: any) {
        const t1 = performance.now();
        console.log(`[calib] poll error (${Math.round(t1 - t0)}ms)`, err);
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Unknown error');
      } finally {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        setLoading(false);
      }
    };

    // immediate first fetch
    fetchOnce().catch(() => {});
    // then interval
    timerRef.current = window.setInterval(() => {
      fetchOnce().catch(() => {});
    }, POLL_INTERVAL_MS) as unknown as number;

    return () => {
      mountedRef.current = false;
      console.log('[calib] useCalibrationStatus unmounted');
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { calibrationStatus, loading, error };
}

