// Deterministic CPU benchmark; timings are not browser FPS.
import {performance} from 'node:perf_hooks';
import E from '../dist/engine.js';
const {Traffic}=await import(process.argv[2]||'../dist/traffic.js');
const w=E.createWorld('Benchmark','plains',123);for(const t of w.tiles){t.type=null;t.level=0;t.people=0;}
for(let y=0;y<48;y++)for(let x=0;x<48;x++){const t=w.tiles[y*48+x];if(y%6===0||x%8===0)Object.assign(t,{type:'road',level:1,roadType:'street'});else if(y%6===1)Object.assign(t,{type:'commercial',level:1});}
const samples=[];for(let i=0;i<12;i++){const start=performance.now();const t=new Traffic(w,E);samples.push(performance.now()-start);if(!i)console.log(JSON.stringify({roads:t.graph.size,destinations:t.trips.length,portals:t.portals.length}));}console.log(JSON.stringify({medianBuildMs:samples.sort((a,b)=>a-b)[6],runs:samples.length}));
