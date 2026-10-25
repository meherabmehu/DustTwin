import copy
import io
import json
from pathlib import Path
import socket
import sys
import threading
import unittest
import os
import hashlib
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'hardware/pi'))
from controller import Controller, directional_zones, risk_score, transport_lead
from protocol import decode, encode, MANIFEST
from transport import LineTransport
from app import Api, infer
from http.server import ThreadingHTTPServer

def frame(second=0, seq=None):
    return {'v':1,'type':'telemetry','device':'sensor-esp32','seq':second if seq is None else seq,'ms':second*1000,'payload':{'pm':[{'id':i,'pm1':74.4 if i in [0,3] else 12.4,'pm4':192 if i in [0,3] else 32,'pm25':120 if i in [0,3] else 20,'pm10':240 if i in [0,3] else 40,'valid':True,'sampleMs':second*1000} for i in range(4)],'sht':[{'valid':True,'temperatureC':28,'humidity':45}],'windValid':True,'windSpeed':3,'windDirection':315,'flowLpm':0,'pressureBar':0,'pressureValid':True,'tankOk':True,'hepaPa':45,'hepaValid':True,'dustIntensity':70,'activity':'Mixed work','strategy':'Hybrid Control','origin':'browser-model'}}

class HostTests(unittest.TestCase):
    def test_real_ai_if_configured(self):
        api=os.environ.get('DUSTTWIN_TEST_AI_URL')
        if not api:self.skipTest('Set DUSTTWIN_TEST_AI_URL to exercise actual inference API')
        c=Controller()
        for second in range(121):c.ingest(frame(second),[True]*4,True)
        infer(c,api)
        self.assertIsNotNone(c.forecast,list(c.events));self.assertEqual(c.forecast['mode'],'live_inference');self.assertEqual(c.forecast['target_time_seconds'],150)
    def test_real_firmware_build_evidence_matches_current_source(self):
        report=json.loads((ROOT/'public/hardware/build-status.json').read_text(encoding='utf-8'))
        self.assertEqual(len(report['targets']),4);self.assertTrue(all(t['compiled'] for t in report['targets']))
        for path,digest in report['sources'].items():
            if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=digest:self.skipTest('Current four-SPS30 firmware rebuild pending: automatic approval review unavailable; old build is not claimed current')
        for target in report['targets']:
            binary=ROOT/'hardware/firmware/.pio/build'/target['target']/'firmware.bin'
            if binary.exists():self.assertEqual(hashlib.sha256(binary.read_bytes()).hexdigest(),target['binarySha256'])
        self.assertFalse(report['firmwareExecuted']);self.assertFalse(report['hardwareTested'])
    def test_pressure_flow_timeout_latches_water_fault_and_leaves_extraction_available(self):
        now=[0.0];c=Controller(lambda:now[0]);c.ingest(frame(),[True]*4,True)
        now[0]=4;r=c.ingest(frame(4),[True]*4,True);self.assertFalse(r['payload']['pump']);self.assertTrue(r['payload']['motor']);self.assertTrue(c.water_fault)
    def test_protocol_roundtrip_all_four_devices(self):
        self.assertEqual(decode(encode(frame())),frame())
        for change in [{'v':2},{'seq':-1},{'ms':-1}]:
            with self.assertRaises(ValueError):decode(json.dumps({**frame(),**change}))
        bad=frame();bad['payload']['pm'][0]['pm10']=1
        with self.assertRaises(ValueError):decode(encode(bad))
        with self.assertRaises(ValueError):decode(' '*5000)
    def test_suction_waits_for_all_requested_feedback(self):
        c=Controller();one=c.ingest(frame(0),[False]*4,True);self.assertFalse(one['payload']['motor']);self.assertEqual(one['payload']['dampers'],[True,False,False,True])
        two=c.ingest(frame(1),[True,False,False,True],True);self.assertTrue(two['payload']['motor']);self.assertTrue(two['payload']['pump'])
    def test_invalid_sensor_and_wind_stop(self):
        for mutate in [lambda p:p['pm'][0].update(valid=False,pm25=None,pm10=None),lambda p:p.update(windValid=False)]:
            f=frame();mutate(f['payload']);r=Controller().ingest(f,[True]*4,True);self.assertTrue(r['payload']['stop'])
    def test_timeout_and_ack_device_session_sequence(self):
        now=[0.0];c=Controller(lambda:now[0]);cmd=c.ingest(frame(),[True]*4,True)
        ack={'type':'ack','device':'actuator-esp32','session':c.session,'commandId':cmd['seq'],'openFeedback':[True]*4,'error':'','estop':False}
        c.receive_ack(ack);now[0]=3;self.assertTrue(c.watchdog()['payload']['stop']);self.assertFalse(c.armed)
        with self.assertRaises(ValueError):c.receive_ack({**ack,'session':'other'})
        with self.assertRaises(ValueError):c.receive_ack({**ack,'commandId':9000})
    def test_duplicate_reordered_and_reboot_telemetry(self):
        c=Controller();c.ingest(frame(10),[True]*4,True)
        with self.assertRaises(ValueError):c.ingest(frame(10),[True]*4,True)
        r=c.ingest(frame(0),[True]*4,False);self.assertTrue(r['payload']['stop']);self.assertEqual(len(c.history),1)
    def test_causal_history_no_prefill_and_future_rejection(self):
        c=Controller()
        for t in range(121):c.ingest(frame(t),[True]*4,True)
        req=c.forecast_request();self.assertEqual(len(req['history']),121);self.assertEqual(req['horizon_seconds'],30);self.assertEqual(req['issue_time_seconds'],120)
        f=frame(122);f['payload']['pm'][0]['sampleMs']=123000
        with self.assertRaises(ValueError):c.ingest(f,[True]*4,True)
        f=frame(123);f['payload']['pm'][0]['valid']=False;r=c.ingest(f,[True]*4,True);self.assertTrue(r['payload']['stop'])
    def test_same_second_resampling_does_not_fabricate_history(self):
        c=Controller();c.ingest(frame(1,1),[True]*4,True);c.ingest(frame(1,2),[True]*4,True);self.assertEqual(len(c.history),1)
    def test_matured_prediction_reveals_only_at_target(self):
        c=Controller();c.pending_forecasts=[{'target_time_seconds':3,'predicted_pm10_ug_m3':100}]
        c.ingest(frame(2),[True]*4,True);self.assertEqual(len(c.matured),0);c.ingest(frame(3),[True]*4,True);self.assertEqual(len(c.matured),1)
    def test_auto_activity_rules_and_no_control(self):
        for activity,expected in [('Drilling near hood','Dry Extraction'),('Open-air soil','Targeted Misting'),('Mixed work','Hybrid Control')]:
            f=frame();f['payload'].update(strategy='Automatic selection',activity=activity);c=Controller();c.ingest(f,[True]*4,True);self.assertEqual(c.latest['strategy'],expected)
        f=frame();f['payload']['strategy']='No Control';r=Controller().ingest(f,[True]*4,True);self.assertFalse(r['payload']['motor']);self.assertFalse(r['payload']['pump'])
    def test_tank_pressure_hepa_interlocks(self):
        for key in ['tankOk','pressureValid']:
            f=frame();f['payload'][key]=False;r=Controller().ingest(f,[True]*4,True);self.assertFalse(r['payload']['pump']);self.assertTrue(r['payload']['motor'])
        f=frame();f['payload']['hepaPa']=350;r=Controller().ingest(f,[True]*4,True);self.assertFalse(r['payload']['motor']);self.assertTrue(r['payload']['pump'])
    def test_gpio_and_power_domains(self):
        c=MANIFEST['controllers'];outputs=c['actuator']['outputs'];self.assertEqual(len(set(outputs)),11);self.assertTrue(all(pin<34 and pin not in [0,2,5,12,15] for pin in outputs));self.assertEqual(len(set(c['sensor'].values())),len(c['sensor']))
        for w in MANIFEST['wires']:
            if w['from']=='drivers' and w['to']=='pump':self.assertEqual(w['voltage'],'12V')
    def test_real_tcp_line_transport_partial_reads_and_disconnect(self):
        server=socket.socket();server.bind(('127.0.0.1',0));server.listen();port=server.getsockname()[1]
        def peer():
            conn,_=server.accept();conn.sendall((encode(frame())+encode(frame(1))).encode());self.assertIn(b'command',conn.recv(4096));conn.close();server.close()
        thread=threading.Thread(target=peer);thread.start();transport=LineTransport('tcp://127.0.0.1:'+str(port));line=None
        for _ in range(100):
            line=transport.read()
            if line:break
        self.assertEqual(decode(line)['device'],'sensor-esp32')
        second=None
        for _ in range(100):
            second=transport.read()
            if second:break
        self.assertEqual(decode(second)['seq'],1);transport.write(encode({'type':'command'}));transport.close();thread.join(2)
    def test_local_api_executes_python_with_browser_peripheral_provenance(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),Api);server.origins=['http://127.0.0.1:5173'];server.ai_url='http://127.0.0.1:1';thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            request=Request('http://127.0.0.1:'+str(server.server_address[1])+'/telemetry',data=json.dumps({'client':'unit-test','frame':frame(),'openFeedback':[True]*4,'armed':True}).encode(),headers={'Content-Type':'application/json','Origin':server.origins[0]})
            with urlopen(request,timeout=3) as response:r=json.load(response)
            self.assertTrue(r['command']['payload']['motor']);self.assertIn('Python host executed',r['execution']);self.assertIn('modeled',r['execution'])
        finally:server.shutdown();server.server_close();thread.join(2)

if __name__=='__main__':unittest.main()
