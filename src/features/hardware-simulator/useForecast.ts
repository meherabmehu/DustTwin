import { useEffect, useRef, useState } from 'react';
import { DustTwinClient } from '../../integrations/dusttwin-ai/dusttwin-client';
import type { Forecast } from '../../integrations/dusttwin-ai/types';
import type { HardwareState } from './engine';

/** No synthetic history, no saved lab predictions presented as virtual sensor inference. */
export function useForecast(state: HardwareState) {
  const [matured, setMatured] = useState<Array<{ target: number; predicted: number; actual: number }>>([]);
  const outstanding = useRef(new Map<number, number>());
  const previousSecond = useRef(0);
  const [result, setResult] = useState<{ forecast: Forecast | null; message: string }>({ forecast: null, message: 'Collecting 121 virtual samples for existing PM10 model.' });
  const client = useRef(new DustTwinClient());
  const generation = useRef(0);
  const lastAttempt = useRef(-1);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; pending.current?.abort(); }, []);
  useEffect(() => {
    if (state.second < previousSecond.current) { outstanding.current.clear(); setMatured([]); }
    previousSecond.current = state.second;
    for (const [target, predicted] of outstanding.current) {
      if (target > state.second) continue;
      const point = state.history.find(p => p.time_seconds === target);
      if (point) setMatured(rows => [...rows, { target, predicted, actual: point.pm10_ug_m3 }].slice(-20));
      outstanding.current.delete(target);
    }
    if (state.history.length < 121 || !state.channels[0].valid || ['comm', 'power'].includes(state.fault)) {
      generation.current++;
      pending.current?.abort();
      lastAttempt.current = -1;
      setResult({ forecast: null, message: `Collecting virtual PM10 history: ${state.history.length}/121 samples.` });
      return;
    }
    // One request per five virtual seconds, including manual stepping; retry after outages.
    if (lastAttempt.current >= 0 && state.second - lastAttempt.current < 5) return;
    const current = ++generation.current;
    lastAttempt.current = state.second;
    pending.current?.abort();
    const abort = new AbortController();
    pending.current = abort;
    setResult(r => ({ ...r, message: 'Requesting trained-model inference on virtual PM10 history…' }));
    client.current.predict({ task_id: 'construction_pm10_30s_v1', monitor_id: 'OPC-N3', clock_type: 'elapsed_seconds_per_recording', units: 'ug/m3', horizon_seconds: 30, issue_time_seconds: state.second, history: state.history }, { signal: abort.signal, timeoutMs: 4000 })
      .then(forecast => { if (generation.current === current) { outstanding.current.set(forecast.target_time_seconds, forecast.predicted_pm10_ug_m3); setResult({ forecast, message: 'Existing trained model · virtual input · outside validated laboratory measurement domain.' }); } })
      .catch(error => { if (generation.current === current && !abort.signal.aborted) setResult({ forecast: null, message: `AI unavailable: ${error instanceof Error ? error.message : 'request failed'}. Deterministic controls remain active.` }); });
  }, [state.history, state.fault, state.second]);
  return { ...result, matured };
}
