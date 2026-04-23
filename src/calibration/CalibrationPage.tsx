import React, { useCallback, useState } from 'react';
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

  const { status, lastError, startPolling, refresh } = useCalibrationStatus(() => baseUrl);

  const onStarted = useCallback(() => {
    startPolling();
  }, [startPolling]);

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

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_35%),linear-gradient(180deg,#09090b_0%,#050505_45%,#09090b_100%)] text-zinc-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

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