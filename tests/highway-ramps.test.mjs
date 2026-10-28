import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {Traffic} from '../dist/traffic.js';
import {laneLayout} from '../dist/road-lanes.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
const types=['ramp','highway2','motorway','highway4'],tile=(x,y)=>y*48+x;
function world(){const w=E.createWorld('Ramps','plains',37);w.money=1e8;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});return w;}
function build(w,c,type){const r=E.buildRoadPath(w,c,type);assert.ok(r.ok,r.reason);return r.path;}
function route(t,a,ap,b,bp){return t.trace(t.search(a,t.graph,ap.id),b,bp.id);}
test('highway catalog has one through four lanes with consistent 3.75 metre lane widths',()=>{for(let i=0;i<types.length;i++){const s=E.ROADS[types[i]],l=laneLayout(s);assert.equal(s.lanes,i+1);assert.equal(l.forward.length,i+1);assert.equal(l.reverse.length,0);assert.equal(l.dividers.length,i);assert.ok(Math.abs(l.laneWidth-.75)<1e-8);assert.ok(s.limitedAccess&&!s.sidewalk&&s.oneway);}});
test('each new road saves its exact type, shoulder lanes and one-way reachability',()=>{
 for(const type of types){const w=world(),p=build(w,[{x:5,y:24},{x:40,y:24}],type),storage={data:null,getItem(){return this.data},setItem(k,v){this.data=v}},store=new E.WorldStore(storage);store.save(w);const restored=new E.WorldStore(storage).get(w.id);assert.equal(restored.roadPaths[0].type,type);const t=new Traffic(restored,E),cells=route(t,tile(7,24),p,tile(38,24),p);assert.ok(cells);assert.equal(route(t,tile(38,24),p,tile(7,24),p),null);for(let lane=0;lane<E.ROADS[type].lanes;lane++){const points=t.route(cells,null,false,lane);assert.ok(points.length>2);for(const q of points)assert.ok(Math.abs(q.z-2-laneLayout(E.ROADS[type]).forward[lane])<1e-6);}}
});
test('exit ramp carries traffic off a wider highway and rejects travel back up the ramp',()=>{
 const w=world(),main=build(w,[{x:5,y:24},{x:42,y:24}],'highway4'),ramp=build(w,[{x:25,y:24},{x:30,y:24},{x:38,y:34}],'ramp'),t=new Traffic(w,E),cells=route(t,tile(8,24),main,tile(38,34),ramp);assert.ok(cells);assert.equal(route(t,tile(38,34),ramp,tile(8,24),main),null);const points=t.route(cells,null,false,3);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));for(let i=1;i<points.length;i++)assert.ok(Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z)<1.5);const before=JSON.stringify(w);t.trips=[];const a=t.addAgent();Object.assign(a,{active:true,phase:'resident',points,segment:0,distance:0,x:points[0].x,z:points[0].z,heading:Math.PI/2});for(let i=0;i<4000&&a.active;i++)t.update(.05);assert.ok(a.arrived);assert.equal(JSON.stringify(w),before);
 const geometry=roadGeometry(w,E);assert.ok(geometry.roads.some(r=>r.spec.lanes===1));
});
test('entrance ramp permits merging onto the highway while opposite direction stays unreachable',()=>{
 const w=world(),main=build(w,[{x:5,y:24},{x:42,y:24}],'highway2'),ramp=build(w,[{x:10,y:34},{x:18,y:24},{x:25,y:24}],'ramp'),t=new Traffic(w,E);assert.ok(route(t,tile(10,34),ramp,tile(39,24),main));assert.equal(route(t,tile(39,24),main,tile(10,34),ramp),null);
});
test('tangent ramp openings remove buried edge details while retaining the far highway edge',async()=>{
 const {highwayEdges}=await import('../dist/highway-edges.js'),{streetStations}=await import('../dist/street-geometry.js');
 const w=world(),main=build(w,[{x:5,y:24},{x:42,y:24}],'highway4'),ramp=build(w,[{x:25,y:24},{x:30,y:24},{x:38,y:34}],'ramp'),g=roadGeometry(w,E),edges=highwayEdges(g.roads),m=g.roads.find(r=>r.id===main.id),r=g.roads.find(r=>r.id===ramp.id),offset=E.ROADS.highway4.width/2-.025;
 const kept=edges.sections(main.id,m.stations,()=>offset);assert.ok(kept.length>=2,'ramp opens a real gap in the near barrier');assert.equal(edges.sections(main.id,m.stations,()=>-offset)[0],m.stations,'far side stays byte-for-byte unchanged');
 for(const section of kept)for(const p of section)assert.equal(edges.blocked(main.id,p,offset),false);
 const rampSections=edges.sections(ramp.id,r.stations,()=>E.ROADS.ramp.width/2-.025);assert.ok(rampSections[0][0].distance>0,'ramp edge starts outside main pavement');
 const noRamp=highwayEdges([m]);assert.equal(noRamp.sections(main.id,m.stations,()=>offset)[0],m.stations);
});
test('narrow approach divider paint yields to the wider highway lane pattern',async()=>{
 const {highwayEdges}=await import('../dist/highway-edges.js');const w=world(),main=build(w,[{x:5,y:24},{x:42,y:24}],'highway4'),branch=build(w,[{x:10,y:34},{x:18,y:24},{x:25,y:24}],'highway2'),g=roadGeometry(w,E),edges=highwayEdges(g.roads),m=g.roads.find(r=>r.id===main.id),r=g.roads.find(r=>r.id===branch.id);
 assert.equal(edges.sections(main.id,m.stations,()=>0,true)[0],m.stations);const kept=edges.sections(branch.id,r.stations,()=>0,true);assert.ok(kept.at(-1).at(-1).distance<r.stations.at(-1).distance);for(const section of kept)for(const p of section)assert.equal(edges.blocked(branch.id,p,0,true),false);
});
