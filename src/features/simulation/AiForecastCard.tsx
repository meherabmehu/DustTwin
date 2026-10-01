import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Play, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { BackendStatus, Forecast, Health, MaturedForecast, ReplaySnapshot } from '../../integrations/dusttwin-ai/types';
import { getApiBaseUrl } from '../../integrations/dusttwin-ai/dusttwin-client';

export interface EpisodeInfo {
  id: string;
  label: string;
  group: number;
  firstSecond: number;
  lastSecond: number;
  suggestedSecond: number;
}

export const EPISODES: EpisodeInfo[] = [
  { id: 'lab_e4_drill90', label: 'Group 4 · 90s drilling (Heavy dust)', group: 4, firstSecond: 120, lastSecond: 4770, suggestedSecond: 1010 },
  { id: 'lab_e4_drill50', label: 'Group 4 · 50s drilling (Medium dust)', group: 4, firstSecond: 120, lastSecond: 5470, suggestedSecond: 1282 },
  { id: 'lab_e4_drill10', label: 'Group 4 · 10s drilling (Light dust)', group: 4, firstSecond: 120, lastSecond: 5180, suggestedSecond: 222 },
  { id: 'lab_e3_drill90', label: 'Group 3 · 90s drilling (Heavy dust)', group: 3, firstSecond: 120, lastSecond: 4810, suggestedSecond: 1152 },
  { id: 'lab_e3_drill50', label: 'Group 3 · 50s drilling (Medium dust)', group: 3, firstSecond: 120, lastSecond: 4060, suggestedSecond: 500 },
  { id: 'lab_e3_drill10', label: 'Group 3 · 10s drilling (Light dust)', group: 3, firstSecond: 120, lastSecond: 3590, suggestedSecond: 120 },
];

export interface AiForecastCardProps {
  simulationSource: 'deterministic' | 'replay';
  onToggleSource: (source: 'deterministic' | 'replay') => void;
  backendStatus: BackendStatus;
  backendHealth: Health | null;
  backendError: string | null;
  selectedEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
  replaySecond: number;
  onChangeSecond: (second: number) => void;
  replaySnapshot: ReplaySnapshot | null;
  replayStatus: 'loading' | 'live' | 'saved' | 'unavailable';
  replayError: string | null;
}

export function AiForecastCard({
  simulationSource,
  onToggleSource,
  backendStatus,
  backendHealth,
  selectedEpisodeId,
  onSelectEpisode,
  replaySecond,
  onChangeSecond,
  replaySnapshot,
  replayStatus,
  replayError,
}: AiForecastCardProps) {
  const currentEpisode = EPISODES.find((e) => e.id === selectedEpisodeId) ?? EPISODES[0];
  const forecast: Forecast | null = replaySnapshot?.forecast ?? null;
  const matured: MaturedForecast | null = replaySnapshot?.matured_forecast ?? null;

  const isAiActive =
    simulationSource === 'replay' &&
    (replayStatus === 'live' || replayStatus === 'saved') &&
    forecast !== null;

  const [isPlaying, setIsPlaying] = React.useState(false);

  // Auto-step timeline when playing
  React.useEffect(() => {
    if (!isPlaying || simulationSource !== 'replay') return;
    const interval = setInterval(() => {
      const nextSecond =
        replaySecond >= Math.min(currentEpisode.lastSecond, 2000)
          ? currentEpisode.firstSecond
          : replaySecond + 5;
      onChangeSecond(nextSecond);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, simulationSource, replaySecond, currentEpisode, onChangeSecond]);

  const currentPm10 = forecast?.current_pm10_ug_m3 ?? null;
  const predictedPm10 = forecast?.predicted_pm10_ug_m3 ?? null;

  const delta =
    currentPm10 !== null && predictedPm10 !== null ? predictedPm10 - currentPm10 : null;
  const deltaText =
    delta !== null
      ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} µg/m³`
      : '—';

  const trend =
    currentPm10 !== null && predictedPm10 !== null
      ? predictedPm10 > currentPm10 + 5
        ? 'Rising'
        : predictedPm10 < currentPm10 - 5
        ? 'Falling'
        : 'Stable'
      : '—';

  return (
    <article className="sim-panel ai-forecast-card" aria-label="AI PM10 Forecast">
      <div className="ai-forecast-head">
        <div className="ai-forecast-title">
          <Cpu size={15} aria-hidden="true" />
          <span>AI PM10 Forecast</span>
          <small className="ai-horizon-pill">+30s</small>
        </div>
        <div className="ai-status-wrap">
          <span className={`ai-impact-badge ${isAiActive ? 'active' : 'standby'}`}>
            {isAiActive ? 'AI IMPACT: ACTIVE' : 'AI IMPACT: STANDBY'}
          </span>
          {simulationSource === 'replay' ? (
            <span className={`ai-status-badge ${replayStatus}`}>
              {replayStatus === 'live' && 'LIVE TRAINED MODEL'}
              {replayStatus === 'saved' && 'SAVED INFERENCE'}
              {replayStatus === 'loading' && 'FETCHING…'}
              {replayStatus === 'unavailable' && 'AI OFFLINE'}
            </span>
          ) : (
            <span className={`ai-status-badge ${backendStatus}`}>
              {backendStatus === 'live' && 'LIVE TRAINED MODEL'}
              {backendStatus === 'saved' && 'SAVED INFERENCE'}
              {backendStatus === 'checking' && 'CHECKING…'}
              {backendStatus === 'offline' && 'OFFLINE'}
            </span>
          )}
        </div>
      </div>

      <div className="ai-mode-tabs" role="tablist" aria-label="Simulation data source">
        <button
          type="button"
          role="tab"
          aria-selected={simulationSource === 'deterministic'}
          className={`ai-tab-btn ${simulationSource === 'deterministic' ? 'is-active' : ''}`}
          onClick={() => {
            setIsPlaying(false);
            onToggleSource('deterministic');
          }}
        >
          Deterministic Scenario
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={simulationSource === 'replay'}
          className={`ai-tab-btn ${simulationSource === 'replay' ? 'is-active' : ''}`}
          onClick={() => onToggleSource('replay')}
        >
          Measured Replay (AI)
        </button>
      </div>

      {simulationSource === 'deterministic' && (
        <div className="ai-deterministic-view">
          {backendStatus === 'offline' ? (
            <div className="ai-notice-box offline">
              <AlertTriangle size={13} aria-hidden="true" />
              <div>
                <strong>AI Forecast Unavailable</strong>
                <p>
                  Python AI backend offline at <code>{getApiBaseUrl()}</code>. Simulation is running
                  in standard deterministic scenario mode without fake data substitution.
                </p>
              </div>
            </div>
          ) : (
            <div className="ai-notice-box ready">
              <CheckCircle2 size={13} aria-hidden="true" />
              <div>
                <strong>AI Inference Backend Ready</strong>
                <p>
                  Model <code>{backendHealth?.model_id ?? 'hist_gb_depth3_iter100'}</code> ready for
                  30s PM10 forecasting. Switch to <em>Measured Replay</em> above to exercise live model
                  predictions with historical OPC-N3 dust data.
                </p>
              </div>
            </div>
          )}
          <div className="ai-specs-list">
            <div><span>Model:</span><b>DustTwin PM10 Forecast (HistGBM)</b></div>
            <div><span>Input History:</span><b>120s / 121 causal snapshots</b></div>
            <div><span>Target Horizon:</span><b>PM10 at +30 seconds</b></div>
            <div><span>Target Pollutant:</span><b>PM10 only (PM2.5 is simulated)</b></div>
          </div>
        </div>
      )}

      {simulationSource === 'replay' && (
        <div className="ai-replay-view">
          <div className="ai-replay-controls">
            <div className="ai-replay-row">
              <label htmlFor="ai-episode-select">Episode:</label>
              <select
                id="ai-episode-select"
                value={selectedEpisodeId}
                onChange={(e) => {
                  setIsPlaying(false);
                  onSelectEpisode(e.target.value);
                }}
              >
                {EPISODES.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ai-replay-slider">
              <div className="ai-slider-labels">
                <span>Timeline Clock</span>
                <b>
                  {replaySecond}s <small>(Issue: {replaySecond}s → Target: {replaySecond + 30}s)</small>
                </b>
              </div>
              <input
                type="range"
                min={currentEpisode.firstSecond}
                max={Math.min(currentEpisode.lastSecond, 2000)}
                step={5}
                value={replaySecond}
                onChange={(e) => onChangeSecond(Number(e.target.value))}
                aria-label="Replay timeline scrubber"
              />
            </div>

            <div className="ai-quick-jumps">
              <button
                type="button"
                className="ai-jump-btn"
                onClick={() => onChangeSecond(currentEpisode.suggestedSecond)}
                title="Jump to peak drilling dust event"
              >
                ⚡ Jump to Peak ({currentEpisode.suggestedSecond}s)
              </button>
              <button
                type="button"
                className="ai-jump-btn"
                onClick={() => onChangeSecond(currentEpisode.firstSecond)}
                title="Jump to episode start"
              >
                ↺ Start (120s)
              </button>
              <button
                type="button"
                className={`ai-jump-btn play ${isPlaying ? 'is-playing' : ''}`}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸ Pause' : '▶ Step (+5s)'}
              </button>
            </div>
          </div>

          {replayStatus === 'unavailable' ? (
            <div className="ai-notice-box offline">
              <AlertTriangle size={13} aria-hidden="true" />
              <div>
                <strong>Replay Forecast Unavailable</strong>
                <p>{replayError ?? 'Backend service offline. Run python scripts/serve.py to connect.'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="ai-forecast-grid">
                <div className="ai-forecast-tile">
                  <small>Current Observed PM10</small>
                  <strong>
                    {currentPm10 !== null ? `${currentPm10.toFixed(1)} µg/m³` : '—'}
                  </strong>
                  <span>OPC-N3 sensor at {replaySecond}s</span>
                </div>
                <div className="ai-forecast-tile highlight">
                  <small>AI Predicted PM10 (+30s)</small>
                  <strong>
                    {predictedPm10 !== null ? `${predictedPm10.toFixed(1)} µg/m³` : '—'}
                  </strong>
                  <span>Trained HistGBM model ({replaySecond + 30}s)</span>
                </div>
                <div className="ai-forecast-tile">
                  <small>30s Forecast Trend</small>
                  <strong className={`trend-${trend.toLowerCase()}`}>
                    {trend === 'Rising' && <TrendingUp size={13} />}
                    {trend === 'Falling' && <TrendingDown size={13} />}
                    {trend === 'Stable' && <Minus size={13} />}
                    <span>{trend}</span>
                  </strong>
                  <span>Delta vs observed ({deltaText})</span>
                </div>
                <div className="ai-forecast-tile">
                  <small>Forecast Horizon</small>
                  <strong>+30 sec</strong>
                  <span>
                    Mode:{' '}
                    {forecast?.mode === 'live_inference'
                      ? 'Live trained model'
                      : forecast?.mode === 'saved_inference'
                      ? 'Saved inference'
                      : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="ai-mapping-subtext">
                AI PM10 forecast influences modeled dust severity in the physical site simulation.
              </div>

              {forecast?.baselines && (
                <div className="ai-baseline-bar">
                  <span>Baselines:</span>
                  <span>Persistence: <b>{forecast.baselines.persistence_pm10_ug_m3.toFixed(1)} µg/m³</b></span>
                  <span>Trailing Mean: <b>{forecast.baselines.trailing_mean_pm10_ug_m3.toFixed(1)} µg/m³</b></span>
                </div>
              )}

              {matured && (
                <div className="ai-matured-box" aria-label="Matured forecast verification">
                  <div className="ai-matured-head">
                    <Clock size={11} aria-hidden="true" />
                    <span>Matured Forecast Verification (Issued at {matured.issue_time_seconds}s)</span>
                  </div>
                  <div className="ai-matured-values">
                    <div>
                      <small>Earlier Prediction:</small>
                      <b>{matured.predicted_pm10_ug_m3.toFixed(1)} µg/m³</b>
                    </div>
                    <div>
                      <small>Recorded Actual:</small>
                      <b>{matured.actual_pm10_ug_m3.toFixed(1)} µg/m³</b>
                    </div>
                    <div>
                      <small>Abs Error:</small>
                      <b className="ai-error-val">
                        {Math.abs(matured.predicted_pm10_ug_m3 - matured.actual_pm10_ug_m3).toFixed(1)} µg/m³
                      </b>
                    </div>
                  </div>
                  <small className="ai-matured-note">
                    Verified against causally matured OPC-N3 sensor ground truth at {matured.target_time_seconds}s.
                  </small>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
