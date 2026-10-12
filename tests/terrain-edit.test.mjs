import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {terrainOffset,sculptTerrain,undoTerrain} from '../dist/terrain-edit.js';
import {groundHeight,wetness} from '../dist/landscape.js';
const world=()=>E.createWorld('Terrain QA','plains',321);
const brush=(w,mode,extra={})=>sculptTerrain(w,{x:20,z:20,radius:12,strength:1,mode,...extra},groundHeight);
test('sculpted terrain is smooth, bounded, persistent, and leaves old saves unchanged',()=>{
 const w=world(),before=groundHeight(w,20,20),untouched=groundHeight(w,-40,-40);assert.equal(terrainOffset(w,20,20),0);
 const r=brush(w,'raise');assert.ok(r.ok);assert.ok(groundHeight(w,20,20)>before+.9);assert.equal(groundHeight(w,-40,-40),untouched);assert.ok(Math.abs(groundHeight(w,20.001,20)-groundHeight(w,20,20))<.01);assert.ok(E.valid(w));
 const restored=JSON.parse(JSON.stringify(w));assert.equal(groundHeight(restored,20,20),groundHeight(w,20,20));assert.equal(terrainOffset(w,96,20),0);assert.equal(terrainOffset(w,100,20),0);
});
test('lowering open land creates water and undo restores elevations, ground types, and funds',()=>{
 const w=world(),money=w.money,heights=[20,22,24].map(x=>groundHeight(w,x,20)),ground=w.tiles.map(t=>t.ground);
 const r=brush(w,'lower',{strength:4});assert.ok(r.ok);assert.ok(wetness(w,20,20)>.9);assert.ok(w.tiles.some(t=>t.ground==='water'));assert.ok(w.money<money);
 assert.ok(undoTerrain(w,r.undo).ok);assert.deepEqual([20,22,24].map(x=>groundHeight(w,x,20)),heights);assert.deepEqual(w.tiles.map(t=>t.ground),ground);assert.equal(w.money,money);
});
test('roads and buildings retain their foundations while adjacent open land can change',()=>{
 const w=world();w.tiles[29*48+29].type='office';w.tiles[29*48+29].level=1;const before=groundHeight(w,22,22);
 for(let i=0;i<5;i++)brush(w,'raise',{radius:20});assert.equal(groundHeight(w,22,22),before);assert.equal(terrainOffset(w,24,24),0);assert.ok(terrainOffset(w,8,20)>0);
 const roadHeight=groundHeight(w,-60,2);const r=brush(w,'raise',{x:-60,z:2,radius:2});assert.equal(r.ok,false);assert.equal(groundHeight(w,-60,2),roadHeight);
});
test('level brush approaches the selected height and smoothing reduces a peak',()=>{
 const w=world();for(let i=0;i<8;i++)brush(w,'level',{target:6,strength:1});assert.ok(Math.abs(groundHeight(w,20,20)-6)<.001);
 brush(w,'raise',{radius:3,strength:4});const peak=groundHeight(w,20,20);brush(w,'smooth',{radius:6,strength:4});assert.ok(groundHeight(w,20,20)<peak);
});
test('invalid brushes, corrupt elevation saves and unaffordable work cannot mutate the world',()=>{
 const w=world();w.money=0;const before=JSON.stringify(w);assert.equal(brush(w,'raise').ok,false);assert.equal(brush(w,'raise',{x:NaN}).ok,false);assert.equal(JSON.stringify(w),before);
 w.elevation=[0];assert.equal(E.valid(w),false);w.elevation=new Array(9409).fill(0);w.elevation[2]=NaN;assert.equal(E.valid(w),false);w.elevation[2]=81;assert.equal(E.valid(w),false);
});
test('undo cannot move a foundation placed after the terrain was sculpted',()=>{
 const w=world(),r=brush(w,'raise');w.tiles[29*48+29].type='office';const before=JSON.stringify(w);assert.equal(undoTerrain(w,r.undo).ok,false);assert.equal(JSON.stringify(w),before);
});

test('terrain survives verified storage, home exit, and a fresh game session independently of other worlds',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const db=new E.WorldStore(storage),w=world(),other=E.createWorld('Unedited','river',123);db.save(w,1);db.save(other,2);
 const session=new E.GameSession(db);session.start(w.id);assert.ok(brush(session.world,'raise').ok);
 const expected=JSON.parse(JSON.stringify(session.world.elevation)),height=groundHeight(session.world,20,20);
 session.exit(3);const restored=new E.GameSession(new E.WorldStore(storage));assert.equal(restored.screen,'home');restored.start(w.id);
 assert.deepEqual(restored.world.elevation,expected);assert.equal(groundHeight(restored.world,20,20),height);assert.equal(new E.WorldStore(storage).get(other.id).elevation,undefined);
});

test('terrain rendering keeps the traffic simulation and resident state intact',async()=>{
 const {CityView}=await import('../dist/renderer.js');
 const {Traffic}=await import('../dist/traffic.js');
 const w=world();for(let x=0;x<12;x++)w.tiles[24*48+x]={type:'road',ground:'land',roadType:'street'};w.tiles[23*48+10]={type:'commercial',level:1,ground:'land'};const traffic=new Traffic(w,E),agent=traffic.addAgent();traffic.update(2);
 assert.ok(agent.active);const trip=agent.trip,clock={elapsed:10},residents={households:[{home:23*48+9}]},bounds={minX:8,maxX:32,minZ:8,maxZ:32};
 const view={world:w,traffic,residents,simulationClock:clock,cars:[{heightWorld:w}],renderer:{shadowMap:{}},landscape:{refreshTerrain(world,area,finish){assert.equal(world,w);assert.equal(area,bounds);assert.equal(finish,true);}},makeGrid(){},updateZones(){}};
 assert.ok(brush(w,'raise').ok);CityView.prototype.terrainChanged.call(view,bounds,true);
 assert.equal(view.traffic,traffic);assert.equal(view.simulationClock,clock);assert.equal(view.residents,residents);assert.equal(agent.trip,trip);assert.equal(agent.active,true);
 for(let i=0;i<4000&&traffic.completed===0;i++)traffic.update(.05);
 assert.ok(traffic.completed>0,'trip finishes with no renderer frame calls');
});
