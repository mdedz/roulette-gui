import React, { useCallback, useEffect, useRef, useState } from 'react';
import StreamViewer from './components/StreamViewer';
import { useCalibrationStatus } from './hooks/useCalibrationStatus';
import { BASE_URL, postStart, postStop, postPredictionStart, postPredictionStop } from './api';
import type { ResultResponse } from './api';

export default function CalibrationPage() {
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [predLoading, setPredLoading] = useState(false);

  const baseUrl = BASE_URL;

  const { status, runtimeStatus, lastError, startPolling, refresh } = useCalibrationStatus(() => baseUrl);

  const onStarted = useCallback(() => {
    startPolling();
  }, [startPolling]);

  // Always keep polling the calibration status while this page is mounted.
  useEffect(() => {
    startPolling();
  }, [startPolling]);

  // Notify user if runtime reports low-quality calibration.
  const prevRuntimeRef = useRef<typeof runtimeStatus | null>(null);
  useEffect(() => {
    const rt = runtimeStatus;
    if (!rt) {
      prevRuntimeRef.current = rt;
      return;
    }
    const score = typeof rt.score === 'number' ? rt.score : 0;
    const isBad = rt.status !== 'VALID' || score < 0.8;
    const prev = prevRuntimeRef.current;
    const prevBad = prev ? prev.status !== 'VALID' || (typeof prev.score === 'number' ? prev.score : 0) < 0.8 : false;

    if (isBad && !prevBad) {
      setMessage('Calibration quality low — please recalibrate');
    } else if (!isBad && prevBad) {
      setMessage('Calibration quality restored');
    }

    prevRuntimeRef.current = rt;
  }, [runtimeStatus, setMessage]);

  const onStopped = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleResult = useCallback((res: ResultResponse) => {
    setResult(res);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result || !result.ok) return;

    const blob = new Blob([JSON.stringify((result as any).calibration, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calibration.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [result]);

  // derive display state for runtime quality indicator
  const quality = (() => {
    if (!runtimeStatus) return { text: 'Unknown', color: 'bg-zinc-700', hint: 'No data' };
    const score = typeof runtimeStatus.score === 'number' ? runtimeStatus.score : 0;
    if (runtimeStatus.status === 'INVALID' || score < 0.6) return { text: 'Poor', color: 'bg-rose-600', hint: `score=${score.toFixed(2)}` };
    if (runtimeStatus.status === 'SUSPECT' || score < 0.8) return { text: 'Fair', color: 'bg-amber-500', hint: `score=${score.toFixed(2)}` };
    return { text: 'Good', color: 'bg-emerald-600', hint: `score=${score.toFixed(2)}` };
  })();

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Main stream area */}
        <div className="mb-6">
          <StreamViewer baseUrl={baseUrl} />
        </div>

        {/* Minimal controls and big progress */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-3xl">
            <div className="text-center text-4xl font-bold mb-4">Калибровка</div>
            <div className="w-full bg-zinc-800 rounded-full h-8 overflow-hidden">
              <div
                style={{ width: `${Math.round((status?.progress?.coverage_ratio ?? 0) * 100)}%` }}
                className="h-8 bg-emerald-500 transition-all"
              />
            </div>
            <div className="text-center text-3xl font-mono mt-3">
              {Math.round((status?.progress?.coverage_ratio ?? 0) * 100)}%
            </div>
          </div>

          <div className="flex gap-6 items-center">
            <button
              onClick={async () => {
                if (loading) return;
                setLoading(true);
                try {
                  if (status?.running) {
                    await postStop(baseUrl);
                    setMessage('Остановлено');
                    refresh();
                  } else {
                    const res = await postStart(baseUrl);
                    setMessage(res.status?.message ?? 'Старт');
                    startPolling();
                  }
                } catch (e: any) {
                  setMessage(String(e?.message ?? e));
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-emerald-600 px-10 py-4 rounded-full text-2xl font-bold shadow-lg"
            >
              {loading ? '...' : status?.running ? 'STOP' : 'START'}
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (predLoading) return;
                  setPredLoading(true);
                  try {
                    const res = await postPredictionStart(baseUrl);
                    if (res?.ok) {
                      setMessage(`Prediction started pid=${res.pid ?? 'n/a'}`);
                    } else {
                      setMessage(`Prediction start error: ${res?.error ?? 'unknown'}`);
                    }
                  } catch (e: any) {
                    setMessage(String(e?.message ?? e));
                  } finally {
                    setPredLoading(false);
                  }
                }}
                className="bg-indigo-600 px-4 py-2 rounded-full text-lg font-semibold shadow"
              >
                {predLoading ? '...' : 'Start Prediction'}
              </button>

              <button
                onClick={async () => {
                  if (predLoading) return;
                  setPredLoading(true);
                  try {
                    const res = await postPredictionStop(baseUrl);
                    if (res?.ok) {
                      setMessage('Prediction stopped');
                    } else {
                      setMessage('Error stopping prediction');
                    }
                  } catch (e: any) {
                    setMessage(String(e?.message ?? e));
                  } finally {
                    setPredLoading(false);
                  }
                }}
                className="bg-zinc-700 px-4 py-2 rounded-full text-lg font-semibold shadow"
              >
                Stop Prediction
              </button>
            </div>
          </div>

          {message && (
            <div className="text-xl text-rose-400 font-semibold mt-4">
              {message}
            </div>
          )}

          {lastError && (
            <div className="text-lg text-rose-400 font-mono mt-2">
              Ошибка: {lastError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}