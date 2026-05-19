import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalibrationPage from './calibration/CalibrationPage';
import { LoaderCircle, ShieldCheck, Signal, Sparkles, Gauge, Plus, Play, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BASE_URL, postPredictionStart, postPredictionStop } from './calibration/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getNumberColor(num: number) {
  if (num === 0) return 'bg-emerald-600/95 text-black';
  if (RED_NUMBERS.includes(num)) return 'bg-rose-600/95 text-white';
  return 'bg-zinc-900 text-white';
}

function getNumberBorderColor(num: number) {
  if (num === 0) return 'border-emerald-400/90';
  if (RED_NUMBERS.includes(num)) return 'border-rose-400/90';
  return 'border-zinc-400/60';
}

function getTrackingTone(status?: string) {
  if (status === 'HEALTHY') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'WARNING') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (status === 'CRITICAL') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

type TrackingStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

type TrackingHealth = {
  status: TrackingStatus;
  tracking_health_score?: number;
  last_update_ts?: string;
  error?: string;
  [key: string]: any;
};

const TRACKING_HEALTH_URL = '/api/tracking/health';
const TRACKING_HEALTH_INTERVAL_MS = 2000;
const TRACKING_HEALTH_TIMEOUT_MS = 5000;

function normalizeTrackingStatus(value: unknown): TrackingStatus | undefined {
  if (typeof value === 'boolean') return value ? 'HEALTHY' : 'CRITICAL';
  if (typeof value !== 'string') return undefined;

  const status = value.trim().toUpperCase();
  if (!status || status === 'UNKNOWN') return undefined;

  if (['HEALTHY', 'OK', 'ONLINE', 'UP', 'READY', 'RUNNING', 'ACTIVE', 'STARTED', 'TRUE', 'SUCCESS'].includes(status)) {
    return 'HEALTHY';
  }

  if (['WARNING', 'WARN', 'DEGRADED', 'PARTIAL', 'SLOW'].includes(status)) {
    return 'WARNING';
  }

  if (['CRITICAL', 'ERROR', 'ERR', 'FAILED', 'FAILURE', 'DOWN', 'OFFLINE', 'STOPPED', 'UNHEALTHY', 'FALSE'].includes(status)) {
    return 'CRITICAL';
  }

  return undefined;
}

function normalizeTrackingScore(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function deriveTrackingStatus(payload: any, httpOk: boolean): TrackingStatus {
  const candidates = [
    payload?.status,
    payload?.tracking_status,
    payload?.health_status,
    payload?.state,
    payload?.lifecycle_state,
    payload?.current_state,
    payload?.health?.status,
    payload?.tracking?.status,
    payload?.result?.status,
    payload?.healthy,
    payload?.is_healthy,
    payload?.ok,
    payload?.running,
    payload?.tracking_ok,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTrackingStatus(candidate);
    if (normalized) return normalized;
  }

  if (payload?.error || payload?.ok === false || !httpOk) return 'CRITICAL';
  return 'HEALTHY';
}

function normalizeTrackingHealth(payload: any, httpOk: boolean): TrackingHealth {
  const tracking_health_score = normalizeTrackingScore(
    payload?.tracking_health_score ?? payload?.accuracy_score ?? payload?.accuracy ?? payload?.health_score ?? payload?.score
  );

  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    status: deriveTrackingStatus(payload, httpOk),
    tracking_health_score,
    last_update_ts: payload?.last_update_ts ?? payload?.updated_at ?? new Date().toISOString(),
  };
}

async function fetchTrackingHealth(): Promise<TrackingHealth> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TRACKING_HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(TRACKING_HEALTH_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let payload: any = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { status: text };
      }
    }

    return normalizeTrackingHealth(payload, res.ok);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function App() {
  const [spins, setSpins] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [trackingHealth, setTrackingHealth] = useState<TrackingHealth>({ status: 'CRITICAL' });
  const [inputNumber, setInputNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [isPredictionRunning, setIsPredictionRunning] = useState(false);
  const [isPredictionLoading, setIsPredictionLoading] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState<string | null>(null);
  const [predictionMessageType, setPredictionMessageType] = useState<'success' | 'error'>('success');

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/ws`;

    let reconnectAttempt = 0;
    let heartbeatInterval: number | undefined;
    let reconnectTimeout: number | undefined;
    let closedByCleanup = false;

    const connect = () => {
      const socket = new WebSocket(socketUrl);
      ws.current = socket;

      socket.onopen = () => {
        reconnectAttempt = 0;
        setConnected(true);

        if (heartbeatInterval) window.clearInterval(heartbeatInterval);
        heartbeatInterval = window.setInterval(() => {
          try {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'PING', ts: Date.now() }));
            }
          } catch {
            // ignore
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'INIT') {
            setSpins(Array.isArray(message.data) ? message.data : []);
          } else if (message.type === 'NEW_SPIN') {
            setSpins((prev) => [message.data, ...prev].slice(0, 100));
          }
        } catch (err) {
          console.error('[WS] failed to parse message', event.data, err);
        }
      };

      socket.onclose = () => {
        setConnected(false);

        if (heartbeatInterval) {
          window.clearInterval(heartbeatInterval);
          heartbeatInterval = undefined;
        }

        if (closedByCleanup) return;

        reconnectAttempt += 1;
        const backoff = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempt));
        reconnectTimeout = window.setTimeout(connect, backoff);
      };

      socket.onerror = (error) => {
        console.error('[WS] error', error);
      };
    };

    const onOffline = () => setConnected(false);
    const onOnline = () => setConnected(ws.current?.readyState === WebSocket.OPEN);

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (heartbeatInterval) window.clearInterval(heartbeatInterval);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;
    let inFlight = false;

    const fetchHealth = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const health = await fetchTrackingHealth();
        if (!mounted) return;
        setTrackingHealth(health);
      } catch (error: any) {
        if (!mounted) return;
        console.warn('[tracking-health] poll failed', error);
        setTrackingHealth((prev) => ({
          ...prev,
          status: 'CRITICAL',
          error: error?.name === 'AbortError' ? 'Tracking health request timed out' : String(error?.message ?? error),
          last_update_ts: new Date().toISOString(),
        }));
      } finally {
        inFlight = false;
      }
    };

    fetchHealth();
    intervalId = window.setInterval(fetchHealth, TRACKING_HEALTH_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const submitSpin = useCallback(
    async (numToSubmit?: number) => {
      const parsed = numToSubmit !== undefined ? numToSubmit : Number.parseInt(inputNumber, 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 36) return;

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/spins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: parsed }),
        });

        if (response.ok) {
          setInputNumber('');
        }
      } catch (error) {
        console.error('Failed to submit spin:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputNumber]
  );

  const handlePredictionStartStop = useCallback(async () => {
    if (isPredictionLoading) return;

    setIsPredictionLoading(true);
    setPredictionMessage(null);

    try {
      if (isPredictionRunning) {
        const res = await postPredictionStop(BASE_URL);
        if (res.ok === false) throw new Error('Prediction stop failed');

        setIsPredictionRunning(false);
        setPredictionMessageType('success');
        setPredictionMessage('Predictor stopped');
      } else {
        const res = await postPredictionStart(BASE_URL);
        if (res.ok === false) throw new Error(res.error ?? 'Prediction start failed');

        setIsPredictionRunning(true);
        setPredictionMessageType('success');
        setPredictionMessage(res.pid ? `Predictor started - PID ${res.pid}` : 'Predictor started');
      }
    } catch (error: any) {
      setPredictionMessageType('error');
      setPredictionMessage(String(error?.message ?? error));
    } finally {
      setIsPredictionLoading(false);
    }
  }, [isPredictionLoading, isPredictionRunning]);

  const latest = spins[0];

  const latestInfo = useMemo(() => {
    if (latest === undefined) return null;
    return {
      color: latest === 0 ? 'Zero' : RED_NUMBERS.includes(latest) ? 'Red' : 'Black',
      parity: latest === 0 ? 'Neutral' : latest % 2 === 0 ? 'Even' : 'Odd',
    };
  }, [latest]);

  const trackingTone = getTrackingTone(trackingHealth?.status);

  function formatAccuracy(score?: number) {
    if (score === undefined || score === null) return null;
    if (typeof score !== 'number') return String(score);
    // If score looks like 0..1 treat as fraction and show percent, otherwise show as-is with 2 decimals
    if (score > 0 && score <= 1) {
      return `${Math.round(score * 100)}%`;
    }
    return `${Number(score).toFixed(2)}`;
  }

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%),linear-gradient(to_bottom,#050505,#09090b_40%,#050505)] text-white">
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b border-white/5 bg-black/35 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Sparkles className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold tracking-tight sm:text-lg">Casino Monitor</div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1', connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400')}>
                    <Signal className="h-3 w-3" />
                    {connected ? 'Live' : 'Connecting'}
                  </span>
                  <span className={cn('inline-flex items-center gap-2 rounded-full border px-2 py-1', trackingTone)}>
                    <ShieldCheck className="h-3 w-3" />
                    <span>{trackingHealth?.status ?? 'UNKNOWN'}</span>
                    {trackingHealth?.tracking_health_score !== undefined && (
                      <span className="ml-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                        {formatAccuracy(trackingHealth.tracking_health_score)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="hidden items-center gap-2 px-3 text-xs font-medium text-zinc-300 lg:flex">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shadow-[0_0_14px_currentColor]',
                      isPredictionRunning ? 'bg-emerald-400 text-emerald-400' : 'bg-zinc-500 text-zinc-500'
                    )}
                  />
                  <span>Predictor</span>
                  <span className={cn('text-[10px] uppercase tracking-[0.22em]', isPredictionRunning ? 'text-emerald-300' : 'text-zinc-500')}>
                    {isPredictionRunning ? 'On' : 'Off'}
                  </span>
                </div>

                <button
                  onClick={handlePredictionStartStop}
                  disabled={isPredictionLoading}
                  aria-pressed={isPredictionRunning}
                  className={cn(
                    'inline-flex h-9 min-w-[118px] items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-300/40 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:min-w-[132px] sm:px-5',
                    isPredictionRunning
                      ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-[0_0_28px_rgba(244,63,94,0.26)] hover:from-rose-400 hover:to-red-400 focus:ring-rose-300/40'
                      : 'bg-gradient-to-r from-emerald-400 to-lime-400 text-black shadow-[0_0_28px_rgba(16,185,129,0.24)] hover:from-emerald-300 hover:to-lime-300'
                  )}
                  title={predictionMessage ?? undefined}
                >
                  {isPredictionLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : isPredictionRunning ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isPredictionLoading ? 'WORKING' : isPredictionRunning ? 'STOP' : 'PREDICT'}
                </button>

                {predictionMessage && (
                  <div
                    className={cn(
                      'absolute right-0 top-12 z-10 max-w-[260px] rounded-2xl border bg-black/85 px-3 py-2 text-xs text-zinc-200 shadow-2xl backdrop-blur',
                      predictionMessageType === 'error' ? 'border-rose-500/30 text-rose-100' : 'border-emerald-500/25 text-emerald-100'
                    )}
                  >
                    {predictionMessage}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowCalibration((s) => !s)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
              >
                <Gauge className="h-4 w-4" />
                {showCalibration ? 'Dashboard' : 'Calibration'}
              </button>

              {!showCalibration && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    max="36"
                    value={inputNumber}
                    onChange={(e) => setInputNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitSpin()}
                    placeholder="0–36"
                    className="w-16 bg-transparent px-2 text-center text-sm font-semibold outline-none placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => submitSpin()}
                    disabled={isSubmitting || inputNumber === ''}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-500 px-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden">
          {showCalibration ? (
            <CalibrationPage />
          ) : (
            <div className="mx-auto grid h-full w-full max-w-[1600px] min-h-0 grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:px-6">
              <section className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white/8 bg-black/30 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-zinc-400">
                  Latest spin
                </div>

                {latest !== undefined ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full border-[6px] font-black shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
                        getNumberColor(latest),
                        getNumberBorderColor(latest)
                      )}
                      style={{
                        width: 'min(78vmin, 44rem)',
                        height: 'min(78vmin, 44rem)',
                        fontSize: 'min(18vmin, 8.5rem)',
                        lineHeight: 1,
                      }}
                    >
                      {latest}
                    </div>

                    <div className="flex items-center gap-2 text-xl font-semibold text-zinc-200 sm:text-2xl">
                      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{latestInfo?.color}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">{latestInfo?.parity}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="text-2xl font-semibold text-zinc-300 sm:text-3xl">Waiting for first spin</div>
                    <div className="text-sm text-zinc-500">No data yet</div>
                  </div>
                )}
              </section>

              <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-black/30 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">History</div>
                    <div className="text-lg font-semibold text-white">Last results</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                    {spins.length}
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-4 auto-rows-fr gap-2 overflow-hidden">
                  {spins.slice(0, 24).map((num, idx) => (
                    <div
                      key={`${idx}-${num}`}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded-2xl border text-lg font-black shadow-sm',
                        getNumberColor(num),
                        getNumberBorderColor(num)
                      )}
                    >
                      {num}
                    </div>
                  ))}

                  {spins.length === 0 && (
                    <div className="col-span-4 flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] py-10 text-sm text-zinc-500">
                      No spins yet
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}