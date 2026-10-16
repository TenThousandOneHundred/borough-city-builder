import {streetStations,atDistance,distanceSection} from './street-geometry.js?v=76';
const cross=(a,b)=>a.x*b.z-a.z*b.x;
const point=(j,a,d,offset=0)=>({x:j.x+a.tx*d-a.tz*offset,z:j.z+a.tz*d+a.tx*offset});

// Rendering and traffic share one road-edit plan. Population, cameras, and
// terrain heights do not alter centerline intersections. Inspect road values so
// in-place edits and imported worlds cannot reuse stale controls.
const geometryCache=new WeakMap();
export function roadGeometry(world,engine){
 const signature=JSON.stringify([world.roadPaths||[],world.tiles.map((t,i)=>t.type==='road'?[i,t.roadType,t.roadWidth,t.legacyRoad,t.pathIds]:null).filter(Boolean)]),cached=geometryCache.get(world);
 if(cached?.engine===engine&&cached.signature===signature)return cached.value;
 const roads=roadDescriptors(world,engine),value={roads,...planJunctions(roads)};value.tapers=planWidthTransitions(roads,value.junctions);geometryCache.set(world,{engine,signature,value});return value;
}

// Use the same sampled centerlines as pavement rendering. Grid roads participate
// too, so a new curved street can join an existing saved starter road.
export function roadDescriptors(world,engine){
 const descriptors=[];
 for(const path of world.roadPaths||[])descriptors.push({id:path.id,spec:engine.ROADS[path.type],stations:streetStations(engine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96})))});
 for(let i=0;i<world.tiles.length;i++){
  const t=world.tiles[i];if(t.type!=='road'||t.pathIds?.length&&!t.legacyRoad)continue;
  const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96,dirs=engine.neighbors(i).filter(n=>world.tiles[n].type==='road').map(n=>({x:n%48-i%48,z:Math.floor(n/48)-Math.floor(i/48)}));
  const spec={...engine.ROADS.street,width:t.roadWidth===2?3.15:2.45,lanes:t.roadWidth===2?4:2};let points=[];
  if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].z*dirs[1].z===0){for(let k=0;k<=12;k++){const u=k/12,v=1-u;points.push({x:x+2*(v*v*dirs[0].x+u*u*dirs[1].x),z:z+2*(v*v*dirs[0].z+u*u*dirs[1].z)});}}
  else if(dirs.length<=2){const d=dirs.find(p=>p.x!==0)||dirs[0]||{x:1,z:0};points=[{x:x-d.x*2,z:z-d.z*2},{x:x+d.x*2,z:z+d.z*2}];}
  else for(let k=0;k<dirs.length;k++)descriptors.push({id:`grid/${i}/${k}`,legacy:true,spec,stations:streetStations([{x,z},{x:x+dirs[k].x*2,z:z+dirs[k].z*2}])});
  if(points.length)descriptors.push({id:`grid/${i}`,legacy:true,spec,stations:streetStations(points)});
 }
 return extendJunctionEndpoints(descriptors);
}

// A drawn branch may end inside a curved road's pavement rather than exactly
// on its centerline. Extend only forward along the branch tangent, within that
// existing pavement. Saved controls and all simulation samples remain unchanged.
export function extendJunctionEndpoints(descriptors){
 const bins=new Map();
 for(const road of descriptors)for(let i=1;i<road.stations.length;i++){const a=road.stations[i-1],b=road.stations[i];
  for(let x=Math.floor((Math.min(a.x,b.x)-4)/8);x<=Math.floor((Math.max(a.x,b.x)+4)/8);x++)for(let z=Math.floor((Math.min(a.z,b.z)-4)/8);z<=Math.floor((Math.max(a.z,b.z)+4)/8);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push({road,a,b});}
 }
 for(const road of descriptors){if(road.legacy||road.stations.length<2)continue;const points=road.stations.map(p=>({x:p.x,z:p.z}));let changed=false;
  for(const endpoint of [0,points.length-1]){const p=road.stations[endpoint],sign=endpoint===0?-1:1,dir={x:p.tx*sign,z:p.tz*sign};let best=Infinity,target=null;
   for(const s of bins.get(Math.floor(p.x/8)+','+Math.floor(p.z/8))||[]){if(s.road===road)continue;const v={x:s.b.x-s.a.x,z:s.b.z-s.a.z},length=Math.hypot(v.x,v.z),den=cross(dir,v);if(Math.abs(den)<length*.15)continue;
    const offset={x:s.a.x-p.x,z:s.a.z-p.z},distance=cross(offset,v)/den,t=cross(offset,dir)/den;
    if(distance<=1e-6||distance>4||distance>=best||t< -1e-6||t>1+1e-6||distance*Math.abs(den)/length>s.road.spec.width/2+.04)continue;
    best=distance;target={x:p.x+dir.x*distance,z:p.z+dir.z*distance};
   }
   if(target){points[endpoint]=target;changed=true;}
  }
  if(changed)road.stations=streetStations(points);
 }
 return descriptors;
}

// A small spatial hash limits geometric intersection tests to nearby segments.
// Nothing here reads agents or advances simulation; this runs on road edits.
export function planJunctions(descriptors){
 const bins=new Map(),segments=[],pairs=new Set(),candidates=[];let comparisons=0;
 for(const road of descriptors)for(let i=1;i<road.stations.length;i++){
  const a=road.stations[i-1],b=road.stations[i],segment={road,a,b,id:segments.length};segments.push(segment);
  for(let x=Math.floor(Math.min(a.x,b.x)/8);x<=Math.floor(Math.max(a.x,b.x)/8);x++)for(let z=Math.floor(Math.min(a.z,b.z)/8);z<=Math.floor(Math.max(a.z,b.z)/8);z++){
   const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(segment);
  }
 }
 for(const list of bins.values())for(let i=0;i<list.length;i++)for(let k=i+1;k<list.length;k++){
  const a=list[i],b=list[k];if(a.road===b.road)continue;const key=Math.min(a.id,b.id)+'/'+Math.max(a.id,b.id);if(pairs.has(key))continue;pairs.add(key);comparisons++;
  const u={x:a.b.x-a.a.x,z:a.b.z-a.a.z},v={x:b.b.x-b.a.x,z:b.b.z-b.a.z},offset={x:b.a.x-a.a.x,z:b.a.z-a.a.z},den=cross(u,v);
  if(Math.abs(den)<1e-8)continue;const t=cross(offset,v)/den,s=cross(offset,u)/den;if(t< -1e-6||t>1+1e-6||s< -1e-6||s>1+1e-6)continue;
  const x=a.a.x+u.x*t,z=a.a.z+u.z*t;let j=candidates.find(c=>Math.hypot(c.x-x,c.z-z)<.05);if(!j){j={x,z,hits:new Map()};candidates.push(j);}
  j.hits.set(a.road,a.a.distance+(a.b.distance-a.a.distance)*Math.max(0,Math.min(1,t)));j.hits.set(b.road,b.a.distance+(b.b.distance-b.a.distance)*Math.max(0,Math.min(1,s)));
 }
 const junctions=[];
 for(const j of candidates){
  const arms=[];
  for(const [road,distance]of j.hits){const p=atDistance(road.stations,distance),total=road.stations.at(-1).distance;
   for(const sign of [-1,1]){if(sign<0?distance<.02:total-distance<.02)continue;const tx=p.tx*sign,tz=p.tz*sign,existing=arms.find(a=>a.tx*tx+a.tz*tz>.995);
    if(existing){if(road.spec.width>existing.width){existing.width=road.spec.width;existing.spec=road.spec;}continue;}
    arms.push({tx,tz,width:road.spec.width,spec:road.spec,sign,roadId:road.id});
   }
  }
  if(arms.length<2||arms.length===2&&arms[0].tx*arms[1].tx+arms[0].tz*arms[1].tz<-.995)continue;
  arms.sort((a,b)=>Math.atan2(a.tz,a.tx)-Math.atan2(b.tz,b.tx));j.arms=arms;
  j.radius=Math.max(...arms.map(a=>a.width/2))+.65;j.corners=[];
  for(let i=0;i<arms.length;i++){
   const a=arms[i],b=arms[(i+1)%arms.length],pa=point(j,a,0,a.width/2),pb=point(j,b,0,-b.width/2),den=a.tx*b.tz-a.tz*b.tx;
   let corner=null,ta=0,tb=0;
   if(Math.abs(den)>.08){const delta={x:pb.x-pa.x,z:pb.z-pa.z};ta=cross(delta,{x:b.tx,z:b.tz})/den;tb=cross(delta,{x:a.tx,z:a.tz})/den;
    const cap=Math.max(a.width,b.width)*2;if(Math.abs(ta)<cap&&Math.abs(tb)<cap){corner={x:pa.x+a.tx*ta,z:pa.z+a.tz*ta};j.radius=Math.max(j.radius,ta+.65,tb+.65);}
   }
   j.corners.push({a,b,corner,ta,tb});
  }
  j.radius=Math.min(8,j.radius);junctions.push(j);
 }
 return {junctions,comparisons,segmentCount:segments.length};
}

// Curbs follow only the perimeter between arms; the end caps are open road.
export function junctionCorners(j){return j.corners.map(({a,b,corner,ta,tb})=>{
 const start=point(j,a,j.radius,a.width/2),end=point(j,b,j.radius,-b.width/2),points=[start];
 if(corner){const da=Math.min(j.radius,ta+.65),db=Math.min(j.radius,tb+.65),p=point(j,a,da,a.width/2),q=point(j,b,db,-b.width/2);points.push(p);
  for(let n=1;n<=12;n++){const t=n/12,u=1-t;points.push({x:u*u*p.x+2*u*t*corner.x+t*t*q.x,z:u*u*p.z+2*u*t*corner.z+t*t*q.z});}
 }
 points.push(end);return {points,sidewalk:a.spec.sidewalk&&b.spec.sidewalk};
});}

// Union circular cut intervals along the sampled centerline. Subtract intervals
// from both dashed markings and sidewalk/median strips, preserving dash phase.
export function junctionCuts(stations,junctions,padding=0){
 const cuts=[];
 for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i],dx=b.x-a.x,dz=b.z-a.z,length=b.distance-a.distance,A=dx*dx+dz*dz;if(A<1e-12)continue;
  for(const j of junctions){const r=j.radius+padding,ox=a.x-j.x,oz=a.z-j.z,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-r*r,disc=B*B-4*A*C;if(disc<0)continue;
   const root=Math.sqrt(disc),lo=Math.max(0,(-B-root)/(2*A)),hi=Math.min(1,(-B+root)/(2*A));if(hi-lo>1e-8)cuts.push([a.distance+lo*length,a.distance+hi*length]);
  }
 }
 cuts.sort((a,b)=>a[0]-b[0]);const merged=[];for(const cut of cuts){const last=merged.at(-1);if(last&&cut[0]<=last[1]+1e-6)last[1]=Math.max(last[1],cut[1]);else merged.push([...cut]);}return merged;
}
export function clearRanges(start,end,cuts){const ranges=[];let at=start;for(const [a,b]of cuts){if(b<=at)continue;if(a>=end)break;if(a>at)ranges.push([at,Math.min(end,a)]);at=Math.max(at,b);if(at>=end)break;}if(at<end-1e-6)ranges.push([at,end]);return ranges;}
export function clearSections(stations,cuts){return clearRanges(0,stations.at(-1)?.distance||0,cuts).map(([a,b])=>distanceSection(stations,a,b));}

// Signals sit on the approach sidewalk, facing arriving drivers. Rendering uses
// the existing simulation controllers and phases without relocating their gates.
export function signalPlacements(junctions,controllers){
 const placements=[];
 for(const j of junctions){if(j.arms.length<3)continue;const control=controllers.filter(c=>Math.hypot(c.x-j.x,c.z-j.z)<=c.radius+2).sort((a,b)=>Math.hypot(a.x-j.x,a.z-j.z)-Math.hypot(b.x-j.x,b.z-j.z))[0];if(!control)continue;
  for(const a of j.arms){if(a.spec.oneway&&a.sign>0)continue;const p=point(j,a,j.radius+1.05,-a.width/2-.23);placements.push({...p,tx:a.tx,tz:a.tz,axis:Math.abs(a.tx)>Math.abs(a.tz)?'x':'z',controller:control.id});}
 }
 return placements;
}


// Only uninterrupted, aligned endpoint joins receive tapers. Intersections keep
// their shared junction surface, and road edits reuse the same cached plan.
export function planWidthTransitions(roads,junctions=[]){
 const ends=[];for(const road of roads){if(road.legacy||road.stations.length<2)continue;for(const end of [0,1]){const p=end?road.stations.at(-1):road.stations[0],sign=end?1:-1;ends.push({road,end,p,tx:p.tx*sign,tz:p.tz*sign});}}
 const bins=new Map();for(const end of ends){const key=Math.floor(end.p.x/.1)+','+Math.floor(end.p.z/.1);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(end);}
 const result=new Map();
 for(let i=0;i<ends.length;i++){
  const a=ends[i],near=[],bx=Math.floor(a.p.x/.1),bz=Math.floor(a.p.z/.1);
  for(let x=bx-1;x<=bx+1;x++)for(let z=bz-1;z<=bz+1;z++)for(const b of bins.get(x+','+z)||[])if(b!==a&&Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)<.05)near.push(b);
  if(near.length!==1)continue;const b=near[0];
  if(a.road===b.road||a.tx*b.tx+a.tz*b.tz>-.995||a.road.spec.width<=b.road.spec.width+.01||junctions.some(j=>Math.hypot(a.p.x-j.x,a.p.z-j.z)<j.radius))continue;
  if(!result.has(a.road.id))result.set(a.road.id,[]);
  result.get(a.road.id).push({end:a.end,width:b.road.spec.width,median:!!b.road.spec.median,length:Math.min(8,a.road.stations.at(-1).distance/2)});
 }
 return result;
}
export function transitionWidth(road,tapers,distance){
 let width=road.spec.width;const total=road.stations.at(-1).distance;
 for(const taper of tapers||[]){const away=taper.end?total-distance:distance;if(away>=taper.length)continue;const t=Math.max(0,away/taper.length),blend=t*t*(3-2*t);width=Math.min(width,taper.width+(road.spec.width-taper.width)*blend);}
 return width;
}
