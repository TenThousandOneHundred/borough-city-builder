import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {Vehicles} from '../dist/vehicles.js';
import {VEHICLE_FORMS} from '../dist/vehicle-model.js';
import {CityView} from '../dist/renderer.js';
const count=root=>root.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
const ray=(root,p,d)=>new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d)).intersectObject(root,true);
test('three complete vehicle forms fit real lane envelopes with bounded nondegenerate geometry',()=>{
 const v=new Vehicles(),forms=new Set();for(const seed of [0,1,5]){
  const root=v.create(seed),kind=root.userData.vehicleKind;forms.add(kind);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  assert.ok(size.x<.51&&size.z<1.14&&size.y<.44);assert.ok(box.min.y>=.005);assert.ok(count(root)<=750);assert.equal(root.children.length,5);
  for(const mesh of root.children){const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,indices=index?.count||p.count;
   for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);}
   for(let i=0;i<indices;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i),b=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+1):i+1),c=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+2):i+2);assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-10,'no degenerate wheel or body triangles');}
  }
 }
 assert.deepEqual(forms,new Set(['van','sedan','suv']));
});
test('wheel openings remain clear and side glass faces outward on both sides',()=>{
 const v=new Vehicles();for(const seed of [0,1,5]){const root=v.create(seed),s=VEHICLE_FORMS[root.userData.vehicleKind];root.updateMatrixWorld(true);
  for(const side of [-1,1]){
   for(const z of s.wheels){const axle=s.radius+.006,hits=ray(root,[side,axle,z],[-side,0,0]);assert.equal(hits[0]?.object.material.name,'vehicle-alloy');assert.equal(ray(root,[side,axle+s.radius+.006,z],[-side,0,0]).length,0,'open space above tire beneath fender');}
   const z=root.userData.vehicleKind==='van'?.12:.045,y=(s.waist+s.roof-.014)/2;assert.equal(ray(root,[side,y,z],[-side,0,0])[0]?.object.material.name,'vehicle-glass');
  }
  const top=ray(root,[0,1,(s.frontRoof+s.rearRoof)/2],[0,-1,0])[0];assert.ok(Math.abs(top.point.y-s.roof)<1e-6);assert.ok(top.face.normal.y>.9);
 }
});
test('shared vehicle prototypes survive world cleanup and colors stay attached to packed cars',()=>{
 const v=new Vehicles(),cars=Array.from({length:96},(_,i)=>({mesh:v.create(i),agent:{id:i,active:true}})),group=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,1,.1,200);camera.position.set(0,8,20);camera.lookAt(0,0,0);
 assert.equal(cars[1].mesh.children[0].geometry,cars[2].mesh.children[0].geometry);let disposed=0;cars[1].mesh.children[0].geometry.addEventListener('dispose',()=>disposed++);CityView.prototype.disposeGroup.call({unitBox:null},v.create(13));assert.equal(disposed,0);
 cars.forEach((car,i)=>car.mesh.position.x=i<6?i:1000+i);const saved=JSON.stringify(cars.map(c=>c.agent));v.rebuildFleet(cars,group);assert.equal(v.fleet.length,15);v.updateFleet(cars,camera);
 const check=()=>{for(const batch of v.fleet){let slot=0;for(const part of batch.userData.parts){if(!v.visibleCars.has(part.car))continue;if(part.color){const actual=new THREE.Color();batch.getColorAt(slot,actual);assert.ok(actual.toArray().every((x,i)=>Math.abs(x-part.color.toArray()[i])<1e-6));}slot++;}assert.equal(slot,batch.count);}};
 check();const versions=v.fleet.map(m=>[m.instanceMatrix.version,m.instanceColor?.version]);v.updateFleet(cars,camera);assert.deepEqual(v.fleet.map(m=>[m.instanceMatrix.version,m.instanceColor?.version]),versions);
 const colorVersions=v.fleet.map(m=>m.instanceColor?.version);cars[1].mesh.position.z+=.05;v.updateFleet(cars,camera);assert.deepEqual(v.fleet.map(m=>m.instanceColor?.version),colorVersions,'movement does not reupload unchanged paint');
 cars[1].mesh.position.x=1000;cars[13].mesh.position.x=2;v.updateFleet(cars,camera);check();camera.position.x=1000;camera.lookAt(1000,0,0);v.updateFleet(cars,camera);check();assert.equal(JSON.stringify(cars.map(c=>c.agent)),saved);
});
test('bus geometry and materials remain byte-identical to the released model',()=>{
 const hash=createHash('sha256');new Vehicles().createBus().traverse(o=>{if(o.geometry){for(const [name,a]of Object.entries(o.geometry.attributes)){hash.update(name);hash.update(new Uint8Array(a.array.buffer));}hash.update(JSON.stringify([o.material.name,o.material.color.toArray()]));}});assert.equal(hash.digest('hex'),'f5e26b8e0c864f0450ebbe5deed2f105826cb9abbe6d47f2e6bfe56bf635b51e');
});
