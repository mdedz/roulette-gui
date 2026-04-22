import React, { useEffect, useState } from 'react';

const HOST_KEY = 'calibration_host';
const PORT_KEY = 'calibration_port';

type Props = {
  onChange: (host: string, port: string) => void;
};

export default function SettingsPanel({ onChange }: Props) {
  const [host, setHost] = useState(() => localStorage.getItem(HOST_KEY) ?? '127.0.0.1');
  const [port, setPort] = useState(() => localStorage.getItem(PORT_KEY) ?? '8765');

  useEffect(() => {
    localStorage.setItem(HOST_KEY, host);
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
      <p className="mt-2 text-xs text-zinc-500">Default: <span className="font-mono">127.0.0.1:8765</span></p>
    </div>
  );
}

