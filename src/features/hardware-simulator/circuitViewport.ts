export interface Bounds { x:number;y:number;width:number;height:number }
export interface CircuitCamera { zoom:number;left:number;top:number }
export const DETAIL_MIN_ZOOM=.85;
export function fitCamera(bounds:Bounds,viewport:{width:number;height:number},mode:'overview'|'detail',wholeOverview=false):CircuitCamera {
  const padding=20;
  const fit=Math.min((viewport.width-padding)/bounds.width,(viewport.height-padding)/bounds.height,1.3);
  // Detailed assembly views prioritize 12px pin labels (>=10.2 screen pixels).
  // The default overview fits width, allowing vertical pan instead of tiny hardware.
  const zoom=mode==='detail'?Math.max(DETAIL_MIN_ZOOM,fit):wholeOverview?Math.max(.1,fit):Math.max(.72,Math.min(1.6,(viewport.width-padding)/bounds.width));
  const left=Math.max(0,bounds.width*zoom>viewport.width?bounds.x*zoom-10:(bounds.x+bounds.width/2)*zoom-viewport.width/2);
  const top=mode==='overview'&&!wholeOverview?0:Math.max(0,bounds.height*zoom>viewport.height?bounds.y*zoom-10:(bounds.y+bounds.height/2)*zoom-viewport.height/2);
  return {zoom,left,top};
}
