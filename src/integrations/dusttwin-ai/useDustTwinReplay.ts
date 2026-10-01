import { useEffect, useMemo, useState } from 'react';
import { DustTwinClient, getApiBaseUrl } from './dusttwin-client';
import type { ReplaySnapshot } from './types';

export type ReplayState =
  | { status: 'loading'; snapshot: null; error: null }
  | { status: 'live' | 'saved'; snapshot: ReplaySnapshot; error: null }
  | { status: 'unavailable'; snapshot: null; error: string };

export function useDustTwinReplay(
  baseUrl: string = getApiBaseUrl(),
  episodeId: string,
  second: number
): ReplayState {
  const selection = useMemo(() => ({ baseUrl, episodeId, second }), [baseUrl, episodeId, second]);
  const [result, setResult] = useState<{
    selection: typeof selection;
    state: ReplayState;
  } | null>(null);

  useEffect(() => {
    if (!episodeId) {
      setResult({
        selection,
        state: { status: 'unavailable', snapshot: null, error: 'No replay episode selected.' },
      });
      return;
    }
    if (second < 120) {
      setResult({
        selection,
        state: { status: 'unavailable', snapshot: null, error: 'Replay requires at least 120s of causal history.' },
      });
      return;
    }
    const controller = new AbortController();
    const api = new DustTwinClient(baseUrl);

    api
      .replay(episodeId, second, { signal: controller.signal })
      .then((snapshot) => {
        if (!controller.signal.aborted) {
          setResult({
            selection,
            state: {
              status: snapshot.forecast.mode === 'live_inference' ? 'live' : 'saved',
              snapshot,
              error: null,
            },
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            selection,
            state: {
              status: 'unavailable',
              snapshot: null,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      });

    return () => controller.abort();
  }, [selection, baseUrl, episodeId, second]);

  // Changing the selected clock never briefly displays a previous clock's value.
  if (!result || result.selection !== selection) {
    return { status: 'loading', snapshot: null, error: null };
  }
  return result.state;
}
