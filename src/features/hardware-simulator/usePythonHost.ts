import { useEffect, useRef, type Dispatch } from 'react';
import { sensorFrame, type HostCommand } from './communication';
import type { Action, HardwareState } from './engine';
export function usePythonHost(state: HardwareState, dispatch: Dispatch<Action>) {
  const client = useRef(crypto.randomUUID()), epoch = useRef(0), previous = useRef(-1), sequence = useRef(0);
  useEffect(() => {
    if (!state.hostEnabled) return;
    if (state.second < previous.current) client.current = crypto.randomUUID();
    previous.current = state.second;
    const current = ++epoch.current, abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 1800);
    const frame = JSON.parse(sensorFrame(state)); frame.seq = ++sequence.current;
    fetch('http://127.0.0.1:8010/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ client: client.current, frame, openFeedback: state.position.map(v => v >= 1 - 1e-8), armed: state.armed }) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Python host rejected telemetry'); const p = data.command?.payload as HostCommand; if (!p || !Array.isArray(p.dampers) || p.dampers.length !== 4 || !Array.isArray(p.valves) || p.valves.length !== 4) throw new Error('Invalid host command'); if (epoch.current === current) dispatch({ type: 'host-command', command: p, status: `Python host executed · ${data.status.controller?.riskLevel ?? 'inhibited'} · ${data.status.controller?.strategy ?? 'STOP'} · peripherals modeled` }); })
      .catch(error => { if (epoch.current === current) dispatch({ type: 'host-command', command: null, status: `Python host offline: ${error instanceof Error ? error.message : error}` }); })
      .finally(() => clearTimeout(timeout));
    return () => { epoch.current++; clearTimeout(timeout); abort.abort(); };
  }, [state.hostEnabled, state.second, state.armed, state.inputs, state.channels, state.strategy, state.activity, state.fault, dispatch]);
}
