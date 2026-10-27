import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export const economicHash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value,(_,v)=>v instanceof Set?[...v]:v)).digest('hex');

// Instrument an in-memory engine copy only. Hash every seeded factory and
// output in order, without replacing the generator or drawing extra values.
export function tracedEconomy(enginePath){
 const source=fs.readFileSync(enginePath,'utf8'),trace=crypto.createHash('sha256');
 const probe={factories:0,draws:0,seed(seed){this.factories++;trace.update('seed:'+seed+';');},draw(value){this.draws++;trace.update(value+';');},digest(){return {factories:this.factories,draws:this.draws,hash:trace.digest('hex')};}};
 const instrumentation=`const __rng=rng;rng=function(seed){__probe.seed(seed);const random=__rng(seed);return ()=>{const value=random();__probe.draw(value);return value;};};\n`;
 assert.equal(source.split('const api={').length,2);
 const load=vm.runInThisContext('(function(require,module,__probe){'+source.replace('const api={',instrumentation+'const api={')+'\nreturn module.exports;})',{filename:enginePath});
 const E=load(createRequire(enginePath),{exports:{}},probe);
 return {E,probe};
}

export function economicOracle(enginePath,input,ticks,edit){
 const {E,probe}=tracedEconomy(enginePath),w=structuredClone(input),worldTrace=crypto.createHash('sha256'),statsTrace=crypto.createHash('sha256');
 const initial=economicHash(w),coverage={legacyCompletions:0,fineCompletions:0,disconnectedTicks:0},completedLegacy=new Set(),completedFine=new Set();
 let stats;
 for(let n=0;n<ticks;n++){
  edit?.(E,w,n);stats=E.tick(w);assert.ok(E.valid(w),'world must validate after tick '+n);
  worldTrace.update(economicHash(w));statsTrace.update(economicHash(stats));
  if(stats.roads.size===0)coverage.disconnectedTicks++;
  w.tiles.forEach((t,i)=>{if(t.zoneSite&&t.type&&!t.construction&&!completedLegacy.has(i)){completedLegacy.add(i);coverage.legacyCompletions++;}});
  for(const p of Object.values(w.development?.parcels||{}))if(p.occupant&&!p.occupant.construction&&!completedFine.has(p.id)){completedFine.add(p.id);coverage.fineCompletions++;}
 }
 return {initial,final:economicHash(w),worldTrace:worldTrace.digest('hex'),statsTrace:statsTrace.digest('hex'),rng:probe.digest(),coverage,population:stats.population,money:w.money};
}
