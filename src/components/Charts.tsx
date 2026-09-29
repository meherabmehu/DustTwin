import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

type Point = { time?: string; twin?: number; baseline?: number; value?: number; label?: string; control?: number; reactive?: number; predictive?: number };

const tooltipStyle = {
  background: '#061a29', border: '1px solid rgba(18,217,245,.45)', borderRadius: 9,
  color: '#e7f9ff', fontSize: 11,
};

export function BoundaryLineChart({ data, tall = false, showAxis = true }: { data: Point[]; tall?: boolean; showAxis?: boolean }) {
  return (
    <div className={`chart-wrap ${tall ? 'chart-tall' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: showAxis ? -22 : -34, bottom: 0 }}>
          <CartesianGrid stroke="rgba(105,159,183,.13)" vertical horizontal />
          <XAxis dataKey="time" tick={{ fill: '#8fa8b9', fontSize: 9 }} axisLine={{ stroke: '#24465a' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#8fa8b9', fontSize: 9 }} axisLine={false} tickLine={false} width={32} domain={[0, 'auto']} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9db3c1' }} />
          <Line type="monotone" dataKey="baseline" stroke="#fb5c67" strokeWidth={1.6} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} isAnimationActive animationDuration={420} animationEasing="ease-out" />
          <Line type="monotone" dataKey="twin" stroke="#15dff3" strokeWidth={2.5} dot={false} activeDot={{ r: 3, fill: '#15dff3' }} isAnimationActive animationDuration={420} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SingleLineChart({ data, dataKey = 'value', color = '#13d8ed', showAxis = false }: { data: Point[]; dataKey?: string; color?: string; showAxis?: boolean }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 5, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="rgba(105,159,183,.14)" vertical={false} />
          {showAxis && <XAxis dataKey="label" tick={{ fill: '#8fa8b9', fontSize: 8 }} axisLine={false} tickLine={false} />}
          <YAxis tick={{ fill: '#8fa8b9', fontSize: 8 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonBars({ data, keys = ['baseline', 'continuous', 'reactive', 'predictive'], compact = false }: { data: Array<Record<string, string | number>>; keys?: string[]; compact?: boolean }) {
  const colors = ['#8a929f', '#ff723c', '#ffca2f', '#16d9ed'];
  return (
    <div className={`chart-wrap ${compact ? 'bar-compact' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 9, right: 5, left: -25, bottom: compact ? 0 : 10 }}>
          <CartesianGrid stroke="rgba(105,159,183,.13)" vertical={false} />
          {!compact && <XAxis dataKey="label" tick={{ fill: '#9fb4c3', fontSize: 9 }} axisLine={{ stroke: '#24465a' }} tickLine={false} />}
          <YAxis tick={{ fill: '#8fa8b9', fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip contentStyle={tooltipStyle} />
          {keys.map((key, index) => <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[3, 3, 0, 0]} maxBarSize={compact ? 17 : 33} isAnimationActive animationDuration={420} animationEasing="ease-out" />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function useSparkData(base = 30, points = 16) {
  return useMemo(() => Array.from({ length: points }, (_, i) => ({ label: `${i}`, value: Math.round(base + Math.sin(i * 0.7) * base * 0.16 + Math.cos(i * 0.27) * base * 0.1) })), [base, points]);
}

export function Sparkline({ base, color = '#13dbef' }: { base: number; color?: string }) {
  const data = useSparkData(base, 18);
  return <div className="sparkline"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 3, right: 1, left: 1, bottom: 2 }}><Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.7} dot={false} /></LineChart></ResponsiveContainer></div>;
}
