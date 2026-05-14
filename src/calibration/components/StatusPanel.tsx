import React from 'react';
import type { StatusResponse } from '../api';

type Props = {
  status: StatusResponse | null;
  lastError: string | null;
};

export default function StatusPanel({ status, lastError }: Props) {
  const coverage = status?.progress?.coverage_ratio ?? 0;
  const coveragePct = Math.round(coverage * 100);

  const stateTone =
    status?.running
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <div className="rounded-[1.75rem] border border-white/8 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Status</div>
          <div className="text-base font-semibold text-white">Calibration state</div>
        </div>

        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${stateTone}`}>
          {status?.running ? 'Running' : 'Stopped'}
        </span>
      </div>

      {status ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Samples</div>
            <div className="mt-1 text-lg font-semibold text-white">{status.samples_collected}</div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Bins</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {status.bins_filled} / {status.bins_total}
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <span>Coverage</span>
              <span>{coveragePct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div style={{ width: `${coveragePct}%` }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" />
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">State</div>
            <div className="mt-1 text-sm font-medium text-zinc-200">{status.lifecycle_state}</div>
            <div className="text-sm text-zinc-400">{status.current_state}</div>
          </div>

          {status.status_message && (
            <div className="col-span-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Message</div>
              <div className="mt-1 text-sm text-zinc-200">{status.status_message}</div>
            </div>
          )}

          {status.last_error && (
            <div className="col-span-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
              {status.last_error}
            </div>
          )}

          {lastError && (
            <div className="col-span-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
              Network: {lastError}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-500">
          No status yet
        </div>
      )}
    </div>
  );
}