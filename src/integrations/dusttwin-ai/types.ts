export const MODEL_ID = 'hist_gb_depth3_iter100' as const;
export const ARTIFACT_SHA256 = 'd78f1b37269f72af45933e01722968fb13ed82178f6d8b3e4c5584d46cec09c7' as const;

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface Measurement {
  time_seconds: number;
  observation_time_seconds: number;
  pm10_ug_m3: number;
}

export interface PredictionRequest {
  task_id: 'construction_pm10_30s_v1';
  monitor_id: 'OPC-N3';
  clock_type: 'elapsed_seconds_per_recording';
  units: 'ug/m3';
  horizon_seconds: 30;
  issue_time_seconds: number;
  history: Measurement[];
}

export interface Forecast {
  mode: 'live_inference' | 'saved_inference';
  model_id: string;
  artifact_sha256: string;
  issue_time_seconds: number;
  target_time_seconds: number;
  horizon_seconds: 30;
  units: 'ug/m3';
  predicted_pm10_ug_m3: number;
  current_pm10_ug_m3: number;
  baselines: {
    persistence_pm10_ug_m3: number;
    trailing_mean_pm10_ug_m3: number;
  };
  scope: string;
  snapshot_id?: string;
  task_id?: string;
  dataset_doi?: string;
  monitor_id?: string;
  input_quality?: { snapshots: 121; maximum_observation_age_seconds: number };
  features?: Record<string, number>;
  inference_milliseconds?: number;
  demo_setting_ug_m3?: number;
  crossing_status?: 'already_exceeded' | 'endpoint_exceeds_setting' | 'endpoint_below_setting';
  crossing_eta_seconds?: null;
}

export interface MaturedForecast {
  issue_time_seconds: number;
  target_time_seconds: number;
  predicted_pm10_ug_m3: number;
  actual_pm10_ug_m3: number;
  target_observation_time_seconds: number;
}

export interface ReplaySnapshot {
  episode_id: string;
  partition: 'validation' | 'test';
  clock_second: number;
  request: PredictionRequest;
  forecast: Forecast;
  matured_forecast: MaturedForecast | null;
  past_observations: { time_seconds: number; pm10_ug_m3: number }[];
  attribution: string;
}

export interface Recording {
  episode_id: string;
  partition: 'validation' | 'test';
  group: number;
  label: string;
  file: string;
  sha256: string;
  last_second: number;
  first_issue_second: number;
  last_issue_second: number;
  suggested_start_second: number;
}

export interface ReplayIndex {
  schema_version: number;
  task_id: string;
  model_id: string;
  artifact_sha256: string;
  attribution: string;
  source_url: string;
  license_url: string;
  episodes: Recording[];
}

export interface Health {
  ready: boolean;
  mode: 'live_inference' | 'saved_inference';
  model_id: string;
  artifact_sha256: string;
  task_id: string;
  monitor_id: string;
  horizon_seconds: 30;
  grid_interval_seconds: 1;
  reason: string | null;
}

export interface ModelEvidence {
  metadata: {
    model_id: string;
    experiment_id: string;
    task_id: string;
    trained_at_utc: string;
    artifact_file: string;
    artifact_sha256: string;
    artifact_bytes: number;
    feature_names: string[];
    python_version: string;
    python_major_minor: [number, number];
    dependencies: Record<string, string>;
    host: {
      cpu: string;
      architecture: string;
      platform: string;
    };
  };
  test: {
    dataset_doi: string;
    episodes: number;
    windows: number;
    metrics: {
      model: { mae: number; rmse: number; r2: number };
      persistence: { mae: number; rmse: number; r2: number };
      trailing_mean: { mae: number; rmse: number; r2: number };
    };
  };
  training: {
    selected_model: string;
    validation_metrics: Record<string, unknown>;
  };
}

export type BackendStatus = 'checking' | 'live' | 'saved' | 'offline';
