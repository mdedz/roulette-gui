import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  baseUrl: string;
};

export default function StreamViewer({ baseUrl }: Props) {
  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/$/, ''), [baseUrl]);
  const [ts, setTs] = useState(() => Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastDiag, setLastDiag] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRetryCount(0);
    setTs(Date.now());
    setError(null);
    setLastDiag(null);
    setIsLoaded(false);
  }, [normalizedBaseUrl]);

  useEffect(() => {
    if (!error) return;

    const delay = Math.min(1000 * 2 ** retryCount, 30000);
    const id = window.setTimeout(() => {
      setTs(Date.now());
    }, delay);

    return () => window.clearTimeout(id);
  }, [error, retryCount]);

  const refresh = () => {
    setTs(Date.now());
    setRetryCount(0);
    setError(null);
    setLastDiag(null);
    setIsLoaded(false);
  };

  const streamUrl = `${normalizedBaseUrl}/api/calibration/stream?t=${ts}`;

  return (
    <section className="relative w-full overflow-hidden rounded-[2rem] border border-zinc-800/70 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_42%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.08),transparent_40%)]" />

      <div className="relative flex items-center justify-between gap-4 border-b border-zinc-800/70 px-6 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">
            Live calibration stream
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:border-emerald-500/50 hover:bg-zinc-800 active:scale-[0.98]"
        >
          Refresh
        </button>
      </div>

      <div className="relative p-4 sm:p-6 lg:p-8">
        <div className="relative mx-auto max-w-[1200px]">
          <div className="overflow-hidden rounded-[1.75rem] border border-zinc-800/70 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="relative aspect-video w-full bg-black">
              {!isLoaded && !error && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500" />
                </div>
              )}

              {error && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6 text-center">
                  <div className="max-w-md">
                    <div className="text-xl font-bold text-white">Stream disconnected</div>
                    <div className="mt-2 text-sm text-zinc-300">Переподключение идёт автоматически.</div>
                    <button
                      type="button"
                      onClick={refresh}
                      className="mt-5 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
                    >
                      Retry now
                    </button>
                    {lastDiag && (
                      <pre className="mt-5 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-left text-[11px] leading-relaxed text-zinc-400">
                        {lastDiag}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <img
                src={streamUrl}
                alt="Calibration stream"
                onLoad={() => {
                  setIsLoaded(true);
                  setError(null);
                  setRetryCount(0);
                }}
                onError={() => {
                  setIsLoaded(false);
                  setError('failed');
                  setRetryCount((c) => c + 1);

                  (async () => {
                    let diag = `Diagnosing ${streamUrl}\n`;
                    try {
                      const resp = await fetch(streamUrl, { method: 'GET', mode: 'cors', cache: 'no-store' });
                      diag += `CORS fetch: status=${resp.status} type=${resp.type}\n`;
                      try {
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
                      const respNo = await fetch(streamUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
                      diag += `no-cors fetch: type=${respNo.type} status=${respNo.status}\n`;
                    } catch (errNo) {
                      diag += `no-cors fetch failed: ${String(errNo)}\n`;
                    }

                    setLastDiag(diag);
                  })();
                }}
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div className="text-sm text-zinc-400">Live preview — {new Date(ts).toLocaleTimeString()}</div>
          </div>
        </div>
      </div>
    </section>
  );
}