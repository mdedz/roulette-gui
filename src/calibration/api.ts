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

export type PredictionStartResponse = {
  ok: boolean;
  pid?: number;
  command?: string;
  error?: string;
};

export type PredictionStopResponse = {
  ok: boolean;
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

// Default base URL — can be overridden by env var REACT_APP_API_URL
export const BASE_URL = process.env.REACT_APP_API_URL || 'http://100.109.227.119:8765';

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

async function apiCall<T = any>(path: string, init: RequestInit = {}, timeout = DEFAULT_TIMEOUT, baseUrl?: string): Promise<T> {
  const base = (baseUrl || BASE_URL).replace(/\/$/, '');
  const url = `${base}${path}`;
  try {
    const resp = await fetchWithTimeout(url, init, timeout);
    // Server returns 200 even for errors; parse JSON and let callers inspect `ok` field.
    const json = await parseJsonSafe<T>(resp);
    return json;
  } catch (err) {
    // Treat any fetch/parse/abort error as backend unreachable per requirements.
    throw new Error('Backend not reachable');
  }
}

export async function postStart(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<StartResponse> {
  return await apiCall<StartResponse>('/api/calibration/start', { method: 'POST' }, timeout, baseUrl);
}

export async function postStop(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<StopResponse> {
  return await apiCall<StopResponse>('/api/calibration/stop', { method: 'POST' }, timeout, baseUrl);
}

export async function getStatus(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<StatusResponse> {
  return await apiCall<StatusResponse>('/api/calibration/status', { method: 'GET' }, timeout, baseUrl);
}

export async function getResult(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<ResultResponse> {
  return await apiCall<ResultResponse>('/api/calibration/result', { method: 'GET' }, timeout, baseUrl);
}

export async function postPredictionStart(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<PredictionStartResponse> {
  return await apiCall<PredictionStartResponse>('/api/prediction/start', { method: 'POST' }, timeout, baseUrl);
}

export async function postPredictionStop(baseUrl?: string, timeout = DEFAULT_TIMEOUT): Promise<PredictionStopResponse> {
  return await apiCall<PredictionStopResponse>('/api/prediction/stop', { method: 'POST' }, timeout, baseUrl);
}

