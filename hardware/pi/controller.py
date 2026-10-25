"""Hardware-independent deterministic host controller. Never retrains the existing model.

Risk/zone/transport formulas follow the existing TS modules and have cross-language
parity tests. Local receive times drive safety; device timestamps drive causal AI history.
"""
import math
import time
import uuid
import json
from pathlib import Path
from collections import deque
from protocol import MANIFEST, PROTOCOL, decode

def clamp(v, low, high): return min(high, max(low, v))

def risk_score(p):
    peak = max(c['pm25'] for c in p['pm'][:4] if c['valid']) if any(c['valid'] for c in p['pm'][:4]) else 0
    env = p['sht'][0]
    t, h = env.get('temperatureC', 28), env.get('humidity', 45)
    # Exact shared project weights and JS Math.round behavior for nonnegative scores.
    dust = clamp(p.get('dustIntensity', 70), 0, 100)
    score = math.floor(clamp(dust * .3 + clamp(p.get('windSpeed', 0), 0, 10) * 2 + clamp((peak - 8) / 142, 0, 1) * 35 + (1 - clamp(h, 0, 100) / 100) * 10 + clamp(2.5 + (clamp(t, 10, 50) - 28) / 22 * 2.5, 0, 5), 0, 100) + .5)
    level = 'VERY HIGH' if score >= 80 or peak >= 150 else 'HIGH' if score >= 55 or peak >= 75 else 'MODERATE' if score >= 32 or peak >= 40 else 'LOW'
    return score, level

def directional_zones(degrees):
    sector = int(((degrees % 360) + 22.5) // 45) % 8
    return [[True,False,False,False],[True,True,False,False],[False,True,False,False],[False,True,True,False],[False,False,True,False],[False,False,True,True],[False,False,False,True],[True,False,False,True]][sector]

def transport_lead(p):
    # Same site dimensions/source/boundaries and effective transport as plumeModel.ts.
    w, dust = clamp(p.get('windSpeed', 0),0,10), clamp(p.get('dustIntensity',70),0,100)
    env = p['sht'][0]
    speed = max(.25, (.20 + w*.26 + dust*.002) * clamp(.85 + w*.05 + max(0,clamp(env.get('temperatureC',28),10,50)-28)*.002 - clamp(env.get('humidity',45),0,100)*.0006,.70,1.55))
    distances = [math.hypot((x-.47)*120,(y-.53)*80) for x,y in [(.5,.12),(.85,.5),(.5,.88),(.15,.5)]]
    active = directional_zones(p.get('windDirection',0))
    return math.floor(min(d for d,on in zip(distances,active) if on)/speed+.5)

class Controller:
    def __init__(self, clock=time.monotonic):
        self.config=json.loads((Path(__file__).parent/'config.json').read_text(encoding='utf-8'))
        self.clock=clock; self.session=uuid.uuid4().hex; self.seq=0; self.last_sensor=None; self.last_ack=None
        self.sensor_seq=-1; self.device_ms=-1; self.history=deque(maxlen=121); self.feedback=[False]*4
        self.latest=None; self.forecast=None; self.matured=deque(maxlen=20); self.pending_forecasts=[]; self.last_frame=None
        self.pending={}; self.events=deque(maxlen=250); self.armed=False; self.last_forecast_second=-1
        self.pump_since=None;self.water_fault=False

    def event(self, text): self.events.append({'time':self.clock(),'message':text})
    def command(self, payload):
        self.seq+=1
        frame={'v':PROTOCOL['version'],'type':'command','device':PROTOCOL['hostDevice'],'session':self.session,'seq':self.seq,'ms':int(self.clock()*1000),'payload':payload}
        self.pending[self.seq]=self.clock()
        self.pending={k:v for k,v in self.pending.items() if self.clock()-v<10}
        return frame

    def stop(self, reason):
        self.armed=False; self.event('[RASPBERRY-PI] STOP: '+reason)
        return self.command({'stop':True,'safe':False,'dampers':[False]*4,'valves':[False]*4,'motor':False,'pump':False,'fan':False})

    def receive_ack(self, frame):
        if frame.get('device')!=PROTOCOL['actuatorDevice'] or frame.get('session')!=self.session: raise ValueError('ACK device/session mismatch')
        command_id=frame.get('commandId')
        if command_id not in self.pending and not (frame.get('type')=='status' and command_id==self.seq): raise ValueError('Unknown/late acknowledgement')
        if frame.get('estop') or frame.get('error'): self.armed=False
        feedback=frame.get('openFeedback')
        if isinstance(feedback,list) and len(feedback)==4 and all(type(x) is bool for x in feedback): self.feedback=feedback
        self.last_ack=self.clock()
        for key in list(self.pending):
            if key<=command_id: self.pending.pop(key)
        self.event('[ACTUATOR-ESP32] ACK #'+str(command_id))

    def ingest(self, frame, virtual_feedback=None, auto_arm=False):
        # Validate all entry points, including direct API callers.
        frame=decode(__import__('json').dumps(frame,allow_nan=False))
        if frame['type']!='telemetry': raise ValueError('Telemetry frame required')
        if frame['ms'] < self.device_ms:
            self.sensor_seq=-1; self.history.clear(); self.armed=False; self.event('Sensor clock reboot: history cleared; re-arm required')
        if frame['seq']<=self.sensor_seq: raise ValueError('Duplicate/reordered telemetry')
        self.sensor_seq=frame['seq'];self.device_ms=frame['ms'];self.last_sensor=self.clock();self.last_frame=frame
        p=frame['payload']; second=frame['ms']//1000; source=p['pm'][0]
        for key in ['activity','strategy','dustIntensity']:p.setdefault(key,self.config[key])
        if source['valid'] and frame['ms']-source['sampleMs']<=3000:
            if self.history and second==self.history[-1]['time_seconds']: self.history.pop()
            if self.history and second!=self.history[-1]['time_seconds']+1: self.history.clear()
            self.history.append({'time_seconds':second,'observation_time_seconds':source['sampleMs']/1000,'pm10_ug_m3':source['pm10']})
        else: self.history.clear()
        for old in list(self.pending_forecasts):
            if old['target_time_seconds']==second and source['valid']: self.matured.append({**old,'actual_pm10_ug_m3':source['pm10']});self.pending_forecasts.remove(old)
            elif old['target_time_seconds']<second: self.pending_forecasts.remove(old)
        valid=all(c['valid'] and frame['ms']-c['sampleMs']<=3000 for c in p['pm']) and p['windValid'] and all(c['valid'] for c in p['sht'])
        if not valid: return self.stop('invalid/stale telemetry')
        if virtual_feedback is not None:
            if len(virtual_feedback)!=4 or not all(type(v) is bool for v in virtual_feedback): raise ValueError('Invalid virtual feedback')
            self.feedback=virtual_feedback
        if auto_arm: self.armed=True;self.last_ack=self.clock()
        if not self.armed: return self.stop('not armed')
        score,level=risk_score(p); zones=directional_zones(p['windDirection'])
        strategy=p.get('strategy','Automatic selection');activity=p.get('activity','Mixed work')
        if strategy=='Automatic selection': strategy='Dry Extraction' if activity=='Drilling near hood' else 'Targeted Misting' if activity=='Open-air soil' or p['windSpeed']>5 else 'Hybrid Control'
        if strategy not in ['No Control','Dry Extraction','Targeted Misting','Hybrid Control']: raise ValueError('Unknown strategy')
        demand=level!='LOW' or max(c['pm10'] for c in p['pm'][:4])>=150
        dry=demand and strategy in ['Dry Extraction','Hybrid Control'] and p['hepaValid'] and p.get('hepaPa',0)<MANIFEST['field']['hepaTripPa']
        wet=demand and strategy in ['Targeted Misting','Hybrid Control'] and p['tankOk'] and p['pressureValid']
        if wet and self.pump_since is None:self.pump_since=self.clock()
        if wet and self.pump_since is not None and self.clock()-self.pump_since>3 and (p.get('pressureBar',0)<1 or p.get('flowLpm',0)<=0):
            self.water_fault=True;self.event('[RASPBERRY-PI] Water pressure/flow interlock; service and restart host to reset')
        if not wet:self.pump_since=None
        wet=wet and not self.water_fault
        dampers=[bool(on and dry) for on in zones];valves=[bool(on and wet) for on in zones]
        motor=any(dampers) and all(not want or feedback for want,feedback in zip(dampers,self.feedback))
        payload={'dampers':dampers,'valves':valves,'motor':motor,'pump':any(valves),'fan':False,'safe':True}
        self.latest={'riskScore':score,'riskLevel':level,'exposed':zones,'strategy':strategy,'leadTimeSeconds':transport_lead(p) if demand else None,'origin':p.get('origin','unknown'),'historyLength':len(self.history)}
        self.event(f'[RASPBERRY-PI] Risk {level}; zones '+','.join(z for z,on in zip('ABCD',zones) if on))
        return self.command(payload)

    def watchdog(self):
        now=self.clock();timeout=PROTOCOL['timeoutMs']/1000
        if self.last_sensor is None or now-self.last_sensor>timeout or self.last_ack is None or now-self.last_ack>timeout: return self.stop('telemetry/ACK timeout')
        return None

    def forecast_request(self):
        if len(self.history)!=121:return None
        second=self.history[-1]['time_seconds']
        if second-self.last_forecast_second<5:return None
        self.last_forecast_second=second
        return {'task_id':'construction_pm10_30s_v1','monitor_id':'OPC-N3','clock_type':'elapsed_seconds_per_recording','units':'ug/m3','horizon_seconds':30,'issue_time_seconds':second,'history':list(self.history)}
