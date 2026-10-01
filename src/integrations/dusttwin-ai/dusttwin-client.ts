import {
  ARTIFACT_SHA256,
  MODEL_ID,
  type Forecast,
  type Health,
  type ModelEvidence,
  type PredictionRequest,
  type ReplayIndex,
  type ReplaySnapshot,
  type RequestOptions,
} from './types';

export class DustTwinApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    const errorBody = body as { detail?: string; errors?: Array<{ field: string; message: string }> } | null;
    const detail =
      errorBody?.detail ??
      errorBody?.errors?.map((item) => `${item.field}: ${item.message}`).join('; ');
    super(`DustTwin API ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'DustTwinApiError';
    this.status = status;
    this.body = body;
  }
}

export function getApiBaseUrl(): string {
  const envUrl = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_DUSTTWIN_API_URL
    : undefined;

  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    if (envUrl !== undefined && envUrl.trim()) {
      // In a remote Vite preview, browser localhost is the user's machine. Let the
      // dev-server proxy handle local backend URLs instead.
      if (
        typeof window !== 'undefined' &&
        window.location &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1' &&
        (envUrl.includes('127.0.0.1') || envUrl.includes('localhost'))
      ) {
        return '';
      }
      return envUrl.trim().replace(/\/$/, '');
    }

    return 'http://127.0.0.1:8000';
  }

  return envUrl?.trim() ? envUrl.trim().replace(/\/$/, '') : '';
}

export function verifyForecast(forecast: Forecast, second: number): Forecast {
  if (
    !forecast ||
    forecast.model_id !== MODEL_ID ||
    forecast.artifact_sha256 !== ARTIFACT_SHA256 ||
    !['live_inference', 'saved_inference'].includes(forecast.mode) ||
    forecast.units !== 'ug/m3' ||
    forecast.horizon_seconds !== 30 ||
    forecast.issue_time_seconds !== second ||
    forecast.target_time_seconds !== second + 30 ||
    !Number.isFinite(forecast.predicted_pm10_ug_m3) ||
    forecast.predicted_pm10_ug_m3 < 0
  ) {
    throw new Error('Forecast identity, clock or units do not match the frozen DustTwin model');
  }
  return forecast;
}

export class DustTwinClient {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;

  constructor(
    baseUrl: string = getApiBaseUrl(),
    options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.fetchImpl = (options.fetchImpl ?? globalThis.fetch).bind(globalThis);
  }

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      signal?: AbortSignal;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, signal, timeoutMs = this.timeoutMs } = options;
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);

    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener('abort', abort, { once: true });
    }

    const timer = setTimeout(
      () => controller.abort(new DOMException('DustTwin API timed out', 'TimeoutError')),
      timeoutMs
    );

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        ...(body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new DustTwinApiError(response.status, payload);
      }
      if (payload === null) {
        throw new Error('DustTwin API returned an invalid JSON response');
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  health(options?: RequestOptions): Promise<Health> {
    return this.request<Health>('/health', options);
  }

  recordings(options?: RequestOptions): Promise<ReplayIndex> {
    return this.request<ReplayIndex>('/v1/replay', options);
  }

  evidence(options?: RequestOptions): Promise<ModelEvidence> {
    return this.request<ModelEvidence>('/v1/evidence', options);
  }

  scenarios(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v1/scenarios', options);
  }

  savedScenario(id: string, options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/v1/scenarios/${encodeURIComponent(id)}`, options);
  }

  simulate(assumptions: Record<string, unknown>, options: RequestOptions = {}): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v1/simulate', {
      timeoutMs: 60000,
      ...options,
      method: 'POST',
      body: assumptions,
    });
  }

  async replay(episodeId: string, second: number, options?: RequestOptions): Promise<ReplaySnapshot> {
    if (!Number.isInteger(second) || second < 120) {
      throw new Error('Replay clock must be an integer at least 120');
    }
    const snapshot = await this.request<ReplaySnapshot>(
      `/v1/replay/${encodeURIComponent(episodeId)}?second=${second}`,
      options
    );
    verifyForecast(snapshot.forecast, second);
    if (
      snapshot.episode_id !== episodeId ||
      snapshot.clock_second !== second ||
      !Array.isArray(snapshot.past_observations) ||
      snapshot.past_observations.some((point) => point.time_seconds > second) ||
      (snapshot.matured_forecast && snapshot.matured_forecast.target_time_seconds > second)
    ) {
      throw new Error('Replay response does not match the selected recording and past-only clock');
    }
    return snapshot;
  }

  async predict(request: PredictionRequest, options: RequestOptions = {}): Promise<Forecast> {
    const forecast = await this.request<Forecast>('/v1/predict', {
      ...options,
      method: 'POST',
      body: request,
    });
    if (forecast.mode !== 'live_inference') {
      throw new Error('POST /v1/predict did not execute live inference');
    }
    return verifyForecast(forecast, request.issue_time_seconds);
  }
}
