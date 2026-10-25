"""Bounded NDJSON validation shared by serial, socket and browser telemetry transports."""
import json
import math
from pathlib import Path

MANIFEST = json.loads((Path(__file__).resolve().parents[1] / 'manifest.json').read_text(encoding='utf-8'))
PROTOCOL = MANIFEST['protocol']

def number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high

def decode(line):
    if isinstance(line, (bytes, bytearray)): line = line.decode('utf-8')
    if len(line.encode('utf-8')) > PROTOCOL['maxLineBytes']: raise ValueError('Frame too long')
    frame = json.loads(line)
    if not isinstance(frame, dict) or frame.get('v') != PROTOCOL['version']: raise ValueError('Protocol version')
    if not number(frame.get('seq'), 0, 2**32-1) or type(frame['seq']) is not int: raise ValueError('Invalid sequence')
    if not number(frame.get('ms'), 0, 2**53): raise ValueError('Invalid device timestamp')
    if frame.get('type') == 'telemetry': validate_telemetry(frame)
    elif frame.get('type') not in ['ack', 'status', 'hello', 'error']: raise ValueError('Unsupported incoming frame')
    return frame

def validate_telemetry(frame):
    if frame.get('device') != PROTOCOL['sensorDevice']: raise ValueError('Wrong telemetry device')
    p = frame.get('payload')
    if not isinstance(p, dict): raise ValueError('Missing payload')
    pm = p.get('pm')
    if not isinstance(pm, list) or len(pm) != 4 or [c.get('id') for c in pm if isinstance(c, dict)] != list(range(4)): raise ValueError('Four ordered PM channels required')
    for c in pm:
        if type(c.get('valid')) is not bool: raise ValueError('Sensor validity required')
        if not number(c.get('sampleMs'), 0, frame['ms']): raise ValueError('Future or invalid observation')
        if c['valid'] and (not number(c.get('pm25'), 0, 1000) or not number(c.get('pm10'), c['pm25'], 1000)): raise ValueError('Invalid PM reading')
        if c['valid'] and (not number(c.get('pm1'),0,c['pm25']) or not number(c.get('pm4'),c['pm25'],c['pm10'])): raise ValueError('Invalid PM size bins')
    if type(p.get('windValid')) is not bool: raise ValueError('Wind validity required')
    if p['windValid'] and (not number(p.get('windSpeed'), 0, 32.4) or not number(p.get('windDirection'), 0, 360)): raise ValueError('Wind range')
    for key in ['tankOk', 'hepaValid', 'pressureValid']:
        if type(p.get(key)) is not bool: raise ValueError('Missing safety flag: ' + key)
    if p['hepaValid'] and not number(p.get('hepaPa'), 0, 2000): raise ValueError('Invalid differential pressure')
    if p['pressureValid'] and not number(p.get('pressureBar'), 0, 16): raise ValueError('Invalid water pressure')
    sht = p.get('sht')
    if not isinstance(sht, list) or len(sht) != 1: raise ValueError('One SHT35 reading required')
    for c in sht:
        if type(c.get('valid')) is not bool: raise ValueError('SHT validity')
        if c['valid'] and (not number(c.get('temperatureC'), -40, 125) or not number(c.get('humidity'), 0, 100)): raise ValueError('Invalid SHT35 reading')

def encode(frame):
    return json.dumps(frame, separators=(',', ':'), allow_nan=False) + '\n'
