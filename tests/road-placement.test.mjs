import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {createRoadSnapIndex,resolveRoadSnap,measureRoad} from '../dist/road-placement.js';

function world(){const w=E.createWorld('Placement','plains',91);w.roadPaths=[];w.walkPaths=[];w.money=1e8;for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',pathIds:undefined,legacyRoad:undefined});return w;}
function build(w,controls){const r=E.buildRoadPath(w,controls);assert.equal(r.ok,true,r.reason);return r.path;}
function close(a,b,eps=1e-8){assert.ok(Math.abs(a-b)<=eps,`${a} should be within ${eps} of ${b}`);}
function errorToSegments(p,samples){let error=Infinity;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));error=Math.min(error,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return error;}

test('authored diagonals and curves snap to true centerlines without phantom raster nodes',()=>{
 const w=world(),diagonal=build(w,[{x:8.2,y:9.3},{x:23.8,y:20.7}]),curve=build(w,[{x:8,y:32},{x:25,y:18},{x:41,y:36}]),index=createRoadSnapIndex(w,E);
 assert.equal(index.world,w);assert.equal(index.nodes.length,4,'authored raster tiles add no extra nodes');
 for(const [path,raw]of [[diagonal,{x:17,y:15.5}],[curve,{x:25,y:26.1}]]){
  const r=resolveRoadSnap(index,raw);assert.equal(r.kind,'centerline');assert.ok(errorToSegments(r.point,E.sampleRoad(path.controls))<1e-8);
  assert.ok(Math.hypot(r.point.x-Math.round(r.point.x),r.point.y-Math.round(r.point.y))>.02);
 }
});

test('nearest real endpoints take precedence over centerlines with deterministic storage-order ties',()=>{
 const w=world();build(w,[{x:8,y:20},{x:30,y:20}]);build(w,[{x:19.7,y:20.2},{x:19.7,y:9}]);build(w,[{x:20.3,y:20.2},{x:20.3,y:30}]);
 const raw={x:20,y:20.2},a=resolveRoadSnap(createRoadSnapIndex(w,E),raw),reversed=structuredClone(w);reversed.roadPaths.reverse();
 assert.equal(a.kind,'endpoint');assert.deepEqual(a.point,{x:19.7,y:20.2});assert.deepEqual(resolveRoadSnap(createRoadSnapIndex(reversed,E),raw),a);
 const near=resolveRoadSnap(createRoadSnapIndex(w,E),{x:20.25,y:20.2});assert.deepEqual(near.point,{x:20.3,y:20.2});
});

test('walking endpoints and curve centerlines are available without persisting snap metadata',()=>{
 const w=world();const r=E.buildWalkPath(w,[{x:5,y:12},{x:12,y:8},{x:18,y:12}]);assert.equal(r.ok,true);
 const saved=JSON.stringify(w),index=createRoadSnapIndex(w,E),snap=resolveRoadSnap(index,{x:5.2,y:12.15});
 assert.equal(snap.label,'Path endpoint');assert.deepEqual(snap.point,{x:5,y:12});assert.deepEqual(Object.keys(snap.point).sort(),['x','y']);
 snap.point.x=999;assert.equal(JSON.stringify(w),saved);assert.deepEqual(resolveRoadSnap(index,{x:5.2,y:12.15}).point,{x:5,y:12});
});

test('legacy straight segments and rounded elbows use their rendered centerlines',()=>{
 const w=world();for(const [x,y]of [[10,20],[11,20],[12,20],[12,21],[12,22]])Object.assign(w.tiles[y*48+x],{type:'road'});
 const index=createRoadSnapIndex(w,E),straight=resolveRoadSnap(index,{x:10.48,y:20.2},{tolerance:.3});assert.equal(straight.kind,'centerline');close(straight.point.y,20);
 const corner=resolveRoadSnap(index,{x:11.9,y:20.1},{tolerance:.2});assert.equal(corner.kind,'centerline');assert.ok(corner.point.x<12&&corner.point.y>20,'corner does not snap to the empty elbow tile center');
 const node=resolveRoadSnap(index,{x:11.02,y:20.03});assert.equal(node.label,'Road node');assert.deepEqual(node.point,{x:11,y:20});
});

test('free placement bypasses nodes, angle and length snapping while preserving city bounds',()=>{
 const w=world();build(w,[{x:10,y:10},{x:20,y:10}]);const index=createRoadSnapIndex(w,E),raw={x:10.2,y:10.1},options={anchor:{x:5,y:10},lengths:true,free:true};
 const result=resolveRoadSnap(index,raw,options);assert.deepEqual(result.point,raw);assert.equal(result.kind,'free');assert.deepEqual(result.guides,[]);assert.notEqual(result.point,raw);
 assert.deepEqual(resolveRoadSnap(index,{x:-5,y:60},{free:true}).point,{x:0,y:47});assert.equal(resolveRoadSnap(index,{x:NaN,y:1}).point,null);
 const border=resolveRoadSnap(createRoadSnapIndex(world(),E),{x:46.99,y:46.99},{anchor:{x:45.5,y:45.5},lengths:true});assert.ok(border.point.x<=47&&border.point.y<=47);
});

test('angle guides follow grid or an existing road tangent, only inside their angular window',()=>{
 const index=createRoadSnapIndex(world(),E),anchor={x:10,y:10};
 const grid=resolveRoadSnap(index,{x:18,y:10.3},{anchor,nodes:false});assert.equal(grid.kind,'angle');close(grid.point.y,10);close(grid.angleDegrees,0);assert.deepEqual(grid.guides[0].a,anchor);
 const diagonal=resolveRoadSnap(index,{x:18,y:18.3},{anchor,nodes:false});assert.equal(diagonal.kind,'angle');close(diagonal.point.x,diagonal.point.y);close(diagonal.angleDegrees,45);
 const tangent={x:Math.cos(Math.PI/6),y:Math.sin(Math.PI/6)},direction=Math.PI/6+Math.PI/2,raw={x:anchor.x+Math.cos(direction)*7+.1,y:anchor.y+Math.sin(direction)*7};
 const relative=resolveRoadSnap(index,raw,{anchor,referenceTangent:tangent,nodes:false});assert.equal(relative.kind,'angle');close(relative.angleDegrees,90);close((relative.point.x-anchor.x)*tangent.x+(relative.point.y-anchor.y)*tangent.y,0);
 const free=resolveRoadSnap(index,{x:12,y:10.6},{anchor,nodes:false});assert.equal(free.kind,'free','17-degree direction must not be coerced to the grid');
});

test('optional 8 metre increments combine with angles but never pull a connected endpoint away',()=>{
 const w=world(),anchor={x:10,y:10},empty=createRoadSnapIndex(w,E),raw={x:14.13,y:10.1};
 const angle=resolveRoadSnap(empty,raw,{anchor,nodes:false,lengths:true});assert.equal(angle.kind,'angle-length');close(angle.point.x,14);close(angle.point.y,10);
 const radial=resolveRoadSnap(empty,{x:14.1,y:12.2},{anchor,nodes:false,angles:false,lengths:true});assert.equal(radial.kind,'length');close(Math.hypot(radial.point.x-10,radial.point.y-10)/.4,12);
 build(w,[{x:14.13,y:10.1},{x:20,y:12}]);const snap=resolveRoadSnap(createRoadSnapIndex(w,E),raw,{anchor,lengths:true});assert.equal(snap.kind,'endpoint');assert.deepEqual(snap.point,raw);
 assert.deepEqual(anchor,{x:10,y:10});assert.deepEqual(raw,{x:14.13,y:10.1});
});

test('measurement follows the constructed sampled curve and reports explicitly supplied grade in metres',()=>{
 const controls=[{x:5,y:20},{x:24,y:4},{x:40,y:22}],samples=E.sampleRoad(controls),saved=JSON.stringify(samples),m=measureRoad(samples);
 assert.ok(m.lengthMeters>Math.hypot(35,2)*20);close(m.lengthMeters,measureRoad([...samples].reverse()).lengthMeters);assert.equal(m.gradePercent,undefined);assert.equal(JSON.stringify(samples),saved);
 const slope=measureRoad([{x:1,y:1},{x:6,y:1}],(x,y)=>x*.4);close(slope.lengthMeters,100);close(slope.riseMeters,10);close(slope.gradePercent,10);
});

test('indexes are isolated snapshots; rebuilding reflects road deletion and replacement of the world',()=>{
 const w=world(),road=build(w,[{x:6,y:10},{x:18,y:10}]),saved=JSON.stringify(w),old=createRoadSnapIndex(w,E);assert.equal(JSON.stringify(w),saved);
 const p={x:6.1,y:10.1};assert.equal(resolveRoadSnap(old,p).kind,'endpoint');E.removeRoadPath(w,road.id);const next=createRoadSnapIndex(w,E);
 assert.equal(resolveRoadSnap(old,p).kind,'endpoint');assert.equal(resolveRoadSnap(next,p).kind,'free');assert.equal(resolveRoadSnap(createRoadSnapIndex(world(),E),p).kind,'free');
});
