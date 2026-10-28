// Pure, deterministic lot planning. One world unit represents roughly five metres.
import './road-curves.js?v=141';
const RoadCurves=globalThis.BoroughRoadCurves;
const pathIndices=new WeakMap(),pathSamples=new WeakMap();
function roadsById(world){
 const paths=world.roadPaths||[],cached=pathIndices.get(world);
 if(cached?.paths===paths&&cached.length===paths.length)return cached.index;
 const index=new Map(paths.map(path=>[path.id,path]));
 pathIndices.set(world,{paths,length:paths.length,index});return index;
}
function segments(path){
 if(pathSamples.has(path))return pathSamples.get(path);
 const points=RoadCurves.sample(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}));
 pathSamples.set(path,points);return points;
}
export function lotPlan(world,index,parcel){
 const tile=parcel?.definition||world.tiles[index],width=parcel?.width||1,depth=parcel?.depth||1;
 let cx=(index%48+.5)*4-96+(width-1)*2,cz=(Math.floor(index/48)+.5)*4-96+(depth-1)*2;
 let seed=(Math.imul((parcel?.entitySeed??index)+17,73856093)^Math.imul(world.seed,19349663))>>>0;
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const variation=next(),style=Math.floor(next()*6),tone=Math.floor(next()*5);
 let nearest=null,distance=Infinity;const nearbyPaths=new Set();
 const gx=index%48,gy=Math.floor(index/48);
 for(let y=Math.max(0,gy-4);y<=Math.min(47,gy+depth+3);y++)for(let x=Math.max(0,gx-4);x<=Math.min(47,gx+width+3);x++){
  const road=world.tiles[y*48+x];if(road.type!=='road')continue;for(const id of road.pathIds||[])nearbyPaths.add(id);if(road.pathIds?.length&&!road.legacyRoad)continue;const dx=(x+.5)*4-96-cx,dz=(y+.5)*4-96-cz,d=dx*dx+dz*dz;
  if(d<distance){distance=d;nearest={dx,dz,roadIndex:y*48+x};}
 }
 let angle=!nearest?0:Math.abs(nearest.dx)>Math.abs(nearest.dz)?(nearest.dx<0?-Math.PI/2:Math.PI/2):nearest.dz<0?Math.PI:0;
 const paths=roadsById(world);let frontage=nearest?{roadIndex:nearest.roadIndex,x:cx+nearest.dx,z:cz+nearest.dz}:null;
 for(const id of nearbyPaths){const path=paths.get(id);if(!path)continue;const points=segments(path);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],vx=b.x-a.x,vz=b.z-a.z,length2=vx*vx+vz*vz;if(length2<1e-10)continue;
   const t=Math.max(0,Math.min(1,((cx-a.x)*vx+(cz-a.z)*vz)/length2)),x=a.x+t*vx,z=a.z+t*vz,d=(x-cx)**2+(z-cz)**2;
   if(d>=distance)continue;distance=d;const side=(x-cx)*(-vz)+(z-cz)*vx>=0?1:-1;
   // The front (+Z) faces the road normal, keeping the facade parallel to its tangent.
   angle=Math.atan2(-vz*side,vx*side);frontage={pathId:id,x,z};
  }
 }
 if(parcel?.oriented){({cx,cz,angle,frontage}=parcel.oriented);}
 if(parcel?.facility)angle=parcel.rotation*Math.PI/2;
 const sin=Math.abs(Math.sin(angle)),cos=Math.abs(Math.cos(angle)),rotated=sin>.70710678;
 let lotWidth=(rotated?depth:width)*4,lotDepth=(rotated?width:depth)*4;
 // Fit the rotated envelope within the owned parcel: no overlap with roads or neighbours.
 const fit=Math.min(1,width*4/(cos*lotWidth+sin*lotDepth),depth*4/(sin*lotWidth+cos*lotDepth));
 lotWidth*=fit;lotDepth*=fit;if(parcel?.oriented){lotWidth=parcel.oriented.width;lotDepth=parcel.oriented.depth;}
 const type=tile.type,density=tile.density||'high',low=type==='residential'&&(density==='low'||tile.building==='townhouse');
 let floors;
 if(low)floors=style===0?1:2;
 else if(type==='commercial'&&density==='low')floors=style%3===0?2:1;
 else if(type==='industrial')floors=1;
 else if(type==='office'&&density==='low')floors=2+style%2;
 else if(density==='medium'||tile.building==='apartments')floors=3+style%4;
 else{const large=width*depth>1;floors=type==='office'?(large?8:5)+Math.floor(variation*16):(large?5:3)+Math.floor(variation*10);}
 return{entityId:parcel?.entityId,facility:!!parcel?.facility,oriented:!!parcel?.oriented,ownedCells:parcel?.oriented&&!parcel.entityId?parcel.members:undefined,index,type,density,low,style,tone,variation,floors,angle,frontage,cx,cz,lotWidth,lotDepth,parcelWidth:parcel?.entityId?lotWidth:width*4,parcelDepth:parcel?.entityId?lotDepth:depth*4,seed:seed>>>0,level:tile.level};
}
