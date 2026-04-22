export type StartResponse = {
  ok: boolean;
  command: string;
  status: {
    running: boolean;
    started: boolean;
    message: string;
  };
  error?: string;
};

export type StopResponse = {
  ok: boolean;
  command: string;
  status: {
    running: boolean;
    started: boolean;
    message: string;
  };
};

export type StatusResponse = {
  ok: boolean;
  lifecycle_state: string;
  current_state: string;
  calibration_ready: boolean;
  samples_collected: number;
  bins_filled: number;
  bins_total: number;
  status_message: string;
  last_error: string | null;
  started: boolean;
  running: boolean;
  has_best_calibration: boolean;
  last_detection_present: boolean;
  last_detection_accepted: boolean;
  current_center: { x: number; y: number };
  source_label: string;
  source_size: { width: number; height: number };
  progress: {
    frame_index: number;
    samples_collected: number;
    bins_filled: number;
    bins_total: number;
    coverage_ratio: number;
    bin_sample_counts: number[];
    filled_bin_indices: number[];
  };
};

export type ResultResponse = { ok: false; message: string } | { ok: true; saved: true; path: string; calibration: object };

const DEFAULT_TIMEOUT = 7000;

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(input, { signal: controller.signal, ...init });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

async function parseJsonSafe<T = any>(resp: Response): Promise<T> {
  const text = await resp.text();
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error('JSON parse error: ' + String(err));
  }
}

export async function postStart(baseUrl: string, timeout = DEFAULT_TIMEOUT): Promise<StartResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/calibration/start`;
  const resp = await fetchWithTimeout(url, { method: 'POST' }, timeout);
  return await parseJsonSafe<StartResponse>(resp);
}

export async function postStop(baseUrl: string, timeout = DEFAULT_TIMEOUT): Promise<StopResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/calibration/stop`;
  const resp = await fetchWithTimeout(url, { method: 'POST' }, timeout);
  return await parseJsonSafe<StopResponse>(resp);
}

export async function getStatus(baseUrl: string, timeout = DEFAULT_TIMEOUT): Promise<StatusResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/calibration/status`;
  const resp = await fetchWithTimeout(url, { method: 'GET' }, timeout);
  return await parseJsonSafe<StatusResponse>(resp);
}

export async function getResult(baseUrl: string, timeout = DEFAULT_TIMEOUT): Promise<ResultResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/calibration/result`;
  const resp = await fetchWithTimeout(url, { method: 'GET' }, timeout);
  return await parseJsonSafe<ResultResponse>(resp);
}

