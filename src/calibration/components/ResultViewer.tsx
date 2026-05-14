import React from 'react';

type Props = {
  result: any;
  onDownload: () => void;
};

export default function ResultViewer({ result, onDownload }: Props) {
  const summary = result?.ok ? 'Ready' : 'No valid result';
  const payload = result?.ok ? result?.calibration ?? result : result;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Snapshot</div>
          <div className="text-sm font-semibold text-white">{summary}</div>
        </div>

        <button
          onClick={onDownload}
          disabled={!result?.ok}
          className="h-9 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download
        </button>
      </div>

      <div className="rounded-xl border border-white/8 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
        <pre className="whitespace-pre-wrap break-words">
          {payload ? JSON.stringify(payload, null, 2).slice(0, 1800) : 'No result yet'}
        </pre>
      </div>
    </div>
  );
}