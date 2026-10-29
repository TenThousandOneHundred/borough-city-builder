import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import E from '../dist/engine.js';
import {MAPS} from '../dist/map-catalog.js';
import {MAP_STATS} from '../dist/map-preview-stats.js';
import {groundHeight,wetness} from '../dist/landscape.js';

for(const map of MAPS){
 test(map.name+' has a dry connected entrance, usable starter neighborhood, and consistent preview',()=>{
  const w=E.createWorld(map.name,map.id,map.seed,{progression:'milestones'}),roads=E.analyze(w).roads;
  assert.ok(E.valid(w));assert.equal(MAP_STATS[map.id].seed,w.seed);
  assert.equal(MAP_STATS[map.id].land,Math.round(w.tiles.filter(t=>t.ground==='land').length/2304*100));
  assert.ok(fs.statSync(new URL('../dist/assets/maps/'+map.id+'.webp',import.meta.url)).size>10000);
  for(let x=0;x<20;x++){
   assert.ok(roads.has(24*48+x));assert.equal(w.tiles[24*48+x].ground,'land');
   assert.ok(groundHeight(w,x*4-94,2)>.18);assert.ok(wetness(w,x*4-94,2)<.1);
  }
  assert.ok(E.place(w,1,23,'power',{building:'wind'}).ok);
  assert.ok(E.place(w,2,23,'water',{building:'watertower'}).ok);
  assert.ok(E.zoneCells(w,[{x:5,y:23},{x:6,y:23}],'residential_low').ok);
  for(let n=0;n<90;n++)E.tick(w);
  assert.ok(E.analyze(w).population>0,'starter homes receive services and residents');
 });
}
test('all seven landscapes persist as separate worlds and restore the same terrain',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=new E.WorldStore(storage);
 const worlds=MAPS.map(m=>E.createWorld(m.name,m.id,m.seed));
 for(const w of worlds)store.save(w,100);
 const restored=new E.WorldStore(storage);assert.equal(restored.worlds.length,7);
 for(const w of worlds){const copy=restored.get(w.id);assert.equal(copy.terrain,w.terrain);assert.ok(E.valid(copy));
  for(let x=-90;x<=90;x+=18)for(let z=-90;z<=90;z+=18)assert.equal(groundHeight(copy,x,z),groundHeight(w,x,z));
 }
});
test('new landscapes have distinct shorelines, finite continuous heights and submerged water beds',()=>{
 const signatures=new Set();
 for(const map of MAPS.filter(m=>globalThis.BoroughMapTerrain.isNew(m.id))){
  const w=E.createWorld(map.name,map.id,map.seed);let water=0,land=0,max=0;
  signatures.add(w.tiles.map(t=>t.ground==='water'?'1':'0').join(''));
  for(let x=-94;x<=94;x+=4)for(let z=-94;z<=94;z+=4){
   const h=groundHeight(w,x,z),distance=globalThis.BoroughMapTerrain.distance(map.id,map.seed,x,z);
   assert.ok(Number.isFinite(h));max=Math.max(max,h);
   assert.ok(Math.abs(groundHeight(w,x+.001,z)-h)<.015,'continuous terrain');
   if(distance<-3){water++;assert.ok(h<.18,'deep water lies below water surface');}
   if(distance>3){land++;assert.ok(h>.18,'dry land is above water');}
  }
  assert.ok(water>5&&land>900);if(map.id==='highlands')assert.ok(max>20);
 }
 assert.equal(signatures.size,4);
});
