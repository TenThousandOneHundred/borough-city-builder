// Differential geometry/transform check and scheduled upload bytes, not GPU FPS.
// Usage: node scripts/benchmark-building-uploads.mjs /path/to/previous-factory.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
import E from '../dist/engine.js';
const baseline=process.argv[2];if(!baseline)throw Error('Pass the previous BuildingFactory module path');
const {BuildingFactory:Previous}=await import(pathToFileURL(baseline));
const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const library=Object.create(ModelLibrary.prototype);Object.assign(library,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1),view:{renderer:{capabilities:{getMaxAnisotropy:()=>4}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});library.lotGeometry.rotateX(-Math.PI/2);
for(const file of ['urban','modern','industry']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));library.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene);}
const lod=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));library.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),lod.buffer.slice(lod.byteOffset,lod.byteOffset+lod.length));
const world=E.createWorld('Building upload benchmark','plains',324),buildings=new Map();world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));
for(let y=4;y<44;y+=2)for(let x=4;x<44;x+=2){const i=y*48+x;Object.assign(world.tiles[i],{type:['office','residential','commercial'][(x+y)%3],density:'high',level:2});buildings.set(i,library.create(world,i,{width:2,depth:2}));}
const setup=Type=>{const camera=new THREE.PerspectiveCamera(50,16/9,.1,500);camera.position.set(0,18,45);camera.lookAt(0,0,0);const view={scene:new THREE.Scene(),camera,detailEnabled:true},factory=new Type(view);factory.rebuild(buildings);const gpu=new Map();for(const b of factory.instanceBatches)for(const m of [b.near,b.far].filter(Boolean)){gpu.set(m,m.instanceMatrix.array.slice());m.instanceMatrix.clearUpdateRanges();}return {factory,view,gpu,bytes:0,times:[]};};
const before=setup(Previous),after=setup(BuildingFactory);
const saved=JSON.stringify(world);
for(let frame=0;frame<240;frame++){
 for(const rig of [before,after]){
  const {camera}=rig.view,t=frame/239;camera.position.set(Math.sin(t*Math.PI*4)*55,10+Math.sin(t*Math.PI)**2*32,Math.cos(t*Math.PI*4)*55);camera.lookAt(frame>=90&&frame<110?new THREE.Vector3(camera.position.x*2,15,camera.position.z*2):new THREE.Vector3(0,0,0));rig.view.detailEnabled=frame<180||frame>=200;
  const start=performance.now();rig.factory.updateVisibility();rig.times.push(performance.now()-start);
 }
 assert.equal(after.factory.instanceBatches.length,before.factory.instanceBatches.length);
 after.factory.instanceBatches.forEach((b,i)=>{const old=before.factory.instanceBatches[i];for(const key of ['near','far']){const m=b[key],o=old[key];assert.equal(!!m,!!o);if(!m)continue;assert.equal(m.geometry,o.geometry);assert.equal(m.material,o.material);assert.equal(m.count,o.count);assert.deepEqual(m.instanceMatrix.array.subarray(0,m.count*16),o.instanceMatrix.array.subarray(0,o.count*16));}});
 for(const rig of [before,after])for(const b of rig.factory.instanceBatches)for(const m of [b.near,b.far].filter(Boolean)){
  // Hold uploads for two frames to exercise pending-range accumulation.
  if(frame%3!==2)continue;const attribute=m.instanceMatrix,target=rig.gpu.get(m),version=attribute.version;
  if(version!==m.userData.benchmarkVersion){const ranges=attribute.updateRanges.length?attribute.updateRanges:[{start:0,count:attribute.array.length}];for(const r of ranges){target.set(attribute.array.subarray(r.start,r.start+r.count),r.start);rig.bytes+=r.count*4;}m.userData.benchmarkVersion=version;attribute.clearUpdateRanges();}
  assert.deepEqual(target.subarray(0,m.count*16),attribute.array.subarray(0,m.count*16),'simulated GPU retains exact visible transforms');
 }
}
assert.equal(JSON.stringify(world),saved);
const report=r=>({matrixUploadBytes:r.bytes,medianCpuMs:r.times.slice(20).sort((a,b)=>a-b)[110]});
console.log(JSON.stringify({buildings:buildings.size,frames:240,scenario:'orbit, zoom, offscreen interval, detail toggle; uploads consumed every third frame',before:report(before),after:report(after),uploadReductionPercent:(1-after.bytes/before.bytes)*100,identicalGeometryAndVisibleTransforms:true,unchangedWorld:true,scope:'CPU fixture and scheduled matrix bytes; not a GPU timing or FPS measurement'},null,2));
