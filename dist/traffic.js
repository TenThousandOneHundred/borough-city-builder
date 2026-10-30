import './map-grid.js?v=162';
const G=globalThis.BoroughGrid;
import {CrossingControl} from './crossing-control.js?v=162';
import './road-connectivity.js?v=162';
const RoadConnectivity=globalThis.BoroughRoadConnectivity;
import {followingClearance} from './traffic-following.js?v=162';
import {roundaboutRoute} from './roundabout-geometry.js?v=162';
import {moveToRoute} from './route-progress.js?v=162';
import './building-entities.js?v=162';
const Buildings=globalThis.BoroughBuildings;
import {laneOffset,transitionLaneOffsets} from './road-lanes.js?v=162';
import {roadGeometry} from './road-junction-plan.js?v=162';
import {TrafficSpatial} from './traffic-spatial.js?v=162';
import {Junctions,smoothRoute} from './junctions.js?v=162';
// Car slots grow with population; saved road trips always have room to resume.
export function carCapacity(world){const population=Buildings.entries(world).reduce((n,[,t])=>n+(t.type==='residential'&&!t.construction?(t.people||0):0),0),saved=world.citizens?.residents.filter(r=>r.trip).length||0;return Math.max(32,Math.min(512,Math.ceil(population/4)),saved);}
// Destination-based road trips. No random placement or per-frame route searches.
export const roadPoint=i=>({x:(i%G.n+.5)*4-G.half,z:(Math.floor(i/G.n)+.5)*4-G.half});
export function outsidePortals(world){return world.tiles.flatMap((t,i)=>{const x=i%G.n,y=Math.floor(i/G.n);if(t.type!=='road'||x!==0&&x!==G.last&&y!==0&&y!==G.last)return[];const direction=x===0?[-1,0]:x===G.last?[1,0]:y===0?[0,-1]:[0,1],p=roadPoint(i);return[{id:i,...p,dx:direction[0],dz:direction[1],outside:{x:p.x+direction[0]*80,z:p.z+direction[1]*80}}];});}
export class Traffic {
 constructor(world,engine){this.engine=engine;this.spatial=new TrafficSpatial();this.agents=[];this.sequence=0;this.spawnClock=0;this.completed=0;this.time=0;this.rebuild(world);this.crossings=new CrossingControl(this);}
 rebuild(world){const replacement=this.roadEditRevision!==undefined&&this.roadEditRevision!==(world.roadEditRevision||0);this.roadEditRevision=world.roadEditRevision||0;this.world=world;this.portals=outsidePortals(world);this.graph=new Map();this.samples=new Map();this.positions=new Map();this.routeCache=new Map();this.searchCache=new Map();
 for(const path of world.roadPaths||[]){const samples=this.engine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half}));const mapping=new Map();for(const i of path.tiles){const p=roadPoint(i);let best=0,d=Infinity;samples.forEach((s,j)=>{const v=(s.x-p.x)**2+(s.z-p.z)**2;if(v<d){d=v;best=j}});mapping.set(i,best);if(!this.positions.has(i))this.positions.set(i,samples[best]);}this.samples.set(path.id,{samples,mapping,spec:this.engine.ROADS[path.type]});}
 this.network=RoadConnectivity.build(world,this.engine);this.graph=this.network.graph;
 const previousJunctions=this.junctions;this.roadJunctions=roadGeometry(world,this.engine).junctions;this.junctions=new Junctions(this.graph,roadPoint,this.roadJunctions);for(const j of this.junctions.items){const previous=previousJunctions?.items.find(old=>old.id===j.id);if(previous?.owner?.active)j.owner=previous.owner;}
 this.crossings?.rebuild();
 this.reverseGraph=this.network.reverseGraph;
 this.trips=[];const pathsFrom=new Map(this.portals.map(p=>[p.id,this.search(p.id)])),pathsTo=new Map(this.portals.map(p=>[p.id,this.search(p.id,this.reverseGraph)]));
 for(const [i,tile]of Buildings.entries(world)){if(!['residential','commercial','industrial','office'].includes(tile.type)||!tile.level||tile.construction)continue;const frontage=Buildings.frontage(world,i,this.graph),lotPoint=Buildings.point(world,i),nearest=[...this.portals].sort((a,b)=>Math.hypot(a.x-lotPoint.x,a.z-lotPoint.z)-Math.hypot(b.x-lotPoint.x,b.z-lotPoint.z));let found=false;for(const portal of nearest){const parents=pathsFrom.get(portal.id);for(const road of frontage){const source=this.frontageSource(i,road),inbound=this.trace(parents,road,source,this.frontagePoint(i));if(!inbound)continue;for(const exit of nearest){const reverse=this.trace(pathsTo.get(exit.id),road,source,this.frontagePoint(i));if(!reverse)continue;const outbound=this.network.reverseTrace(reverse);const incoming=this.route(inbound,portal,true,Buildings.seed(i)),outgoing=this.route(outbound,exit,false,Buildings.seed(i)),lot=Buildings.point(world,i),stop={x:(lot.x+incoming.at(-1).x)/2,z:(lot.z+incoming.at(-1).z)/2};this.trips.push({destination:i,kind:tile.type==='industrial'?'Delivery':this.engine.hasShops(tile)?'Business visit':tile.type==='residential'?'Resident visit':'Business visit',inbound:[...incoming,stop],outbound:[stop,...outgoing],cells:[inbound,outbound],roads:new Set([...inbound,...outbound])});found=true;break;}if(found)break;}if(found)break;}}
 // Width and direction changes need new lane geometry. Additions retain the
 // existing route exactly; replacements project onto a newly connected trip.
 if(replacement){const people=new Map((world.citizens?.residents||[]).map(r=>[r.id,r]));for(const a of this.agents){if(!a.active||a.kind==='bus')continue;
  if(a.residentId){const r=people.get(a.residentId),trip=r?.trip,route=trip&&this.between(trip.from,trip.to);if(!route){a.active=false;continue;}a.trip={destination:trip.to,cells:[route.cells],roads:new Set(route.cells)};moveToRoute(a,route.points);Object.assign(trip,{segment:a.segment,distance:a.distance,x:a.x,z:a.z,heading:a.heading});}
  else{const trip=this.trips.find(t=>t.destination===a.trip.destination);if(!trip){a.active=false;continue;}a.trip=trip;if(!a.dwell)moveToRoute(a,a.phase==='inbound'?trip.inbound:trip.outbound);}
 }}
 // Keep valid trips across additions. Removed roads cancel only affected trips.
 for(const a of this.agents)if(a.active&&(!Buildings.get(world,a.trip.destination)?.level||a.trip.cells.some(cells=>!this.network.validTrace(cells))))a.active=false;
 }
 search(start,graph=this.graph,pathId,point){const key=pathId===undefined&&!point?start:JSON.stringify([start,pathId,point]);if(graph===this.graph&&this.searchCache.has(key))return this.searchCache.get(key);const parents=this.network.search(start,{pathId,point,backwards:graph===this.reverseGraph});if(graph===this.graph){if(this.searchCache.size>=128)this.searchCache.delete(this.searchCache.keys().next().value);this.searchCache.set(key,parents);}return parents;}
 trace(parents,end,pathId,point){return this.network.trace(parents,end,pathId,point);}
 frontagePoint(id){const parcel=Buildings.parcel(this.world,id),p=parcel?.frame.frontage||Buildings.point(this.world,id);return p&&{x:(p.x+G.half)/4-.5,y:(p.z+G.half)/4-.5};}
 frontageSource(id,tile){const parcel=Buildings.parcel(this.world,id);if(parcel)return Buildings.frontageSource(this.world,parcel.frame.frontage);const p=Buildings.point(this.world,id);return this.network.nearestSource(tile,{x:(p.x+G.half)/4-.5,y:(p.z+G.half)/4-.5});}
 route(cells,portal,incoming,laneChoice=0){const points=[],offsets=[],laneOffsets=new Map();let previous=null;
 const add=(p,spec)=>{points.push(p);if(!laneOffsets.has(spec))laneOffsets.set(spec,laneOffset(spec,laneChoice));offsets.push(laneOffsets.get(spec));};
 const legacy=i=>({width:this.world.tiles[i].roadWidth===2?3.15:2.45,lanes:this.world.tiles[i].roadWidth===2?4:2,oneway:!!this.engine.ROADS[this.world.tiles[i].roadType]?.oneway});
 if(cells.sources){
  const worldPoint=p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half});
  const parameter=(samples,p)=>{let best=Infinity,result=0;for(let n=1;n<samples.length;n++){const a=samples[n-1],b=samples[n],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=(a.x+dx*t-p.x)**2+(a.y+dy*t-p.y)**2;if(d<best){best=d;result=n-1+t;}}return result;};
  for(let k=0;k<cells.length;){const record=this.network.records.get(cells.sources[k]);if(record.legacy){add(roadPoint(cells[k]),legacy(cells[k]));if(cells.joins[k])add(worldPoint(cells.joins[k]),record.spec);k++;continue;}
   let end=k;while(end+1<cells.length&&cells.sources[end+1]===cells.sources[k])end++;
   const samples=record.points,a=cells.joins[k-1]||cells.positions[k],b=cells.joins[end]||cells.positions[end],from=parameter(samples,a),to=parameter(samples,b),step=to>=from?1:-1;
   add(worldPoint(a),record.spec);for(let n=step>0?Math.floor(from)+1:Math.ceil(from)-1;step>0?n<to:n>to;n+=step)add(worldPoint(samples[n]),record.spec);add(worldPoint(b),record.spec);k=end+1;
  }
 }else{
 // A crossing cell can belong to several roads. Keep the travelled centerline
 // through shared cells instead of switching to whichever road was built first.
 const choices=cells.map((i,k)=>k===cells.length-1?[]:(this.world.tiles[i].pathIds||[]).map(id=>this.samples.get(id)).filter(path=>path?.mapping.has(i)&&path.mapping.has(cells[k+1])));
 for(let k=0;k<cells.length;k++){
  const i=cells[k],j=cells[k+1],available=choices[k];let path=available.includes(previous)?previous:null;
  if(!path&&available.length){
   let longest=-1;for(const candidate of available){let length=0;while(k+length<choices.length&&choices[k+length].includes(candidate))length++;if(length>longest){longest=length;path=candidate;}}
  }
  const anchor=path||previous;
  add(anchor?.mapping.has(i)?anchor.samples[anchor.mapping.get(i)]:cells.length===1?(this.positions.get(i)||roadPoint(i)):roadPoint(i),anchor?.spec||legacy(i));
  if(path&&j!==undefined){const a=path.mapping.get(i),b=path.mapping.get(j),step=b>=a?1:-1;for(let n=a+step;step>0?n<b:n>b;n+=step)add(path.samples[n],path.spec);}
  previous=path;
 }
 }

 if(portal&&incoming){points.unshift(portal.outside,{x:portal.x+portal.dx*3,z:portal.z+portal.dz*3});offsets.unshift(offsets[0],offsets[0]);}else if(portal){points.push({x:portal.x+portal.dx*3,z:portal.z+portal.dz*3},portal.outside);offsets.push(offsets.at(-1),offsets.at(-1));}
 const lanePositions=transitionLaneOffsets(points,offsets);
 return roundaboutRoute(smoothRoute(points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;return{x:p.x-dz/l*lanePositions[i],z:p.z+dx/l*lanePositions[i]}})),this.roadJunctions);
 }
 between(from,to){const key=JSON.stringify([from,to]);if(this.routeCache.has(key))return this.routeCache.get(key);let result=null;const a=Buildings.point(this.world,from),b=Buildings.point(this.world,to);if(!a||!b)return null;const starts=Buildings.frontage(this.world,from,this.graph),ends=Buildings.frontage(this.world,to,this.graph);for(const start of starts){const parents=this.search(start,this.graph,this.frontageSource(from,start),this.frontagePoint(from));for(const end of ends){const cells=this.trace(parents,end,this.frontageSource(to,end),this.frontagePoint(to));if(cells){const center=this.route(cells,null,false,(Math.imul(Buildings.seed(from)+1,31)^Buildings.seed(to))>>>0);result={cells,points:[a,...center,b]};break;}}if(result)break;}this.routeCache.set(key,result);return result;}
 addAgent(){const a={active:false,x:0,z:0,heading:0};this.agents.push(a);return a;}
 begin(a){const choices=this.residentsEnabled?this.trips.filter(t=>Buildings.get(this.world,t.destination)?.type!=='residential'||this.engine.hasShops(Buildings.get(this.world,t.destination))):this.trips;if(!choices.length||this.residentsEnabled&&this.agents.filter(a=>a.active&&!a.residentId&&a.kind!=='bus').length>=6)return false;const trip=choices[this.sequence++%choices.length],start=trip.inbound[0];if(this.agents.some(b=>b!==a&&b.active&&Math.hypot(b.x-start.x,b.z-start.z)<3))return false;Object.assign(a,{hold:false,previousX:undefined,previousZ:undefined,speed:0,stopTime:0,stopJunction:null,residentId:null,arrived:false,active:true,trip,phase:'inbound',points:trip.inbound,segment:0,distance:0,dwell:0,x:start.x,z:start.z});return true;}
 update(dt){if(dt<=0)return;for(let left=dt;left>1e-8;left-=.05)this.step(Math.min(.05,left));}
 step(dt){this.time+=dt;this.spawnClock+=dt;if(this.spawnClock>=2-1e-8){const free=this.agents.find(a=>!a.active&&a.kind!=='bus');if(free&&this.begin(free))this.spawnClock=0;else this.spawnClock=Math.min(this.spawnClock,2);}
 const indexed=this.agents.length>=48;if(indexed)this.spatial.reset(this.agents);
 for(const a of this.agents){if(!a.active||a.hold)continue;if(a.dwell>0){a.dwell-=dt;if(a.dwell<=0){a.phase='outbound';a.points=a.trip.outbound;a.segment=0;a.distance=0;a.speed=0;}continue;}
 const p=a.points[a.segment],q=a.points[a.segment+1];if(!q){if(a.phase==='inbound')a.dwell=4;else{a.active=false;a.arrived=true;this.completed++;}continue;}
 const heading=Math.atan2(q.x-p.x,q.z-p.z),forward={x:Math.sin(heading),z:Math.cos(heading)};
 let clearance=this.junctions.limit(a,this.time,dt,this.world,this.agents,indexed?this.spatial:null);
 clearance=Math.min(clearance,this.crossings.vehicleLimit(a));
 const tile=this.world.tiles[Math.floor((a.z+G.half)/4)*G.n+Math.floor((a.x+G.half)/4)],cruise=this.engine.ROADS[tile?.roadType]?.limitedAccess||tile?.roadType==='highway'?8:tile?.roadType==='gravel'?3:5;
 clearance=followingClearance(a,forward,heading,clearance,cruise,dt,this.agents,indexed?this.spatial:null);
 // A car queued outside the junction must not reserve space ahead of its leader.
 if(a.waitReason==='Vehicle queue'&&clearance<.2)for(const gate of this.junctions.route(a.points).gates){const j=gate.junction;if(j.owner===a&&Math.hypot(a.x-j.x,a.z-j.z)>j.radius)j.owner=null;}

 const target=Math.min(cruise,a.turnSpeed??Infinity,Math.sqrt(Math.max(0,clearance)*6));a.speed=Math.min(target,(a.speed||0)+dt*3);let move=Math.min(dt*a.speed,clearance);if(move>0.02)a.waitReason='';
 while(move>1e-8&&a.active){const p=a.points[a.segment],q=a.points[a.segment+1];if(!q){if(a.phase==='inbound')a.dwell=4;else{a.active=false;a.arrived=true;this.completed++;}break;}const length=Math.hypot(q.x-p.x,q.z-p.z);if(length<.001){a.segment++;continue;}const step=Math.min(move,length-a.distance);a.distance+=step;move-=step;const f=a.distance/length;a.x=p.x+(q.x-p.x)*f;a.z=p.z+(q.z-p.z)*f;a.heading=Math.atan2(q.x-p.x,q.z-p.z);if(a.distance>=length-1e-6){a.segment++;a.distance=0;}}
 if(indexed)this.spatial.move(a);
 }
 }
 get summary(){const moving=this.agents.filter(a=>a.active&&!a.dwell);return {junctions:this.junctions.items.length,queued:moving.filter(a=>(a.speed||0)<.2&&a.waitReason).length,averageSpeed:moving.length?moving.reduce((s,a)=>s+(a.speed||0),0)/moving.length:0};}
 get active(){return this.agents.filter(a=>a.active).length;}
}

carCapacity=G.bind(carCapacity);
outsidePortals=G.bind(outsidePortals);
Traffic=G.bindClass(Traffic);
