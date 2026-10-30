import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import {groundHeight,terrainColor} from '../dist/landscape.js';

// Frozen from the released Edition 155 renderer (1ef43f2), before the sampling
// optimization. Include positions, normals, UVs, colors and draw indices of
// both the editable ground and distant hills, not just triangle counts.
const released=[
 [48,'river','e4f9ac15794eac679e0590f30068a36cadf1dec5b2932989fd1c28c2046401b7'],
 [48,'highlands','cbd89394db10b73b4f6ae80fdd99e22c7828859695513a7366b3da6791eb57ec'],
 [48,'islands','a5c7928e28aff0fdf2e86734477556cfb61742143f14d0c26afec767d94b15b7'],
 [72,'river','b337d4dee3ffc001e199d98f9b4f5cb7e0d6f49e319b97fa630f30addc8de4b9'],
 [72,'highlands','1ed50cab320ce84dc65caa29cee5f8b98dced7f9aa212f0fbfbb4e0b5bdeba19'],
 [72,'islands','ca39abbf3ac38e656bfe873d65f446fbe7973f11cfc79d695740a775bec3c73d']
];
for(const [size,terrain,expected] of released)test(`${size}-cell ${terrain} retains every released terrain buffer`,()=>{
 const w=E.createWorld('Terrain parity',terrain,427,{mapSize:size});
 const mesh=terrainMeshes(w,groundHeight,terrainColor),hash=createHash('sha256');
 try{
  for(const g of [mesh.ground,mesh.far])for(const a of [...Object.values(g.attributes),g.index])hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  assert.equal(hash.digest('hex'),expected);
  assert.equal(globalThis.BoroughGrid.n,48,'large-map sampling restores its caller dimensions');
 }finally{mesh.ground.dispose();mesh.far.dispose();}
});
