import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualParcels} from '../dist/parcels.js';
const city=()=>({tiles:Array.from({length:2304},()=>({type:null,level:0}))});
const home=()=>({type:'residential',density:'high',level:1,variant:0,people:12});
test('larger visual sites preserve all simulation cells and save data',()=>{const w=city();[100,101,148,149].forEach(i=>w.tiles[i]=home());const before=JSON.stringify(w),p=visualParcels(w);assert.equal(p.get(100).members.length,4);assert.equal(p.get(149).owner,100);assert.equal(JSON.stringify(w),before)});
test('visual sites respect roads, density boundaries and map edges',()=>{const w=city();[47,48,100,101,148,149].forEach(i=>w.tiles[i]=home());w.tiles[101].type='road';w.tiles[148].density='low';w.tiles[149].construction=2;const p=visualParcels(w);assert.equal(p.size,0)});
test('demolishing one cell invalidates its old visual site',()=>{const w=city();[100,101,148,149].forEach(i=>w.tiles[i]=home());const old=visualParcels(w).get(100).key;w.tiles[149]={type:null,level:0};const p=visualParcels(w);assert.notEqual(p.get(100).key,old);assert.equal(p.has(149),false)});
