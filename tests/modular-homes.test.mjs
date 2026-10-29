import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';
const names=['long-porch-modular-home','solar-hipped-ranch-home'];
let loading;
function library(){return loading ||= (async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});
 for(const file of ['urban','industry','modern']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);}
 const lod=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),lod.buffer.slice(lod.byteOffset,lod.byteOffset+lod.byteLength));return lib;
})();}


test('shallow-roof homes preserve roofs, recessed windows, raised entrances and open porch gates at both detail levels',async()=>{
 const lib=await library();let triangles=0;
 for(const name of names){
  const a=lib.models.find(m=>m.name===name),root=a.root.clone(true),hip=name===names[1],w=hip?14.2:16.2,d=hip?8.2:7.4,base=.42,eave=3.27,rise=hip?1.30:1.12;
  root.updateMatrixWorld(true);assert.equal(a.houseForm,'detached');assert.equal(a.floors,1);assert.ok(a.size.x/a.size.y>3);assert.ok(a.size.y<4.65);
  const cast=(x,y,z,dir)=>new THREE.Raycaster(new THREE.Vector3(x+a.origin.x,y+a.origin.y,z+a.origin.z),dir).intersectObject(root,true)[0],front=(x,y)=>cast(x,y,30,new THREE.Vector3(0,0,-1)),down=(x,z)=>cast(x,20,z,new THREE.Vector3(0,-1,0));
  const door=a.streetFronts[0];assert.equal(door.position[1],.5);
  function check(){
   const bay=w/Math.max(2,Math.round(w/3.2)),windowX=w/2-bay/2;
   assert.ok(front(windowX+.2,base+1.7).object.material.name.startsWith('modern-glass'),'recessed window stays open');
   assert.ok(front(windowX+.2,base+1.7).point.z-a.origin.z<d/2,'glass behind siding');
   assert.equal(front(door.position[0],base+1.25).object.material.name,'modern-wood','door is visible through the porch gate');
   assert.ok(Math.abs(front(door.position[0],base+.7).point.z-a.origin.z-d/2+.12)<.03,'open rail gate leads to the door');
   assert.ok(Math.abs(down(-w*.40,-1).point.y-a.origin.y-(eave+rise*(1-1/(d/2+.3))))<.08,'shallow main roof retains its actual slope');
   assert.ok(Math.abs(down(door.position[0],d/2+1.98).point.y-a.origin.y-.28)<.02,'middle step reaches the raised porch');
   assert.ok(down(1,1.3).point.y-a.origin.y>eave+rise*(1-1.3/(d/2+.3))+.04,'solar panel lies above the roof');
  }
  check();const near=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);triangles+=near;
  for(const m of root.children)m.geometry=m.geometry.userData.lod;check();const far=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.ok(far<near*.85);assert.ok(far<1900);
 }
 assert.ok(triangles<5000);
});

test('new homes leave all 68 previous modern models and all 89 previous distant models identical',async()=>{
 const {fingerprints}=await import('./fixtures/model-fingerprints.mjs'),expected=JSON.parse(fs.readFileSync(new URL('./fixtures/building-fingerprints-148.json',import.meta.url))),actual=fingerprints(new URL('../dist/assets/buildings/modern.glb',import.meta.url),new URL('../dist/assets/buildings/lod.json',import.meta.url),new URL('../dist/assets/buildings/lod.bin',import.meta.url));
 assert.equal(Object.keys(expected.models).length,68);assert.equal(Object.keys(expected.lod).length,89);
 for(const kind of ['models','lod']){assert.equal(Object.keys(actual[kind]).length,Object.keys(expected[kind]).length+2);for(const [name,digest]of Object.entries(expected[kind]))assert.equal(actual[kind][name],digest,name);}
});

test('both new home styles grow from ordinary low-density lots with clear paths and stable saves',async()=>{
 const lib=await library(),w=E.createWorld('Modular neighborhood','plains',431),seen=new Set();
 for(let i=0;i<400;i++){const index=10*48+i%30;w.tiles[index]={type:'residential',level:1,density:'low',building:'cottage',variant:i};const root=lib.create(w,index),plan=root.userData.plan;seen.add(root.userData.model);assert.ok(root.children[0].scale.x===root.children[0].scale.y);}
 for(const name of names)assert.ok(seen.has(name),name+' naturally selected');
 for(const asset of lib.models.filter(a=>names.includes(a.name))){const catalogue=lib.models;lib.models=[asset];for(const angle of [0,.4,1.2]){
  const index=20*48+20,frame={cx:-14,cz:-14,width:4.8,depth:4.8,angle,frontage:{x:-14+Math.sin(angle)*4, z:-14+Math.cos(angle)*4,roadIndex:index+48}};
  const parcel={owner:'parcel-1',entityId:'parcel-1',entitySeed:17,index,width:6,depth:6,oriented:frame,key:'fixture',definition:{type:'residential',density:'low',building:'house',level:1}};const saved=JSON.stringify(w),root=lib.create(w,index,parcel),p=root.userData.plan;
  assert.equal(JSON.stringify(w),saved);assert.equal(root.userData.model,asset.name);const grounds=root.children.find(g=>g.userData.sitePlan);assert.ok(grounds);assert.ok(p.accessPoints.some(a=>a.kind==='walk'));
  root.updateMatrixWorld(true);for(const child of root.children[0].children){const pos=child.geometry.attributes.position;for(let k=0;k<pos.count;k++){const point=new THREE.Vector3().fromBufferAttribute(pos,k).applyMatrix4(child.matrixWorld);point.sub(root.position).applyAxisAngle(new THREE.Vector3(0,1,0),-root.rotation.y);assert.ok(Math.abs(point.x)<=p.lotWidth/2+.001&&Math.abs(point.z)<=p.lotDepth/2+.001,'complete roof and porch stay on their lot');}}
 }lib.models=catalogue;}
});
test('wide detached-house lots retain a single-car driveway and leave the remaining yard unpaved',async()=>{
 const {sitePlan}=await import('../dist/site-plan.js');
 for(const side of [-1,1]){
  const footprint=side===1?{minX:-2.4,maxX:.3,minZ:-1,maxZ:1}:{minX:-.3,maxX:2.4,minZ:-1,maxZ:1},p={type:'residential',low:true,lotWidth:6,lotDepth:6,seed:23,entranceXs:[0]},items=sitePlan(p,footprint),drive=items.find(a=>a.kind==='drive');
  assert.ok(drive);assert.ok(drive.w>.5&&drive.w<=.660001);assert.ok(drive.d>=3.8);assert.equal(Math.sign(drive.x),side);assert.ok(Math.abs(drive.x)+drive.w/2<p.lotWidth/2);assert.ok(items.some(a=>a.kind==='walk'&&Math.abs(a.x)<.2),'door walk remains separate');
 }
});
