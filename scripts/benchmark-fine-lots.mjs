// Compare reservation outcomes and CPU work; this does not measure browser FPS.
// Usage: node scripts/benchmark-fine-lots.mjs /path/to/previous-fine-zoning-state.cjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../dist/fine-zoning-state.js',import.meta.url));
const E=require('./engine.js'),F=require('./fine-zoning-state.js');
const baseline=process.argv[2];if(!baseline)throw Error('Pass the previous fine zoning module');
const context={module:{exports:{}},require};vm.runInNewContext(fs.readFileSync(baseline,'utf8'),context);const previous=context.module.exports;
const world=E.createWorld('Lot reservation benchmark','plains',8);world.money=1e6;
for(const y of [8,16,32,40])E.buildRoadPath(world,[{x:3,y},{x:43,y}]);
const layout=F.grid(world,E.ROADS),ids=[...layout.keys()],starts=[...layout.values()].filter(p=>p.row===0),shapes=[[6,6],[4,4],[3,3],[2,3],[1,2]];
function run(api){const state=api.create();api.paint(state,layout,ids,'residential_medium');const start=performance.now();let attempts=0;for(const p of starts)for(const [width,depth]of shapes){attempts++;if(api.reserve(state,layout,p.id,width,depth))break;}return {state,attempts,cpuMs:performance.now()-start};}
// Warm both implementations before alternating measured runs.
run(previous);run(F);const before=[],after=[];let report;
for(let i=0;i<5;i++){const a=run(previous),b=run(F);assert.equal(JSON.stringify(b.state),JSON.stringify(a.state));before.push(a.cpuMs);after.push(b.cpuMs);report={cells:layout.size,attempts:a.attempts,parcels:Object.keys(b.state.parcels).length};}
const median=xs=>xs.sort((a,b)=>a-b)[2];
console.log(JSON.stringify({...report,beforeMedianMs:median(before),afterMedianMs:median(after),identicalSavedParcels:true,scope:'CPU reservation fixture; not browser FPS'},null,2));
