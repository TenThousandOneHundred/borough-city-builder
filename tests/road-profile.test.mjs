import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {Roadworks} from '../dist/roadworks.js';
import {StreetLife} from '../dist/street-life.js';
import {CityView} from '../dist/renderer.js';
import {Traffic} from '../dist/traffic.js';
import {lotPlan} from '../dist/building-plan.js';
import {floorHeight} from '../dist/landscape.js';
import {streetStations} from '../dist/street-geometry.js';
import {planJunctions,junctionCorners,junctionCuts,clearSections,roadGeometry} from '../dist/road-junction-plan.js';
import {pedestrianNetwork} from '../dist/pedestrian-network.js';
import {ASPHALT_HEIGHT,JUNCTION_HEIGHT,SIDEWALK_HEIGHT,KERB_WIDTH,PAINT_CLEARANCE,kerbProfile} from '../dist/road-profile.js';
globalThis.CityEngine=E;
const close=(a,b,tolerance=2e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
function view(){const materials=new Map();return {scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
 mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c}));return materials.get(c);},
 box(group,x,y,z,w,h,d,color){const mesh=new T.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;},
 landscape:{assets:{},material:()=>new T.MeshStandardMaterial()}};}
function city(){const w=E.createWorld('Road profile','plains',8);for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0});w.money=1e7;return w;}
const plane=(_w,x,z)=>3+x*.02+z*.03;
function markingMeshes(r){const colors=['#d4cba8','#dfded3','#e0ded2','#dedbd0','#dedbc9','#e0dfd0'];return r.group.children.filter(m=>m.material.userData.roadPaint||colors.some(c=>m.material===r.v.mat(c)));}

test('17.5 cm kerbs retain legacy and authored street footprints with 20 cm bevels',()=>{
 close((SIDEWALK_HEIGHT-ASPHALT_HEIGHT)*5,.175);close(KERB_WIDTH*5,.2);
 for(const sidewalk of [.38,.42]){
  const r=new Roadworks(view()),w=city(),stations=streetStations([{x:0,z:0},{x:12,z:0}]),width=E.ROADS.street.width;r.height=plane;
  r.ribbon(w,stations,width,0,r.v.mat('#444'),ASPHALT_HEIGHT,E.ROADS.street);r.curbs(w,stations,width,r.walkMaterial,r.v.mat('#aaa'),ASPHALT_HEIGHT,sidewalk);
  for(const x of [0,3,8,12])for(const side of [-1,1]){
   close(r.surfaceHeight(x,side*width/4,'asphalt'),plane(w,x,side*width/4)+ASPHALT_HEIGHT);
   for(const extra of [.22,sidewalk])close(r.surfaceHeight(x,side*(width/2+extra),'sidewalk'),plane(w,x,side*(width/2+extra))+SIDEWALK_HEIGHT);
   assert.equal(r.surfaceHeight(x,side*(width/2+sidewalk+.002),'sidewalk'),null,'outer edge stays in its released position');
  }
  const profile=kerbProfile(width/2,sidewalk);close(profile[2][0]-profile[0][0],KERB_WIDTH);close(profile[3][0],width/2+sidewalk);
  assert.equal(r.group.children.length,5,'same pavement, footway and kerb material groups');
 }
});

test('curved road widths and road-relative sidewalk elevations remain continuous on slopes',()=>{
 const r=new Roadworks(view()),w=city(),path={id:'curve',type:'avenue',controls:[{x:20,y:20},{x:24,y:15},{x:31,y:21}]};r.height=plane;
 const saved=JSON.stringify(path);r.path(w,path,r.v.mat('#444'),r.walkMaterial,r.v.mat('#aaa'));
 const stations=streetStations(E.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}))),half=E.ROADS.avenue.width/2;
 for(let i=4;i<stations.length-4;i+=13){const p=stations[i];close(r.surfaceHeight(p.x,p.z,'asphalt'),plane(w,p.x,p.z)+ASPHALT_HEIGHT);
  for(const side of [-1,1]){const x=p.x+p.nx*(half+.22)*side,z=p.z+p.nz*(half+.22)*side;close(r.walkingHeight(w,x,z),plane(w,x,z)+SIDEWALK_HEIGHT);}
 }
 assert.equal(JSON.stringify(path),saved);assert.equal(r.markingStats.before,r.markingStats.after,'planar sloping streets need no extra paint triangles');
});

test('tree-lined road wells rest on the lowered rendered sidewalk',()=>{
 const r=new Roadworks(view()),w=city(),path={id:'green',type:'green',controls:[{x:16,y:20},{x:30,y:20}]};r.height=plane;
 r.path(w,path,r.v.mat('#444'),r.walkMaterial,r.v.mat('#aaa'));
 const wells=r.group.children.filter(m=>m.material===r.v.mat('#595d51'));assert.ok(wells.length>2);
 for(const mesh of wells){mesh.updateMatrixWorld();const box=new T.Box3().setFromObject(mesh),{x,z}=mesh.position;close(box.min.y,r.surfaceHeight(x,z,'sidewalk'));}
});

test('rendered corner endpoints join both sidewalk widths without changing junction or walking geometry',()=>{
 for(const angle of [Math.PI/2,.7]){
  const roads=[{id:'grid/legacy',legacy:true,spec:E.ROADS.street,stations:streetStations([{x:-20,z:0},{x:20,z:0}])},{id:'path',spec:E.ROADS.avenue,stations:streetStations([{x:-20*Math.cos(angle),z:-20*Math.sin(angle)},{x:20*Math.cos(angle),z:20*Math.sin(angle)}])}];
  const plan=planJunctions(roads),j=plan.junctions[0],saved=JSON.stringify(plan),r=new Roadworks(view()),w=city();r.height=plane;r.crossings=[];r.junctionPlan=plan;r.renderRoads=new Map(roads.map(a=>[a.id,a]));
  for(const road of roads)for(const section of clearSections(road.stations,junctionCuts(road.stations,plan.junctions)))r.curbs(w,section,road.spec.width,r.walkMaterial,r.v.mat('#aaa'),ASPHALT_HEIGHT,road.legacy?.42:.38);
  const first=r.group.children.length;r.sharedJunction(w,j,r.v.mat('#444'),r.walkMaterial,r.v.mat('#aaa'));
  close(r.surfaceHeight(j.x,j.z,'asphalt'),plane(w,j.x,j.z)+JUNCTION_HEIGHT);
  const walks=r.group.children.slice(first).filter(m=>m.material===r.walkMaterial),corners=junctionCorners(j);assert.equal(walks.length,corners.length);
  for(let i=0;i<corners.length;i++){
   const c=corners[i],a=j.arms[i],b=j.arms[(i+1)%j.arms.length],p=walks[i].geometry.attributes.position;
   for(const [point,arm,sign]of [[c.points[0],a,1],[c.points.at(-1),b,-1]]){
    const width=String(arm.roadId).startsWith('grid/')?.42:.38,x=point.x-arm.tz*width*sign,z=point.z+arm.tx*width*sign;
    assert.ok(Array.from({length:p.count},(_,k)=>k).some(k=>Math.hypot(p.getX(k)-x,p.getZ(k)-z)<2e-5&&Math.abs(p.getY(k)-plane(w,x,z)-SIDEWALK_HEIGHT)<2e-5),'corner outer endpoint meets its approach');
   }
  }
  assert.equal(JSON.stringify(plan),saved,'render-only tangent correction cannot move shared paths');
 }
});

test('paint hugs actual triangulated asphalt across curves, junctions and uneven slopes with bounded refinement',()=>{
 const w=city();E.buildRoadPath(w,[{x:10,y:24},{x:22,y:18},{x:36,y:24}],'avenue');E.buildRoadPath(w,[{x:24,y:10},{x:24,y:35}],'street');
 const plan=roadGeometry(w,E),network=pedestrianNetwork(w,E),saved=JSON.stringify(w),routing=JSON.stringify(network.edges),r=new Roadworks(view());r.outsideSteps=function*(){};
 r.height=(_w,x,z)=>3+.03*x+.02*z+.015*Math.sin(x*1.5)*Math.cos(z);r.build(w);
 assert.equal(roadGeometry(w,E),plan);assert.equal(pedestrianNetwork(w,E),network);assert.equal(JSON.stringify(network.edges),routing);assert.equal(JSON.stringify(w),saved);
 assert.ok(r.markingStats.after>r.markingStats.before,'fixture exercises crossing more than one asphalt plane');
 assert.ok(r.markingStats.after<r.markingStats.before*3.2,'bounded refinement stays small on the uneven fixture');
 let samples=0;
 for(const mesh of markingMeshes(r)){
  const p=mesh.geometry.attributes.position;assert.equal(mesh.geometry.index,null);
  for(let i=0;i<p.count;i++){const h=r.surfaceHeight(p.getX(i),p.getZ(i),'asphalt');assert.notEqual(h,null);close(p.getY(i)-h,PAINT_CLEARANCE,2e-6);}
  for(let i=0;i<p.count;i+=3)for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
   const x=weights.reduce((s,a,k)=>s+a*p.getX(i+k),0),z=weights.reduce((s,a,k)=>s+a*p.getZ(i+k),0),y=weights.reduce((s,a,k)=>s+a*p.getY(i+k),0),h=r.surfaceHeight(x,z,'asphalt');
   assert.notEqual(h,null);assert.ok(y-h>.0009&&y-h<.0031,'paint remains above the mesh at triangle interiors too');samples++;
  }
 }
 assert.ok(samples>4000);assert.equal(r.markingMeshes.length,0,'batching does not retain discarded paint meshes');
});

test('paint clears sharp crests on real river and island bridge terrain without uniform subdivision',()=>{
 for(const terrain of ['river','islands']){
  const w=E.createWorld('Review markings',terrain,23);for(const t of w.tiles)Object.assign(t,{type:null,level:0,construction:undefined});w.roadPaths=[];w.money=1e8;
  E.buildRoadPath(w,[{x:10,y:24},{x:22,y:18},{x:40,y:24}],'avenue');E.buildRoadPath(w,[{x:32,y:10},{x:32,y:35}],'street');
  const r=new Roadworks(view()),saved=JSON.stringify(w);r.outsideSteps=function*(){};r.build(w);assert.equal(JSON.stringify(w),saved);
  assert.ok(r.markingStats.after<r.markingStats.before*3,'deep refinement stays local on '+terrain);
  let smallest=Infinity,largest=-Infinity;
  for(const mesh of markingMeshes(r)){
   const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++)close(p.getY(i)-r.surfaceHeight(p.getX(i),p.getZ(i),'asphalt'),PAINT_CLEARANCE,2e-6);
   for(let i=0;i<p.count;i+=3)for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
    const x=weights.reduce((s,a,k)=>s+a*p.getX(i+k),0),z=weights.reduce((s,a,k)=>s+a*p.getZ(i+k),0),y=weights.reduce((s,a,k)=>s+a*p.getY(i+k),0),h=r.surfaceHeight(x,z,'asphalt');
    assert.notEqual(h,null);smallest=Math.min(smallest,y-h);largest=Math.max(largest,y-h);
   }
  }
  assert.ok(smallest>.0001,terrain+' paint never cuts through the sharp pavement ridge');assert.ok(largest<.0042,terrain+' paint stays close to its surface');
 }
});

test('pathological paint refinement has a fixed triangle budget and cannot expand its outline',()=>{
 const r=new Roadworks(view()),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,0,1],3));
 r.surfaceHeight=(x,z)=>Math.sin(x*83)*Math.cos(z*71)*.1;r.conformMarking({},g);
 assert.deepEqual(r.markingStats,{before:1,after:64});assert.equal(g.attributes.position.count,192);
 const p=g.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getY(i)));assert.ok(p.getX(i)>=0&&p.getZ(i)>=0&&p.getX(i)+p.getZ(i)<=1);}
});

test('on-map starter streets gain no paint triangles and cached pedestrians use actual road and access heights',()=>{
 const w=E.createWorld('Normal road profile','plains',8),r=new Roadworks(view());r.outsideSteps=function*(){};r.build(w);assert.equal(r.markingStats.after,r.markingStats.before);
 const state={x:-20,z:2+E.ROADS.street.width/2+.22,heading:0,phase:'wait'},resident={id:1,activity:'Waiting for bus',transit:state};w.citizens={time:0};
 let calls=0;const sample=r.walkingHeight.bind(r);r.walkingHeight=(...args)=>{calls++;return sample(...args);};
 const v={...r.v,world:w,roadworks:r,menu:false,transit:{walking:{active:new Map()},passengers:new Map([[1,resident]])}},life=new StreetLife(v),saved=JSON.stringify(resident);life.build(w);
 close(life.parts[0].instanceMatrix.array[13],sample(w,state.x,state.z)+.19);calls=0;life.update(0);assert.equal(calls,0,'waiting people reuse their height');
 state.z=2;life.update(0);assert.equal(calls,1);close(life.parts[0].instanceMatrix.array[13],sample(w,state.x,state.z)+.19);
 state.z=2+E.ROADS.street.width/2+.22;life.update(0);assert.equal(JSON.stringify(resident),saved);assert.equal(w.citizens.time,0);
 // Access paving is queried separately so rebuilding aprons cannot invalidate
 // road triangles or force a new road mesh just to update standing feet.
 r.accessSurfaces={sample:()=>7};r.accessRevision=1;life.update(0);close(life.parts[0].instanceMatrix.array[13],7.19);calls=0;life.update(0);assert.equal(calls,0);
});

test('adding and removing bus-stop ramps refreshes adjacent access paving and cached pedestrian heights',()=>{
 const w=E.createWorld('Bus ramp access','plains',23);for(const t of w.tiles)Object.assign(t,{type:null,level:0,ground:'land'});
 for(let x=10;x<=40;x++)Object.assign(w.tiles[24*48+x],{type:'road',roadType:'street',roadWidth:1});
 const home=23*48+24;Object.assign(w.tiles[home],{type:'office',level:1});
 const v=view(),r=new Roadworks(v),plan=lotPlan(w,home),root=new T.Group(),buildings=new Map([[home,root]]);
 root.position.y=floorHeight(w,plan.cx,plan.cz)+.04;root.userData={asset:true,plan};r.outsideSteps=function*(){};r.syncSignals=()=>{};
 r.build(w);r.buildAccess(w,buildings);const revision=r.accessRevision,oldIndex=r.accessSurfaces,before=r.accessSurfaces.sample(2,.38);assert.notEqual(before,null);
 const resident={id:1,activity:'Waiting for bus',transit:{x:2,z:.38,heading:0,phase:'wait'}};w.citizens={time:0};
 Object.assign(v,{world:w,roadworks:r,traffic:new Traffic(w,E),buildings,renderer:{shadowMap:{}},disposeGroup:g=>g.clear(),menu:false,transit:{walking:{active:new Map()},passengers:new Map([[1,resident]])}});
 const life=new StreetLife(v);life.build(w);const pose=JSON.stringify(resident);
 w.transit={version:1,nextId:2,lines:[{id:1,stops:[24*48+24,24*48+32]}]};const added=JSON.stringify(w);
 CityView.prototype.drawTransitStops.call(v);
 assert.equal(r.accessRevision,revision+1);assert.notEqual(r.accessSurfaces,oldIndex);assert.equal(JSON.stringify(w),added);
 const dropped=r.accessSurfaces.sample(2,.38);assert.ok(before-dropped>.001,'fixture actually drops the adjacent apron endpoint');close(dropped,r.surfaceHeight(2,.38,'sidewalk'),2e-6);
 life.update(0);assert.equal(life.lastHeightSamples,1);close(life.parts[0].instanceMatrix.array[13],r.walkingHeight(w,2,.38)+.19);life.update(0);assert.equal(life.lastHeightSamples,0);
 w.transit.lines=[];const removed=JSON.stringify(w);CityView.prototype.drawTransitStops.call(v);
 assert.equal(r.accessRevision,revision+2);close(r.accessSurfaces.sample(2,.38),before,2e-6);assert.equal(JSON.stringify(w),removed);
 life.update(0);assert.equal(life.lastHeightSamples,1);close(life.parts[0].instanceMatrix.array[13],before+.19);assert.equal(JSON.stringify(resident),pose);assert.equal(w.citizens.time,0);
 CityView.prototype.drawTransitStops.call(v);life.update(0);assert.equal(r.accessRevision,revision+2);assert.equal(life.lastHeightSamples,0,'unchanged stops retain geometry and height caches');
});


test('vehicles follow the finished junction triangles and invalidate only their render height cache',()=>{
 const w=city();E.buildRoadPath(w,[{x:10,y:24},{x:36,y:24}],'avenue');E.buildRoadPath(w,[{x:24,y:10},{x:24,y:35}],'street');
 const r=new Roadworks(view());r.outsideSteps=function*(){};r.height=(_w,x,z)=>3+.005*x*x+.003*z*z;r.build(w);
 const j=r.junctionPlan.junctions[0],x=j.x+.137,z=j.z+.219;let rendered=null,owners=0;
 // Read the final batched mesh directly, independently of the query index.
 for(const mesh of r.group.children){if(mesh.material!==r.asphalt)continue;const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),ux=p.getX(i+1)-ax,uz=p.getZ(i+1)-az,vx=p.getX(i+2)-ax,vz=p.getZ(i+2)-az,den=ux*vz-uz*vx;if(Math.abs(den)<1e-10)continue;
   const b=((x-ax)*vz-(z-az)*vx)/den,c=(ux*(z-az)-uz*(x-ax))/den;if(b>1e-6&&c>1e-6&&b+c<1-1e-6){owners++;rendered=p.getY(i)+b*(p.getY(i+1)-p.getY(i))+c*(p.getY(i+2)-p.getY(i));}
  }
 }
 assert.equal(owners,1,'exactly one visible pavement triangle owns the junction point');assert.notEqual(rendered,null);
 assert.ok(Math.abs(rendered-r.height(w,x,z)-ASPHALT_HEIGHT)>.003,'fixture distinguishes triangulated pavement from raw terrain');
 const agent={active:true,x,z,heading:.8,route:[1,2]},saved=JSON.stringify(agent),car={agent,mesh:new T.Group()},v={world:w,roadworks:r,running:false};
 let queries=0;const sample=r.drivingHeight.bind(r);r.drivingHeight=(...args)=>{queries++;return sample(...args);};
 CityView.prototype.moveCar.call(v,car);close(car.mesh.position.y,rendered,1e-6);CityView.prototype.moveCar.call(v,car);assert.equal(queries,1);
 r.build(w);CityView.prototype.moveCar.call(v,car);assert.equal(queries,2);close(car.mesh.position.y,rendered,1e-6);assert.equal(JSON.stringify(agent),saved,'pavement work never advances or rewrites the route');
});
