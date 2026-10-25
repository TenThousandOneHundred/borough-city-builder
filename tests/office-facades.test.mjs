import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
const names=['glass-podium-offices','stepped-concrete-offices','elliptic-glass-offices','slender-glass-offices'];
let loading;
function library(){return loading ||= (async()=>{const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}}}});const b=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);const lod=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),lod.buffer.slice(lod.byteOffset,lod.byteOffset+lod.byteLength));return lib;})();}
const ray=(root,x,y,z,direction=new THREE.Vector3(0,0,-1))=>new THREE.Raycaster(new THREE.Vector3(x,y,z),direction).intersectObject(root,true);

test('office vision panes have projecting mullions and non-emissive spandrels at both detail levels',async()=>{
 const lib=await library();for(const name of names){const asset=lib.models.find(m=>m.name===name),root=asset.root.clone(true);root.updateMatrixWorld(true);const panes=[];
 for(const mesh of root.children.filter(m=>m.material.name==='modern-glass')){const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,r=g.attributes.windowRoom;
  for(let i=0;i<p.count;i+=4){if(n.getZ(i)<.99||r.getY(i)!==1)continue;const xs=[0,1,2,3].map(k=>p.getX(i+k)),ys=[0,1,2,3].map(k=>p.getY(i+k));const lo=Math.min(...ys),hi=Math.max(...ys),left=Math.min(...xs),right=Math.max(...xs),z=p.getZ(i);if(lo>(name==='stepped-concrete-offices'?10:3.5)&&hi<(name==='stepped-concrete-offices'?16:10)&&right-left>.8)panes.push({left,right,lo,hi,z});}
 }
 const check=()=>panes.some(p=>{const y=(p.lo+p.hi)/2,x=(p.left+p.right)/2,glass=ray(root,x,y,100)[0],frame=ray(root,p.left-.035,y,100)[0],spandrel=ray(root,x,p.lo-.3,100)[0],seam=ray(root,x,p.lo-.73,100)[0];return seam&&Math.abs(seam.point.z-p.z)<.3&& glass?.object.material.name==='modern-glass'&&frame?.object.material.name==='modern-painted'&&frame.point.z-glass.point.z>.17&&spandrel?.object.material.name==='modern-glass'&&spandrel.object.geometry.attributes.windowRoom.getY(spandrel.face.a)===0;});
 assert.ok(check(),name+' has real facade depth and an unlit floor edge');const saved=root.children.map(m=>m.geometry);for(const mesh of root.children)mesh.geometry=mesh.geometry.userData.lod;assert.ok(check(),name+' keeps the pane openings, floor panels and mullion faces at distance');root.children.forEach((m,i)=>m.geometry=saved[i]);
 }
});

test('office roof screens have upward coping, an open top and retained distant silhouettes',async()=>{
 const lib=await library(),specs=[[-2,21*3.2,-1,7],[ -3,18*3.2,0,6],[0,19*3.2,0,7],[0,23*3.2,0,6]];
 for(let k=0;k<names.length;k++){const asset=lib.models.find(m=>m.name===names[k]),[x,y,z,w]=specs[k],root=asset.root.clone(true);root.updateMatrixWorld(true);const down=new THREE.Vector3(0,-1,0),top=()=>ray(root,x+w/2+.05+asset.origin.x,y+10,z+asset.origin.z,down)[0],inside=()=>ray(root,x+asset.origin.x,y+10,z+asset.origin.z,down)[0];assert.equal(top()?.object.material.name,'modern-painted');assert.ok(Math.abs(top().point.y-(y+1.7))<.002);assert.ok(top().face.normal.y>.99);assert.ok(inside().point.y<y+1.65,'roof screen has no solid lid hiding the equipment');const high=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0),low=root.children.reduce((n,m)=>n+m.geometry.userData.lod.index.count/3,0);assert.ok(low<high-40,'small louvres and mullion returns drop out at distance');for(const mesh of root.children)mesh.geometry=mesh.geometry.userData.lod;assert.equal(top()?.object.material.name,'modern-painted');assert.ok(inside().point.y<y+1.65);}
});

test('the office rebuild leaves every other authored model byte-identical',()=>{
 const b=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url)),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length)),start=28+length,expected=JSON.parse(fs.readFileSync(new URL('./fixtures/unmodified-models-103.json',import.meta.url))),actual={};
 for(const node of doc.nodes){if(node.name.startsWith('industrial-')||['raised-stoop-brick-terrace','dormer-roof-brick-terrace'].includes(node.name)||names.includes(node.name)||node.name==='neighborhood-u-court-apartments'||node.name==='neighborhood-l-court-apartments')continue;const hash=createHash('sha256'),extras=Object.fromEntries(Object.entries(node.extras).sort(([a],[b])=>a.localeCompare(b)));hash.update(JSON.stringify(extras));for(const p of doc.meshes[node.mesh].primitives){hash.update(String(p.material));for(const [key,index]of Object.entries({...p.attributes,indices:p.indices}).sort(([a],[b])=>a<b?-1:a>b?1:0)){hash.update(key);const v=doc.bufferViews[doc.accessors[index].bufferView],offset=start+(v.byteOffset||0);hash.update(b.subarray(offset,offset+v.byteLength));}}actual[node.name]=hash.digest('hex');}
 assert.equal(Object.keys(actual).length,55);assert.deepEqual(actual,expected);
});
