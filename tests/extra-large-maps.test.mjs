import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {MAPS} from '../dist/map-catalog.js';
import {groundHeight} from '../dist/landscape.js';
import {Traffic} from '../dist/traffic.js';
import {sculptTerrain,undoTerrain} from '../dist/terrain-edit.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import * as THREE from '../dist/vendor/three.module.js';
const L=E.Land;
const create=(terrain='plains',seed=813)=>E.createWorld('Extra Large',terrain,seed,{mapSize:96,progression:'milestones',expansion:true});
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
for(const map of MAPS)test(`${map.name}: Extra Large has 16 districts, a usable outside entrance and growing homes`,()=>{
 const w=create(map.id,map.seed);assert.equal(w.tiles.length,9216);assert.deepEqual(w.land.owned,[8]);assert.ok(E.valid(w));
 for(let x=0;x<20;x++){assert.equal(w.tiles[48*96+x].ground,'land');assert.ok(groundHeight(w,x*4-190,2)>.18);}
 assert.ok(E.place(w,1,49,'power',{building:'coal'}).ok);assert.ok(E.place(w,3,49,'water',{building:'watertower'}).ok);
 assert.equal(E.zoneCells(w,[6,7,8,9,10,11].map(x=>({x,y:49})),'residential_low').changed,6);
 for(let i=0;i<90;i++)E.tick(w);assert.ok(E.analyze(w).population>0);assert.ok(E.valid(w));
 const traffic=new Traffic(w,E);assert.equal(traffic.portals[0].x,-190);assert.ok(traffic.graph.has(48*96+19));
});
test('Extra Large earns exactly enough merits for every district, with no repeat awards after reload',()=>{
 let w=create();const store=new E.WorldStore(memory());
 assert.equal(L.buy(w,9).ok,false);assert.equal(E.buildRoadPath(w,[{x:19,y:48},{x:30,y:48}],'street').ok,false);
 E.Progression.advance(w,100);assert.equal(w.land.merits,2);assert.ok(L.buy(w,9).ok);assert.equal(w.land.merits,0);
 assert.ok(E.buildRoadPath(w,[{x:19,y:48},{x:30,y:48}],'street').ok);
 store.save(w,100);w=store.get(w.id);E.Progression.advance(w,100);assert.equal(w.land.merits,0);
 for(const level of [2,3,4,5,6]){E.Progression.advance(w,E.Progression.MILESTONES[level].population);assert.ok(E.valid(w));store.save(w,level*E.AUTOSAVE_MS);w=store.get(w.id);}
 assert.equal(w.land.merits,28);assert.ok(L.buyMany(w,Array.from({length:16},(_,i)=>i).filter(i=>!w.land.owned.includes(i))).ok);
 assert.equal(w.land.merits,0);assert.equal(w.land.owned.length,16);assert.ok(E.valid(w));store.save(w);
 const session=new E.GameSession(store);session.start(w.id);E.Progression.advance(session.world,5000);assert.equal(session.world.land.merits,0);session.exit();assert.equal(store.get(w.id).land.owned.length,16);
});
test('Extra Large sandbox supports road access and earthworks beyond Large boundaries',()=>{
 const w=E.createWorld('Sandbox','plains',813,{mapSize:96,progression:'sandbox',expansion:true});assert.equal(w.land.owned.length,16);
 assert.ok(E.buildRoadPath(w,[{x:19,y:48},{x:95,y:48}],'street').ok);const traffic=new Traffic(w,E);assert.ok(traffic.graph.has(48*96+95));assert.ok(traffic.portals.some(p=>p.x===190));
 const result=sculptTerrain(w,{x:170,z:160,mode:'raise',radius:6},groundHeight);assert.ok(result.ok);assert.equal(w.elevation.length,193**2);assert.ok(E.valid(w));assert.ok(undoTerrain(w,result.undo).ok);
 const mesh=terrainMeshes(w,()=>1,()=>new THREE.Color('#779966'));mesh.ground.computeBoundingBox();assert.equal(mesh.ground.boundingBox.max.x,192);assert.equal(mesh.ground.attributes.position.count,385**2);mesh.ground.dispose();mesh.far.dispose();
});
test('legacy merit receipts and mixed-size save slots remain independent',()=>{
 const store=new E.WorldStore(memory());
 for(const mapSize of [48,72,96]){const w=E.createWorld('Size '+mapSize,'plains',813,{mapSize,progression:'milestones',expansion:true});E.Progression.advance(w,3500);assert.equal(w.land.merits,mapSize===96?30:18);assert.ok(L.buy(w,0).ok);store.save(w);}
 const reloaded=new E.WorldStore(store.storage);assert.equal(reloaded.worlds.length,3);for(const w of reloaded.worlds){assert.ok(E.valid(w));assert.equal(w.tiles.length,(w.mapSize||48)**2);}
 const malformed=create();malformed.land.merits=30;assert.equal(E.valid(malformed),false);malformed.land.merits=0;malformed.mapSize=120;assert.equal(E.valid(malformed),false);
});
