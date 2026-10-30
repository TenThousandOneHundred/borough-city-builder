import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {MAPS} from '../dist/map-catalog.js';
import {groundHeight,wetness,terrainColor} from '../dist/landscape.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
const gradient=(w,x,z)=>Math.hypot(groundHeight(w,x+.5,z)-groundHeight(w,x-.5,z),groundHeight(w,x,z+.5)-groundHeight(w,x,z-.5));
for(const size of [48,72])test(`${size}-cell regional landscapes have continuous dry plains, submerged water and distinct mountain relief`,()=>{
 for(const map of MAPS){
  const w=E.createWorld(map.name,map.id,map.seed,{mapSize:size});assert.equal(w.landformVersion,3);assert.ok(E.valid(w));
  let dry=0,gentle=0,high=0;
  for(let x=-size*2+2;x<size*2;x+=4)for(let z=-size*2+2;z<size*2;z+=4){
   const h=groundHeight(w,x,z),wet=wetness(w,x,z);assert.ok(Number.isFinite(h));high=Math.max(high,h);
   assert.ok(Math.abs(groundHeight(w,x+.001,z)-h)<.01,map.name+' continuous height');
   if(wet>.99)assert.ok(h<.18,map.name+' submerged river/lake bed');
   if(wet<.02){dry++;if(gradient(w,x,z)<.15)gentle++;}
  }
  if(map.id==='highlands'){assert.ok(high>25,'mountains keep their height');assert.ok(gentle/dry>.3,'broad valley remains usable');}
  else assert.ok(gentle/dry>(map.id==='bay'?.7:.95),map.name+' retains gentle development ground');
  for(let x=-size*2+4;x<-size*2+76;x+=4)for(let z=-12;z<=16;z+=4){assert.ok(wetness(w,x,z)<.1,'starter neighborhood dry');assert.ok(gradient(w,x,z)<.22,map.name+' starter slopes');}
 }
});
test('river neighborhoods no longer climb out of an artificial starting-road trench',()=>{
 for(const size of [48,72]){
  const w=E.createWorld('River','river',427,{mapSize:size}),old={...w,landformVersion:2};let before=0,after=0;
  for(let x=-size*2+8;x<-size*2+80;x+=4)for(let z=-44;z<=44;z+=2){before=Math.max(before,gradient(old,x,z));after=Math.max(after,gradient(w,x,z));}
  assert.ok(before>.6);assert.ok(after<.12);assert.ok(after<before*.2);
 }
});
test('regional worlds, older terrain and sculpted heights persist independently in the real save store',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},db=new E.WorldStore(storage),worlds=[];
 for(const version of [undefined,1,2,3])for(const size of [48,72]){
  const w=E.createWorld('Version '+version,'river',427,{mapSize:size,progression:'milestones',expansion:true});if(version===undefined)delete w.landformVersion;else w.landformVersion=version;
  w.elevation=Array((size*2+1)**2).fill(.25);w.elevationRevision=1;
  E.Progression.advance(w,300);assert.ok(E.Land.buy(w,0).ok);assert.ok(E.valid(w));db.save(w);worlds.push(w);
 }
 const loaded=new E.WorldStore(storage);assert.equal(loaded.worlds.length,8);
 for(const w of worlds){const restored=loaded.get(w.id);assert.equal(restored.landformVersion,w.landformVersion);assert.deepEqual(restored.land,w.land);assert.deepEqual(restored.elevation,w.elevation);for(let x=-70;x<=70;x+=14)for(let z=-70;z<=70;z+=14)assert.equal(groundHeight(restored,x,z),groundHeight(w,x,z));}
});
test('regional geometry retains resolution, finite normals and isolated cached buffers',()=>{
 const w=E.createWorld('Mesh','river',427,{mapSize:72});w.landformVersion=2;const old=terrainMeshes(w,groundHeight,terrainColor);w.landformVersion=3;const current=terrainMeshes(w,groundHeight,terrainColor),copy=terrainMeshes(w,groundHeight,terrainColor);
 try{
  assert.equal(current.cacheHit,false);assert.equal(copy.cacheHit,true);
  for(const key of ['ground','far']){assert.equal(old[key].attributes.position.count,current[key].attributes.position.count);assert.equal(old[key].index.count,current[key].index.count);assert.notDeepEqual(old[key].attributes.position.array,current[key].attributes.position.array);for(const a of Object.values(current[key].attributes))assert.ok(a.array.every(Number.isFinite));assert.notEqual(copy[key].attributes.position.array,current[key].attributes.position.array);assert.deepEqual(copy[key].attributes.position.array,current[key].attributes.position.array);}
 }finally{for(const pair of [old,current,copy])for(const key of ['ground','far'])pair[key].dispose();}
});
test('distant highland riverbanks descend over a broad slope instead of a narrow vertical cut',()=>{
 const w=E.createWorld('Highland','highlands',216,{mapSize:72}),old={...w,landformVersion:2};let maxNew=0,maxOld=0;
 for(let z=-450;z<-160;z+=3)for(let x=-100;x<100;x+=2){const d=globalThis.BoroughMapTerrain.distance(w.terrain,w.seed,x,z);if(d>-5&&d<35){maxNew=Math.max(maxNew,gradient(w,x,z));maxOld=Math.max(maxOld,gradient(old,x,z));}}
 assert.ok(maxNew<maxOld*.3,'broad valley bank removes the sharp scenic river wall');
});
