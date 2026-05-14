import React, { useEffect, useMemo, useState } from 'react';
import { BASE_URL } from '../api';

const HOST_KEY = 'calibration_host';
const PORT_KEY = 'calibration_port';

type Props = {
  onChange: (host: string, port: string) => void;
};

function deriveDefaultHostPort() {
  let defaultHost = '192.168.1.100';
  let defaultPort = '8765';

  try {
    const u = new URL(BASE_URL);
    defaultHost = u.hostname;
    defaultPort = u.port || (u.protocol === 'https:' ? '443' : '80');
  } catch {
    // ignore
  }

  return { defaultHost, defaultPort };
}

export default function SettingsPanel({ onChange }: Props) {
  const { defaultHost, defaultPort } = useMemo(() => deriveDefaultHostPort(), []);

  const [host, setHost] = useState(() => {
    const stored = localStorage.getItem(HOST_KEY);
    if (!stored) return defaultHost;
    if (stored === '127.0.0.1' || stored === 'localhost') return defaultHost;
    return stored;
  });

  const [port, setPort] = useState(() => localStorage.getItem(PORT_KEY) ?? defaultPort);

  useEffect(() => {
    localStorage.setItem(HOST_KEY, host);
    localStorage.setItem(PORT_KEY, port);
    onChange(host, port);
  }, [host, port, onChange]);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Backend</div>
        <div className="text-sm font-semibold text-white">Connection</div>
      </div>

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="host"
        />
        <input
          className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="port"
        />
      </div>

      <div className="mt-2 text-[11px] text-zinc-500">
        Default: <span className="font-mono text-zinc-300">{defaultHost}:{defaultPort}</span>
      </div>
    </div>
  );
}