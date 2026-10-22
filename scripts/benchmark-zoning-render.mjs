// Compare exact rendered buffers as well as CPU time. This does not measure FPS.
// Usage: node scripts/benchmark-zoning-render.mjs /path/to/previous-renderer.mjs
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import {CityView} from '../dist/renderer.js';
import {zoningDistrict,zoningView} from '../tests/zoning-render-fixture.mjs';
globalThis.CityEngine=E;
const {CityView:Previous}=await import(pathToFileURL(process.argv[2]));
const {world,cells}=zoningDistrict(),saved=JSON.stringify(world);
const rigs=[Previous,CityView].map(Type=>({view:zoningView(Type,world),times:[],parts:{}}));
for(const rig of rigs)for(const name of ['zonePlane','batchZonePlanes','zoneLotOutlines']){
 const old=rig.view[name];rig.parts[name]={calls:0,ms:0};rig.view[name]=function(...args){const start=performance.now();const result=old.apply(this,args);rig.parts[name].calls++;rig.parts[name].ms+=performance.now()-start;return result;};
}
for(let run=0;run<8;run++)for(const rig of run%2?[...rigs].reverse():rigs){const start=performance.now();rig.view.updateZones();if(run>0)rig.times.push(performance.now()-start);}
function digest(group){const hash=createHash('sha256');for(const m of group.children){hash.update(m.type+':'+m.material.color.getHexString()+':'+m.material.opacity);for(const [name,a]of Object.entries(m.geometry.attributes)){hash.update(name);hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(m.geometry.index)hash.update(new Uint8Array(m.geometry.index.array.buffer,m.geometry.index.array.byteOffset,m.geometry.index.array.byteLength));}return hash.digest('hex');}
const before=digest(rigs[0].view.zoneGroup),after=digest(rigs[1].view.zoneGroup);assert.equal(after,before,'zone cells and lot outlines have identical visual buffers');assert.equal(JSON.stringify(world),saved);
const report=rig=>({medianCpuMs:rig.times.sort((a,b)=>a-b)[3],draws:rig.view.zoneGroup.children.length,vertices:rig.view.zoneGroup.children.reduce((n,m)=>n+m.geometry.attributes.position.count,0),parts:rig.parts});
console.log(JSON.stringify({cells,runs:7,before:report(rigs[0]),after:report(rigs[1]),identicalBuffers:true,digest:after,unchangedWorld:true,scope:'Warm zoning overlay CPU work, not browser FPS'},null,2));
