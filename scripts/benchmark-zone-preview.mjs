// CPU cost of live lot planning in a large city, excluding rendering and FPS.
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {zoningDistrict} from '../tests/zoning-render-fixture.mjs';
const {world,cells}=zoningDistrict(),layout=E.fineZoningLayout(world),anchor=[...layout.values()].find(p=>!p.source.startsWith('legacy')&&p.row===0&&p.side===-1),front=[...layout.values()].filter(p=>p.source===anchor.source&&p.side===anchor.side&&p.row===0),saved=JSON.stringify(world),cold=[],warm=[];
for(let i=0;i<41;i++){
 const end=front[Math.min(front.length-1,12+i%16)],ids=E.fineZoneStrip(world,anchor,end,4),start=performance.now(),preview=E.fineZonePreview(world,ids,'residential_medium'),elapsed=performance.now()-start;
 const hit=performance.now();for(let n=0;n<25;n++)assert.equal(E.fineZonePreview(world,ids,'residential_medium'),preview);const cached=(performance.now()-hit)/25;
 if(i>5){cold.push(elapsed);warm.push(cached);}
}
assert.equal(JSON.stringify(world),saved);const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
console.log(JSON.stringify({scope:'Local CPU lot preview only; not browser FPS',cityCells:cells,changedSelectionMedianMs:median(cold),sameSelectionMedianMs:median(warm),worldUnchanged:true},null,2));
