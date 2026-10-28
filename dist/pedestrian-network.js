import {roadGeometry,junctionCorners,junctionCuts,clearSections,transitionWidth} from './road-junction-plan.js?v=141';
import {streetStations,atDistance} from './street-geometry.js?v=141';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function crossingPlan(j){if(j.arms.length<3)return [];return j.arms.filter(a=>a.spec.sidewalk).map(arm=>{const d=j.radius+.42,offset=arm.width/2+.22,center={x:j.x+arm.tx*d,z:j.z+arm.tz*d};return {junction:j,arm,center,halfWidth:arm.width/2+.38,halfDepth:.3,ends:[-1,1].map(side=>({x:center.x-arm.tz*offset*side,z:center.z+arm.tx*offset*side}))};});}
export function pedestrianCrossings(world,geometry){
 const result=geometry.junctions.flatMap(crossingPlan);
 for(const index of new Set((world.transit?.lines||[]).flatMap(line=>line.stops))){const origin={x:(index%48+.5)*4-96,z:(Math.floor(index/48)+.5)*4-96};let best=null,bestDistance=2.5;
  for(const road of geometry.roads){if(!road.spec.sidewalk)continue;for(let i=1;i<road.stations.length;i++){const a=road.stations[i-1],b=road.stations[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((origin.x-a.x)*dx+(origin.z-a.z)*dz)/(length*length||1))),center={x:a.x+dx*t,z:a.z+dz*t},d=distance(origin,center);if(d<bestDistance){bestDistance=d;const p=atDistance(road.stations,a.distance+t*length),width=transitionWidth(road,geometry.tapers.get(road.id),p.distance);best={center,arm:{tx:p.tx,tz:p.tz,width,spec:road.spec},halfWidth:width/2+.38,halfDepth:.3,stop:index,ends:[-1,1].map(side=>({x:center.x-p.tz*(width/2+.22)*side,z:center.z+p.tx*(width/2+.22)*side}))};}}}
  if(best&&!geometry.junctions.some(j=>distance(best.center,j)<j.radius+1.8)&&!result.some(c=>distance(c.center,best.center)<1))result.push(best);
 }return result;
}
const networkCache=new WeakMap();
// Built on road edits. The same crossing centers serve pavement and routes.
export function pedestrianNetwork(world,engine){
 const geometry=roadGeometry(world,engine),key=JSON.stringify((world.transit?.lines||[]).map(l=>l.stops)),cached=networkCache.get(world);if(cached?.geometry===geometry&&cached.key===key)return cached.value;
 const nodes=[],edges=[],ends=[],junctionEnds=[],locations=new Map(),bins=new Map(),crossings=pedestrianCrossings(world,geometry);
 const add=(p,kind='street')=>{const key=p.x.toFixed(5)+':'+p.z.toFixed(5);if(locations.has(key))return locations.get(key);const n={x:p.x,z:p.z,id:nodes.length,kind};nodes.push(n);locations.set(key,n);return n;};
 const link=(a,b,kind='sidewalk')=>{if(a!==b)edges.push({a:a.id,b:b.id,kind});};
 const chain=(points,kind='street')=>{const list=points.map(p=>add(p,kind));for(let i=1;i<list.length;i++)link(list[i-1],list[i]);return list;};
 for(const road of geometry.roads){if(!road.spec.sidewalk)continue;const tapers=geometry.tapers.get(road.id)||[],cuts=junctionCuts(road.stations,geometry.junctions);
  for(const section of clearSections(road.stations,cuts)){const samples=[];for(const [i,p]of section.entries()){const last=samples.at(-1);if(!last||i===section.length-1||p.distance-last.distance>=2.5||p.tx*last.tx+p.tz*last.tz<.9999)samples.push(p);}for(const c of crossings)if(c.stop!==undefined)for(let i=1;i<section.length;i++){const a=section[i-1],b=section[i],dx=b.x-a.x,dz=b.z-a.z,t=((c.center.x-a.x)*dx+(c.center.z-a.z)*dz)/(dx*dx+dz*dz||1);if(t>=0&&t<=1&&Math.hypot(c.center.x-a.x-dx*t,c.center.z-a.z-dz*t)<.01)samples.push(atDistance(road.stations,a.distance+(b.distance-a.distance)*t));}samples.sort((a,b)=>a.distance-b.distance);
   for(const side of [-1,1]){const list=chain(samples.map(p=>{const offset=side*(transitionWidth(road,tapers,p.distance)/2+.22);return {x:p.x+p.nx*offset,z:p.z+p.nz*offset};}));for(const node of [list[0],list.at(-1)])ends.push(node);}
  }
 }
 for(const j of geometry.junctions){for(const corner of junctionCorners(j)){if(!corner.sidewalk)continue;const stations=streetStations(corner.points),list=chain(stations.map(p=>({x:p.x-p.nx*.22,z:p.z-p.nz*.22})),j.roundabout?'roundabout':'corner');if(list.length)junctionEnds.push(list[0],list.at(-1));}
  for(const c of crossingPlan(j)){const a=add(c.ends[0],'crossing'),b=add(c.ends[1],'crossing');link(a,b,'crossing');junctionEnds.push(a,b);}
 }
 for(const c of crossings)if(c.stop!==undefined){const a=add(c.ends[0],'crossing'),b=add(c.ends[1],'crossing');link(a,b,'crossing');for(const end of [a,b])for(const n of nodes)if(n.kind==='street'&&distance(n,end)<.72)link(end,n);}
 // Stitch only nearby perimeter endpoints, never opposing sidewalks. The hash
 // also keeps large legacy grids from comparing every pair of road ends.
 for(const node of [...ends,...junctionEnds]){const x=Math.floor(node.x),z=Math.floor(node.z);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const other of bins.get((x+dx)+':'+(z+dz))||[])if(distance(node,other)<.72)link(node,other);const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(node);}
 // A spatial pavement mask prevents door-to-sidewalk links from cutting through
 // driving lanes. Explicit painted crossings and player-built paths remain usable.
 const pavement=new Map(),put=(item,minX,maxX,minZ,maxZ)=>{for(let x=Math.floor(minX/8);x<=Math.floor(maxX/8);x++)for(let z=Math.floor(minZ/8);z<=Math.floor(maxZ/8);z++){const key=x+':'+z;if(!pavement.has(key))pavement.set(key,[]);pavement.get(key).push(item);}};
 for(const road of geometry.roads)for(let i=1;i<road.stations.length;i++){const a=road.stations[i-1],b=road.stations[i],width=Math.max(transitionWidth(road,geometry.tapers.get(road.id),a.distance),transitionWidth(road,geometry.tapers.get(road.id),b.distance))/2-.035;put({a,b,width},Math.min(a.x,b.x)-width,Math.max(a.x,b.x)+width,Math.min(a.z,b.z)-width,Math.max(a.z,b.z)+width);}
 const crossingBins=new Map();for(const c of crossings){const r=c.halfWidth+.4;for(let x=Math.floor((c.center.x-r)/8);x<=Math.floor((c.center.x+r)/8);x++)for(let z=Math.floor((c.center.z-r)/8);z<=Math.floor((c.center.z+r)/8);z++){const key=x+':'+z;if(!crossingBins.has(key))crossingBins.set(key,[]);crossingBins.get(key).push(c);}}
 const blocked=p=>{for(const c of crossingBins.get(Math.floor(p.x/8)+':'+Math.floor(p.z/8))||[]){const dx=p.x-c.center.x,dz=p.z-c.center.z;if(Math.abs(dx*c.arm.tx+dz*c.arm.tz)<=c.halfDepth&&Math.abs(-dx*c.arm.tz+dz*c.arm.tx)<=c.halfWidth)return false;}
  for(const {a,b,width}of pavement.get(Math.floor(p.x/8)+':'+Math.floor(p.z/8))||[]){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)<width)return true;}return false;};
 const value={nodes,edges,crossings,blocked,geometry};networkCache.set(world,{geometry,key,value});return value;
}
// Add just the ramp breakpoints; long street meshes need no global subdivision.
export function rampStations(source,crossings,width){const stations=source[0]?.nx!==undefined?source:streetStations(source);if(stations.length<2)return stations;const distances=new Set(stations.map(p=>p.distance));
 for(const c of crossings)for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),t=((c.center.x-a.x)*dx+(c.center.z-a.z)*dz)/(len*len||1);if(t<0||t>1)continue;const d=a.distance+t*len,p=atDistance(stations,d),w=typeof width==='function'?width(p):width;if(distance(p,c.center)>w/2+.4)continue;for(const offset of [-.54,-.3,0,.3,.54])if(d+offset>stations[0].distance&&d+offset<stations.at(-1).distance)distances.add(d+offset);}
 return [...distances].sort((a,b)=>a-b).map(d=>atDistance(stations,d));
}
export function rampAmount(crossings,p){let drop=0;for(const c of crossings){const dx=p.x-c.center.x,dz=p.z-c.center.z,along=Math.abs(dx*c.arm.tx+dz*c.arm.tz),lateral=Math.abs(-dx*c.arm.tz+dz*c.arm.tx);if(lateral<c.arm.width/2-.1||lateral>c.arm.width/2+.5)continue;drop=Math.max(drop,1-Math.max(0,Math.min(1,(along-.3)/.24)));}return drop;}
