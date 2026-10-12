import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {Traffic} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';
import {Transit,createBusLine} from '../dist/transit.js';
function world(){const w=E.createWorld('Bus test','plains',44);for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,tree:false});for(let x=0;x<28;x++)Object.assign(w.tiles[24*48+x],{type:'road',roadType:'street',level:1});for(const [x,type,people]of [[1,'bus',0],[4,'residential',6],[20,'office',0],[23,'commercial',0]])Object.assign(w.tiles[23*48+x],{type,level:1,people});return w;}
function sim(w,create=true){const traffic=new Traffic(w,E);traffic.residentsEnabled=true;for(let i=0;i<32;i++)traffic.addAgent();if(create)assert.ok(createBusLine(w,traffic,[24*48+4,24*48+22]).ok);const transit=new Transit(w,traffic),residents=new Residents(w,traffic,transit);return {traffic,transit,residents,w};}
function advance(s,seconds){for(let t=0;t<seconds;t+=.05){s.traffic.update(.05);s.transit.update(.05);s.residents.update(.05);}}
test('bus lines require a depot, a closed directed route and sufficient funds atomically',()=>{
 const w=world(),t=new Traffic(w,E),before=JSON.stringify(w);assert.equal(createBusLine(w,t,[1,2]).ok,false);assert.equal(JSON.stringify(w),before);
 w.tiles[23*48+1].type=null;assert.equal(createBusLine(w,t,[24*48+4,24*48+22]).ok,false);w.tiles[23*48+1].type='bus';w.money=0;const poor=JSON.stringify(w);assert.equal(createBusLine(w,t,[24*48+4,24*48+22]).ok,false);assert.equal(JSON.stringify(w),poor);
});
test('residents walk, wait, board a bus, reach jobs and shops and return without rendering',()=>{
 const s=sim(world()),phases=new Set();for(let i=0;i<8000;i++){advance(s,.05);for(const r of s.residents.state.residents)if(r.transit)phases.add(r.transit.phase);}
 assert.ok(phases.has('walk'));assert.ok(phases.has('wait'));assert.ok(phases.has('ride'));assert.ok(phases.has('lastWalk'));assert.ok(s.w.transit.lines[0].boardings>4);assert.ok(s.w.transit.lines[0].completed>4);assert.ok(s.residents.state.residents.some(r=>r.id%3!==0&&r.workdays>0&&r.shopping>0));assert.ok(E.valid(s.w));
});
test('bus and passenger progress survive verified save reload and pause',()=>{
 const s=sim(world());for(let i=0;i<2000&&!s.residents.state.residents.some(r=>r.transit?.phase==='ride');i++)advance(s,.05);assert.ok(s.residents.state.residents.some(r=>r.transit?.phase==='ride'));
 const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},store=new E.WorldStore(storage);store.save(s.w,123);const copy=store.get(s.w.id),old=JSON.stringify(copy.transit),riders=JSON.stringify(copy.citizens.residents.map(r=>r.transit));const restored=sim(copy,false);assert.equal(JSON.stringify(copy.transit),old);assert.equal(JSON.stringify(copy.citizens.residents.map(r=>r.transit)),riders);restored.transit.update(0);assert.equal(JSON.stringify(copy.transit),old);advance(restored,100);assert.ok(copy.transit.lines[0].completed>s.w.transit.lines[0].completed);
});
test('road closure suspends the line and passengers return by walking instead of teleporting',()=>{
 const s=sim(world());for(let i=0;i<2000&&!s.residents.state.residents.some(r=>r.transit?.phase==='ride');i++)advance(s,.05);const r=s.residents.state.residents.find(r=>r.transit?.phase==='ride');assert.ok(r);const before={x:r.transit.x,z:r.transit.z};s.w.tiles[24*48+13].type=null;s.traffic.rebuild(s.w);s.transit.rebuild();s.transit.update(.05);assert.equal(r.transit.phase,'return');assert.ok(Math.hypot(r.transit.x-before.x,r.transit.z-before.z)<=.061);assert.equal(s.transit.summary.buses,0);advance(s,150);assert.equal(r.transit,undefined);assert.equal(r.location,r.home);
});
test('removed lines release their bus slots and malformed save data is rejected',()=>{
 const s=sim(world()),initial=s.traffic.agents.length;for(let i=0;i<12;i++){s.w.transit.lines=[];s.transit.rebuild();assert.ok(createBusLine(s.w,s.traffic,[24*48+4,24*48+22]).ok);s.transit.rebuild();}assert.equal(s.traffic.agents.length,initial);assert.ok(E.valid(s.w));s.w.transit.lines[0].vehicle.x=NaN;assert.equal(E.valid(s.w),false);
});
test('buses respect capacity, have running costs and reject corrupt passenger saves',()=>{
 const w=world();w.tiles[23*48+4].people=40;const before=E.analyze(w).upkeep,s=sim(w);assert.equal(E.analyze(w).upkeep,before+12);let max=0;for(let i=0;i<5000;i++){advance(s,.05);max=Math.max(max,s.transit.summary.riding);assert.ok(s.transit.summary.riding<=24);}assert.ok(max>0);const r=s.residents.state.residents[0];r.transit={line:1,board:12,alight:1,from:r.home,to:r.home,purpose:'home',phase:'ride',x:0,z:0};assert.equal(E.valid(w),false);
});
test('mixed car and bus instancing retains each complete vehicle geometry',async()=>{
 const {Vehicles}=await import('../dist/vehicles.js'),THREE=await import('../dist/vendor/three.module.js');const v=new Vehicles(),cars=[{mesh:v.create(0)},{mesh:v.create(1)},{mesh:v.createBus()}];let expected=0;for(const c of cars)c.mesh.traverse(o=>{if(o.isMesh)expected+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});v.rebuildFleet(cars,new THREE.Group());const actual=v.fleet.reduce((n,m)=>n+m.count*(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);assert.equal(actual,expected);const bounds=new THREE.Box3().setFromObject(cars[2].mesh);assert.ok(bounds.max.z-bounds.min.z>2);assert.ok(bounds.max.x-bounds.min.x<.65);
});
test('reserved bus slots do not suppress ordinary outside arrivals',()=>{
 const w=world(),traffic=new Traffic(w,E);traffic.residentsEnabled=true;for(let i=0;i<8;i++)Object.assign(traffic.addAgent(),{active:true,kind:'bus',hold:true,x:i,z:40});const visitor=traffic.addAgent();assert.ok(traffic.begin(visitor));assert.equal(visitor.kind,undefined);assert.equal(visitor.phase,'inbound');
});
