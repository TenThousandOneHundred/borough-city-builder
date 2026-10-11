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
 for(const file of ['urban','industry']){const data=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));const result=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');lib.ingest(result.scene);}return lib;}
test('all complete building assets decode with finite UV-mapped geometry and valid categories',async()=>{
 const lib=await library();assert.equal(lib.models.length,21);assert.deepEqual([...new Set(lib.models.map(m=>m.category))].sort(),['commercial','industrial','office','residential','residential-low']);
 for(const model of lib.models){assert.ok(model.size.x>0&&model.size.y>0&&model.size.z>0);assert.ok(model.root.children.length<=10);for(const mesh of model.root.children){if(mesh.material.map)assert.ok(mesh.geometry.attributes.uv);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}}
});
test('model placement fits saved lots uniformly and instancing survives demolition without disposing shared models',async()=>{
 const lib=await library(),world=E.createWorld('Model test','flat',324),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:2};const before=JSON.stringify(world),parcel={width:2,depth:3};const g=lib.create(world,index,parcel),s=g.children[0].scale;assert.equal(s.x,s.y);assert.equal(s.y,s.z);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.max.x-bounds.min.x<8);assert.ok(bounds.max.z-bounds.min.z<12);assert.equal(JSON.stringify(world),before);
 const view={scene:new THREE.Scene(),landscape:{assets:{}}},factory=new BuildingFactory(view);let disposed=false;g.children[0].children[0].geometry.addEventListener('dispose',()=>disposed=true);factory.rebuild(new Map([[index,g]]));assert.ok(factory.batchRoot.children.every(o=>o.isInstancedMesh));factory.rebuild(new Map());assert.equal(factory.batchRoot.children.length,0);assert.equal(disposed,false);
});
test('distant geometry cuts workload and visibility excludes buildings behind the camera',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 let full=0,low=0;for(const model of lib.models)for(const mesh of model.root.children){full+=mesh.geometry.index.count;low+=mesh.geometry.userData.lod.index.count;assert.ok([...mesh.geometry.userData.lod.attributes.position.array].every(Number.isFinite));}assert.ok(low<full*.25);
 const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,8,100);camera.lookAt(0,0,0);const view={scene:new THREE.Scene(),camera,landscape:{assets:{}}},factory=new BuildingFactory(view),g=new THREE.Group();g.userData={factory:true,asset:true};const mesh=lib.models[0].root.children[0].clone();g.add(mesh);factory.rebuild(new Map([[1,g]]));assert.ok(factory.instanceBatches[0].far.count>0);assert.equal(factory.instanceBatches[0].near.count,0);
 camera.lookAt(0,8,200);factory.updateVisibility();assert.equal(factory.instanceBatches[0].far.count,0);assert.equal(factory.instanceBatches[0].near.count,0);
});
