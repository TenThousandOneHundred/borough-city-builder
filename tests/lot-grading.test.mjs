import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {gradeLots,gradeLotsSteps,fitGradedLots} from '../dist/lot-grading.js';
import {groundHeight,floorHeight,terrainColor} from '../dist/landscape.js';
import {lotFoundation} from '../dist/lot-foundation.js';
import {harness} from './fixtures/road-build-view.mjs';
import {createRoadEarthworks} from '../dist/road-earthworks.js';
import {prepareRoadRefresh} from '../dist/road-build-job.js';
import {finishBuild} from '../dist/build-scheduler.js';
import {SIDEWALK_HEIGHT} from '../dist/road-profile.js';

function city(){
 const w=E.createWorld('Hillside lots','river',427,{mapSize:72,progression:'milestones',expansion:true});
 for(const x of [5,11,17,21])assert.ok(E.buildRoadPath(w,[{x,y:27},{x,y:45}],'street').ok);
 E.place(w,1,35,'power',{building:'coal'});E.place(w,3,35,'water',{building:'watertower'});
 const layout=E.fineZoningLayout(w);
 for(const zone of ['residential_low','commercial_low','industrial'])E.fineZoneCells(w,[...layout.values()].filter(p=>p.row<4&&(zone==='residential_low'?p.cx<-70:zone==='commercial_low'?p.cx>=-70&&p.cz<2:p.cx>=-70&&p.cz>=2)).map(p=>p.id),zone);
 for(let i=0;i<50&&E.analyze(w).population<300;i++)E.tick(w);
 assert.ok(E.analyze(w).population>=300);return w;
}
function setup(w){const v=harness(w);v.roadworks.outsideSteps=function*(){};v.roadworks.build(w);assert.equal(v.roadworks.earthworks.stats.fallback,false);return v;}
function rooflessGround(w,g){
 const W=g.plan.lotWidth+2,D=g.plan.lotDepth+2,geometry=new THREE.PlaneGeometry(W,D,Math.ceil(W*2),Math.ceil(D*2));geometry.rotateX(-Math.PI/2);geometry.rotateY(g.plan.angle);geometry.translate(g.plan.cx,0,g.plan.cz);
 const p=geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){p.setY(i,groundHeight(w,p.getX(i),p.getZ(i)));colors.push(...terrainColor(w,p.getX(i),p.getZ(i)).toArray());}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}

test('natural hillside development fits entrances to real streets and retains the exact saved city',t=>{
 const w=city(),saved=JSON.stringify(w),v=setup(w),r=v.roadworks;
 try{
  const {grades,surfaces}=gradeLots(w,r);assert.ok(grades.size>=40);assert.equal(surfaces.length,grades.size*2);
  let lowered=0;for(const [id,g]of grades){
   const f=g.plan.frontage;assert.ok(Math.abs(g.base-r.height(w,f.x,f.z)-SIDEWALK_HEIGHT-.01)<1e-9);
   assert.ok(Math.abs(r.earthworks.sample(g.plan.cx,g.plan.cz)-(g.base-.005))<1e-6);
   if(g.high-g.base>1)lowered++;
   const ray=new THREE.Raycaster(new THREE.Vector3(g.plan.cx,100,g.plan.cz),new THREE.Vector3(0,-1,0));
   const hit=ray.intersectObject(r.lotPickSurface,false)[0];assert.ok(hit,id+' remains pickable after terrain is cut away');assert.ok(Math.abs(hit.point.y-g.base-.015)<1e-5);
  }
  assert.ok(lowered>=20);assert.equal(JSON.stringify(w),saved);assert.ok(E.valid(w));
  const plan=r.earthworks,pick=r.lotPickSurface;assert.equal(r.syncEarthworks(w),false);assert.equal(r.earthworks,plan);assert.equal(r.lotPickSurface,pick,'unchanged lots allocate no replacement picking buffers');
  let released=0;pick.geometry.addEventListener('dispose',()=>released++);r.clear();assert.equal(released,1);assert.equal(r.lotGrades.size,0);assert.equal(r.lotPickSurface,null);
  t.diagnostic(JSON.stringify({gradedLots:grades.size,loweredOverFiveMetres:lowered,pickingTriangles:surfaces.length}));
 }finally{v.cleanup();}
});

test('cut-and-fill removes native hill faces under yards without changing source elevations',()=>{
 const w=city(),v=setup(w),r=v.roadworks;let checked=0;
 try{for(const g of r.lotGrades.values()){
  if(g.high-g.base<2||checked++>=3)continue;
  const geometry=rooflessGround(w,g),positions=geometry.attributes.position.array.slice(),indices=geometry.index.array.slice(),result=r.earthworks.applyToGeometry(geometry);
  assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.index.array,indices);
  const kept=geometry.clone();kept.setIndex(new THREE.BufferAttribute(result.indices,1));
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),targets=[new THREE.Mesh(kept,material),...(result.replacement?[new THREE.Mesh(result.replacement,material)]:[])];
  const c=Math.cos(g.plan.angle),s=Math.sin(g.plan.angle);
  for(const x of [-.3,0,.3])for(const z of [-.3,0,.3]){
   const dx=x*g.plan.lotWidth,dz=z*g.plan.lotDepth,px=g.plan.cx+dx*c+dz*s,pz=g.plan.cz-dx*s+dz*c;
   const ray=new THREE.Raycaster(new THREE.Vector3(px,100,pz),new THREE.Vector3(0,-1,0));
   assert.equal(ray.intersectObjects(targets,false).length,0,'no original terrain protrudes into the opaque yard');
   const hit=ray.intersectObject(r.lotPickSurface,false)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-g.base-.015)<1e-5);
  }
  assert.ok(result.replacement.attributes.position.count>0,'open terrain is rebuilt around the opaque yard');
  geometry.dispose();kept.dispose();result.replacement?.dispose();result.walls?.dispose();material.dispose();
 }}finally{v.cleanup();}
 assert.ok(checked>=3);
});

test('model fitting preserves asset buffers, caches stable grades and restores natural support on disconnection',()=>{
 const w=city(),v=setup(w),r=v.roadworks,[id,g]=r.lotGrades.entries().next().value,p=g.plan,root=new THREE.Group(),assetGeometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();
 const model=new THREE.Mesh(assetGeometry,material);model.userData.sharedAsset=true;root.add(model);root.position.set(p.cx,g.high+.04,p.cz);root.rotation.y=p.angle;root.userData={asset:true,plan:p,renderImmutable:true};
 const geometry=lotFoundation(w,p,root.position.y,floorHeight),wall=new THREE.Mesh(geometry,material);wall.userData.lotFoundation=true;root.add(wall);let releases=0;geometry.addEventListener('dispose',()=>releases++);
 v.buildings.set(id,root);v.models.library={foundationMaterial:material};
 try{
  assert.equal(fitGradedLots(v),true);assert.equal(root.position.y,g.base+.04);assert.equal(root.children.length,1);assert.equal(model.geometry,assetGeometry);assert.equal(releases,1);
  const revision=root.userData.renderVersion;assert.equal(fitGradedLots(v),false);assert.equal(root.userData.renderVersion,revision);
  const natural=root.userData.naturalBase;r.lotGrades.delete(id);assert.equal(fitGradedLots(v),true);assert.equal(root.position.y,natural);assert.ok(root.children.some(m=>m.userData.lotFoundation));
  r.lotGrades.set(id,g);r.earthworks.stats.fallback=true;assert.equal(fitGradedLots(v),false,'a failed terrain plan cannot lower the model into unchanged terrain');
 }finally{root.traverse(o=>o.geometry?.dispose());material.dispose();v.cleanup();}
});

test('merits, parcel identity and deterministic lot grading survive real save and reload',()=>{
 const w=city(),storage={data:null,getItem(){return this.data},setItem(k,v){this.data=v}},store=new E.WorldStore(storage),v=setup(w);
 try{
  const values=()=>[...v.roadworks.lotGrades].map(([id,g])=>[id,g.base,g.points]);const before=values(),land=structuredClone(w.land),parcels=structuredClone(w.development);
  store.save(w);const loaded=store.get(w.id);v.roadworks.build(loaded);assert.deepEqual(values(),before);assert.deepEqual(loaded.land,land);assert.deepEqual(loaded.development,parcels);
  const iterator=gradeLotsSteps(loaded,v.roadworks);let yields=0,result;do{result=iterator.next();if(!result.done)yields++;}while(!result.done);assert.ok(yields>=3,'large neighborhoods prepare in bounded groups');assert.deepEqual([...result.value.grades].map(([id,g])=>[id,g.base,g.points]),before);
 }finally{v.cleanup();}
});


test('unconstrained garden edges blend into sloping soil instead of producing vertical wall slabs',()=>{
 const vertices=[[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]],natural=(w,x,z)=>2+x*.5;
 const plan=createRoadEarthworks({world:{},surfaces:[{kind:'lot',vertices:[vertices[0],vertices[1],vertices[2]]},{kind:'lot',vertices:[vertices[0],vertices[2],vertices[3]]}],groundHeight:natural});
 const geometry=new THREE.PlaneGeometry(12,12,24,24);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,natural(null,p.getX(i),p.getZ(i)));
 const result=plan.applyToGeometry(geometry);
 try{
  assert.equal(plan.stats.fallback,false);assert.equal(result.walls,null,'open garden earthworks do not use street retaining-wall rules');
  for(const x of [1.05,1.5,2,2.5,3,3.5,3.95]){const y=plan.sample(x,0);assert.ok(Number.isFinite(y));assert.ok(y>=.979&&y<=natural(null,x,0)+.001);}
  assert.ok(Math.abs(plan.sample(1.001,0)-.98)<.005);assert.ok(Math.abs(plan.sample(3.999,0)-natural(null,3.999,0))<.005);
  assert.equal(plan.mayAffectProtectedParcel([{x:3.2,z:-.1},{x:3.4,z:-.1},{x:3.4,z:.1},{x:3.2,z:.1}]),true,'new neighbors inside the full soil slope invalidate it');
 }finally{geometry.dispose();result.replacement?.dispose();result.walls?.dispose();plan.dispose();}
});

test('finishing construction installs lot grading and demolition restores the natural site',()=>{
 const w=city(),v=setup(w);
 try{
  v.refresh(true);const [id]=v.roadworks.lotGrades.keys(),occupant=w.development.parcels[id].occupant;
  occupant.construction=1;occupant.level=0;v.refresh();assert.equal(v.roadworks.lotGrades.has(id),false);
  occupant.construction=0;occupant.level=1;v.refresh();assert.equal(v.roadworks.lotGrades.has(id),true);
  const {cx,cz}=w.development.parcels[id].frame;assert.ok(E.demolishFineParcel(w,id).ok);v.refresh();assert.equal(v.roadworks.lotGrades.has(id),false);
  const ray=new THREE.Raycaster(new THREE.Vector3(cx,100,cz),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(v.roadworks.lotPickSurface,false).length,0,'demolished lot leaves no invisible selection plane');
 }finally{v.cleanup();}
});


test('construction finishing during a staged road update cannot install a stale terrain cut',async()=>{
 const w=city(),v=setup(w),[id]=v.roadworks.lotGrades.keys(),occupant=w.development.parcels[id].occupant,original=globalThis.document;
 try{
  occupant.construction=1;occupant.level=0;v.refresh(true);assert.equal(v.roadworks.lotGrades.has(id),false);
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};let changed=false;
  assert.equal(await prepareRoadRefresh(v,{schedule:async steps=>{if(!changed){changed=true;occupant.construction=0;occupant.level=1;}return finishBuild(steps);}}),true);
  const grade=v.roadworks.lotGrades.get(id);assert.ok(grade,'live construction completion is included despite the older preparation snapshot');
  assert.ok(Math.abs(v.roadworks.earthworks.sample(grade.plan.cx,grade.plan.cz)-grade.base+.005)<1e-6);
  assert.equal(v.landscape.earthworks,v.roadworks.earthworks);assert.equal(v.roadRefreshJob,null);
 }finally{globalThis.document=original;v.roadworks.dispose();v.cleanup();}
});
