import {laneOffset,transitionLaneOffsets} from './road-lanes.js?v=59';
import {roadGeometry} from './road-junction-plan.js?v=59';
import {TrafficSpatial} from './traffic-spatial.js?v=59';
import {Junctions,smoothRoute} from './junctions.js?v=59';
// Car slots grow with population; saved road trips always have room to resume.
export function carCapacity(world){const population=world.tiles.reduce((n,t)=>n+(t.type==='residential'&&!t.construction?(t.people||0):0),0),saved=world.citizens?.residents.filter(r=>r.trip).length||0;return Math.max(32,Math.min(512,Math.ceil(population/4)),saved);}
// Destination-based road trips. No random placement or per-frame route searches.
export const roadPoint=i=>({x:(i%48+.5)*4-96,z:(Math.floor(i/48)+.5)*4-96});
export function outsidePortals(world){return world.tiles.flatMap((t,i)=>{const x=i%48,y=Math.floor(i/48);if(t.type!=='road'||x!==0&&x!==47&&y!==0&&y!==47)return[];const direction=x===0?[-1,0]:x===47?[1,0]:y===0?[0,-1]:[0,1],p=roadPoint(i);return[{id:i,...p,dx:direction[0],dz:direction[1],outside:{x:p.x+direction[0]*80,z:p.z+direction[1]*80}}];});}
const neighbors=i=>[i%48>0?i-1:-1,i%48<47?i+1:-1,i>=48?i-48:-1,i<2256?i+48:-1].filter(i=>i>=0);
export class Traffic {
 constructor(world,engine){this.engine=engine;this.spatial=new TrafficSpatial();this.agents=[];this.sequence=0;this.spawnClock=0;this.completed=0;this.time=0;this.rebuild(world);}
 rebuild(world){this.world=world;this.portals=outsidePortals(world);this.graph=new Map();this.samples=new Map();this.positions=new Map();this.routeCache=new Map();this.searchCache=new Map();
 for(const path of world.roadPaths||[]){const samples=this.engine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}));const mapping=new Map();for(const i of path.tiles){const p=roadPoint(i);let best=0,d=Infinity;samples.forEach((s,j)=>{const v=(s.x-p.x)**2+(s.z-p.z)**2;if(v<d){d=v;best=j}});mapping.set(i,best);if(!this.positions.has(i))this.positions.set(i,samples[best]);}this.samples.set(path.id,{samples,mapping,spec:this.engine.ROADS[path.type]});}
 for(let i=0;i<world.tiles.length;i++)if(world.tiles[i].type==='road'){const t=world.tiles[i];this.graph.set(i,neighbors(i).filter(j=>{if(world.tiles[j].type!=='road')return false;if(!this.engine.ROADS[t.roadType]?.oneway)return true;for(const id of t.pathIds||[]){const map=this.samples.get(id)?.mapping;if(map?.has(j))return map.get(j)>map.get(i);}return j>i;}));}
 const previousJunctions=this.junctions;this.junctions=new Junctions(this.graph,roadPoint,roadGeometry(world,this.engine).junctions);for(const j of this.junctions.items){const previous=previousJunctions?.items.find(old=>old.id===j.id);if(previous?.owner?.active)j.owner=previous.owner;}
 this.reverseGraph=new Map([...this.graph.keys()].map(i=>[i,[]]));for(const [i,links]of this.graph)for(const j of links)this.reverseGraph.get(j).push(i);
 this.trips=[];const pathsFrom=new Map(this.portals.map(p=>[p.id,this.search(p.id)])),pathsTo=new Map(this.portals.map(p=>[p.id,this.search(p.id,this.reverseGraph)]));
 for(let i=0;i<world.tiles.length;i++){const tile=world.tiles[i];if(!['residential','commercial','industrial','office'].includes(tile.type)||!tile.level||tile.construction)continue;const frontage=neighbors(i).filter(j=>this.graph.has(j)),lotPoint=roadPoint(i),nearest=[...this.portals].sort((a,b)=>Math.hypot(a.x-lotPoint.x,a.z-lotPoint.z)-Math.hypot(b.x-lotPoint.x,b.z-lotPoint.z));let found=false;for(const portal of nearest){const parents=pathsFrom.get(portal.id);for(const road of frontage){const inbound=this.trace(parents,road);if(!inbound)continue;for(const exit of nearest){const reverse=this.trace(pathsTo.get(exit.id),road);if(!reverse)continue;const outbound=reverse.reverse();const incoming=this.route(inbound,portal,true,i),outgoing=this.route(outbound,exit,false,i),lot=roadPoint(i),stop={x:(lot.x+incoming.at(-1).x)/2,z:(lot.z+incoming.at(-1).z)/2};this.trips.push({destination:i,kind:tile.type==='industrial'?'Delivery':tile.type==='residential'?'Resident visit':'Business visit',inbound:[...incoming,stop],outbound:[stop,...outgoing],cells:[inbound,outbound],roads:new Set([...inbound,...outbound])});found=true;break;}if(found)break;}if(found)break;}}
 // Keep valid trips across additions. Removed roads cancel only affected trips.
 for(const a of this.agents)if(a.active&&(!world.tiles[a.trip.destination]?.level||a.trip.cells.some(cells=>cells.some((i,k)=>!this.graph.has(i)||k<cells.length-1&&!this.graph.get(i).includes(cells[k+1])))))a.active=false;
 }
 search(start,graph=this.graph){if(graph===this.graph&&this.searchCache.has(start))return this.searchCache.get(start);const parents=new Map([[start,null]]),queue=[start];for(let k=0;k<queue.length;k++)for(const n of graph.get(queue[k])||[])if(!parents.has(n)){parents.set(n,queue[k]);queue.push(n)}if(graph===this.graph){if(this.searchCache.size>=128)this.searchCache.delete(this.searchCache.keys().next().value);this.searchCache.set(start,parents);}return parents;}
 trace(parents,end){if(!parents.has(end))return null;const path=[];for(let i=end;i!==null;i=parents.get(i))path.push(i);return path.reverse();}
 route(cells,portal,incoming,laneChoice=0){const points=[],offsets=[],laneOffsets=new Map();let previous=null;
 const add=(p,spec)=>{points.push(p);if(!laneOffsets.has(spec))laneOffsets.set(spec,laneOffset(spec,laneChoice));offsets.push(laneOffsets.get(spec));};
 const legacy=i=>({width:this.world.tiles[i].roadWidth===2?3.15:2.45,lanes:this.world.tiles[i].roadWidth===2?4:2,oneway:!!this.engine.ROADS[this.world.tiles[i].roadType]?.oneway});
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

 if(portal&&incoming){points.unshift(portal.outside,{x:portal.x+portal.dx*3,z:portal.z+portal.dz*3});offsets.unshift(offsets[0],offsets[0]);}else if(portal){points.push({x:portal.x+portal.dx*3,z:portal.z+portal.dz*3},portal.outside);offsets.push(offsets.at(-1),offsets.at(-1));}
 const lanePositions=transitionLaneOffsets(points,offsets);
 return smoothRoute(points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;return{x:p.x-dz/l*lanePositions[i],z:p.z+dx/l*lanePositions[i]}}));
 }
 between(from,to){const key=from+':'+to;if(this.routeCache.has(key))return this.routeCache.get(key);let result=null;const starts=neighbors(from).filter(i=>this.graph.has(i)),ends=neighbors(to).filter(i=>this.graph.has(i));for(const start of starts){const parents=this.search(start);for(const end of ends){const cells=this.trace(parents,end);if(cells){const center=this.route(cells,null,false,(Math.imul(from+1,31)^to)>>>0);result={cells,points:[roadPoint(from),...center,roadPoint(to)]};break;}}if(result)break;}this.routeCache.set(key,result);return result;}
 addAgent(){const a={active:false,x:0,z:0,heading:0};this.agents.push(a);return a;}
 begin(a){const choices=this.residentsEnabled?this.trips.filter(t=>this.world.tiles[t.destination].type!=='residential'):this.trips;if(!choices.length||this.residentsEnabled&&this.agents.filter(a=>a.active&&!a.residentId&&a.kind!=='bus').length>=6)return false;const trip=choices[this.sequence++%choices.length],start=trip.inbound[0];if(this.agents.some(b=>b!==a&&b.active&&Math.hypot(b.x-start.x,b.z-start.z)<3))return false;Object.assign(a,{hold:false,previousX:undefined,previousZ:undefined,speed:0,stopTime:0,stopJunction:null,residentId:null,arrived:false,active:true,trip,phase:'inbound',points:trip.inbound,segment:0,distance:0,dwell:0,x:start.x,z:start.z});return true;}
 update(dt){if(dt<=0)return;for(let left=dt;left>1e-8;left-=.05)this.step(Math.min(.05,left));}
 step(dt){this.time+=dt;this.spawnClock+=dt;if(this.spawnClock>=2-1e-8){const free=this.agents.find(a=>!a.active&&a.kind!=='bus');if(free&&this.begin(free))this.spawnClock=0;else this.spawnClock=Math.min(this.spawnClock,2);}
 const indexed=this.agents.length>=48;if(indexed)this.spatial.reset(this.agents);
 for(const a of this.agents){if(!a.active||a.hold)continue;if(a.dwell>0){a.dwell-=dt;if(a.dwell<=0){a.phase='outbound';a.points=a.trip.outbound;a.segment=0;a.distance=0;a.speed=0;}continue;}
 const p=a.points[a.segment],q=a.points[a.segment+1];if(!q){if(a.phase==='inbound')a.dwell=4;else{a.active=false;a.arrived=true;this.completed++;}continue;}
 const heading=Math.atan2(q.x-p.x,q.z-p.z),forward={x:Math.sin(heading),z:Math.cos(heading)};
 let clearance=this.junctions.limit(a,this.time,dt,this.world.trafficPolicy||'signals',this.agents);
 for(const b of (indexed?this.spatial.corridor(a,forward):this.agents)){if(b===a||!b.active||b.dwell)continue;const dx=b.x-a.x,dz=b.z-a.z,ahead=dx*forward.x+dz*forward.z,lateral=Math.abs(dx*forward.z-dz*forward.x);if(ahead>0&&lateral<.65&&Math.cos(b.heading-heading)>.3&&ahead-((a.length||.9)+(b.length||.9))*.5-.75<clearance){clearance=Math.max(0,ahead-((a.length||.9)+(b.length||.9))*.5-.75);a.waitReason='Vehicle queue';}}
 // A car queued outside the junction must not reserve space ahead of its leader.
 if(a.waitReason==='Vehicle queue'&&clearance<.2)for(const gate of this.junctions.route(a.points).gates){const j=gate.junction;if(j.owner===a&&Math.hypot(a.x-j.x,a.z-j.z)>j.radius)j.owner=null;}
 const tile=this.world.tiles[Math.floor((a.z+96)/4)*48+Math.floor((a.x+96)/4)],cruise=tile?.roadType==='highway'?8:tile?.roadType==='gravel'?3:5;
 const target=Math.min(cruise,Math.sqrt(Math.max(0,clearance)*6));a.speed=Math.min(target,(a.speed||0)+dt*3);let move=Math.min(dt*a.speed,clearance);if(move>0.02)a.waitReason='';
 while(move>1e-8&&a.active){const p=a.points[a.segment],q=a.points[a.segment+1];if(!q){if(a.phase==='inbound')a.dwell=4;else{a.active=false;a.arrived=true;this.completed++;}break;}const length=Math.hypot(q.x-p.x,q.z-p.z);if(length<.001){a.segment++;continue;}const step=Math.min(move,length-a.distance);a.distance+=step;move-=step;const f=a.distance/length;a.x=p.x+(q.x-p.x)*f;a.z=p.z+(q.z-p.z)*f;a.heading=Math.atan2(q.x-p.x,q.z-p.z);if(a.distance>=length-1e-6){a.segment++;a.distance=0;}}
 if(indexed)this.spatial.move(a);
 }
 }
 get summary(){const moving=this.agents.filter(a=>a.active&&!a.dwell);return {junctions:this.junctions.items.length,queued:moving.filter(a=>(a.speed||0)<.2&&a.waitReason).length,averageSpeed:moving.length?moving.reduce((s,a)=>s+(a.speed||0),0)/moving.length:0};}
 get active(){return this.agents.filter(a=>a.active).length;}
}
