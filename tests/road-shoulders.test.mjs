import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {laneLayout,laneOffset,travelHalfWidth} from '../dist/road-lanes.js';
import {Traffic} from '../dist/traffic.js';
import {Roadworks} from '../dist/roadworks.js';
import {canvasDocument} from './architecture-fixture.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} differs from ${b}`);
const arrays=layout=>({forward:layout.forward,reverse:layout.reverse,dividers:layout.dividers});
// Frozen Edition137 lane arithmetic. This verifies exact compatibility for
// every unchanged street, including the ordering of both traffic directions.
function original(spec){
 const lanes=Math.max(1,spec.lanes||2),half=spec.width/2,median=spec.median?.16:0,dividers=[],forward=[],reverse=[];
 if(spec.oneway){const width=spec.width/lanes;for(let i=0;i<lanes;i++)forward.push(half-(i+.5)*width);for(let i=1;i<lanes;i++)dividers.push({offset:-half+i*width,center:false});}
 else{const count=Math.max(1,Math.floor(lanes/2)),width=(half-median)/count;for(let i=0;i<count;i++){forward.push(median+(i+.5)*width);reverse.push(-median-(i+.5)*width);}if(!median)dividers.push({offset:0,center:true});for(let i=1;i<count;i++)for(const side of [-1,1])dividers.push({offset:side*(median+i*width),center:false});}
 return {forward,reverse,dividers};
}

test('motorway shoulders occupy existing pavement and leave three 3.75 metre lanes',()=>{
 const spec=E.ROADS.motorway,before=JSON.stringify(spec),layout=laneLayout(spec);
 close(spec.width*5,15.75);close(layout.shoulder*5,2.25);close(layout.laneWidth*5,3.75);close(layout.outerEdge,1.125);
 assert.deepEqual(layout.forward,[.75,0,-.75]);assert.deepEqual(layout.reverse,[]);
 assert.deepEqual(layout.dividers,[{offset:-.375,center:false},{offset:.375,center:false}]);
 close(travelHalfWidth(spec),layout.outerEdge);assert.equal(JSON.stringify(spec),before);
});

test('divided highways retain their median and reserve 1.5 metre outer shoulders',()=>{
 const spec=E.ROADS.highway,layout=laneLayout(spec);
 close(spec.width*5,24);close(layout.shoulder*5,1.5);close(layout.median*10,1.6);close(layout.outerEdge,2.1);close(layout.laneWidth*5,19.4/6);
 for(let i=0;i<3;i++){close(layout.forward[i],[.4833333333333333,1.13,1.7766666666666666][i]);close(layout.reverse[i],-layout.forward[i]);}
 for(const offset of [...layout.forward,...layout.reverse]){
  assert.ok(Math.abs(offset)>layout.median);assert.ok(Math.abs(offset)+layout.laneWidth/2<=layout.outerEdge+1e-12);
 }
 for(const divider of layout.dividers)assert.ok(Math.abs(divider.offset)>layout.median&&Math.abs(divider.offset)<layout.outerEdge);
});

test('all urban and legacy lane arrays retain their exact released numbers and order',()=>{
 const specs=[...Object.values(E.ROADS).filter(s=>!s.limitedAccess)];
 for(const width of [2.45,3.15])for(const lanes of [2,4])for(const oneway of [false,true])specs.push({width,lanes,oneway});
 for(const spec of specs){
  const layout=laneLayout(spec);assert.equal(JSON.stringify(arrays(layout)),JSON.stringify(original(spec)));
  assert.equal(layout.shoulder,0);assert.equal(layout.outerEdge,spec.width/2);
  for(let i=0;i<layout.forward.length;i++)assert.equal(laneOffset(spec,i),original(spec).forward[i]);
 }
});

test('narrow tapers reduce shoulders without inverted travel space or changing nominal geometry',()=>{
 for(const spec of [E.ROADS.motorway,E.ROADS.highway]){
  const saved=JSON.stringify(spec);
  for(const width of [0,.05,.2,.5,1.7,spec.width,spec.width*2]){
   const layout=laneLayout(spec,width);
   assert.ok(layout.shoulder>=0&&layout.shoulder<=spec.shoulder);
   assert.ok(layout.outerEdge>=layout.median&&layout.outerEdge<=width/2);
   assert.ok(layout.laneWidth>=0&&Number.isFinite(layout.laneWidth));
   close(travelHalfWidth(spec,width),layout.outerEdge);
   assert.ok([...layout.forward,...layout.reverse].every(p=>Number.isFinite(p)&&Math.abs(p)<=layout.outerEdge+1e-12));
  }
  close(laneLayout(spec,spec.width/2).shoulder,spec.shoulder/2);
  assert.equal(JSON.stringify(spec),saved);
 }
});

test('real highway routes and moving vehicles use shoulder-adjusted travel lanes in both directions',()=>{
 for(const type of ['motorway','highway'])for(const backwards of [false,true]){
  const w=E.createWorld('Shoulder traffic','plains',17);w.money=1e6;
  for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});
  const controls=[{x:5,y:24},{x:42,y:24}];if(backwards)controls.reverse();
  const built=E.buildRoadPath(w,controls,type);assert.ok(built.ok,built.reason);
  const traffic=new Traffic(w,E),from=24*48+(backwards?35:8),to=24*48+(backwards?8:35),cells=traffic.trace(traffic.search(from,traffic.graph,built.path.id),to,built.path.id),layout=laneLayout(E.ROADS[type]);
  assert.ok(cells);const saved=JSON.stringify(w);
  for(let choice=0;choice<3;choice++){
   const points=traffic.route(cells,null,false,choice),offset=(backwards?-1:1)*layout.forward[choice];
   assert.ok(points.length>2);for(const p of points)close(p.z,2+offset);
   const agent=traffic.addAgent();Object.assign(agent,{active:true,points,segment:0,distance:0,speed:0,phase:'outbound',x:points[0].x,z:points[0].z});
   const start=agent.x;traffic.update(.1);assert.ok(Math.abs(agent.x-start)>0);close(agent.z,2+offset);agent.active=false;
  }
  assert.equal(JSON.stringify(w),saved,'derived traffic lanes never change the saved road footprint');
 }
});

test('outside connections keep legacy lanes after an overlapping highway is removed',()=>{
 const oldDocument=globalThis.document,oldEngine=globalThis.CityEngine;
 globalThis.document=canvasDocument();globalThis.CityEngine=E;
 try{for(const type of ['highway','motorway']){
  const w=E.createWorld('Legacy outside lanes','plains',17);w.money=1e6;
  for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});
  for(let x=0;x<4;x++)Object.assign(w.tiles[24*48+x],{type:'road',level:1,roadWidth:1});
  const built=E.buildRoadPath(w,[{x:0,y:24},{x:12,y:24}],type);assert.ok(built.ok,built.reason);assert.ok(E.removeRoadPath(w,built.path.id).ok);
  const tile=w.tiles[24*48];assert.equal(tile.roadType,type);assert.ok(tile.legacyRoad);assert.equal(tile.pathIds.length,0);assert.ok(E.valid(w));
  const width=tile.roadWidth===2?3.15:2.45,legacy={width,lanes:tile.roadWidth===2?4:2,oneway:!!E.ROADS[type].oneway},dividers=[],edges=[],surfaces=[],rendered=[],meshes=[];
  const view={v:{mat:color=>color,box:()=>{}},group:{add:mesh=>meshes.push(mesh)},height:()=>0,
   ribbon:(_w,_p,actualWidth,_offset,_material,_height,spec)=>rendered.push({width:actualWidth,spec}),
   dash:(_w,_s,offset)=>dividers.push(offset),line:(_w,_p,_width,_color,offset)=>edges.push(offset),surface:(...args)=>surfaces.push(args)};
  Roadworks.prototype.outside.call(view,w,{id:24*48,x:-94,z:2,dx:-1,dz:0},{});
  assert.equal(rendered[0].width,width);assert.equal(rendered[0].spec.shoulder,0);assert.equal(rendered[0].spec.limitedAccess,false);
  assert.deepEqual(dividers,original(legacy).dividers.map(d=>d.offset));assert.deepEqual(edges,[-(width/2-.12),width/2-.12]);assert.equal(surfaces.length,0);
  assert.ok(E.ROADS[type].shoulder>0&&E.ROADS[type].limitedAccess,'legacy rendering cannot modify the authored highway catalog');
  for(const mesh of meshes){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}
 }}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldEngine===undefined)delete globalThis.CityEngine;else globalThis.CityEngine=oldEngine;}
});
