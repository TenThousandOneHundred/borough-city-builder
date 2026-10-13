import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {sitePlan} from '../dist/site-plan.js';
import {SiteDetails} from '../dist/site-details.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {lotPlan} from '../dist/building-plan.js';
import E from '../dist/engine.js';
const house={lotWidth:4,lotDepth:4,low:true,type:'residential',density:'low'};
const footprint={minX:-1,maxX:1,minZ:-.5,maxZ:1.25};
test('private lots provide entrances, rear patios, gardens, fences and a driveway without covering the model',()=>{
 const items=sitePlan(house,footprint),kinds=new Set(items.map(i=>i.kind));for(const k of ['walk','drive','patio','garden','fence','tree'])assert.ok(kinds.has(k),k);
 for(const a of items){assert.ok(a.x-a.w/2>=-2&&a.x+a.w/2<=2);assert.ok(a.z-a.d/2>=-2&&a.z+a.d/2<=2);assert.ok(a.x+a.w/2<=footprint.minX||a.x-a.w/2>=footprint.maxX||a.z+a.d/2<=footprint.minZ||a.z-a.d/2>=footprint.maxZ,a.kind+' stays outside building');}
 assert.deepEqual(sitePlan(house,footprint),items,'reload remains deterministic');
});
test('commercial and industrial front yards include usable bay widths and a clear central entrance',()=>{
 for(const type of ['commercial','industrial']){const items=sitePlan({...house,low:false,type,lotWidth:8,lotDepth:8},{minX:-2,maxX:2,minZ:-3,maxZ:1});assert.ok(items.some(i=>i.kind==='yard'));const bays=items.filter(i=>i.kind==='parking');assert.ok(bays.length>=6);assert.ok(bays.every(i=>Math.abs(i.x)>.5&&i.w>=.5&&i.d>=.9));assert.ok(items.some(i=>i.kind==='walk'&&Math.abs(i.x)<1e-8));}
});
test('urban forecourts have planted borders, seating and bicycle stands',()=>{
 const items=sitePlan({...house,low:false,type:'office',lotWidth:8,lotDepth:8},{minX:-2,maxX:2,minZ:-2,maxZ:2});for(const k of ['walk','plaza','bench','rack','tree'])assert.ok(items.some(i=>i.kind===k),k);
});
test('shared detail geometry fits rotated lots and survives repeated instancing and demolition',()=>{
 const tree=new THREE.Group(),crown=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());crown.position.y=.5;tree.add(crown);const view={scene:new THREE.Scene(),landscape:{assets:{}},vegetation:{broadPrototype:tree}},details=new SiteDetails(view),factory=new BuildingFactory(view),buildings=new Map();let disposed=0;details.box.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<30;i++){const root=details.build(house,footprint);root.userData={factory:true,asset:true};root.position.x=i*6;root.rotation.y=i%4*Math.PI/2;root.traverse(o=>{if(o.isMesh){assert.ok(o.userData.sharedAsset);assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));}});buildings.set(i,root);const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.max.x-bounds.min.x<=4);assert.ok(bounds.max.z-bounds.min.z<=4);}
 factory.rebuild(buildings);assert.ok(factory.batchRoot.children.length<=15,'many yards share a bounded material/geometry budget');let count=0;for(const mesh of factory.batchRoot.children)count+=mesh.count;assert.ok(count>500);factory.rebuild(new Map());assert.equal(disposed,0);assert.equal(factory.batchRoot.children.length,0);
});
test('ordinary grid roads expose the same frontage information as curved roads without changing saves',()=>{
 const w=E.createWorld('Grid frontage','plains',32);w.tiles.forEach(t=>t.type=null);const i=20*48+20;w.tiles[i].type='residential';w.tiles[i].density='low';w.tiles[i+48].type='road';const before=JSON.stringify(w),p=lotPlan(w,i);assert.equal(p.frontage.roadIndex,i+48);assert.equal(p.angle,0);assert.equal(JSON.stringify(w),before);
});
test('distant yard trees switch to shared views while close trees retain complete geometry',()=>{
 const tree=new THREE.Group(),crown=new THREE.Mesh(new THREE.SphereGeometry(.45,32,24),new THREE.MeshStandardMaterial());crown.position.y=.5;tree.add(crown);const camera=new THREE.PerspectiveCamera(50,1,.1,200),view={scene:new THREE.Scene(),camera,landscape:{assets:{}},vegetation:{broadPrototype:tree,broadleaf:[{material:new THREE.MeshBasicMaterial({side:THREE.DoubleSide})}]}},details=new SiteDetails(view),root=details.build(house,footprint);root.userData={factory:true,asset:true};const factory=new BuildingFactory(view);camera.position.set(0,4,10);camera.lookAt(0,0,0);factory.rebuild(new Map([[1,root]]));
 const triangles=()=>factory.instanceBatches.filter(b=>b.transforms[0].renderRange).reduce((n,b)=>n+b.near.count*(b.near.geometry.index?.count||b.near.geometry.attributes.position.count)/3,0),near=triangles();assert.ok(near>1000);
 camera.position.set(0,15,70);camera.lookAt(0,0,0);factory.updateVisibility();const far=triangles();assert.ok(far>0&&far<near*.02);camera.position.set(0,4,10);camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(triangles(),near);
});
