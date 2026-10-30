import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import FineZones from '../dist/fine-zoning-state.js';
import {MAPS} from '../dist/map-catalog.js';
import {groundHeight} from '../dist/landscape.js';
import {sculptTerrain,undoTerrain} from '../dist/terrain-edit.js';
import {Traffic} from '../dist/traffic.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import {constructionGridSteps} from '../dist/construction-grid.js';
import {finishBuild} from '../dist/build-scheduler.js';
import {planRoadGrid,buildRoadGrid} from '../dist/road-grid.js';
import * as THREE from '../dist/vendor/three.module.js';
const G=globalThis.BoroughGrid,L=E.Land;
const create=()=>E.createWorld('Expansion','plains',427,{mapSize:72,progression:'milestones',expansion:true});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};

test('Large maps contain 2.25 times the cells, start owned at the west edge, and grow residents',()=>{
 for(const m of MAPS){const w=E.createWorld(m.name,m.id,m.seed,{mapSize:72,progression:'milestones',expansion:true});assert.equal(w.tiles.length,48*48*2.25);assert.deepEqual(w.land.owned,[3]);assert.equal(w.land.merits,0);assert.ok(E.valid(w));
  assert.equal(E.analyze(w).roads.size,20);for(let x=0;x<20;x++){assert.equal(w.tiles[36*72+x].ground,'land');assert.ok(groundHeight(w,x*4-142,2)>.18);}
  assert.ok(E.place(w,1,35,'power',{building:'coal'}).ok);assert.ok(E.place(w,3,35,'water',{building:'watertower'}).ok);
  E.zoneCells(w,[{x:6,y:35},{x:7,y:35},{x:8,y:35},{x:9,y:35}],'residential_low');
  for(let i=0;i<90;i++)E.tick(w);assert.ok(E.analyze(w).population>0,m.name);assert.ok(E.valid(w),m.name+' remains valid after development');
 }
});
test('merits are awarded once, buy any selected district, and survive save/home/reload',()=>{
 const w=create(),db=new E.WorldStore(storage());assert.equal(L.buy(w,4).ok,false);
 E.Progression.advance(w,100);assert.equal(w.land.merits,2);const money=w.money;E.Progression.advance(w,100);assert.equal(w.land.merits,2);assert.equal(w.money,money);
 assert.ok(L.quote(w,8).ok);assert.ok(L.buy(w,4).ok);assert.equal(w.land.merits,0);assert.equal(L.buy(w,4).ok,false);assert.ok(E.valid(w));
 db.save(w,100);const session=new E.GameSession(db);session.start(w.id);E.Progression.advance(session.world,0);assert.equal(session.world.land.merits,0);session.exit(200);
 const restored=new E.WorldStore(db.storage).get(w.id);assert.deepEqual(restored.land,w.land);E.Progression.advance(restored,3500);assert.equal(restored.land.merits,16);
 for(const id of [0,1,2,5,6,7,8])assert.ok(L.buy(restored,id).ok);assert.equal(restored.land.owned.length,9);assert.equal(restored.land.merits,2);assert.ok(E.valid(restored));
});
test('land checks reject roads, curved crossings, paths, zoning, facilities and earthworks atomically',()=>{
 const w=create();E.Progression.advance(w,300);let before=JSON.stringify(w);
 assert.equal(E.buildRoadPath(w,[{x:19,y:36},{x:30,y:36}],'street').ok,false);
 assert.equal(E.buildRoadPath(w,[{x:19,y:35},{x:38,y:40},{x:19,y:42}],'street').ok,false);
 assert.equal(E.buildRoad(w,{x:19,y:36},{x:30,y:36}).ok,false);
 assert.equal(E.buildWalkPath(w,[{x:20,y:36},{x:30,y:36}]).ok,false);
 assert.equal(E.place(w,24,36,'power').ok,false);
 assert.equal(E.facilityQuote(w,23,32,'school',{building:'elementary'}).ok,false);
 assert.equal(E.zoneCells(w,[{x:24,y:35}],'residential_low').changed,0);
 assert.equal(sculptTerrain(w,{x:10,z:10,mode:'raise',radius:4},groundHeight).ok,false);
 assert.equal(JSON.stringify(w),before);
 assert.ok(L.buy(w,4).ok);assert.ok(E.buildRoadPath(w,[{x:19,y:36},{x:30,y:36}],'street').ok);
 assert.ok(E.fineZoningLayout(w).size>0);assert.ok(E.valid(w));
});
test('purchasing a district reopens its roadside cells without mutating the shared zoning layout',()=>{
 const w=create();assert.ok(E.buildRoadPath(w,[{x:19,y:36},{x:23,y:36}],'street').ok);
 const before=E.fineZoningLayout(w),raw=FineZones.grid(w,E.ROADS),size=raw.size;
 E.Progression.advance(w,100);assert.ok(L.buy(w,4).ok);const after=E.fineZoningLayout(w);assert.ok(after.size>=before.size);assert.equal(raw.size,size);
 assert.ok(E.buildRoadPath(w,[{x:23,y:36},{x:30,y:36}],'street').ok);const cells=[...E.fineZoningLayout(w).values()].filter(p=>p.cx>-48&&p.row<3);
 assert.ok(cells.length>0);assert.ok(E.fineZoneCells(w,cells.map(p=>p.id),'residential_low').changed>0);
});
test('large sandbox supports roads, traffic, zoning and sculpting beyond the old map boundary',()=>{
 const w=E.createWorld('Sandbox','plains',9,{mapSize:72,progression:'sandbox',expansion:true});assert.equal(w.land.owned.length,9);
 assert.ok(E.buildRoadPath(w,[{x:19,y:36},{x:65,y:36}],'street').ok);const traffic=new Traffic(w,E);assert.equal(traffic.portals[0].x,-142);assert.ok(traffic.graph.has(36*72+65));
 assert.ok(E.place(w,62,35,'power',{building:'coal'}).ok);assert.ok(E.place(w,60,35,'water',{building:'watertower'}).ok);E.zoneCells(w,[{x:64,y:35},{x:65,y:35}],'residential_low');for(let i=0;i<90;i++)E.tick(w);assert.ok(w.tiles[35*72+65].type);assert.ok(E.valid(w));
 const result=sculptTerrain(w,{x:110,z:100,mode:'raise',radius:6},groundHeight);assert.ok(result.ok);assert.equal(w.elevation.length,145*145);assert.ok(E.valid(w));assert.ok(undoTerrain(w,result.undo).ok);
 const plan=G.scope(72,()=>planRoadGrid([{x:52,y:42},{x:64,y:42},{x:64,y:54}],{blockSize:4}));assert.ok(plan.ok);assert.ok(buildRoadGrid(w,plan,'street',E).ok);assert.ok(E.valid(w));
});
test('mixed-size stores, height samples and interleaved geometry jobs restore their own dimensions',()=>{
 const small=E.createWorld('Old','river',427),large=create(),db=new E.WorldStore(storage());const old=JSON.stringify(small),height=groundHeight(small,70,-70);
 db.save(small);db.save(large);assert.equal(new E.WorldStore(db.storage).worlds.length,2);assert.equal(E.SIZE,48);
 for(let i=0;i<5;i++){E.analyze(large);groundHeight(large,120,-120);assert.equal(groundHeight(small,70,-70),height);assert.ok(E.valid(small)&&E.valid(large));}
 const a=G.scope(72,()=>constructionGridSteps(()=>1)),b=G.scope(48,()=>constructionGridSteps(()=>1));a.next();b.next();const ga=finishBuild(a),gb=finishBuild(b);ga.computeBoundingBox();gb.computeBoundingBox();assert.equal(ga.boundingBox.max.x,144);assert.equal(gb.boundingBox.max.x,96);ga.dispose();gb.dispose();
 const mesh=terrainMeshes(large,()=>1,()=>new THREE.Color('#779966'));mesh.ground.computeBoundingBox();assert.equal(mesh.ground.boundingBox.max.x,144);assert.equal(mesh.ground.attributes.position.count,289*289);mesh.ground.dispose();mesh.far.dispose();
 const parsed=JSON.parse(old);assert.equal(parsed.mapSize,undefined);assert.ok(E.valid(parsed));assert.equal(parsed.land,undefined);
});
test('malformed ownership and merit balances are rejected; sandbox can enable progression without losing land',()=>{
 for(const change of [w=>w.land.owned.push(3),w=>w.land.owned.push(8),w=>w.land.merits=200,w=>w.mapSize=100,w=>w.land.awarded=7]){const w=create();change(w);assert.equal(E.valid(w),false);}
 const w=E.createWorld('Free land','plains',4,{mapSize:72,progression:'sandbox',expansion:true});E.Progression.initialize(w,'milestones',500);E.Progression.advance(w,500);assert.equal(w.land.owned.length,9);assert.ok(E.valid(w));
});

test('wide outside roads can reach the large map edge and merit receipts survive autosave timing',()=>{
 const w=E.createWorld('Edge','plains',7,{mapSize:72,progression:'sandbox',expansion:true});
 assert.ok(E.buildRoadPath(w,[{x:65,y:20},{x:71,y:20}],'highway').ok);assert.ok(new Traffic(w,E).portals.some(p=>p.id===20*72+71));
 const city=create(),store=new E.WorldStore(storage());E.Progression.advance(city,100);store.save(city,E.AUTOSAVE_MS);const loaded=store.get(city.id);E.Progression.advance(loaded,100);assert.equal(loaded.land.merits,2);assert.ok(L.buy(loaded,4).ok);store.save(loaded,2*E.AUTOSAVE_MS);assert.equal(store.get(city.id).land.merits,0);
});
