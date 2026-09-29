import { useEffect, useRef } from 'react';
import { TerminalSquare } from 'lucide-react';
import { formatElapsedTime } from './simulatorEngine';
import type { SerialEntry } from './simulatorTypes';

type Props = { entries: SerialEntry[]; running: boolean };

export default function SerialMonitor({ entries, running }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  return (
    <article className="output-panel serial-monitor-panel">
      <div className="serial-monitor-header">
        <h2><TerminalSquare aria-hidden="true" /> Serial Monitor</h2>
        <span className={`serial-live-indicator ${running ? 'active' : ''}`}><i />{running ? 'LIVE' : 'PAUSED'} · 115200 BAUD</span>
      </div>
      <div className="serial-terminal" role="log" aria-label="DustTwin serial monitor output" aria-live="polite" aria-relevant="additions text">
        {entries.length === 0 ? (
          <div className="serial-empty-line"><span>00:00:00</span><b>READY</b><p>Waiting for Run. Sensor and relay events will appear here.</p></div>
        ) : entries.map((entry) => (
          <div className={`serial-line level-${entry.level}`} key={entry.id}>
            <time dateTime={formatElapsedTime(entry.elapsedSeconds)}>{formatElapsedTime(entry.elapsedSeconds)}</time>
            <b>{entry.level.toUpperCase()}</b>
            <p>{entry.message}</p>
          </div>
        ))}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      <p className="serial-monitor-footnote">Deterministic frontend log · values are simulated locally, not read from physical hardware.</p>
    </article>
  );
}
