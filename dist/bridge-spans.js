// Bridge construction uses the road centreline and rendered shoreline. Plans
// are transient: saved controls, zoning ownership and simulation paths stay put.
import {streetStations,atDistance,distanceSection} from './street-geometry.js?v=112';
const widthOf=(r,p)=>r.widthAt?r.widthAt(p):r.spec.width;
const key=p=>`${Math.round(p.x*1000)},${Math.round(p.z*1000)}`;

// Join compatible end-to-end roads so a bridge does not gain a hump or pier at
// every legacy grid cell, or where a player extended a street in another drag.
function chains(roads){
 const ends=new Map(),used=new Set(),result=[];
 for(const r of roads)if(r.stations.length>1)for(const end of [0,1]){const p=end?r.stations.at(-1):r.stations[0],k=key(p);if(!ends.has(k))ends.set(k,[]);ends.get(k).push({r,end});}
 for(const source of roads){if(used.has(source)||source.stations.length<2)continue;used.add(source);let list=[{r:source,reverse:false}];
  for(const direction of [-1,1])for(;;){const part=direction<0?list[0]:list.at(-1),end=direction<0?Number(part.reverse):Number(!part.reverse),p=end?part.r.stations.at(-1):part.r.stations[0],near=ends.get(key(p));if(near?.length!==2)break;const next=near.find(e=>e.r!==part.r);if(!next||used.has(next.r)||!!next.r.spec.sidewalk!==!!source.spec.sidewalk)break;
   const q=next.end?next.r.stations.at(-1):next.r.stations[0],sign=(end?1:-1)*(next.end?1:-1);if(sign*(p.tx*q.tx+p.tz*q.tz)>-.95||Math.abs(widthOf(part.r,p)-widthOf(next.r,q))>.01)break;
   used.add(next.r);const item={r:next.r,reverse:direction<0?!next.end:!!next.end};if(direction<0)list.unshift(item);else list.push(item);
  }
  const points=[],widths=[];for(const {r,reverse}of list){const source=r.legacy?r.stations.flatMap((p,i)=>{if(!i)return [p];const a=r.stations[i-1],out=[];for(let d=a.distance+1;d<p.distance-.001;d+=1)out.push(atDistance(r.stations,d));out.push(p);return out;}):r.stations,samples=reverse?[...source].reverse():source;for(const p of samples){if(points.length&&Math.hypot(p.x-points.at(-1).x,p.z-points.at(-1).z)<1e-6)continue;points.push({x:p.x,z:p.z});widths.push(widthOf(r,p));}}
  const stations=streetStations(points);stations.forEach((p,i)=>p.width=widths[i]);result.push({stations,sidewalk:!!source.spec.sidewalk,roads:list.map(p=>p.r.id)});
 }return result;
}
export function bridgeWidth(stations,d){let lo=0,hi=stations.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(stations[m].distance<d)lo=m;else hi=m;}const a=stations[lo],b=stations[hi],t=Math.max(0,Math.min(1,(d-a.distance)/(b.distance-a.distance)));return a.width+(b.width-a.width)*t;}
export function bridgeElevation(span,d){const t=Math.max(0,Math.min(1,(d-span.start)/(span.end-span.start)));return span.y0+(span.y1-span.y0)*t+4*t*(1-t)*span.rise;}
export function planBridges(roads,isWater,baseHeight){
 const spans=[];
 for(const chain of chains(roads)){
  const s=chain.stations,total=s.at(-1).distance,step=.7,at=d=>atDistance(s,d),wet=d=>{const p=at(d);return isWater(p.x,p.z);},ranges=[];let start=wet(0)?0:null,last=0,state=start!==null;
  for(let d=Math.min(step,total);;d=Math.min(d+step,total)){const next=wet(d);if(next!==state){let a=last,b=d;for(let k=0;k<10;k++){const m=(a+b)/2;if(wet(m)===state)a=m;else b=m;}const edge=(a+b)/2;if(next)start=edge;else{ranges.push([start,edge]);start=null;}state=next;}last=d;if(d===total)break;}
  if(start!==null)ranges.push([start,total]);
  const extended=[];for(const [a,b]of ranges){if(b-a<.35)continue;const interval=[Math.max(0,a-2.5),Math.min(total,b+2.5)],prev=extended.at(-1);if(prev&&interval[0]<=prev[1])prev[1]=interval[1];else extended.push(interval);}
  for(const [start,end]of extended){const a=at(start),b=at(end),y0=baseHeight(a.x,a.z),y1=baseHeight(b.x,b.z),span={...chain,start,end,y0,y1,rise:Math.max(0,1.9-(y0+y1)/2),shoreStart:start>.001,shoreEnd:end<total-.001};
   // Keep original centreline stations for the deck. Additional samples only
   // refine long legacy straights, never replace a drawn curve with a chord.
   const section=distanceSection(s,start,end),distances=new Set(section.map(p=>p.distance));for(let d=start+.7;d<end;d+=.7)distances.add(d);
   span.points=[...distances].sort((a,b)=>a-b).map(d=>({...at(d),width:bridgeWidth(s,d),y:bridgeElevation(span,d)}));spans.push(span);
  }
 }
 // Tiny spatial bins keep road/vehicle height queries local to a crossing.
 const bins=new Map();for(const span of spans)for(let i=1;i<span.points.length;i++){const a=span.points[i-1],b=span.points[i],margin=Math.max(a.width,b.width)/2+(span.sidewalk?.52:.3),segment={a,b,margin,span};for(let x=Math.floor((Math.min(a.x,b.x)-margin)/4);x<=Math.floor((Math.max(a.x,b.x)+margin)/4);x++)for(let z=Math.floor((Math.min(a.z,b.z)-margin)/4);z<=Math.floor((Math.max(a.z,b.z)+margin)/4);z++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(segment);}}
 for(const [key,segments]of bins){const groups=new Map();for(const segment of segments){if(!groups.has(segment.span))groups.set(segment.span,[]);groups.get(segment.span).push(segment);}bins.set(key,[...groups].map(([span,segments])=>({span,segments})));}
 return {spans,bins};
}
export function bridgeHeight(plan,x,z){
 let result=null,nearest=Infinity;
 for(const {span,segments}of plan?.bins.get(Math.floor(x/4)+','+Math.floor(z/4))||[]){
  let best=null,distance=Infinity;
  for(const {a,b,margin}of segments){const dx=b.x-a.x,dz=b.z-a.z,t=((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),u=Math.max(0,Math.min(1,t)),d=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;if(d>margin*margin||d>=distance)continue;distance=d;best={a,b,t,u};}
  if(!best)continue;const {a,b,t,u}=best;
  // Reject the crossing as a whole beyond its end plane. Rejecting only the
  // first segment would allow a later segment's search radius to leak the
  // elevated road height onto the dry approach and create a step.
  if(a.distance===span.start&&t<0&&(x-a.x)*a.tx+(z-a.z)*a.tz< -1e-5)continue;
  if(b.distance===span.end&&t>1&&(x-b.x)*b.tx+(z-b.z)*b.tz>1e-5)continue;
  const y=bridgeElevation(span,a.distance+(b.distance-a.distance)*u);
  if(distance<nearest-1e-8){nearest=distance;result=y;}else if(Math.abs(distance-nearest)<=1e-8)result=result===null?y:Math.max(result,y);
 }
 return result;
}
