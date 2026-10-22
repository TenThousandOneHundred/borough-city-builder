import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {ZonePlaneBatch} from '../dist/zoning-render-batch.js';
import {CityView} from '../dist/renderer.js';
import {floorHeight} from '../dist/landscape.js';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {zoningDistrict,zoningView} from './zoning-render-fixture.mjs';
globalThis.CityEngine=E;

function equalMeshes(actual,expected){
 assert.equal(actual.children.length,expected.children.length);
 actual.children.forEach((mesh,i)=>{
  const other=expected.children[i];assert.equal(mesh.type,other.type);
  for(const key of ['opacity','transparent','depthWrite','side'])assert.equal(mesh.material[key],other.material[key]);
  assert.equal(mesh.material.color.getHex(),other.material.color.getHex());
  assert.deepEqual(Object.keys(mesh.geometry.attributes),Object.keys(other.geometry.attributes));
  for(const [name,a]of Object.entries(mesh.geometry.attributes)){assert.equal(a.itemSize,other.geometry.attributes[name].itemSize);assert.deepEqual(a.array,other.geometry.attributes[name].array,name+' stays byte-identical');}
  assert.deepEqual(mesh.geometry.index?.array,other.geometry.index?.array);
 });
}
test('direct zone batches preserve terrain-following cells, Float32 rounding, UVs and triangle order',()=>{
 const world=E.createWorld('Zoning slopes','river',31),view=zoningView(CityView,world),legacy=new THREE.Group(),actual=new THREE.Group(),batch=new ZonePlaneBatch(world,floorHeight),saved=JSON.stringify(world);
 for(let i=0;i<400;i++){
  const frame=i%7?{cx:Math.sin(i*.13)*80,cz:Math.cos(i*.17)*75,width:i%3?1.6:5.73,depth:i%5?1.6:8.2,angle:i*.173}:null,color=i%2?'#74bb54':'#39a875',opacity=i%3?.44:.12,x=i%48,y=Math.floor(i/48);
  batch.add(x,y,color,opacity,frame);legacy.add(view.zonePlane(x,y,color,opacity,frame));
 }
 view.batchZonePlanes(legacy);batch.finish(actual);equalMeshes(actual,legacy);assert.equal(JSON.stringify(world),saved);
});
test('large zone batches retain all indices beyond the 16-bit boundary',()=>{
 const batch=new ZonePlaneBatch({},()=>0),group=new THREE.Group();
 for(let i=0;i<7300;i++)batch.add(i,0,'#fff',.44);
 batch.finish(group);assert.equal(group.children.length,1);const geometry=group.children[0].geometry;
 assert.ok(geometry.index.array instanceof Uint32Array);assert.equal(geometry.attributes.position.count,65700);assert.equal(geometry.index.count,7300*24);
 assert.equal(Math.max(...geometry.index.array.subarray(-24)),65699);assert.equal(geometry.attributes.position.getX(65699),Math.fround((7299.5)*4-96+Math.fround(3.82/2)));
});
test('zoning redraws release prior batches and retain lot outlines without creating per-cell meshes',()=>{
 const {world}=zoningDistrict(),view=zoningView(CityView,world),saved=JSON.stringify(world);
 view.zonePlane=()=>{throw Error('Per-cell geometry allocation is forbidden for a full overlay');};
 view.batchZonePlanes=()=>{throw Error('A finished overlay must not be re-merged');};
 view.updateZones();assert.ok(view.zoneGroup.children.length<=5);assert.ok(view.zoneGroup.children.some(m=>m.userData.zoningLots>0));
 let disposedGeometry=0,disposedMaterial=0;const count=view.zoneGroup.children.length;
 for(const mesh of view.zoneGroup.children){mesh.geometry.addEventListener('dispose',()=>disposedGeometry++);mesh.material.addEventListener('dispose',()=>disposedMaterial++);}
 view.updateZones();assert.equal(disposedGeometry,count);assert.equal(disposedMaterial,count);assert.equal(JSON.stringify(world),saved);
 view.zoning=false;view.updateZones();assert.equal(view.zoneGroup.children.length,0);view.overlay='zones';view.updateZones();assert.ok(view.zoneGroup.children.length>0);
 view.menu=true;view.updateZones();assert.equal(view.zoneGroup.children.length,0);
});
test('direct drag previews keep completed lots red and construction lots editable without changing ownership',()=>{
 const world=E.createWorld('Preview reservations','plains',8),layout=E.fineZoningLayout(world);E.fineZoneCells(world,[...layout.keys()],'residential_low');
 const plan=E.fineZonePlan(world)[0],parcel=F.reserve(world.development,layout,plan.startId,plan.width,plan.depth);parcel.occupant={type:'residential',building:'cottage',level:1};
 const empty=[...layout.keys()].find(id=>!world.development.cells[id]?.owner),ids=[parcel.cells[0],empty],view=zoningView(CityView,world);
 for(const construction of [undefined,1]){
  if(construction)parcel.occupant.construction=construction;else delete parcel.occupant.construction;const saved=JSON.stringify(world),legacy=new THREE.Group();
  legacy.add(view.zonePlane(0,0,construction?E.ZONES.commercial_low.color:'#d76350',.65,layout.get(ids[0])));legacy.add(view.zonePlane(0,0,E.ZONES.commercial_low.color,.65,layout.get(empty)));view.batchZonePlanes(legacy);
  view.previewZones(ids,'commercial_low');equalMeshes(view.previewGroup,legacy);assert.equal(JSON.stringify(world),saved);
 }
 view.previewZones([],'commercial_low');assert.equal(view.previewGroup.children.length,0);
});
