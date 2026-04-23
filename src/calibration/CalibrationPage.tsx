import React, { useCallback, useMemo, useState } from 'react';
import SettingsPanel from './components/SettingsPanel';
import StreamViewer from './components/StreamViewer';
import ControlPanel from './components/ControlPanel';
import StatusPanel from './components/StatusPanel';
import ResultViewer from './components/ResultViewer';
import { useCalibrationStatus } from './hooks/useCalibrationStatus';
import { BASE_URL } from './api';
import type { ResultResponse } from './api';

// derive defaults from BASE_URL env if possible
let defaultHost = '192.168.1.100';
let defaultPort = '8765';
try {
  const u = new URL(BASE_URL);
  defaultHost = u.hostname;
  defaultPort = u.port || (u.protocol === 'https:' ? '443' : '80');
} catch (e) {
  // ignore
}

export default function CalibrationPage() {
  const [host, setHost] = useState(() => {
    const stored = localStorage.getItem('calibration_host');
    if (!stored) return defaultHost;
    if (stored === '127.0.0.1' || stored === 'localhost') return defaultHost;
    return stored;
  });
  const [port, setPort] = useState(() => localStorage.getItem('calibration_port') ?? defaultPort);
  const baseUrl = useMemo(() => `http://${host}:${port}`, [host, port]);

  const { status, lastError, startPolling, stopPolling, refresh, isPolling } = useCalibrationStatus(() => baseUrl);
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onStarted = useCallback(() => {
    startPolling();
  }, [startPolling]);

  const onStopped = useCallback(() => {
    // request status once; polling will continue until running==false
    refresh();
  }, [refresh]);

  const handleResult = useCallback((res: ResultResponse) => {
    setResult(res);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result || !result.ok) return;
    const blob = new Blob([JSON.stringify((result as any).calibration, null, 2)], { type: 'application/json' });
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
    <div className="p-6 space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          <SettingsPanel onChange={(h, p) => { setHost(h); setPort(p); }} />
          <StreamViewer baseUrl={baseUrl} />
        </div>
        <div className="w-96 space-y-4">
          <ControlPanel
            baseUrl={baseUrl}
            statusRunning={!!status?.running}
            onStarted={onStarted}
            onStopped={onStopped}
            onResult={handleResult}
            setMessage={(m) => setMessage(m)}
          />
          <StatusPanel status={status} lastError={lastError} />
          <ResultViewer result={result?.ok ? (result as any).calibration : result} onDownload={handleDownload} />
          {message && <div className="text-sm text-zinc-300 p-2 bg-zinc-900/30 rounded">{message}</div>}
        </div>
      </div>
    </div>
  );
}

