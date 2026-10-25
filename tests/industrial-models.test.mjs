import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';
const names=['industrial-trade-depot','industrial-light-workshop','industrial-distribution-hall','industrial-sawtooth-works','industrial-processing-yard'];
const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new T.Texture())}));
const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new T.MeshStandardMaterial()}}});
for(const file of ['urban','industry','modern']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene);}
const lodData=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url)),manifest=JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url)));lib.ingestLod(manifest,lodData.buffer.slice(lodData.byteOffset,lodData.byteOffset+lodData.length));
function parcel(width,depth,kind,seed=1){const id='industrial-fit-'+seed;return {entityId:id,entitySeed:B.seed(id),definition:{type:'industrial',building:kind,density:'low',level:2},width,depth,oriented:{cx:0,cz:0,angle:.73,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:6,roadIndex:1176}}};}

test('industrial forms retain roofs, loading doors, rooflights and round silos at both detail levels',()=>{
 let near=0,far=0;for(const name of names){const a=lib.models.find(m=>m.name===name),root=a.root.clone(true);root.updateMatrixWorld(true);
  const ray=(x,y,z,dir)=>new T.Raycaster(new T.Vector3(x+a.origin.x,y+a.origin.y,z+a.origin.z),dir).intersectObject(root,true)[0],front=(x,y)=>ray(x,y,50,new T.Vector3(0,0,-1)),down=(x,z)=>ray(x,100,z,new T.Vector3(0,-1,0));
  const check=()=>{
   const door={ 'industrial-trade-depot':[-3.5,2,3], 'industrial-light-workshop':[-2.8,2,3.5], 'industrial-distribution-hall':[-13,2.5,7.5], 'industrial-sawtooth-works':[3.5,2,6.5], 'industrial-processing-yard':[-1,2.5,5]}[name],hit=front(door[0]+.1,door[1]+.13);assert.equal(hit.object.material.name,'modern-painted');assert.ok(hit.point.z-a.origin.z>door[2],'shutter remains in front of wall');
   assert.ok(a.streetFronts.some(f=>f.kind==='entrance'&&f.width>.7&&f.normal[1]>.9),'human-scale street-facing office entry');
   if(name==='industrial-distribution-hall')assert.equal(down(0,-5.5).object.material.name,'modern-glass','rooflight faces upward');
   if(name==='industrial-light-workshop')assert.equal(down(0,-2).object.material.name,'modern-glass','compact workshop rooflight survives');
   if(name==='industrial-sawtooth-works'){assert.ok(down(2,-11).point.y-a.origin.y>6.8);assert.ok(down(2,-8).point.y-a.origin.y<6.1);assert.equal(ray(2,6.5,-30,new T.Vector3(0,0,1)).object.material.name,'modern-glass','vertical northlight is visible');}
   if(name==='industrial-processing-yard'){const silo=ray(9.7,10,15,new T.Vector3(0,0,-1));assert.equal(silo.object.material.name,'modern-painted');assert.ok(Math.abs(silo.point.z-a.origin.z-1.34787)<.03);assert.ok(down(9,-9).point.y-a.origin.y>17,'tall silo and cap retained');}
  };check();for(const m of root.children){const g=m.geometry,low=g.userData.lod;near+=g.index.count/3;far+=low.index.count/3;assert.equal(g.userData.shadowLod,low);for(const [key,attribute]of Object.entries(g.attributes))assert.equal(low.attributes[key],attribute);m.geometry=low;}check();assert.ok(root.children.length<=8);
 }
 assert.ok(near<15500,'five complete forms share a 15.5k triangle budget');assert.ok(far<near*.33,'distant models drop fine ribs, seams, ladder rungs and pallets');
 const silo=lib.models.find(m=>m.name==='industrial-processing-yard'),paint=silo.root.children.find(m=>m.material.name==='modern-painted'),p=paint.geometry.attributes.position,n=paint.geometry.attributes.normal;let samples=0;for(let i=0;i<p.count;i++){const x=p.getX(i)-silo.origin.x-9,z=p.getZ(i)-silo.origin.z+9,y=p.getY(i)-silo.origin.y;if(Math.abs(Math.hypot(x,z)-2.45)>.001||Math.abs(y-.35)>.001)continue;assert.ok(n.getX(i)*x/2.45+n.getZ(i)*z/2.45>.99,'silo uses smooth radial normals');samples++;}assert.ok(samples>=48);
});

test('industrial lots select all five forms at metre scale with road-facing bounded footprints',()=>{
 const w=E.createWorld('Industrial fit','plains',8),seen=new Set();for(let seed=0;seed<45;seed++)for(const kind of ['factory','warehouse'])for(const [width,depth]of [[2,2],[3,3],[4,4],[5,5],[6,6]]){
  const p=parcel(width,depth,kind,seed),saved=JSON.stringify(p),root=lib.create(w,1176,p),a=lib.models.find(m=>m.name===root.userData.model);assert.equal(a.building,kind);seen.add(a.name);assert.ok(root.userData.plan.loadingBays.length>0,'authored loading doors reach the ground planner');assert.ok(root.userData.plan.accessPoints.some(p=>p.kind==='drive'),'truck gate connects to the street');assert.equal(root.children[0].scale.x,.2,'human-scale model for '+width+'x'+depth+' '+a.name);assert.equal(root.rotation.y,.73);root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root.children[0]);assert.ok(box.min.x>=-p.oriented.width/2&&box.max.x<=p.oriented.width/2);assert.ok(box.min.z>=-p.oriented.depth/2&&box.max.z<=p.oriented.depth/2);assert.equal(JSON.stringify(p),saved);
 }for(const name of names)assert.ok(seen.has(name),name+' selected naturally');
});

test('industrial zoning develops varied multi-cell widths and preserves saved lots and model choices',()=>{
 const w=E.createWorld('Industrial growth','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');E.buildRoadPath(w,[{x:19,y:24},{x:43,y:24}]);const cells=[...E.fineZoningLayout(w).values()].filter(c=>c.row<6);assert.ok(E.fineZoneCells(w,cells.map(c=>c.id),'industrial').ok);for(let i=0;i<160;i++)E.tick(w);
 const lots=Object.values(w.development.parcels).filter(p=>p.occupant&&!p.occupant.construction);assert.ok(lots.length>8);assert.ok(lots.some(p=>p.width>=5),'large plants reserve broad street frontages');assert.ok(lots.some(p=>p.width===2),'compact plants retain narrow frontages');assert.ok(lots.every(p=>p.cells.length===p.width*p.depth&&p.depth>=2));assert.equal(new Set(lots.flatMap(p=>p.cells)).size,lots.reduce((s,p)=>s+p.cells.length,0),'lots never overlap');
 const storage={data:null,getItem(){return this.data;},setItem(k,v){this.data=v;}},store=new E.WorldStore(storage);store.save(w,125);const data=JSON.stringify(w),restored=new E.WorldStore(storage).get(w.id);assert.ok(E.valid(restored));assert.deepEqual(restored.development,w.development);
 for(const p of lots){const before=B.renderParcel(w,p.id),after=B.renderParcel(restored,p.id),model=lib.create(w,before.index,before);assert.equal(model.userData.model,lib.create(restored,after.index,after).userData.model);assert.equal(model.children[0].scale.x,.2);}
 assert.equal(JSON.stringify(w),data,'rendering does not change workers, capacities, lots or storage');
});

test('industrial shadows use intact silhouettes independent of camera visibility',()=>{
 const w=E.createWorld('Industrial shadows','plains',8),root=lib.create(w,1176,parcel(6,6,'factory',3)),camera=new T.PerspectiveCamera(45,1,.1,500);camera.position.set(0,8,20);camera.lookAt(0,0,0);const factory=new BuildingFactory({scene:new T.Scene(),camera,landscape:{assets:{}}});factory.rebuild(new Map([[1,root]]));const batches=factory.instanceBatches.filter(b=>b.near.geometry.userData.shadowLod);assert.ok(batches.length>=6);const counts=batches.map(b=>b.shadow.userData.casterCount);assert.ok(counts.every(n=>n>0));for(const b of batches)assert.equal(b.shadow.geometry,b.near.geometry.userData.shadowLod);camera.lookAt(0,8,100);factory.updateVisibility();assert.deepEqual(batches.map(b=>b.shadow.userData.casterCount),counts,'offscreen buildings still cast shadows');assert.ok(batches.every(b=>b.near.count===0&&b.far.count===0));
});

test('industrial additions preserve all 63 older modern buildings and all 84 older distant models byte-for-byte',()=>{
 const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/unmodified-models-124.json',import.meta.url))),b=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url)),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length)),start=28+length,actual={models:{},lod:{}};
 for(const node of doc.nodes){if(names.includes(node.name))continue;const h=createHash('sha256');h.update(JSON.stringify(Object.fromEntries(Object.entries(node.extras).sort(([a],[b])=>a.localeCompare(b)))));for(const p of doc.meshes[node.mesh].primitives){h.update(String(p.material));for(const [key,index]of Object.entries({...p.attributes,indices:p.indices}).sort(([a],[b])=>a<b?-1:a>b?1:0)){h.update(key);const v=doc.bufferViews[doc.accessors[index].bufferView],offset=start+(v.byteOffset||0);h.update(b.subarray(offset,offset+v.byteLength));}}actual.models[node.name]=h.digest('hex');}
 for(const [name,parts]of Object.entries(manifest)){if(names.includes(name))continue;const h=createHash('sha256');for(const p of parts){h.update(JSON.stringify({shared:p.sharedAttributes,indexCount:p.index.count,attributes:Object.keys(p.attributes||{})}));for(const a of [...Object.values(p.attributes||{}),p.index])h.update(lodData.subarray(a.offset,a.offset+a.count*4));}actual.lod[name]=h.digest('hex');}
 assert.equal(Object.keys(actual.models).length,63);assert.equal(Object.keys(actual.lod).length,84);assert.deepEqual(actual,expected);
});
