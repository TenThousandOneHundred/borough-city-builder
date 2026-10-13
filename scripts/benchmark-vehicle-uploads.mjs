import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {Vehicles} from '../dist/vehicles.js';
const baseline=process.argv[2];if(!baseline)throw Error('Pass the previous Vehicles module path');
const {Vehicles:Previous}=await import(pathToFileURL(baseline));
function setup(Type){const v=new Type(),group=new THREE.Group(),camera=new THREE.PerspectiveCamera(50,1,.1,200),cars=Array.from({length:512},(_,i)=>({mesh:v.create(i),agent:{active:true,x:i}}));cars.forEach((c,i)=>c.mesh.position.set(i<24?(i%8-4)*2:1000+i,0,Math.floor(i/8)*2));camera.position.set(0,10,30);camera.lookAt(0,0,0);v.rebuildFleet(cars,group);v.updateFleet(cars,camera);for(const m of v.fleet)m.instanceMatrix.clearUpdateRanges();return {v,cars,camera,times:[],bytes:0,writes:0};}
const before=setup(Previous),after=setup(Vehicles);
const hash=g=>{const h=createHash('sha256');for(const a of [...Object.values(g.attributes),g.index].filter(Boolean))h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));return h.digest('hex');};
assert.deepEqual(after.v.fleet.map(m=>hash(m.geometry)),before.v.fleet.map(m=>hash(m.geometry)));
for(let frame=0;frame<300;frame++){
 for(const rig of [before,after]){
  const {v,cars,camera}=rig;camera.lookAt(frame>=100&&frame<150?new THREE.Vector3(0,10,1000):new THREE.Vector3(0,0,0));
  cars.forEach((car,i)=>{car.agent.x+=.01;car.mesh.position.z+=(frame<200||i===0)?.001:0;});
  const versions=v.fleet.map(m=>m.instanceMatrix.version),t=performance.now();v.updateFleet(cars,camera);rig.times.push(performance.now()-t);
  v.fleet.forEach((m,i)=>{if(m.instanceMatrix.version!==versions[i]){rig.writes++;rig.bytes+=m.instanceMatrix.updateRanges.length?m.instanceMatrix.updateRanges.reduce((n,r)=>n+r.count*4,0):m.instanceMatrix.array.byteLength;}m.instanceMatrix.clearUpdateRanges();});
 }
 assert.deepEqual(after.cars.map(c=>c.agent),before.cars.map(c=>c.agent));
 assert.equal(after.v.fleet.length,before.v.fleet.length);
 after.v.fleet.forEach((m,i)=>{const b=before.v.fleet[i];assert.equal(m.count,b.count);assert.equal(m.visible,b.visible);assert.deepEqual(m.instanceMatrix.array.subarray(0,m.count*16),b.instanceMatrix.array.subarray(0,b.count*16),'identical visible geometry at frame '+frame);});
}
const report=rig=>({medianCpuMs:rig.times.slice(20).sort((a,b)=>a-b)[140],matrixUploadBytes:rig.bytes,dirtyBatches:rig.writes});
console.log(JSON.stringify({vehicles:512,frames:300,scenario:'24 nearby vehicles, offscreen camera interval, then queued traffic',before:report(before),after:report(after),uploadReductionPercent:(1-after.bytes/before.bytes)*100,identicalGeometryTransformsAndAgents:true,scope:'CPU fixture and scheduled instance-buffer bytes; not an FPS or GPU timing measurement'},null,2));
