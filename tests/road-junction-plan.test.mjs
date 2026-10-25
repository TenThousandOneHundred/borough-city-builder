import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import * as THREE from '../dist/vendor/three.module.js';
import {Roadworks} from '../dist/roadworks.js';
import {streetStations} from '../dist/street-geometry.js';
import {planWidthTransitions,transitionWidth,roadGeometry,roadDescriptors,planJunctions,junctionCorners,junctionCuts,clearRanges,clearSections,signalPlacements,extendJunctionEndpoints} from '../dist/road-junction-plan.js';
globalThis.CityEngine=E;
const road=(id,points,type='street')=>({id,spec:E.ROADS[type],stations:streetStations(points)});
const cross=()=>[road('a',[{x:-20,z:0},{x:20,z:0}]),road('b',[{x:0,z:-20},{x:0,z:20}])];
const view=()=>{const materials=new Map();return{scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false,mat(c){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c}));return materials.get(c);}}};

test('four-way and T crossings form a single shared surface with the correct outward arms',()=>{
 let p=planJunctions(cross());assert.equal(p.junctions.length,1);let j=p.junctions[0];assert.equal(j.arms.length,4);assert.equal(j.x,0);assert.equal(j.z,0);assert.ok(Math.abs(j.radius-1.875)<1e-8);
 const t=cross();t[1]=road('b',[{x:0,z:-20},{x:0,z:0}]);j=planJunctions(t).junctions[0];assert.equal(j.arms.length,3);assert.ok(!j.arms.some(a=>a.tz>.9));
 for(const corner of junctionCorners(j))for(const p of corner.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
});
test('duplicate endpoint samples merge while straight joins and separated crossings stay separate',()=>{
 const roads=cross().map(r=>({...r,stations:streetStations([r.stations[0],{x:0,z:0},r.stations[1]])}));assert.equal(planJunctions(roads).junctions.length,1);
 assert.equal(planJunctions([road('a',[{x:-10,z:0},{x:0,z:0}]),road('b',[{x:0,z:0},{x:10,z:0}])]).junctions.length,0);
 roads.push(road('c',[{x:12,z:-20},{x:12,z:20}]));assert.equal(planJunctions(roads).junctions.length,2);
});
test('different lane widths and arbitrary approach angles retain finite connected corner boundaries',()=>{
 for(const angle of [.16,.3,.7,Math.PI/2,2.2,2.8]){
  const a=road('a',[{x:-30,z:0},{x:30,z:0}],'boulevard'),b=road('b',[{x:-30*Math.cos(angle),z:-30*Math.sin(angle)},{x:30*Math.cos(angle),z:30*Math.sin(angle)}]);
  const j=planJunctions([a,b]).junctions[0];assert.equal(j.arms.length,4);assert.equal(j.arms.filter(a=>a.width===4.5).length,2);
  for(const {points}of junctionCorners(j))for(const p of points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(Math.hypot(p.x,p.z)<12);}
 }
});
test('cut intervals remove center paint and medians, preserve phase, and union close intersections',()=>{
 const roads=cross(),stations=roads[0].stations,j=planJunctions(roads).junctions[0],cuts=junctionCuts(stations,[j],1.2);assert.equal(cuts.length,1);assert.ok(Math.abs(cuts[0][0]-(20-j.radius-1.2))<1e-7);
 for(const [a,b]of clearRanges(.25,39,cuts)){assert.ok(a>=.25&&b<=39);assert.ok(b<=cuts[0][0]||a>=cuts[0][1]);}
 const merged=junctionCuts(stations,[j,{...j,x:2}],1.2);assert.equal(merged.length,1);
 for(const section of clearSections(stations,cuts))for(const p of section)assert.ok(Math.hypot(p.x,p.z)>=j.radius+1.2-1e-6);
 assert.deepEqual(clearRanges(0,10,[[0,2],[3,5],[7,12]]),[[2,3],[5,7]]);
 assert.deepEqual(clearRanges(1,2,[[0,10]]),[]);
});
test('curved and grid starter roads participate in the same junction plan without changing the world',()=>{
 const w=E.createWorld('Shared roads','plains',42);w.money=1e6;assert.ok(E.buildRoadPath(w,[{x:10,y:24},{x:13,y:17},{x:25,y:12}],'avenue').ok);
 const before=JSON.stringify(w),p=planJunctions(roadDescriptors(w,E));assert.ok(p.junctions.some(j=>Math.hypot(j.x+54,j.z-2)<.01&&j.arms.length>=3));assert.equal(JSON.stringify(w),before);
});
test('junction surfaces face upward on slopes and curbs never close the approach mouths',()=>{
 const v=view(),r=new Roadworks(v);r.height=(_w,x,z)=>x*.02+z*.03;
 for(const item of planJunctions(cross()).junctions){r.sharedJunction({},item,v.mat('#444444'),r.walkMaterial,v.mat('#aaaaaa'));}
 let triangles=0;r.group.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count||p.count)/3;});assert.ok(triangles>100);
 const asphalt=r.group.children[0];for(const y of Array.from({length:asphalt.geometry.attributes.normal.count},(_,i)=>asphalt.geometry.attributes.normal.getY(i)))assert.ok(y>.99);
 const item=planJunctions(cross()).junctions[0];for(const corner of junctionCorners(item))for(const p of corner.points)assert.ok(Math.hypot(p.x,p.z)>1,'no curb inside the vehicle crossing');
});
test('the spatial broad phase avoids comparing every pair in an extended sparse network',()=>{
 const roads=[];for(let i=0;i<100;i++)roads.push(road(String(i),[{x:i*20,z:0},{x:i*20+8,z:8}]));const p=planJunctions(roads);assert.equal(p.junctions.length,0);assert.ok(p.comparisons<100);
});


test('signal poles follow the actual approach sidewalks and retain the existing controller axes',()=>{
 const roads=cross();roads[0].spec=E.ROADS.boulevard;const j=planJunctions(roads).junctions[0],controls=[{id:7,x:0,z:0,radius:3}],before=JSON.stringify(controls),signals=signalPlacements([j],controls);
 assert.equal(signals.length,4);assert.equal(signals.filter(p=>p.axis==='x').length,2);
 for(const p of signals){const arm=j.arms.find(a=>Math.abs(a.tx-p.tx)<1e-8&&Math.abs(a.tz-p.tz)<1e-8),along=p.x*p.tx+p.z*p.tz,lateral=-p.x*p.tz+p.z*p.tx;assert.ok(Math.abs(lateral+arm.width/2+.23)<1e-8);assert.ok(along>j.radius);assert.equal(p.controller,7);}
 assert.equal(JSON.stringify(controls),before);assert.deepEqual(signalPlacements([j],[]),[]);
});


test('branches ending inside pavement meet its centerline without snapping unrelated nearby roads',()=>{
 const base=road('main',[{x:-15,z:0},{x:15,z:0}]),branch=road('branch',[{x:0,z:-12},{x:0,z:-.8}]),unrelated=road('unrelated',[{x:8,z:-12},{x:8,z:-2}]);
 const result=extendJunctionEndpoints([base,branch,unrelated]);assert.equal(branch.stations.at(-1).z,0);assert.equal(unrelated.stations.at(-1).z,-2);assert.equal(planJunctions(result).junctions.length,1);assert.equal(planJunctions(result).junctions[0].arms.length,3);
 const parallel=road('parallel',[{x:-15,z:.8},{x:15,z:.8}]),before=JSON.stringify(parallel);extendJunctionEndpoints([base,parallel]);assert.equal(JSON.stringify(parallel),before);
});

test('demolishing a crossing rebuilds uninterrupted pavement without retaining junction cuts',()=>{
 const w=E.createWorld('Road edits','plains',42);w.money=1e6;for(const t of w.tiles)Object.assign(t,{type:null,level:0});
 E.buildRoadPath(w,[{x:5,y:24},{x:40,y:24}],'boulevard');const side=E.buildRoadPath(w,[{x:24,y:10},{x:24,y:38}],'street');
 const v=view();v.landscape={assets:{},material:()=>v.mat('#555555')};v.box=function(group,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(this.unitBox,this.mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;};const r=new Roadworks(v);r.outside=()=>{};
 const before=JSON.stringify(w);r.build(w);assert.equal(r.junctionPlan.junctions.length,1);assert.equal(JSON.stringify(w),before);assert.ok(r.batchStats.after<r.batchStats.before);
 E.removeRoadPath(w,side.path.id);r.build(w);assert.equal(r.junctionPlan.junctions.length,0);assert.deepEqual(junctionCuts(r.roadDescriptors[0].stations,r.junctionPlan.junctions),[]);
});
test('junction rendering and rebuilds cannot pause or alter the independent vehicle simulation',async()=>{
 const {simulation}=await import('./traffic-scale-fixture.mjs'),a=simulation(128),b=simulation(128),v=view();v.landscape={assets:{},material:()=>v.mat('#555555')};v.box=function(group,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(this.unitBox,this.mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;};const r=new Roadworks(v);r.outside=()=>{};
 const world=JSON.stringify(a.world);for(let n=0;n<600;n++){if(n%200===0)r.build(a.world);a.step(.05);b.step(.05);}
 const state=t=>t.agents.map(p=>[p.active,p.x,p.z,p.segment,p.distance,p.speed,p.waitReason]);assert.deepEqual(state(a),state(b));assert.equal(a.time,b.time);assert.ok(a.time>29);assert.equal(JSON.stringify(a.world),world);
});

test('rendering and traffic reuse road geometry until road values change',()=>{
 const w=E.createWorld('Geometry cache','plains',42);w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.money=1000000;E.buildRoadPath(w,[{x:5,y:20},{x:35,y:20}],'street');
 const before=JSON.stringify(w),first=roadGeometry(w,E);assert.equal(roadGeometry(w,E),first);assert.equal(JSON.stringify(w),before);
 w.day++;w.money++;w.tiles[0].people=20;w.elevationRevision=3;assert.equal(roadGeometry(w,E),first);
 w.roadPaths[0].controls[1].y=22;const changed=roadGeometry(w,E);assert.notEqual(changed,first);assert.notDeepEqual(changed.roads[0].stations,first.roads[0].stations);
 const i=w.roadPaths[0].tiles[0];w.tiles[i].legacyRoad=true;w.tiles[i].roadWidth=2;assert.notEqual(roadGeometry(w,E),changed);
});


test('outside connections preserve authored road width, dividers and median',async()=>{
 const {canvasDocument}=await import('./architecture-fixture.mjs');
 const {laneLayout}=await import('../dist/road-lanes.js');
 const old=globalThis.document;globalThis.document=canvasDocument();
 try{for(const type of ['street','avenue','boulevard','highway','oneway']){
  const w=E.createWorld('Outside lanes','plains',42),v=view();v.box=()=>{};
  const r=new Roadworks(v),widths=[],dividers=[],edges=[],medians=[];
  r.height=()=>0;r.ribbon=(_w,_p,width)=>widths.push(width);
  r.dash=(_w,_s,offset)=>dividers.push(offset);r.line=(_w,_p,_width,_color,offset)=>edges.push(offset);r.surface=(...args)=>medians.push(args);
  Object.assign(w.tiles[24],{roadType:type,pathIds:['test']});
  r.outside(w,{id:24,x:2,z:-94,dx:0,dz:-1},v.mat('#555555'));
  const spec=E.ROADS[type];assert.deepEqual(widths,[spec.width]);
  assert.deepEqual(dividers,laneLayout(spec).dividers.map(d=>d.offset));
  assert.deepEqual(edges,[-(spec.width/2-.12),spec.width/2-.12]);
  assert.equal(medians.length,spec.median?1:0);
 }}finally{globalThis.document=old;}
});


test('aligned width changes taper only the wider approach and preserve world controls',()=>{
 for(const reverse of [false,true]){
  const points=[{x:-30,z:0},{x:0,z:0}],wide=road('wide',reverse?[...points].reverse():points,'highway'),narrow=road('narrow',[{x:0,z:0},{x:30,z:0}]);
  const before=JSON.stringify([wide,narrow]),plan=planWidthTransitions([wide,narrow]);assert.equal(plan.size,1);const tapers=plan.get('wide');assert.equal(tapers.length,1);assert.equal(tapers[0].end,reverse?0:1);
  assert.equal(transitionWidth(wide,tapers,reverse?0:30),narrow.spec.width);assert.equal(transitionWidth(wide,tapers,15),wide.spec.width);
  for(let d=0;d<=30;d+=.1){const width=transitionWidth(wide,tapers,d);assert.ok(width>=narrow.spec.width&&width<=wide.spec.width);}
  assert.equal(JSON.stringify([wide,narrow]),before);
  assert.equal(planWidthTransitions([wide,narrow],[{x:0,z:0,radius:3}]).size,0,'junction surfaces take priority');
  assert.equal(planWidthTransitions([wide,{...narrow,spec:wide.spec}]).size,0,'equal widths remain unchanged');
  assert.equal(planWidthTransitions([wide,narrow,road('branch',[{x:0,z:0},{x:0,z:20}])]).size,0,'multi-arm joins do not become tapers');
 }
});
test('lane-merge vehicles fit inside the rendered pavement taper in either direction',async()=>{
 const {Traffic}=await import('../dist/traffic.js');
 const w=E.createWorld('Taper clearance','plains',42);w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.money=1000000;
 E.buildRoadPath(w,[{x:5,y:24},{x:24,y:24}],'highway');E.buildRoadPath(w,[{x:24,y:24},{x:42,y:24}],'street');
 const t=new Traffic(w,E),plan=roadGeometry(w,E),wide=plan.roads.find(r=>r.spec===E.ROADS.highway),tapers=plan.tapers.get(wide.id);
 for(const reverse of [false,true])for(let lane=0;lane<3;lane++){
  const cells=t.trace(t.search(24*48+(reverse?42:5)),24*48+(reverse?5:42)),route=t.route(cells,null,false,lane);
  for(const p of route){const width=p.x<2?transitionWidth(wide,tapers,p.x-wide.stations[0].x):E.ROADS.street.width;assert.ok(Math.abs(p.z-2)+.25<width/2,'body clears tapered pavement');}
 }
});

test('approach arrows follow incoming lanes, skip outgoing one-way arms and show terminal turns',async()=>{
 const {approachMarkings}=await import('../dist/road-markings.js');const roads=cross(),junctions=planJunctions(roads).junctions,arrows=approachMarkings(roads,junctions);
 assert.equal(arrows.length,4);assert.ok(arrows.every(a=>a.turns.join()==='straight'));
 for(const a of arrows){const dx=a.junction.x-a.center.x,dz=a.junction.z-a.center.z;assert.ok(dx*a.tx+dz*a.tz>0);assert.ok(Math.hypot(dx,dz)>a.junction.radius+2);}
 const t=[roads[0],road('b',[{x:0,z:-20},{x:0,z:0}])],ta=approachMarkings(t,planJunctions(t).junctions),terminal=ta.find(a=>a.roadId==='b');assert.deepEqual(terminal.turns,['left','right']);
 const oneWay=Object.entries(E.ROADS).find(([,s])=>s.oneway&&s.sidewalk)[0],one=[road('a',[{x:-20,z:0},{x:20,z:0}],oneWay),roads[1]],oa=approachMarkings(one,planJunctions(one).junctions).filter(a=>a.roadId==='a');assert.ok(oa.length);assert.ok(oa.every(a=>a.center.x<0&&a.tx>0));
});
test('curved approach paint stays on its lane and out of adjacent crossings',async()=>{
 const {approachMarkings}=await import('../dist/road-markings.js');const roads=[road('a',[{x:-20,z:0},{x:0,z:0},{x:10,z:5},{x:20,z:15}]),road('b',[{x:0,z:-20},{x:0,z:20}]),road('c',[{x:5,z:-20},{x:5,z:20}])],junctions=planJunctions(roads).junctions,arrows=approachMarkings(roads,junctions);
 assert.ok(arrows.length);for(const a of arrows){assert.ok(Math.abs(Math.hypot(a.tx,a.tz)-1)<1e-8);assert.ok(junctions.every(j=>j===a.junction||Math.hypot(j.x-a.center.x,j.z-a.center.z)>j.radius+.5));}
});
test('approach paint uses bounded upward geometry and the existing shared marking material',()=>{
 const r=new Roadworks(view()),roads=cross();r.roadDescriptors=roads;r.junctionPlan=planJunctions(roads);r.height=()=>2;r.buildApproachMarkings({});assert.equal(r.group.children.length,1);const m=r.group.children[0];assert.equal(m.material,r.v.mat('#dedbd0'));assert.ok(m.geometry.attributes.position.count<200);
 const n=m.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.99);const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-2.084)<1e-6);
});
