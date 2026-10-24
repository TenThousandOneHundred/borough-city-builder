// Frozen-release differential simulation benchmark. No renderer or GPU is involved.
// GIT_BIN=/path/to/git node scripts/benchmark-junction-occupancy.mjs [baseline-ref]
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {trafficCity} from '../tests/traffic-city-fixture.mjs';
import {Traffic} from '../dist/traffic.js';
const baseline=process.argv[2]||'d194293',base=new URL('../dist/',import.meta.url).href;
const read=name=>execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/'+name],{encoding:'utf8'});
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const oldJunctions=url(read('junctions.js')),oldSpatial=url(read('traffic-spatial.js'));
const source=read('traffic.js').replace(/from '\.\/junctions\.js[^']*'/,`from '${oldJunctions}'`).replace(/from '\.\/traffic-spatial\.js[^']*'/,`from '${oldSpatial}'`).replaceAll("'./","'"+base);
const {Traffic:OldTraffic}=await import(url(source));
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],reports=[];
for(const [rows,agents] of [[1,32],[3,128],[7,512]]){
 const times={before:[],after:[]},trips=[];let population;
 for(let trial=0;trial<3;trial++){
  const pair={before:trafficCity({TrafficClass:OldTraffic,rows,agents}),after:trafficCity({TrafficClass:Traffic,rows,agents})};
  for(const side of trial%2?['after','before']:['before','after']){
   const sim=pair[side];for(let n=0;n<600;n++)sim.step();
   const start=performance.now();for(let n=0;n<1800;n++)sim.step();times[side].push(performance.now()-start);
  }
  assert.deepEqual(pair.after.world,pair.before.world,'saved citizens and world state must match');
  assert.deepEqual(pair.after.traffic.agents,pair.before.traffic.agents,'all active/offscreen vehicle states must match');
  assert.deepEqual(pair.after.traffic.summary,pair.before.traffic.summary);
  assert.equal(pair.after.traffic.completed,pair.before.traffic.completed);
  population=pair.after.residents.summary.population;trips.push(pair.after.traffic.completed);
 }
 reports.push({population,vehicleSlots:agents,steps:1800,simulatedSeconds:90,beforeMedianMs:median(times.before),afterMedianMs:median(times.after),samples:times,completedTrips:trips,identicalWorldAndJourneys:true});
}
console.log(JSON.stringify({baseline,scope:'Complete traffic, transit, walking and resident simulation CPU time; rendering, engine growth ticks and GPU work excluded',reports},null,2));
