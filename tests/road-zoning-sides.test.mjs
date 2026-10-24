import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import F from '../dist/fine-zoning-state.js';
import {CityView} from '../dist/renderer.js';
import * as THREE from '../dist/vendor/three.module.js';
import {roadZoningPanel} from '../dist/road-zoning-panel.js';
import {trafficCity} from './traffic-city-fixture.mjs';

const index=(x,y)=>y*48+x;
function blank(){const w=E.createWorld('Road zoning','plains',8);w.money=1e6;for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});w.roadPaths=[];return w;}
function path(w,controls,type='street',options){const r=E.buildRoadPath(w,controls,type,options);assert.ok(r.ok,r.reason);return r.path;}
const target=p=>JSON.stringify(['path',p.id]);
const cells=(w,p)=>[...F.grid(w,E.ROADS).values()].filter(c=>c.source===p.id);
function legacy(w,x,y,type='street'){Object.assign(w.tiles[index(x,y)],{type:'road',roadType:type,level:1});}

test('straight, reversed and curved streets expose only their chosen side and restore exact original cells',()=>{
 for(const controls of [[{x:8,y:24},{x:39,y:24}],[{x:39,y:24},{x:8,y:24}],[{x:8,y:28},{x:24,y:8},{x:39,y:28}]]){
  const w=blank(),p=path(w,controls),before=[...F.grid(w,E.ROADS)],original=cells(w,p);assert.ok(original.some(c=>c.side===-1)&&original.some(c=>c.side===1));
  for(const [mode,side]of [['left',-1],['right',1]]){assert.ok(E.setRoadZoning(w,target(p),mode).ok);assert.deepEqual(cells(w,p),original.filter(c=>c.side===side));const cached=F.grid(w,E.ROADS);assert.equal(F.grid(w,E.ROADS),cached);assert.equal(E.setRoadZoning(w,target(p),mode).changed,0);assert.equal(F.grid(w,E.ROADS),cached);}
  E.setRoadZoning(w,target(p),'none');assert.equal(cells(w,p).length,0);E.setRoadZoning(w,target(p),'both');assert.deepEqual([...F.grid(w,E.ROADS)],before);assert.equal(p.zoneSides,undefined);assert.ok(E.valid(w));
 }
 const w=blank(),east=path(w,[{x:8,y:24},{x:39,y:24}],'street',{zoneSides:'left'});assert.ok(cells(w,east).every(c=>c.cz<2));
});

test('disabling competing frontage lets a neighboring street reclaim cells without crossing pavement',()=>{
 const w=blank(),a=path(w,[{x:8,y:20},{x:39,y:20}]),b=path(w,[{x:8,y:24},{x:39,y:24}]);
 // Stable source ordering makes this regression independent of UUIDs.
 for(const [p,id]of [[a,'a'],[b,'b']]){for(const i of p.tiles)w.tiles[i].pathIds=w.tiles[i].pathIds.map(old=>old===p.id?id:old);p.id=id;}
 const before=cells(w,b).filter(c=>c.side===-1).length;E.setRoadZoning(w,target(a),'left');const after=cells(w,b).filter(c=>c.side===-1);assert.ok(after.length>before);
 for(const p of after){assert.equal(Z.overlaps(p,{cx:0,cz:(20.5)*4-96,width:124,depth:E.ROADS.street.width,angle:0}),false);if(p.row>0)assert.ok(F.grid(w,E.ROADS).has(JSON.stringify([p.source,p.side,p.col,p.row-1])));}
});

test('legacy controls stop at intersections, gaps and road type changes, and invalidate cached layouts',()=>{
 const w=blank();for(let x=5;x<=25;x++)legacy(w,x,20);for(let y=16;y<=24;y++)legacy(w,15,y);for(let x=29;x<35;x++)legacy(w,x,20);for(let x=5;x<10;x++)legacy(w,x,32,'avenue');
 const t=E.roadZoningTargets(w,index(10,20))[0];assert.deepEqual(t.tiles,Array.from({length:10},(_,i)=>index(5+i,20)));assert.equal(E.roadZoningTargets(w,index(15,20)).length,0);
 const before=F.grid(w,E.ROADS);E.setRoadZoning(w,t.id,'none');assert.notEqual(F.grid(w,E.ROADS),before);assert.ok([...F.grid(w,E.ROADS).values()].every(c=>!t.tiles.includes(c.roadIndex)));assert.equal(w.tiles[index(16,20)].zoneSides,undefined);assert.equal(w.tiles[index(29,20)].zoneSides,undefined);
 E.setRoadZoning(w,t.id,'right');assert.ok([...F.grid(w,E.ROADS).values()].filter(c=>t.tiles.includes(c.roadIndex)).every(c=>c.side===1));assert.deepEqual([...F.grid(w,E.ROADS)],[...F.grid(structuredClone(w),E.ROADS)]);
 w.tiles[index(8,20)].roadType='avenue';assert.deepEqual(E.roadZoningTargets(w,index(10,20))[0].tiles,Array.from({length:6},(_,i)=>index(9+i,20)));
 const vertical=E.roadZoningTargets(w,index(15,18))[0];E.setRoadZoning(w,vertical.id,'left');assert.ok([...F.grid(w,E.ROADS).values()].filter(c=>vertical.tiles.includes(c.roadIndex)).every(c=>c.side===-1&&c.cx>=(15.5)*4-96));
});

test('new road defaults and crossing selection are independent, while highways never gain zoning',()=>{
 const w=blank(),a=path(w,[{x:8,y:20},{x:39,y:20}],'street',{zoneSides:'right'}),b=path(w,[{x:24,y:8},{x:24,y:38}]);
 const targets=E.roadZoningTargets(w,index(24,20));assert.equal(targets.length,2);assert.deepEqual(new Set(targets.map(t=>t.id)),new Set([target(a),target(b)]));
 E.setRoadZoning(w,target(b),'none');assert.equal(a.zoneSides,'right');assert.equal(cells(w,b).length,0);
 const highway=path(w,[{x:5,y:4},{x:40,y:4}],'highway',{zoneSides:'left'});assert.equal(highway.zoneSides,undefined);assert.equal(cells(w,highway).length,0);assert.equal(E.setRoadZoning(w,target(highway),'both').ok,false);
 const snapshot=JSON.stringify(w);assert.equal(E.buildRoadPath(w,[{x:4,y:40},{x:36,y:40}],'street',{zoneSides:'invalid'}).ok,false);assert.equal(JSON.stringify(w),snapshot);assert.equal(E.setRoadZoning(w,'invalid','both').ok,false);assert.equal(E.setRoadZoning(w,target(a),'invalid').ok,false);
});

function growthWorld(){const w=E.createWorld('Saved roadside homes','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');return w;}
const grow=(w,n)=>{for(let i=0;i<n;i++)E.tick(w);};
test('paint persists while a side is disabled, cannot start new buildings, and resumes after re-enabling',()=>{
 const w=growthWorld(),t=E.roadZoningTargets(w,index(8,24))[0],grid=E.fineZoningLayout(w),ids=[...grid.values()].filter(c=>c.side===-1&&c.cx>-70&&c.cx<-35).map(c=>c.id);E.fineZoneCells(w,ids,'residential_medium');const paint=JSON.stringify(w.development);
 E.setRoadZoning(w,t.id,'right');assert.equal(E.fineZonePlan(w).length,0);assert.equal(E.fineZoneCells(w,ids,'residential_low').changed,0);grow(w,50);assert.equal(JSON.stringify(w.development),paint);
 E.setRoadZoning(w,t.id,'both');assert.ok(E.fineZonePlan(w).length>0);grow(w,60);assert.ok(Object.values(w.development.parcels).some(p=>p.occupant?.people>0));assert.ok(E.valid(w));
});

test('occupied and building lots retain their frames, homes, access and construction on disabled sides',()=>{
 const w=growthWorld(),road=path(w,[{x:19,y:24},{x:35,y:24}]),grid=E.fineZoningLayout(w);E.fineZoneCells(w,[...grid.values()].filter(c=>c.source===road.id).map(c=>c.id),'residential_medium');
 let pending;for(let i=0;i<50&&!pending;i++){E.tick(w);pending=Object.values(w.development.parcels).find(p=>p.occupant?.construction);}assert.ok(pending);const reserved=structuredClone(w.development.parcels),before=structuredClone(E.analyze(w));E.setRoadZoning(w,target(road),'none');assert.deepEqual(w.development.parcels,reserved);assert.deepEqual(E.analyze(w),before);
 grow(w,30);assert.equal(Object.keys(w.development.parcels).length,Object.keys(reserved).length);for(const p of Object.values(w.development.parcels)){assert.deepEqual(p.frame,reserved[p.id].frame);assert.equal(p.occupant.construction,undefined);assert.ok(E.analyze(w).active.includes(p.id));}
 assert.ok(Object.values(w.development.parcels).some(p=>p.occupant.people>0));E.setRoadZoning(w,target(road),'both');const available=E.fineZoningLayout(w);for(const c of available.values())for(const p of Object.values(w.development.parcels))if(!p.cells.includes(c.id))assert.equal(Z.overlaps(c,p.frame),false);assert.ok(E.valid(w));
});

test('saved legacy construction completes with its original lot after zoning is disabled',()=>{
 const w=growthWorld();E.zoneCells(w,E.rectangleCells({x:4,y:21},{x:9,y:23}),'residential_low');let i=-1;for(let n=0;n<80&&i<0;n++){E.tick(w);i=w.tiles.findIndex(t=>t.construction);}assert.ok(i>=0);const frame=structuredClone(w.tiles[i].zoneSite);E.setRoadZoning(w,E.roadZoningTargets(w,index(8,24))[0].id,'none');assert.match(E.developmentStatus(w,i),/Under construction/);grow(w,12);assert.equal(w.tiles[i].type,'residential');assert.equal(w.tiles[i].construction,undefined);assert.deepEqual(w.tiles[i].zoneSite,frame);assert.ok(E.valid(w));
});

test('manual save, reload and exit retain policies and reject malformed side settings',()=>{
 const w=growthWorld(),p=path(w,[{x:19,y:24},{x:35,y:24}],'street',{zoneSides:'left'});E.setRoadZoning(w,E.roadZoningTargets(w,index(8,24))[0].id,'right');let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value},store=new E.WorldStore(storage);store.save(w,123);const session=new E.GameSession(new E.WorldStore(storage));session.start(w.id);assert.deepEqual(session.world,w);E.setRoadZoning(session.world,target(p),'none');session.exit(124);const restored=new E.WorldStore(storage).get(w.id);assert.equal(restored.roadPaths[0].zoneSides,'none');assert.equal(restored.tiles[index(8,24)].zoneSides,'right');assert.equal(restored.savedAt,124);
 for(const value of [null,12,{},'sideways']){for(const mutate of [copy=>copy.roadPaths[0].zoneSides=value,copy=>copy.tiles[index(8,24)].zoneSides=value]){const copy=structuredClone(restored);mutate(copy);assert.equal(E.valid(copy),false);}}
});

test('changing roadside zoning retains resident journeys and vehicle motion without rendering',()=>{
 const a=trafficCity({rows:3,agents:96}),b=trafficCity({rows:3,agents:96});for(let i=0;i<80;i++){a.step();b.step();}const t=E.roadZoningTargets(b.world,index(9,6))[0];E.setRoadZoning(b.world,t.id,'none');b.residents.reconcile();a.residents.reconcile();for(let i=0;i<300;i++){a.step();b.step();}
 assert.deepEqual(a.world.citizens,b.world.citizens);assert.deepEqual(a.traffic.agents,b.traffic.agents);assert.ok(a.traffic.agents.some(c=>c.active));
});

test('road inspector previews batch cells, draw a direction arrow and release replaced geometry',()=>{
 globalThis.CityEngine=E;const w=blank(),p=path(w,[{x:8,y:24},{x:39,y:24}]),v=Object.create(CityView.prototype);Object.assign(v,{world:w,scene:new THREE.Scene(),roadworks:{height:()=>0},menu:false});
 v.showRoadZoning(E.roadZoningTargets(w,index(20,24))[0]);assert.equal(v.roadZoningGroup.children.length,2);const mesh=v.roadZoningGroup.children.find(o=>o.isMesh),line=v.roadZoningGroup.children.find(o=>o.isLineSegments);assert.equal(mesh.geometry.attributes.position.count,cells(w,p).length*9);assert.equal(line.geometry.attributes.position.count,(E.sampleRoad(p.controls).length-1)*2+4);
 const flags=[];for(const o of v.roadZoningGroup.children){o.geometry.addEventListener('dispose',()=>flags.push('geometry'));o.material.addEventListener('dispose',()=>flags.push('material'));}
 E.setRoadZoning(w,target(p),'none');v.showRoadZoning(E.roadZoningTargets(w,index(20,24))[0]);assert.equal(flags.length,4);assert.equal(v.roadZoningGroup.children.length,1);assert.ok(v.roadZoningGroup.children[0].isLineSegments);v.clearRoadZoning();assert.equal(v.roadZoningGroup.children.length,0);assert.equal(v.roadZoningTarget,null);
});

test('road inspector controls select the correct segment, apply settings and explain unavailable roads',()=>{
 const previous=globalThis.document;class Element{constructor(tag){this.tagName=tag;this.children=[];this.value='';}append(...children){this.children.push(...children);}setAttribute(k,v){this[k]=v;}}
 globalThis.document={createElement:tag=>new Element(tag)};try{
  const w=blank(),a=path(w,[{x:8,y:20},{x:39,y:20}]),b=path(w,[{x:24,y:8},{x:24,y:38}]),selected=[],changes=[];
  const panel=roadZoningPanel(E,w,index(24,20),t=>selected.push(t),r=>changes.push(r)),road=panel.children.find(c=>c.id==='zoningRoadTarget'),sides=panel.children.find(c=>c.id==='zoningRoadSides'),note=panel.children.at(-1);assert.equal(road.children.length,2);road.value=target(b);road.onchange();assert.equal(selected.at(-1).source,b.id);sides.value='left';sides.onchange();assert.equal(b.zoneSides,'left');assert.equal(a.zoneSides,undefined);assert.equal(changes.length,1);assert.match(note.textContent,/Existing buildings/);
  E.removeRoadPath(w,b.id);road.onchange();assert.equal(sides.disabled,true);assert.equal(selected.at(-1),undefined);assert.match(note.textContent,/changed/);
  const h=path(w,[{x:5,y:4},{x:40,y:4}],'highway'),hp=roadZoningPanel(E,w,h.tiles[8],()=>{},()=>{});assert.equal(hp.children.find(c=>c.id==='zoningRoadSides').disabled,true);assert.match(hp.children.at(-1).textContent,/Highways/);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('disabled legacy paint is hidden without drawing replacement world-grid cells',()=>{
 globalThis.CityEngine=E;const w=growthWorld();E.zoneCells(w,E.rectangleCells({x:4,y:21},{x:9,y:23}),'residential_low');const v=Object.create(CityView.prototype);Object.assign(v,{world:w,zoneGroup:new THREE.Group(),menu:false,zoning:false,overlay:'zones'});v.updateZones();assert.ok(v.zoneGroup.children.length>0);
 E.setRoadZoning(w,E.roadZoningTargets(w,index(8,24))[0].id,'none');v.updateZones();assert.equal(v.zoneGroup.children.length,0);assert.ok(w.tiles.some(t=>t.zone));
});
