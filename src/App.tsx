import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, TrendingUp, Hash, Info, AlertCircle, Send } from 'lucide-react';
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
        console.log('Connected to WebSocket');
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
        console.log('Disconnected from WebSocket. Retrying...');
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

  const stats = useMemo(() => {
    if (spins.length === 0) return null;
    const counts = spins.reduce((acc, num) => {
      acc[num] = (acc[num] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const sorted = Object.entries(counts)
      .map(([num, count]) => ({ num: parseInt(num), count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number));

    const redCount = spins.filter(n => RED_NUMBERS.includes(n)).length;
    const blackCount = spins.filter(n => BLACK_NUMBERS.includes(n)).length;
    const greenCount = spins.filter(n => n === 0).length;

    return {
      hot: sorted.slice(0, 3),
      cold: Array.from({ length: 37 }, (_, i) => i)
        .filter(n => !counts[n])
        .slice(0, 3),
      distribution: {
        red: (redCount / spins.length) * 100,
        black: (blackCount / spins.length) * 100,
        green: (greenCount / spins.length) * 100,
      }
    };
  }, [spins]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 border border-emerald-400/30">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Roulette Tracker</h1>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", connected ? "bg-emerald-500" : "bg-rose-500")} />
                <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                  {connected ? 'Live Sync Active' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="36"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSpin()}
                placeholder="0-36"
                className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <button
              onClick={() => submitSpin()}
              disabled={isSubmitting || inputNumber === ''}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Add Spin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Stats & Board */}
        <div className="lg:col-span-8 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-4">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Hot Numbers</span>
              </div>
              <div className="flex gap-3">
                {stats?.hot.map(({ num, count }) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-lg", getNumberColor(num), getNumberBorderColor(num))}>
                      {num}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium">{count}x</span>
                  </div>
                )) || <span className="text-zinc-600 text-xs italic">No data yet</span>}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-4">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Cold Numbers</span>
              </div>
              <div className="flex gap-3">
                {stats?.cold.map((num) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 opacity-40 grayscale", getNumberColor(num), getNumberBorderColor(num))}>
                      {num}
                    </div>
                  </div>
                )) || <span className="text-zinc-600 text-xs italic">No data yet</span>}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-4">
                <Info className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Distribution</span>
              </div>
              {stats ? (
                <div className="space-y-3">
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${stats.distribution.red}%` }} className="bg-rose-600 h-full" />
                    <div style={{ width: `${stats.distribution.green}%` }} className="bg-emerald-600 h-full" />
                    <div style={{ width: `${stats.distribution.black}%` }} className="bg-zinc-950 h-full" />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                    <span className="text-rose-500">Red {Math.round(stats.distribution.red)}%</span>
                    <span className="text-emerald-500">Zero {Math.round(stats.distribution.green)}%</span>
                    <span className="text-zinc-400">Black {Math.round(stats.distribution.black)}%</span>
                  </div>
                </div>
              ) : (
                <span className="text-zinc-600 text-xs italic">No data yet</span>
              )}
            </div>
          </div>

          {/* Board Layout */}
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 overflow-x-auto">
            <div className="min-w-[600px] flex gap-2">
              {/* Zero */}
              <div className="w-16">
                <button
                  onClick={() => submitSpin(0)}
                  className="w-full h-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 rounded-xl flex items-center justify-center text-xl font-black text-emerald-400 transition-all min-h-[120px]"
                >
                  0
                </button>
              </div>
              {/* Numbers 1-36 */}
              <div className="flex-1 grid grid-cols-12 grid-rows-3 gap-2">
                {[...Array(36)].map((_, i) => {
                  const num = i + 1;
                  return (
                    <button
                      key={num}
                      onClick={() => submitSpin(num)}
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-sm font-bold border transition-all hover:scale-105 active:scale-95",
                        RED_NUMBERS.includes(num) 
                          ? "bg-rose-600/10 border-rose-500/20 text-rose-500 hover:bg-rose-600/20" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      )}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-600" />
                <span className="text-[10px] uppercase font-bold text-zinc-500">Red</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-950 border border-zinc-800" />
                <span className="text-[10px] uppercase font-bold text-zinc-500">Black</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <span className="text-[10px] uppercase font-bold text-zinc-500">Zero</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
            <div className="p-5 border-b border-zinc-800/50 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-200">Recent Spins</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{spins.length} recorded</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {spins.map((num, idx) => (
                  <motion.div
                    key={`${idx}-${num}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-700/30 rounded-xl group hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-lg border-2",
                        getNumberColor(num),
                        getNumberBorderColor(num)
                      )}>
                        {num}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-300">
                          {num === 0 ? 'Zero' : RED_NUMBERS.includes(num) ? 'Red' : 'Black'}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {num === 0 ? 'Neutral' : num % 2 === 0 ? 'Even' : 'Odd'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      #{spins.length - idx}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {spins.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                  <Hash className="w-12 h-12 mb-4" />
                  <p className="text-sm font-medium">Waiting for first spin...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}
