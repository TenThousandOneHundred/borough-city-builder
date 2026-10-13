import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
const E=createRequire(import.meta.url)('../dist/engine.js');
const loader=new GLTFLoader();
// Decode actual shipped geometry without a browser image decoder. Asset tests
// separately validate the embedded textures; browser QA verifies their appearance.
loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
async function library(){const lib=Object.create(ModelLibrary.prototype);lib.models=[];lib.materials=new Set();lib.lotGeometry=new THREE.PlaneGeometry(1,1);lib.lotGeometry.rotateX(-Math.PI/2);lib.view={renderer:{capabilities:{getMaxAnisotropy:()=>8}},landscape:{material:()=>new THREE.MeshStandardMaterial()}};
 for(const file of ['urban','industry','modern']){const data=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));const result=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');lib.ingest(result.scene);}return lib;}
test('all complete building assets decode with finite UV-mapped geometry and valid categories',async()=>{
 const lib=await library();assert.equal(lib.models.length,41);assert.deepEqual([...new Set(lib.models.map(m=>m.category))].sort(),['commercial','industrial','office','residential','residential-low']);
 for(const model of lib.models){assert.ok(model.size.x>0&&model.size.y>0&&model.size.z>0);assert.ok(model.root.children.length<=10);for(const mesh of model.root.children){if(mesh.material.map)assert.ok(mesh.geometry.attributes.uv);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}}
});
test('model placement fits saved lots uniformly and instancing survives demolition without disposing shared models',async()=>{
 const lib=await library(),world=E.createWorld('Model test','flat',324),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:2};const before=JSON.stringify(world),parcel={width:2,depth:3};const g=lib.create(world,index,parcel),s=g.children[0].scale;assert.equal(s.x,s.y);assert.equal(s.y,s.z);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.max.x-bounds.min.x<8);assert.ok(bounds.max.z-bounds.min.z<12);assert.equal(JSON.stringify(world),before);
 const view={scene:new THREE.Scene(),landscape:{assets:{}}},factory=new BuildingFactory(view);let disposed=false;g.children[0].children[0].geometry.addEventListener('dispose',()=>disposed=true);factory.rebuild(new Map([[index,g]]));assert.ok(factory.batchRoot.children.every(o=>o.isInstancedMesh));factory.rebuild(new Map());assert.equal(factory.batchRoot.children.length,0);assert.equal(disposed,false);
});
test('distant geometry cuts workload and visibility excludes buildings behind the camera',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 let full=0,low=0;for(const model of lib.models)for(const mesh of model.root.children){full+=mesh.geometry.index.count;const distant=mesh.geometry.userData.lod||mesh.geometry;low+=distant.index.count;assert.ok([...distant.attributes.position.array].every(Number.isFinite));if(model.family==='modern')assert.equal(distant,mesh.geometry,'lightweight modern facades retain their complete geometry');}assert.ok(low<full*.25);
 const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,8,100);camera.lookAt(0,0,0);const view={scene:new THREE.Scene(),camera,landscape:{assets:{}}},factory=new BuildingFactory(view),g=new THREE.Group();g.userData={factory:true,asset:true};const mesh=lib.models[0].root.children[0].clone();g.add(mesh);factory.rebuild(new Map([[1,g]]));assert.ok(factory.instanceBatches[0].far.count>0);assert.equal(factory.instanceBatches[0].near.count,0);
 camera.lookAt(0,8,200);factory.updateVisibility();assert.equal(factory.instanceBatches[0].far.count,0);assert.equal(factory.instanceBatches[0].near.count,0);
});

test('loaded models follow angled roads without stretching or overlapping neighbouring lots',async()=>{
 const lib=await library(),world=E.createWorld('Asset frontage','plains',324);world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));world.money=100000;
 E.buildRoadPath(world,[{x:10,y:10},{x:30,y:30}],'street');const index=18*48+22;world.tiles[index]={type:'office',density:'high',level:2};
 const root=lib.create(world,index,{width:2,depth:1}),p=root.userData.plan,bounds=new THREE.Box3().setFromObject(root);
 assert.ok(p.frontage);assert.ok(Math.abs(root.rotation.y+Math.PI/4)<1e-8);
 const scale=root.children[0].scale;assert.equal(scale.x,scale.y);assert.equal(scale.y,scale.z);
 assert.ok(bounds.min.x>=p.cx-4-1e-5&&bounds.max.x<=p.cx+4+1e-5);
 assert.ok(bounds.min.z>=p.cz-2-1e-5&&bounds.max.z<=p.cz+2+1e-5);
});

test('modern library retains facade detail with shared materials and a bounded geometry cost',async()=>{
 const lib=await library(),modern=lib.models.filter(m=>m.family==='modern');assert.equal(modern.length,20);
 const materials=new Set();let triangles=0,hasWindowVariation=false;
 for(const model of modern){let count=0;for(const mesh of model.root.children){materials.add(mesh.material);count+=mesh.geometry.index.count/3;const color=mesh.geometry.attributes.color;assert.ok(color,'baked facade variation is retained');assert.ok([...color.array].every(Number.isFinite));if(new Set(color.array).size>3)hasWindowVariation=true;}assert.ok(count<(model.name.startsWith('perimeter-')?10500:5000),model.name+' triangle budget');triangles+=count;}
 assert.ok(materials.size<=9,'materials are reused across modern buildings');assert.ok(triangles<80000);assert.ok(hasWindowVariation);
});
test('medium residential and low commercial zoning do not select high-rise models',async()=>{
 const lib=await library(),world=E.createWorld('Density model QA','plains',324);
 for(let x=10;x<30;x++)for(const [y,type,density,max]of [[20,'residential','medium',9],[22,'commercial','low',3]]){const index=y*48+x;world.tiles[index]={type,density,level:1};const g=lib.create(world,index,{width:2,depth:2}),model=lib.models.find(m=>m.name===g.userData.model);assert.ok(model.floors<=max,model.name+' matches '+density+' '+type);}
});

test('night lighting illuminates selected modern windows while balconies and other panes remain dark',async()=>{
 const lib=await library(),glass=[...lib.materials].filter(m=>m.name.startsWith('modern-glass'));assert.equal(glass.length,2);lib.setNight(true);
 assert.equal(glass.find(m=>m.name==='modern-glass').emissiveIntensity,0);assert.ok(glass.find(m=>m.name==='modern-glass-occupied').emissiveIntensity>0);
 lib.setNight(false);assert.ok(glass.every(m=>m.emissiveIntensity===0));
});

test('large zoned parcels select full-scale perimeter blocks and retain open courtyards',async()=>{
 const lib=await library(),world=E.createWorld('Block coverage','plains',324),index=20*48+20;
 for(const [type,density]of [['residential','medium'],['residential','high'],['commercial','high'],['office','high']]){
  world.tiles[index]={type,density,level:2};const before=JSON.stringify(world),root=lib.create(world,index,{width:3,depth:2}),asset=lib.models.find(m=>m.name===root.userData.model),model=root.children[0];
  assert.ok(type==='office'||asset.name.startsWith('perimeter-'),type+' '+asset.name);assert.equal(model.scale.x,.2);
  assert.ok(asset.size.x*asset.size.z*.04/(12*8)>.55,type+' '+asset.name+' coverage '+asset.size.x*asset.size.z*.04/(12*8));assert.equal(JSON.stringify(world),before);
  // Ray through the centre of the court must reach its planted ground, not a roof.
  if(!asset.name.startsWith('perimeter-'))continue;
  model.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,30,0),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(model,true);assert.ok(hits.length);assert.ok(hits[0].point.y<.4,'courtyard is open to the sky');
 }
});
test('street setbacks remain inside owned parcels at every road angle',async()=>{
 const lib=await library();
 for(const degree of [0,15,30,45,60,75,90,135,180,225,270]){
  const world=E.createWorld('Frontage bounds','plains',324);world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));world.money=100000;
  const angle=degree*Math.PI/180,dx=Math.cos(angle)*8,dy=Math.sin(angle)*8;
  E.buildRoadPath(world,[{x:22-dx,y:22-dy},{x:22+dx,y:22+dy}],'street');
  const index=25*48+24;world.tiles[index]={type:'commercial',density:'high',level:2};const root=lib.create(world,index,{width:3,depth:2}),p=root.userData.plan,b=new THREE.Box3().setFromObject(root);
  assert.ok(b.min.x>=p.cx-6-1e-5&&b.max.x<=p.cx+6+1e-5,degree+' x');
  assert.ok(b.min.z>=p.cz-4-1e-5&&b.max.z<=p.cz+4+1e-5,degree+' z');
 }
});
