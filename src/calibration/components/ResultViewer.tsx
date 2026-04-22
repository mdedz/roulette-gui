import React from 'react';

type Props = {
  result: any;
  onDownload: () => void;
};

export default function ResultViewer({ result, onDownload }: Props) {
  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Result</h3>
        <button
          onClick={onDownload}
          className="text-xs bg-emerald-600 px-2 py-1 rounded disabled:opacity-40"
        >
          Download
        </button>
      </div>
      <div className="text-xs font-mono text-zinc-200 p-2 bg-black/40 rounded max-h-64 overflow-auto">
        <pre>{result ? JSON.stringify(result, null, 2) : 'No result yet'}</pre>
      </div>
    </div>
  );
}

