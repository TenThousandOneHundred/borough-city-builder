import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import RoadTypes from '../dist/road-types.js';
import {roadGeometry,roadDescriptors} from '../dist/road-junction-plan.js';
import {pedestrianCrossings} from '../dist/pedestrian-network.js';
import {Traffic} from '../dist/traffic.js';
import {harness} from './fixtures/road-build-view.mjs';
import {streetTreeClear} from '../dist/landscape.js';
const tile=(x,y)=>Math.round(y)*48+Math.round(x),legacyEnd=tile(19,24);
const world=()=>{const w=E.createWorld('Continuous streets','plains',431);w.money=1e8;return w;};
function build(w,controls,type='street'){const r=E.buildRoadPath(w,controls,type);assert.ok(r.ok,r.reason);return r.path;}
function savedRoundTrip(w){const storage={data:null,setItem(_,v){this.data=v;},getItem(){return this.data;}},store=new E.WorldStore(storage);store.save(w);return new E.WorldStore(storage).get(w.id);}
function noFalseCrossing(w,path){
 const saved=JSON.stringify(w),plan=roadGeometry(w,E),traffic=new Traffic(w,E),far=path.tiles.reduce((best,i)=>Math.hypot(i%48-19,Math.floor(i/48)-24)>Math.hypot(best%48-19,Math.floor(best/48)-24)?i:best,path.tiles[0]);
 assert.ok(plan.junctions.every(j=>j.arms.length===2));assert.equal(traffic.junctions.items.length,0);assert.equal(pedestrianCrossings(w,plan).length,0);
 assert.ok(traffic.trace(traffic.search(tile(0,24)),far,path.id));assert.ok(traffic.trace(traffic.search(far,traffic.graph,path.id),tile(0,24),null));assert.equal(JSON.stringify(w),saved);
}

test('angled and curved extensions join the starter road without a phantom branch, crossing or traffic light',()=>{
 for(const controls of [[{x:19,y:24},{x:27,y:20}],[{x:19,y:24},{x:27,y:28}],[{x:19,y:24},{x:23,y:14},{x:36,y:19}],[{x:19,y:24},{x:23,y:34},{x:36,y:29}]])for(const reversed of [false,true]){
  const w=world(),path=build(w,reversed?controls.slice().reverse():controls);noFalseCrossing(w,path);const restored=savedRoundTrip(w);noFalseCrossing(restored,restored.roadPaths[0]);assert.deepEqual(restored.roadPaths,w.roadPaths);
 }
});

test('forward joins just inside the pavement trim only the contacted dead-end cap',()=>{
 for(const offset of [-.2,.2])for(const reverse of [false,true]){
  const w=world(),controls=[{x:19,y:24+offset},{x:19,y:24+Math.sign(offset)*8}],p=build(w,reverse?controls.reverse():controls);noFalseCrossing(w,p);
  const legacy=roadDescriptors(w,E).find(r=>r.id==='grid/'+legacyEnd);assert.equal(Math.max(...legacy.stations.map(p=>p.x)),-18);
 }
 const w=world(),p=build(w,[{x:19.3,y:24},{x:27,y:28}]);noFalseCrossing(w,p);assert.ok(Math.abs(Math.max(...roadDescriptors(w,E).find(r=>r.id==='grid/'+legacyEnd).stations.map(p=>p.x))+16.8)<1e-7);
});

test('a nearby parallel street cannot invent a legacy branch, bend, route or vertical zoning frontage',()=>{
 const w=world(),before=structuredClone(RoadTypes.legacyShapes(w,E.sampleRoad).get(legacyEnd)),p=build(w,[{x:8,y:24.7},{x:30,y:24.7}]);
 assert.deepEqual(RoadTypes.legacyShapes(w,E.sampleRoad).get(legacyEnd),before);assert.equal(roadGeometry(w,E).junctions.length,0);
 const traffic=new Traffic(w,E);assert.equal(traffic.trace(traffic.search(tile(0,24)),p.tiles.at(-1),p.id),null);
 assert.ok([...E.fineZoningLayout(w).values()].filter(p=>p.source.startsWith('legacy-')).every(p=>p.source==='legacy-h-24'));
});

test('genuine T branches, through crossings and legacy grid junctions retain their real arms',()=>{
 for(const [controls,arms]of [[[{x:10,y:24},{x:10,y:14}],3],[[{x:10,y:14},{x:10,y:34}],4],[[{x:19,y:14},{x:19,y:34}],3]]){
  const w=world();build(w,controls);const p=roadGeometry(w,E);assert.equal(p.junctions.length,1);assert.equal(p.junctions[0].arms.length,arms);assert.equal(new Traffic(w,E).junctions.items.length,1);assert.equal(pedestrianCrossings(w,p).length,arms);
 }
 for(const directions of [[[-1,0],[1,0],[0,1]],[[-1,0],[1,0],[0,1],[0,-1]]]){
  const w=world();for(const t of w.tiles)Object.assign(t,{type:null,pathIds:undefined,legacyRoad:undefined});Object.assign(w.tiles[tile(20,20)],{type:'road'});
  for(const [dx,dy]of directions)for(let d=1;d<=4;d++)Object.assign(w.tiles[tile(20+dx*d,20+dy*d)],{type:'road'});
  const joins=roadGeometry(w,E).junctions;assert.equal(joins.length,1);assert.equal(joins[0].arms.length,directions.length);
 }
});

test('demolition restores the dead-end cap and caches observe road edits without following economic or terrain ticks',()=>{
 const w=world(),base=RoadTypes.legacyShapes(w,E.sampleRoad);w.money--;w.day++;w.elevationRevision++;assert.equal(RoadTypes.legacyShapes(w,E.sampleRoad),base);
 const path=build(w,[{x:19,y:24},{x:27,y:20}]),joined=RoadTypes.legacyShapes(w,E.sampleRoad);assert.notEqual(joined,base);assert.equal(joined.get(legacyEnd).points[0].x,19);
 assert.ok(E.removeRoadPath(w,path.id).ok);assert.equal(RoadTypes.legacyShapes(w,E.sampleRoad).get(legacyEnd).points[0].x,19.5);assert.equal(roadGeometry(w,E).junctions.length,0);
});

test('vehicles stay on the visible joined pavement in both directions',()=>{
 const original=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};const w=world(),path=build(w,[{x:19,y:24},{x:27,y:20}]),v=harness(w);
 try{v.roadworks.build(w);const traffic=new Traffic(w,E);
  for(const reverse of [false,true]){const from=reverse?path.tiles.at(-1):tile(0,24),to=reverse?tile(0,24):path.tiles.at(-1),cells=traffic.trace(traffic.search(from,traffic.graph,reverse?path.id:null),to,reverse?null:path.id);assert.ok(cells);const points=traffic.route(cells,null,false,0);assert.ok(points.length>20);for(const p of points)assert.ok(Number.isFinite(v.roadworks.surfaceHeight(p.x,p.z,'asphalt')),`route leaves pavement at ${p.x},${p.z}`);}
 }finally{v.roadworks.dispose();v.cleanup();globalThis.document=original;}
});

test('street trees keep their trunks clear of crossing pavement while retaining the rest of the avenue',()=>{
 const w=world();for(const t of w.tiles)Object.assign(t,{type:null,tree:false});w.roadPaths=[];build(w,[{x:8,y:24},{x:40,y:24}],'green');build(w,[{x:9,y:12},{x:9,y:36}]);
 const v=harness(w);let positions;v.vegetation={populate(group,p){positions=p;return [];}};
 try{v.roadworks.build(w);v.landscape.makeTrees(w);assert.ok(positions.filter(p=>p[4]).length>5);assert.equal(streetTreeClear(v.roadworks,-59,.05),false);for(const [x,z,, ,street]of positions)if(street)assert.equal(streetTreeClear(v.roadworks,x,z),true);}
 finally{v.roadworks.dispose();v.cleanup();}
});
