import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrafficSpatial} from '../dist/traffic-spatial.js';
import {simulation} from './traffic-scale-fixture.mjs';
const random=()=>{let s=71829;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);};
function matches(a,b,f){return b!==a&&b.active&&Math.abs((b.x-a.x)*f.z-(b.z-a.z)*f.x)<.65;}
test('lane search includes every possible leader across arbitrary headings and sequential movement',()=>{
 const rng=random(),agents=Array.from({length:512},()=>({active:true,x:rng()*600-300,z:rng()*600-300})),index=new TrafficSpatial();index.reset(agents);
 for(let n=0;n<1600;n++){
  const a=agents[n%agents.length],angle=n%4===0?Math.PI*(n%8)/4:rng()*Math.PI*2,f={x:Math.sin(angle),z:Math.cos(angle)};
  const candidates=new Set(index.corridor(a,f));for(const b of agents)if(matches(a,b,f))assert.ok(candidates.has(b),'leader omitted');
  a.x+=(rng()-.5)*50;a.z+=(rng()-.5)*50;index.move(a);
 }
});
test('bucket boundaries, held buses, new arrivals and departed agents remain conservative',()=>{
 const agents=Array.from({length:128},(_,i)=>({active:true,x:i*4,z:i%5*4})),index=new TrafficSpatial(),a=agents[0];
 agents[1]={active:true,hold:true,x:0.649999999,z:400};agents[2]={active:true,dwell:4,x:-.649999999,z:-400};index.reset(agents);
 const candidates=index.corridor(a,{x:0,z:1});assert.ok(candidates.includes(agents[1]));assert.ok(candidates.includes(agents[2]));
 agents[1].x=-8;index.move(agents[1]);assert.ok(!index.corridor(a,{x:0,z:1}).includes(agents[1]));
 agents[1].active=false;agents.push({active:true,x:0,z:20});index.reset(agents);assert.ok(index.corridor(a,{x:0,z:1}).includes(agents.at(-1)));assert.ok(!index.active.includes(agents[1]));
});
test('512 cars and buses retain exact full-scan positions, queues and arrivals over 120 seconds',()=>{
 const indexed=simulation(512),baseline=simulation(512,true);
 for(let step=0;step<2400;step++){
  indexed.update(.05);baseline.update(.05);
  if(step%80===0){assert.deepEqual(indexed.agents,baseline.agents);assert.deepEqual(indexed.summary,baseline.summary);assert.equal(indexed.completed,baseline.completed);}
 }
 assert.deepEqual(indexed.agents,baseline.agents);assert.equal(indexed.completed,baseline.completed);assert.ok(indexed.completed>0);
});

test('car capacity grows with population and preserves all saved road trips',async()=>{
 const {carCapacity}=await import('../dist/traffic.js');const world={tiles:[{type:'residential',people:128}]};assert.equal(carCapacity(world),32);world.tiles[0].people=1024;assert.equal(carCapacity(world),256);world.tiles[0].people=5000;assert.equal(carCapacity(world),512);world.citizens={residents:Array.from({length:600},()=>({trip:{}}))};assert.equal(carCapacity(world),600);
});
test('growing the fleet preserves running cars and never shrinks active journeys',async()=>{
 const {CityView}=await import('../dist/renderer.js'),THREE=await import('../dist/vendor/three.module.js');const view=Object.create(CityView.prototype),traffic=simulation(32),cars=traffic.agents.map(agent=>({agent,mesh:new THREE.Group()}));let builds=0;
 Object.assign(view,{traffic,cars,world:{tiles:[{type:'residential',people:1024}]},carModel:()=>new THREE.Group(),vehicles:{rebuildFleet(){builds++;}}});const old=traffic.agents.slice(),state=JSON.stringify(old);view.ensureCarCapacity();assert.equal(cars.filter(c=>c.agent.kind!=='bus').length,256);assert.equal(builds,1);assert.deepEqual(traffic.agents.slice(0,32),old);assert.equal(JSON.stringify(old),state);view.ensureCarCapacity();assert.equal(builds,1);view.world.tiles[0].people=0;view.ensureCarCapacity();assert.equal(cars.filter(c=>c.agent.kind!=='bus').length,256);assert.equal(JSON.stringify(old),state);
});

test('a thousand residents receive a fair departure check within twenty scheduling ticks',async()=>{
 const {Residents}=await import('../dist/residents.js'),r=Object.create(Residents.prototype),seen=new Set();Object.assign(r,{state:{time:0,residents:Array.from({length:1000},(_,id)=>({id,nextAt:0}))},agents:new Map(),cursor:0,destination:()=>[1,'work'],depart(person){seen.add(person.id);return false;}});for(let i=0;i<20;i++)r.update(.5);assert.equal(seen.size,1000);
});

test('dense diagonal queries stay conservative after sequential cell crossings and resets',()=>{
 const rng=random(),agents=Array.from({length:512},()=>({active:true,x:rng()*240-120,z:rng()*240-120})),index=new TrafficSpatial();index.reset(agents);
 for(let n=0;n<900;n++){
  const a=agents[n%512],angle=Math.PI/4+(rng()-.5)*.1,f={x:Math.sin(angle),z:Math.cos(angle)},candidates=index.corridor(a,f);
  assert.equal(index.diagonalReady,true);assert.equal(new Set(candidates).size,candidates.length);
  for(const b of agents)if(matches(a,b,f))assert.ok(candidates.includes(b),'diagonal leader omitted');
  a.x=rng()*240-120;a.z=rng()*240-120;index.move(a);
 }
 agents[3].active=false;index.reset(agents);assert.equal(index.diagonalReady,false);
 const candidates=index.corridor(agents[0],{x:Math.SQRT1_2,z:Math.SQRT1_2});assert.equal(index.diagonalReady,true);assert.ok(!candidates.includes(agents[3]));
});
test('diagonal traffic preserves exact full-scan journeys through turns',()=>{
 const pair=[simulation(512),simulation(512,true)],angle=Math.PI/4;
 for(const t of pair)for(const a of t.agents){const rotate=p=>({x:(p.x+p.z)*Math.SQRT1_2,z:(p.z-p.x)*Math.SQRT1_2});Object.assign(a,rotate(a));a.points=a.points.map(rotate);a.heading+=angle;}
 for(let i=0;i<2400;i++){for(const t of pair)t.update(.05);if(i%80===0){assert.deepEqual(pair[0].agents,pair[1].agents);assert.deepEqual(pair[0].summary,pair[1].summary);}}
 assert.deepEqual(pair[0].agents,pair[1].agents);assert.equal(pair[0].completed,pair[1].completed);assert.ok(pair[0].completed>0);
});

test('single-bin straight and diagonal lanes avoid candidate copies and retain moving leaders',()=>{
 for(const diagonal of [false,true]){
  const agents=Array.from({length:128},(_,i)=>({active:true,x:diagonal?i*3:2,z:diagonal?i*3+2:i*3})),index=new TrafficSpatial(),forward=diagonal?{x:Math.SQRT1_2,z:Math.SQRT1_2}:{x:0,z:1};index.reset(agents);
  const before=JSON.stringify(agents),result=index.corridor(agents[0],forward);
  assert.equal(result.length,agents.length);assert.equal(index.candidates.length,0,'single-bin searches do not populate a second candidate array');assert.equal(JSON.stringify(agents),before);
  const lead=agents[1];lead.x+=20;index.move(lead);assert.ok(!index.corridor(agents[0],forward).includes(lead));lead.x-=20;index.move(lead);assert.ok(index.corridor(agents[0],forward).includes(lead));
 }
});
