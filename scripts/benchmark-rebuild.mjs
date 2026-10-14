// CPU-only differential benchmark; this does not measure browser FPS or downloads.
// Usage: node scripts/benchmark-rebuild.mjs [baseline-git-ref]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
import E from '../dist/engine.js';
const baseline=process.argv[2]||'3ef9ad8',base=new URL('../dist/',import.meta.url).href;
const source=execFileSync('git',['show',baseline+':dist/building-factory.js'],{encoding:'utf8'}).replaceAll("from './","from '"+base);
const {BuildingFactory:PreviousFactory}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const library=Object.create(ModelLibrary.prototype);Object.assign(library,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1),view:{renderer:{capabilities:{getMaxAnisotropy:()=>4}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});library.lotGeometry.rotateX(-Math.PI/2);
for(const file of ['urban','modern','industry']){const bytes=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));library.ingest((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene);}
const world=E.createWorld('Rebuild benchmark','plains',431),buildings=new Map();for(const tile of world.tiles)Object.assign(tile,{type:null,level:0,tree:false});
for(let y=8;y<28;y+=2)for(let x=8;x<28;x++){const i=y*48+x;Object.assign(world.tiles[i],{type:'residential',density:'low',level:1});world.tiles[i+48].type='road';buildings.set(i,library.create(world,i));}
const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,60,80);camera.lookAt(-24,0,-24);
const view=()=>({scene:new THREE.Scene(),camera,landscape:{assets:{}}}),old=new PreviousFactory(view()),current=new BuildingFactory(view());
const elapsed=f=>{const t=performance.now();f();return performance.now()-t;},report={baseline,lots:201,units:'CPU milliseconds'};
for(const [name,factory]of [['before',old],['after',current]]){const initial=elapsed(()=>factory.rebuild(buildings)),warm=[];for(let i=0;i<7;i++)warm.push(elapsed(()=>factory.rebuild(buildings)));report[name]={initial,warmMedian:warm.sort((a,b)=>a-b)[3],reallocatedMeshes:0};factory.batchRoot.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>report[name].reallocatedMeshes++);});}
const i=30*48+20;Object.assign(world.tiles[i],{type:'residential',density:'low',level:1});buildings.set(i,library.create(world,i));
for(const [name,factory]of [['before',old],['after',current]])report[name].oneAddition=elapsed(()=>factory.rebuild(buildings));
const digest=geometry=>{const hash=createHash('sha256');for(const name of Object.keys(geometry.attributes).sort()){const a=geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(geometry.index){const a=geometry.index.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}return hash.digest('hex');};
const snapshot=factory=>factory.batchRoot.children.filter(mesh=>!mesh.userData.shadowCaster).map(mesh=>{const geometry=digest(mesh.geometry),key=mesh.material.uuid+':'+geometry;return {key,count:mesh.isInstancedMesh?mesh.count:1,matrix:mesh.isInstancedMesh?Array.from(mesh.instanceMatrix.array.subarray(0,mesh.count*16)):null};}).sort((a,b)=>a.key.localeCompare(b.key));
assert.deepEqual(snapshot(current),snapshot(old));report.identicalGeometryAndVisibleTransforms=true;console.log(JSON.stringify(report,null,2));
