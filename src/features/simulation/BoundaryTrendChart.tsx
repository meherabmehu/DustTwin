import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BoundaryId, ZoneId } from './simulationTypes';

export type TrendPollutant = 'pm25' | 'pm10';

export interface BoundaryTrendPoint {
  elapsedSeconds: number;
  label: string;
  readings: Record<BoundaryId, { pm25: number; pm10: number }>;
  activeZoneIds: ZoneId[];
}

const sensors: Array<{ id: BoundaryId; label: string; color: string }> = [
  { id: 'north', label: 'Sensor N', color: '#45e4a2' },
  { id: 'east', label: 'Sensor E', color: '#37c7f3' },
  { id: 'south', label: 'Sensor S', color: '#f3c64e' },
  { id: 'west', label: 'Sensor W', color: '#ff5969' },
];

const tooltipStyle = {
  background: 'rgba(3, 18, 30, .97)',
  border: '1px solid rgba(32, 205, 226, .52)',
  borderRadius: 7,
  color: '#e8f8fb',
  fontSize: 10,
};

export default function BoundaryTrendChart({ data, pollutant }: { data: BoundaryTrendPoint[]; pollutant: TrendPollutant }) {
  const firstActive = data.find((point) => point.activeZoneIds.length > 0);
  const lastActive = [...data].reverse().find((point) => point.activeZoneIds.length > 0);
  const tickInterval = Math.max(1, Math.ceil(data.length / 5) - 1);

  return (
    <div className="chart-wrap sim-trend-chart" role="img" aria-label={`Four-boundary ${pollutant === 'pm25' ? 'PM2.5' : 'PM10'} trend with active misting interval`}>
      {data.length < 2 ? (
        <div className="trend-awaiting"><i />Collecting live sensor trend…</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(119, 170, 190, .12)" vertical />
            {firstActive && lastActive && <ReferenceArea x1={firstActive.label} x2={lastActive.label} fill="#18dced" fillOpacity={0.09} strokeOpacity={0} />}
            <ReferenceLine y={40} stroke="rgba(250, 184, 84, .52)" strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fill: '#90aebd', fontSize: 8 }} axisLine={{ stroke: '#294b5c' }} tickLine={false} interval={tickInterval} minTickGap={15} />
            <YAxis tick={{ fill: '#90aebd', fontSize: 8 }} axisLine={false} tickLine={false} width={30} domain={[0, 'auto']} unit="" />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#8faab9' }} formatter={(value: number, name: string) => [`${Number(value).toFixed(0)} µg/m³`, name]} />
            {sensors.map((sensor) => (
              <Line
                key={sensor.id}
                type="monotone"
                dataKey={`readings.${sensor.id}.${pollutant}`}
                name={sensor.label}
                stroke={sensor.color}
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: sensor.color }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
