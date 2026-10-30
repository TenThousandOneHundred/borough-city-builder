import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {CityView} from '../dist/renderer.js';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {zoningView} from './zoning-render-fixture.mjs';
import {finishBuild} from '../dist/build-scheduler.js';
import {prepareRoadRefresh} from '../dist/road-build-job.js';
import {harness,world as roadWorld} from './fixtures/road-build-view.mjs';
globalThis.CityEngine=E;

function view(world){const v=zoningView(CityView,world);v.zoning=false;v.grid=new THREE.Group();v.controls={touches:{}};v.renderFloor=()=>1;return v;}
function cells(v){return v.zoneGroup.children.filter(o=>o.isMesh).reduce((n,o)=>n+o.userData.zoningCells,0);}
function empty(){const w=E.createWorld('Construction cells','plains',431);for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',zone:null,level:0,people:0});w.roadPaths=[];w.money=1e8;return w;}

test('road construction displays actual six-deep roadside cells instead of the map grid',()=>{
 const w=empty();assert.ok(E.buildRoadPath(w,[{x:8,y:20},{x:36,y:20}],'street').ok);
 const saved=JSON.stringify(w),v=view(w),layout=E.fineZoningLayout(w);v.setBuild(true,'road');
 assert.equal(v.grid.visible,false);assert.equal(v.roadZoning,true);assert.equal(cells(v),layout.size);
 assert.equal(v.zoneGroup.children.length,1,'one draw batch for all empty cells');
 const p=v.zoneGroup.children[0].geometry.attributes.position;
 let i=0;for(const f of layout.values()){
  assert.equal(p.getX(i*9+4),Math.fround(f.cx));assert.equal(p.getZ(i*9+4),Math.fround(f.cz));
  assert.ok(Math.abs(p.getY(i*9+4)-1.12)<1e-6);assert.ok(f.row>=0&&f.row<6);i++;
 }
 const geometry=v.zoneGroup.children[0].geometry;v.setBuild(true,'road');assert.equal(v.zoneGroup.children[0].geometry,geometry,'unchanged tool selection must retain buffers');
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);v.setBuild(false);assert.equal(v.zoneGroup.children.length,0);assert.equal(disposed,1);assert.equal(JSON.stringify(w),saved);
});

test('curves, highway exclusions and zoning-side choices use the same layout as painting',()=>{
 const w=empty();assert.ok(E.buildRoadPath(w,[{x:6,y:15},{x:24,y:7},{x:40,y:24}],'street',{zoneSides:'left'}).ok);
 assert.ok(E.buildRoadPath(w,[{x:6,y:38},{x:40,y:38}],'highway').ok);
 const v=view(w);v.setBuild(true,'road');const layout=E.fineZoningLayout(w),mesh=v.zoneGroup.children[0],p=mesh.geometry.attributes.position;
 assert.equal(cells(v),layout.size);assert.ok(layout.size>100);assert.ok([...layout.values()].some(f=>Math.abs(f.angle)>.1));
 let i=0;for(const f of layout.values()){
  const a=new THREE.Vector2(p.getX(i*9),p.getZ(i*9)),b=new THREE.Vector2(p.getX(i*9+2),p.getZ(i*9+2));
  const edge=b.sub(a).normalize();assert.ok(Math.abs(edge.x*Math.cos(f.angle)-edge.y*Math.sin(f.angle)-1)<1e-5);i++;
 }
 assert.equal([...layout.values()].some(f=>f.source===w.roadPaths[1].id),false);
 assert.ok([...layout.values()].every(f=>f.side===-1));
 assert.ok(E.setRoadZoning(w,JSON.stringify(['path',w.roadPaths[0].id]),'none').ok);v.updateZones();assert.equal(cells(v),0);
 v.setBuild(false);
});

test('construction cells stop at unowned land and refresh after road deletion',()=>{
 const w=E.createWorld('Owned roadside cells','plains',431,{mapSize:72,progression:'milestones',expansion:true}),v=view(w);v.setBuild(true,'road');
 const layout=E.fineZoningLayout(w);assert.equal(cells(v),layout.size);assert.ok(layout.size>0);
 for(const f of layout.values())assert.ok(E.Land.ownsFrame(w,f));
 for(const t of w.tiles)if(t.type==='road')Object.assign(t,{type:null,pathIds:undefined,legacyRoad:false});w.roadPaths=[];
 v.updateZones();assert.equal(cells(v),0);assert.equal(v.zoneGroup.children.length,0);v.setBuild(false);
});

test('developed multi-cell homes remain one lot in the road view',()=>{
 const w=empty();assert.ok(E.buildRoadPath(w,[{x:8,y:20},{x:36,y:20}],'street').ok);
 const layout=E.fineZoningLayout(w);E.fineZoneCells(w,[...layout.keys()],'residential_low');
 const planned=E.fineZonePlan(w)[0],parcel=F.reserve(w.development,layout,planned.startId,planned.width,planned.depth);parcel.occupant={type:'residential',building:'cottage',level:1};
 const v=view(w),saved=JSON.stringify(w);v.setBuild(true,'road');
 const lots=v.zoneGroup.children.filter(m=>m.isMesh&&m.material.opacity===.32);assert.equal(lots.length,1);assert.equal(lots[0].userData.zoningCells,1);
 assert.equal(cells(v),E.fineZoningLayout(w).size-parcel.cells.length+1);
 assert.equal(JSON.stringify(w),saved);v.setBuild(false);
});

test('tool switching restores zoning and ordinary placement grids without leaving road guides behind',()=>{
 const v=view(E.createWorld('Switch guides','plains',431));
 v.setBuild(true,'road');assert.ok(cells(v)>0);v.setZoning(true);v.setBuild(true,'zone');assert.equal(v.grid.visible,false);assert.ok(cells(v)>0);
 v.setZoning(false);v.setBuild(true,'power');assert.equal(v.grid.visible,true);assert.equal(cells(v),0);
 v.setBuild(true,'path');assert.equal(v.grid.visible,false);assert.ok(cells(v)>0);
 v.menu=true;v.updateZones();assert.equal(cells(v),0);v.setBuild(false);
});

test('prepared cells use the new terrain and yield between bounded height-sampling batches',()=>{
 const w=empty();assert.ok(E.buildRoadPath(w,[{x:8,y:20},{x:36,y:20}],'street').ok);
 const v=view(w);v.roadZoning=true;v.renderFloor=()=>{throw Error('Preparation must not read the old live terrain');};
 let calls=0,maxCalls=0,next;const height=(x,z)=>{calls++;return 3+x*.01+z*.02;},steps=v.zoneOverlaySteps(w,{height});
 do{calls=0;next=steps.next();maxCalls=Math.max(maxCalls,calls);}while(!next.done);
 assert.ok(maxCalls<=64*9);assert.ok(maxCalls>0);const prepared=next.value;
 for(const o of prepared.children){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-(3+p.getX(i)*.01+p.getZ(i)*.02+.12))<1e-5);}
 v.updateZones(prepared);assert.equal(prepared.children.length,0,'ownership transfers to the visible group');assert.equal(cells(v),E.fineZoningLayout(w).size);
 v.setBuild(false);
});

test('cancelling a partially prepared overlay releases completed colour batches',()=>{
 const w=empty();assert.ok(E.buildRoadPath(w,[{x:8,y:20},{x:36,y:20}],'street').ok);const layout=E.fineZoningLayout(w);
 E.fineZoneCells(w,[...layout.keys()].slice(0,150),'residential_low');
 const v=view(w);v.roadZoning=true;let built=0,released=0;
 // Observe the temporary group when the first completed batch is attached.
 const add=THREE.Group.prototype.add;THREE.Group.prototype.add=function(...objects){for(const o of objects)if(o.userData.zoningCells){built++;o.geometry.addEventListener('dispose',()=>released++);o.material.addEventListener('dispose',()=>released++);}return add.apply(this,objects);};
 const steps=v.zoneOverlaySteps(w);
 try{while(!built){assert.equal(steps.next().done,false);}steps.return();assert.equal(released,built*2);assert.equal(v.zoneGroup.children.length,0);}
 finally{steps.return();THREE.Group.prototype.add=add;}
});

for(const paintDuringPreparation of [false,true])test(`interactive road swap ${paintDuringPreparation?'rejects stale':'adopts prepared'} zoning cells`,async()=>{
 const w=roadWorld(),v=harness(w);v.refresh(true);v.zoneGroup=new THREE.Group();v.roadZoning=true;v.zoning=false;
 v.updateZones=CityView.prototype.updateZones;v.updateZones();const old=v.zoneGroup.children.slice();
 assert.ok(E.buildRoadPath(w,[{x:24,y:24},{x:24,y:30}],'street').ok);
 const generator=v.zoneOverlaySteps;let builds=0,prepared;
 v.zoneOverlaySteps=function(...args){builds++;return generator.apply(this,args);};
 try{
  assert.equal(await prepareRoadRefresh(v,{schedule:async steps=>{
   const value=finishBuild(steps);
   if(value?.isGroup){prepared=value;assert.deepEqual(v.zoneGroup.children,old,'keep old cells until the new road is ready');if(paintDuringPreparation){const ids=[...E.fineZoningLayout(w).keys()].slice(0,4);assert.equal(E.fineZoneCells(w,ids,'residential_low').changed,4);}}
   return value;
  }}),true);
  assert.ok(prepared);assert.equal(prepared.children.length,0);assert.equal(builds,paintDuringPreparation?2:1);
  assert.equal(cells(v),E.fineZoningLayout(w).size);
  if(paintDuringPreparation)assert.ok(v.zoneGroup.children.some(o=>o.material.color.getHexString()===E.ZONES.residential_low.color.slice(1)));
  for(const mesh of v.zoneGroup.children.filter(o=>o.isMesh)){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-(v.renderFloor(w,p.getX(i),p.getZ(i))+.12))<.003);}
 }finally{v.disposeZoneOverlay(v.zoneGroup);v.roadworks.dispose();v.cleanup();}
});
