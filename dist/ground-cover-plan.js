import {finishBuild} from './build-scheduler.js?v=151.1';
import {roadGeometry,transitionWidth} from './road-junction-plan.js?v=151.1';
import './building-entities.js?v=151.1';
import './roundabout-state.js?v=151.1';
import {terrainNoise} from './terrain-field.js?v=151.1';
const Buildings=globalThis.BoroughBuildings;
export function coverRandom(seed,index){let s=(Math.imul(index+1,2654435761)^(seed>>>0))>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
// This mask follows the same sampled road widths, tapers and path centre lines
// as the rendered pavement. A road tile is not a square vegetation exclusion.
export function coverLand(world,engine=globalThis.CityEngine){
 const bins=new Map(),size=8,put=(item,x0,x1,z0,z1)=>{for(let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)for(let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++){const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(item);}};
 const segment=(a,b,width)=>{const reach=width+1.5;put({a,b,width},Math.min(a.x,b.x)-reach,Math.max(a.x,b.x)+reach,Math.min(a.z,b.z)-reach,Math.max(a.z,b.z)+reach);};
 if(engine){const geometry=roadGeometry(world,engine);for(const road of geometry.roads)for(let i=1;i<road.stations.length;i++){const a=road.stations[i-1],b=road.stations[i],width=Math.max(transitionWidth(road,geometry.tapers.get(road.id),a.distance),transitionWidth(road,geometry.tapers.get(road.id),b.distance))/2+(road.spec.sidewalk?.42:.12);segment(a,b,width);}
  for(const j of geometry.junctions){const r=j.roundabout?j.roundabout.outer+.45:j.radius+.35;put({center:j,radius:r},j.x-r-1.5,j.x+r+1.5,j.z-r-1.5,j.z+r+1.5);}
  for(const path of world.walkPaths||[]){const points=engine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}));for(let i=1;i<points.length;i++)segment(points[i-1],points[i],.325);}
 }
 for(let i=0;i<world.tiles.length;i++){const t=world.tiles[i],gx=i%48,gz=Math.floor(i/48);if(t.type!=='road'||gx!==0&&gx!==47&&gz!==0&&gz!==47)continue;const a={x:(gx+.5)*4-96,z:(gz+.5)*4-96},dx=gx===0?-1:gx===47?1:0,dz=dx?0:gz===0?-1:1;segment(a,{x:a.x+dx*80,z:a.z+dz*80},(engine?.ROADS[t.roadType]?.width||2.45)/2+.5);}
 const clearance=(x,z)=>{let result=Infinity;for(const item of bins.get(Math.floor(x/size)+':'+Math.floor(z/size))||[]){if(item.center){result=Math.min(result,Math.hypot(x-item.center.x,z-item.center.z)-item.radius);continue;}const {a,b,width}=item,dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));result=Math.min(result,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)-width);}return result;};
 const available=(x,z,radius=0)=>{for(let gz=Math.max(0,Math.floor((z-radius+96)/4));gz<=Math.min(47,Math.floor((z+radius+96)/4));gz++)for(let gx=Math.max(0,Math.floor((x-radius+96)/4));gx<=Math.min(47,Math.floor((x+radius+96)/4));gx++){const tile=world.tiles[gz*48+gx];if(tile.ground==='water'||tile.construction||tile.type&&!['road','path'].includes(tile.type)||!engine&&tile.type)return false;}
  if(Buildings.blocked(world,x,z)||radius>0&&Buildings.overlaps(world,{cx:x,cz:z,width:radius*2,depth:radius*2,angle:0})||globalThis.BoroughRoundabouts.blocked(world,{cx:x,cz:z,width:radius*2,depth:radius*2},.15))return false;return clearance(x,z)>radius;
 };return {clearance,available};
}
export function coverPlan(world,height,wetness,engine=globalThis.CityEngine){return finishBuild(coverPlanSteps(world,height,wetness,engine));}
export function* coverPlanSteps(world,height,wetness,engine=globalThis.CityEngine){
 const land=coverLand(world,engine),clumps=[];
 for(let i=0;i<11500;i++){if(i%64===0)yield;const rand=coverRandom(world.seed,i),x=rand()*330-165,z=rand()*330-165,wet=wetness(world,x,z);if(wet>.38||!land.available(x,z,.16))continue;
  const patch=terrainNoise(x*.043,z*.043,world.seed+9);if(patch<.36)continue;const y=height(world,x,z),sx=(height(world,x+.2,z)-y)/.2,sz=(height(world,x,z+.2)-y)/.2;if(Math.hypot(sx,sz)>.9)continue;
  const clearance=land.clearance(x,z),kind=wet>.06?'reed':clearance<1.05?'verge':'meadow',dry=terrainNoise(x*.017,z*.017,world.seed+51),size=kind==='reed'?.32+rand()*.23:kind==='verge'?.018+rand()*.025:.055+rand()*.065;
  if(!land.available(x,z,size*.56+.15))continue;clumps.push({id:i,x,z,y,sx,sz,kind,dry,height:size,seed:Math.floor(rand()*0xffffffff)});
 }return {clumps,land};
}
