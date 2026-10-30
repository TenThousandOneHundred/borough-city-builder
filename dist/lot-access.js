import './map-grid.js?v=169';
const G=globalThis.BoroughGrid;
import './road-types.js?v=169';
import './building-entities.js?v=169';
const Buildings=globalThis.BoroughBuildings;
import * as THREE from './vendor/three.module.js';
import {SIDEWALK_HEIGHT} from './road-profile.js?v=169';

// Connect an owned parcel edge to its actual street sidewalk. This only builds
// render geometry; occupancy, pedestrian routing and save data remain untouched.
export function lotAccess(world,plan,base,engine,height,roadHeight,surfaceHeight=null){
 const points=Array.isArray(plan.accessPoints)?plan.accessPoints:[{x:0}];
 const parts=points.map(p=>accessStrip(world,plan,base,engine,height,roadHeight,p.x,p.width,surfaceHeight)).filter(Boolean);
 if(!parts.length)return null;if(parts.length===1)return parts[0];
 const positions=[],uv=[],indices=[];for(const part of parts){const offset=positions.length/3;positions.push(...part.attributes.position.array);uv.push(...part.attributes.uv.array);indices.push(...Array.from(part.index.array,i=>i+offset));part.dispose();}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData={connections:parts.length};return geometry;
}
function accessStrip(world,plan,base,engine,height,roadHeight,centre=0,requestedWidth,surfaceHeight=null){
 const f=plan.frontage;if(!f)return null;
 let width,sidewalk,raise;
 if(f.pathId){const path=world.roadPaths?.find(p=>p.id===f.pathId),spec=path&&engine.ROADS[path.type];if(!spec?.sidewalk)return null;width=spec.width;sidewalk=.38;raise=SIDEWALK_HEIGHT;}
 else{const road=world.tiles[f.roadIndex];if(road?.type!=='road'||road.ground==='water')return null;width=road.roadWidth===2?3.15:2.45;sidewalk=.42;raise=SIDEWALK_HEIGHT;}
 const dx=Math.sin(plan.angle),dz=Math.cos(plan.angle),tx=dz,tz=-dx;
 // Beyond a road endpoint, a normal-facing strip would miss the sidewalk.
 if(Math.abs((f.x-plan.cx)*tx+(f.z-plan.cz)*tz)>.35)return null;
 const halfWidth=plan.parcelWidth/2-.035,halfDepth=plan.parcelDepth/2-.035;
 const reach=(f.x-plan.cx)*dx+(f.z-plan.cz)*dz-width/2-sidewalk+.025;
 if(reach<=0)return null;
 const startAt=offset=>plan.oriented?plan.lotDepth/2-.07:Math.min(Math.abs(dx)>1e-8?(Math.sign(dx)*halfWidth-tx*offset)/dx:Infinity,Math.abs(dz)>1e-8?(Math.sign(dz)*halfDepth-tz*offset)/dz:Infinity)-.035;
 const centreStart=startAt(centre),gap=reach-centreStart;
 if(gap<.04||gap>6)return null;
 const desired=requestedWidth||(plan.low?.48:plan.type==='industrial'?.9:Math.min(2.8,plan.lotWidth*.7));
 const owned=(x,z)=>Math.abs(x-plan.cx)<=plan.parcelWidth/2+.01&&Math.abs(z-plan.cz)<=plan.parcelDepth/2+.01;
 const allowed=(x,z)=>{
  const gx=Math.floor((x+G.half)/4),gy=Math.floor((z+G.half)/4);if(gx<0||gy<0||gx>=G.n||gy>=G.n)return false;
  if(Buildings.blocked(world,x,z,plan.entityId))return false;const index=gy*G.n+gx,t=world.tiles[index];if(t.ground==='water')return false;if(plan.ownedCells?plan.ownedCells.includes(index):owned(x,z))return true;
  if(t.type==='road')return f.pathId?(t.pathIds||[]).includes(f.pathId):(index===f.roadIndex||!!plan.entityId&&!t.pathIds?.length&&!globalThis.BoroughRoadTypes.isLimitedAccess(t.roadType));
  return !t.type&&!t.construction;
 };
 // A broad urban apron can narrow to an entrance walk around adjacent parcels.
 for(const span of [...new Set([desired,Math.min(desired,.48)])]){
  const across=Math.max(2,Math.ceil(span/.2)),along=Math.max(2,Math.ceil(gap/.2)),rows=[],positions=[],uv=[],indices=[];let valid=true;
  for(let j=0;j<=along&&valid;j++){
   const t=j/along,row=[];
   for(let i=0;i<=across;i++){
    const offset=centre+(i/across-.5)*span,start=startAt(offset);if(start>=reach-.01){valid=false;break;}
    const d=start+(reach-start)*t,x=plan.cx+dx*d+tx*offset,z=plan.cz+dz*d+tz*offset;
    if(!allowed(x,z)){valid=false;break;}
    const endX=plan.cx+dx*reach+tx*offset,endZ=plan.cz+dz*reach+tz*offset,endY=surfaceHeight?.(endX,endZ)??roadHeight(world,endX,endZ)+raise;
    const y=Math.max(base-.02+(endY-(base-.02))*t,height(world,x,z)+.025);
    row.push({x,y,z});positions.push(x,y,z);uv.push(offset,d-start);
   }rows.push(row);
  }
  if(!valid)continue;
  // Avoid abrupt cliffs; those require a designed stair/retaining-wall entrance.
  if(rows.some((row,j)=>j&&row.some((p,i)=>Math.abs(p.y-rows[j-1][i].y)>.2)))continue;
  for(let j=0;j<along;j++)for(let i=0;i<across;i++){const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData={span,gap};return geometry;
 }
 return null;
}

lotAccess=G.bind(lotAccess);
accessStrip=G.bind(accessStrip);
