// Shared identities for legacy tile buildings and independent zoning parcels.
(function(root){
'use strict';
const Z=typeof module!=='undefined'?require('./zoning-layout.js'):root.BoroughZoning;
const parcelId=id=>typeof id==='string'&&/^parcel-[1-9]\d*$/.test(id);
function parcel(world,id){return parcelId(id)&&Object.hasOwn(world.development?.parcels||{},id)?world.development.parcels[id]:undefined;}
function get(world,id){return Number.isInteger(id)&&id>=0&&id<2304?world.tiles[id]:parcel(world,id)?.occupant;}
function entries(world){const result=[];world.tiles.forEach((tile,id)=>{if(tile.facilityOwner!==undefined&&tile.facilityOwner!==id||tile.zoneOwner!==undefined&&tile.zoneOwner!==id)return;result.push([id,tile]);});for(const [id,p]of Object.entries(world.development?.parcels||{}))if(parcelId(id)&&p.occupant)result.push([id,p.occupant]);return result;}
function point(world,id){if(Number.isInteger(id)&&id>=0&&id<2304)return {x:(id%48+.5)*4-96,z:(Math.floor(id/48)+.5)*4-96};const p=parcel(world,id);return p?{x:p.frame.cx,z:p.frame.cz}:null;}
function frontage(world,id,graph){
 if(Number.isInteger(id)&&id>=0&&id<2304)return [id%48>0?id-1:-1,id%48<47?id+1:-1,id>=48?id-48:-1,id<2256?id+48:-1].filter(i=>i>=0&&graph.has(i));
 const p=parcel(world,id),front=p?.frame.frontage;if(!front||!graph.has(front.roadIndex)||world.tiles[front.roadIndex].roadType==='highway')return [];
 if(front.pathId&&!world.roadPaths?.some(path=>path.id===front.pathId&&path.tiles.includes(front.roadIndex)))return [];
 return [front.roadIndex];
}
function contains(frame,point){const x=point.x-frame.cx,z=point.z-frame.cz,c=Math.cos(frame.angle),s=Math.sin(frame.angle);return Math.abs(x*c-z*s)<frame.width/2-1e-6&&Math.abs(x*s+z*c)<frame.depth/2-1e-6;}
const spatialCache=new WeakMap();
function spatial(world){const state=world.development,cached=spatialCache.get(world),revision=state?.revision||0;if(cached&&cached.state===state&&cached.revision===revision)return cached.bins;const bins=new Map();for(const p of Object.values(state?.parcels||{}))if(p.occupant){const f=p.frame,c=Math.abs(Math.cos(f.angle)),s=Math.abs(Math.sin(f.angle)),dx=(f.width*c+f.depth*s)/2,dz=(f.width*s+f.depth*c)/2;for(let z=Math.floor((f.cz-dz)/4);z<=Math.floor((f.cz+dz)/4);z++)for(let x=Math.floor((f.cx-dx)/4);x<=Math.floor((f.cx+dx)/4);x++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}}spatialCache.set(world,{state,revision,bins});return bins;}
function near(world,x,z,radius){const bins=spatial(world),result=new Set();for(let iz=Math.floor((z-radius)/4);iz<=Math.floor((z+radius)/4);iz++)for(let ix=Math.floor((x-radius)/4);ix<=Math.floor((x+radius)/4);ix++)for(const p of bins.get(ix+','+iz)||[])result.add(p);return [...result];}
function overlaps(world,frame){const radius=Math.hypot(frame.width,frame.depth)/2;return near(world,frame.cx,frame.cz,radius).some(p=>Z.overlaps(frame,p.frame));}
function at(world,x,z){return (spatial(world).get(Math.floor(x/4)+','+Math.floor(z/4))||[]).filter(p=>contains(p.frame,{x,z}));}
function blocked(world,x,z,except){return at(world,x,z).some(p=>p.id!==except);}
function renderParcel(world,id){const p=parcel(world,id);if(!p?.occupant)return null;const index=Math.floor((p.frame.cz+96)/4)*48+Math.floor((p.frame.cx+96)/4);return {owner:id,index,entityId:id,entitySeed:seed(id),definition:p.occupant,width:p.width,depth:p.depth,oriented:p.frame,key:id+':'+JSON.stringify(p.frame)};}
function seed(id){if(Number.isInteger(id))return id;let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const api={parcelId,parcel,get,entries,point,frontage,contains,seed,at,near,overlaps,blocked,renderParcel};root.BoroughBuildings=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
