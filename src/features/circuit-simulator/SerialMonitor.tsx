import { useEffect, useRef } from 'react';
import { Eraser, TerminalSquare } from 'lucide-react';
import { formatElapsedTime } from './simulatorEngine';
import type { SerialEntry } from './simulatorTypes';

type Props = { entries: SerialEntry[]; running: boolean; onClear: () => void };

export default function SerialMonitor({ entries, running, onClear }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  }, [entries.length]);

  return (
    <article className="output-panel serial-monitor-panel">
      <div className="serial-monitor-header">
        <h2><TerminalSquare aria-hidden="true" /> Serial Monitor</h2>
        <div className="serial-monitor-actions">
          <span className={`serial-live-indicator ${running ? 'active' : ''}`}><i />{running ? 'RUNNING' : 'PAUSED'} · 115200 BAUD</span>
          <button type="button" className="serial-clear-button" onClick={onClear} disabled={entries.length === 0} aria-label="Clear serial monitor logs" title="Clear logs"><Eraser size={13} aria-hidden="true" /><span>Clear</span></button>
        </div>
      </div>
      <div ref={terminalRef} className="serial-terminal" role="log" aria-label="DustTwin serial monitor output" aria-live="polite" aria-relevant="additions text">
        {entries.length === 0 ? (
          <div className="serial-empty-line"><time>00:00:00</time><b>READY</b><p>Waiting for Run. Sensor and relay events will appear here.</p></div>
        ) : entries.map((entry) => (
          <div className={`serial-line level-${entry.level}`} key={entry.id}>
            <time dateTime={formatElapsedTime(entry.elapsedSeconds)}>[{formatElapsedTime(entry.elapsedSeconds)}]</time>
            <b>{entry.level.toUpperCase()}</b>
            <p>{entry.message}</p>
          </div>
        ))}
      </div>
      <p className="serial-monitor-footnote">Deterministic frontend log · values are simulated locally, not read from physical hardware.</p>
    </article>
  );
}
