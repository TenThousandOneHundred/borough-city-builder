import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrafficSpatial} from '../dist/traffic-spatial.js';
import {simulation} from './traffic-scale-fixture.mjs';
import {trafficCity} from './traffic-city-fixture.mjs';

const scan=(agents,point,radius,except)=>agents.some(b=>b!==except&&b.active&&Math.hypot(b.x-point.x,b.z-point.z)<radius);

test('indexed junction occupancy matches circle scans during movement, departures and fleet resets',()=>{
 let seed=817;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const agents=Array.from({length:512},(_,i)=>({active:true,x:random()*240-120,z:random()*240-120,hold:i%7===0,dwell:i%9===0?4:0})),spatial=new TrafficSpatial();spatial.reset(agents);
 for(let n=0;n<2000;n++){
  const except=agents[n%512],point=n%2?{x:random()*240-120,z:random()*240-120}:{x:except.x,z:except.z},radius=n%11===0?0:.05+random()*12;
  assert.equal(spatial.occupied(point,radius,except),scan(agents,point,radius,except),JSON.stringify({step:n,point,radius,found:agents.filter(b=>b!==except&&b.active&&Math.hypot(b.x-point.x,b.z-point.z)<radius).map(b=>({x:b.x,z:b.z,xBucket:spatial.x.get(Math.floor(b.x/4))?.includes(b),zBucket:spatial.z.get(Math.floor(b.z/4))?.includes(b)}))}));
  except.x+=(random()-.5)*20;except.z+=(random()-.5)*20;spatial.move(except);
  if(n%17===0)except.active=false;
  if(n%73===0){except.active=true;spatial.reset(agents);}
 }
});

test('strict circle edges, held buses, dwelling cars and negative bucket boundaries retain occupancy',()=>{
 const center={x:-4,z:4},radius=4,agents=[{active:true,x:0,z:4,hold:true},{active:true,x:-8,z:4,dwell:4},{active:true,x:-4,z:0}],spatial=new TrafficSpatial();spatial.reset(agents);
 assert.equal(spatial.occupied(center,radius),false,'the exact boundary is outside');
 for(const a of agents){const old={x:a.x,z:a.z};a.x+=(center.x-a.x)*1e-10;a.z+=(center.z-a.z)*1e-10;spatial.move(a);assert.equal(spatial.occupied(center,radius),true);assert.equal(spatial.occupied(center,radius,a),false,'querying vehicle is excluded');a.active=false;assert.equal(spatial.occupied(center,radius),false);Object.assign(a,old,{active:true});spatial.move(a);}
 agents.push({active:true,x:center.x,z:center.z});spatial.reset(agents);assert.equal(spatial.occupied(center,.05),true);assert.equal(spatial.occupied(center,0),false);
});

test('512 cars and held buses keep identical queues and arrivals under signals and stop controls',()=>{
 const current=simulation(512),baseline=simulation(512);baseline.spatial.occupied=undefined;
 for(let step=0;step<1600;step++){
  if(step===500)for(const t of [current,baseline])t.world.trafficPolicy='stop';
  if(step===900)for(const t of [current,baseline])t.world.trafficPolicy='signals';
  for(const t of [current,baseline])t.update(.05);
  if(step%80===0){assert.deepEqual(current.agents,baseline.agents);assert.deepEqual(current.summary,baseline.summary);}
 }
 assert.deepEqual(current.agents,baseline.agents);assert.equal(current.completed,baseline.completed);assert.ok(current.completed>0);
});

test('populated cities preserve exact resident journeys, road rebuilds and saved data without rendering',()=>{
 const current=trafficCity({rows:3,agents:256}),baseline=trafficCity({rows:3,agents:256});baseline.traffic.spatial.occupied=undefined;
 for(let n=0;n<1800;n++){
  if(n===900)for(const s of [current,baseline]){s.world.tiles[18*48+20].type=null;s.traffic.rebuild(s.world);s.transit.rebuild();s.residents.reconcile();}
  for(const s of [current,baseline])s.step();
  if(n%150===0){assert.deepEqual(current.world,baseline.world);assert.deepEqual(current.traffic.agents,baseline.traffic.agents);}
 }
 assert.deepEqual(current.world,baseline.world);assert.deepEqual(current.traffic.agents,baseline.traffic.agents);assert.equal(current.traffic.completed,baseline.traffic.completed);
 assert.ok(current.world.citizens.residents.some(r=>r.workdays>0));assert.ok(current.world.citizens.residents.some(r=>r.shopping>0));
});
