import React, { useEffect, useState } from 'react';

type Props = {
  baseUrl: string;
};

export default function StreamViewer({ baseUrl }: Props) {
  const [ts, setTs] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // reset when baseUrl changes
    setRetryCount(0);
    setTs(Date.now());
    setError(null);
  }, [baseUrl]);

  useEffect(() => {
    if (!error) return;
    const delay = Math.min(1000 * 2 ** retryCount, 30000);
    const id = window.setTimeout(() => {
      setTs(Date.now());
    }, delay);
    return () => window.clearTimeout(id);
  }, [error, retryCount]);

  return (
    <div className="bg-black/40 border border-zinc-800/40 rounded-xl overflow-hidden relative">
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white">
          <div>
            <div className="text-sm font-semibold mb-2">Stream disconnected</div>
            <div className="text-xs text-zinc-300">Reconnecting…</div>
          </div>
        </div>
      )}
      <img
        src={`${baseUrl.replace(/\/$/, '')}/api/calibration/stream?t=${ts}`}
        alt="Calibration stream"
        onLoad={() => {
          setError(null);
          setRetryCount(0);
        }}
        onError={() => {
          setError('failed');
          setRetryCount((c) => c + 1);
        }}
        className="w-full h-64 object-contain bg-black"
      />
    </div>
  );
}

