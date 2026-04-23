import React, { useEffect, useState } from 'react';
import { BASE_URL } from '../api';

const HOST_KEY = 'calibration_host';
const PORT_KEY = 'calibration_port';

type Props = {
  onChange: (host: string, port: string) => void;
};

// derive default host/port from env BASE_URL if possible
let defaultHost = '192.168.1.100';
let defaultPort = '8765';
try {
  const u = new URL(BASE_URL);
  defaultHost = u.hostname;
  defaultPort = u.port || (u.protocol === 'https:' ? '443' : '80');
} catch (e) {
  // ignore
}

export default function SettingsPanel({ onChange }: Props) {
  const [host, setHost] = useState(() => {
    const stored = localStorage.getItem(HOST_KEY);
    if (!stored) return defaultHost;
    // Ignore values that point to localhost when an env BASE_URL is provided.
    if (stored === '127.0.0.1' || stored === 'localhost') return defaultHost;
    return stored;
  });
  const [port, setPort] = useState(() => localStorage.getItem(PORT_KEY) ?? defaultPort);

  useEffect(() => {
    localStorage.setItem(HOST_KEY, host);
    localStorage.setItem(PORT_KEY, port);
    onChange(host, port);
  }, [host, port]);

  return (
    <div className="p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-xl">
      <h3 className="text-sm font-semibold mb-2">Backend URL</h3>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="host"
        />
        <input
          className="w-24 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="port"
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Default: <span className="font-mono">{defaultHost}:{defaultPort}</span>
      </p>
    </div>
  );
}

