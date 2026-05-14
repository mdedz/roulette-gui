import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import StreamViewer from './components/StreamViewer';
import StatusPanel from './components/StatusPanel';
import { useCalibrationStatus } from './hooks/useCalibrationStatus';
import {
  BASE_URL,
  postStart,
  postStop,
} from './api';
import { Play, Square } from 'lucide-react';

export default function CalibrationPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const baseUrl = BASE_URL;

  const {
    status,
    lastError,
    startPolling,
    refresh,
  } = useCalibrationStatus(() => baseUrl);

  useEffect(() => {
    startPolling();
  }, [startPolling]);

  const quality = useMemo(() => {
    return {
      text: 'UNKNOWN',
      tone: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    };
  }, []);

  const coverage = status?.progress?.coverage_ratio ?? 0;
  const coveragePct = Math.round(coverage * 100);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const prevReadyRef = useRef<boolean | null>(null);

  useEffect(() => {
    const prev = prevReadyRef.current;
    const now = Boolean(status?.calibration_ready);
    // Trigger pulse -> fade -> clear when calibration becomes ready
    if (prev === false && now === true) {
      // reset any prior state
      setIsCleared(false);
      setIsFading(false);
      // start pulsing
      setIsPulsing(true);
      const pulseDuration = 1200; // ms
      const fadeDuration = 700; // ms

      const t1 = window.setTimeout(() => {
        setIsFading(true);
        setIsPulsing(false);
        const t2 = window.setTimeout(() => {
          setIsCleared(true);
          setIsFading(false);
        }, fadeDuration);
        // clear fallback
        return () => window.clearTimeout(t2);
      }, pulseDuration);

      return () => {
        window.clearTimeout(t1);
      };
    }

    // If calibration becomes not ready again, restore visuals
    if (now === false) {
      setIsPulsing(false);
      setIsFading(false);
      setIsCleared(false);
    }

    prevReadyRef.current = now;
  }, [status?.calibration_ready]);

  // runtime-based quality checks removed

  const handleStartStop = useCallback(async () => {
    if (loading) return;

    setLoading(true);

    try {
      if (status?.running) {
        await postStop(baseUrl);
        setMessage('Stopped');
        refresh();
      } else {
        const res = await postStart(baseUrl);
        setMessage(res.status?.message ?? 'Started');
        startPolling();
      }
    } catch (e: any) {
      setMessage(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [
    baseUrl,
    loading,
    refresh,
    startPolling,
    status?.running,
  ]);

  return (
    <div className="h-full min-h-0 overflow-hidden text-white">
      <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">

        {/* top */}
        <div className="shrink-0 rounded-[1.75rem] border border-white/8 bg-black/25 px-5 py-5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Calibration
              </div>

              <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Live calibration
              </div>
            </div>

            <div className="flex items-center gap-3">

              <span
                className={`inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold ${quality.tone}`}
              >
                {quality.text}
              </span>

              <button
                onClick={handleStartStop}
                disabled={loading}
                className={`inline-flex h-14 min-w-[180px] items-center justify-center gap-3 rounded-full px-8 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  status?.running
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-emerald-500 text-black hover:bg-emerald-400'
                }`}
              >
                {status?.running ? (
                  <Square className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}

                {loading
                  ? 'WORKING'
                  : status?.running
                  ? 'STOP'
                  : 'START'}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-zinc-500">
              <span>Coverage</span>
              <span>{coveragePct}%</span>
            </div>

            <div className={cn('h-4 overflow-hidden rounded-full bg-zinc-800 transition-opacity', isFading || isCleared ? 'opacity-0' : 'opacity-100')}>
              <div
                style={{
                  width: `${isCleared ? 0 : coveragePct}%`,
                }}
                className={cn(
                  'h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-300',
                  isPulsing ? 'animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.12)]' : '',
                )}
              />
            </div>
          </div>
        </div>

        {/* body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">

          {/* stream */}
          <div className="min-h-0">
            <StreamViewer baseUrl={baseUrl} />
          </div>

          {/* side */}
          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">

            <StatusPanel
              status={status}
              lastError={lastError}
            />

            {message && (
              <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-zinc-200">
                {message}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}