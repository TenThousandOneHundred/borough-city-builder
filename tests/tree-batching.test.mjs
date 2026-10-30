import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {Vegetation} from '../dist/vegetation.js';
import {elevationTreeMaterial} from '../dist/tree-impostor.js';

function setup(){
 const camera=new THREE.PerspectiveCamera();camera.position.set(0,160,200);
 const broad={material:elevationTreeMaterial(new THREE.Texture()),broad:true};
 const prototypes=[new THREE.Group(),new THREE.Group()],broadPrototype=new THREE.Group();
 const vegetation=Object.create(Vegetation.prototype);
 Object.assign(vegetation,{v:{camera,night:false,renderer:{shadowMap:{needsUpdate:false}}},broadleaf:Array(4).fill(broad),broadPrototype,prototypes,impostors:prototypes.map(()=>({material:elevationTreeMaterial(new THREE.Texture(),{azimuths:8,panelSize:384})}))});
 return vegetation;
}
const terrain=(x,z)=>Math.sin(x*.03)*3+Math.cos(z*.03)*2;
const positions=n=>Array.from({length:n},(_,i)=>[(i%80-40)*4,(Math.floor(i/80)-20)*4,3+i%7,0,false,['broadleaf','pine',undefined][i%3]]);
function expectedSource(v,p,i){
 if(p[5]==='pine')return v.prototypes[i%2];
 if(p[5]==='broadleaf'||i%10<8)return v.broadPrototype;
 return v.prototypes[i%10-8];
}
test('one batch per shared canopy preserves every legacy and tagged tree, transform and species',()=>{
 const v=setup(),p=positions(12800),saved=JSON.stringify(p);
 v.populate(new THREE.Group(),p,terrain);
 assert.equal(v.instances.length,3);assert.equal(v.population.records.length,p.length);
 assert.equal(new Set(v.population.records.map(r=>r.i)).size,p.length);
 assert.equal(v.instances.reduce((sum,m)=>sum+m.count,0),p.length);
 const actual=new THREE.Matrix4(),dummy=new THREE.Object3D();
 for(const r of v.population.records){
  const [x,z,h]=p[r.i],y=terrain(x,z);
  assert.equal(r.source,expectedSource(v,p[r.i],r.i));
  assert.deepEqual([r.x,r.z,r.h,r.y],[x,z,h,y]);
  dummy.position.set(x,y+h*.54,z);dummy.scale.setScalar(h);dummy.rotation.set(-r.elevation,r.angle,0,'YXZ');dummy.updateMatrix();
  r.mesh.getMatrixAt(r.slot,actual);
  actual.elements.forEach((n,i)=>assert.ok(Math.abs(n-dummy.matrix.elements[i])<.0001));
  assert.equal(r.mesh.material.map,r.mesh.customDepthMaterial.map);
 }
 assert.equal(JSON.stringify(p),saved);
});
test('empty and single-species forests allocate no empty draw batches',()=>{
 for(const [kind,expected]of [[null,0],['broadleaf',1],['pine',2]]){
  const v=setup(),p=kind?positions(200).map(p=>{p[5]=kind;return p;}):[];
  v.populate(new THREE.Group(),p,terrain);
  assert.equal(v.instances.length,expected);assert.ok(v.instances.every(m=>m.count>0));
 }
});
test('camera and day/night changes retain stable buffers, near detail, shadows and conservative bounds',()=>{
 const v=setup(),p=positions(3200);v.populate(new THREE.Group(),p,terrain);
 const attributes=v.instances.map(m=>m.instanceMatrix),matrix=new THREE.Matrix4();
 for(const camera of [[0,8,8],[0,9,10],[30,20,30],[0,250,0],[-130,8,-60]]){
  v.v.camera.position.set(...camera);v.update();
  assert.ok(v.population.near.size<=10);
  const eligible=v.population.records.map(r=>({r,d:(r.x-camera[0])**2+(r.y+r.h*.5-camera[1])**2+(r.z-camera[2])**2})).filter(e=>e.d<784).sort((a,b)=>a.d-b.d||a.r.i-b.r.i);
  if(eligible.length>=10)for(const {r}of eligible.slice(0,10))assert.ok(v.population.near.has(r.i));
  for(const r of v.population.records){
   r.mesh.getMatrixAt(r.slot,matrix);const points=r.mesh.geometry.attributes.position;
   for(let j=0;j<points.count;j++)assert.ok(r.mesh.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(points,j).applyMatrix4(matrix)));
   const model=v.population.near.get(r.i);if(model){assert.equal(model.rotation.y,r.i*2.399);assert.equal(model.position.y,r.y);}
  }
  v.instances.forEach((m,i)=>assert.equal(m.instanceMatrix,attributes[i]));
  v.update();assert.equal(v.lastMatrixWrites,0);
 }
 v.v.night=true;v.update();for(const m of v.instances)assert.equal(m.material.color.getHexString(),'45545f');
 v.v.night=false;v.update();for(const m of v.instances)assert.equal(m.material.color.getHexString(),'ffffff');
 v.v.detailEnabled=false;v.update();assert.equal(v.population.near.size,0);
});
test('genuinely different broadleaf materials remain separate',()=>{
 const v=setup();v.broadleaf=[{material:elevationTreeMaterial(new THREE.Texture())},{material:elevationTreeMaterial(new THREE.Texture())}];
 const p=positions(20).map(p=>{p[5]='broadleaf';return p;});v.populate(new THREE.Group(),p,terrain);
 assert.equal(v.instances.length,2);assert.equal(v.instances[0].count,10);assert.equal(v.instances[1].count,10);
 assert.notEqual(v.instances[0].material,v.instances[1].material);
});
