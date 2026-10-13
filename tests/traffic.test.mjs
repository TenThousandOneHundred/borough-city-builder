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
test('cached search trees invalidate after road edits and reverse exit routes respect directed links',()=>{const w=city(),t=new Traffic(w,E),start=24*48;assert.equal(t.search(start),t.search(start));const previous=t.search(start);w.tiles[start+4].type=null;t.rebuild(w);assert.notEqual(t.search(start),previous);assert.equal(t.search(start).has(start+10),false);w.tiles[start+4].type='road';t.rebuild(w);for(const trip of t.trips)for(const cells of trip.cells)for(let i=0;i<cells.length-1;i++)assert.ok(t.graph.get(cells[i]).includes(cells[i+1]));});
test('a reservation held by a queued approach releases so the leading vehicle can clear',()=>{const w=city();for(let y=20;y<29;y++)w.tiles[y*48+6]={type:'road',ground:'land'};const t=new Traffic(w,E);t.trips=[];const j=t.junctions.items[0],points=[{x:j.x-12,z:j.z+.48},{x:j.x+12,z:j.z+.48}];const make=x=>Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:x-points[0].x,x,z:j.z+.48,heading:Math.PI/2});const rear=make(j.x-3.1),front=make(j.x-2.1);j.owner=rear;rear.gatePoints=points;t.update(.05);assert.notEqual(j.owner,rear);for(let i=0;i<800&&t.completed<2;i++)t.update(.05);assert.equal(t.completed,2);});
test('a car beyond the exit keeps clearing even when another car owns the intersection',()=>{const w=city();for(let y=20;y<29;y++)w.tiles[y*48+6]={type:'road',ground:'land'};const t=new Traffic(w,E);t.trips=[];const j=t.junctions.items[0],points=[{x:j.x-12,z:j.z+.48},{x:j.x+12,z:j.z+.48}],a=Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:12+j.radius+1,x:j.x+j.radius+1,z:j.z+.48,heading:Math.PI/2});j.owner={active:true,points,gatePoints:points};const x=a.x;t.update(.1);assert.ok(a.x>x);});

test('uninterrupted curved roads never create phantom traffic-light or stop-sign junctions',()=>{
 for(const type of ['street','avenue','highway']){
  const w=city();w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.money=1000000;assert.ok(E.buildRoadPath(w,[{x:5,y:15},{x:24,y:35},{x:42,y:15}],type).ok);const before=JSON.stringify(w),t=new Traffic(w,E);assert.equal(t.junctions.items.length,0,type);
  const samples=E.sampleRoad(w.roadPaths[0].controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96})),a=Object.assign(t.addAgent(),{active:true,phase:'resident',points:samples,segment:0,distance:0,x:samples[0].x,z:samples[0].z,heading:0});t.trips=[];
  for(let k=0;k<10000&&a.active;k++){t.update(.05);assert.notEqual(a.waitReason,'Red signal');assert.notEqual(a.waitReason,'Stop sign');}
  assert.equal(a.active,false);assert.equal(t.completed,1);assert.equal(JSON.stringify(w),before);
 }
});
test('authored crossing controllers match pavement junction centers and survive harmless road edits',()=>{
 const w=city();w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.money=1000000;
 assert.ok(E.buildRoadPath(w,[{x:8,y:20},{x:38,y:20}],'avenue').ok);assert.ok(E.buildRoadPath(w,[{x:23,y:8},{x:23,y:35}],'street').ok);
 const t=new Traffic(w,E);assert.equal(t.junctions.items.length,1);const j=t.junctions.items[0];assert.equal(j.x,-2);assert.equal(j.z,-14);assert.ok(j.radius>2.5);
 const points=[{x:j.x-15,z:j.z+.48},{x:j.x+15,z:j.z+.48}],owner=Object.assign(t.addAgent(),{active:true,phase:'resident',points,gatePoints:points,trip:{destination:1,cells:[[],[]]}});w.tiles[1].level=1;j.owner=owner;
 E.buildRoadPath(w,[{x:5,y:40},{x:12,y:40}],'street');t.rebuild(w);assert.equal(t.junctions.items.length,1);assert.equal(t.junctions.items[0].id,j.id);assert.equal(t.junctions.items[0].owner,owner);
});

test('red-light approaches stop the vehicle front before the rendered stop bar',()=>{
 const w=city();w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.money=1000000;E.buildRoadPath(w,[{x:8,y:20},{x:38,y:20}],'avenue');E.buildRoadPath(w,[{x:23,y:8},{x:23,y:35}],'street');const t=new Traffic(w,E);t.trips=[];const j=t.junctions.items[0],points=[{x:j.x-.48,z:j.z-15},{x:j.x-.48,z:j.z+15}];const a=Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x:points[0].x,z:points[0].z,heading:0});
 t.update(4);assert.equal(a.waitReason,'Red signal');assert.ok(a.speed<.1);const pavementRadius=j.radius-1.2,stopBar=j.z-pavementRadius-1.02;assert.ok(a.z+.45<=stopBar+.05,'front bumper remains behind stop paint');
 t.update(15);assert.ok(a.z>stopBar,'green phase releases the car');
});
