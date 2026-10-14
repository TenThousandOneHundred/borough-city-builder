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

test('vehicle uploads cover only changed packed slots and retain pending writes until rendered',async()=>{
 const {Vehicles}=await import('../dist/vehicles.js'),v=new Vehicles(),group=new THREE.Group(),cars=Array.from({length:128},(_,i)=>({mesh:v.create(i),agent:{active:true,x:i}}));
 cars.forEach((c,i)=>c.mesh.position.set(i===8?2:i*10,0,0));v.rebuildFleet(cars,group);const camera=new THREE.PerspectiveCamera(45,1,.1,200);camera.position.set(0,8,20);camera.lookAt(0,0,0);v.updateFleet(cars,camera);
 for(const mesh of v.fleet)mesh.instanceMatrix.clearUpdateRanges();
 const before=JSON.stringify(cars.map(c=>c.agent));cars[0].mesh.position.z+=.1;v.updateFleet(cars,camera);
 let changed=0;for(const mesh of v.fleet){const ranges=mesh.instanceMatrix.updateRanges;if(!ranges.length)continue;changed++;assert.equal(ranges.length,1);assert.equal(ranges[0].count,16,'one moving car changes one matrix in each material batch');assert.ok(ranges[0].count<mesh.instanceMatrix.array.length);}
 assert.ok(changed>0);assert.equal(JSON.stringify(cars.map(c=>c.agent)),before);
 const shared=v.fleet.find(m=>m.userData.parts.some(p=>p.car===cars[0])&&m.userData.parts.some(p=>p.car===cars[8]));const prior={...shared.instanceMatrix.updateRanges[0]};cars[8].mesh.position.z+=.1;v.updateFleet(cars,camera);
 const range=shared.instanceMatrix.updateRanges[0];assert.ok(range.start<=prior.start&&range.start+range.count>=prior.start+prior.count,'unconsumed prior writes survive');
});
test('vehicle visibility changes preserve exact retained matrices without rewriting unaffected batches',async()=>{
 const {Vehicles}=await import('../dist/vehicles.js'),v=new Vehicles(),group=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,1,.1,200),cars=Array.from({length:32},(_,i)=>({mesh:v.create(i),agent:{active:true}}));
 cars.forEach((c,i)=>c.mesh.position.set(i===0?0:1000+i,0,0));camera.position.set(0,8,20);camera.lookAt(0,0,0);v.rebuildFleet(cars,group);v.updateFleet(cars,camera);for(const mesh of v.fleet)mesh.instanceMatrix.clearUpdateRanges();
 const vanOnly=v.fleet.filter(m=>m.userData.parts.some(p=>p.car===cars[0]));const versions=vanOnly.map(m=>m.instanceMatrix.version);
 cars[1].mesh.position.x=2;v.updateFleet(cars,camera);assert.deepEqual(vanOnly.map(m=>m.instanceMatrix.version),versions,'entering sedan cannot rewrite existing van geometry');
 const expected=new THREE.Matrix4(),actual=new THREE.Matrix4();for(const mesh of v.fleet){let i=0;for(const part of mesh.userData.parts){if(!v.visibleCars.has(part.car))continue;expected.multiplyMatrices(part.car.mesh.matrix,part.local);mesh.getMatrixAt(i++,actual);assert.deepEqual(actual.elements.map(Math.fround),expected.elements.map(Math.fround));}assert.equal(mesh.count,i);}
 camera.lookAt(0,0,1000);v.updateFleet(cars,camera);assert.ok(v.fleet.every(m=>m.count===0));cars[0].mesh.position.z+=2;v.updateFleet(cars,camera);camera.lookAt(0,0,0);v.updateFleet(cars,camera);assert.ok(v.fleet.some(m=>m.count>0));for(const mesh of v.fleet){let i=0;for(const part of mesh.userData.parts){if(!v.visibleCars.has(part.car))continue;expected.multiplyMatrices(part.car.mesh.matrix,part.local);mesh.getMatrixAt(i++,actual);assert.deepEqual(actual.elements.map(Math.fround),expected.elements.map(Math.fround),'offscreen movement restores at the current position');}}
});

test('ground-cover culling preserves visible blades and shares buffers across bounded draw ranges',async()=>{
 const {groundCover}=await import('../dist/ground-cover.js'),{groundHeight,wetness}=await import('../dist/landscape.js');
 const world=E.createWorld('Cover culling','plains',42),before=JSON.stringify(world),cover=groundCover({},world,groundHeight,wetness),geometry=cover.children[0].geometry;
 const attributes=Object.values(geometry.attributes),versions=attributes.map(a=>a.version),arrays=attributes.map(a=>a.array.slice());
 for(const mesh of cover.children){assert.equal(mesh.material,cover.children[0].material);for(const [name,a]of Object.entries(geometry.attributes))assert.equal(mesh.geometry.attributes[name],a);}
 const camera=new THREE.PerspectiveCamera(43,16/9,.2,1800);camera.position.set(0,8,15);camera.lookAt(0,0,0);cover.userData.update(camera);
 const stats=cover.userData.stats;assert.ok(stats.visibleVertices<stats.totalVertices*.5);assert.ok(stats.visibleChunks<=4);const replans=stats.replans;cover.userData.update(camera);assert.equal(stats.replans,replans,'stationary camera reuses the plan');
 const f=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),p=geometry.attributes.position,v=new THREE.Vector3();
 const included=i=>cover.children.some(m=>i>=m.geometry.drawRange.start&&i<m.geometry.drawRange.start+m.geometry.drawRange.count);
 for(let i=0;i<p.count;i++)if(f.containsPoint(v.fromBufferAttribute(p,i)))assert.ok(included(i),'every visible vertex remains submitted');
 const nearRanges=cover.children.map(m=>({...m.geometry.drawRange}));
 const reflection=new THREE.PerspectiveCamera(43,16/9,.2,1800);reflection.position.set(0,250,300);reflection.lookAt(0,0,0);
 cover.children[0].onBeforeRender(null,null,reflection);assert.equal(stats.visibleVertices,stats.totalVertices);assert.equal(stats.visibleChunks,1,'wide reflection sees all blades in one draw');assert.deepEqual(cover.children.map(m=>m.count),[1,0,0,0],'unused batches have no GPU instances');
 cover.children[1].onBeforeRender(null,null,camera);assert.deepEqual(cover.children.map(m=>m.geometry.drawRange),nearRanges,'main camera restores its own selection');
 assert.deepEqual(attributes.map(a=>a.version),versions,'camera changes upload no vertex data');attributes.forEach((a,i)=>assert.deepEqual(a.array,arrays[i]));assert.equal(JSON.stringify(world),before);
 let geometryDisposals=0,materialDisposals=0;cover.children.forEach(m=>m.geometry.addEventListener('dispose',()=>geometryDisposals++));cover.children[0].material.addEventListener('dispose',()=>materialDisposals++);cover.userData.dispose();cover.userData.dispose();assert.equal(geometryDisposals,4);assert.equal(materialDisposals,1);
});

test('detailed trees follow the camera while preserving every tree location and shared asset',async()=>{
 const {Vegetation}=await import('../dist/vegetation.js'),camera=new THREE.PerspectiveCamera(),prototype=new THREE.Group();prototype.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));
 const material=new THREE.MeshBasicMaterial(),view={camera,night:false,detailEnabled:true,renderer:{shadowMap:{needsUpdate:false}}};camera.position.set(0,4,0);
 const vegetation=Object.create(Vegetation.prototype);Object.assign(vegetation,{v:view,broadleaf:[],impostors:[{material}],prototypes:[prototype]});
 const positions=Array.from({length:30},(_,i)=>[i*3,0,3]),before=JSON.stringify(positions),group=new THREE.Group(),objects=vegetation.populate(group,positions,()=>0);
 const first=[...vegetation.population.near.keys()];assert.ok(first.includes(0));assert.ok(first.length<=10);assert.equal(objects.filter(o=>!o.isInstancedMesh).length,first.length);
 camera.position.x=75;view.renderer.shadowMap.needsUpdate=false;vegetation.update();const last=[...vegetation.population.near.keys()];assert.ok(last.includes(25));assert.ok(!last.includes(0));assert.ok(view.renderer.shadowMap.needsUpdate);
 const matrix=new THREE.Matrix4();for(const r of vegetation.population.records){r.mesh.getMatrixAt(r.slot,matrix);assert.equal(matrix.elements[12],r.x);assert.equal(matrix.elements[14],r.z);const hidden=new THREE.Vector3().setFromMatrixScale(matrix).length()<1e-8;assert.equal(hidden,vegetation.population.near.has(r.i));}
 const versions=vegetation.instances.map(m=>m.instanceMatrix.version);vegetation.update();assert.deepEqual(vegetation.instances.map(m=>m.instanceMatrix.version),versions);assert.equal(vegetation.lastMatrixWrites,0);
 view.detailEnabled=false;vegetation.update();assert.equal(vegetation.population.near.size,0);assert.equal(objects.filter(o=>!o.isInstancedMesh).length,0);view.detailEnabled=true;vegetation.update();assert.ok(vegetation.population.near.has(25));
 camera.position.x=0;vegetation.update();assert.ok(vegetation.population.near.has(0));assert.equal(JSON.stringify(positions),before);assert.equal(prototype.children[0].geometry.attributes.position.count,24);
});
test('tree billboards track camera translation and retain pending partial matrix uploads',async()=>{
 const {Vegetation}=await import('../dist/vegetation.js'),camera=new THREE.PerspectiveCamera();camera.position.set(0,10,0);const material=new THREE.MeshBasicMaterial(),v=Object.create(Vegetation.prototype);
 Object.assign(v,{v:{camera,detailEnabled:false,night:false},broadleaf:[],impostors:[{material}],prototypes:[]});v.populate(new THREE.Group(),[[0,40,4],[200,40,4],[400,40,4]],()=>0);const mesh=v.instances[0],attribute=mesh.instanceMatrix;attribute.clearUpdateRanges();const before=attribute.array.slice();
 camera.position.x=2;v.update();assert.notDeepEqual(attribute.array.slice(0,16),before.slice(0,16),'panning without orbit updates the nearby billboard');assert.deepEqual(attribute.array.slice(16),before.slice(16),'distant unchanged orientations keep their GPU slots');assert.deepEqual(attribute.updateRanges,[{start:0,count:16}]);
 attribute.clearUpdateRanges();attribute.addUpdateRange(32,16);camera.position.x=4;v.update();assert.deepEqual(attribute.updateRanges,[{start:0,count:48}],'unconsumed writes are retained');
 const sphere=mesh.boundingSphere;for(const r of v.population.records)assert.ok(sphere.containsPoint(new THREE.Vector3(r.x+r.h*.64,r.y+r.h*1.14,r.z)),'bounds allow restored and rotated trees');
});

test('building uploads preserve pending edits while transferring only changed occupied slots',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),camera=new THREE.PerspectiveCamera(60,1,.1,500);camera.position.set(0,8,15);camera.lookAt(0,0,0);
 const factory=new BuildingFactory({scene:new THREE.Scene(),camera}),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial(),buildings=new Map();geometry.userData.lod=new THREE.BoxGeometry(.9,.9,.9);
 for(let i=0;i<128;i++){const root=new THREE.Group();root.userData={factory:true,asset:true,renderImmutable:true,lodDistance:30};root.position.set(i<8?(i-3.5)*2:1000+i,0,0);const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;root.add(mesh);buildings.set(i,root);}
 factory.rebuild(buildings);const near=factory.instanceBatches[0].near,attribute=near.instanceMatrix;assert.equal(near.count,8);const gpu=attribute.array.slice();attribute.clearUpdateRanges();
 buildings.get(3).position.y=.25;factory.rebuild(buildings);assert.equal(factory.instanceBatches[0].near,near);assert.deepEqual(attribute.updateRanges,[{start:48,count:16}]);assert.ok(attribute.updateRanges[0].count<attribute.array.length/100);
 buildings.get(5).position.y=.5;factory.rebuild(buildings);assert.deepEqual(attribute.updateRanges,[{start:48,count:48}]);
 const version=attribute.version;camera.lookAt(0,8,100);factory.updateVisibility();assert.equal(near.count,0);assert.equal(attribute.version,version);assert.deepEqual(attribute.updateRanges,[{start:48,count:48}]);
 camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(near.count,8);for(const r of attribute.updateRanges)gpu.set(attribute.array.subarray(r.start,r.start+r.count),r.start);assert.deepEqual(gpu.subarray(0,near.count*16),attribute.array.subarray(0,near.count*16));attribute.clearUpdateRanges();
 camera.position.z=60;camera.lookAt(0,0,0);factory.updateVisibility();const far=factory.instanceBatches[0].far;assert.equal(far.count,8);assert.deepEqual(far.instanceMatrix.updateRanges,[{start:0,count:128}]);assert.equal(near.count,0);
 const farVersion=far.instanceMatrix.version;factory.updateVisibility();assert.equal(far.instanceMatrix.version,farVersion,'unchanged camera skips uploads');
});

test('offscreen buildings remain sun-shadow casters without entering colour draws',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,4,12);camera.lookAt(0,0,0);
 const scene=new THREE.Scene(),factory=new BuildingFactory({scene,camera}),geometry=new THREE.BoxGeometry(2,12,2),material=new THREE.MeshStandardMaterial(),buildings=new Map();geometry.userData.lod=new THREE.BoxGeometry(2,12,2);
 for(let i=0;i<2;i++){const root=new THREE.Group();root.position.set(i*100,6,0);root.userData={factory:true,asset:true,renderImmutable:true};const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;root.add(mesh);buildings.set(i,root);}
 factory.rebuild(buildings);const batch=factory.instanceBatches[0],shadow=batch.shadow;assert.equal(batch.near.count,1);assert.equal(batch.far.count,0);assert.equal(batch.near.castShadow,false);assert.equal(batch.far.castShadow,false);assert.equal(shadow.count,0,'no duplicate colour geometry');assert.equal(shadow.geometry,geometry,'full original silhouette');
 const matrix=shadow.instanceMatrix.array.slice(),version=shadow.instanceMatrix.version;
 shadow.onBeforeShadow();assert.equal(shadow.count,2,'offscreen building is included');shadow.onAfterShadow();assert.equal(shadow.count,0);
 camera.lookAt(0,4,100);factory.updateVisibility();assert.equal(batch.near.count+batch.far.count,0);assert.equal(shadow.instanceMatrix.version,version);assert.deepEqual(shadow.instanceMatrix.array,matrix);shadow.onBeforeShadow();assert.equal(shadow.count,2);shadow.onAfterShadow();
 buildings.delete(1);factory.rebuild(buildings);assert.equal(factory.instanceBatches[0].shadow,shadow,'GPU allocation retained');shadow.onBeforeShadow();assert.equal(shadow.count,1,'demolished buildings stop casting');shadow.onAfterShadow();
 let disposed=false;shadow.addEventListener('dispose',()=>disposed=true);factory.rebuild(new Map());assert.ok(disposed);assert.ok(!factory.batchRoot.children.includes(shadow));
});

test('shadow batches include one representation of near/far site vegetation',async()=>{
 const {BuildingFactory}=await import('../dist/building-factory.js'),factory=new BuildingFactory({scene:new THREE.Scene()}),root=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();root.userData={factory:true,asset:true,renderImmutable:true};
 for(const range of [null,[0,18],[18,Infinity]]){const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;if(range)mesh.userData.siteRange=range;root.add(mesh);}
 factory.rebuild(new Map([[1,root]]));const {shadow}=factory.instanceBatches[0];shadow.onBeforeShadow();assert.equal(shadow.count,2,'one full tree silhouette, without its distant billboard duplicate');shadow.onAfterShadow();assert.equal(shadow.count,0);
 const version=shadow.instanceMatrix.version;factory.rebuild(new Map([[1,root]]));assert.equal(shadow.instanceMatrix.version,version,'unchanged shadow transforms are not uploaded again');
});
