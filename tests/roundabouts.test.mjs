import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import R from '../dist/roundabout-state.js';
import {roadGeometry,junctionCorners} from '../dist/road-junction-plan.js';
import {roundaboutRoute,roundaboutQuote} from '../dist/roundabout-geometry.js';
import {Traffic} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';
import {Transit,createBusLine} from '../dist/transit.js';
import {Walking} from '../dist/walking.js';
import {junctionPolicy,setJunctionPolicy} from '../dist/junctions.js';
import {transitLeg,planBusLine} from '../dist/transit.js';
import {TrafficSpatial} from '../dist/traffic-spatial.js';
import {Roadworks} from '../dist/roadworks.js';
import * as THREE from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;
const index=(x,y)=>y*48+x;
function city(type='street',tee=false){const w=E.createWorld('Roundabout test','plains',8);w.money=1e7;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,tree:false});for(const controls of [[{x:0,y:24},{x:47,y:24}],[{x:24,y:8},{x:24,y:tee?24:40}]])assert.ok(E.buildRoadPath(w,controls,type).ok);return w;}
const plan=w=>roadGeometry(w,E).junctions;
function build(w,size='medium'){const j=plan(w).find(j=>j.arms.length>=3),q=R.apply(w,plan(w),R.key(j),size,E);assert.ok(q.ok,q.reason);return plan(w).find(j=>j.roundabout);}
const radial=(p,j)=>Math.hypot(p.x-j.x,p.z-j.z);
test('three sizes and T junctions save, charge once and restore the previous traffic controls',()=>{
 for(const tee of [false,true])for(const size of Object.keys(R.SIZES)){const w=city('street',tee),j=plan(w)[0],id=R.key(j);setJunctionPolicy(w,id,'stop');const before=JSON.stringify(w),cash=w.money,q=R.quote(w,plan(w),id,size,E);assert.ok(q.ok,q.reason);assert.equal(JSON.stringify(w),before);build(w,size);assert.equal(w.money,cash-q.cost);assert.equal(junctionPolicy(w,id),'roundabout');assert.ok(E.valid(w));const storage={v:null,getItem(){return this.v},setItem(k,v){this.v=v}},store=new E.WorldStore(storage);store.save(w,1000);const reload=new E.WorldStore(storage).get(w.id);assert.deepEqual(reload.roundabouts,w.roundabouts);assert.equal(plan(reload)[0].roundabout.size,size);assert.equal(R.apply(w,plan(w),id,size,E).ok,false);assert.ok(R.apply(w,plan(w),id,'none',E).ok);assert.equal(junctionPolicy(w,id),'stop');assert.equal(w.roundabouts,undefined);assert.equal(plan(w)[0].roundabout,undefined);assert.ok(E.valid(w));}
});
test('invalid saves and unsafe sites are rejected without mutation',()=>{
 const w=city(),id=R.key(plan(w)[0]);for(const value of [null,[],{[id]:{size:'huge',x:2,z:2,outer:3}},{bad:{size:'small',x:2,z:2,outer:3}},{[id]:{size:'small',x:2,z:2,outer:99}}])assert.equal(E.valid({...w,roundabouts:value}),false);
 const blocked=()=>{const before=JSON.stringify(w),q=R.apply(w,plan(w),id,'large',E);assert.equal(q.ok,false);assert.equal(JSON.stringify(w),before);};w.money=1;blocked();w.money=1e7;const t=w.tiles[index(25,25)];t.ground='water';blocked();t.ground='land';t.type='residential';t.level=1;blocked();t.type=null;t.level=0;w.development={parcels:{a:{occupant:{},frame:{cx:6,cz:5,width:3,depth:5,angle:.4}}}};blocked();delete w.development;
 assert.equal(roundaboutQuote(w,E,plan(w),id,'medium',(_w,x)=>x).ok,false);
 for(const type of ['highway','oneway','gravel']){const other=city(type);assert.equal(R.quote(other,plan(other),R.key(plan(other)[0]),'small',E).ok,false);}
});
test('zoning excludes the circular footprint and recovers after removal; roads and paths cannot invalidate it',()=>{
 const w=city(),before=E.fineZoningLayout(w),j=build(w,'large'),after=E.fineZoningLayout(w);assert.notEqual(after,before);assert.ok(after.size<before.size);for(const f of after.values())assert.equal(R.intersects(j.roundabout,f,.55),false);const snapshot=JSON.stringify(w);
 assert.equal(E.buildRoad(w,{x:20,y:24},{x:28,y:24}).ok,false);assert.equal(E.roadQuote(w,[{x:20,y:20},{x:24,y:24}]).ok,false);assert.equal(E.removeRoadPath(w,w.roadPaths[0].id).ok,false);assert.equal(E.replaceRoad(w,JSON.stringify(['path',w.roadPaths[0].id]),'avenue').ok,false);assert.equal(E.walkQuote(w,[{x:20,y:20},{x:28,y:28}]).ok,false);assert.equal(E.place(w,25,25,'park').ok,false);assert.equal(E.facilityQuote(w,25,25,'hospital').ok,false);assert.equal(JSON.stringify(w),snapshot);
 R.apply(w,plan(w),R.key(j),'none',E);assert.equal(E.fineZoningLayout(w).size,before.size);assert.ok(E.roadReplacementQuote(w,JSON.stringify(['path',w.roadPaths[0].id]),'avenue').ok);
});
test('every approach and turn follows the circulating lane without crossing the grass island',()=>{
 for(const size of Object.keys(R.SIZES)){const w=city(),j=build(w,size),s=j.roundabout;for(let a=0;a<4;a++)for(let b=0;b<4;b++){if(a===b)continue;const angle=a*Math.PI/2,other=b*Math.PI/2,points=[{x:j.x+Math.cos(angle)*18,z:j.z+Math.sin(angle)*18},{x:j.x,z:j.z},{x:j.x+Math.cos(other)*18,z:j.z+Math.sin(other)*18}],route=roundaboutRoute(points,[j]);assert.deepEqual(route[0],points[0]);assert.deepEqual(route.at(-1),points.at(-1));assert.ok(route.every(p=>radial(p,j)>=s.island+.5));const ring=route.filter(p=>Math.abs(radial(p,j)-s.ring)<.01);assert.ok(ring.length>5);for(let i=1;i<ring.length;i++){const u=ring[i-1],v=ring[i],cross=(u.x-j.x)*(v.z-j.z)-(u.z-j.z)*(v.x-j.x);assert.ok(cross<1e-8,'clockwise direction');}}
 }
});
test('several cars can circulate and all complete trips offscreen without a signal or whole-circle reservation',()=>{
 const w=city(),j=build(w,'large'),t=new Traffic(w,E);t.trips=[];const cars=[];
 for(let k=0;k<4;k++){const a=k*Math.PI/2,p={x:j.x+Math.cos(a)*18,z:j.z+Math.sin(a)*18},q={x:j.x-Math.cos(a)*18,z:j.z-Math.sin(a)*18},points=roundaboutRoute([p,{x:j.x,z:j.z},q],[j]);cars.push(Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x:p.x,z:p.z,heading:0}));}
 let simultaneous=false,yielded=false;for(let n=0;n<2400&&cars.some(c=>c.active);n++){t.update(.05);simultaneous ||= cars.filter(c=>c.active&&radial(c,j)<j.roundabout.outer).length>1;yielded ||= cars.some(c=>c.waitReason==='Yield to circulating traffic');for(const c of cars)assert.ok(radial(c,j)>=j.roundabout.island+.45);assert.equal(t.junctions.items[0].owner,null);}
 assert.ok(simultaneous);assert.equal(t.completed,4);assert.ok(cars.every(c=>!c.active));
});
test('pedestrians route around the outside and buses share the road circulation',()=>{
 const w=city(),j=build(w),t=new Traffic(w,E),walking=new Walking(w,t),route=walking.route({x:j.x-12,z:j.z+1.5},{x:j.x+12,z:j.z+1.5});assert.ok(route,'sidewalks remain connected');for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];for(let k=0;k<=20;k++)assert.ok(radial({x:a.x+(b.x-a.x)*k/20,z:a.z+(b.z-a.z)*k/20},j)>j.roundabout.outer);}
 const bus=transitLeg(t,index(12,24),index(36,24));assert.ok(bus);assert.ok(bus.points.every(p=>radial(p,j)>j.roundabout.island+.5));assert.match(planBusLine(w,t,[index(24,24),index(36,24)]).reason,/roundabout/);
});
test('spatial yield checks match full scans and cached geometry stays stable during simulation',()=>{
 const w=city(),j=build(w),t=new Traffic(w,E),points=roundaboutRoute([{x:j.x-20,z:j.z},{x:j.x+20,z:j.z}],[j]),cached=plan(w),g=t.junctions.route(points).gates[0],entry={active:true,points,segment:0,distance:g.entry-.3,x:j.x-6,z:j.z,speed:0,length:.9},other={active:true,x:j.x+j.roundabout.ring*Math.cos(g.mergeAngle+.2),z:j.z+j.roundabout.ring*Math.sin(g.mergeAngle+.2),speed:1,length:.9};
 const a=structuredClone(entry),b=structuredClone(entry);a.points=points;b.points=points;const agents=[a,other],spatial=new TrafficSpatial();spatial.reset([b,other]);assert.equal(t.junctions.limit(a,0,.05,w,agents),t.junctions.limit(b,0,.05,w,[b,other],spatial));assert.equal(a.waitReason,'Yield to circulating traffic');for(let i=0;i<30;i++)t.update(.05);assert.equal(plan(w),cached);assert.equal(t.junctions.route(points),t.junctions.route(points));
});
test('curbs are continuous between arms and island geometry is finite with upward surfaces',()=>{
 const w=city('avenue'),j=build(w),materials=new Map(),v={scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false,mat(c){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c}));return materials.get(c);}};const r=new Roadworks(v);r.height=()=>1;r.sharedJunction(w,j,v.mat('#444'),r.walkMaterial,v.mat('#aaa'));let triangles=0;
 for(const c of junctionCorners(j))for(const p of c.points)assert.ok(radial(p,j)>=j.roundabout.outer-1e-6);
 r.group.traverse(o=>{if(o.geometry){assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});assert.ok(triangles>300&&triangles<4000);
});

function populated(){const w=city('avenue');for(const [x,type,building]of [[8,'residential','cottage'],[30,'office','business'],[38,'commercial','shops'],[4,'bus','bus']])Object.assign(w.tiles[index(x,23)],{type,building,level:1,people:type==='residential'?6:0,density:'low'});const traffic=new Traffic(w,E);traffic.residentsEnabled=true;for(let i=0;i<32;i++)traffic.addAgent();return {w,traffic};}
test('installing a roundabout preserves moving residents and their saved journeys',()=>{
 const {w,traffic}=populated(),residents=new Residents(w,traffic);for(let n=0;n<600;n++){traffic.update(.05);residents.update(.05);}const travelling=[...residents.agents].filter(([,a])=>a.active).map(([id,a])=>({id,agent:a,trip:structuredClone(w.citizens.residents.find(r=>r.id===id).trip)}));assert.ok(travelling.length);const j=build(w);traffic.rebuild(w);residents.reconcile();for(const old of travelling){const a=residents.agents.get(old.id),r=w.citizens.residents.find(r=>r.id===old.id);assert.equal(a,old.agent);assert.ok(a.active);assert.equal(r.trip.from,old.trip.from);assert.equal(r.trip.to,old.trip.to);assert.equal(r.trip.purpose,old.trip.purpose);assert.ok(a.points.every(p=>radial(p,j)>j.roundabout.island+.45));}for(let n=0;n<1800;n++){traffic.update(.05);residents.update(.05);}assert.ok(traffic.completed>0);assert.ok(E.valid(w));
});
test('installing a roundabout keeps bus passengers and resumes the same service',()=>{
 const {w,traffic}=populated(),created=createBusLine(w,traffic,[index(10,24),index(36,24)]);assert.ok(created.ok,created.reason);const transit=new Transit(w,traffic),residents=new Residents(w,traffic,transit);for(let n=0;n<5000&&!transit.summary.riding;n++){traffic.update(.05);transit.update(.05);residents.update(.05);}assert.ok(transit.summary.riding>0);const assignments=()=>residents.state.residents.filter(r=>r.transit?.phase==='ride').map(r=>[r.id,r.transit.line,r.transit.from,r.transit.to]),before=assignments(),entry=transit.entries.get(created.line.id),agent=entry.agent,leg=created.line.vehicle.leg,completed=created.line.completed,j=build(w);traffic.rebuild(w);transit.rebuild();assert.equal(entry.agent,agent);assert.equal(created.line.vehicle.leg,leg);assert.deepEqual(assignments(),before);assert.ok(agent.points.every(p=>radial(p,j)>j.roundabout.island+.45));for(let n=0;n<6000&&created.line.completed<=completed;n++){traffic.update(.05);transit.update(.05);residents.update(.05);}assert.ok(created.line.completed>completed);assert.ok(E.valid(w));
});
