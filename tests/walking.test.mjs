import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {Traffic,roadPoint} from '../dist/traffic.js';
import {Walking} from '../dist/walking.js';
import {Transit} from '../dist/transit.js';
import {Residents} from '../dist/residents.js';
import {StreetLife} from '../dist/street-life.js';
import {buildFootpaths} from '../dist/footpaths.js';
import * as THREE from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;
const ix=(x,y)=>y*48+x;
function world(){const w=E.createWorld('Walkable neighborhood','plains',55);for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,tree:false,ground:'land'});return w;}
function district(){const w=world();for(const [x,type,people]of [[10,'residential',6],[20,'office',0],[24,'commercial',0]])Object.assign(w.tiles[ix(x,10)],{type,level:1,people,density:'low'});assert.ok(E.buildWalkPath(w,[{x:10,y:11},{x:24,y:11}]).ok);return w;}
function simulation(w){const traffic=new Traffic(w,E),transit=new Transit(w,traffic),residents=new Residents(w,traffic,transit);return {traffic,transit,residents};}
function advance(s,seconds){for(let i=0;i<seconds/.05;i++){s.traffic.update(.05);s.transit.update(.05);s.residents.update(.05);}}
test('straight and curved paths charge exact length, preserve shared crossings and save independently',()=>{
 const w=world(),a=[{x:10,y:10},{x:15,y:18},{x:20,y:10}],quote=E.walkQuote(w,a),money=w.money,p=E.buildWalkPath(w,a);assert.ok(p.ok);assert.equal(w.money,money-quote.cost);assert.equal(w.tiles[ix(10,10)].type,'path');
 const q=E.buildWalkPath(w,[{x:10,y:10},{x:10,y:20}]);assert.ok(q.ok);assert.ok(E.removeWalkPath(w,p.path.id).ok);assert.equal(w.tiles[ix(10,10)].type,'path');assert.ok(E.valid(w));
 const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},store=new E.WorldStore(storage);store.save(w);assert.deepEqual(store.get(w.id).walkPaths,w.walkPaths);
 assert.ok(E.place(w,10,10,'bulldoze').ok);assert.equal(w.tiles[ix(10,10)].type,null);
});
test('water, buildings, highways and insufficient money reject paths without mutations',()=>{
 for(const obstacle of [{ground:'water'},{type:'school',level:1},{type:'road',roadType:'highway',level:1}]){const w=world();Object.assign(w.tiles[ix(15,10)],obstacle);const before=JSON.stringify(w);assert.equal(E.buildWalkPath(w,[{x:10,y:10},{x:20,y:10}]).ok,false);assert.equal(JSON.stringify(w),before);}
 const w=world();w.money=0;const before=JSON.stringify(w);assert.equal(E.buildWalkPath(w,[{x:10,y:10},{x:20,y:10}]).ok,false);assert.equal(JSON.stringify(w),before);
});
test('walking follows a connected curved route and cannot cross a building or water barrier',()=>{
 const w=world();Object.assign(w.tiles[ix(10,10)],{type:'residential',level:1});Object.assign(w.tiles[ix(20,10)],{type:'office',level:1});assert.ok(E.buildWalkPath(w,[{x:10,y:11},{x:15,y:19},{x:20,y:11}]).ok);
 const walker=new Walking(w,new Traffic(w,E)),route=walker.route(ix(10,10),ix(20,10));assert.ok(route);assert.ok(route.points.some(p=>p.z>roadPoint(ix(15,13)).z));assert.ok(route.length>40);
 for(let y=0;y<48;y++)Object.assign(w.tiles[ix(15,y)],{type:null,ground:'water'});walker.rebuild();assert.equal(walker.route(ix(10,10),ix(20,10)),null);
 for(let y=0;y<48;y++)Object.assign(w.tiles[ix(15,y)],{type:'school',ground:'land',level:1});walker.rebuild();assert.equal(walker.route(ix(10,10),ix(20,10)),null);
});
test('residents reach jobs, shops and home on foot without roads or rendering',()=>{
 const w=district(),s=simulation(w);advance(s,900);const employed=w.citizens.residents.filter(r=>r.work!==null);assert.ok(employed.length);assert.ok(employed.some(r=>r.workdays>0&&r.shopping>0));assert.equal(s.residents.agents.size,0);assert.ok(E.valid(w));
});
test('walking progress restores exactly, pauses and waits for a removed path to reconnect',()=>{
 const w=district(),s=simulation(w);advance(s,40);const r=w.citizens.residents.find(r=>r.walk);assert.ok(r);const copy=structuredClone(w),saved=JSON.stringify(copy.citizens),restored=simulation(copy);assert.equal(JSON.stringify(copy.citizens),saved);restored.transit.update(0);assert.equal(JSON.stringify(copy.citizens),saved);
 const rr=copy.citizens.residents.find(p=>p.id===r.id),position={x:rr.walk.x,z:rr.walk.z};assert.ok(E.removeWalkPath(copy,copy.walkPaths[0].id).ok);restored.transit.update(.05);assert.equal(rr.activity,'Waiting for walking access');assert.deepEqual({x:rr.walk.x,z:rr.walk.z},position);
 assert.ok(E.buildWalkPath(copy,[{x:10,y:11},{x:24,y:11}]).ok);advance(restored,300);assert.ok(rr.workdays>0||rr.shopping>0);assert.ok(E.valid(copy));
});
test('warm walking routes reuse results until topology changes',()=>{
 const w=district(),walker=new Walking(w,new Traffic(w,E)),a=walker.route(ix(10,10),ix(20,10));assert.equal(walker.route(ix(10,10),ix(20,10)),a);assert.equal(walker.cache.size,1);walker.rebuild();assert.equal(walker.cache.size,0);assert.notEqual(walker.route(ix(10,10),ix(20,10)),a);
});
test('pedestrian render culling does not stop saved walking progress',()=>{
 const w=district(),s=simulation(w);advance(s,30);const r=w.citizens.residents.find(r=>r.walk);assert.ok(r);const camera=new THREE.PerspectiveCamera(45,1,.1,300),view={scene:new THREE.Scene(),world:w,transit:s.transit,camera,roadworks:{height:()=>0}},life=new StreetLife(view);camera.position.set(r.walk.x,15,r.walk.z+20);camera.lookAt(r.walk.x,0,r.walk.z);life.build(w);assert.ok(life.parts[0].count>0);
 const start={...r.walk};camera.position.set(1000,20,1000);camera.lookAt(1000,0,980);life.update(.05);assert.equal(life.parts[0].count,0);advance(s,5);assert.ok(Math.hypot(r.walk.x-start.x,r.walk.z-start.z)>1);camera.position.set(r.walk.x,15,r.walk.z+20);camera.lookAt(r.walk.x,0,r.walk.z);life.update(.05);assert.ok(life.parts[0].count>0);
});
test('footpath batching preserves curved pavement vertices and uses shared materials',()=>{
 const w=world();for(let i=0;i<3;i++)assert.ok(E.buildWalkPath(w,[{x:10,y:10+i},{x:12,y:14+i},{x:15,y:10+i}]).ok);const group=new THREE.Group();buildFootpaths(w,group);assert.ok(group.children.length<3);for(const mesh of group.children){assert.ok(mesh.geometry.attributes.position.count>100);assert.ok(mesh.receiveShadow);}
});
test('corrupt pedestrian links and overlapping travel modes are rejected on import',()=>{
 const w=district(),s=simulation(w);advance(s,30);assert.ok(E.valid(w));let copy=structuredClone(w);copy.walkPaths[0].controls[0]=null;assert.equal(E.valid(copy),false);copy=structuredClone(w);copy.tiles[ix(10,11)].walkPathIds=['missing'];assert.equal(E.valid(copy),false);copy=structuredClone(w);copy.walkPaths[0].tiles=[];assert.equal(E.valid(copy),false);copy=structuredClone(w);const r=copy.citizens.residents.find(r=>r.walk);r.trip={...r.walk,segment:0,distance:0};assert.equal(E.valid(copy),false);
});
test('overlapping path segments share graph nodes and edges without losing route fidelity',()=>{
 const w=world();const controls=[{x:10,y:11},{x:24,y:11}];E.buildWalkPath(w,controls);let walker=new Walking(w,new Traffic(w,E)),count=walker.nodes.length,edges=walker.nodes.reduce((n,p)=>n+p.links.size,0),route=walker.route(ix(10,11),ix(24,11));
 for(let i=0;i<19;i++)assert.ok(E.buildWalkPath(w,controls).ok);walker=new Walking(w,new Traffic(w,E));assert.equal(walker.nodes.length,count);assert.equal(walker.nodes.reduce((n,p)=>n+p.links.size,0),edges);assert.deepEqual(walker.route(ix(10,11),ix(24,11)),route);
});
