import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {CityView} from '../dist/renderer.js';
import {Landscape,groundHeight,terrainColor} from '../dist/landscape.js';
import {Roadworks} from '../dist/roadworks.js';
import {sculptTerrain,undoTerrain} from '../dist/terrain-edit.js';
import {buildFootpaths} from '../dist/footpaths.js';
import {Traffic} from '../dist/traffic.js';

globalThis.CityEngine=E;
function world(){const w=E.createWorld('Earthworks lifecycle','plains',431);for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});w.roadPaths=[];w.money=1e8;assert.ok(E.buildRoadPath(w,[{x:20,y:24},{x:28,y:24}],'street').ok);return w;}
function grid(w){
 const g=new THREE.PlaneGeometry(48,48,48,48);g.rotateX(-Math.PI/2);const p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,groundHeight(w,x,z));const color=terrainColor(w,x,z);c.set([color.r,color.g,color.b],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeVertexNormals();return g;
}
function harness(w,{raised=false}={}){
 const v=Object.create(CityView.prototype),materials=new Map();Object.assign(v,{world:w,scene:new THREE.Scene(),materials,unitBox:new THREE.BoxGeometry(),camera:new THREE.PerspectiveCamera(45,1,.1,200),night:false,overlay:'none',assetsReady:false,detailEnabled:true,buildings:new Map(),tileGroup:new THREE.Group(),renderer:{shadowMap:{}},sun:{intensity:3},ambient:{intensity:.5},models:{accepts:()=>false,rebuild(){}},streetLife:{build(){}},cars:[],grid:new THREE.Group()});
 v.scene.fog=new THREE.Fog('#ffffff',100,200);v.camera.position.set(0,15,20);
 v.mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);};
 v.setupCars=()=>{};v.updateZones=()=>{};v.updateOverlay=()=>{};v.makeGrid=()=>{};v.drawFootpaths=()=>{};
 const land=Object.create(Landscape.prototype);Object.assign(land,{view:v,world:w,group:new THREE.Group(),assets:{}});v.scene.add(land.group);
 land.ground=new THREE.Mesh(grid(w),new THREE.MeshStandardMaterial({vertexColors:true}));land.group.add(land.ground);land.baseColors=land.ground.geometry.attributes.color.array.slice();land.terrainBases=[{mesh:land.ground,indices:land.ground.geometry.index.array.slice(),drawRange:{...land.ground.geometry.drawRange}}];
 land.refreshDevelopment=()=>{};land.refreshTrees=()=>{};land.refreshCover=()=>{};v.landscape=land;
 const roads=new Roadworks(v);v.roadworks=roads;
 // A modest, controlled fill reaches an adjacent parcel and creates retaining
 // faces once its shoulder is constrained. Grade generation has separate tests.
 if(raised)roads.height=(world,x,z)=>roads.baseHeight(world,x,z)+.04;
 v.cleanup=()=>{land.clear();roads.clear();roads.accessGroup?.traverse(o=>o.geometry?.dispose());roads.lampMaterial.dispose();roads.walkMaterial.dispose();roads.lightPoolMaterial.dispose();for(const mat of materials.values())mat.dispose();v.unitBox.dispose();};
 return v;
}
function digest(land){const h=createHash('sha256');for(const mesh of [land.ground,...land.earthworkMeshes||[]]){const g=mesh.geometry;for(const name of Object.keys(g.attributes).sort()){const a=g.attributes[name].array;h.update(name);h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}if(g.index){const a=g.index.array;h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}h.update(String(g.drawRange.start)+':'+g.drawRange.count);}return h.digest('hex');}

test('deleting the last road restores natural terrain and releases copied picking surfaces and old fragments',()=>{
 const w=world(),v=harness(w),natural=v.landscape.ground.geometry.attributes.position.array.slice(),indices=v.landscape.ground.geometry.index.array.slice();
 try{
  v.refresh(true);const plan=v.roadworks.earthworks,copies=v.roadworks.earthworkSurfaces.slice(),parts=v.landscape.earthworkMeshes.slice();assert.ok(plan);assert.ok(copies.length>0);assert.ok(parts.length>0);
  const roadY=v.roadworks.surfaceHeight(2,2,'asphalt');assert.notEqual(roadY,null);assert.ok(copies.some(m=>m.userData.roadSurface==='sidewalk'));
  let copyReleases=0,partReleases=0;for(const m of copies)m.geometry.addEventListener('dispose',()=>copyReleases++);for(const m of parts)m.geometry.addEventListener('dispose',()=>partReleases++);
  v.scene.updateMatrixWorld(true);v.canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};v.ndc=new THREE.Vector2();v.point=new THREE.Vector3();v.ray=new THREE.Raycaster();v.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);v.camera.position.set(2,25,2);v.camera.lookAt(2,0,2);v.camera.updateMatrixWorld(true);
  const tile=v.getTile(100,100);assert.equal(tile.x,24);assert.equal(tile.y,24);assert.ok(Math.abs(v.point.y-roadY)<1e-4,'copied asphalt remains pickable after static batching disposes source geometry');
  assert.ok(E.removeRoadPath(w,w.roadPaths[0].id).ok);v.refresh();
  assert.equal(v.roadworks.earthworks,null);assert.equal(v.landscape.earthworks,null);assert.equal(v.roadworks.earthworkSurfaces.length,0);assert.equal(copyReleases,copies.length);assert.equal(partReleases,parts.length);assert.equal(plan.sample(2,2),null,'obsolete plan query data is disposed by Roadworks');
  assert.deepEqual(v.landscape.ground.geometry.index.array,indices);assert.deepEqual(v.landscape.ground.geometry.attributes.position.array,natural);assert.equal(v.landscape.ground.geometry.drawRange.count,Infinity);assert.equal(v.landscape.renderGroundTargets().length,1);
  v.getTile(100,100);assert.ok(v.point.y<roadY,'deleted pavement is no longer present in picking');
 }finally{v.cleanup();}
});

test('bridge concrete cover survives batching and occupancy refresh, stays pickable and releases with its road',()=>{
 const w=world();w.tiles[24*48+24].ground='water';const v=harness(w),r=v.roadworks,originals=[],capture=r.captureEarthworkSurfacesSteps;
 // Observe the real bridge meshes immediately before the real static batch
 // consumes them. Their later disposal cannot invalidate retained cover.
 r.captureEarthworkSurfacesSteps=function*(){this.group.traverse(mesh=>{if(mesh.userData.earthworkCover){const item={mesh,releases:0};mesh.geometry.addEventListener('dispose',()=>item.releases++);originals.push(item);}});return yield* capture.call(this);};
 try{
  v.refresh(true);assert.ok(r.bridgeStats.spans>0);assert.ok(originals.length>0);assert.ok(originals.every(o=>o.releases===1),'static batching releases the original concrete buffers');
  const copies=r.earthworkStructures,initial=r.earthworks,revision=r.heightRevision,snapshot=structuredClone(initial.structuralSnapshot);assert.equal(initial.stats.fallback,false);assert.equal(copies.length,originals.length);assert.ok(snapshot.length>20);
  for(let i=0;i<copies.length;i++){
   const a=originals[i].mesh,b=copies[i];assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);assert.deepEqual(b.geometry.attributes.position.array,a.geometry.attributes.position.array);assert.equal(b.material,a.material);assert.deepEqual(Object.keys(b.geometry.attributes),['position'],'cover copies retain no redundant shading buffers');assert.equal(b.userData.earthworkCover,true);
   // Disposal leaves typed arrays accessible; changing a discarded original
   // makes an accidental alias observable both now and on the next rebuild.
   a.geometry.attributes.position.array.fill(999);
  }
  let probe;findCover:for(const {vertices:[a,b,c]}of snapshot){
   if((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0])>=-1e-8)continue;
   for(const weights of [[1/3,1/3,1/3],[.94,.03,.03],[.03,.94,.03],[.03,.03,.94]]){
    const [x,y,z]=[0,1,2].map(k=>a[k]*weights[0]+b[k]*weights[1]+c[k]*weights[2]),support=initial.sample(x,z);
    if(r.surfaceHeight(x,z,'asphalt')===null&&r.surfaceHeight(x,z,'sidewalk')===null&&support!==null&&Math.abs(support-(y-.02))<1e-5){probe={x,z,y};break findCover;}
   }
  }
  assert.ok(probe,'fixture includes exposed concrete cover beyond the asphalt and sidewalk footprint');
  v.scene.updateMatrixWorld(true);v.canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};v.ndc=new THREE.Vector2();v.point=new THREE.Vector3();v.ray=new THREE.Raycaster();v.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);v.camera.position.set(probe.x,25,probe.z);v.camera.lookAt(probe.x,0,probe.z);v.camera.updateMatrixWorld(true);
  const hit=v.getTile(100,100);assert.ok(hit);assert.ok(Math.abs(v.point.y-probe.y)<2e-5,'the concrete edge remains pickable above its omitted terrain');
  let releases=0;for(const mesh of copies)mesh.geometry.addEventListener('dispose',()=>releases++);
  // This dry parcel adjoins the western approach's possible shoulder. A far
  // parcel correctly avoids the new conservative earthworks invalidation.
  Object.assign(w.tiles[25*48+21],{type:'park',level:1});v.refresh();assert.notEqual(r.earthworks,initial);assert.equal(r.earthworkStructures,copies);assert.equal(r.heightRevision,revision);assert.equal(releases,0);assert.equal(r.earthworks.stats.fallback,false);assert.deepEqual(r.earthworks.structuralSnapshot,snapshot,'occupancy refresh reads retained geometry, not discarded batch sources');assert.ok(Math.abs(r.earthworks.sample(probe.x,probe.z)-(probe.y-.02))<1e-5);
  assert.ok(E.removeRoadPath(w,w.roadPaths[0].id).ok);v.refresh();assert.equal(releases,copies.length);assert.equal(r.earthworkStructures.length,0);assert.equal(r.earthworks,null);assert.ok(originals.every(o=>o.releases===1),'original buffers are not disposed again through the retained copies');
 }finally{v.cleanup();}
});

test('occupied-parcel changes refresh earthworks from retained road surfaces while camera and night changes keep walls attached',()=>{
 const w=world(),v=harness(w,{raised:true});
 try{
  v.refresh(true);const initial=v.roadworks.earthworks,copies=v.roadworks.earthworkSurfaces,roadRevision=v.roadworks.heightRevision;
  let probe;for(let z=4.05;z<5.8;z+=.1){const y=initial.sample(2,z);if(y!==null&&Math.abs(y-groundHeight(w,2,z))>.02){probe={x:2,z,y};break;}}assert.ok(probe,'initial fill reaches the future parcel');
  const walk=E.buildWalkPath(w,[{x:24,y:25},{x:24,y:28}]);assert.ok(walk.ok);assert.equal(w.tiles[25*48+24].type,'path');v.refresh();
  assert.equal(v.roadworks.earthworks,initial,'a narrow footpath must not reserve a four-unit square natural foundation');assert.equal(v.roadworks.earthworkSurfaces,copies);assert.ok(Math.abs(v.landscape.renderHeight(w,probe.x,probe.z)-probe.y)<1e-5,'footpath tiles do not cut square holes into the shoulder');
  assert.ok(E.removeWalkPath(w,walk.path.id).ok);v.refresh();assert.equal(v.roadworks.earthworks,initial);
  const occupied=w.tiles[25*48+24];Object.assign(occupied,{type:'park',level:1});v.refresh();
  const protectedPlan=v.roadworks.earthworks;assert.notEqual(protectedPlan,initial);assert.equal(v.roadworks.earthworkSurfaces,copies);assert.equal(v.roadworks.heightRevision,roadRevision,'occupancy change does not reconstruct roads');assert.equal(protectedPlan.sample(probe.x,probe.z),null);assert.equal(v.landscape.renderHeight(w,probe.x,probe.z),groundHeight(w,probe.x,probe.z));
  const walls=v.landscape.earthworkMeshes.filter(m=>!v.landscape.earthworkGroundMeshes.includes(m));assert.ok(walls.length>0,'constrained shoulder creates a retaining wall');const meshes=v.landscape.earthworkMeshes.slice(),version=v.landscape.earthworksRevision,applications=protectedPlan.stats.applications;
  for(let i=0;i<3;i++){v.camera.position.x+=20;v.refresh();v.setNight(i%2===0);}
  assert.equal(v.roadworks.earthworks,protectedPlan);assert.equal(v.roadworks.earthworkSurfaces,copies);assert.equal(v.roadworks.heightRevision,roadRevision);assert.equal(v.landscape.earthworksRevision,version);assert.equal(protectedPlan.stats.applications,applications);assert.deepEqual(v.landscape.earthworkMeshes,meshes);assert.ok(walls.every(m=>m.parent===v.landscape.group));
  Object.assign(occupied,{type:null,level:0});v.refresh();assert.notEqual(v.roadworks.earthworks,protectedPlan);assert.equal(v.roadworks.earthworkSurfaces,copies);assert.equal(v.roadworks.heightRevision,roadRevision);assert.ok(Math.abs(v.landscape.renderHeight(w,probe.x,probe.z)-probe.y)<1e-5);
 }finally{v.cleanup();}
});

test('terrain undo rebuilds support deterministically and footpaths consume the same rendered-ground height',()=>{
 const w=world(),v=harness(w);try{
  v.refresh(true);const initial=digest(v.landscape),firstPlan=v.roadworks.earthworks,firstRevision=v.roadworks.heightRevision;
  const change=sculptTerrain(w,{x:14,z:16,mode:'raise',radius:6,strength:1},groundHeight);assert.ok(change.ok);v.terrainChanged(change.bounds,true);
  assert.notEqual(v.roadworks.earthworks,firstPlan);assert.ok(v.roadworks.heightRevision>firstRevision);assert.notEqual(digest(v.landscape),initial);
  assert.ok(undoTerrain(w,change.undo).ok);v.terrainChanged(change.bounds,true);assert.equal(digest(v.landscape),initial,'undo restores the complete natural and derived geometry');
  w.walkPaths=[{id:'support-walk',controls:[{x:23,y:25},{x:26,y:25}]}];const group=new THREE.Group();let samples=0;
  buildFootpaths(w,group,(world,x,z)=>{samples++;return v.renderFloor(world,x,z);});assert.ok(samples>0);assert.ok(group.children.length>0);
  for(const mesh of group.children){mesh.updateMatrixWorld(true);const p=mesh.geometry.attributes.position,point=new THREE.Vector3();for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert.ok(Math.abs(point.y-v.renderFloor(w,point.x,point.z)-.055)<2e-5);}}
  group.traverse(o=>o.geometry?.dispose());
 }finally{v.cleanup();}
});

test('current zones, painted previews and lot outlines follow rendered terrain instead of saved natural heights',()=>{
 const w=world(),v=harness(w);v.zoneGroup=new THREE.Group();v.previewGroup=new THREE.Group();v.zoning=true;v.clearLine=()=>v.disposeGroup(v.previewGroup);
 try{
  // A sloping derived surface makes use of the unmodified natural-height
  // function observable at every vertex, even away from road boundary samples.
  v.landscape.renderHeight=(world,x,z)=>groundHeight(world,x,z)+1.75+x*.02;
  w.tiles[25*48+24].zone='residential_low';CityView.prototype.updateZones.call(v);
  const meshes=v.zoneGroup.children.filter(m=>m.isMesh);assert.ok(meshes.length>0);let samples=0;
  const verify=(items,lift)=>{for(const mesh of items){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),expected=v.renderFloor(w,x,z)+lift;assert.ok(Math.abs(p.getY(i)-expected)<2e-5,`${p.getY(i)} must meet derived ground ${expected}`);assert.ok(p.getY(i)>groundHeight(w,x,z)+1);samples++;}}};
  verify(meshes,.12);
  const cells=[...E.fineZoningLayout(w).keys()].slice(0,12);assert.equal(cells.length,12);v.previewZones(cells,'residential_low');verify(v.previewGroup.children.filter(m=>m.isMesh),.12);
  const outlines=new THREE.Group();v.zoneLotOutlines([{cx:2,cz:5,width:4,depth:3,angle:.3}],outlines);assert.equal(outlines.children.length,1);verify(outlines.children,.19);assert.ok(samples>150);
  for(const group of [v.zoneGroup,v.previewGroup,outlines])group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 }finally{v.cleanup();}
});

test('a finished terrain stroke reapplies active heatmaps to both natural and replacement terrain',()=>{
 const w=world(),v=harness(w);try{
  v.refresh(true);v.overlay='traffic';v.updateOverlay=()=>CityView.prototype.updateOverlay.call(v);v.updateOverlay();
  const changed=sculptTerrain(w,{x:14,z:16,mode:'raise',radius:6,strength:1},groundHeight);assert.ok(changed.ok);v.terrainChanged(changed.bounds,true);
  const ordinary=new THREE.Color('#bcbfc1'),road=new THREE.Color('#79bf85');let roadSamples=0,patchSamples=0;
  for(const mesh of [v.landscape.ground,...v.landscape.earthworkGroundMeshes]){
   const {position,color}=mesh.geometry.attributes;
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i),tile=w.tiles[Math.max(0,Math.min(47,Math.floor((z+96)/4)))*48+Math.max(0,Math.min(47,Math.floor((x+96)/4)))],expected=tile.type==='road'?road:ordinary;
    assert.equal(color.getX(i),Math.fround(expected.r));assert.equal(color.getY(i),Math.fround(expected.g));assert.equal(color.getZ(i),Math.fround(expected.b));if(tile.type==='road')roadSamples++;if(mesh!==v.landscape.ground)patchSamples++;
   }
  }
  assert.ok(roadSamples>20&&patchSamples>20,'both road heatmap colors and clipped terrain are exercised');
  v.overlay='none';v.updateOverlay();assert.deepEqual(v.landscape.ground.geometry.attributes.color.array,v.landscape.baseColors);for(const mesh of v.landscape.earthworkGroundMeshes)assert.deepEqual(mesh.geometry.attributes.color.array,mesh.userData.baseColors);
 }finally{v.cleanup();}
});

test('bus-stop ramp changes refresh terrain consumers and active overlays without rebuilding unchanged stops',()=>{
 const w=world(),v=harness(w);try{
  assert.ok(E.buildWalkPath(w,[{x:24,y:24.4},{x:24,y:27}]).ok);
  v.zoneGroup=new THREE.Group();v.zoning=true;v.overlay='traffic';v.traffic=new Traffic(w,E);v.roadworks.syncSignals=()=>{};
  v.makeGrid=CityView.prototype.makeGrid;v.drawFootpaths=CityView.prototype.drawFootpaths;v.updateZones=CityView.prototype.updateZones;v.updateOverlay=CityView.prototype.updateOverlay;
  let peopleRefreshes=0,targetRefreshes=0;v.streetLife.build=()=>peopleRefreshes++;v.roadZoningTarget={id:'selected-road'};v.showRoadZoning=target=>{assert.equal(target,v.roadZoningTarget);targetRefreshes++;};
  v.refresh(true);const initial=v.roadworks.earthworks,originalGrid=v.grid.children[0].geometry,originalPath=v.pathGroup.children[0].geometry,originalZone=v.zoneGroup.children.find(m=>m.isMesh).geometry;
  const beforePeople=peopleRefreshes,beforeTarget=targetRefreshes,checkOverlay=()=>{const base=new THREE.Color('#bcbfc1'),road=new THREE.Color('#79bf85');let count=0;for(const mesh of v.landscape.earthworkGroundMeshes){const {position,color}=mesh.geometry.attributes;for(let i=0;i<position.count;i++){const tx=Math.max(0,Math.min(47,Math.floor((position.getX(i)+96)/4))),tz=Math.max(0,Math.min(47,Math.floor((position.getZ(i)+96)/4))),expected=w.tiles[tz*48+tx].type==='road'?road:base;assert.equal(color.getX(i),Math.fround(expected.r));assert.equal(color.getY(i),Math.fround(expected.g));assert.equal(color.getZ(i),Math.fround(expected.b));count++;}}assert.ok(count>20);};
  w.transit={version:1,nextId:2,lines:[{id:1,stops:[24*48+24,24*48+27]}]};v.drawTransitStops();
  assert.notEqual(v.roadworks.earthworks,initial);assert.notEqual(v.grid.children[0].geometry,originalGrid);assert.notEqual(v.pathGroup.children[0].geometry,originalPath);assert.notEqual(v.zoneGroup.children.find(m=>m.isMesh).geometry,originalZone);assert.equal(peopleRefreshes,beforePeople+1);assert.equal(targetRefreshes,beforeTarget+1);checkOverlay();
  const added=v.roadworks.earthworks,addedPath=v.pathGroup.children[0].geometry,revision=v.landscape.earthworksRevision;v.drawTransitStops();assert.equal(v.roadworks.earthworks,added);assert.equal(v.pathGroup.children[0].geometry,addedPath);assert.equal(v.landscape.earthworksRevision,revision);assert.equal(peopleRefreshes,beforePeople+1);
  w.transit.lines=[];v.drawTransitStops();assert.notEqual(v.roadworks.earthworks,added);assert.notEqual(v.pathGroup.children[0].geometry,addedPath);assert.equal(peopleRefreshes,beforePeople+2);assert.equal(targetRefreshes,beforeTarget+2);checkOverlay();
  for(const group of [v.grid,v.pathGroup,v.zoneGroup])group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 }finally{v.cleanup();}
});


test('distant construction and demolition preserve road terrain while nearby changes still rebuild it',()=>{
 const w=world(),v=harness(w,{raised:true});
 try{
  v.refresh(true);const plan=v.roadworks.earthworks,revision=v.landscape.earthworksRevision,applications=plan.stats.applications,geometry=digest(v.landscape);
  assert.equal(plan.stats.fallback,false);assert.equal(typeof plan.mayAffectProtectedParcel,'function');
  const far=w.tiles[2*48+2];Object.assign(far,{type:'park',level:1});v.refresh();
  assert.equal(v.roadworks.earthworks,plan,'far construction must not trigger a whole-road rebuild');
  Object.assign(far,{type:null,level:0});v.refresh();
  assert.equal(v.roadworks.earthworks,plan,'far demolition must not rebuild terrain either');
  assert.equal(v.landscape.earthworksRevision,revision);assert.equal(plan.stats.applications,applications);assert.equal(digest(v.landscape),geometry);
  const near=w.tiles[25*48+24];Object.assign(near,{type:'park',level:1});v.refresh();
  assert.notEqual(v.roadworks.earthworks,plan,'a plot within maximum shoulder reach still reconstructs support');
  const constrained=v.roadworks.earthworks;Object.assign(near,{type:null,level:0});v.refresh();
  assert.notEqual(v.roadworks.earthworks,constrained,'removal restores the formerly constrained shoulder');
  assert.equal(digest(v.landscape),geometry);
 }finally{v.cleanup();}
});
