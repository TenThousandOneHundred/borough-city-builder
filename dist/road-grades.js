import {atDistance} from './street-geometry.js?v=151.1';
import {junctionCorners,junctionCuts,transitionWidth} from './road-junction-plan.js?v=151.1';
import {bridgeHeight,bridgeWidth} from './bridge-spans.js?v=151.1';

const CELL=4,EPS=1e-6,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
const key=p=>Math.round(p.x*1000)+','+Math.round(p.z*1000);
function hermite(a,b,d){const length=b.d-a.d,t=clamp((d-a.d)/length,0,1),t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*a.y+(t3-2*t2+t)*length*a.slope+(-2*t3+3*t2)*b.y+(t3-t2)*length*b.slope;}
function project(stations,x,z){let best=null,distance=Infinity;for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i],dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz;if(n<EPS*EPS)continue;const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/n,0,1),q=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;if(q<distance){distance=q;best={d:a.distance+(b.distance-a.distance)*t,distance:q};}}return best;}
function inOutline(outline,x,z,padding=.5){let inside=false;for(let i=0,k=outline.length-1;i<outline.length;k=i++){
 const a=outline[i],b=outline[k];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 const dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz,t=n?clamp(((x-a.x)*dx+(z-a.z)*dz)/n,0,1):0;if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<=padding*padding)return true;
 }return inside;}

// This plan owns rendered elevations only. It never changes saved controls,
// station distances, road widths, lane paths, or the natural terrain sampler.
export function planRoadGrades(roadGeometry,bridgePlan,naturalDatum){
 const roads=new Map(),junctions=new Map(),bins=new Map(),oversized=[],ends=new Map();
 const stats={roads:0,junctions:0,preservedJunctions:0,profileKnots:0,addedStations:0,segments:0,indexReferences:0,lastCandidateCount:0};
 const bounds={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
 const oldDatum=bridgePlan?.baseHeight||naturalDatum,legacy=(x,z)=>bridgeHeight(bridgePlan,x,z)??oldDatum(x,z);
 for(const road of roadGeometry.roads)if(road.stations.length>1)for(const p of [road.stations[0],road.stations.at(-1)]){const k=key(p);ends.set(k,(ends.get(k)||0)+1);}
 const gradient=(height,x,z,step=.05)=>({x:(height(x+step,z)-height(x-step,z))/(step*2),z:(height(x,z+step)-height(x,z-step))/(step*2)});
 function index(item,x0,z0,x1,z1){
  bounds.minX=Math.min(bounds.minX,x0);bounds.minZ=Math.min(bounds.minZ,z0);bounds.maxX=Math.max(bounds.maxX,x1);bounds.maxZ=Math.max(bounds.maxZ,z1);
  const a=Math.floor(x0/CELL),b=Math.floor(x1/CELL),c=Math.floor(z0/CELL),d=Math.floor(z1/CELL);
  if((b-a+1)*(d-c+1)>4096){oversized.push(item);return;}
  for(let x=a;x<=b;x++){let row=bins.get(x);if(!row){row=new Map();bins.set(x,row);}for(let z=c;z<=d;z++){let bucket=row.get(z);if(!bucket){bucket=[];row.set(z,bucket);}bucket.push(item);stats.indexReferences++;}}
 }
 for(const j of roadGeometry.junctions){
  const outline=junctionCorners(j).flatMap(c=>c.points),radius=Math.max(Math.hypot(j.radius,Math.max(...j.arms.map(a=>a.width/2))+.5),...outline.map(p=>Math.hypot(p.x-j.x,p.z-j.z)+.5))+.01;
  const preserve=bridgeHeight(bridgePlan,j.x,j.z)!==null||outline.some(p=>bridgeHeight(bridgePlan,p.x,p.z)!==null)||(bridgePlan?.spans||[]).some(span=>span.points.some(p=>Math.hypot(p.x-j.x,p.z-j.z)<radius+p.width/2));
  let gx=(naturalDatum(j.x+2,j.z)-naturalDatum(j.x-2,j.z))/4,gz=(naturalDatum(j.x,j.z+2)-naturalDatum(j.x,j.z-2))/4;
  const magnitude=Math.hypot(gx,gz);if(magnitude>.04){gx*=.04/magnitude;gz*=.04/magnitude;}
  const y=naturalDatum(j.x,j.z),height=preserve?legacy:(x,z)=>y+gx*(x-j.x)+gz*(z-j.z),record={source:j,x:j.x,z:j.z,radius,outline,y,gx,gz,preserveBridge:preserve,height};
  junctions.set(j,record);stats.junctions++;
  index({junction:record},j.x-radius-.5,j.z-radius-.5,j.x+radius+.5,j.z+radius+.5);
 }
 // Adjacent junctions cannot choose unrelated planes at their shared edge.
 // Blend their local corrections with C1 finite-support weights instead of
 // fitting one city-wide plane to a connected grid of close intersections.
 const parents=new Map([...junctions.values()].map(j=>[j,j]));
 const root=j=>{let p=j;while(parents.get(p)!==p)p=parents.get(p);while(j!==p){const next=parents.get(j);parents.set(j,p);j=next;}return p;};
 for(const row of bins.values())for(const bucket of row.values())for(let i=0;i<bucket.length;i++)for(let k=0;k<i;k++){
  const a=bucket[i].junction,b=bucket[k].junction;if((a.x-b.x)**2+(a.z-b.z)**2<(a.radius+b.radius)**2)parents.set(root(a),root(b));
 }
 const preserved=new Set([...junctions.values()].filter(j=>j.preserveBridge).map(root));
 for(const j of junctions.values())j.preserveBridge=preserved.has(root(j));
 const junctionField=(x,z)=>{
  const natural=naturalDatum(x,z),bucket=bins.get(Math.floor(x/CELL))?.get(Math.floor(z/CELL));let total=0,correction=0,naturalWeight=1;
  for(const item of bucket||[]){const j=item.junction;if(!j||j.preserveBridge)continue;const q=((x-j.x)**2+(z-j.z)**2)/(j.radius*j.radius);if(q>=1)continue;
   const t=1-q,weight=t*t*t*(t*(t*6-15)+10),plane=j.y+j.gx*(x-j.x)+j.gz*(z-j.z);total+=weight;correction+=weight*(plane-natural);naturalWeight*=1-weight;
  }
  return total?natural+correction/(total+naturalWeight):natural;
 };
 for(const j of junctions.values()){j.height=j.preserveBridge?legacy:junctionField;if(j.preserveBridge)stats.preservedJunctions++;}
 const nearbyJunctions=stations=>{
  const found=new Set(),visited=new Set();
  for(let i=1;i<stations.length;i++){
   const a=stations[i-1],b=stations[i],x0=Math.floor(Math.min(a.x,b.x)/CELL),x1=Math.floor(Math.max(a.x,b.x)/CELL),z0=Math.floor(Math.min(a.z,b.z)/CELL),z1=Math.floor(Math.max(a.z,b.z)/CELL);
   if((x1-x0+1)*(z1-z0+1)>4096)return junctions.values();
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const bucket=bins.get(x)?.get(z);if(!bucket||visited.has(bucket))continue;visited.add(bucket);for(const item of bucket)if(item.junction)found.add(item.junction);}
  }
  return found;
 };
 for(const source of roadGeometry.roads){
  const original=source.stations;if(original.length<2)continue;const total=original.at(-1).distance;if(total<EPS)continue;
  const widthAt=d=>source.widthAt?source.widthAt(atDistance(original,d)):transitionWidth(source,roadGeometry.tapers?.get(source.id)||[],d),sidewalk=source.spec.sidewalk?(source.legacy?.42:.38):.175;
  const record={id:source.id,source,length:total,widthAt,sidewalk,zones:[],knots:[],stations:null,sections:[]};roads.set(source.id,record);stats.roads++;
  // A bridge chain may traverse a descriptor in reverse. Project its endpoints
  // onto the unchanged chain to map the exact bridge boundaries back to it.
  for(const span of bridgePlan?.spans||[])if(span.roads.includes(source.id)){
   const p=original[0],q=original.at(-1),a=project(span.stations,p.x,p.z),b=project(span.stations,q.x,q.z);if(!a||!b)continue;
   const sign=b.d>=a.d?1:-1,lo=Math.min((span.start-a.d)*sign,(span.end-a.d)*sign),hi=Math.max((span.start-a.d)*sign,(span.end-a.d)*sign);
   const start=clamp(lo,0,total),end=clamp(hi,0,total);if(end-start>EPS)record.zones.push({start,end,mode:'bridge',bridgeSpan:span,height:legacy,cross:oldDatum});
  }
  // A legacy arm is only half a grid tile long. Its influence also reaches the
  // next descriptor, which must use this same field and blend at its boundary.
  for(const j of nearbyJunctions(original))for(const [start,end]of junctionCuts(original,[{...j.source,radius:j.radius}]))record.zones.push({start,end,mode:j.preserveBridge?'bridge-junction':'junction',junction:j,height:j.height,cross:j.preserveBridge?oldDatum:j.height});
  // Shared junctions take precedence only outside the preserved bridge region.
  const boundaries=[0,total,...record.zones.flatMap(z=>[z.start,z.end])].sort((a,b)=>a-b),unique=boundaries.filter((d,i)=>!i||d-boundaries[i-1]>EPS);
  const zoneAt=d=>record.zones.find(z=>z.mode==='bridge'&&d>=z.start-EPS&&d<=z.end+EPS)||record.zones.find(z=>d>=z.start-EPS&&d<=z.end+EPS);
  const endpoint=(d,zone)=>{
   const p=atDistance(original,d),height=zone?.height||naturalDatum,cross=zone?.cross||(ends.get(key(p))===1?naturalDatum:null),g=gradient(height,p.x,p.z,zone?.mode==='junction'?.0001:.05);
   // At bridge ends the old natural field has exactly the bridge's dry-end
   // derivative, including its lateral crossfall. Outside-domain bridge
   // queries deliberately return null, so differentiate that natural field.
   const tangent=zone?.mode==='bridge'||zone?.mode==='bridge-junction'?gradient(oldDatum,p.x,p.z):g;
   return {d,y:height(p.x,p.z),slope:tangent.x*p.tx+tangent.z*p.tz,cross};
  };
  const smoothed=d=>{let sum=0,weight=0;for(const [offset,w]of [[-4,1],[-2,2],[0,3],[2,2],[4,1]]){const p=atDistance(original,clamp(d+offset,0,total));sum+=naturalDatum(p.x,p.z)*w;weight+=w;}return sum/weight;};
  for(let i=1;i<unique.length;i++){
   const start=unique[i-1],end=unique[i];if(end-start<EPS)continue;const zone=zoneAt((start+end)/2);
   if(zone){record.sections.push({start,end,zone});continue;}
   const before=record.zones.filter(z=>Math.abs(z.end-start)<EPS*2).sort((a,b)=>(b.mode==='bridge')-(a.mode==='bridge'))[0],after=record.zones.filter(z=>Math.abs(z.start-end)<EPS*2).sort((a,b)=>(b.mode==='bridge')-(a.mode==='bridge'))[0];
   const a=endpoint(start,before),b=endpoint(end,after),nodes=[a];
   for(let d=start+6;d<end-4;d+=6)nodes.push({d,y:smoothed(d),slope:0,cross:null});nodes.push(b);
   // Limit avoidable local humps while retaining the exact hard endpoint
   // heights. A short constrained segment may necessarily remain steeper.
   const limit=Math.max(.12,Math.abs(b.y-a.y)/(end-start));
   for(let pass=0;pass<2;pass++){for(let k=1;k<nodes.length-1;k++){const p=nodes[k-1],q=nodes[k];q.y=clamp(q.y,p.y-limit*(q.d-p.d),p.y+limit*(q.d-p.d));}for(let k=nodes.length-2;k>0;k--){const p=nodes[k+1],q=nodes[k];q.y=clamp(q.y,p.y-limit*(p.d-q.d),p.y+limit*(p.d-q.d));}}
   for(let k=1;k<nodes.length-1;k++){const p=nodes[k-1],q=nodes[k],r=nodes[k+1],left=(q.y-p.y)/(q.d-p.d),right=(r.y-q.y)/(r.d-q.d);q.slope=left*right<=0?0:clamp((r.y-p.y)/(r.d-p.d),-Math.min(limit,3*Math.abs(left),3*Math.abs(right)),Math.min(limit,3*Math.abs(left),3*Math.abs(right)));}
   record.knots.push(...nodes);stats.profileKnots+=nodes.length;record.sections.push({start,end,nodes});
  }
  function sample(d,u=0,worldX,worldZ){if(d< -EPS||d>total+EPS)return null;d=clamp(d,0,total);const p=atDistance(original,d),x=worldX??p.x+p.nx*u,z=worldZ??p.z+p.nz*u,zone=zoneAt(d);if(zone)return zone.height(x,z);
   const section=record.sections.find(s=>!s.zone&&d>=s.start-EPS&&d<=s.end+EPS);if(!section)return naturalDatum(x,z);
   const nodes=section.nodes;let lo=0,hi=nodes.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(nodes[m].d<d)lo=m;else hi=m;}const a=nodes[lo],b=nodes[hi],t=clamp((d-a.d)/(b.d-a.d),0,1),blend=smooth(t);
   const residual=height=>height?height(x,z)-height(p.x,p.z):0;return hermite(a,b,d)+(1-blend)*residual(a.cross)+blend*residual(b.cross);
  }
  record.sample=sample;
  const additions=[...unique,...record.knots.map(n=>n.d)],all=[...original,...additions.filter(d=>d>EPS&&d<total-EPS&&!original.some(p=>Math.abs(p.distance-d)<EPS)).map(d=>atDistance(original,d))].sort((a,b)=>a.distance-b.distance);
  record.stations=all.filter((p,i)=>!i||p.distance-all[i-1].distance>EPS);stats.addedStations+=record.stations.length-original.length;
  for(let i=1;i<record.stations.length;i++){const a=record.stations[i-1],b=record.stations[i],margin=Math.max(widthAt(a.distance),widthAt(b.distance))/2+Math.max(sidewalk,source.spec.sidewalk?.42:sidewalk)+.03,item={road:record,a,b,margin};stats.segments++;index(item,Math.min(a.x,b.x)-margin,Math.min(a.z,b.z)-margin,Math.max(a.x,b.x)+margin,Math.max(a.z,b.z)+margin);}
 }
 function group(items){const grouped=[],lookup=new Map();for(const item of items){if(item.junction){grouped.push(item);continue;}let entry=lookup.get(item.road);if(!entry){entry={road:item.road,segments:[]};lookup.set(item.road,entry);grouped.push(entry);}entry.segments.push(item);}return grouped;}
 for(const row of bins.values())for(const [z,bucket]of row)row.set(z,group(bucket));
 function corridorAt(x,z,raw=false){
  stats.lastCandidateCount=0;if(!Number.isFinite(x)||!Number.isFinite(z))return null;const bucket=bins.get(Math.floor(x/CELL))?.get(Math.floor(z/CELL));let best=null,nearest=Infinity,junction=null;
  const entries=oversized.length?group([...(bucket||[]).flatMap(item=>item.junction?[item]:item.segments),...oversized]):bucket;
  for(const item of entries||[]){
   if(item.junction){const j=item.junction;if(Math.hypot(x-j.x,z-j.z)<=j.radius+.5&&inOutline(j.outline,x,z)&&(!junction||Math.hypot(x-j.x,z-j.z)<Math.hypot(x-junction.x,z-junction.z)))junction=j;continue;}
   const {road}=item;let closest=null,localDistance=Infinity;
   for(const segment of item.segments){stats.lastCandidateCount++;const {a,b,margin}=segment,dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;if(length2<EPS*EPS)continue;const t=((x-a.x)*dx+(z-a.z)*dz)/length2,u=clamp(t,0,1),distance=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;if(distance>margin*margin||distance>=localDistance)continue;localDistance=distance;closest={a,b,t,u};}
   if(!closest||localDistance>nearest+1e-10)continue;const {a,b,t,u}=closest,distance=localDistance;
   if(a.distance===0&&t<0&&(x-a.x)*a.tx+(z-a.z)*a.tz< -1e-5)continue;
   if(b.distance===road.length&&t>1&&(x-b.x)*b.tx+(z-b.z)*b.tz>1e-5)continue;
   const d=a.distance+(b.distance-a.distance)*u,p=atDistance(road.source.stations,d),offset=(x-p.x)*p.nx+(z-p.z)*p.nz,width=road.widthAt(d),edge=width/2+road.sidewalk;if(Math.abs(offset)>edge+.03+(raw&&road.bridgeJunctions?.length&&road.source.spec.sidewalk?.04:0))continue;
   const zone=road.zones.find(q=>q.mode==='bridge'&&d>=q.start-EPS&&d<=q.end+EPS)||road.zones.find(q=>d>=q.start-EPS&&d<=q.end+EPS),datum=(raw?road.baseSample||road.sample:road.sample)(d,offset,x,z);
   if(distance<nearest-1e-10||!best||datum>best.datum){nearest=distance;best={roadId:road.id,road,distance:d,offset,width,edge,datum,mode:zone?.mode||'dry',bridgeSpan:zone?.bridgeSpan||null,junction:zone?.junction||null};}
  }
  if(junction)best={roadId:best?.roadId??null,road:best?.road??null,distance:best?.distance??null,offset:best?.offset??null,width:best?.width??null,edge:best?.edge??null,datum:junction.height(x,z),mode:junction.preserveBridge?'bridge-junction':'junction',bridgeSpan:best?.bridgeSpan??null,junction};
  if(best&&!raw)best.datum=resolveBridgeJunction(x,z)??best.datum;
  return best;
 }
// A bridge's lateral lookup band is not a junction elevation boundary. A
 // shared local plane removes that selector seam, and a C2 compact blend
 // returns to the exact released road/bridge field outside its approaches.
 // Only descriptors connected to an actual junction participate; nearby,
 // unconnected roads and ordinary dry intersections keep their old fields.
 const bridgeJunctions=[],endpointRoads=new Map(),roadJunctions=new Map(),junctionBins=new Map(),spanPlans=new Map();
 for(const j of roadGeometry.junctions)for(const arm of j.arms){if(!roadJunctions.has(arm.roadId))roadJunctions.set(arm.roadId,new Set());roadJunctions.get(arm.roadId).add(j);}
 const singleSpan=span=>{if(!spanPlans.has(span)){const local={...bridgePlan,bins:new Map()};for(const [key,groups]of bridgePlan.bins){const own=groups.filter(group=>group.span===span);if(own.length)local.bins.set(key,own);}spanPlans.set(span,local);}return spanPlans.get(span);};
 for(const r of roads.values())for(const p of [r.source.stations[0],r.source.stations.at(-1)]){const k=key(p);if(!endpointRoads.has(k))endpointRoads.set(k,[]);endpointRoads.get(k).push(r);}
 const ease=t=>t*t*t*(t*(t*6-15)+10);
 const weightAt=(j,x,z)=>{const d=Math.hypot(x-j.x,z-j.z);if(d>=j.outer)return 0;let weight=d<=j.inner?1:ease(1-(d-j.inner)/(j.outer-j.inner));for(const end of j.endFades||[]){const distance=(x-end.x)*end.tx+(z-end.z)*end.tz;if(distance<=0)return 0;if(distance<end.length)weight*=ease(distance/end.length);}return weight;};
 stats.skippedBridgeJunctions=0;
 for(const j of junctions.values()){
  const seeds=j.source.arms.map(a=>roads.get(a.roadId)).filter(Boolean),ids=new Set(seeds.map(r=>r.id));
  const active=(bridgePlan?.spans||[]).filter(span=>span.roads.some(id=>ids.has(id))&&span.points.some(p=>Math.hypot(p.x-j.x,p.z-j.z)<j.radius+p.width/2+.52));
  if(!active.length)continue;
  const local={x:j.x,z:j.z,inner:j.radius+.12,outer:j.radius+12.12,source:j,roads:new Set(),spans:active};
  const pending=[...seeds];while(pending.length){const r=pending.pop();if(local.roads.has(r))continue;const q=project(r.source.stations,j.x,j.z);if(!q||q.distance>local.outer*local.outer)continue;local.roads.add(r);for(const q of roadJunctions.get(r.id)||[])if(Math.hypot(q.x-j.x,q.z-j.z)<local.outer)for(const arm of q.arms){const next=roads.get(arm.roadId);if(next&&!local.roads.has(next))pending.push(next);}for(const p of [r.source.stations[0],r.source.stations.at(-1)])if(Math.hypot(p.x-j.x,p.z-j.z)<local.outer)for(const next of endpointRoads.get(key(p))||[])if(!local.roads.has(next))pending.push(next);}
  // A terminal road still meets its original endpoint plane, across its
  // entire width. The same finite-end weight is shared by every arm so the
  // nearest-road selector cannot introduce another seam. If an endpoint is
  // too close to fit even a short transition, keep the released junction.
  local.endFades=[];let feasible=true;
  for(const r of local.roads)for(const [p,sign]of [[r.source.stations[0],1],[r.source.stations.at(-1),-1]]){
   if(ends.get(key(p))!==1||Math.hypot(p.x-j.x,p.z-j.z)>=local.outer||roadGeometry.junctions.some(q=>q.arms.some(a=>a.roadId===r.id)&&Math.hypot(p.x-q.x,p.z-q.z)<1e-4))continue;
   const tx=p.tx*sign,tz=p.tz*sign,available=(j.x-p.x)*tx+(j.z-p.z)*tz-local.inner;if(available<.5){feasible=false;break;}local.endFades.push({x:p.x,z:p.z,tx,tz,length:Math.min(6,available)});
  }
  if(!feasible){stats.skippedBridgeJunctions++;continue;}
  let y=bridgeHeight(bridgePlan,j.x,j.z)??legacy(j.x,j.z),g=gradient(legacy,j.x,j.z),m=Math.hypot(g.x,g.z);if(m>.04){g.x*=.04/m;g.z*=.04/m;}
  // Never lower an existing bridge within this bounded correction. Checking
  // its authored/dense sweep stations and full footway width also retains the
  // old wet clearance, rather than trading a smoother junction for a low deck.
  for(const span of active)for(const p of span.points){if(Math.hypot(p.x-j.x,p.z-j.z)>local.outer+.6)continue;const edge=p.width/2+(span.sidewalk?.42:.2);for(const u of [-edge,-edge/2,0,edge/2,edge]){const x=p.x+p.nx*u,z=p.z+p.nz*u;if(weightAt(local,x,z)===0)continue;const h=bridgeHeight(singleSpan(span),x,z);if(h!==null)y=Math.max(y,h-g.x*(x-j.x)-g.z*(z-j.z));}}
  Object.assign(local,{y,gx:g.x,gz:g.z});bridgeJunctions.push(local);for(const r of local.roads){(r.bridgeJunctions??=[]).push(local);}
  j.resolvedPlane=local;
  for(let x=Math.floor((j.x-local.outer)/CELL);x<=Math.floor((j.x+local.outer)/CELL);x++)for(let z=Math.floor((j.z-local.outer)/CELL);z<=Math.floor((j.z+local.outer)/CELL);z++){const k=x+','+z;if(!junctionBins.has(k))junctionBins.set(k,[]);junctionBins.get(k).push(local);}
 }
 const corrected=(list,x,z,base,road=null)=>{let total=0,value=0,baseWeight=1;for(const j of list||[]){if(road&&!j.roads.has(road))continue;const weight=weightAt(j,x,z);if(!weight)continue;total+=weight;value+=weight*(j.y+j.gx*(x-j.x)+j.gz*(z-j.z)-base);baseWeight*=1-weight;}return total?base+value/(total+baseWeight):null;};
 const localJunctions=(x,z)=>junctionBins.get(Math.floor(x/CELL)+','+Math.floor(z/CELL));
 function underlying(r,d,u,x,z){const bridge=r.zones.find(q=>q.mode==='bridge'&&d>=q.start-EPS&&d<=q.end+EPS);if(bridge)return bridgeHeight(singleSpan(bridge.bridgeSpan),x,z)??oldDatum(x,z);if(r.zones.some(q=>q.mode==='bridge-junction'&&d>=q.start-EPS&&d<=q.end+EPS))return oldDatum(x,z);return r.baseSample(d,u,x,z);}
 function resolveBridgeJunction(x,z){
  const list=localJunctions(x,z);if(!list)return null;const location=corridorAt(x,z,true);if(!location)return null;const r=location.road;
  if(!r&&!location.junction?.resolvedPlane)return null;return corrected(list,x,z,r?underlying(r,location.distance,location.offset,x,z):location.datum,r);
 }
 function additionsFor(stations,list,lo=0,hi=stations.at(-1).distance){
  const distances=[],ranges=[];for(const j of list)for(const radius of [j.inner,j.outer])for(const [a,b]of junctionCuts(stations,[{x:j.x,z:j.z,radius}])){if(radius===j.outer)ranges.push([a,b]);for(const d of [a,b])if(d>lo+EPS&&d<hi-EPS)distances.push(d);}
  for(const j of list)for(const end of j.endFades)for(const level of [0,end.length])for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i],u=(a.x-end.x)*end.tx+(a.z-end.z)*end.tz-level,v=(b.x-end.x)*end.tx+(b.z-end.z)*end.tz-level;if(u*v>=0||Math.abs(u-v)<EPS)continue;const d=a.distance+(b.distance-a.distance)*u/(u-v);if(d>lo+EPS&&d<hi-EPS)distances.push(d);}
  const all=[lo,hi,...stations.filter(p=>p.distance>lo&&p.distance<hi).map(p=>p.distance),...distances].sort((a,b)=>a-b),unique=all.filter((d,i)=>!i||d-all[i-1]>EPS);
  // Retain every authored station and grade break. Refine only remaining
  // long gaps, rather than adding another lattice over an already dense road.
  for(let i=1;i<unique.length;i++){const a=unique[i-1],b=unique[i],mid=(a+b)/2;if(!ranges.some(([start,end])=>mid>=start&&mid<=end))continue;const count=Math.max(1,Math.ceil((b-a-EPS)/.7));for(let k=1;k<count;k++)distances.push(a+(b-a)*k/count);}
  return distances.sort((a,b)=>a-b).filter((d,i,a)=>!i||d-a[i-1]>EPS);
 }
 for(const r of roads.values()){
  r.baseSample=r.sample;if(!r.bridgeJunctions)continue;for(const zone of r.zones)if(zone.bridgeSpan)singleSpan(zone.bridgeSpan);
  r.sample=(d,u=0,x,z)=>{const base=r.baseSample(d,u,x,z);if(base===null)return null;const p=atDistance(r.source.stations,clamp(d,0,r.length));x??=p.x+p.nx*u;z??=p.z+p.nz*u;const list=localJunctions(x,z);if(!list)return base;return corrected(list,x,z,underlying(r,d,u,x,z),r)??base;};
  const added=additionsFor(r.stations,r.bridgeJunctions).filter(d=>!r.stations.some(p=>Math.abs(p.distance-d)<EPS));r.stations=[...r.stations,...added.map(d=>atDistance(r.source.stations,d))].sort((a,b)=>a.distance-b.distance);stats.addedStations+=added.length;
 }
 const bridgeStationCache=new Map();
 function bridgeStations(span){
  if(bridgeStationCache.has(span))return bridgeStationCache.get(span);const list=bridgeJunctions.filter(j=>span.roads.some(id=>[...j.roads].some(r=>r.id===id)));
  if(!list.length)return span.points;
  const additions=additionsFor(span.points,list,span.start,span.end).filter(d=>!span.points.some(p=>Math.abs(p.distance-d)<EPS));
  if(!additions.length){bridgeStationCache.set(span,span.points);return span.points;}
  const result=[...span.points,...additions.map(d=>({...atDistance(span.stations,d),width:bridgeWidth(span.stations,d)}))].sort((a,b)=>a.distance-b.distance);bridgeStationCache.set(span,result);return result;
 }
 stats.bridgeJunctions=bridgeJunctions.length;
 return {roads,junctions,resolveBridgeJunction,bridgeStations,stationsFor:id=>roads.get(id)?.stations||null,sampleRoad:(id,d,u=0)=>roads.get(id)?.sample(d,u)??null,sampleDatum:(x,z)=>resolveBridgeJunction(x,z)??corridorAt(x,z)?.datum??null,corridorAt,bounds:Number.isFinite(bounds.minX)?bounds:null,stats};
}
