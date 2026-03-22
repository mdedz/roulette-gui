import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Hash, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Roulette Colors
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

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
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}`;

    const connect = () => {
      const socket = new WebSocket(socketUrl);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'INIT') {
          setSpins(message.data);
        } else if (message.type === 'NEW_SPIN') {
          setSpins(prev => [message.data, ...prev].slice(0, 100));
        }
      };

      socket.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      ws.current?.close();
    };
  }, []);

  const submitSpin = useCallback(async (numToSubmit?: number) => {
    const num = numToSubmit !== undefined ? numToSubmit : parseInt(inputNumber);
    if (isNaN(num) || num < 0 || num > 36) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num }),
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", connected ? "bg-emerald-500" : "bg-rose-500")} />
            <span className="text-xs uppercase tracking-widest font-semibold text-zinc-500">
              {connected ? 'Live' : 'Connecting...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="36"
              value={inputNumber}
              onChange={(e) => setInputNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSpin()}
              placeholder="0–36"
              className="w-20 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
            <button
              onClick={() => submitSpin()}
              disabled={isSubmitting || inputNumber === ''}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {isSubmitting
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              Add
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Latest number — big display */}
        <div className="flex flex-col items-center justify-center py-8">
          <AnimatePresence mode="wait">
            {latest !== undefined ? (
              <motion.div
                key={latest}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-3"
              >
                <div className={cn(
                  "w-40 h-40 rounded-full flex items-center justify-center text-7xl font-black shadow-2xl border-4",
                  getNumberColor(latest),
                  getNumberBorderColor(latest)
                )}>
                  {latest}
                </div>
                <span className="text-lg font-bold text-zinc-300 tracking-wide">
                  {latest === 0 ? 'Zero' : RED_NUMBERS.includes(latest) ? 'Red' : 'Black'}
                  {' · '}
                  {latest === 0 ? 'Neutral' : latest % 2 === 0 ? 'Even' : 'Odd'}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-40 h-40 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center"
              >
                <Hash className="w-12 h-12 text-zinc-700" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History list */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">History</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">{spins.length} spins</span>
          </div>

          <div className="overflow-y-auto p-3 space-y-1.5 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 26rem)' }}>
            <AnimatePresence initial={false}>
              {spins.map((num, idx) => (
                <motion.div
                  key={`${idx}-${num}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: idx === 0 ? 1 : 0.7, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors",
                    idx === 0
                      ? "bg-zinc-800/60 border-zinc-600/50"
                      : "bg-zinc-900/40 border-zinc-800/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "rounded-full flex items-center justify-center font-black shadow border-2",
                      idx === 0 ? "w-9 h-9 text-base" : "w-7 h-7 text-sm",
                      getNumberColor(num),
                      getNumberBorderColor(num)
                    )}>
                      {num}
                    </div>
                    <span className={cn("font-semibold", idx === 0 ? "text-sm text-zinc-200" : "text-xs text-zinc-500")}>
                      {num === 0 ? 'Zero' : RED_NUMBERS.includes(num) ? 'Red' : 'Black'}
                      {' · '}
                      {num === 0 ? 'Neutral' : num % 2 === 0 ? 'Even' : 'Odd'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-600">#{spins.length - idx}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {spins.length === 0 && (
              <div className="py-16 flex flex-col items-center justify-center text-center opacity-20">
                <Hash className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium">Waiting for first spin...</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}} />
    </div>
  );
}
