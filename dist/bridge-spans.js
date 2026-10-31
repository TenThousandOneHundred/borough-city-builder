// Bridge construction uses the road centreline and rendered shoreline. Plans
// are transient: saved controls, zoning ownership and simulation paths stay put.
import {streetStations,atDistance,distanceSection} from './street-geometry.js?v=171';
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
const smooth=t=>t*t*(3-2*t);
function hermite(a,b,ya,yb,ma,mb,d){const length=b-a,t=Math.max(0,Math.min(1,(d-a)/length)),t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*ya+(t3-2*t2+t)*length*ma+(-2*t3+3*t2)*yb+(t3-t2)*length*mb;}
export function bridgeElevation(span,d){
 const p=span.profile,k=(p.deck1-p.deck0)/(span.wetEnd-span.wetStart);
 if(p.left&&d<span.wetStart)return hermite(span.start,span.wetStart,span.y0,p.deck0,p.slope0,k,d);
 if(p.right&&d>span.wetEnd)return hermite(span.wetEnd,span.end,p.deck1,span.y1,k,p.slope1,d);
 return p.deck0+(Math.max(span.wetStart,Math.min(span.wetEnd,d))-span.wetStart)*k;
}
function deckBlend(span,d){
 if(span.profile.left&&d<span.wetStart)return smooth(Math.max(0,(d-span.start)/(span.wetStart-span.start)));
 if(span.profile.right&&d>span.wetEnd)return smooth(Math.max(0,(span.end-d)/(span.end-span.wetEnd)));
 return 1;
}
// Match both the natural height and tangent at dry ends, then remove terrain
// crossfall smoothly before reaching the water. Only crossing approaches are
// graded; the saved centreline and untouched dry roads remain unchanged.
function gradeSpan(chain,wetStart,wetEnd,isWater,baseHeight,groundHeight){
 const s=chain.stations,total=s.at(-1).distance,at=d=>atDistance(s,d),slope=p=>(baseHeight(p.x+p.tx*.05,p.z+p.tz*.05)-baseHeight(p.x-p.tx*.05,p.z-p.tz*.05))/.1;
 let best=null;
 for(const approach of [6,10,14,18,22,26]){
  const start=Math.max(0,wetStart-approach),end=Math.min(total,wetEnd+approach),a=at(start),b=at(end),left=wetStart>start+1e-6&&!isWater(a.x,a.z),right=wetEnd<end-1e-6&&!isWater(b.x,b.z),y0=left?baseHeight(a.x,a.z):1.9,y1=right?baseHeight(b.x,b.z):1.9,grade=(y1-y0)/(end-start);
  const span={...chain,start,end,wetStart,wetEnd,y0,y1,shoreStart:left,shoreEnd:right,profile:{left,right,slope0:left?slope(a):0,slope1:right?slope(b):0,deck0:Math.max(1.9,y0+grade*(wetStart-start)),deck1:Math.max(1.9,y1-grade*(end-wetEnd))}};
  const samples=[],distances=[start,end,...s.filter(p=>p.distance>start&&p.distance<end).map(p=>p.distance)];for(let d=start+.5;d<end;d+=.5)distances.push(d);
  let lift=0;
  for(const d of distances){const p=at(d),blend=deckBlend(span,d),center=baseHeight(p.x,p.z),edge=bridgeWidth(s,d)/2+(chain.sidewalk?.42:.2);
   const across=[];for(const u of [-edge,-edge/2,0,edge/2,edge]){const x=p.x+p.nx*u,z=p.z+p.nz*u,residual=(1-blend)*(baseHeight(x,z)-center),floor=groundHeight(x,z)+.04,y=bridgeElevation(span,d)+residual;across.push({u,residual,floor});if(blend>1e-7)lift=Math.max(lift,(floor-y)/blend);}samples.push({d,across});
  }
  // Raising both deck ends equally preserves its grade and only adds the
  // clearance actually required by the full road/footway footprint.
  span.profile.deck0+=lift;span.profile.deck1+=lift;
  // All five cross-section samples share the same two longitudinal probes.
  // Reuse their station and central height without changing sample locations,
  // arithmetic order, or the candidate/profile selection.
  const probe=d=>{const p=at(d);return {p,y:bridgeElevation(span,d),blend:1-deckBlend(span,d),center:baseHeight(p.x,p.z)};};
  const value=(sample,u)=>{const {p}=sample;return sample.y+sample.blend*(baseHeight(p.x+p.nx*u,p.z+p.nz*u)-sample.center);};
  let maxGrade=0,minClearance=Infinity;
  for(const sample of samples){const lo=Math.max(start,sample.d-.025),hi=Math.min(end,sample.d+.025),a=probe(lo),b=probe(hi),y=bridgeElevation(span,sample.d);for(const p of sample.across){if(hi>lo)maxGrade=Math.max(maxGrade,Math.abs((value(b,p.u)-value(a,p.u))/(hi-lo)));minClearance=Math.min(minClearance,y+p.residual-p.floor);}}
  span.profile.maxGrade=maxGrade;span.profile.minClearance=minClearance;span.profile.approach=approach;
  if(!best||maxGrade<best.profile.maxGrade-1e-6)best=span;
  if(maxGrade<=.12&&minClearance>=-1e-7)return span;
 }return best;
}
export function planBridges(roads,isWater,baseHeight,groundHeight=(x,z)=>baseHeight(x,z)-.1){
 const spans=[];
 for(const chain of chains(roads)){
  const s=chain.stations,total=s.at(-1).distance,step=.7,at=d=>atDistance(s,d),wet=d=>{const p=at(d);return isWater(p.x,p.z);},ranges=[];let start=wet(0)?0:null,last=0,state=start!==null;
  for(let d=Math.min(step,total);;d=Math.min(d+step,total)){const next=wet(d);if(next!==state){let a=last,b=d;for(let k=0;k<10;k++){const m=(a+b)/2;if(wet(m)===state)a=m;else b=m;}const edge=(a+b)/2;if(next)start=edge;else{ranges.push([start,edge]);start=null;}state=next;}last=d;if(d===total)break;}
  if(start!==null)ranges.push([start,total]);
  const graded=[];for(const [a,b]of ranges){if(b-a<.35)continue;let span=gradeSpan(chain,a,b,isWater,baseHeight,groundHeight);while(graded.length&&span.start<=graded.at(-1).end){const prev=graded.pop();span=gradeSpan(chain,prev.wetStart,b,isWater,baseHeight,groundHeight);}graded.push(span);}
  for(const span of graded){const {start,end}=span;
   // Keep original centreline stations for the deck. Additional samples only
   // refine long legacy straights, never replace a drawn curve with a chord.
   const section=distanceSection(s,start,end),distances=section.map(p=>p.distance);for(let i=1;i<section.length;i++){const a=section[i-1].distance,b=section[i].distance,count=Math.ceil((b-a)/.7);for(let k=1;k<count;k++)distances.push(a+(b-a)*k/count);}
   // Authored and supplemental samples can differ only by floating-point
   // roundoff (2.8 versus 2.799999999999997). Exact Set deduplication produced
   // zero-length segments, corrupting the nearest bridge-height lookup.
   const unique=[start];for(const d of distances.sort((a,b)=>a-b))if(d>unique.at(-1)+1e-6&&d<end-1e-6)unique.push(d);unique.push(end);
   span.points=unique.map(d=>({...at(d),width:bridgeWidth(s,d),y:bridgeElevation(span,d)}));spans.push(span);
  }
 }
 // Tiny spatial bins keep road/vehicle height queries local to a crossing.
 const bins=new Map();for(const span of spans)for(let i=1;i<span.points.length;i++){const a=span.points[i-1],b=span.points[i],lengthSquared=(b.x-a.x)**2+(b.z-a.z)**2;if(!(lengthSquared>1e-12)||!Number.isFinite(lengthSquared))continue;const margin=Math.max(a.width,b.width)/2+(span.sidewalk?.52:.3),segment={a,b,margin,span};for(let x=Math.floor((Math.min(a.x,b.x)-margin)/4);x<=Math.floor((Math.max(a.x,b.x)+margin)/4);x++)for(let z=Math.floor((Math.min(a.z,b.z)-margin)/4);z<=Math.floor((Math.max(a.z,b.z)+margin)/4);z++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(segment);}}
 for(const [key,segments]of bins){const groups=new Map();for(const segment of segments){if(!groups.has(segment.span))groups.set(segment.span,[]);groups.get(segment.span).push(segment);}bins.set(key,[...groups].map(([span,segments])=>({span,segments})));}
 return {spans,bins,baseHeight};
}
export function bridgeHeight(plan,x,z){
 let result=null,nearest=Infinity;
 for(const {span,segments}of plan?.bins.get(Math.floor(x/4)+','+Math.floor(z/4))||[]){
  let best=null,distance=Infinity;
  for(const {a,b,margin}of segments){const dx=b.x-a.x,dz=b.z-a.z,lengthSquared=dx*dx+dz*dz;if(!(lengthSquared>1e-12)||!Number.isFinite(lengthSquared))continue;const t=((x-a.x)*dx+(z-a.z)*dz)/lengthSquared;if(!Number.isFinite(t))continue;const u=Math.max(0,Math.min(1,t)),d=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;if(d>margin*margin||d>=distance)continue;distance=d;best={a,b,t,u};}
  if(!best)continue;const {a,b,t,u}=best;
  // Reject the crossing as a whole beyond its end plane. Rejecting only the
  // first segment would allow a later segment's search radius to leak the
  // elevated road height onto the dry approach and create a step.
  if(a.distance===span.start&&t<0&&(x-a.x)*a.tx+(z-a.z)*a.tz< -1e-5)continue;
  if(b.distance===span.end&&t>1&&(x-b.x)*b.tx+(z-b.z)*b.tz>1e-5)continue;
  const d=a.distance+(b.distance-a.distance)*u,blend=deckBlend(span,d),y=bridgeElevation(span,d)+(blend<1?(1-blend)*(plan.baseHeight(x,z)-plan.baseHeight(a.x+(b.x-a.x)*u,a.z+(b.z-a.z)*u)):0);
  if(distance<nearest-1e-8){nearest=distance;result=y;}else if(Math.abs(distance-nearest)<=1e-8)result=result===null?y:Math.max(result,y);
 }
 return result;
}
