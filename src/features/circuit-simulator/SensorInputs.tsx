import type { ReactNode } from 'react';
import { CloudFog, Droplet, Gauge, RotateCcw, Thermometer, Wind } from 'lucide-react';
import { SIMULATION_INPUT_LIMITS } from '../../config/simulationThresholds';
import type { SensorInputKey, SimulatorState } from './simulatorTypes';

type Props = {
  state: SimulatorState;
  onChange: (key: SensorInputKey, value: number) => void;
  onResetToDefault?: () => void;
};

type SensorControlProps = {
  label: string;
  source?: string;
  note?: string;
  sensorKey: SensorInputKey;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: Props['onChange'];
  icon: ReactNode;
  derivedValue?: number;
  derivedLabel?: string;
};

function SensorControl({
  label,
  source,
  note,
  sensorKey,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  icon,
  derivedValue,
  derivedLabel,
}: SensorControlProps) {
  const id = `sensor-${sensorKey}`;
  const precision = step < 1 ? 1 : 0;
  const displayValue = value.toFixed(precision);
  const update = (raw: string) => {
    if (raw === '') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(sensorKey, parsed);
  };

  return (
    <div className="sensor-control-card">
      <div className="sensor-control-heading">
        <span className="sensor-control-icon" aria-hidden="true">{icon}</span>
        <span className="sensor-control-title">
          <label htmlFor={`${id}-number`}>{label}</label>
          {source && <small className="sensor-control-source">{source}</small>}
        </span>
      </div>
      <div className="sensor-value-row">
        <input
          id={`${id}-number`}
          className="sensor-number-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          aria-label={`${label} numeric input`}
          onChange={(event) => update(event.currentTarget.value)}
        />
        <span className="sensor-unit">{unit}</span>
      </div>
      <input
        id={id}
        className="sensor-range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} slider`}
        onChange={(event) => update(event.currentTarget.value)}
      />
      <div className="sensor-range-bounds">
        <span>{min}</span>
        <span>{max} {unit}</span>
      </div>
      {note && <small className="sensor-note">{note}</small>}
      {derivedValue !== undefined && (
        <small className="sensor-derived-value">
          {derivedLabel}: <b>{derivedValue} µg/m³</b>
        </small>
      )}
    </div>
  );
}

function compassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((degrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length];
}

export default function SensorInputs({ state, onChange, onResetToDefault }: Props) {
  const limits = SIMULATION_INPUT_LIMITS;

  return (
    <article className="output-panel simulator-sensor-panel" aria-labelledby="sensor-input-title">
      <div className="sensor-panel-header">
        <div className="sensor-header-left">
          <h2 id="sensor-input-title">
            <Gauge aria-hidden="true" /> Sensor Inputs
          </h2>
          <p>Adjust the deterministic sensor readings. PM10 is derived from PM2.5 for demonstration.</p>
        </div>

        {onResetToDefault && (
          <button
            type="button"
            className="sensor-reset-btn"
            onClick={onResetToDefault}
            title="Reset sensor inputs to default specification"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Reset to Default</span>
          </button>
        )}
      </div>

      <div className="sensor-input-grid">
        <SensorControl
          label="Dust source intensity"
          sensorKey="dustIntensity"
          value={state.dustIntensity}
          min={limits.dustIntensity.min}
          max={limits.dustIntensity.max}
          step={limits.dustIntensity.step}
          unit="%"
          icon={<CloudFog />}
          onChange={onChange}
        />
        <SensorControl
          label="PM2.5 · Sensor 1"
          sensorKey="pm1"
          value={state.pm1}
          min={limits.pm25.min}
          max={limits.pm25.max}
          step={limits.pm25.step}
          unit="µg/m³"
          derivedValue={state.pm10_1}
          derivedLabel="Derived PM10"
          icon={<Gauge />}
          onChange={onChange}
        />
        <SensorControl
          label="PM10 · Sensor 2"
          sensorKey="pm2"
          value={state.pm2}
          min={limits.pm25.min}
          max={limits.pm25.max}
          step={limits.pm25.step}
          unit="µg/m³"
          derivedValue={state.pm10_2}
          derivedLabel="Derived PM10"
          icon={<Gauge />}
          onChange={onChange}
        />
        <SensorControl
          label="Temperature · DHT22"
          sensorKey="temperature"
          value={state.temperature}
          min={limits.temperature.min}
          max={limits.temperature.max}
          step={limits.temperature.step}
          unit="°C"
          icon={<Thermometer />}
          onChange={onChange}
        />
        <SensorControl
          label="Humidity · DHT22"
          sensorKey="humidity"
          value={state.humidity}
          min={limits.humidity.min}
          max={limits.humidity.max}
          step={limits.humidity.step}
          unit="% RH"
          icon={<Droplet />}
          onChange={onChange}
        />
        <SensorControl
          label="Wind speed"
          source="Anemometer · GPIO 32"
          sensorKey="windSpeed"
          value={state.windSpeed}
          min={limits.windSpeed.min}
          max={limits.windSpeed.max}
          step={limits.windSpeed.step}
          unit="m/s"
          icon={<Wind />}
          onChange={onChange}
        />
        <SensorControl
          label="Wind direction"
          source="Wind Vane · GPIO 33"
          note={`Compass: ${compassDirection(state.windDirection)}`}
          sensorKey="windDirection"
          value={state.windDirection}
          min={limits.windDirection.min}
          max={limits.windDirection.max}
          step={limits.windDirection.step}
          unit="°"
          icon={<Wind />}
          onChange={onChange}
        />
      </div>
    </article>
  );
}
