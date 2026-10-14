import {simulation} from '../tests/traffic-scale-fixture.mjs';
import {pathToFileURL} from 'node:url';
if(!process.argv[2])throw new Error('Pass the previous traffic-spatial module path as the first argument.');
const {TrafficSpatial:Old}=await import(pathToFileURL(process.argv[2]).href);
import assert from 'node:assert/strict';
function scene(angle,old){const t=simulation(512);if(old)t.spatial=new Old();const rot=p=>({x:p.x*Math.cos(angle)+p.z*Math.sin(angle),z:p.z*Math.cos(angle)-p.x*Math.sin(angle)});for(const a of t.agents){Object.assign(a,rot(a));a.points=a.points.map(rot);a.heading+=angle;}return t;}
for(const angle of [0,Math.PI/4,Math.PI/3]){let times={old:[],now:[]};for(let trial=0;trial<5;trial++){let pair={old:scene(angle,true),now:scene(angle,false)};for(const k of trial%2?['now','old']:['old','now']){const t=pair[k];for(let i=0;i<100;i++)t.update(.05);const start=performance.now();for(let i=0;i<600;i++)t.update(.05);times[k].push(performance.now()-start);}assert.deepEqual(pair.old.agents,pair.now.agents);}console.log(JSON.stringify({angle,old:times.old.sort((a,b)=>a-b)[2],now:times.now.sort((a,b)=>a-b)[2],identical:true}));}
