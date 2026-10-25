"""Compile actual ESP32 targets and record real results, never emulator claims."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[2]
PROJECT=ROOT/'hardware/firmware'
def main():
    isolated=ROOT/'.tooling/venv'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    command=[str(isolated),'-m','platformio'] if isolated.exists() else [shutil.which('pio') or 'pio']
    environment=os.environ.copy()
    if isolated.exists():environment['PLATFORMIO_CORE_DIR']=str(ROOT/'.tooling/platformio')
    results=[]
    for target in ['sensor','actuator','sensor-sim','actuator-sim']:
        args=command+['run','--project-dir',str(PROJECT),'-e',target]
        try:
            result=subprocess.run(args,cwd=ROOT,env=environment,capture_output=True,text=True,timeout=600)
            output=result.stdout+result.stderr;code=result.returncode
        except Exception as error:output=str(error);code=1
        print(output,flush=True)
        binary=PROJECT/'.pio/build'/target/'firmware.bin'
        results.append({'target':target,'compiled':code==0,'binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest() if code==0 and binary.exists() else None,'output':output[-12000:]})
    sources={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for pattern in ['src/*.cpp','include/*.h','platformio.ini'] for p in PROJECT.glob(pattern)}
    report={'checkedAt':datetime.now(timezone.utc).isoformat(),'compiler':'PlatformIO espressif32@6.10.0 / Arduino / Xtensa ESP32','sources':sources,'targets':results,'firmwareExecuted':False,'hardwareTested':False,'wokwiExecution':'External workflow; license/token not configured in this environment'}
    path=ROOT/'public/hardware/build-status.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2),encoding='utf-8')
    raise SystemExit(0 if all(r['compiled'] for r in results) else 1)
if __name__=='__main__':main()
