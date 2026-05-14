import React, { useState } from 'react';
import { postStart, postStop, getResult, type ResultResponse } from '../api';
import { Play, Square, Download } from 'lucide-react';

type Props = {
  baseUrl: string;
  statusRunning: boolean;
  onStarted: () => void;
  onStopped: () => void;
  onResult: (res: ResultResponse) => void;
  setMessage: (m: string) => void;
};

export default function ControlPanel({
  baseUrl,
  statusRunning,
  onStarted,
  onStopped,
  onResult,
  setMessage,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await postStart(baseUrl);
      if (res.ok) {
        setMessage(res.status?.message ?? 'Started');
        onStarted();
      } else {
        setMessage('Start failed');
      }
    } catch (err: any) {
      setMessage('Start error: ' + String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await postStop(baseUrl);
      setMessage(res.status?.message ?? 'Stopped');
      onStopped();
    } catch (err: any) {
      setMessage('Stop error: ' + String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const handleGetResult = async () => {
    setLoading(true);
    try {
      const res = await getResult(baseUrl);
      onResult(res);
      setMessage(res.ok ? 'Result loaded' : 'Result unavailable');
    } catch (err: any) {
      setMessage('Result error: ' + String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <button
        onClick={handleStart}
        disabled={statusRunning || loading}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play className="h-4 w-4" />
        Start
      </button>

      <button
        onClick={handleStop}
        disabled={!statusRunning || loading}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Square className="h-4 w-4" />
        Stop
      </button>

      <button
        onClick={handleGetResult}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Result
      </button>
    </div>
  );
}