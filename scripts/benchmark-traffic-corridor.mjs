import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {simulation} from '../tests/traffic-scale-fixture.mjs';
if(!process.argv[2])throw Error('Pass the previous spatial-index module path');
const {TrafficSpatial:Before}=await import(pathToFileURL(process.argv[2]));
const times={before:[],after:[]};
for(let run=0;run<7;run++){
 const pair=[['before',true],['after',false]];if(run%2)pair.reverse();const states={};
 for(const [name,baseline]of pair){const t=simulation(512);if(baseline)t.spatial=new Before();const start=performance.now();for(let i=0;i<1200;i++)t.update(.05);const elapsed=performance.now()-start;if(run)times[name].push(elapsed);states[name]=JSON.stringify({agents:t.agents,summary:t.summary,completed:t.completed,time:t.time});}
 assert.equal(states.before,states.after,'every position, queue and arrival must match the previous implementation exactly');
}
for(const [name,values]of Object.entries(times)){values.sort((a,b)=>a-b);console.log(name,values[Math.floor(values.length/2)].toFixed(1)+' ms median for 512 vehicles / 60 simulated seconds');}
console.log('All saved agent states, queue summaries and completed trip counts match exactly. No renderer was involved.');
