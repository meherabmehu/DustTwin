import { geometry } from './componentGeometry';
import type { Part, Wire } from './hardware';
export interface Point { x:number; y:number }
export interface RoutedWire { wire:Wire; points:Point[]; path:string }
const GRID=20;
// Small binary heap keeps routing bounded without sorting the frontier on every step.
class Heap {
  items:{id:number;score:number}[]=[];
  push(v:{id:number;score:number}) { const a=this.items;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=v.score)break;a[i]=a[p];i=p;}a[i]=v; }
  pop(){const a=this.items,first=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
export function compactPoints(points:Point[]) {
  return points.filter((p,i,a)=>!(i&&p.x===a[i-1].x&&p.y===a[i-1].y)).filter((p,i,a)=>!i||i===a.length-1||!((a[i-1].x===p.x&&p.x===a[i+1].x)||(a[i-1].y===p.y&&p.y===a[i+1].y)));
}
export function routeWires(parts:Part[],wires:Wire[],positions:Map<string,Point>,width:number,height:number):RoutedWire[] {
  const cols=Math.ceil(width/GRID)+1,rows=Math.ceil(height/GRID)+1,total=cols*rows;
  const blocked=new Uint8Array(total),usage=new Uint16Array(total);
  for(const part of parts){const p=positions.get(part.id)!,g=geometry(part);
    for(let y=Math.max(0,Math.floor((p.y-45)/GRID));y<=Math.min(rows-1,Math.ceil((p.y+g.height+80)/GRID));y++)
      for(let x=Math.max(0,Math.floor((p.x-30)/GRID));x<=Math.min(cols-1,Math.ceil((p.x+g.width+30)/GRID));x++)blocked[y*cols+x]=1;
  }
  function endpoint(id:string,pin:string){const part=parts.find(p=>p.id===id)!,g=geometry(part),p=positions.get(id)!,a=g.pins.get(pin);if(!a)throw Error(`Missing anchor ${id}:${pin}`);
    const point={x:p.x+a.x,y:p.y+a.y};let x=point.x,y=point.y;
    if(a.side==='left')x=Math.floor((p.x-65)/GRID)*GRID;
    if(a.side==='right')x=Math.ceil((p.x+g.width+65)/GRID)*GRID;
    if(a.side==='top')y=Math.floor((p.y-85)/GRID)*GRID;
    if(a.side==='bottom')y=Math.ceil((p.y+g.height+120)/GRID)*GRID;
    const grid={x:Math.round(x/GRID)*GRID,y:Math.round(y/GRID)*GRID};
    const elbow=a.side==='left'||a.side==='right'?{x:grid.x,y:point.y}:{x:point.x,y:grid.y};
    return {point,elbow,grid,index:grid.y/GRID*cols+grid.x/GRID};
  }
  return wires.map(wire=>{
    const a=endpoint(wire.from,wire.fromPin),b=endpoint(wire.to,wire.toPin);
    const costs=new Float64Array(total*2);costs.fill(Infinity);const previous=new Int32Array(total*2);previous.fill(-1);
    const heap=new Heap();const heuristic=(index:number)=>Math.abs(index%cols-b.index%cols)+Math.abs(Math.floor(index/cols)-Math.floor(b.index/cols));
    for(let d=0;d<2;d++){costs[a.index*2+d]=0;heap.push({id:a.index*2+d,score:heuristic(a.index)});}
    let end=-1;
    while(heap.items.length){const item=heap.pop(),cell=item.id>>1,dir=item.id&1;if(item.score>costs[item.id]+heuristic(cell)+.001)continue;if(cell===b.index){end=item.id;break;}
      const x=cell%cols,y=Math.floor(cell/cols);
      for(const [dx,dy,nextDir] of [[1,0,0],[-1,0,0],[0,1,1],[0,-1,1]]){
        const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=cols-1||ny>=rows-1)continue;const nc=ny*cols+nx;
        if(blocked[nc])continue;const ni=nc*2+nextDir,cost=costs[item.id]+1+(dir===nextDir?0:1.5)+Math.min(usage[nc],8)*.35;
        if(cost<costs[ni]){costs[ni]=cost;previous[ni]=item.id;heap.push({id:ni,score:cost+heuristic(nc)});}
      }
    }
    if(end<0)throw Error(`No obstacle-free route for ${wire.id}`);
    const middle:Point[]=[];for(let i=end;i>=0;i=previous[i]){const c=i>>1;middle.push({x:(c%cols)*GRID,y:Math.floor(c/cols)*GRID});usage[c]++;}
    middle.reverse();const points=compactPoints([a.point,a.elbow,...middle,b.elbow,b.point]);
    return {wire,points,path:points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join('')};
  });
}
// A shared bus is only collapsed when the authoritative source *pin* is identical.
export function sharedBuses(wires:Wire[]) {
  const map=new Map<string,Wire[]>();
  for(const w of wires){if(!['power','ground','data'].includes(w.type))continue;const key=`${w.from}:${w.fromPin}:${w.type}:${w.voltage}`;map.set(key,[...(map.get(key)||[]),w]);}
  return [...map].filter(([,members])=>members.length>2).map(([id,wires],index)=>({id,label:`B${index+1}`,wires,source:`${wires[0].from}:${wires[0].fromPin}`,voltage:wires[0].voltage}));
}
