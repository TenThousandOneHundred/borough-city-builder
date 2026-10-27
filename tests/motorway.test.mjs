import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import {laneLayout} from '../dist/road-lanes.js';

test('three-lane one-way highways expose three forward lanes and no opposing center line',()=>{
 const road=E.ROADS.motorway,lanes=laneLayout(road);
 assert.equal(road.oneway,true);assert.equal(road.limitedAccess,true);assert.equal(road.sidewalk,false);
 assert.equal(lanes.forward.length,3);assert.equal(lanes.reverse.length,0);assert.equal(lanes.dividers.length,2);assert.ok(lanes.dividers.every(p=>!p.center));
 assert.ok(lanes.forward.every((v,i)=>Math.abs(v-[1.05,0,-1.05][i])<1e-12));
});

test('one-way highways build and save but cannot create roadside zoning',()=>{
 const w=E.createWorld('Motorway','plains',8);w.money=1e6;for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});
 const r=E.buildRoadPath(w,[{x:5,y:12},{x:20,y:12},{x:30,y:20}],'motorway',{zoneSides:'left'});
 assert.ok(r.ok,r.reason);assert.equal(r.path.zoneSides,undefined);assert.ok(E.valid(w));
 assert.equal([...Z.layout(w,E.ROADS).values()].filter(c=>c.source===r.path.id).length,0);
 assert.equal(E.setRoadZoning(w,JSON.stringify(['path',r.path.id]),'both').ok,false);
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};new E.WorldStore(storage).save(w,42);assert.deepEqual(new E.WorldStore(storage).get(w.id),w);
});
