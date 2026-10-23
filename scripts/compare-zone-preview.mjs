// Differential CPU benchmark. The previous engine is loaded from a git ref;
// both engines receive the same city and drags. Neither may mutate it. Not FPS.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
const ref=process.argv[2]||'d806ea3',require=createRequire(new URL('../dist/engine.js',import.meta.url)),oldModules=new Map();
function oldModule(file){
 if(oldModules.has(file))return oldModules.get(file);
 const module={exports:{}},source=execFileSync(process.env.GIT_BIN||'git',['show',ref+':dist/'+file],{encoding:'utf8'});
 new Function('require','module','exports',source)(id=>['./zoning-layout.js','./fine-zoning-state.js'].includes(id)?oldModule(id.slice(2)):require(id),module,module.exports);
 oldModules.set(file,module.exports);return module.exports;
}
const Previous=oldModule('engine.js'),median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
function fixture(occupied){
 const w=E.createWorld('Preview comparison','plains',8);w.money=1e7;
 for(const y of [6,14,32,40])E.buildRoadPath(w,[{x:3,y},{x:43,y}]);
 E.buildRoadPath(w,[{x:20,y:23},{x:32,y:18},{x:42,y:25}]);
 const rename=new Map(w.roadPaths.map((p,i)=>[p.id,'preview-comparison-'+i]));for(const p of w.roadPaths)p.id=rename.get(p.id);for(const t of w.tiles)if(t.pathIds)t.pathIds=t.pathIds.map(id=>rename.get(id)||id);
 const grid=E.fineZoningLayout(w),zones=['residential_low','residential_medium','commercial_low'];
 for(let i=0;i<zones.length;i++)E.fineZoneCells(w,[...grid.values()].filter(p=>Math.floor(p.col/4)%4===i).map(p=>p.id),zones[i]);
 if(occupied)for(const plan of E.fineZonePlan(w)){
  const start=grid.get(plan.startId);if(start.source==='preview-comparison-0'&&start.side===-1)continue;
  const p=F.reserve(w.development,grid,plan.startId,plan.width,plan.depth);assert.ok(p);const zone=E.ZONES[p.zone];p.occupant={type:zone.type,density:zone.density,level:1,people:zone.type==='residential'?4:0,variant:0};
 }
 assert.ok(E.valid(w));return w;
}
const reports=[];
for(const occupied of [false,true]){
 const base=fixture(occupied),rigs=[Previous,E].map(engine=>({engine,w:structuredClone(base),changed:[],cached:[],stroke:[]}));
 const grid=E.fineZoningLayout(base),front=[...grid.values()].filter(p=>p.source==='preview-comparison-0'&&p.side===-1&&p.row===0),anchor=front[1],before=JSON.stringify(base);
 for(let i=0;i<28;i++){
  const end=front[14+i%20],ids=E.fineZoneStrip(base,anchor,end,4),answers=[];
  for(const r of i%2?[...rigs].reverse():rigs){
   let start=performance.now();const result=r.engine.fineZonePreview(r.w,ids,'residential_medium'),changed=performance.now()-start;
   start=performance.now();for(let j=0;j<20;j++)assert.equal(r.engine.fineZonePreview(r.w,ids,'residential_medium'),result);const cached=(performance.now()-start)/20;
   start=performance.now();const stroke=r.engine.fineZoneStroke(r.w,anchor,front[55],4),strokeTime=performance.now()-start;
   if(i>=4){r.changed.push(changed);r.cached.push(cached);r.stroke.push(strokeTime);}answers.push({result,stroke});
  }
  assert.deepEqual(answers[0],answers[1]);
 }
 for(const r of rigs)assert.equal(JSON.stringify(r.w),before);
 reports.push({occupiedParcels:Object.keys(base.development.parcels).length,cells:grid.size,outputsIdentical:true,worldUnchanged:true,...Object.fromEntries(rigs.map((r,i)=>[i?'after':'before',{changedSelectionMedianMs:median(r.changed),cachedSelectionMedianMs:median(r.cached),longBrushStrokeMedianMs:median(r.stroke)}]))});
}
console.log(JSON.stringify({baseline:ref,scope:'Paired local CPU operations; not browser frame rate',measuredRuns:24,fixtures:reports},null,2));
