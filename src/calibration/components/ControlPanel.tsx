import React, { useState } from 'react';
import { postStart, postStop, getResult, type ResultResponse } from '../api';

type Props = {
  baseUrl: string;
  statusRunning: boolean;
  onStarted: () => void;
  onStopped: () => void;
  onResult: (res: ResultResponse) => void;
  setMessage: (m: string) => void;
};

export default function ControlPanel({ baseUrl, statusRunning, onStarted, onStopped, onResult, setMessage }: Props) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await postStart(baseUrl);
      if (res.ok) {
        setMessage(res.status?.message ?? 'Started');
        onStarted();
      } else {
        setMessage('Start failed: ' + (res.error ?? 'unknown'));
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
      // update UI immediately; polling hook will continue until running==false
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
      if (!res.ok) {
        setMessage('Result: ' + (res as any).message);
      } else {
        setMessage('Result fetched');
      }
    } catch (err: any) {
      setMessage('Result error: ' + String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-xl flex gap-2 items-center">
      <button
        onClick={handleStart}
        disabled={statusRunning || loading}
        className="bg-emerald-600 px-3 py-2 rounded disabled:opacity-40 text-sm"
      >
        Start
      </button>
      <button
        onClick={handleStop}
        disabled={!statusRunning || loading}
        className="bg-rose-600 px-3 py-2 rounded disabled:opacity-40 text-sm"
      >
        Stop
      </button>
      <button
        onClick={handleGetResult}
        disabled={loading}
        className="bg-zinc-700 px-3 py-2 rounded text-sm"
      >
        Get Result
      </button>
    </div>
  );
}

