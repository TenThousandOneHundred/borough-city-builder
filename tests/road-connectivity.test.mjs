import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import Connectivity from '../dist/road-connectivity.js';
import {Traffic} from '../dist/traffic.js';
import {Transit,planBusLine,createBusLine} from '../dist/transit.js';
import {planParallelRoads,buildParallelRoads} from '../dist/road-parallel.js';

const tile=(x,y)=>Math.round(y)*48+Math.round(x);
function world(){const w=E.createWorld('Geometric connectivity','plains',37);w.money=1e8;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0});return w;}
function road(w,controls,type='street'){
 // Independent coverage permits intentionally short zero-new-tile segments;
 // it models the atomic batch builder without weakening ordinary roadQuote.
 const empty={...w,tiles:w.tiles.map(t=>({...t,type:null,level:0,pathIds:undefined,legacyRoad:undefined}))},q=E.roadQuote(empty,controls,type);assert.ok(q.ok,q.reason);
 const path={id:'source-'+(w.roadPaths?.length||0),type,controls,tiles:q.tiles};w.roadPaths||=[];w.roadPaths.push(path);
 for(const i of q.tiles){const t=w.tiles[i];t.type='road';t.level=1;t.roadType=type;t.pathIds||=[];t.pathIds.push(path.id);}
 return path;
}
function route(traffic,from,a,to,b){return traffic.trace(traffic.search(from,traffic.graph,a.id),to,b.id);}

test('separate adjacent parallel streets cannot transfer through raster neighbors',()=>{
 const w=world(),a=road(w,[{x:5,y:20},{x:40,y:20}]),b=road(w,[{x:5,y:21},{x:40,y:21}]),before=JSON.stringify(w),traffic=new Traffic(w,E);
 assert.equal(route(traffic,tile(8,20),a,tile(35,21),b),null);
 assert.ok(route(traffic,tile(8,20),a,tile(35,20),a));assert.equal(traffic.junctions.items.length,0);assert.equal(JSON.stringify(w),before);
});

test('diagonal carriageways sharing raster tiles retain separate source identities through traces and buildings',()=>{
 const w=world(),a=road(w,[{x:5,y:5},{x:40,y:40}]),b=road(w,[{x:5,y:6},{x:39,y:40}]),shared=a.tiles.find(i=>b.tiles.includes(i));assert.notEqual(shared,undefined);
 const front=(path,cx)=>({id:'parcel-'+cx,frame:{cx,cz:0,width:1,depth:1,angle:0,frontage:{roadIndex:shared,pathId:path.id,x:0,z:0}},occupant:{type:'residential',level:1,people:1}});
 w.development={revision:0,parcels:{'parcel-1':front(a,1),'parcel-2':front(b,2)}};
 const traffic=new Traffic(w,E),tree=traffic.search(shared,traffic.graph,a.id);
 assert.equal(traffic.trace(tree,shared,b.id),null,'Same tile cannot act as an interchange');assert.equal(traffic.between('parcel-1','parcel-2'),null);
 const cells=route(traffic,tile(8,8),a,tile(35,35),a),points=traffic.route(cells,null,false);
 assert.ok(cells.sources.every(source=>traffic.network.records.get(source).pathId===a.id));
 const offsets=points.map(p=>p.z-p.x);assert.ok(Math.max(...offsets)-Math.min(...offsets)<1e-6,'Route remains in one diagonal lane rather than moving to the neighboring carriageway');
});

test('a genuine crossing and an endpoint inside pavement permit geometric transfers',()=>{
 for(const end of [20,19.8]){
  const w=world(),a=road(w,[{x:5,y:20},{x:40,y:20}]),b=road(w,[{x:23,y:8},{x:23,y:end}]),traffic=new Traffic(w,E);
  const cells=route(traffic,tile(8,20),a,tile(23,10),b);assert.ok(cells);assert.ok(cells.joins.some(Boolean));
  const points=traffic.route(cells,null,false);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
  assert.ok(route(traffic,tile(23,10),b,tile(8,20),a));
 }
});

test('split quadratic endpoints stay connected with continuous source-aware route geometry',()=>{
 const w=world(),a=road(w,[{x:8,y:30},{x:16,y:17},{x:24,y:17}]),b=road(w,[{x:24,y:17},{x:32,y:17},{x:40,y:30}]),traffic=new Traffic(w,E);
 const cells=route(traffic,tile(8,30),a,tile(40,30),b);assert.ok(cells);assert.ok(cells.joins.some(p=>p&&Math.hypot(p.x-24,p.y-17)<1e-7));
 const points=traffic.route(cells,null,false);for(let i=1;i<points.length;i++)assert.ok(Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z)<1,'No teleport across a fitted seam');
});

test('a short one-way segment retains different entry and exit positions even within one tile',()=>{
 const w=world(),a=road(w,[{x:18,y:18},{x:20.1,y:20}]),middle=road(w,[{x:20.1,y:20},{x:20.4,y:20}],'oneway'),b=road(w,[{x:20.4,y:20},{x:22,y:18}]),traffic=new Traffic(w,E);
 assert.equal(middle.tiles.length,1);assert.ok(route(traffic,tile(18,18),a,tile(22,18),b));
 assert.equal(route(traffic,tile(22,18),b,tile(18,18),a),null,'Cannot traverse the short one-way segment backwards');
});

test('two intersections within the same tile preserve order along a one-way road',()=>{
 const w=world(),main=road(w,[{x:15,y:20},{x:25,y:20}],'oneway'),a=road(w,[{x:20.1,y:15},{x:20.1,y:20}]),b=road(w,[{x:20.4,y:20},{x:20.4,y:25}]),traffic=new Traffic(w,E);
 assert.ok(route(traffic,tile(20.1,15),a,tile(20.4,25),b));assert.equal(route(traffic,tile(20.4,25),b,tile(20.1,15),a),null);
 const record=[...traffic.network.records.values()].find(record=>record.pathId===main.id);assert.ok(record.nodes.size>main.tiles.length,'Exact contact nodes supplement tile projections');
});

test('opposite one-way parallel roads require a real connector for a return trip',()=>{
 const w=world(),a=road(w,[{x:0,y:20},{x:40,y:20}],'oneway'),b=road(w,[{x:40,y:21},{x:0,y:21}],'oneway');let traffic=new Traffic(w,E);
 assert.equal(route(traffic,tile(5,20),a,tile(5,21),b),null);road(w,[{x:40,y:20},{x:40,y:21}],'street');traffic=new Traffic(w,E);
 const cells=route(traffic,tile(5,20),a,tile(5,21),b);assert.ok(cells);assert.ok(cells.some(i=>i%48===40),'Return path must travel through the actual end connector');
});

test('outside reachability checks the road source as well as a shared tile',()=>{
 const w=world(),a=road(w,[{x:0,y:0},{x:40,y:40}]),b=road(w,[{x:5,y:6},{x:39,y:40}]),shared=a.tiles.find(i=>b.tiles.includes(i)),roads=Connectivity.connectedRoads(w,E);
 assert.ok(roads.has(shared));assert.ok(roads.hasSource(shared,a.id));assert.equal(roads.hasSource(shared,b.id),false);
 const first=Connectivity.build(w,E);assert.equal(Connectivity.build(w,E),first);w.money--;w.day++;assert.equal(Connectivity.build(w,E),first,'Economic ticks do not rebuild topology');
 road(w,[{x:25,y:20},{x:20,y:25}]);assert.notEqual(Connectivity.build(w,E),first);assert.ok(Connectivity.connectedRoads(w,E).hasSource(shared,b.id));
});

test('legacy streets and authored branches preserve their existing connections',()=>{
 const w=E.createWorld('Legacy topology','plains',19);w.money=1e8;const a=E.buildRoadPath(w,[{x:12,y:24},{x:15,y:15},{x:30,y:12}],'street').path,traffic=new Traffic(w,E);
 assert.ok(traffic.trace(traffic.search(tile(0,24)),a.tiles.at(-1),a.id));assert.ok(traffic.trace(traffic.search(a.tiles.at(-1),traffic.graph,a.id),tile(0,24),null));
});

const worldPoint=(x,y)=>({x:(x+.5)*4-96,z:(y+.5)*4-96});
function parcel(w,id,path,x,y){const front=worldPoint(x,y);w.development||={revision:0,parcels:{}};w.development.parcels[id]={id,frame:{cx:front.x,cz:front.z+3,width:1,depth:1,angle:0,frontage:{...front,roadIndex:tile(x,y),pathId:path.id}},occupant:{type:'residential',level:1,people:1}};}

test('two front doors on the same one-way tile retain their actual longitudinal order',()=>{
 const w=world(),a=road(w,[{x:15,y:20},{x:25,y:20}],'oneway');parcel(w,'parcel-1',a,20.1,20);parcel(w,'parcel-2',a,20.4,20);const traffic=new Traffic(w,E),forward=traffic.between('parcel-1','parcel-2');
 assert.ok(forward);assert.equal(traffic.between('parcel-2','parcel-1'),null,'Shared frontage tile must not permit a backwards journey');
 assert.ok(Math.abs(forward.cells.positions[0].x-20.1)<1e-8);assert.ok(Math.abs(forward.cells.positions.at(-1).x-20.4)<1e-8);
 assert.ok(forward.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
});

test('same-tile front doors on two-way roads can travel both ways without changing the cached network',()=>{
 const w=world(),a=road(w,[{x:15,y:20},{x:25,y:20}]);parcel(w,'parcel-1',a,20.1,20);parcel(w,'parcel-2',a,20.4,20);const traffic=new Traffic(w,E),count=traffic.network.states.size;
 assert.ok(traffic.between('parcel-1','parcel-2'));assert.ok(traffic.between('parcel-2','parcel-1'));assert.equal(traffic.network.states.size,count,'Query points are ephemeral and do not mutate shared cached geometry');
});

test('removing one carriageway cancels its trip even when another road retains every raster tile',()=>{
 const w=world(),a=road(w,[{x:5,y:5},{x:40,y:40}]),b=road(w,[{x:5,y:5.2},{x:39.8,y:40}]);parcel(w,'parcel-1',a,35,35);parcel(w,'parcel-2',b,35,35.2);const traffic=new Traffic(w,E),first=route(traffic,tile(8,8),a,tile(35,35),a),second=route(traffic,tile(8,8.2),b,tile(35,35.2),b);assert.ok(first&&second);
 const affected={active:true,trip:{destination:'parcel-1',cells:[first]}},unaffected={active:true,trip:{destination:'parcel-2',cells:[second]}};traffic.agents.push(affected,unaffected);
 w.roadPaths=w.roadPaths.filter(path=>path!==a);for(const i of a.tiles){w.tiles[i].pathIds=w.tiles[i].pathIds.filter(id=>id!==a.id);if(!w.tiles[i].pathIds.length)w.tiles[i].type=null;}
 assert.ok(first.every(i=>w.tiles[i].type==='road'),'Raster membership alone cannot detect this road removal');traffic.rebuild(w);assert.equal(affected.active,false);assert.equal(unaffected.active,true);
});


test('a curve starting at the final legacy tile keeps the outside connection across the rounded legacy corner',()=>{
 const w=E.createWorld('Starter corner','plains',8);w.money=1e8;const built=E.buildRoadPath(w,[{x:19,y:24},{x:23,y:14},{x:36,y:19}],'street');assert.ok(built.ok);const traffic=new Traffic(w,E),roads=Connectivity.connectedRoads(w,E);
 assert.ok(built.path.tiles.every(i=>roads.hasSource(i,built.path.id)));assert.ok(traffic.trace(traffic.search(tile(0,24)),built.path.tiles.at(-1),built.path.id));assert.ok(traffic.trace(traffic.search(built.path.tiles.at(-1),traffic.graph,built.path.id),tile(0,24),null));
});


test('actual piecewise parallel motorways stay separate and retain forward travel through every fit seam',()=>{
 const w=world(),plan=planParallelRoads([{x:8,y:26},{x:24,y:10},{x:39,y:28}],{roadWidth:E.ROADS.motorway.width/4,clearGap:.4,reverse:true});assert.ok(plan.ok,plan.reason);const result=buildParallelRoads(w,plan,'motorway',E);assert.ok(result.ok,result.reason);assert.equal(result.roads.length,2);assert.ok(result.roads[1].controls.length>3);
 const traffic=new Traffic(w,E);for(const path of result.roads){const a=path.controls[0],b=path.controls.at(-1),cells=route(traffic,tile(a.x,a.y),path,tile(b.x,b.y),path);assert.ok(cells);assert.equal(route(traffic,tile(b.x,b.y),path,tile(a.x,a.y),path),null);assert.ok(cells.sources.every(source=>traffic.network.records.get(source).pathId===path.id));const points=traffic.route(cells,null,false);for(let n=1;n<points.length;n++)assert.ok(Math.hypot(points[n].x-points[n-1].x,points[n].z-points[n-1].z)<1);}
 const [a,b]=result.roads;assert.equal(route(traffic,a.tiles[0],a,b.tiles[0],b),null);assert.equal(traffic.junctions.items.length,0);
});

function busCorridors(connect=false){const w=world(),a=road(w,[{x:5,y:5},{x:40,y:40}],'oneway'),b=road(w,[{x:39,y:40},{x:5,y:6}],'oneway'),stops=[tile(10,10),tile(35,35)];
 if(connect){road(w,[{x:40,y:40},{x:39,y:40}]);road(w,[{x:5,y:6},{x:5,y:5}]);}
 const depot=E.neighbors(stops[0]).find(i=>!w.tiles[i].type);assert.notEqual(depot,undefined);Object.assign(w.tiles[depot],{type:'bus',level:1});return {w,a,b,stops};
}

test('a bus loop cannot change roads between legs at a stop shared by opposite carriageways',()=>{
 const {w,stops}=busCorridors(),traffic=new Traffic(w,E);assert.ok(traffic.trace(traffic.search(stops[0]),stops[1]));assert.ok(traffic.trace(traffic.search(stops[1]),stops[0]),'Unattached numeric queries can each choose a different carriageway');const before=JSON.stringify(w),plan=planBusLine(w,traffic,stops);
 assert.equal(plan.ok,false);assert.match(plan.reason,/own road/);assert.equal(createBusLine(w,traffic,stops).ok,false);assert.equal(JSON.stringify(w),before);
});

test('bus stop attachments join adjacent legs continuously and require real loop connectors',()=>{
 const {w,a,stops}=busCorridors(true),traffic=new Traffic(w,E),plan=planBusLine(w,traffic,stops);assert.ok(plan.ok,plan.reason);assert.ok(plan.attachments.every(stop=>stop.pathId===a.id));
 for(let i=0;i<plan.legs.length;i++){const arriving=plan.legs[i],leaving=plan.legs[(i+1)%plan.legs.length];assert.equal(arriving.cells.sources.at(-1),leaving.cells.sources[0]);assert.deepEqual(arriving.cells.positions.at(-1),leaving.cells.positions[0]);assert.deepEqual(arriving.points.at(-1),leaving.points[0]);}
 assert.ok(plan.legs[1].cells.some(i=>i%48===40));assert.ok(plan.legs[1].cells.some(i=>i%48===5));assert.ok(createBusLine(w,traffic,stops).ok);const transit=new Transit(w,traffic),entry=[...transit.entries.values()][0],before=JSON.stringify(w.transit);
 const copy=structuredClone(w),restored=new Transit(copy,new Traffic(copy,E));assert.deepEqual([...restored.entries.values()][0].plan.attachments,entry.plan.attachments);assert.equal(JSON.stringify(w.transit),before,'Runtime source attachments are not hidden save mutations');
 const positions=[];for(let elapsed=0;elapsed<300;elapsed+=.05){traffic.update(.05);transit.update(.05);positions.push({x:entry.agent.x,z:entry.agent.z});}assert.equal(entry.reason,'');for(let n=1;n<positions.length;n++)assert.ok(Math.hypot(positions[n].x-positions[n-1].x,positions[n].z-positions[n-1].z)<.5,'Bus never jumps between its leg endpoints');
});

test('removing a pinned stop road suspends buses instead of silently moving the stop to its neighbor',()=>{
 const {w,a,stops}=busCorridors(true),traffic=new Traffic(w,E);assert.ok(createBusLine(w,traffic,stops).ok);const transit=new Transit(w,traffic),entry=[...transit.entries.values()][0],attachments=structuredClone(entry.plan.attachments);
 w.roadPaths=w.roadPaths.filter(path=>path!==a);for(const i of a.tiles){w.tiles[i].pathIds=w.tiles[i].pathIds.filter(id=>id!==a.id);if(!w.tiles[i].pathIds.length)w.tiles[i].type=null;}
 assert.ok(stops.every(i=>w.tiles[i].type==='road'));traffic.rebuild(w);transit.rebuild();assert.match(entry.reason,/stop’s road has been removed/);assert.equal(entry.agent.active,false);assert.ok(attachments.every(stop=>stop.pathId===a.id));
});

function savedReload(w){const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}};new E.WorldStore(storage).save(w,137);return new E.WorldStore(storage).get(w.id);}
function savedBusPair(){const w=world(),a=E.buildRoadPath(w,[{x:5,y:5},{x:40,y:40}],'street').path,b=E.buildRoadPath(w,[{x:43,y:44},{x:3,y:4}],'street').path;assert.ok(a&&b);const first=new Traffic(w,E),shared=a.tiles.filter(i=>b.tiles.includes(i)&&first.network.attachment(i).record.pathId===a.id),stops=[shared[4],shared.at(-4)],depot=E.neighbors(stops[0]).find(i=>!w.tiles[i].type);assert.notEqual(depot,undefined);Object.assign(w.tiles[depot],{type:'bus',level:1});const traffic=new Traffic(w,E),created=createBusLine(w,traffic,stops);assert.ok(created.ok,created.reason);const transit=new Transit(w,traffic);return {w,a,b,traffic,transit,line:created.line};}

test('saved stop attachments keep a removed road suspended after a verified save and reload',()=>{
 const {w,a,b,traffic,transit,line}=savedBusPair(),pins=structuredClone(line.stopAttachments);assert.ok(pins.every(pin=>pin.pathId===a.id));assert.ok(E.removeRoadPath(w,a.id).ok);traffic.rebuild(w);transit.rebuild();assert.match([...transit.entries.values()][0].reason,/stop’s road has been removed/);assert.deepEqual(line.stopAttachments,pins);assert.ok(E.valid(w),'Missing pinned path IDs are valid suspended-line saves');
 const loaded=savedReload(w),restored=new Transit(loaded,new Traffic(loaded,E)),entry=[...restored.entries.values()][0];assert.deepEqual(loaded.transit.lines[0].stopAttachments,pins);assert.match(entry.reason,/stop’s road has been removed/);assert.equal(entry.agent.active,false);assert.ok(loaded.roadPaths.some(path=>path.id===b.id),'Neighboring road remains available but is not silently selected');
});

test('a closer new carriageway cannot steal saved stops when the city reloads',()=>{
 const w=world(),original=E.buildRoadPath(w,[{x:5,y:5.4},{x:40,y:40.4}],'street').path,controls=[{x:43,y:43},{x:3,y:3}],future=E.roadQuote(w,controls,'street');assert.ok(original&&future.ok);const stops=[tile(10,10),tile(35,35)];assert.ok(stops.every(i=>original.tiles.includes(i)&&future.tiles.includes(i)));
 const depot=original.tiles.flatMap(i=>E.neighbors(i)).find(i=>!w.tiles[i].type&&!future.tiles.includes(i)&&Math.floor(i/48)-i%48>1);assert.notEqual(depot,undefined);Object.assign(w.tiles[depot],{type:'bus',level:1});const traffic=new Traffic(w,E),created=createBusLine(w,traffic,stops);assert.ok(created.ok,created.reason);const transit=new Transit(w,traffic),pins=structuredClone(created.line.stopAttachments),added=E.buildRoadPath(w,controls,'street');assert.ok(added.ok,added.reason);traffic.rebuild(w);transit.rebuild();
 assert.ok(stops.every(i=>traffic.network.attachment(i).record.pathId===added.path.id),'Unpinned nearest-source resolution would now choose the new road');assert.ok(created.line.stopAttachments.every(pin=>pin.pathId===original.id));const loaded=savedReload(w),restored=new Transit(loaded,new Traffic(loaded,E)),entry=[...restored.entries.values()][0];assert.equal(entry.reason,'');assert.deepEqual(entry.plan.attachments,pins);assert.ok(entry.plan.legs.every(leg=>leg.cells.sources.every(key=>restored.traffic.network.records.get(key).pathId===original.id)));
});

test('numeric-only legacy lines stay unchanged on read and persist their old pins before their first road edit',()=>{
 const {w,a,traffic,line}=savedBusPair(),legacy=structuredClone(w);delete legacy.transit.lines[0].stopAttachments;const before=JSON.stringify(legacy.transit),legacyTraffic=new Traffic(legacy,E),legacyTransit=new Transit(legacy,legacyTraffic);assert.equal(JSON.stringify(legacy.transit),before);assert.equal(legacy.transit.lines[0].stopAttachments,undefined);assert.ok(E.valid(legacy));
 assert.ok(E.removeRoadPath(legacy,a.id).ok);legacyTraffic.rebuild(legacy);legacyTransit.rebuild();const pins=legacy.transit.lines[0].stopAttachments;assert.ok(pins.every(pin=>pin.pathId===a.id));const loaded=savedReload(legacy),restored=new Transit(loaded,new Traffic(loaded,E));assert.equal([...restored.entries.values()][0].agent.active,false);assert.match([...restored.entries.values()][0].reason,/stop’s road has been removed/);
 assert.ok(line.stopAttachments);assert.equal(traffic.world,w);
});

test('saved stop attachment validation rejects corrupt metadata without requiring the road to still exist',()=>{
 const {w,line}=savedBusPair();assert.ok(E.valid(w));const original=structuredClone(line.stopAttachments),bad=[null,[],[original[0]],original.map((p,i)=>({...p,stop:p.stop+(i===0?1:0)})),original.map(p=>({...p,pathId:17})),original.map(p=>({...p,point:null})),original.map(p=>({...p,point:{x:NaN,y:10}})),original.map(p=>({...p,point:{x:48,y:10}})),original.map(p=>({...p,point:{x:0,y:0}}))];
 for(const value of bad){line.stopAttachments=value;assert.equal(E.valid(w),false);}line.stopAttachments=original.map(p=>({...p,pathId:'removed-but-retained-reference'}));assert.ok(E.valid(w));delete line.stopAttachments;assert.ok(E.valid(w),'Existing numeric-only saves remain supported');
});
