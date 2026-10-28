import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {laneLayout} from '../dist/road-lanes.js';
import {roadFinishData} from '../dist/road-finish.js';
import {streetStations,streetSurface} from '../dist/street-geometry.js';
import {Roadworks} from '../dist/roadworks.js';
import * as T from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} matches ${b}`);
test('highway wheel-wear coordinates match actual travel lanes and stop at paved shoulders',()=>{
 const stations=streetStations([{x:0,z:0},{x:8,z:4},{x:18,z:6}]);
 for(const type of ['motorway','highway'])for(const scale of [.65,1,1.2]){
  const spec=E.ROADS[type],width=spec.width*scale,layout=laneLayout(spec,width);
  const g=streetSurface(stations,[[-width/2,.08],[width/2,.08]],()=>0);roadFinishData(g,stations,width,spec);
  const data=g.attributes.roadFinish;
  for(let i=0;i<data.count;i++){
   near(data.getX(i),layout.laneWidth);near(-data.getZ(i),layout.outerEdge);
   for(const center of [...layout.forward,...layout.reverse]){
    const coordinate=spec.oneway?center:Math.abs(center),phase=(coordinate-data.getY(i))/data.getX(i);
    near(phase-Math.floor(phase),.5);
    assert.ok(Math.abs(center)+.15<layout.outerEdge,'both tyre tracks stay inside the travel edge');
   }
   assert.ok(-data.getZ(i)<width/2,'the remaining asphalt is a shoulder without repeated tyre tracks');
  }
  g.dispose();
 }
});

test('ordinary-road finish payloads retain their released coordinates and coverage',()=>{
 const stations=streetStations([{x:0,z:0},{x:5,z:8}]);
 for(const spec of Object.values(E.ROADS).filter(s=>!s.limitedAccess)){
  const g=streetSurface(stations,[[-spec.width/2,.08],[spec.width/2,.08]],()=>0);roadFinishData(g,stations,spec.width,spec);
  const median=spec.median?.16:0,expected=new Float32Array(stations.flatMap(()=>Array(2).fill([spec.oneway?spec.width/spec.lanes:(spec.width/2-median)/Math.max(1,spec.lanes/2),spec.oneway?-spec.width/2:median,1]).flat()));
  assert.deepEqual(g.attributes.roadFinish.array,expected,spec.name);g.dispose();
 }
});

test('authored highway edges enclose the same lanes as outside connections without repeating chevrons',()=>{
 const w=E.createWorld('Highway paint','plains',19),materials=new Map(),v={scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,landscape:{assets:{}},mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));return materials.get(color);},box(){}};
 const previousDocument=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
 try{for(const type of ['motorway','highway']){
  const r=new Roadworks(v),spec=E.ROADS[type],edges=[],outsideEdges=[];r.height=()=>0;r.surface=()=>null;r.ribbon=()=>null;r.dash=()=>{};r.dashSteps=function*(){};r.nearJunction=()=>false;
  r.paint=(world,points,width,offset)=>edges.push({width,offset:typeof offset==='function'?offset(points[0]):offset});
  r.path(w,{id:'paint-road',type,controls:[{x:5,y:12},{x:35,y:12}]},v.mat('#333'),v.mat('#aaa'),v.mat('#bbb'));
  assert.equal(edges.length,2,'only the two continuous edge stripes, no free-flow chevrons');
  edges.forEach(e=>{near(Math.abs(e.offset),laneLayout(spec).outerEdge);near(e.width,.04);});
  const id=12*48;Object.assign(w.tiles[id],{type:'road',roadType:type,pathIds:['paint-road']});r.line=(world,points,width,color,offset)=>outsideEdges.push(offset);
  r.outside(w,{id,x:-94,z:-46,dx:-1,dz:0},v.mat('#333'));
  assert.deepEqual(outsideEdges,edges.map(e=>e.offset));
 }}finally{globalThis.document=previousDocument;}
});
