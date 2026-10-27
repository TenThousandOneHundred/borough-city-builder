import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import Buildings from '../dist/building-entities.js';

function world(){const w=E.createWorld('Separated streets','plains',19);w.money=1e6;for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});return w;}
function road(w,controls,type='street'){const r=E.buildRoadPath(w,controls,type);assert.ok(r.ok,r.reason);return r.path;}

test('adjacent parallel road tiles do not grant outside access to an isolated facility',()=>{
 const w=world(),main=road(w,[{x:0,y:10},{x:30,y:10}]),isolated=road(w,[{x:3,y:11},{x:28,y:11}]);
 const id=12*48+15;Object.assign(w.tiles[id],{type:'water',building:'watertower',level:1});
 let a=E.analyze(w);assert.equal(a.roads.hasSource(10*48+15,main.id),true);assert.equal(a.roads.hasSource(11*48+15,isolated.id),false);assert.equal(a.active.includes(id),false);assert.equal(a.water,0);
 const connector=[{x:5,y:10},{x:5,y:11}],quote=E.roadQuote(w,connector),before=w.money;
 assert.equal(quote.ok,true);assert.equal(quote.cost,50,'a connector through already occupied road tiles still has a construction price');
 road(w,connector);assert.equal(w.money,before-quote.cost);
 assert.equal(E.roadQuote(w,connector).ok,false,'the same connector cannot be bought twice');
 a=E.analyze(w);assert.equal(a.roads.hasSource(11*48+15,isolated.id),true);assert.equal(a.active.includes(id),true);assert.ok(a.water>0);
});

test('covered connectors require actual endpoint contact rather than nearby parallel pavement',()=>{
 const w=world();road(w,[{x:0,y:20},{x:40,y:20}]);road(w,[{x:40,y:21.2125},{x:0,y:21.2125}]);
 // These shallow tangents neither cross nor extend into either centerline.
 // Raster ownership alone must not turn the gap into a purchased connection.
 for(const [start,end]of [[20.02,21.1925],[20.02,21.2125],[20,21.1925]]){
  const controls=[{x:10,y:start},{x:20,y:start},{x:30,y:end}],before=JSON.stringify(w);
  assert.equal(E.roadQuote(w,controls).ok,false);
  assert.equal(E.buildRoadPath(w,controls).ok,false);
  assert.equal(JSON.stringify(w),before,'a rejected near miss changes neither funds nor roads');
 }
 const exact=[{x:10,y:20},{x:20,y:20},{x:30,y:21.2125}],q=E.roadQuote(w,exact);
 assert.ok(q.ok,q.reason);assert.ok(q.cost>0,'exact endpoints still allow a real covered connection');
});

test('parcel access follows its actual road source when another road shares the same tile',()=>{
 const w=world(),main=road(w,[{x:0,y:10},{x:30,y:40}]),other=road(w,[{x:4,y:15.2},{x:25,y:36.2}]);
 const shared=main.tiles.find(i=>other.tiles.includes(i));assert.notEqual(shared,undefined,'fixture has overlapping raster tiles');
 const roads=E.analyze(w).roads;assert.equal(roads.has(shared),true);assert.equal(roads.hasSource(shared,other.id),false);
 w.development={version:1,nextParcel:2,revision:0,cells:{},parcels:{'parcel-1':{id:'parcel-1',frame:{frontage:{roadIndex:shared,pathId:other.id}},occupant:{type:'residential',people:1}}}};
 assert.deepEqual(Buildings.frontage(w,'parcel-1',roads),[]);
 road(w,[{x:12,y:22},{x:11.4,y:22.6}]);assert.ok(Buildings.frontage(w,'parcel-1',E.analyze(w).roads).length);
});

test('motorway paint cannot provide development frontage even where its tiles share a street',()=>{
 const w=world(),street=road(w,[{x:5,y:10},{x:30,y:35}]),motorway=road(w,[{x:5,y:11.2},{x:30,y:36.2}],'motorway');
 const shared=street.tiles.find(i=>motorway.tiles.includes(i));assert.notEqual(shared,undefined);
 w.development={version:1,nextParcel:3,revision:0,cells:{},parcels:{
  'parcel-1':{id:'parcel-1',frame:{frontage:{roadIndex:shared,pathId:street.id}}},
  'parcel-2':{id:'parcel-2',frame:{frontage:{roadIndex:shared,pathId:motorway.id}}}
 }};
 const all=new Set([...street.tiles,...motorway.tiles]);assert.deepEqual(Buildings.frontage(w,'parcel-1',all),[shared]);assert.deepEqual(Buildings.frontage(w,'parcel-2',all),[]);
});
