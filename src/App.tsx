import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CalibrationPage from './calibration/CalibrationPage';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.10),transparent_28%),linear-gradient(180deg,#050505_0%,#09090b_35%,#050505_100%)] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-black/50 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className={cn('h-3 w-3 rounded-full shadow-[0_0_20px_currentColor]', connected ? 'bg-emerald-500' : 'bg-rose-500')} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                {connected ? 'Live' : 'Connecting'}
              </div>
              <div className="text-sm text-zinc-300">Casino monitor</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCalibration((s) => !s)}
              className="rounded-full border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-bold text-zinc-100 transition hover:border-emerald-500/50 hover:bg-zinc-800 active:scale-[0.98]"
            >
              {showCalibration ? 'Back to Roulette' : 'Open Calibration'}
            </button>

            <div className="hidden items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 md:flex">
              <input
                type="number"
                min="0"
                max="36"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSpin()}
                placeholder="0–36"
                className="w-24 bg-transparent text-center text-base font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={() => submitSpin()}
                disabled={isSubmitting || inputNumber === ''}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <Send className="h-4 w-4" />}
                Add
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {showCalibration ? (
          <div className="rounded-[2.5rem] border border-zinc-800/70 bg-black/25 p-2 sm:p-4">
            <CalibrationPage />
          </div>
        ) : (
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
            <section className="flex flex-col items-center justify-center rounded-[2.5rem] border border-zinc-800/70 bg-black/25 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-2 text-center">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                  Latest result
                </span>
              </div>

              <div className="w-full flex-1">
                <AnimatePresence mode="wait">
                  {latest !== undefined ? (
                    <motion.div
                      key={latest}
                      initial={{ scale: 0.86, opacity: 0, y: 18 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 1.03, opacity: 0, y: -10 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                      className="flex flex-col items-center gap-6 text-center"
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-full border-4 font-black uppercase shadow-[0_30px_100px_rgba(0,0,0,0.75)]',
                          getNumberColor(latest),
                          getNumberBorderColor(latest)
                        )}
                        style={{
                          width: 'min(72vw, 920px)',
                          height: 'min(72vw, 920px)',
                          fontSize: 'min(18vw, 170px)',
                          lineHeight: 1,
                        }}
                      >
                        {latest}
                      </div>

                      <div className="space-y-2">
                        <div className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                          {latestInfo?.color} · {latestInfo?.parity}
                        </div>
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">
                          Huge centered display for presentation
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center gap-5 rounded-[2.5rem] border-2 border-dashed border-zinc-800 bg-black/25 py-24 text-center"
                      style={{ minHeight: 'min(72vw, 920px)' }}
                    >
                      <Hash className="h-16 w-16 text-zinc-700" />
                      <div>
                        <p className="text-xl font-bold text-zinc-300">Waiting for first spin</p>
                        <p className="mt-2 text-sm text-zinc-600">Пока список пустой, большой круг появится после первого значения</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <aside className="flex flex-col rounded-[2.5rem] border border-zinc-800/70 bg-zinc-950/60 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/70 px-6 py-5">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-zinc-400" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                      History
                    </div>
                    <div className="text-sm text-zinc-300">{spins.length} spins</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-zinc-500">Live feed</div>
              </div>

              <div className="custom-scrollbar max-h-[calc(100vh-12rem)] overflow-y-auto p-4 sm:p-5">
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {spins.map((num, idx) => (
                      <motion.div
                        key={`${idx}-${num}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: idx === 0 ? 1 : 0.82, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className={cn(
                          'flex items-center justify-between rounded-3xl border px-5 py-4 transition',
                          idx === 0
                            ? 'border-zinc-600/60 bg-zinc-800/70'
                            : 'border-zinc-800/40 bg-zinc-900/40'
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'flex items-center justify-center rounded-full border-2 font-black shadow-lg',
                              idx === 0 ? 'h-14 w-14 text-xl' : 'h-12 w-12 text-lg',
                              getNumberColor(num),
                              getNumberBorderColor(num)
                            )}
                          >
                            {num}
                          </div>
                          <div>
                            <div className={cn('font-bold', idx === 0 ? 'text-base text-zinc-100' : 'text-sm text-zinc-300')}>
                              {num === 0 ? 'Zero' : RED_NUMBERS.includes(num) ? 'Red' : 'Black'}
                            </div>
                            <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                              {num === 0 ? 'Neutral' : num % 2 === 0 ? 'Even' : 'Odd'}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-mono text-zinc-600">#{spins.length - idx}</div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {spins.length === 0 && (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800/60 bg-black/20 py-12 text-center opacity-40">
                      <Hash className="mb-4 h-14 w-14" />
                      <p className="text-lg font-medium">Waiting for first spin...</p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}} />
    </div>
  );
}
