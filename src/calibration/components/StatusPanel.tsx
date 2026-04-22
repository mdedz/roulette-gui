import React from 'react';
import type { StatusResponse } from '../api';

type Props = {
  status: StatusResponse | null;
  lastError: string | null;
};

export default function StatusPanel({ status, lastError }: Props) {
  const coverage = status?.progress?.coverage_ratio ?? 0;
  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-xl">
      <h3 className="text-sm font-semibold mb-3">Status</h3>
      {status ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-zinc-400">lifecycle_state</span><span className="font-mono">{status.lifecycle_state}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">current_state</span><span className="font-mono">{status.current_state}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">running</span><span className="font-mono">{String(status.running)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">calibration_ready</span><span className="font-mono">{String(status.calibration_ready)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">samples_collected</span><span className="font-mono">{status.samples_collected}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">bins</span><span className="font-mono">{status.bins_filled} / {status.bins_total}</span></div>
          <div>
            <div className="text-zinc-400 text-xs">coverage</div>
            <div className="w-full bg-zinc-800 rounded h-3 mt-1 overflow-hidden">
              <div style={{ width: `${Math.round(coverage * 100)}%` }} className="h-3 bg-emerald-500" />
            </div>
          </div>
          <div className="text-sm text-zinc-400">status_message</div>
          <div className="p-2 bg-black/30 rounded text-xs font-mono text-zinc-200">{status.status_message}</div>
          {status.last_error && <div className="text-sm text-rose-400">last_error: {status.last_error}</div>}
          {lastError && <div className="text-sm text-rose-400">network: {lastError}</div>}
        </div>
      ) : (
        <div className="text-sm text-zinc-500">No status yet.</div>
      )}
    </div>
  );
}

