import React, { useCallback, useEffect, useRef, useState } from 'react';
import StreamViewer from './components/StreamViewer';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import ResultViewer from './components/ResultViewer';
import { useCalibrationStatus } from './hooks/useCalibrationStatus';
import { BASE_URL } from './api';
import type { ResultResponse } from './api';

export default function CalibrationPage() {
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_35%),linear-gradient(180deg,#09090b_0%,#050505_45%,#09090b_100%)] text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-end">
          <div className={`inline-flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold ${quality.color} text-black`}>
            <span className="uppercase text-xs opacity-80">Calibration</span>
            <span className="font-mono">{quality.text}</span>
            <span className="text-[11px] opacity-70">({quality.hint})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">

          <div className="space-y-8">
            <StreamViewer baseUrl={baseUrl} />
          </div>

          <aside className="space-y-8 xl:sticky xl:top-6 self-start">

            <div className="rounded-[2rem] border border-zinc-800/70 bg-zinc-950/60 p-5">
              <ControlPanel
                baseUrl={baseUrl}
                statusRunning={!!status?.running}
                onStarted={onStarted}
                onStopped={onStopped}
                onResult={handleResult}
                setMessage={setMessage}
              />
            </div>

            <div className="rounded-[2rem] border border-zinc-800/70 bg-zinc-950/60 p-5">
              <StatusPanel status={status} lastError={lastError} />
            </div>

            <div className="rounded-[2rem] border border-zinc-800/70 bg-zinc-950/60 p-5">
              <ResultViewer
                result={result?.ok ? (result as any).calibration : result}
                onDownload={handleDownload}
              />
            </div>

            {message && (
              <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
                {message}
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}