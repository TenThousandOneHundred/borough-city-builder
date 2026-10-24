// CPU zoning reconstruction, not frame rate. Defaults to the Edition 106 release.
// GIT_BIN=/path/to/git node scripts/benchmark-zoning-collisions.mjs [baseline-ref]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import Z from '../dist/zoning-layout.js';
import {collisionFixtures} from '../tests/zoning-collision-fixtures.mjs';
const baseline=process.argv[2]||'841b4e885a4ac27290cfcf2c58433bd28f1bb25d',source=execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/zoning-layout.js'],{encoding:'utf8'}),directory=fs.mkdtempSync(path.join(os.tmpdir(),'borough-zoning-baseline-'));
const filename=path.join(directory,'zoning.cjs');fs.writeFileSync(filename,source);
const old=createRequire(import.meta.url)(filename),current=Z.layout,median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)],reports=[];
try{
 const empty=collisionFixtures().find(f=>f.name==='wide-curves').world,occupied=structuredClone(empty),grid=E.fineZoningLayout(occupied);
 occupied.development=F.create();F.paint(occupied.development,grid,[...grid.keys()],'residential_medium');
 for(const cell of grid.values())if(cell.row===0){const lot=F.reserve(occupied.development,grid,cell.id,3,4);if(lot)lot.occupant={type:'residential',building:'apartments',density:'medium',level:2,people:12};}
 for(const [name,fixture]of [['empty curved streets',empty],['developed curved streets',occupied]]){
  const times={before:[],after:[]},warm={before:[],after:[]};let snapshots;
  for(let run=0;run<26;run++)for(const [label,layout]of run%2?[['before',old.layout],['after',current]]:[['after',current],['before',old.layout]]){
   const world=structuredClone(fixture),saved=JSON.stringify(world);Z.layout=layout;
   const start=performance.now(),cells=E.fineZoningLayout(world),ms=performance.now()-start;
   if(run>=6)times[label].push(ms);
   if(run===0){snapshots ||= {};snapshots[label]=JSON.stringify([...cells]);assert.equal(JSON.stringify(world),saved);}
   if(run>=6){const start=performance.now();for(let i=0;i<40;i++)assert.equal(E.fineZoningLayout(world),cells);warm[label].push((performance.now()-start)/40);}
  }
  assert.equal(snapshots.before,snapshots.after);
  reports.push({fixture:name,parcels:Object.keys(fixture.development?.parcels||{}).length,coldMedianMs:{before:median(times.before),after:median(times.after)},cachedQueryMedianMs:{before:median(warm.before),after:median(warm.after)},identicalCellsAndWorld:true});
 }
 console.log(JSON.stringify({baseline,scope:'Complete available-zoning rebuild CPU time; excludes rendering and simulation',reports},null,2));
}finally{Z.layout=current;fs.rmSync(directory,{recursive:true,force:true});}
