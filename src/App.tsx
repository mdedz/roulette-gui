import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalibrationPage from './calibration/CalibrationPage';
import { BASE_URL } from './calibration/api';
import { motion, AnimatePresence } from 'motion/react';
import { History, Hash, Send, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const getNumberColor = (num: number) => {
  if (num === 0) return 'bg-emerald-600';
  if (RED_NUMBERS.includes(num)) return 'bg-rose-600';
  return 'bg-zinc-900';
};

const getNumberBorderColor = (num: number) => {
  if (num === 0) return 'border-emerald-400';
  if (RED_NUMBERS.includes(num)) return 'border-rose-400';
  return 'border-zinc-400';
};

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

    const reconnectAttempts = { current: 0 };
    let heartbeatInterval: number | undefined;
    let reconnectTimeout: number | undefined;

    const connect = () => {
      const socket = new WebSocket(socketUrl);
      ws.current = socket;

      socket.onopen = () => {
        reconnectAttempts.current = 0;
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

        reconnectAttempts.current += 1;
        const backoff = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts.current));
        reconnectTimeout = window.setTimeout(connect, backoff);
      };

      socket.onerror = (error) => {
        console.error('[WS] error', error);
      };
    };

    const onOffline = () => console.warn('[NET] offline');
    const onOnline = () => console.info('[NET] online');

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    connect();

    return () => {
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (heartbeatInterval) window.clearInterval(heartbeatInterval);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      ws.current?.close();
    };
  }, []);

  // Poll tracking health endpoint every 2s
  useEffect(() => {
    let mounted = true;
    let intervalId: number | undefined;

    const fetchHealth = async () => {
      try {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const res = await fetch(`${base}/api/tracking/health`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        // Read as text first — some backends may return non-JSON (empty body or plain text).
        const text = await res.text();
        let json: any = null;
        if (text) {
          try {
            json = JSON.parse(text);
          } catch (parseErr) {
            // If parsing fails, treat as unhealthy but include the raw body for debugging.
            console.warn('[HEALTH] invalid JSON body from health endpoint', { body: text, parseErr });
          }
        }
        if (!mounted) return;
        if (json && json.status) {
          setTrackingHealth(json);
        } else {
          // If we couldn't parse JSON or it doesn't have a status field, log the response
          // (status + body) to help debugging and mark as CRITICAL.
          console.warn('[HEALTH] marking CRITICAL — invalid/missing status in response', {
            status: res.status,
            ok: res.ok,
            body: text,
          });
          setTrackingHealth((prev) => prev ?? { status: 'CRITICAL' });
        }
      } catch (err) {
        console.warn('[HEALTH] fetch failed', err);
        if (!mounted) return;
        setTrackingHealth((prev) => ({ ...(prev ?? {}), status: 'CRITICAL' }));
      }
    };

    // initial fetch
    fetchHealth();
    intervalId = window.setInterval(fetchHealth, 2000);

    return () => {
      mounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const submitSpin = useCallback(async (numToSubmit?: number) => {
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
  }, [inputNumber]);

  const latest = spins[0];
  const latestInfo = useMemo(() => {
    if (latest === undefined) return null;
    return {
      color: latest === 0 ? 'Zero' : RED_NUMBERS.includes(latest) ? 'Red' : 'Black',
      parity: latest === 0 ? 'Neutral' : latest % 2 === 0 ? 'Even' : 'Odd',
    };
  }, [latest]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-2xl font-bold">Casino Monitor</div>
            <div className="text-sm text-zinc-400">{connected ? 'Live' : 'Connecting'}</div>
          </div>

          <div className="flex items-center gap-4">
            {/* Tracking health badge */}
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-md font-semibold text-sm flex items-center gap-2 ${
                  trackingHealth?.status === 'HEALTHY'
                    ? 'bg-emerald-600 text-black'
                    : trackingHealth?.status === 'WARNING'
                    ? 'bg-amber-400 text-black'
                    : trackingHealth?.status === 'CRITICAL'
                    ? 'bg-rose-600 text-black'
                    : 'bg-zinc-700 text-zinc-200'
                }`}
              >
                <span className="uppercase">
                  {trackingHealth?.status ?? 'UNKNOWN'}
                </span>
                {trackingHealth?.tracking_health_score !== undefined && (
                  <span className="text-xs opacity-80">({Math.round(trackingHealth.tracking_health_score)})</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCalibration((s) => !s)}
              className="rounded-full bg-emerald-600 px-6 py-3 text-lg font-bold text-black"
            >
              {showCalibration ? 'Back' : 'Calibration'}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="36"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSpin()}
                placeholder="0–36"
                className="w-20 bg-transparent text-center text-lg font-semibold outline-none"
              />
              <button
                onClick={() => submitSpin()}
                disabled={isSubmitting || inputNumber === ''}
                className="rounded-full bg-emerald-500 px-6 py-3 text-lg font-black text-black disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        {showCalibration ? (
          <CalibrationPage />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <section className="flex-1 flex flex-col items-center justify-center">
              {latest !== undefined ? (
                <div className="flex flex-col items-center gap-6 text-center">
                  <div
                    className={cn('flex items-center justify-center rounded-full font-black', getNumberColor(latest), getNumberBorderColor(latest))}
                    style={{
                      width: 'min(72vw, 720px)',
                      height: 'min(72vw, 720px)',
                      fontSize: 'min(18vw, 140px)',
                      lineHeight: 1,
                      borderWidth: 6,
                    }}
                  >
                    {latest}
                  </div>

                  <div className="text-3xl font-black">
                    {latestInfo?.color} · {latestInfo?.parity}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                  <div className="text-3xl font-bold text-zinc-500">Waiting for first spin</div>
                </div>
              )}
            </section>

            <aside className="w-full lg:w-96">
              <div className="text-xl font-bold mb-4">History</div>
              <div className="grid grid-cols-3 gap-3">
                {spins.slice(0, 30).map((num, idx) => (
                  <div
                    key={`${idx}-${num}`}
                    className={`flex items-center justify-center rounded-lg p-4 text-2xl font-bold ${getNumberColor(num)} ${getNumberBorderColor(num)}`}
                  >
                    {num}
                  </div>
                ))}
                {spins.length === 0 && (
                  <div className="col-span-3 text-center text-lg text-zinc-500 py-12 rounded-lg border border-dashed">
                    No spins yet
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
