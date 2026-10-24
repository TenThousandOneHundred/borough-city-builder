import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';
const names=['neighborhood-u-court-apartments','neighborhood-l-court-apartments'];
let loading;
function library(){return loading ||= (async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});
 for(const file of ['urban','industry','modern']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);}
 const lod=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),lod.buffer.slice(lod.byteOffset,lod.byteOffset+lod.byteLength));return lib;
})();}

test('apartment courts have connected wings, open gardens and visible street entrances at both detail levels',async()=>{
 const lib=await library();
 for(const name of names){const asset=lib.models.find(m=>m.name===name),root=asset.root.clone(true);root.updateMatrixWorld(true);
  const ray=(x,y,z,dir)=>new THREE.Raycaster(new THREE.Vector3(x+asset.origin.x,y+asset.origin.y,z+asset.origin.z),dir).intersectObject(root,true);
  const down=(x,z)=>ray(x,100,z,new THREE.Vector3(0,-1,0))[0];
  const check=()=>{
   assert.ok(down(0,8).point.y>15,'broad street wing covers the frontage');
   assert.ok(down(name===names[0]?-10.5:-13.5,-8).point.y>12,'perpendicular wing reaches the back of the lot');
   assert.ok(down(2,-3).point.y<.3,'courtyard is open to the ground, not filled by a podium');
   if(name===names[0])assert.ok(down(10.5,-8).point.y>12,'U court has two side wings');
   const front=asset.streetFronts.find(f=>f.kind==='entrance'&&f.position[2]>12.9);assert.ok(front);
   const hit=ray(front.position[0]+.2,1.4,30,new THREE.Vector3(0,0,-1))[0];assert.ok(hit.object.material.name.startsWith('modern-glass'),'street entrance reaches visible glazing');
  };
  check();const near=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);for(const mesh of root.children)mesh.geometry=mesh.geometry.userData.lod;check();
  const far=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.ok(near<7500);assert.ok(far<near*.8,'distant topology drops small furnishings and reveal details');assert.ok(root.children.length<=9,'shared materials bound draw count');
 }
});

test('ordinary medium zoning selects both courtyard forms at metre scale and retains saved lots',async()=>{
 const lib=await library(),world=E.createWorld('Courtyard selection','plains',8),seen=new Set();
 for(let seed=1;seed<=36;seed++)for(const [width,depth]of [[4,4],[5,4],[6,4],[4,5],[5,5]]){
  const id='court-lot-'+seed,parcel={entityId:id,entitySeed:B.seed(id),definition:{type:'residential',density:'medium',building:'apartments',level:1},width,depth,oriented:{cx:0,cz:0,angle:.43,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:8,roadIndex:1176}}};
  const before=JSON.stringify(parcel),root=lib.create(world,1176,parcel),asset=root.children[0];seen.add(root.userData.model);
  assert.equal(JSON.stringify(parcel),before);assert.equal(asset.scale.x,asset.scale.y);assert.equal(asset.scale.x,asset.scale.z);assert.ok(asset.scale.x>=.17);
  root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(asset);
  assert.ok(box.min.x>=-parcel.oriented.width/2&&box.max.x<=parcel.oriented.width/2);assert.ok(box.min.z>=-parcel.oriented.depth/2&&box.max.z<=parcel.oriented.depth/2);
  assert.equal(lib.create(JSON.parse(JSON.stringify(world)),1176,JSON.parse(before)).userData.model,root.userData.model);
 }
 for(const name of names)assert.ok(seen.has(name),name+' is naturally selected without a forced model');
 assert.ok(seen.size>=5,'other apartment forms remain in use');
});

test('new courtyard assets preserve all 59 previous authored models exactly',()=>{
 const b=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url)),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length)),start=28+length,expected=JSON.parse(fs.readFileSync(new URL('./fixtures/unmodified-models-107.json',import.meta.url))),actual={};
 for(const node of doc.nodes){if(names.includes(node.name))continue;const hash=createHash('sha256'),extras=Object.fromEntries(Object.entries(node.extras).sort(([a],[b])=>a.localeCompare(b)));hash.update(JSON.stringify(extras));for(const p of doc.meshes[node.mesh].primitives){hash.update(String(p.material));for(const [key,index]of Object.entries({...p.attributes,indices:p.indices}).sort(([a],[b])=>a<b?-1:a>b?1:0)){hash.update(key);const v=doc.bufferViews[doc.accessors[index].bufferView],offset=start+(v.byteOffset||0);hash.update(b.subarray(offset,offset+v.byteLength));}}actual[node.name]=hash.digest('hex');}
 assert.equal(doc.nodes.length,61);assert.equal(Object.keys(actual).length,59);assert.deepEqual(actual,expected);
});
