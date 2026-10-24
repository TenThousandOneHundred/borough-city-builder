// CPU costs on a deliberate road edit, not overall frame rate.
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {collisionFixtures} from '../tests/zoning-collision-fixtures.mjs';
const world=collisionFixtures().find(f=>f.name==='wide-curves').world;world.money=1e8;const grid=E.fineZoningLayout(world);world.development=F.create();F.paint(world.development,grid,[...grid.keys()],'residential_medium');
for(const c of grid.values())if(c.row===0){const p=F.reserve(world.development,grid,c.id,3,4);if(p)p.occupant={type:'residential',building:'apartments',density:'medium',people:12,level:2,variant:0};}
const path=world.roadPaths.find(p=>p.type!=='gravel'),key=JSON.stringify(['path',path.id]),quotes=[],edits=[],after=[];
for(let run=0;run<30;run++){
 const w=structuredClone(world),before=JSON.stringify(w);E.fineZoningLayout(w);const start=performance.now();const quote=E.roadReplacementQuote(w,key,'gravel',{demolish:true}),ms=performance.now()-start;assert.ok(quote.ok,quote.reason);assert.equal(JSON.stringify(w),before);
 const time=performance.now(),result=E.replaceRoad(w,key,'gravel',{demolish:true}),edit=performance.now()-time;assert.ok(result.ok);const rebuild=performance.now();E.fineZoningLayout(w);const layout=performance.now()-rebuild;assert.ok(E.valid(w));if(run>=5){quotes.push(ms);edits.push(edit);after.push(layout);}
}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
console.log(JSON.stringify({scope:'Road-replacement quote, apply and zoning rebuild CPU time; not rendering or overall FPS',parcels:Object.keys(world.development.parcels).length,trials:quotes.length,quoteMedianMs:median(quotes),applyMedianMs:median(edits),zoningAfterEditMedianMs:median(after),validWorlds:true,quoteNeverMutatesWorld:true},null,2));
