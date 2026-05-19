import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  baseUrl: string;
};

type StreamSource = {
  label: string;
  path: string;
};

type StreamMode = {
  id: 'calibration' | 'masked';
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  sources: StreamSource[];
  accentClassName: string;
  strategy: 'probe-image' | 'control-mjpeg';
};

type StreamError = {
  title: string;
  message: string;
  code?: string;
  action?: string;
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
        img.src = '';
        resolve(false);
      }, timeoutMs);

      img.onload = () => {
        window.clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
        img.src = '';
        resolve(true);
      };

      img.onerror = () => {
        window.clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
        img.src = '';
        resolve(false);
      };

      img.src = url;
    } catch {
      resolve(false);
    }
  });
}

async function probeControlMjpeg(url: string, timeoutMs: number): Promise<StreamError | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'multipart/x-mixed-replace, image/jpeg, application/json' },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      return {
        title: response.ok ? 'Masked stream returned JSON' : 'Masked stream unavailable',
        code: payload?.error,
        message: payload?.message ?? response.statusText ?? 'The runtime stream is not ready.',
        action: payload?.action,
      };
    }

    if (!response.ok) {
      return {
        title: 'Masked stream unavailable',
        code: String(response.status),
        message: response.statusText || 'The runtime stream returned an error.',
      };
    }

    return null;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return {
        title: 'Masked stream is still waiting',
        code: 'stream_waiting',
        message: 'Connection stayed open while the runtime waits for the first masked frame.',
      };
    }

    return {
      title: 'Masked stream request failed',
      message: String(error?.message ?? error),
    };
  } finally {
    window.clearTimeout(timeoutId);
    controller.abort();
  }
}

const STREAM_MODES: StreamMode[] = [
  {
    id: 'calibration',
    label: 'Normal',
    eyebrow: 'Calibration stream',
    title: 'Wheel detection',
    description: 'Live calibration frames from the control server.',
    sources: [
      { label: 'calibration', path: '/api/calibration/stream' },
      { label: 'ssam', path: '/api/ssam/stream' },
    ],
    accentClassName: 'border-t-emerald-500',
    strategy: 'probe-image',
  },
  {
    id: 'masked',
    label: 'Masked',
    eyebrow: 'Masked stream',
    title: 'Pocket mask preview',
    description: 'Outside the pocket mask is black; inside keeps the original runtime frame.',
    sources: [{ label: 'masked runtime', path: '/api/runtime/masked-stream' }],
    accentClassName: 'border-t-sky-400',
    strategy: 'control-mjpeg',
  },
];

export default function StreamViewer({ baseUrl }: Props) {
  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/$/, ''), [baseUrl]);
  const [activeModeId, setActiveModeId] = useState<StreamMode['id']>('calibration');
  const [retryNonce, setRetryNonce] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<StreamError | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const activeMode = useMemo(
    () => STREAM_MODES.find((mode) => mode.id === activeModeId) ?? STREAM_MODES[0],
    [activeModeId],
  );

  const probeSources = useMemo(
    () =>
      activeMode.sources.map((source) => ({
        ...source,
        probeUrl: `${normalizedBaseUrl}${source.path}`,
      })),
    [activeMode, normalizedBaseUrl],
  );

  useEffect(() => {
    let cancelled = false;

    setIsLoaded(false);
    setError(null);
    setStreamUrl(null);
    setSourceLabel(null);

    const run = async () => {
      if (activeMode.strategy === 'control-mjpeg') {
        const source = probeSources[0];
        if (!source) {
          setError({
            title: 'Stream unavailable',
            message: 'No stream source is configured.',
          });
          return;
        }

        const nextStreamUrl = addCacheBuster(source.probeUrl, Date.now());
        const streamError = await probeControlMjpeg(nextStreamUrl, 2200);
        if (cancelled) return;

        if (streamError) {
          setError(streamError);
          return;
        }

        setSourceLabel(source.label);
        setStreamUrl(nextStreamUrl);
        setAttempt(0);
        return;
      }

      for (const source of probeSources) {
        const nextStreamUrl = addCacheBuster(source.probeUrl, Date.now());
        const ok = await probeImage(nextStreamUrl, 3500);
        if (cancelled) return;

        if (ok) {
          setSourceLabel(source.label);
          setStreamUrl(nextStreamUrl);
          setError(null);
          setAttempt(0);
          return;
        }
      }

      setError({
        title: 'Stream unavailable',
        message: 'The stream endpoint did not return an image frame.',
      });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeMode, probeSources, retryNonce]);

  useEffect(() => {
    if (!error) return;

    const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 15000);
    const id = window.setTimeout(() => {
      setAttempt((v) => v + 1);
      setRetryNonce((v) => v + 1);
    }, delay);

    return () => window.clearTimeout(id);
  }, [attempt, error]);

  const refresh = () => {
    setAttempt(0);
    setRetryNonce((v) => v + 1);
    setError(null);
    setIsLoaded(false);
    setStreamUrl(null);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-black/35 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="shrink-0 border-b border-white/8 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{activeMode.eyebrow}</div>
            <div className="truncate text-sm font-semibold text-white">
              {sourceLabel ? `Source: ${sourceLabel}` : activeMode.title}
            </div>
            <div className="mt-1 line-clamp-1 text-xs text-zinc-500">{activeMode.description}</div>
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
            <div className={`h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 ${activeMode.accentClassName}`} />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-6 text-center backdrop-blur-sm">
            <div className="max-w-md rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
              <div className="mx-auto mb-3 inline-flex rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                {error.code ?? 'stream_error'}
              </div>
              <div className="text-lg font-semibold text-white">{error.title}</div>
              <div className="mt-2 text-sm leading-6 text-zinc-400">{error.message}</div>
              {error.action && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300">
                  Action: <span className="font-semibold text-emerald-300">{error.action}</span>
                </div>
              )}
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

        {streamUrl ? (
          <img
            key={streamUrl}
            src={streamUrl}
            alt="Calibration stream"
            className="h-full w-full object-contain"
            onLoad={() => {
              setIsLoaded(true);
              setError(null);
              setAttempt(0);
            }}
            onError={() => {
              setIsLoaded(false);
              setStreamUrl(null);
              setError({
                title: 'Stream disconnected',
                message: 'The browser could not load the selected MJPEG stream.',
              });
            }}
          />
        ) : (
          !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">No stream</div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/8 bg-black/30 px-4 py-3">
        <div className="mx-auto flex w-full max-w-md rounded-full border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {STREAM_MODES.map((mode) => {
            const isActive = mode.id === activeMode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setActiveModeId(mode.id);
                  setAttempt(0);
                  setRetryNonce((v) => v + 1);
                }}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                  isActive
                    ? mode.id === 'masked'
                      ? 'bg-sky-400 text-black shadow-[0_0_26px_rgba(56,189,248,0.24)]'
                      : 'bg-emerald-400 text-black shadow-[0_0_26px_rgba(16,185,129,0.24)]'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
