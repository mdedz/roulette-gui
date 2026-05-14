import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalibrationPage from './calibration/CalibrationPage';
import { BASE_URL } from './calibration/api';
import { Hash, ShieldCheck, Signal, Sparkles, Gauge, Plus, Play, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function App() {
  const [spins, setSpins] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [trackingHealth, setTrackingHealth] = useState<{
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    tracking_health_score?: number;
    last_update_ts?: string;
    [key: string]: any;
  } | null>(null);
  const [inputNumber, setInputNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

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

    const fetchHealth = async () => {
      try {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const res = await fetch(`${base}/api/tracking/health`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);

        const text = await res.text();
        let json: any = null;

        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
        }

        if (!mounted) return;

        if (json && json.status) {
          setTrackingHealth(json);
        } else {
          setTrackingHealth((prev) => prev ?? { status: 'CRITICAL' });
        }
      } catch {
        if (!mounted) return;
        setTrackingHealth((prev) => ({ ...(prev ?? {}), status: 'CRITICAL' }));
      }
    };

    fetchHealth();
    intervalId = window.setInterval(fetchHealth, 2000);

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

  const latest = spins[0];

  const latestInfo = useMemo(() => {
    if (latest === undefined) return null;
    return {
      color: latest === 0 ? 'Zero' : RED_NUMBERS.includes(latest) ? 'Red' : 'Black',
      parity: latest === 0 ? 'Neutral' : latest % 2 === 0 ? 'Even' : 'Odd',
    };
  }, [latest]);

  const trackingTone = getTrackingTone(trackingHealth?.status);

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
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1', trackingTone)}>
                    <ShieldCheck className="h-3 w-3" />
                    {trackingHealth?.status ?? 'UNKNOWN'}
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
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