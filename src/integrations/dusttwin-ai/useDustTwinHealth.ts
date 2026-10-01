import { useEffect, useState } from 'react';
import { DustTwinClient, getApiBaseUrl } from './dusttwin-client';
import type { BackendStatus, Health } from './types';

export interface HealthState {
  status: BackendStatus;
  health: Health | null;
  error: string | null;
  recheck: () => void;
}

export function useDustTwinHealth(baseUrl: string = getApiBaseUrl()): HealthState {
  const [state, setState] = useState<HealthState>({
    status: 'checking',
    health: null,
    error: null,
    recheck: () => {},
  });
  const [trigger, setTrigger] = useState(0);

  const recheck = () => setTrigger((n) => n + 1);

  useEffect(() => {
    let active = true;
    const client = new DustTwinClient(baseUrl);
    const controller = new AbortController();

    setState((prev) => ({ ...prev, status: 'checking', recheck }));

    client
      .health({ signal: controller.signal, timeoutMs: 4000 })
      .then((health) => {
        if (!active) return;
        const status: BackendStatus = health.ready ? 'live' : 'saved';
        setState({ status, health, error: null, recheck });
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'offline', health: null, error: message, recheck });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [baseUrl, trigger]);

  return state;
}
