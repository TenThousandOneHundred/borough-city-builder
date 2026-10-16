// Usage: node scripts/benchmark-zoning-layout.mjs /absolute/path/to/baseline-engine.cjs
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),E=require('../dist/engine.js'),F=require('../dist/fine-zoning-state.js'),before=require(process.argv[2]);
const w=E.createWorld('Zoning benchmark','plains',8);w.money=1e7;w.tiles.forEach(t=>t.ground='land');
for(const y of [6,14,22,30,38])assert.ok(E.buildRoadPath(w,[{x:4,y},{x:44,y}]).ok);
const raw=E.fineZoningLayout(w);w.development=F.create();F.paint(w.development,raw,[...raw.keys()],'residential_row');
for(const p of raw.values())if(p.row===0){const lot=F.reserve(w.development,raw,p.id,2,3);if(lot)lot.occupant={type:'residential',building:'townhouse',density:'medium',level:1,people:6};}
const oldWorld=structuredClone(w),newWorld=structuredClone(w),original=JSON.stringify(w),oldTimes=[],newTimes=[];
const run=(engine,world)=>{let size=0;const start=performance.now();for(let i=0;i<150;i++)size+=engine.fineZoningLayout(world).size;return {ms:performance.now()-start,size};};
for(let i=0;i<8;i++){const a=i%2?run(E,newWorld):run(before,oldWorld),b=i%2?run(before,oldWorld):run(E,newWorld);assert.equal(a.size,b.size);if(i){oldTimes.push((i%2?b:a).ms);newTimes.push((i%2?a:b).ms);}}
assert.deepEqual([...E.fineZoningLayout(newWorld)],[...before.fineZoningLayout(oldWorld)]);assert.equal(JSON.stringify(newWorld),original);assert.equal(JSON.stringify(oldWorld),original);
const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];console.log(JSON.stringify({cells:raw.size,parcels:Object.keys(w.development.parcels).length,queries:150,runs:7,beforeMs:median(oldTimes),afterMs:median(newTimes),identicalCellsAndWorld:true},null,2));
