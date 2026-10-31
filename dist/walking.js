import './map-grid.js?v=171';
const G=globalThis.BoroughGrid;
import {pedestrianNetwork} from './pedestrian-network.js?v=171';
import './building-entities.js?v=171';
const Buildings=globalThis.BoroughBuildings;
import {roadPoint} from './traffic.js?v=171';
import {visualParcels} from './parcels.js?v=171';
import {WalkingSearch} from './walking-search.js?v=171';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const cell=p=>Math.floor((p.z+G.half)/4)*G.n+Math.floor((p.x+G.half)/4);
export function sidewalkPosition(traffic,i){const p=traffic.positions.get(i)||roadPoint(i),neighbors=traffic.graph.get(i)||[],q=neighbors.map(j=>traffic.positions.get(j)||roadPoint(j)).find(q=>distance(p,q)>.01);if(!q)return p;let dx=q.x-p.x,dz=q.z-p.z;if(dx<0||Math.abs(dx)<.001&&dz<0){dx=-dx;dz=-dz;}const length=Math.hypot(dx,dz)||1,width=traffic.engine.ROADS[traffic.world.tiles[i].roadType]?.width||2.45,offset=width/2+.22;return {x:p.x-dz/length*offset,z:p.z+dx/length*offset};}
export class Walking {
 constructor(world,traffic){this.world=world;this.traffic=traffic;this.active=new Map();this.version=0;this.rebuild();}
 clearLine(a,b,ignore=new Set(),roadAccess=false){
  let escape=roadAccess==='escape'&&this.network?.blocked(a);
  const steps=Math.max(1,Math.ceil(distance(a,b)/.35));for(let k=0;k<=steps;k++){const p={x:a.x+(b.x-a.x)*k/steps,z:a.z+(b.z-a.z)*k/steps};if(Math.abs(p.x)>=G.half||Math.abs(p.z)>=G.half)return false;if(this.roundabouts?.some(j=>distance(p,j)<j.roundabout.outer+.02))return false;const inRoad=this.network?.blocked(p);if(roadAccess!=='network'&&inRoad&&!escape)return false;if(!inRoad)escape=false;const i=cell(p),t=this.world.tiles[i];for(const parcel of this.parcelBins?.get(i)||[])if(!ignore.has(parcel.id)&&Buildings.contains(parcel.frame,p))return false;if(ignore.has(i))continue;if(!t||t.construction)return false;if(t.type==='road'){if(this.traffic.engine.ROADS[t.roadType||'street']?.sidewalk===false)return false;}else if(t.ground==='water'||t.type&&t.type!=='path')return false;}return true;
 }
 rebuild(){this.roundabouts=(this.traffic.roadJunctions||[]).filter(j=>j.roundabout);this.developmentRevision=this.world.development?.revision||0;this.version++;this.traffic.crossings?.rebuild();this.network=pedestrianNetwork(this.world,this.traffic.engine);this.nodes=[];this.bins=new Map();this.cache=new Map();this.parcels=visualParcels(this.world);this.parcelBins=new Map();
  for(const p of Object.values(this.world.development?.parcels||{}))if(p.occupant){const f=p.frame,c=Math.abs(Math.cos(f.angle)),s=Math.abs(Math.sin(f.angle)),x=(f.width*c+f.depth*s)/2,z=(f.width*s+f.depth*c)/2;for(let yy=Math.max(0,Math.floor((f.cz-z+G.half)/4));yy<=Math.min(G.last,Math.floor((f.cz+z+G.half)/4));yy++)for(let xx=Math.max(0,Math.floor((f.cx-x+G.half)/4));xx<=Math.min(G.last,Math.floor((f.cx+x+G.half)/4));xx++){const i=yy*G.n+xx;if(!this.parcelBins.has(i))this.parcelBins.set(i,[]);this.parcelBins.get(i).push(p);}}
  const locations=new Map();
  const add=(p,kind)=>{const location=kind+':'+p.x.toFixed(5)+':'+p.z.toFixed(5);if(locations.has(location))return locations.get(location);const id=this.nodes.length,node={...p,id,kind,links:new Map()};this.nodes.push(node);locations.set(location,node);const key=Math.floor(p.x/3)+':'+Math.floor(p.z/3);if(!this.bins.has(key))this.bins.set(key,[]);this.bins.get(key).push(node);return node;};
  const link=(a,b,roadAccess=false)=>{if(a===b||a.links.has(b.id)||!this.clearLine(a,b,new Set(),roadAccess))return;const cost=distance(a,b);a.links.set(b.id,cost);b.links.set(a.id,cost);};
  const networkNodes=this.network.nodes.map(n=>add(n,n.kind));for(const edge of this.network.edges)link(networkNodes[edge.a],networkNodes[edge.b],'network');
  for(const path of this.world.walkPaths||[]){let previous;for(const p of this.traffic.engine.sampleRoad(path.controls)){const node=add({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half},'path');if(previous)link(previous,node,'network');previous=node;}}
  for(const node of this.nodes)if(node.kind==='path')for(const other of this.near(node,3)){const radius=other.kind==='street'?2.8:.65;if(other.id!==node.id&&distance(node,other)<=radius)link(node,other,'escape');}
 }
 near(p,radius){const out=[];for(let x=Math.floor((p.x-radius)/3);x<=Math.floor((p.x+radius)/3);x++)for(let z=Math.floor((p.z-radius)/3);z<=Math.floor((p.z+radius)/3);z++)for(const node of this.bins.get(x+':'+z)||[])if(distance(node,p)<=radius)out.push(node);return out;}
 ignored(indices){const result=new Set();for(const i of indices){if(Buildings.parcelId(i))result.add(i);else if(Number.isInteger(i))for(const j of this.parcels.get(i)?.members||[i])result.add(j);}return result;}
 route(from,to,allowed=[]){const address=v=>typeof v==='number'||typeof v==='string',a=address(from)?Buildings.point(this.world,from):from,b=address(to)?Buildings.point(this.world,to):to;if(!a||!b||![a.x,a.z,b.x,b.z].every(Number.isFinite))return null;const key=JSON.stringify([address(from)?from:[a.x,a.z],address(to)?to:[b.x,b.z],allowed]);if(this.cache.has(key))return this.cache.get(key);
  const ignore=this.ignored([from,to,...allowed]),starts=this.near(a,8).filter(n=>this.clearLine(a,n,ignore,address(from)?false:'escape')),ends=this.near(b,8).filter(n=>this.clearLine(n,b,ignore));
  this.searchWorkspace ||= new WalkingSearch();const path=this.searchWorkspace.find(this.nodes,starts,ends,a,b,true);
  let result=null;if(path){const points=[a,...path.ids.map(i=>this.nodes[i]),b].map(p=>({x:p.x,z:p.z}));result={points:points.filter((p,i)=>!i||distance(p,points[i-1])>1e-6),length:path.length};if(result.points.length===1)result.points.push({...b});}
  if(this.cache.size>=4096)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,result);return result;
 }
 canReach(a,b){return !!this.route(a,b);}
 request(r,to,purpose,maxLength=120){const route=this.route(r.location,to);if(!route||route.length>maxLength)return false;r.walk={from:r.location,to,purpose,...Buildings.point(this.world,r.location),heading:0};r.activity=purpose==='work'?'Walking to work':purpose==='shop'?'Walking to shops':'Walking home';this.active.set(r.id,{r,route,segment:0,version:this.version});return true;}
 advance(state,route,progress,dt){let remaining=dt*.28;while(remaining>1e-8&&progress.segment<route.points.length-1){const clearance=this.traffic.crossings?.walkLimit(state,route.points,progress.segment)??Infinity;if(clearance<=1e-8)break;const target=route.points[progress.segment+1],d=distance(state,target),step=Math.min(d,remaining,clearance);state.heading=Math.atan2(target.x-state.x,target.z-state.z);if(d<1e-8){progress.segment++;continue;}state.x+=(target.x-state.x)*step/d;state.z+=(target.z-state.z)*step/d;remaining-=step;if(step>=d-1e-8){state.x=target.x;state.z=target.z;progress.segment++;}}const arrived=progress.segment>=route.points.length-1;if(arrived)this.traffic.crossings?.release(state);return arrived;}
 sync(){const people=this.world.citizens?.residents;if(people===this.peopleSource)return;this.peopleSource=people;const ids=new Set();for(const r of people||[])if(r.walk){ids.add(r.id);const entry=this.active.get(r.id);if(!entry)this.active.set(r.id,{r,version:-1});else entry.r=r;}for(const id of this.active.keys())if(!ids.has(id))this.active.delete(id);}
 update(dt){if(dt<=0)return;if(this.developmentRevision!==(this.world.development?.revision||0))this.rebuild();this.sync();for(const [id,entry]of this.active){const r=entry.r,t=r.walk;if(!t){this.active.delete(id);continue;}
  if(!Buildings.get(this.world,t.to)?.level){t.to=t.from;t.purpose='home';entry.version=-1;}
  if(entry.version!==this.version){entry.route=this.route(t,t.to,[t.from,t.to]);entry.segment=0;entry.version=this.version;}
  if(!entry.route){r.activity='Waiting for walking access';continue;}
  if(this.advance(t,entry.route,entry,dt)){r.location=t.to;r.activity=t.purpose==='work'?'Working':t.purpose==='shop'?'Shopping':'Home';if(t.purpose==='work')r.workdays++;if(t.purpose==='shop')r.shopping++;r.nextAt=(this.world.citizens?.time||0)+(t.purpose==='work'?24:t.purpose==='shop'?8:20)+r.id%7;delete r.walk;this.active.delete(id);}else r.activity=t.waitReason||(t.purpose==='work'?'Walking to work':t.purpose==='shop'?'Walking to shops':'Walking home');
 }
 }
}

Walking=G.bindClass(Walking);
