import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {TreeSelection} from '../dist/tree-selection.js';
let seed=37;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const records=Array.from({length:5000},(_,i)=>({i,x:random()*192-96,y:random()*8,z:random()*192-96,h:2+random()*6,source:i%9!==0}));
const cameras=Array.from({length:1200},(_,i)=>({x:Math.sin(i*.015)*80,y:8,z:Math.cos(i*.015)*80}));
const baseline=(records,camera,near)=>records.map(r=>({r,d:(r.x-camera.x)**2+(r.y+r.h*.5-camera.y)**2+(r.z-camera.z)**2})).filter(({r,d})=>r.source&&d<(near.has(r.i)?32:28)**2).sort((a,b)=>a.d-b.d||a.r.i-b.r.i).slice(0,10).map(a=>a.r);
const selection=new TreeSelection();
function run(fn){const near=new Map();let checksum=0;const start=performance.now();for(const camera of cameras){const picked=fn(records,camera,near);near.clear();for(const r of picked){near.set(r.i,true);checksum=(checksum+r.i)>>>0;}}return{ms:performance.now()-start,checksum};}
run(baseline);run(selection.select.bind(selection));const old=[],now=[];
for(let i=0;i<7;i++){const a=run(baseline),b=run(selection.select.bind(selection));assert.equal(a.checksum,b.checksum);old.push(a.ms);now.push(b.ms);}
const median=a=>a.sort((a,b)=>a-b)[3];const before=median(old),after=median(now);console.log(JSON.stringify({trees:records.length,cameraMoves:cameras.length,trials:7,beforeMedianMs:before,afterMedianMs:after,cpuReductionPercent:100*(1-after/before),sameSelection:true},null,2));
