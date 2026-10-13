import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {simulation} from '../tests/traffic-scale-fixture.mjs';
const results=[];
for(const count of [32,128,512]){
 const timings={baseline:[],indexed:[]};
 for(let trial=0;trial<5;trial++){
  const pair={baseline:simulation(count,true),indexed:simulation(count)};
  for(const key of trial%2?['indexed','baseline']:['baseline','indexed']){
   const t=pair[key];for(let n=0;n<100;n++)t.update(.05);
   const start=performance.now();for(let n=0;n<600;n++)t.update(.05);timings[key].push(performance.now()-start);
  }
  assert.deepEqual(pair.indexed.agents,pair.baseline.agents);assert.equal(pair.indexed.completed,pair.baseline.completed);
 }
 const median=values=>values.sort((a,b)=>a-b)[2];
 results.push({agents:count,steps:600,baselineMs:median(timings.baseline),indexedMs:median(timings.indexed),identical:true});
}
console.log(JSON.stringify(results,null,2));
