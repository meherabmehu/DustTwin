"""DustTwin host application for Raspberry Pi OS or a PC Python runtime.

serve: local Hardware Lab bridge/build status. replay: consume real protocol JSONL.
serial: two independent USB UART/Wokwi TCP links; explicit --arm required.
All browser inputs are tagged virtual. This is not Raspberry Pi hardware emulation.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from controller import Controller
from protocol import decode, encode
from transport import LineTransport

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=ROOT/'hardware/runtime'
BUILD_REPORT=ROOT/'public/hardware/build-status.json'
sessions={}; lock=threading.RLock(); build_job={'state':'idle','output':''}

def infer(controller, api_url):
    request=controller.forecast_request()
    if request is None:return
    try:
        req=urllib.request.Request(api_url.rstrip('/')+'/v1/predict',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=3) as response: result=json.load(response)
        metadata=json.loads((ROOT/'ai-backend/models/model-metadata.json').read_text(encoding='utf-8'))
        if result.get('mode')!='live_inference' or result.get('model_id')!=metadata['model_id'] or result.get('artifact_sha256')!=metadata['artifact_sha256'] or result.get('issue_time_seconds')!=request['issue_time_seconds'] or result.get('target_time_seconds')!=request['issue_time_seconds']+30:raise ValueError('Forecast identity/time mismatch')
        controller.forecast=result;controller.pending_forecasts.append(result);controller.event('[AI] Genuine existing-model inference; synthetic inputs outside laboratory validation')
    except Exception as error:
        controller.forecast=None;controller.event('[AI] Offline/unavailable: '+str(error))

def snapshot(c):return {'session':c.session,'controller':c.latest,'forecast':c.forecast,'matured':list(c.matured),'events':list(c.events),'armed':c.armed,'pendingCommands':len(c.pending)}

def log_frame(frame):
    RUNTIME.mkdir(parents=True,exist_ok=True)
    with (RUNTIME/'events.jsonl').open('a',encoding='utf-8') as stream:stream.write(encode(frame))

def run_build():
    build_job.update(state='running',output='Compiling checked-in source; editor working copies are not executed.')
    try:
        result=subprocess.run([sys.executable,str(ROOT/'hardware/tools/build.py')],cwd=ROOT,capture_output=True,text=True,timeout=900)
        build_job.update(state='passed' if result.returncode==0 else 'failed',output=(result.stdout+result.stderr)[-40000:])
    except Exception as error:build_job.update(state='failed',output=str(error))

class Api(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def allowed(self):
        origin=self.headers.get('Origin')
        return self.headers.get('Host','').split(':')[0] in ['localhost','127.0.0.1'] and (origin is None or origin in self.server.origins)
    def reply(self,status,payload):
        self.send_response(status)
        origin=self.headers.get('Origin')
        if origin in self.server.origins:self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
        self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(payload,allow_nan=False).encode())
    def do_OPTIONS(self):
        if not self.allowed():self.reply(403,{'error':'Origin/host not allowed'});return
        self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.headers.get('Origin',''));self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
    def do_GET(self):
        if not self.allowed():self.reply(403,{'error':'Origin/host not allowed'});return
        if self.path=='/health':self.reply(200,{'ready':True,'runtime':'python-host-on-PC-or-Pi','physicalHardwareTested':False})
        elif self.path=='/build':self.reply(200,{**build_job,'report':json.loads(BUILD_REPORT.read_text()) if BUILD_REPORT.exists() else None})
        else:self.reply(404,{'error':'Unknown endpoint'})
    def do_POST(self):
        if not self.allowed():self.reply(403,{'error':'Origin/host not allowed'});return
        try:
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=8192 or self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('Bounded JSON body required')
            body=json.loads(self.rfile.read(length))
            if self.path=='/build':
                if build_job['state']=='running':self.reply(409,build_job);return
                build_job['state']='running';threading.Thread(target=run_build,daemon=True).start();self.reply(202,build_job);return
            if self.path!='/telemetry':self.reply(404,{'error':'Unknown endpoint'});return
            key=body.get('client')
            if not isinstance(key,str) or not 1<=len(key)<=100:raise ValueError('Client session required')
            with lock:
                if key not in sessions and len(sessions)>=16:raise ValueError('Too many sessions; restart bridge to clear')
                c=sessions.setdefault(key,Controller())
                frame=body['frame']
                # Virtual transport only: physical devices use the serial command-line mode.
                if frame.get('payload',{}).get('origin')!='browser-model':raise ValueError('Browser bridge accepts only browser-model telemetry')
                c.armed=body.get('armed') is True
                command=c.ingest(frame,body.get('openFeedback'),auto_arm=body.get('armed') is True)
                # Acknowledge model transport explicitly. Not an executing firmware ACK.
                ack={'v':1,'type':'ack','device':'actuator-esp32','seq':command['seq'],'ms':frame['ms'],'session':c.session,'commandId':command['seq'],'openFeedback':body.get('openFeedback',[False]*4),'error':'','estop':False,'armed':body.get('armed') is True}
                c.receive_ack(ack); infer(c,self.server.ai_url); log_frame({'origin':'python-host/browser-peripheral-model','telemetry':frame,'command':command})
                self.reply(200,{'command':command,'status':snapshot(c),'execution':'Python host executed; peripherals/ACK modeled, ESP32 firmware not executed'})
        except (ValueError,KeyError,TypeError,json.JSONDecodeError) as error:self.reply(400,{'error':str(error)})

def serial_runtime(args):
    c=Controller()
    virtual=[]
    if args.virtual_input:
        virtual=[decode(line)['payload'] for line in Path(args.virtual_input).read_text(encoding='utf-8').splitlines() if line.strip()]
        if not virtual:raise ValueError('Virtual input file is empty')
    while True:
        sensor=actuator=None
        try:
            sensor=LineTransport(args.sensor);actuator=LineTransport(args.actuator)
            connected=time.monotonic()
            arm_requested=args.arm;virtual_index=0;last_inject=0
            while True:
                if virtual and time.monotonic()-last_inject>=1:
                    sensor.write(encode({'v':1,'type':'inject','device':'hardware-lab','seq':virtual_index,'ms':int(time.monotonic()*1000),'payload':virtual[min(virtual_index,len(virtual)-1)]}))
                    virtual_index+=1;last_inject=time.monotonic()
                ack=actuator.read()
                if ack:
                    try:
                        f=decode(ack)
                        if f['type'] in ['ack','status']:
                            c.receive_ack(f)
                            if args.arm and f.get('armed') is True and not f.get('error'):c.armed=True
                    except ValueError as error:c.event('Rejected actuator frame: '+str(error))
                line=sensor.read()
                if line:
                    try:
                        frame=decode(line)
                        if frame['type']=='telemetry':
                            p=frame['payload']
                            if arm_requested and all(item['valid'] for item in p['pm']) and all(item['valid'] for item in p['sht']) and p['windValid']:
                                actuator.write(encode(c.command({'arm':True})));arm_requested=False
                                continue
                            command=c.ingest(frame);actuator.write(encode(command));infer(c,args.ai_url);log_frame({'telemetry':frame,'command':command})
                    except (ValueError,UnicodeError) as error:actuator.write(encode(c.stop(str(error))))
                stop=c.watchdog() if c.armed else None
                if stop:actuator.write(encode(stop))
                RUNTIME.mkdir(parents=True,exist_ok=True);(RUNTIME/'status.json').write_text(json.dumps(snapshot(c),indent=2),encoding='utf-8')
        except (OSError,ConnectionError) as error:
            print('Link lost; actuator firmware watchdog must fail off:',error,file=sys.stderr)
            c=Controller() # new session, explicit arm must be requested again on restart
            args.arm=False;time.sleep(1)
        finally:
            if actuator:
                try:actuator.write(encode(c.stop('transport closing')))
                except Exception:pass
                actuator.close()
            if sensor:sensor.close()

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('mode',choices=['serve','replay','serial']);p.add_argument('--port',type=int,default=8010);p.add_argument('--file');p.add_argument('--sensor');p.add_argument('--actuator');p.add_argument('--arm',action='store_true');p.add_argument('--virtual-input',help='Explicitly injected peripheral NDJSON; repeat final snapshot, Wokwi virtual-input build only');p.add_argument('--ai-url',default='http://127.0.0.1:8000');a=p.parse_args()
    if a.mode=='serve':
        server=ThreadingHTTPServer(('127.0.0.1',a.port),Api);server.ai_url=a.ai_url;server.origins=['http://127.0.0.1:'+str(n) for n in [5173,5174,4173]]+['http://localhost:'+str(n) for n in [5173,5174,4173]]
        print('DustTwin local Python Hardware Lab: http://127.0.0.1:'+str(a.port),flush=True);server.serve_forever()
    elif a.mode=='replay':
        if not a.file:p.error('--file telemetry.jsonl is required')
        c=Controller()
        for line in Path(a.file).read_text(encoding='utf-8').splitlines():
            if line.strip():print(encode(c.ingest(decode(line),[True]*4,auto_arm=True)).strip());infer(c,a.ai_url)
    else:
        if not a.sensor or not a.actuator:p.error('--sensor and --actuator ports required')
        serial_runtime(a)
if __name__=='__main__':main()
