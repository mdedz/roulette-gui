import React, { useEffect, useState } from 'react';

type Props = {
  baseUrl: string;
};

export default function StreamViewer({ baseUrl }: Props) {
  const [ts, setTs] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastDiag, setLastDiag] = useState<string | null>(null);

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
            {lastDiag && <div className="text-[10px] text-zinc-400 mt-2 max-w-xs whitespace-pre-wrap">{lastDiag}</div>}
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
          const url = `${baseUrl.replace(/\/$/, '')}/api/calibration/stream?t=${ts}`;
          setError('failed');
          setRetryCount((c) => c + 1);

          // run lightweight diagnostic fetches to help identify CORS / redirect / opaque response issues
          (async () => {
            let diag = `Diagnosing ${url}\n`;
            try {
              // try a CORS-mode fetch (this will surface CORS errors if server lacks proper headers)
              const resp = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
              diag += `CORS fetch: status=${resp.status} type=${(resp as any).type}\n`;
              try {
                // enumerate headers (only available if CORS allows)
                for (const [k, v] of resp.headers) {
                  diag += `${k}: ${v}\n`;
                }
              } catch (e) {
                diag += `Failed to read headers: ${String(e)}\n`;
              }
            } catch (errCors) {
              diag += `CORS fetch failed: ${String(errCors)}\n`;
            }

            try {
              // attempt a no-cors fetch to observe opaque responses (cannot read body/headers)
              const respNo = await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
              diag += `no-cors fetch: type=${(respNo as any).type} status=${(respNo as any).status}\n`;
            } catch (errNo) {
              diag += `no-cors fetch failed: ${String(errNo)}\n`;
            }

            console.warn('[STREAM DIAG]\n' + diag);
            setLastDiag(diag);
          })();
        }}
        className="w-full h-64 object-contain bg-black"
      />
    </div>
  );
}

