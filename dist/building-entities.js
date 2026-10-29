// Shared identities for legacy tile buildings and independent zoning parcels.
(function(root){
'use strict';
const G=typeof module!=='undefined'?require('./map-grid.js'):root.BoroughGrid;
const RoadTypes=typeof module!=='undefined'?require('./road-types.js'):root.BoroughRoadTypes;
const RoadCurves=typeof module!=='undefined'?require('./road-curves.js'):root.BoroughRoadCurves;
const Z=typeof module!=='undefined'?require('./zoning-layout.js'):root.BoroughZoning;
const parcelId=id=>typeof id==='string'&&/^parcel-[1-9]\d*$/.test(id);
function parcel(world,id){return parcelId(id)&&Object.hasOwn(world.development?.parcels||{},id)?world.development.parcels[id]:undefined;}
function get(world,id){return Number.isInteger(id)&&id>=0&&id<G.count?world.tiles[id]:parcel(world,id)?.occupant;}
function entries(world){const result=[];world.tiles.forEach((tile,id)=>{if(tile.facilityOwner!==undefined&&tile.facilityOwner!==id||tile.zoneOwner!==undefined&&tile.zoneOwner!==id)return;result.push([id,tile]);});for(const [id,p]of Object.entries(world.development?.parcels||{}))if(parcelId(id)&&p.occupant)result.push([id,p.occupant]);return result;}
function point(world,id){if(Number.isInteger(id)&&id>=0&&id<G.count)return {x:(id%G.n+.5)*4-G.half,z:(Math.floor(id/G.n)+.5)*4-G.half};const p=parcel(world,id);return p?{x:p.frame.cx,z:p.frame.cz}:null;}
// Old parcels retain their original frontage coordinates when a legacy street
// is upgraded. Resolve that address geometrically without rewriting the save.
function frontageSource(world,front){
 if(front.pathId)return front.pathId;
 const tile=world.tiles[front.roadIndex];if(!tile?.pathIds?.length||tile.legacyRoad)return null;
 if(!Number.isFinite(front.x)||!Number.isFinite(front.z))return false;
 const p={x:(front.x+G.half)/4-.5,y:(front.z+G.half)/4-.5};let best=.025,source=false;
 for(const road of world.roadPaths||[]){if(!tile.pathIds.includes(road.id))continue;const samples=RoadCurves.sample(road.controls);
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);if(d<best){best=d;source=road.id}}
 }return source;
}
function frontage(world,id,graph){
 if(Number.isInteger(id)&&id>=0&&id<G.count)return [id%G.n>0?id-1:-1,id%G.n<G.last?id+1:-1,id>=G.n?id-G.n:-1,id<G.edgeRow?id+G.n:-1].filter(i=>i>=0&&graph.has(i));
 const p=parcel(world,id),front=p?.frame.frontage;if(!front||!graph.has(front.roadIndex))return [];
 const source=frontageSource(world,front);if(source===false||graph.hasSource&&!graph.hasSource(front.roadIndex,source))return [];
 const road=source?world.roadPaths?.find(path=>path.id===source&&path.tiles.includes(front.roadIndex)):null;
 if(source&&!road||RoadTypes.isLimitedAccess(road?.type??world.tiles[front.roadIndex].roadType))return [];
 return [front.roadIndex];
}
function contains(frame,point){const x=point.x-frame.cx,z=point.z-frame.cz,c=Math.cos(frame.angle),s=Math.sin(frame.angle);return Math.abs(x*c-z*s)<frame.width/2-1e-6&&Math.abs(x*s+z*c)<frame.depth/2-1e-6;}
const spatialCache=new WeakMap();
function spatial(world){const state=world.development,cached=spatialCache.get(world),revision=state?.revision||0;if(cached&&cached.state===state&&cached.revision===revision)return cached.bins;const bins=new Map();for(const p of Object.values(state?.parcels||{}))if(p.occupant){const f=p.frame,c=Math.abs(Math.cos(f.angle)),s=Math.abs(Math.sin(f.angle)),dx=(f.width*c+f.depth*s)/2,dz=(f.width*s+f.depth*c)/2;for(let z=Math.floor((f.cz-dz)/4);z<=Math.floor((f.cz+dz)/4);z++)for(let x=Math.floor((f.cx-dx)/4);x<=Math.floor((f.cx+dx)/4);x++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}}spatialCache.set(world,{state,revision,bins});return bins;}
function near(world,x,z,radius){const bins=spatial(world),result=new Set();for(let iz=Math.floor((z-radius)/4);iz<=Math.floor((z+radius)/4);iz++)for(let ix=Math.floor((x-radius)/4);ix<=Math.floor((x+radius)/4);ix++)for(const p of bins.get(ix+','+iz)||[])result.add(p);return [...result];}
function overlaps(world,frame){const radius=Math.hypot(frame.width,frame.depth)/2;return near(world,frame.cx,frame.cz,radius).some(p=>Z.overlaps(frame,p.frame));}
function at(world,x,z){return (spatial(world).get(Math.floor(x/4)+','+Math.floor(z/4))||[]).filter(p=>contains(p.frame,{x,z}));}
function blocked(world,x,z,except){return at(world,x,z).some(p=>p.id!==except);}
function renderParcel(world,id){const p=parcel(world,id);if(!p?.occupant)return null;const index=Math.floor((p.frame.cz+G.half)/4)*G.n+Math.floor((p.frame.cx+G.half)/4);return {owner:id,index,entityId:id,entitySeed:seed(id),definition:p.occupant,width:p.width,depth:p.depth,oriented:p.frame,key:id+':'+JSON.stringify(p.frame)};}
function seed(id){if(Number.isInteger(id))return id;let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
parcel=G.bind(parcel);
get=G.bind(get);
entries=G.bind(entries);
point=G.bind(point);
frontageSource=G.bind(frontageSource);
frontage=G.bind(frontage);
spatial=G.bind(spatial);
near=G.bind(near);
overlaps=G.bind(overlaps);
at=G.bind(at);
blocked=G.bind(blocked);
renderParcel=G.bind(renderParcel);

const api={parcelId,parcel,get,entries,point,frontage,frontageSource,contains,seed,at,near,overlaps,blocked,renderParcel};root.BoroughBuildings=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
