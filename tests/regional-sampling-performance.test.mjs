import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import E from '../dist/engine.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import {groundHeight,terrainColor,wetness} from '../dist/landscape.js';
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/regional-buffers-159.json',import.meta.url),'utf8'));
for(const {size,terrain,seed,hash:expected}of baseline.geometry)test(`${size}-cell ${terrain} preserves every Edition 159 terrain vertex, normal, color, UV and index`,()=>{
 const w=E.createWorld('Frozen terrain',terrain,seed,{mapSize:size}),meshes=terrainMeshes(w,groundHeight,terrainColor),hash=createHash('sha256');
 try{for(const name of ['ground','far'])for(const a of [...Object.values(meshes[name].attributes),meshes[name].index])hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));assert.equal(hash.digest('hex'),expected);}finally{meshes.ground.dispose();meshes.far.dispose();}
});
test('shoreline-only sampling preserves both released fields inside and outside the cached region',()=>{
 const maps=globalThis.BoroughMapTerrain;
 for(const {type,seed,hash:expected}of baseline.fields){const values=[];for(let x=-550;x<=550;x+=11.75)for(let z=-550;z<=550;z+=13.25)for(const method of ['distance','relief'])values.push(maps[method](type,seed,x,z));assert.equal(createHash('sha256').update(new Uint8Array(new Float64Array(values).buffer)).digest('hex'),expected,type+' '+seed);}
});
test('each regional height probe queries its shoreline once without stale data after sculpting or world switches',()=>{
 const maps=globalThis.BoroughMapTerrain,original=maps.distance,worlds=['lake','highlands','bay','delta'].map(terrain=>E.createWorld('Probe',terrain,427,{mapSize:72}));let calls=0;maps.distance=(...args)=>{calls++;return original(...args);};
 try{for(const w of worlds)for(const [x,z]of [[-70,12],[35,-200],[210,20]]){calls=0;const before=groundHeight(w,x,z);assert.equal(calls,1);assert.ok(Number.isFinite(before));w.elevation=Array((72*2+1)**2).fill(.75);w.elevationRevision=1;calls=0;const after=groundHeight(w,x,z);assert.equal(calls,1);if(Math.abs(x)<140&&Math.abs(z)<140)assert.ok(Math.abs(after-before-.75)<1e-10);assert.ok(Number.isFinite(wetness(w,x,z)));delete w.elevation;delete w.elevationRevision;assert.equal(groundHeight(w,x,z),before);}}
 finally{maps.distance=original;}
});
