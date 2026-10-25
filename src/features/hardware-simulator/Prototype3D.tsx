import { useEffect, useRef, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { HardwareState } from './engine';

type Vec = [number,number,number];
const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(v:Vec):Vec=>{const d=Math.hypot(...v)||1;return [v[0]/d,v[1]/d,v[2]/d];};
function multiply(a:Float32Array,b:Float32Array){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
function cameraMatrix(yaw:number,pitch:number,distance:number,aspect:number){
  const eye:Vec=[Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance], target:Vec=[0,.6,0];
  const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x),dot=(a:Vec,b:Vec)=>a.reduce((v,n,i)=>v+n*b[i],0);
  const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  const f=1/Math.tan(Math.PI/7),near=.1,far=100;
  return multiply(new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view);
}
function scene(s:HardwareState,time:number){
  const data:number[]=[],light=norm([.5,.9,.4]);
  const tri=(a:Vec,b:Vec,c:Vec,color:Vec)=>{const n=norm(cross(sub(b,a),sub(c,a))),shade=.38+.62*Math.max(0,n.reduce((v,x,i)=>v+x*light[i],0));for(const p of [a,b,c])data.push(...p,color[0]*shade,color[1]*shade,color[2]*shade);};
  const quad=(a:Vec,b:Vec,c:Vec,d:Vec,color:Vec)=>{tri(a,b,c,color);tri(a,c,d,color);};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:Vec)=>{
    const v:Vec[]=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];
    for(const [a,b,c,e] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(v[a],v[b],v[c],v[e],color);
  };
  const tube=(a:Vec,b:Vec,r:number,color:Vec,r2=r)=>{
    const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u);
    const point=(p:Vec,angle:number,radius:number):Vec=>[p[0]+radius*(Math.cos(angle)*u[0]+Math.sin(angle)*v[0]),p[1]+radius*(Math.cos(angle)*u[1]+Math.sin(angle)*v[1]),p[2]+radius*(Math.cos(angle)*u[2]+Math.sin(angle)*v[2])];
    for(let i=0;i<16;i++){const t=i*Math.PI/8,tt=(i+1)*Math.PI/8,aa=point(a,t,r),ab=point(a,tt,r),ba=point(b,t,r2),bb=point(b,tt,r2);quad(aa,ab,bb,ba,color);tri(a,ab,aa,color);tri(b,ba,bb,color);}
  };
  const metal:Vec=[.66,.74,.75],black:Vec=[.13,.2,.23],blue:Vec=[.04,.42,.76],green:Vec=[.12,.65,.35],orange:Vec=[.95,.5,.08],white:Vec=[.85,.91,.87];
  box(0,-.2,0,9,.2,6,[.6,.43,.25]);box(0,0,0,8.8,.04,5.8,[.25,.3,.18]);box(0,.05,0,.35,.015,5.5,[.64,.58,.43]);box(0,.05,0,7.5,.015,.3,[.64,.58,.43]);
  const zones:Vec[]=[[-1.6,.08,-.75],[1.2,.08,-.75],[1.2,.08,1.2],[-1.6,.08,1.2]];
  zones.forEach(([x,y,z],i)=>{
    box(x,y,z,1.9,.07,1.45,[.47,.42,.25]);
    for(let j=0;j<3;j++){const bx=x-.55+j*.55,bz=z+(j%2?-.3:.25);box(bx,y+.07,bz,.4,.3+j*.17,.36,[.67,.54,.39]);box(bx,y+.38+j*.17,bz,.43,.06,.39,[.42,.4,.35]);}
    box(x+.8,.18,z, .27,.31,.25,metal);box(x+.8,.2,z+.135,.2,.22,.025,green);
    tube([x,.2,z],[x,1.05,z],.10,metal);tube([x,1.05,z],[x,1.05,-2],.1,metal);
    box(x,1.06,-1.65,.36,.26,.26,orange);
    const open=s.position[i],bladeX=.17*Math.cos(open*Math.PI/2),bladeZ=.17*Math.sin(open*Math.PI/2);
    tube([x-bladeX,1.1,-1.65-bladeZ],[x+bladeX,1.1,-1.65+bladeZ],.035,s.airflow[i]>0?green:metal);
    tube([x,1.05,-2],[x,1.05,-2.18],.11,metal);
    // Blue supply and independent valve/nozzle assemblies at each plot.
    tube([x,.28,2.55],[x,.28,z+.6],.035,blue);box(x,.26,z+.6,.19,.15,.16,s.valves[i]?green:blue);tube([x,.36,z+.6],[x,.65,z+.6],.028,metal);
    if(s.pump&&s.valves[i])for(let j=0;j<9;j++){const t=(time*.4+j/9)%1,angle=j*2.399;const p:Vec=[x+Math.cos(angle)*t*.45,.65-t*.5,z+.6+Math.sin(angle)*t*.45];tube(p,[p[0],p[1]-.045,p[2]],.008,[.3,.8,1]);}
    if(s.airflow[i]>0)for(let j=0;j<4;j++){const t=(time*.5+j/4)%1;tube([x,1.065,z+(-2-z)*t],[x,1.065,z+(-2-z)*(t+.025)],.018,[.1,.95,.8]);}
  });
  tube([-3.1,1.05,-2],[3.1,1.05,-2],.14,metal);
  // Suction motor, cyclone, HEPA and physically separate collection jar.
  tube([-3.3,.25,-2],[-3.3,1.3,-2],.29,black);box(-3.3,.15,-2,.7,.13,.7,metal);tube([-3.3,1.05,-2],[-2.9,1.05,-2],.15,black);
  tube([3.15,.75,-2],[3.15,1.65,-2],.38,metal);tube([3.15,.25,-2],[3.15,.75,-2],.11,metal,.38);
  tube([3.15,.06,-2],[3.15,.45,-2],.35,[.43,.57,.58]);tube([3.15,.08,-2],[3.15,.08+Math.min(.3,s.binG*.01),-2],.31,[.62,.44,.26]);
  box(3.25,.1,-.65,.63,1.35,.4,white);for(let i=0;i<10;i++)box(2.98+i*.059,.15,-.41,.014,1.22,.025,[.43,.54,.55]);tube([3.1,1.1,-2],[3.1,1.1,-.65],.1,metal);
  // Water supply and pump are independent of the extraction motor.
  box(-3.35,.08,1.15,.95,1.32,.8,white);box(-3.35,1.4,1.15,.35,.12,.35,blue);tube([-3.35,.22,.7],[-3.35,.22,.15],.035,blue);tube([-3.35,.22,.15],[-3.35,.22,-.25],.17,black);tube([-3.35,.22,.15],[-3.35,.22,2.55],.04,blue);tube([-3.35,.22,2.55],[2,.22,2.55],.04,blue);
  // Controller enclosure with a Pi board, two ESP32 boards and visible header rows.
  box(0,.1,-2.7,1.9,.2,.45,[.18,.28,.31]);box(-.5,.31,-2.7,.65,.04,.38,[.05,.4,.25]);box(.25,.31,-2.7,.25,.04,.38,black);box(.7,.31,-2.7,.25,.04,.38,black);
  for(let i=0;i<10;i++)for(const x of [-.5,.25,.7])box(x-.1+i*.02,.36,-2.85,.013,.025,.02,[.85,.7,.2]);
  // Wind mast, cup anemometer, vane and separate demonstration fan.
  tube([-2.6,.1,-.5],[-2.6,1.65,-.5],.025,metal);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+time*s.inputs.windSpeed*.2,x=-2.6+Math.cos(a)*.24,z=-.5+Math.sin(a)*.24;tube([-2.6,1.65,-.5],[x,1.65,z],.012,metal);tube([x,1.62,z],[x,1.69,z],.075,black);}
  const angle=s.inputs.windDirection*Math.PI/180;tube([-2.6,1.35,-.5],[-2.6+Math.sin(angle)*.3,1.35,-.5-Math.cos(angle)*.3],.025,white);
  box(-4,.12,-.4,.13,.55,.55,black);for(let i=0;i<4;i++){const a=i*Math.PI/2+(s.fan?time*6:0);tube([-3.92,.4,-.4],[-3.92,.4+Math.sin(a)*.21,-.4+Math.cos(a)*.21],.04,metal);}
  return new Float32Array(data);
}

export default function Prototype3D({ state }: { state:HardwareState }) {
  const canvas=useRef<HTMLCanvasElement>(null),live=useRef(state),camera=useRef({yaw:-.55,pitch:.65,distance:9}),drag=useRef<{x:number;y:number}|null>(null);
  const [mode,setMode]=useState('Isometric'),[error,setError]=useState('');live.current=state;
  useEffect(()=>{
    const el=canvas.current!,gl=el.getContext('webgl',{antialias:true,alpha:false});if(!gl){setError('WebGL is unavailable. Circuit and numeric simulation remain active.');return;}
    function shader(type:number,source:string){const s=gl!.createShader(type)!;gl!.shaderSource(s,source);gl!.compileShader(s);if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS))throw new Error(gl!.getShaderInfoLog(s)??'Shader error');return s;}
    let program:WebGLProgram,buffer:WebGLBuffer,vs:WebGLShader,fs:WebGLShader;
    try{vs=shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 color;uniform mat4 camera;varying vec3 c;void main(){c=color;gl_Position=camera*vec4(position,1.0);}');fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 c;void main(){gl_FragColor=vec4(c,1.0);}');program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('3D shader linking failed');buffer=gl.createBuffer()!;}catch(e){setError(e instanceof Error?e.message:String(e));return;}
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const p=gl.getAttribLocation(program,'position'),c=gl.getAttribLocation(program,'color'),matrix=gl.getUniformLocation(program,'camera');gl.enableVertexAttribArray(p);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(c,3,gl.FLOAT,false,24,12);gl.enable(gl.DEPTH_TEST);gl.clearColor(.018,.07,.105,1);
    let raf=0,last=0;
    const draw=(now:number)=>{raf=requestAnimationFrame(draw);if(now-last<50)return;last=now;const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(el.clientWidth*dpr),h=Math.round(el.clientHeight*dpr);if(el.width!==w||el.height!==h){el.width=w;el.height=h;}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const view=camera.current;gl.uniformMatrix4fv(matrix,false,cameraMatrix(view.yaw,view.pitch,view.distance,w/Math.max(1,h)));const vertices=scene(live.current,live.current.running?now/1000:live.current.second);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);};
    raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  },[]);
  function view(name:string){setMode(name);camera.current={...camera.current,yaw:name==='Side'?0:-.55,pitch:name==='Top'?1.52:name==='Side'?.08:.65};}
  return <section className="hw-panel hw-prototype3d"><div className="hw-mini-title"><strong>3D Physical View</strong><small>Live WebGL geometry · modeled tabletop</small></div><div className="hw-3d-tools">{['Top','Side','Isometric'].map(v=><button className={mode===v?'selected':''} key={v} onClick={()=>view(v)}>{v} View</button>)}<button aria-label="Zoom 3D in" onClick={()=>{camera.current.distance=Math.max(7,camera.current.distance-1);}}><ZoomIn size={13}/></button><button aria-label="Zoom 3D out" onClick={()=>{camera.current.distance=Math.min(25,camera.current.distance+1);}}><ZoomOut size={13}/></button><button aria-label="Rotate 3D" onClick={()=>{camera.current.yaw+=Math.PI/8;setMode('Custom');}}><RotateCw size={13}/></button></div>{error?<p role="status">{error}</p>:<canvas ref={canvas} aria-label="Interactive 3D DustTwin tabletop prototype" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current){camera.current.yaw+=(e.clientX-drag.current.x)*.009;camera.current.pitch=Math.max(.05,Math.min(1.53,camera.current.pitch+(e.clientY-drag.current.y)*.006));drag.current={x:e.clientX,y:e.clientY};setMode('Custom');}}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onWheel={e=>{camera.current.distance=Math.max(7,Math.min(25,camera.current.distance+Math.sign(e.deltaY)*.5));}}/>}<div className="hw-3d-zones">{['A · North','B · East','C · South','D · West'].map((z,i)=><span key={z} className={state.airflow[i]||state.pump&&state.valves[i]?'active':''}>{z}</span>)}</div><p className="hw-hint">Drag to orbit · actual mesh camera controls · tabletop geometry is illustrative, not a fabrication drawing</p></section>;
}
