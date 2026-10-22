import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {sitePlan} from '../dist/site-plan.js';
import {SiteDetails} from '../dist/site-details.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {lotPlan} from '../dist/building-plan.js';
import E from '../dist/engine.js';
const house={lotWidth:4,lotDepth:4,low:true,type:'residential',density:'low'};
const footprint={minX:-1,maxX:1,minZ:-.5,maxZ:1.25};
test('private lots provide entrances, rear patios, gardens, fences and a driveway without covering the model',()=>{
 const items=sitePlan(house,footprint),kinds=new Set(items.map(i=>i.kind));for(const k of ['walk','drive','patio','garden','fence','tree'])assert.ok(kinds.has(k),k);
 for(const a of items){assert.ok(a.x-a.w/2>=-2&&a.x+a.w/2<=2);assert.ok(a.z-a.d/2>=-2&&a.z+a.d/2<=2);assert.ok(a.x+a.w/2<=footprint.minX||a.x-a.w/2>=footprint.maxX||a.z+a.d/2<=footprint.minZ||a.z-a.d/2>=footprint.maxZ,a.kind+' stays outside building');}
 assert.deepEqual(sitePlan(house,footprint),items,'reload remains deterministic');
});
test('commercial and industrial front yards include usable bay widths and a clear central entrance',()=>{
 for(const type of ['commercial','industrial']){const items=sitePlan({...house,low:false,type,lotWidth:8,lotDepth:8},{minX:-2,maxX:2,minZ:-3,maxZ:1});assert.ok(items.some(i=>i.kind==='yard'));const bays=items.filter(i=>i.kind==='parking');assert.ok(bays.length>=6);assert.ok(bays.every(i=>Math.abs(i.x)>.5&&i.w>=.5&&i.d>=.9));assert.ok(items.some(i=>i.kind==='walk'&&Math.abs(i.x)<1e-8));}
});
test('urban forecourts have planted borders, seating and bicycle stands',()=>{
 const items=sitePlan({...house,low:false,type:'office',lotWidth:8,lotDepth:8},{minX:-2,maxX:2,minZ:-2,maxZ:2});for(const k of ['walk','plaza','bench','rack','tree'])assert.ok(items.some(i=>i.kind===k),k);
});
test('shared detail geometry fits rotated lots and survives repeated instancing and demolition',()=>{
 const tree=new THREE.Group(),crown=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());crown.position.y=.5;tree.add(crown);const view={scene:new THREE.Scene(),landscape:{assets:{}},vegetation:{broadPrototype:tree}},details=new SiteDetails(view),factory=new BuildingFactory(view),buildings=new Map();let disposed=0;details.box.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<30;i++){const root=details.build(house,footprint);root.userData={factory:true,asset:true};root.position.x=i*6;root.rotation.y=i%4*Math.PI/2;root.traverse(o=>{if(o.isMesh){assert.ok(o.userData.sharedAsset);assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));}});buildings.set(i,root);const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.max.x-bounds.min.x<=4);assert.ok(bounds.max.z-bounds.min.z<=4);}
 factory.rebuild(buildings);assert.ok(factory.batchRoot.children.length<=15,'many yards share a bounded material/geometry budget');let count=0;for(const mesh of factory.batchRoot.children)count+=mesh.count;assert.ok(count>500);factory.rebuild(new Map());assert.equal(disposed,0);assert.equal(factory.batchRoot.children.length,0);
});
test('ordinary grid roads expose the same frontage information as curved roads without changing saves',()=>{
 const w=E.createWorld('Grid frontage','plains',32);w.tiles.forEach(t=>t.type=null);const i=20*48+20;w.tiles[i].type='residential';w.tiles[i].density='low';w.tiles[i+48].type='road';const before=JSON.stringify(w),p=lotPlan(w,i);assert.equal(p.frontage.roadIndex,i+48);assert.equal(p.angle,0);assert.equal(JSON.stringify(w),before);
});
test('distant yard trees switch to shared views while close trees retain complete geometry',()=>{
 const tree=new THREE.Group(),crown=new THREE.Mesh(new THREE.SphereGeometry(.45,32,24),new THREE.MeshStandardMaterial());crown.position.y=.5;tree.add(crown);const camera=new THREE.PerspectiveCamera(50,1,.1,200),view={scene:new THREE.Scene(),camera,landscape:{assets:{}},vegetation:{broadPrototype:tree,broadleaf:[{material:new THREE.MeshBasicMaterial({side:THREE.DoubleSide})}]}},details=new SiteDetails(view),root=details.build(house,footprint);root.userData={factory:true,asset:true};const factory=new BuildingFactory(view);camera.position.set(0,4,10);camera.lookAt(0,0,0);factory.rebuild(new Map([[1,root]]));
 const triangles=()=>factory.instanceBatches.filter(b=>b.transforms[0].renderRange).reduce((n,b)=>n+b.near.count*(b.near.geometry.index?.count||b.near.geometry.attributes.position.count)/3,0),near=triangles();assert.ok(near>1000);
 camera.position.set(0,15,70);camera.lookAt(0,0,0);factory.updateVisibility();const far=triangles();assert.ok(far>0&&far<near*.02);camera.position.set(0,4,10);camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(triangles(),near);
});

test('raised gardens apply model normalization and scale without crossing planted beds',()=>{
 const tree=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());mesh.position.y=.5;tree.add(mesh);
 const details=new SiteDetails({vegetation:{broadPrototype:tree}}),origin={x:-2,y:-.1,z:3},bed={x:8,y:13.33,z:4,w:2,d:7},scale=.2,setback=.3;
 const root=details.buildGardens([bed],origin,scale,setback);assert.ok(root.children.length>=1);
 const bounds=new THREE.Box3().setFromObject(root),x=(bed.x+origin.x)*scale,z=(bed.z+origin.z)*scale+setback;
 assert.ok(bounds.min.x>=x-bed.w*scale/2-1e-6&&bounds.max.x<=x+bed.w*scale/2+1e-6);
 assert.ok(bounds.min.z>=z-bed.d*scale/2-1e-6&&bounds.max.z<=z+bed.d*scale/2+1e-6);
 assert.ok(Math.abs(bounds.min.y-(bed.y+origin.y)*scale)<1e-6,'trunks start at planter soil rather than ground level');
 assert.ok(bounds.max.y-bounds.min.y<=.92+1e-6);root.traverse(o=>{if(o.isMesh)assert.equal(o.geometry,mesh.geometry,'tree buffers remain shared');});
});

test('paired entrances and driveways have separate clear routes through front planting',()=>{
 const plan={...house,entranceXs:[-.65,.65]},items=sitePlan(plan,{minX:-.9,maxX:.9,minZ:-1,maxZ:.8}),walks=items.filter(a=>a.kind==='walk'),drive=items.find(a=>a.kind==='drive');
 assert.deepEqual(walks.map(a=>a.x),[-.65,.65]);assert.ok(drive);
 for(const garden of items.filter(a=>a.kind==='garden'))for(const paving of [...walks,drive]){
  const overlapX=Math.min(garden.x+garden.w/2,paving.x+paving.w/2)-Math.max(garden.x-garden.w/2,paving.x-paving.w/2),overlapZ=Math.min(garden.z+garden.d/2,paving.z+paving.d/2)-Math.max(garden.z-garden.d/2,paving.z-paving.d/2);
  assert.ok(overlapX<=1e-8||overlapZ<=1e-8,'planting cannot cover an entrance or driveway');
 }
});


test('urban courtyard planting leaves continuous side and rear access without crossing model bounds',()=>{
 for(const size of [4,8,12]){
  const b={minX:-size*.25,maxX:size*.25,minZ:-size*.25,maxZ:size*.25},plan={...house,low:false,type:'office',density:'high',lotWidth:size,lotDepth:size},items=sitePlan(plan,b);
  for(const a of items){
   assert.ok(a.x-a.w/2>=-size/2&&a.x+a.w/2<=size/2);
   assert.ok(a.z-a.d/2>=-size/2&&a.z+a.d/2<=size/2);
   assert.ok(a.x+a.w/2<=b.minX||a.x-a.w/2>=b.maxX||a.z+a.d/2<=b.minZ||a.z-a.d/2>=b.maxZ,a.kind);
  }
  const beds=items.filter(a=>a.kind==='garden');
  for(const a of beds)for(const walk of items.filter(a=>['walk','plaza'].includes(a.kind))){const x=Math.min(a.x+a.w/2,walk.x+walk.w/2)-Math.max(a.x-a.w/2,walk.x-walk.w/2),z=Math.min(a.z+a.d/2,walk.z+walk.d/2)-Math.max(a.z-a.d/2,walk.z-walk.d/2);assert.ok(x<=1e-8||z<=1e-8,'lawn leaves all courtyard routes clear');}
  const root=new SiteDetails({}).build(plan,b);let triangles=0;const geometries=new Set(),materials=new Set();
  root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;geometries.add(o.geometry);materials.add(o.material);}});
  assert.ok(triangles<1000,'courtyard hardscape remains under 1000 triangles per lot');
  assert.ok(geometries.size<=3&&materials.size<=5,'courtyard uses shared existing batches');
 }
});

test('small office rear parking has full sized bays, manoeuvring space and a street connection',()=>{
 const plan={...house,low:false,type:'office',density:'low',lotWidth:6.36,lotDepth:9.56,variation:.8},b={minX:-1.8,maxX:1.8,minZ:2,maxZ:4.5},items=sitePlan(plan,b),bays=items.filter(a=>a.kind==='parking'),drive=items.find(a=>a.kind==='drive'),yard=items.find(a=>a.kind==='yard');
 assert.ok(bays.length>=6);assert.ok(drive&&yard);assert.ok(Math.abs(drive.w-.72)<1e-8);assert.ok(Math.abs(drive.z+drive.d/2-(plan.lotDepth/2-.09))<1e-8);
 for(const bay of bays){assert.equal(bay.d,1);assert.equal(bay.w,.5);assert.equal(bay.aisleDepth,1.2);assert.ok(yard.z+yard.d/2-(bay.z+bay.d/2)>=1.2-1e-8);}
 assert.ok(drive.z-drive.d/2<=yard.z+yard.d/2&&drive.x+drive.w/2>=yard.x-yard.w/2);
 assert.ok(items.some(a=>a.kind==='curb'));assert.ok(items.filter(a=>a.kind==='tree').length<=6);
 for(const a of items){assert.ok(Math.abs(a.x)+a.w/2<=plan.lotWidth/2);assert.ok(Math.abs(a.z)+a.d/2<=plan.lotDepth/2);assert.ok(a.x+a.w/2<=b.minX||a.x-a.w/2>=b.maxX||a.z+a.d/2<=b.minZ||a.z-a.d/2>=b.maxZ,a.kind);}
 assert.ok(!sitePlan({...plan,lotWidth:4},b).some(a=>a.kind==='parking'),'a rear garden without a drive does not become disconnected parking');
 assert.deepEqual(sitePlan(plan,b),items,'same city creates the same grounds after reload');
 const root=new SiteDetails({}).build(plan,b),geometries=new Set(),materials=new Set();let triangles=0;root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);triangles+=o.geometry.index.count/3;}});assert.ok(geometries.size<=3&&materials.size<=7);assert.ok(triangles<1000);
});
test('short shop forecourts never draw parking without room for an aisle',()=>{
 const p={...house,low:false,type:'commercial',lotWidth:8,lotDepth:8};
 assert.ok(!sitePlan(p,{minX:-2,maxX:2,minZ:-3,maxZ:2.4}).some(a=>a.kind==='parking'));
 assert.ok(sitePlan(p,{minX:-2,maxX:2,minZ:-3,maxZ:1}).some(a=>a.kind==='parking'));
});

test('offset office entrances keep seating and bicycle racks out of walking routes',()=>{
 const items=sitePlan({...house,low:false,type:'office',density:'high',lotWidth:8,lotDepth:8,entranceXs:[.85,2.1]},{minX:-2.5,maxX:2.5,minZ:-2,maxZ:2}),routes=items.filter(a=>a.kind==='walk');
 assert.ok(routes.some(a=>a.x===.85));
 for(const a of items.filter(a=>['bench','rack'].includes(a.kind)))for(const path of routes)assert.ok(Math.abs(a.x-path.x)>=(a.w+path.w)/2||Math.abs(a.z-path.z)>=(a.d+path.d)/2);
});
