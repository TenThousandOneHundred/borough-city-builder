// Frozen-release comparison. Rendering and engine growth ticks are excluded.
// GIT_BIN=/path/to/git node scripts/benchmark-traffic-following.mjs [baseline]
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {trafficCity} from '../tests/traffic-city-fixture.mjs';
import {Traffic} from '../dist/traffic.js';
import E from '../dist/engine.js';
import R from '../dist/roundabout-state.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
const baseline=process.argv[2]||'6751dfb0820b4479e07f3e21509670610b6fc7af',base=new URL('../dist/',import.meta.url).href;
const read=name=>execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/'+name],{encoding:'utf8'}),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const oldSpatial=url(read('traffic-spatial.js')),source=read('traffic.js').replace(/from '\.\/traffic-spatial\.js[^']*'/,`from '${oldSpatial}'`).replaceAll("'./","'"+base),{Traffic:Before}=await import(url(source));
function city(TrafficClass,rows,agents,roundabouts){const sim=trafficCity({TrafficClass,rows,agents});if(roundabouts){const w=sim.world;w.money=1e7;for(const y of [12,24,36].filter(y=>y<6+rows*6)){const x=24;for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++){const t=w.tiles[yy*48+xx];if(t.type!=='road')Object.assign(t,{type:null,level:0,people:0});}const js=roadGeometry(w,E).junctions,j=js.find(j=>Math.hypot(j.x-((x+.5)*4-96),j.z-((y+.5)*4-96))<.01),q=R.apply(w,js,R.key(j),'medium',E);assert.ok(q.ok,q.reason);}sim.traffic.rebuild(w);sim.transit.rebuild();sim.residents.reconcile();}return sim;}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],reports=[];
for(const [rows,agents,roundabouts]of [[1,32,false],[3,128,false],[7,512,false],[3,128,true],[7,512,true]]){const times={before:[],after:[]},completed=[];let population;
 for(let trial=0;trial<3;trial++){const pair={before:city(Before,rows,agents,roundabouts),after:city(Traffic,rows,agents,roundabouts)};for(const side of trial%2?['after','before']:['before','after']){const sim=pair[side];for(let n=0;n<600;n++)sim.step();const start=performance.now();for(let n=0;n<1800;n++)sim.step();times[side].push(performance.now()-start);}assert.deepEqual(pair.after.world,pair.before.world);assert.deepEqual(pair.after.traffic.agents,pair.before.traffic.agents);assert.deepEqual(pair.after.traffic.summary,pair.before.traffic.summary);assert.equal(pair.after.traffic.completed,pair.before.traffic.completed);population=pair.after.residents.summary.population;completed.push(pair.after.traffic.completed);}
 const report={population,vehicleSlots:agents,roundabouts,steps:1800,simulatedSeconds:90,beforeMedianMs:median(times.before),afterMedianMs:median(times.after),samples:times,completedTrips:completed,identicalWorldAndJourneys:true};reports.push(report);console.error(JSON.stringify(report));}
console.log(JSON.stringify({baseline,scope:'Traffic, walking, transit and resident simulation CPU; rendering, engine growth and GPU excluded',reports},null,2));
