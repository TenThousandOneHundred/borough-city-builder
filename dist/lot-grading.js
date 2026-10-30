import {lotPlan} from './building-plan.js?v=165';
import {lotPerimeter,lotFoundation} from './lot-foundation.js?v=165';
import {floorHeight,wetness} from './landscape.js?v=165';
import {SIDEWALK_HEIGHT} from './road-profile.js?v=165';
import {finishBuild} from './build-scheduler.js?v=165';
import './building-entities.js?v=165';
import * as THREE from './vendor/three.module.js';
const Buildings=globalThis.BoroughBuildings;

export function lotGradingKey(world){return JSON.stringify(Object.entries(world.development?.parcels||{}).map(([id,p])=>[id,p.frame,!!p.occupant,!!p.occupant?.construction,!!p.occupant?.level]));}

// Roadside sites use a cut-and-fill pad at their entrance, rather than lifting
// the whole property to the highest point of a hill. This is a rendered earthwork;
// saved terrain, parcel identities and the transport network are not rewritten.
export function gradeLots(world,roads){return finishBuild(gradeLotsSteps(world,roads));}
export function* gradeLotsSteps(world,roads){
 const grades=new Map(),surfaces=[];let count=0;
 for(const [id,parcel]of Object.entries(world.development?.parcels||{})){
  if(count++%16===0)yield;
  if(!parcel.occupant||parcel.occupant.construction||!parcel.occupant.level)continue;
  const rendered=Buildings.renderParcel(world,id),plan=lotPlan(world,rendered.index,rendered),f=plan.frontage;
  if(!f||!Buildings.frontage(world,id,{has:()=>true}).length)continue;
  const points=lotPerimeter(plan).map(p=>({x:p.x+plan.cx,z:p.z+plan.cz}));
  if(points.some(p=>wetness(world,p.x,p.z)>.08))continue;
  const heights=points.map(p=>floorHeight(world,p.x,p.z)),low=Math.min(...heights),high=Math.max(...heights);
  const base=roads.height(world,f.x,f.z)+SIDEWALK_HEIGHT+.01;
  if(!Number.isFinite(base)||base<.2||high-low<.4&&Math.abs(high-base)<.4)continue;
  const w=plan.lotWidth/2-.06,d=plan.lotDepth/2-.06,c=Math.cos(plan.angle),s=Math.sin(plan.angle);
  const corners=[[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>[plan.cx+x*c+z*s,base+.015,plan.cz-x*s+z*c]);
  grades.set(id,{base,plan,points,high,low});
  surfaces.push({kind:'lot',vertices:[corners[0],corners[1],corners[2]]},{kind:'lot',vertices:[corners[0],corners[2],corners[3]]});
 }
 return {grades,surfaces};
}

// Apply only when the prepared road/terrain plan is adopted. Immutable model
// buffers are retained, and one revision invalidates their merged wall cache.
export function fitGradedLots(view){
 let changed=false;
 for(const [id,root]of view.buildings){
  if(!root.userData.asset)continue;
  const grade=!view.roadworks.earthworks?.stats?.fallback&&view.roadworks.lotGrades?.get(id),key=grade?grade.base:null;
  if(root.userData.lotGrade===key)continue;
  if(key===null&&root.userData.lotGrade===undefined)continue;
  const p=root.userData.plan;
  root.userData.naturalBase??=root.position.y;
  const old=root.children.find(o=>o.userData.lotFoundation);
  const material=old?.material||view.models.library?.foundationMaterial;
  if(old){root.remove(old);old.geometry.dispose();}
  root.position.y=grade?grade.base+.04:root.userData.naturalBase;
  if(!grade&&material){
   const geometry=lotFoundation(view.world,p,root.position.y,floorHeight);
   if(geometry){const wall=new THREE.Mesh(geometry,material);wall.rotation.y=-p.angle;wall.castShadow=wall.receiveShadow=true;wall.userData.lotFoundation=true;root.add(wall);}
  }
  root.userData.lotGrade=key;root.userData.renderVersion=(root.userData.renderVersion||0)+1;changed=true;
 }
 return changed;
}

export function lotPickSurface(surfaces,material){
 if(!surfaces.length)return null;
 const positions=[];for(const {vertices:v}of surfaces)for(const p of [v[0],v[2],v[1]])positions.push(...p);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();
 return new THREE.Mesh(geometry,material);
}
