import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import {prepareRoadRefresh} from '../dist/road-build-job.js';
import {finishBuild} from '../dist/build-scheduler.js';
import {harness,digest} from './fixtures/road-build-view.mjs';
const originalDocument=globalThis.document;
before(()=>{globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};});
after(()=>{globalThis.document=originalDocument;});
const instant=async steps=>finishBuild(steps);
function city(version){
 const w=E.createWorld('Growth refresh','river',427,{mapSize:72,progression:'milestones',expansion:true});w.landformVersion=version;
 for(const x of [5,11,17,21])assert.ok(E.buildRoadPath(w,[{x,y:27},{x,y:45}],'street').ok);
 E.place(w,1,35,'power',{building:'coal'});E.place(w,3,35,'water',{building:'watertower'});
 E.fineZoneCells(w,[...E.fineZoningLayout(w).values()].filter(p=>p.row<4&&p.cx<-70).map(p=>p.id),'residential_low');
 for(let i=0;i<30;i++)E.tick(w);assert.ok(Object.values(w.development.parcels).some(p=>p.occupant?.level));return w;
}
function setup(w){const v=harness(w);v.refresh(true);return v;}
function roadHash(roads){const h=createHash('sha256');roads.group.traverse(o=>{if(!o.geometry)return;for(const [name,a]of Object.entries(o.geometry.attributes)){h.update(name);h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(o.geometry.index)h.update(new Uint8Array(o.geometry.index.array.buffer));});return h.digest('hex');}
function watched(roads){const resources=new Set();roads.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)resources.add(m);});for(const o of [...roads.earthworkSurfaces,...roads.earthworkStructures])resources.add(o.geometry);let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);return ()=>disposed;}
for(const version of [2,3])test(`terrain ${version} growth and demolition retain road buffers and match a complete reconstruction`,async()=>{
 const a=city(version),parcel=Object.values(a.development.parcels).find(p=>p.occupant?.level),id=parcel.id||Object.entries(a.development.parcels).find(([,p])=>p===parcel)[0];parcel.occupant.construction=1;parcel.occupant.level=0;
 const b=structuredClone(a),v=setup(a),full=setup(b),roads=v.roadworks,group=roads.group,signals=roads.signalGroup,surfaces=roads.surfaces,original=roadHash(roads),wasDisposed=watched(roads);let buildingCalls=0;
 roads.buildSteps=function*(){buildingCalls++;throw Error('unchanged roads rebuilt');};
 try{
  for(const demolish of [false,true]){
   if(demolish){assert.ok(E.demolishFineParcel(a,id).ok);assert.ok(E.demolishFineParcel(b,id).ok);}else for(const w of [a,b]){w.development.parcels[id].occupant.construction=0;w.development.parcels[id].occupant.level=1;}
   const saved=JSON.stringify(a),oldTerrain=digest(v.landscape);let slices=0;
   await prepareRoadRefresh(full,{schedule:instant});
   assert.equal(await prepareRoadRefresh(v,{reason:'terrain',schedule:async steps=>{assert.equal(v.roadworks,roads);assert.equal(digest(v.landscape),oldTerrain);assert.equal(roadHash(roads),original);slices++;return finishBuild(steps);}}),true);
   assert.ok(slices>=4);assert.equal(buildingCalls,0);assert.equal(wasDisposed(),0);assert.equal(v.roadworks,roads);assert.equal(roads.group,group);assert.equal(roads.signalGroup,signals);assert.equal(roads.surfaces,surfaces);assert.equal(roadHash(roads),original);assert.equal(digest(v.landscape),digest(full.landscape));assert.equal(JSON.stringify(a),saved);assert.ok(v.lastRoadBuildStats.reusedRoadMeshes);
   assert.deepEqual([...roads.lotGrades].map(([id,g])=>[id,g.base,g.points]),[...full.roadworks.lotGrades].map(([id,g])=>[id,g.base,g.points]));
  }
 }finally{full.roadworks.dispose();full.cleanup();v.cleanup();}
});
test('cancelled or failed terrain preparation releases private work and never disposes visible road resources',async()=>{
 const w=city(3),v=setup(w),roads=v.roadworks,original=roadHash(roads),livePlan=roads.earthworks,wasDisposed=watched(roads),groups=v.scene.children.slice();
 try{
  for(const fail of [false,true]){
   let count=0;const result=prepareRoadRefresh(v,{reason:'terrain',schedule:async steps=>{const result=finishBuild(steps);if(++count===5){if(fail)throw Error('terrain fixture failure');w.roadEditRevision=(w.roadEditRevision||0)+1;}return result;}});
   if(fail)await assert.rejects(result,/terrain fixture failure/);else assert.equal(await result,false);
   assert.equal(v.roadworks,roads);assert.equal(roads.earthworks,livePlan);assert.equal(roadHash(roads),original);assert.equal(wasDisposed(),0);assert.deepEqual(v.scene.children,groups);assert.equal(v.roadRefreshJob,null);
  }
  assert.equal(await prepareRoadRefresh(v,{reason:'terrain',schedule:instant}),true);assert.equal(wasDisposed(),0);
 }finally{v.cleanup();}
});
test('growth finishing during preparation is reconciled before adopting terrain without rebuilding pavement',async()=>{
 const w=city(3),p=Object.values(w.development.parcels).find(p=>p.occupant?.level);p.occupant.level=0;p.occupant.construction=1;const v=setup(w),old=v.roadworks;let changed=false;
 try{assert.equal(await prepareRoadRefresh(v,{reason:'terrain',schedule:async steps=>{if(!changed){changed=true;p.occupant.level=1;p.occupant.construction=0;}return finishBuild(steps);}}),true);assert.equal(v.roadworks,old);assert.equal(v.landscape.earthworks,old.earthworks);const before=[...old.lotGrades].map(([id,g])=>[id,g.base]);assert.equal(old.syncEarthworks(w),false);assert.deepEqual([...old.lotGrades].map(([id,g])=>[id,g.base]),before);}
 finally{v.cleanup();}
});
