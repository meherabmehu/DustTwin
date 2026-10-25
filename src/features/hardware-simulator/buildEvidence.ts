import { useEffect, useState } from 'react';
export interface BuildReport { checkedAt:string; sources:Record<string,string>; targets:Array<{target:string;compiled:boolean}>; firmwareExecuted:boolean;hardwareTested:boolean }
const sourceFiles=import.meta.glob('../../../hardware/firmware/{src/*.cpp,include/*.h,platformio.ini}',{eager:true,query:'?raw',import:'default'}) as Record<string,string>;
export async function sourceMatches(report:BuildReport){
  for(const [path,expected] of Object.entries(report.sources??{})){
    const source=sourceFiles['../../../'+path.split('\\').join('/')];if(source===undefined)return false;
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
    if([...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')!==expected)return false;
  }
  return Object.keys(report.sources??{}).length>=5;
}
export function useBuildEvidence(){
  const [evidence,setEvidence]=useState<{report:BuildReport|null;current:boolean;message:string}>({report:null,current:false,message:'Checking recorded firmware evidence…'});
  useEffect(()=>{let live=true;fetch('/hardware/build-status.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(async report=>{const current=report?await sourceMatches(report):false;if(live)setEvidence({report,current,message:!report?'Firmware build not recorded':current?'Recorded ESP32 compilation matches current sources':'Firmware sources changed: fresh build required. Recorded binaries are not the current four-SPS30 release.'});}).catch(()=>{if(live)setEvidence({report:null,current:false,message:'Build evidence unavailable'});});return()=>{live=false;};},[]);
  return evidence;
}
