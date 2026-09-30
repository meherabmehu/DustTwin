import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ControlStrategy, StrategyComparisonResult } from './simulationTypes';

export type StrategyMetric = 'pm25' | 'pm10' | 'water' | 'exceedance';

const metricOptions: Array<{ value: StrategyMetric; label: string; unit: string }> = [
  { value: 'pm25', label: 'Boundary PM2.5', unit: 'µg/m³' },
  { value: 'pm10', label: 'Boundary PM10', unit: 'µg/m³' },
  { value: 'water', label: 'Water Use', unit: 'L' },
  { value: 'exceedance', label: 'Boundary Exceedance Time', unit: 'min' },
];

const colors: Record<ControlStrategy, string> = {
  noControl: '#929ba7',
  continuous: '#ff713e',
  reactive: '#f5ca43',
  predictive: '#19d9ec',
};

const labels: Record<ControlStrategy, string> = {
  noControl: 'No Control',
  continuous: 'Continuous',
  reactive: 'Reactive',
  predictive: 'DustTwin',
};

type ChartDatum = { label: string; value: number; result: StrategyComparisonResult };
type StrategyTooltipProps = { active?: boolean; payload?: Array<{ payload: ChartDatum }> };

function StrategyTooltip({ active, payload }: StrategyTooltipProps) {
  const result = payload?.[0]?.payload.result;
  if (!active || !result) return null;
  return (
    <div className="strategy-tooltip">
      <strong style={{ color: colors[result.strategy] }}>{labels[result.strategy]}</strong>
      <span>Boundary PM2.5 <b>{result.boundaryPm25.toFixed(1)} µg/m³</b></span>
      <span>Boundary PM10 <b>{result.boundaryPm10.toFixed(1)} µg/m³</b></span>
      <span>Above limit <b>{result.exceedanceMinutes.toFixed(1)} min</b></span>
      <span>Water use <b>{result.waterUsedL.toFixed(1)} L</b></span>
      <span>Active zones <b>{result.activeZones}</b></span>
    </div>
  );
}

function metricValue(result: StrategyComparisonResult, metric: StrategyMetric): number {
  switch (metric) {
    case 'pm10': return result.boundaryPm10;
    case 'water': return result.waterUsedL;
    case 'exceedance': return result.exceedanceMinutes;
    case 'pm25':
    default: return result.boundaryPm25;
  }
}

export default function StrategyComparisonChart({
  results,
  metric,
  onMetricChange,
}: {
  results: StrategyComparisonResult[];
  metric: StrategyMetric;
  onMetricChange: (metric: StrategyMetric) => void;
}) {
  const selectedMetric = metricOptions.find((option) => option.value === metric) ?? metricOptions[0];
  const data: ChartDatum[] = results.map((result) => ({
    label: labels[result.strategy],
    value: metricValue(result, metric),
    result,
  }));
  const tickInterval = Math.max(0, data.length - 5);

  return (
    <article className="sim-chart-card strategy-comparison-card" aria-label="Four-strategy comparison">
      <div className="chart-card-heading">
        <h3><BarChart3 size={16} aria-hidden="true" />Strategy Comparison</h3>
        <label className="chart-select-wrap">
          <span className="sr-only">Comparison metric</span>
          <select aria-label="Comparison metric" value={metric} onChange={(event) => onMetricChange(event.currentTarget.value as StrategyMetric)}>
            {metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="comparison-window-note">Same 8-minute modeled window · estimates only</div>
      <div className="chart-wrap sim-strategy-chart" role="img" aria-label={`Four strategies compared by ${selectedMetric.label}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: -19, bottom: 2 }}>
            <CartesianGrid stroke="rgba(119, 170, 190, .12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#acbdc7', fontSize: 8 }} axisLine={{ stroke: '#294b5c' }} tickLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: '#90aab9', fontSize: 8 }} axisLine={false} tickLine={false} width={29} />
            <Tooltip content={<StrategyTooltip />} cursor={{ fill: 'rgba(31, 123, 145, .10)' }} />
            <Bar dataKey="value" name={selectedMetric.label} radius={[3, 3, 0, 0]} maxBarSize={38} isAnimationActive animationDuration={350}>
              {data.map((entry) => <Cell key={entry.result.strategy} fill={colors[entry.result.strategy]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="strategy-chart-legend" aria-label="Strategy legend">
        {(['noControl', 'continuous', 'reactive', 'predictive'] as const).map((strategy) => (
          <span key={strategy}><i style={{ background: colors[strategy] }} />{labels[strategy]}</span>
        ))}
      </div>
      <div className="chart-unit-note">{selectedMetric.unit} · hover a bar for all comparison results</div>
    </article>
  );
}
