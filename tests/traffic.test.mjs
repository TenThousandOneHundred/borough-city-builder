import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {Traffic,outsidePortals} from '../dist/traffic.js';
const E=createRequire(import.meta.url)('../dist/engine.js');
function city(){const w=E.createWorld('Trips','flat',123);for(const t of w.tiles){t.type=null;t.level=0;}for(let x=0;x<12;x++)w.tiles[24*48+x]={type:'road',ground:'land',roadType:'street'};w.tiles[23*48+10]={type:'commercial',level:1,ground:'land'};return w;}
test('only edge roads are outside portals; isolated and empty networks create no trips',()=>{const w=city(),traffic=new Traffic(w,E);assert.equal(outsidePortals(w).length,1);assert.equal(traffic.trips.length,1);w.tiles[24*48+5].type=null;traffic.rebuild(w);assert.equal(traffic.trips.length,0);w.tiles[24*48].type=null;assert.equal(outsidePortals(w).length,0);});
test('trips begin outside, visit a destination, and finish outside without random internal spawning',()=>{const w=city(),before=JSON.stringify(w),t=new Traffic(w,E),a=t.addAgent();t.update(2);assert.equal(a.active,true);assert.ok(a.x< -96);let visited=false;for(let i=0;i<3000&&t.completed===0;i++){t.update(.05);if(a.dwell>0)visited=true;}assert.ok(visited);assert.equal(t.completed,1);assert.equal(a.active,false);assert.ok(a.x< -96);assert.equal(JSON.stringify(w),before);});
test('road changes retain valid trips and cancel severed routes',()=>{const w=city(),t=new Traffic(w,E),a=t.addAgent();t.update(2);const trip=a.trip;w.tiles[24*48+12]={type:'road',ground:'land'};t.rebuild(w);assert.equal(a.trip,trip);assert.ok(a.active);w.tiles[24*48+4].type=null;t.rebuild(w);assert.equal(a.active,false);});
test('one-way links follow authored direction and require a valid return route',()=>{const w=city();for(let x=1;x<11;x++)w.tiles[24*48+x].roadType='oneway';const t=new Traffic(w,E);assert.equal(t.trips.length,0);assert.ok(!t.graph.get(24*48+4).includes(24*48+3));});
test('authored curves use cached curve geometry and remain finite',()=>{const w=city();w.money=100000;const result=E.buildRoadPath(w,[{x:0,y:24},{x:5,y:27},{x:11,y:24}],'street');assert.ok(result.ok);const t=new Traffic(w,E);assert.ok(t.trips.length);assert.ok(t.samples.size>0);for(const trip of t.trips)for(const p of [...trip.inbound,...trip.outbound]){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));}const a=t.addAgent();t.update(2);const before={x:a.x,z:a.z};t.update(0);assert.deepEqual({x:a.x,z:a.z},before);});

test('crossing traffic obeys lights, queues, and eventually clears every approach',()=>{
 const w=city();for(let y=19;y<=29;y++)w.tiles[y*48+6]={type:'road',ground:'land',roadType:'street'};const t=new Traffic(w,E);t.trips=[];
 const j=t.junctions.items[0];assert.equal(t.junctions.items.length,1);
 const make=(points)=>Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x:points[0].x,z:points[0].z,heading:Math.atan2(points[1].x-points[0].x,points[1].z-points[0].z)});
 const x=make([{x:j.x-12,z:j.z+.48},{x:j.x+12,z:j.z+.48}]),z=make([{x:j.x-.48,z:j.z-12},{x:j.x-.48,z:j.z+12}]);let redWait=false;
 for(let i=0;i<800&&(x.active||z.active);i++){t.update(.05);redWait ||= z.waitReason==='Red signal';if(x.active&&z.active)assert.ok(Math.hypot(x.x-z.x,x.z-z.z)>1,'cars must not collide in crossing');}
 assert.ok(redWait);assert.equal(t.completed,2);assert.ok(!x.active&&!z.active);
});
test('all-way stop queues make progress; paused traffic remains stationary',()=>{
 const w=city();w.trafficPolicy='stop';for(let y=20;y<29;y++)w.tiles[y*48+6]={type:'road',ground:'land'};const t=new Traffic(w,E);t.trips=[];const j=t.junctions.items[0];
 for(let n=0;n<4;n++){const points=[{x:j.x-10-n*2.2,z:j.z+.48},{x:j.x+14,z:j.z+.48}];Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x:points[0].x,z:points[0].z,heading:Math.PI/2});}
 const before=JSON.stringify(t.agents);t.update(0);assert.equal(JSON.stringify(t.agents),before);let queued=false;for(let i=0;i<1600&&t.completed<4;i++){t.update(.05);queued ||= t.summary.queued>0;const active=t.agents.filter(a=>a.active).sort((a,b)=>a.x-b.x);for(let n=1;n<active.length;n++)assert.ok(active[n].x-active[n-1].x>=1.6);}
 assert.ok(queued);assert.equal(t.completed,4);
});
test('intersection policy survives verified world save and rejects invalid policies',()=>{const w=E.createWorld('Policy','plains',22);w.trafficPolicy='stop';const storage={v:null,getItem(){return this.v},setItem(k,v){this.v=v}},store=new E.WorldStore(storage);store.save(w);assert.equal(new E.WorldStore(storage).get(w.id).trafficPolicy,'stop');w.trafficPolicy='invalid';assert.equal(E.valid(w),false);});
