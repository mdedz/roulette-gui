import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  baseUrl: string;
};

function addCacheBuster(url: string, ts: number) {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}t=${ts}`;
}

function probeImage(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const timeoutId = window.setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, timeoutMs);

      img.onload = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };

      img.onerror = () => {
        window.clearTimeout(timeoutId);
        resolve(false);
      };

      img.src = url;
    } catch {
      resolve(false);
    }
  });
}

export default function StreamViewer({ baseUrl }: Props) {
  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/$/, ''), [baseUrl]);
  const [ts, setTs] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<'calibration' | 'ssam' | null>(null);

  // Probe URLs should not include the rapidly-changing cache-buster so that
  // initial availability checks don't retrigger on every frame update.
  const calibProbeUrl = useMemo(() => `${normalizedBaseUrl}/api/calibration/stream`, [normalizedBaseUrl]);
  const ssamProbeUrl = useMemo(() => `${normalizedBaseUrl}/api/ssam/stream`, [normalizedBaseUrl]);

  const calibUrl = useMemo(() => addCacheBuster(`${normalizedBaseUrl}/api/calibration/stream`, ts), [normalizedBaseUrl, ts]);
  const ssamUrl = useMemo(() => addCacheBuster(`${normalizedBaseUrl}/api/ssam/stream`, ts), [normalizedBaseUrl, ts]);

  useEffect(() => {
    let cancelled = false;

    setIsLoaded(false);
    setError(null);
    setStreamUrl(null);
    setSourceLabel(null);

    const run = async () => {
      // Probe using stable URLs (no cache buster) so this discovery run
      // doesn't re-run on every frame ts update.
      const okCalib = await probeImage(calibProbeUrl, 3500);
      if (cancelled) return;

      if (okCalib) {
        setSourceLabel('calibration');
        setStreamUrl(addCacheBuster(`${normalizedBaseUrl}/api/calibration/stream`, ts));
        setError(null);
        return;
      }

      const okSsam = await probeImage(ssamProbeUrl, 3500);
      if (cancelled) return;

      if (okSsam) {
        setSourceLabel('ssam');
        setStreamUrl(addCacheBuster(`${normalizedBaseUrl}/api/ssam/stream`, ts));
        setError(null);
        return;
      }

      setError('Stream unavailable');
      setAttempt((v) => v + 1);
    };

    run();

    return () => {
      cancelled = true;
    };
    // only re-run discovery when probe URLs change (not on every frame)
  }, [calibProbeUrl, ssamProbeUrl, normalizedBaseUrl]);

  useEffect(() => {
    if (!error) return;

    const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 15000);
    const id = window.setTimeout(() => {
      setTs(Date.now());
    }, delay);

    return () => window.clearTimeout(id);
  }, [attempt, error]);

  const refresh = () => {
    setAttempt(0);
    setTs(Date.now());
    setError(null);
    setIsLoaded(false);
  };

  // When a stream source is selected, update the cache-buster periodically
  // to fetch new frames instead of remaining stuck on a single image.
  useEffect(() => {
    if (!streamUrl || error) return;
    const FRAME_INTERVAL_MS = 200; // ~5 FPS; adjust if needed
    const id = window.setInterval(() => {
      setTs(Date.now());
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [streamUrl, error]);

  // Update `streamUrl` whenever the cache-buster `ts` changes so the <img>
  // src points to the newest frame without re-running discovery probes.
  useEffect(() => {
    if (!sourceLabel) return;
    if (sourceLabel === 'calibration') {
      setStreamUrl(addCacheBuster(`${normalizedBaseUrl}/api/calibration/stream`, ts));
    } else if (sourceLabel === 'ssam') {
      setStreamUrl(addCacheBuster(`${normalizedBaseUrl}/api/ssam/stream`, ts));
    }
  }, [ts, sourceLabel, normalizedBaseUrl]);

  // Preload frames into an Image object and only update the displayed URL
  // when the frame has successfully loaded. This prevents the UI from
  // showing the spinner forever if the <img> is constantly swapped before
  // it finishes loading.
  useEffect(() => {
    if (!streamUrl) {
      setDisplayUrl(null);
      setIsLoaded(false);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplayUrl(streamUrl);
      setIsLoaded(true);
      setError(null);
      setAttempt(0);
    };
    img.onerror = () => {
      if (cancelled) return;
      setIsLoaded(false);
      setError('failed');
      setAttempt((c) => c + 1);
    };
    // Kick off load
    img.src = streamUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [streamUrl]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="shrink-0 border-b border-white/8 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Live stream</div>
            <div className="truncate text-sm font-semibold text-white">
              {sourceLabel ? `Source: ${sourceLabel}` : 'Connecting'}
            </div>
          </div>

          <button
            type="button"
            onClick={refresh}
            className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {!isLoaded && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6 text-center">
            <div className="max-w-sm">
              <div className="text-lg font-semibold text-white">Stream disconnected</div>
              <div className="mt-1 text-sm text-zinc-400">Reconnecting automatically.</div>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 h-10 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {displayUrl ? (
          <img
            key={displayUrl}
            src={displayUrl}
            alt="Calibration stream"
            className="h-full w-full object-contain"
          />
        ) : streamUrl ? (
          // Stream is loading but not yet ready to display
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">Loading frame...</div>
        ) : (
          !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">No stream</div>
        )}
      </div>
    </section>
  );
}