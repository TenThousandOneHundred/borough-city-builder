import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Traffic} from '../dist/traffic.js';
import {rebuildCity,trafficResult,E,addRoad} from './fixtures/traffic-rebuild.mjs';
const oracle=JSON.parse(fs.readFileSync(new URL('./fixtures/traffic-rebuild-171.json',import.meta.url)));
class CountedTraffic extends Traffic {search(...args){(this.searchCalls||=[]).push({start:args[0],reverse:args[1]===this.reverseGraph});return super.search(...args);}}

test('road edits with no completed or reachable destinations perform no portal searches',()=>{
 const w=rebuildCity(72,{populated:false}),t=new CountedTraffic(w,E);assert.ok(t.portals.length>=6);assert.equal(t.searchCalls?.length||0,0);
 Object.assign(w.tiles[2*72+2],{type:'commercial',level:2});t.rebuild(w);assert.equal(t.searchCalls?.length||0,0,'isolated destinations have no frontage to search');
 Object.assign(w.tiles[2*72+2],{construction:true});t.rebuild(w);assert.equal(t.searchCalls?.length||0,0);
});
test('one destination searches only the required entrance and exit while retaining its trip',()=>{
 const w=rebuildCity(48,{populated:false});Object.assign(w.tiles[11*48+6],{type:'commercial',level:2});const t=new CountedTraffic(w,E);
 assert.equal(t.trips.length,1);assert.equal(t.searchCalls.length,2);assert.deepEqual(t.searchCalls.map(s=>s.reverse),[false,true]);assert.ok(t.searchCalls.length<t.portals.length*2);
});
test('cached traffic rebuilds match the released eager routes across map sizes and one-way roads',()=>{
 for(const size of [48,72,96])for(const oneway of [false,true]){
  const w=rebuildCity(size,{oneway}),t=new Traffic(w,E),key=size+'/'+oneway,hash=()=>createHash('sha256').update(JSON.stringify(trafficResult(t))).digest('hex');
  assert.equal(hash(),oracle.hashes[key],key);addRoad(w,[{x:17,y:7},{x:17,y:41}],'avenue');t.rebuild(w);assert.equal(hash(),oracle.hashes[key+'/addition'],key+' addition');
 }
});
test('unchanged roads reuse exact samples while controls, tile order and sampler changes invalidate them',()=>{
 const w=rebuildCity(),t=new Traffic(w,E),path=w.roadPaths[0],initial=t.samples.get(path.id);addRoad(w,[{x:17,y:7},{x:17,y:41}],'street');t.rebuild(w);
 assert.equal(t.samples.get(path.id).samples,initial.samples);assert.equal(t.samples.get(path.id).mapping,initial.mapping);
 path.type='avenue';t.rebuild(w);assert.equal(t.samples.get(path.id).samples,initial.samples);assert.equal(t.samples.get(path.id).spec,E.ROADS.avenue);
 path.controls[0].y+=.1;t.rebuild(w);assert.notEqual(t.samples.get(path.id).samples,initial.samples);let previous=t.samples.get(path.id);path.tiles.reverse();t.rebuild(w);assert.notEqual(t.samples.get(path.id).mapping,previous.mapping);
 previous=t.samples.get(path.id);t.engine={...E,sampleRoad:(...args)=>E.sampleRoad(...args)};t.rebuild(w);assert.notEqual(t.samples.get(path.id).samples,previous.samples);
 assert.deepEqual(trafficResult(t),trafficResult(new Traffic(w,t.engine)));
});
test('switching map dimensions cannot reuse the old coordinate origin and removed paths release cached arrays',()=>{
 const a=rebuildCity(48),t=new Traffic(a,E),old=[...t.samples.values()][0],b=rebuildCity(96);t.rebuild(b);assert.notEqual([...t.samples.values()][0].samples,old.samples);assert.deepEqual(trafficResult(t),trafficResult(new Traffic(b,E)));
 const removed=b.roadPaths.pop().id;t.rebuild(b);assert.ok(!t.samples.has(removed)&&!t.sampleKeys.has(removed));
});
test('active journeys remain identical to fresh-sample rebuilds and advance without rendering',()=>{
 const worlds=[rebuildCity(),rebuildCity()],pair=worlds.map(w=>new Traffic(w,E));for(const t of pair){for(let i=0;i<12;i++)t.addAgent();t.update(10);assert.ok(t.active);}
 for(let step=0;step<1200;step++){
  if(step===100){for(let i=0;i<2;i++){addRoad(worlds[i],[{x:17,y:7},{x:17,y:41}],'street');if(i===1)pair[i].sampleKeys.clear();pair[i].rebuild(worlds[i]);}}
  for(const t of pair)t.update(.05);if(step%50===0)assert.deepEqual(pair[0].agents,pair[1].agents);
 }
 assert.deepEqual(pair[0].agents,pair[1].agents);assert.equal(pair[0].completed,pair[1].completed);assert.ok(pair[0].completed>0);
});

test('network reuse keeps centerlines but reconstructs connectivity after membership and direction edits',()=>{
 const w=rebuildCity(),t=new Traffic(w,E),key=JSON.stringify(['path',w.roadPaths[0].id]),first=t.network,shape=first.records.get(key);
 addRoad(w,[{x:17,y:7},{x:17,y:41}],'street');t.rebuild(w);let record=t.network.records.get(key);
 assert.equal(record.points,shape.points);assert.equal(record.mapping,shape.mapping);assert.notEqual(record.states,shape.states);assert.notEqual(t.network.graph,first.graph);
 const path=w.roadPaths[0];path.type='oneway';t.rebuild(w);assert.equal(t.network.records.get(key).points,shape.points);assert.equal(t.network.records.get(key).spec,E.ROADS.oneway);assert.deepEqual(trafficResult(t),trafficResult(new Traffic(structuredClone(w),E)));
 const removed=path.tiles[5];w.tiles[removed].pathIds=[];w.tiles[removed].type=null;record=t.network.records.get(key);t.rebuild(w);assert.notEqual(t.network.records.get(key).mapping,record.mapping);assert.ok(!t.network.records.get(key).mapping.has(removed));assert.deepEqual(trafficResult(t),trafficResult(new Traffic(structuredClone(w),E)));
});
test('network sample cache invalidates for curves, reordered tiles, sampler changes and an in-place map-size change',()=>{
 const w=rebuildCity(),t=new Traffic(w,E),path=w.roadPaths[0],key=JSON.stringify(['path',path.id]);
 const verify=()=>assert.deepEqual(trafficResult(t),trafficResult(new Traffic(structuredClone(w),t.engine)));
 let old=t.network.records.get(key);path.controls.splice(1,0,{x:20,y:12.15});t.rebuild(w);assert.notEqual(t.network.records.get(key).points,old.points);verify();
 old=t.network.records.get(key);path.tiles.reverse();t.rebuild(w);assert.notEqual(t.network.records.get(key).mapping,old.mapping);verify();
 old=t.network.records.get(key);t.engine={...E,sampleRoad:(...a)=>E.sampleRoad(...a)};t.rebuild(w);assert.notEqual(t.network.records.get(key).points,old.points);verify();
 // The source object and its road serialization can stay the same while the
 // coordinate context changes. A cache keyed only by road data must not survive.
 old=t.network;w.mapSize=72;t.rebuild(w);assert.notEqual(t.network,old);verify();
});
