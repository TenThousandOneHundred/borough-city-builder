import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {CityView} from '../dist/renderer.js';
import {batchStatic} from '../dist/static-batch.js';
const E=createRequire(import.meta.url)('../dist/engine.js');globalThis.CityEngine=E;
test('camera movement and population ticks do not rebuild static scenery; road deletion does',()=>{
 const v=Object.create(CityView.prototype),world=E.createWorld('Refresh regression','flat',33),counts={roads:0,trees:0,models:0,overlay:0,access:0};
 Object.assign(v,{world,camera:new THREE.PerspectiveCamera(),buildings:new Map(),tileGroup:new THREE.Group(),models:{accepts:t=>['residential','commercial','industrial','office'].includes(t.type),rebuild:()=>counts.models++},renderer:{shadowMap:{}},roadworks:{buildAccess:()=>counts.access++,build:()=>counts.roads++},landscape:{refreshTrees:()=>counts.trees++},streetLife:{build:()=>{}},setupCars:()=>{},updateOverlay:()=>counts.overlay++,updateZones:()=>{},overlay:'none',night:false});
 v.refresh(true);const baseline={...counts};v.camera.position.set(60,50,30);world.day++;world.money+=100;v.refresh();assert.deepEqual(counts,baseline);
 const road=world.tiles.findIndex(t=>t.type==='road');world.tiles[road].type=null;v.refresh();assert.equal(counts.roads,baseline.roads+1);assert.equal(counts.access,baseline.access+1);assert.equal(counts.overlay,0);
});
test('static batching preserves vertices, material and shadow state while reducing draw calls',()=>{
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),box=new THREE.BoxGeometry(1,1,1);for(let i=0;i<40;i++){const mesh=new THREE.Mesh(box,material);mesh.position.set(i%8,0,Math.floor(i/8));mesh.castShadow=true;group.add(mesh);}const before=new THREE.Box3().setFromObject(group),result=batchStatic(group,box),after=new THREE.Box3().setFromObject(group);assert.equal(result.before,40);assert.equal(result.after,1);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);assert.equal(group.children[0].geometry.attributes.position.count,40*36);assert.equal(group.children[0].material,material);assert.equal(group.children[0].castShadow,true);
});
test('vehicle instancing preserves geometry and movement while reducing draw submissions',async()=>{
 const {Vehicles}=await import('../dist/vehicles.js'),vehicles=new Vehicles(),group=new THREE.Group(),cars=Array.from({length:65},(_,i)=>({mesh:vehicles.create(i)}));let originalTriangles=0,draws=0;for(const {mesh}of cars){group.add(mesh);mesh.traverse(o=>{if(o.isMesh){draws++;originalTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}})}vehicles.rebuildFleet(cars,group);const instancedTriangles=vehicles.fleet.reduce((n,o)=>n+o.count*(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);assert.equal(instancedTriangles,originalTriangles);assert.ok(vehicles.fleet.length<draws/5);cars[0].mesh.position.x=12;vehicles.updateFleet(cars);const first=vehicles.fleet[0],matrix=new THREE.Matrix4();first.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],12);
});
test('stationary vehicles skip GPU uploads; moving and hiding cars still update their transforms',async()=>{const {Vehicles}=await import('../dist/vehicles.js'),v=new Vehicles(),cars=Array.from({length:32},(_,i)=>({mesh:v.create(i)}));v.rebuildFleet(cars,new THREE.Group());const versions=v.fleet.map(m=>m.instanceMatrix.version);v.updateFleet(cars);assert.deepEqual(v.fleet.map(m=>m.instanceMatrix.version),versions);cars[0].mesh.position.x=12;v.updateFleet(cars);assert.ok(v.fleet.some((m,i)=>m.instanceMatrix.version>versions[i]));cars[0].mesh.scale.setScalar(0);v.updateFleet(cars);const matrix=new THREE.Matrix4();for(const mesh of v.fleet){const i=mesh.userData.parts.findIndex(p=>p.car===cars[0]);if(i>=0){mesh.getMatrixAt(i,matrix);assert.equal(matrix.elements[0],0);assert.equal(matrix.elements[5],0);assert.equal(matrix.elements[10],0);}}});
test('queued cars reuse terrain heights while movement and world changes invalidate the cache',()=>{let calls=0;const v=Object.create(CityView.prototype);v.world={};v.roadworks={height(){calls++;return 4;}};const car={mesh:new THREE.Group(),agent:{active:true,x:2,z:3,heading:1}};v.moveCar(car);v.moveCar(car);assert.equal(calls,1);assert.equal(car.mesh.position.y,4.08);car.agent.x++;v.moveCar(car);assert.equal(calls,2);v.world={};v.moveCar(car);assert.equal(calls,3);car.agent.active=false;v.moveCar(car);assert.equal(car.mesh.scale.x,0);});
test('offscreen vehicle rendering is culled without changing agents, and camera returns restore full geometry',async()=>{const {Vehicles}=await import('../dist/vehicles.js'),v=new Vehicles(),group=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,1,.1,200),cars=Array.from({length:8},(_,i)=>({mesh:v.create(i),agent:{active:true,x:i}}));camera.position.set(0,8,20);camera.lookAt(0,0,0);v.rebuildFleet(cars,group);const full=v.fleet.reduce((sum,m)=>sum+m.count,0),agents=JSON.stringify(cars.map(c=>c.agent));v.updateFleet(cars,camera);assert.equal(v.fleet.reduce((sum,m)=>sum+m.count,0),full);camera.position.x=1000;camera.lookAt(1000,0,0);v.updateFleet(cars,camera);assert.equal(v.fleet.reduce((sum,m)=>sum+m.count,0),0);assert.equal(JSON.stringify(cars.map(c=>c.agent)),agents);camera.position.x=0;camera.lookAt(0,0,0);v.updateFleet(cars,camera);assert.equal(v.fleet.reduce((sum,m)=>sum+m.count,0),full);});

test('loading details skips temporary buildings and preserves running simulation state',()=>{
 const v=Object.create(CityView.prototype),world=E.createWorld('Loading regression','flat',33),counts={created:0,rebuild:0,landscape:0,roads:0,traffic:0};
 world.tiles.forEach(t=>Object.assign(t,{type:null,level:0,tree:false}));world.tiles[20*48+20]={type:'residential',density:'low',level:1};
 const traffic={agents:[{active:true,x:4,z:5}]},residents={reconcile(){},state:{residents:[{id:1,activity:'travelling'}]}},transit={entries:new Map()},clock={pending:1.25,total:52};
 Object.assign(v,{world,assetsReady:false,camera:new THREE.PerspectiveCamera(),buildings:new Map(),tileGroup:new THREE.Group(),models:{accepts:t=>['residential','commercial','industrial','office'].includes(t.type),create(){counts.created++;const g=new THREE.Group();g.userData.factory=true;return g;},rebuild:()=>counts.rebuild++,materials:{reset(){}}},architecture:{cache:new Map()},renderer:{shadowMap:{}},roadworks:{buildAccess(){},build:()=>counts.roads++,syncSignals(){}},landscape:{build:()=>counts.landscape++,refreshTrees(){}},streetLife:{build(){}},setupCars:()=>counts.traffic++,ensureCarCapacity(){},updateOverlay(){},updateZones(){},overlay:'none',night:false,loadingElement:{hidden:false}});
 v.refresh(true);assert.equal(counts.created,0,'no expensive temporary procedural models');assert.equal(counts.traffic,1,'simulation can initialize while textures load');
 Object.assign(v,{traffic,residents,transit,simulationClock:clock,_running:true});const before=JSON.stringify(world),trafficCalls=counts.traffic;
 v.refreshAssets();assert.equal(counts.created,1);assert.equal(v.assetsReady,true);assert.equal(v.loadingElement.hidden,true);
 assert.equal(v.traffic,traffic);assert.equal(v.residents,residents);assert.equal(v.transit,transit);assert.equal(v.simulationClock,clock);assert.equal(v.running,true);assert.equal(clock.pending,1.25);assert.equal(clock.total,52);
 assert.equal(counts.traffic,trafficCalls,'asset arrival cannot rebuild road graph or agents');assert.equal(JSON.stringify(world),before);
});
test('building culling tests one sphere per building and skips unchanged GPU transforms',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),camera=new THREE.PerspectiveCamera(90,1,.1,500);camera.position.set(0,60,100);camera.lookAt(0,0,0);
 const factory=new BuildingFactory({scene:new THREE.Scene(),camera}),buildings=new Map(),geometry=new THREE.BoxGeometry(1,1,1),materials=Array.from({length:8},()=>new THREE.MeshStandardMaterial());
 for(let i=0;i<200;i++){const root=new THREE.Group();root.userData={factory:true,asset:true};root.position.set((i%20-10)*2,0,(Math.floor(i/20)-5)*2);for(let j=0;j<8;j++){const mesh=new THREE.Mesh(geometry,materials[j]);mesh.position.y=j;mesh.userData.sharedAsset=true;root.add(mesh);}buildings.set(i,root);}
 factory.rebuild(buildings);assert.equal(factory.visibilityChecks,200,'1600 material parts share 200 visibility tests');
 const versions=factory.instanceBatches.map(b=>b.near.instanceMatrix.version),counts=factory.instanceBatches.map(b=>b.near.count);
 camera.position.x=.01;camera.lookAt(0,0,0);factory.updateVisibility();assert.deepEqual(factory.instanceBatches.map(b=>b.near.count),counts);assert.deepEqual(factory.instanceBatches.map(b=>b.near.instanceMatrix.version),versions,'unchanged membership needs no GPU upload');
 camera.lookAt(0,60,200);factory.updateVisibility();assert.ok(factory.instanceBatches.every(b=>b.near.count===0));
 camera.position.x=0;camera.lookAt(0,0,0);factory.updateVisibility();assert.deepEqual(factory.instanceBatches.map(b=>b.near.count),counts);
 assert.deepEqual(factory.instanceBatches.map(b=>b.near.instanceMatrix.version),versions,'returning restores retained buffers without rewriting');
});
test('building transform packing updates on partial visibility and LOD changes',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,5,12);camera.lookAt(0,0,0);
 const factory=new BuildingFactory({scene:new THREE.Scene(),camera}),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();geometry.userData.lod=new THREE.BoxGeometry(.9,.9,.9);
 const buildings=new Map();for(const [i,x]of [[0,-3],[1,0],[2,3]]){const root=new THREE.Group();root.userData={factory:true,asset:true};root.position.x=x;const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;root.add(mesh);buildings.set(i,root);}
 factory.rebuild(buildings);const b=factory.instanceBatches[0];assert.equal(b.near.count,3);assert.equal(b.far.count,0);
 camera.position.set(0,5,40);camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(b.near.count,0);assert.equal(b.far.count,3);
 camera.position.set(3,1,4);camera.lookAt(3,0,0);factory.updateVisibility();assert.equal(b.near.count,1);assert.equal(b.far.count,0);const m=new THREE.Matrix4();b.near.getMatrixAt(0,m);assert.equal(m.elements[12],3,'packing replaces first slot after left buildings leave view');
 camera.position.set(0,5,12);camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(b.near.count,3);for(let i=0;i<3;i++){b.near.getMatrixAt(i,m);assert.equal(m.elements[12],(i-1)*3);}
});

test('authored roof details remain visible at district distance and obey the low-detail setting',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,10,40);camera.lookAt(0,0,0);
 const view={scene:new THREE.Scene(),camera,detailEnabled:true},factory=new BuildingFactory(view),root=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1);geometry.userData.lod=new THREE.BoxGeometry(.9,.9,.9);root.userData={factory:true,asset:true,lodDistance:64};const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.userData.sharedAsset=true;root.add(mesh);factory.rebuild(new Map([[1,root]]));const batch=factory.instanceBatches[0];assert.equal(batch.near.count,1);assert.equal(batch.far.count,0);
 camera.position.z=90;factory.updateVisibility();assert.equal(batch.near.count,0);assert.equal(batch.far.count,1);
 camera.position.z=40;view.detailEnabled=false;factory.updateVisibility();assert.equal(batch.near.count,0);assert.equal(batch.far.count,1);
 view.detailEnabled=true;factory.updateVisibility();assert.equal(batch.near.count,1);assert.equal(batch.far.count,0);
});
