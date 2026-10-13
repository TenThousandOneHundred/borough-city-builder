import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
const E=createRequire(import.meta.url)('../dist/engine.js');
const loader=new GLTFLoader();
// Decode actual shipped geometry without a browser image decoder. Asset tests
// separately validate the embedded textures; browser QA verifies their appearance.
loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
async function library(){const lib=Object.create(ModelLibrary.prototype);lib.models=[];lib.materials=new Set();lib.lotGeometry=new THREE.PlaneGeometry(1,1);lib.lotGeometry.rotateX(-Math.PI/2);lib.view={renderer:{capabilities:{getMaxAnisotropy:()=>8}},landscape:{material:()=>new THREE.MeshStandardMaterial()}};
 for(const file of ['urban','industry','modern']){const data=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));const result=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');lib.ingest(result.scene);}return lib;}
test('all complete building assets decode with finite UV-mapped geometry and valid categories',async()=>{
 const lib=await library();assert.equal(lib.models.length,69);assert.deepEqual([...new Set(lib.models.map(m=>m.category))].sort(),['commercial','fire','hospital','industrial','office','police','residential','residential-low','school']);
 for(const model of lib.models){assert.ok(model.size.x>0&&model.size.y>0&&model.size.z>0);assert.ok(model.root.children.length<=(model.category==='commercial'?13:model.site?11:10));for(const mesh of model.root.children){if(mesh.material.map)assert.ok(mesh.geometry.attributes.uv);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}}
});
test('model placement fits saved lots uniformly and instancing survives demolition without disposing shared models',async()=>{
 const lib=await library(),world=E.createWorld('Model test','flat',324),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:2};const before=JSON.stringify(world),parcel={width:2,depth:3};const g=lib.create(world,index,parcel),s=g.children[0].scale;assert.equal(s.x,s.y);assert.equal(s.y,s.z);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.max.x-bounds.min.x<8);assert.ok(bounds.max.z-bounds.min.z<12);assert.equal(JSON.stringify(world),before);
 const view={scene:new THREE.Scene(),landscape:{assets:{}}},factory=new BuildingFactory(view);let disposed=false;g.children[0].children[0].geometry.addEventListener('dispose',()=>disposed=true);factory.rebuild(new Map([[index,g]]));assert.ok(factory.batchRoot.children.filter(o=>o.userData.sharedAsset).every(o=>o.isInstancedMesh));assert.ok(factory.batchRoot.children.filter(o=>!o.isInstancedMesh).length<=1,'retaining walls merge into one shared-material draw');factory.rebuild(new Map());assert.equal(factory.batchRoot.children.length,0);assert.equal(disposed,false);
});
test('distant geometry cuts workload and visibility excludes buildings behind the camera',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 let full=0,low=0;for(const model of lib.models)for(const mesh of model.root.children){if(!model.site)full+=mesh.geometry.index.count;const distant=mesh.geometry.userData.lod||mesh.geometry;if(!model.site)low+=distant.index.count;assert.ok([...distant.attributes.position.array].every(Number.isFinite));if(model.family==='modern'){assert.notEqual(distant,mesh.geometry);assert.equal(distant.attributes.position,mesh.geometry.attributes.position,'distant models share the full-resolution vertex buffer');assert.equal(distant.attributes.normal,mesh.geometry.attributes.normal);if(mesh.material.name==='modern-glass-occupied'||mesh.material.name==='modern-brick')assert.deepEqual(distant.index.array,new Uint32Array(mesh.geometry.index.array),'distant facades retain every pane and wall opening');}}assert.ok(low<full*.25);
 const camera=new THREE.PerspectiveCamera(45,1,.1,500);camera.position.set(0,8,100);camera.lookAt(0,0,0);const view={scene:new THREE.Scene(),camera,landscape:{assets:{}}},factory=new BuildingFactory(view),g=new THREE.Group();g.userData={factory:true,asset:true};const mesh=lib.models[0].root.children[0].clone();g.add(mesh);factory.rebuild(new Map([[1,g]]));assert.ok(factory.instanceBatches[0].far.count>0);assert.equal(factory.instanceBatches[0].near.count,0);
 camera.lookAt(0,8,200);factory.updateVisibility();assert.equal(factory.instanceBatches[0].far.count,0);assert.equal(factory.instanceBatches[0].near.count,0);
});

test('loaded models follow angled roads without stretching or overlapping neighbouring lots',async()=>{
 const lib=await library(),world=E.createWorld('Asset frontage','plains',324);world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));world.money=100000;
 E.buildRoadPath(world,[{x:10,y:10},{x:30,y:30}],'street');const index=18*48+22;world.tiles[index]={type:'office',density:'high',level:2};
 const root=lib.create(world,index,{width:2,depth:1}),p=root.userData.plan,bounds=new THREE.Box3().setFromObject(root);
 assert.ok(p.frontage);assert.ok(Math.abs(root.rotation.y+Math.PI/4)<1e-8);
 const scale=root.children[0].scale;assert.equal(scale.x,scale.y);assert.equal(scale.y,scale.z);
 assert.ok(bounds.min.x>=p.cx-4-1e-5&&bounds.max.x<=p.cx+4+1e-5);
 assert.ok(bounds.min.z>=p.cz-2-1e-5&&bounds.max.z<=p.cz+2+1e-5);
});

test('modern library retains facade detail with shared materials and a bounded geometry cost',async()=>{
 const lib=await library(),modern=lib.models.filter(m=>m.family==='modern');assert.equal(modern.length,48);
 const materials=new Set();let triangles=0,hasWindowVariation=false;
 for(const model of modern){let count=0;for(const mesh of model.root.children){materials.add(mesh.material);count+=mesh.geometry.index.count/3;const color=mesh.geometry.attributes.color;assert.ok(color,'baked facade variation is retained');assert.ok([...color.array].every(Number.isFinite));if(new Set(color.array).size>3)hasWindowVariation=true;}assert.ok(count<(model.name.startsWith('perimeter-')?17000:model.site?8000:6600),model.name+' triangle budget');triangles+=count;}
 assert.ok(materials.size<=13,'materials are reused across modern buildings');assert.ok(triangles<180000);assert.ok(hasWindowVariation);
});
test('medium residential and low commercial zoning do not select high-rise models',async()=>{
 const lib=await library(),world=E.createWorld('Density model QA','plains',324);
 for(let x=10;x<30;x++)for(const [y,type,density,max]of [[20,'residential','medium',9],[22,'commercial','low',3]]){const index=y*48+x;world.tiles[index]={type,density,level:1};const g=lib.create(world,index,{width:2,depth:2}),model=lib.models.find(m=>m.name===g.userData.model);assert.ok(model.floors<=max,model.name+' matches '+density+' '+type);}
});

test('night lighting illuminates selected modern windows while balconies and other panes remain dark',async()=>{
 const lib=await library(),glass=[...lib.materials].filter(m=>m.name.startsWith('modern-glass'));assert.equal(glass.length,2);lib.setNight(true);
 assert.equal(glass.find(m=>m.name==='modern-glass').emissiveIntensity,0);assert.ok(glass.find(m=>m.name==='modern-glass-occupied').emissiveIntensity>0);
 lib.setNight(false);assert.ok(glass.every(m=>m.emissiveIntensity===0));
});

test('large zoned parcels select full-scale perimeter blocks and retain open courtyards',async()=>{
 const lib=await library(),world=E.createWorld('Block coverage','plains',324),index=20*48+20;
 for(const [type,density]of [['residential','medium'],['residential','high'],['commercial','high'],['office','high']]){
  world.tiles[index]={type,density,level:2};const before=JSON.stringify(world),root=lib.create(world,index,{width:3,depth:2}),asset=lib.models.find(m=>m.name===root.userData.model),model=root.children[0];
  assert.ok(type==='office'||asset.name.startsWith('perimeter-'),type+' '+asset.name);assert.equal(model.scale.x,.2);
  assert.ok(asset.size.x*asset.size.z*.04/(12*8)>.55,type+' '+asset.name+' coverage '+asset.size.x*asset.size.z*.04/(12*8));assert.equal(JSON.stringify(world),before);
  // Ray through the centre of the court must reach its planted ground, not a roof.
  if(!asset.name.startsWith('perimeter-'))continue;
  root.updateMatrixWorld(true);const origin=model.localToWorld(new THREE.Vector3(0,150,0)),ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(model,true);assert.ok(hits.length);assert.ok(hits[0].point.y<root.position.y+.4,'courtyard is open to the sky');
 }
});
test('street setbacks remain inside owned parcels at every road angle',async()=>{
 const lib=await library();
 for(const degree of [0,15,30,45,60,75,90,135,180,225,270]){
  const world=E.createWorld('Frontage bounds','plains',324);world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));world.money=100000;
  const angle=degree*Math.PI/180,dx=Math.cos(angle)*8,dy=Math.sin(angle)*8;
  E.buildRoadPath(world,[{x:22-dx,y:22-dy},{x:22+dx,y:22+dy}],'street');
  const index=25*48+24;world.tiles[index]={type:'commercial',density:'high',level:2};const root=lib.create(world,index,{width:3,depth:2}),p=root.userData.plan,b=new THREE.Box3().setFromObject(root);
  assert.ok(b.min.x>=p.cx-6-1e-5&&b.max.x<=p.cx+6+1e-5,degree+' x');
  assert.ok(b.min.z>=p.cz-4-1e-5&&b.max.z<=p.cz+4+1e-5,degree+' z');
 }
});

test('brick facades retain metre-scale UVs, PBR textures and accurate packed normals',async()=>{
 const lib=await library(),bricks=lib.models.flatMap(m=>m.root.children).filter(m=>m.material.name==='modern-brick');assert.equal(bricks.length,24);
 for(const mesh of bricks){assert.ok(mesh.material.map);assert.ok(mesh.material.normalMap);assert.ok(mesh.material.roughnessMap);const uv=mesh.geometry.attributes.uv;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=4){const metres=Math.hypot(p.getX(i+1)-p.getX(i),p.getY(i+1)-p.getY(i),p.getZ(i+1)-p.getZ(i));assert.ok(Math.abs(uv.getX(i+1)-uv.getX(i)-metres/2)<1e-5,'brick texture maintains two-metre repeat scale');}}
 for(const model of lib.models.filter(m=>m.family==='modern'))for(const mesh of model.root.children){const n=mesh.geometry.attributes.normal;assert.ok(n.normalized);assert.ok(n.array instanceof Int8Array);for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Math.abs(length-1)<.012,'lighting normals retain unit length');}}
});

test('a hillside district batches all terrain foundations without losing wall geometry',async()=>{
 const lib=await library(),world=E.createWorld('Hillside foundation QA','river',427),buildings=new Map();let vertices=0,walls=0;
 for(let x=5;x<23;x+=3){const index=8*48+x;world.tiles[index]={type:'residential',density:'medium',level:2};const root=lib.create(world,index,{width:3,depth:2});root.traverse(o=>{if(o.isMesh&&!o.userData.sharedAsset){walls++;vertices+=o.geometry.attributes.position.count;}});buildings.set(index,root);}
 assert.ok(walls>=5);const factory=new BuildingFactory({scene:new THREE.Scene(),landscape:{assets:{}}});factory.rebuild(buildings);const combined=factory.batchRoot.children.filter(o=>!o.isInstancedMesh);assert.equal(combined.length,1);assert.equal(combined[0].geometry.attributes.position.count,vertices);assert.ok(combined[0].receiveShadow);assert.ok(combined[0].castShadow);
});
test('low density neighborhoods retain several complete house models rather than one maximum-coverage model',async()=>{
 const lib=await library(),world=E.createWorld('House variety','plains',431),models=new Set();for(let x=8;x<35;x++){const i=20*48+x;world.tiles[i]={type:'residential',density:'low',level:1};models.add(lib.create(world,i).userData.model);}assert.ok(models.size>=4,[...models].join(','));
});

test('authored modern garden sites survive model normalization and fit complete model footprints',async()=>{
 const lib=await library(),planted=lib.models.filter(m=>m.gardens.length);assert.ok(planted.length>=10);
 let elevated=0,courtyards=0;
 for(const model of planted)for(const bed of model.gardens){
  assert.ok(Object.values(bed).every(Number.isFinite));assert.ok(bed.w>0&&bed.d>0);
  const x=bed.x+model.origin.x,z=bed.z+model.origin.z;
  assert.ok(x-bed.w/2>=-model.size.x/2-.001&&x+bed.w/2<=model.size.x/2+.001,model.name+' garden X');
  assert.ok(z-bed.d/2>=-model.size.z/2-.001&&z+bed.d/2<=model.size.z/2+.001,model.name+' garden Z');
  if(bed.y>3)elevated++;else courtyards++;
 }
 assert.ok(elevated>=5&&courtyards>=5);
});

test('building creation attaches shared trees above authored roofs and inside courtyard beds',async()=>{
 const lib=await library();lib.models=lib.models.filter(m=>m.name==='perimeter-campus-offices');
 const tree=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,1,.5),new THREE.MeshStandardMaterial());mesh.position.y=.5;tree.add(mesh);lib.view.vegetation={broadPrototype:tree};
 const w=E.createWorld('Roof garden','plains',324),i=20*48+20;w.tiles[i]={type:'office',density:'high',level:3};
 const root=lib.create(w,i,{width:3,depth:3}),gardens=root.children.find(o=>o.userData.buildingGardens);assert.ok(gardens.children.length>=4);
 const b=new THREE.Box3().setFromObject(gardens);assert.ok(b.max.y>6.5,'planting stands above the ten-floor rear roof');assert.ok(b.min.y<.2,'ground courtyard planting is also retained');
 gardens.traverse(o=>{if(o.isMesh)assert.equal(o.geometry,mesh.geometry)});
});

test('all ten civic catalogue options select distinct complete models without changing service state',async()=>{
 const lib=await library(),world=E.createWorld('Civic models','plains',812),index=24*48+24;
 const factory=new BuildingFactory({scene:new THREE.Scene(),landscape:{assets:{}}});factory.library=lib;
 const ids=['clinic','hospital','wellness','elementary','highschool','college','police','headquarters','fire','rescue'],names=new Set();
 for(const building of ids){
  const spec=E.BUILDINGS[building];world.tiles[index]={type:spec.type,building,level:1,variant:0};world.tiles[index+48].type='road';const before=JSON.stringify(world);
  assert.equal(factory.accepts(world.tiles[index]),true);const root=factory.create(world,index);names.add(root.userData.model);
  assert.equal(root.userData.model,'civic-'+building);assert.equal(root.userData.asset,true);assert.equal(root.userData.plan.angle,0);
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());assert.ok(size.x<=4.001&&size.z<=4.001,building+' remains on its owned lot');
  assert.equal(JSON.stringify(world),before,'rendering preserves costs, capacity and saves');
 }
 assert.equal(names.size,10);
 for(const [type,id]of [['hospital','clinic'],['school','elementary'],['police','police'],['fire','fire']]){
  world.tiles[index]={type,level:1,variant:0};assert.equal(factory.create(world,index).userData.model,'civic-'+id,'legacy saves receive their default facility');
 }
 const empty=new BuildingFactory({scene:new THREE.Scene(),landscape:{assets:{}}});assert.equal(empty.accepts({type:'hospital',building:'clinic'}),false,'missing assets retain the existing service renderer');
});


test('modern street fronts have ground-level entrances and shared transparent shop glazing with room backs',async()=>{
 const lib=await library(),modern=lib.models.filter(m=>m.family==='modern');let entrances=0,shops=0;
 for(const model of modern){
  assert.ok(model.streetFronts.length>0,model.name+' has an authored entrance');
  for(const front of model.streetFronts){entrances++;assert.ok(front.position.every(Number.isFinite));assert.ok(Math.abs(front.position[1]-.08)<1e-6);assert.ok(front.width>.7&&front.width<3.5);assert.ok(front.normal[1]>.9);}
  const glazing=model.root.children.find(m=>m.material.name==='modern-shop-glass');
  if(model.category==='commercial'){
   shops++;assert.ok(glazing);assert.equal(glazing.material.transparent,true);assert.ok(glazing.material.opacity>0&&glazing.material.opacity<.5);
   assert.ok(model.root.children.some(m=>m.material.name==='modern-recess'),'opaque recessed room backs retained');
   const sign=model.root.children.find(m=>m.material.name==='modern-shop-sign');assert.ok(sign?.material.map);assert.ok([...sign.geometry.attributes.uv.array].every(v=>v>=0&&v<=1));
  }else assert.equal(glazing,undefined,'residential and civic upper glazing remains opaque');
 }
 assert.equal(shops,3);assert.ok(entrances>=55);
 const manifest=JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),data=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(manifest,data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
 for(const m of modern)for(const mesh of m.root.children)if(['modern-shop-glass','modern-shop-sign'].includes(mesh.material.name))assert.deepEqual(mesh.geometry.userData.lod.index.array,new Uint32Array(mesh.geometry.index.array),'distant storefronts retain glazing and signs');
});

test('complete buildings and grounds remain inside the zoning cells reserved by rotated sites',async()=>{
 const {visualParcels}=await import('../dist/parcels.js'),lib=await library(),world=E.createWorld('Rotated assets','plains',39);world.money=1000000;for(const t of world.tiles)Object.assign(t,{type:null,level:0,ground:'land'});E.buildRoadPath(world,[{x:10,y:30},{x:24,y:8},{x:38,y:30}],'street');for(let y=15;y<34;y++)for(let x=8;x<41;x++){const t=world.tiles[y*48+x];if(t.type!=='road')Object.assign(t,{type:'residential',density:'medium',level:2,variant:(x+y)%4});}
 const parcels=[...new Set(visualParcels(world).values())].filter(p=>p.oriented),before=JSON.stringify(world);assert.ok(parcels.length>10);
 const point=new THREE.Vector3();for(const parcel of parcels){const root=lib.create(world,parcel.owner,parcel),owned=new Set(parcel.members);root.updateMatrixWorld(true);assert.equal(root.rotation.y,parcel.oriented.angle);root.traverse(mesh=>{if(!mesh.isMesh)return;const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const cell=Math.floor((point.z+96)/4)*48+Math.floor((point.x+96)/4);assert.ok(owned.has(cell),'model or grounds escaped the owned cells');}});}
 assert.equal(JSON.stringify(world),before);
});

test('new civic sites select full-sized models with human-scale entrances inside their reserved land',async()=>{
 const {visualParcels}=await import('../dist/parcels.js'),lib=await library(),point=new THREE.Vector3();
 for(const [id,[width,depth]] of Object.entries(E.FACILITY_SITES))for(let rotation=0;rotation<4;rotation++){
  const world=E.createWorld('Facility models','plains',41),r=E.place(world,20,15,E.BUILDINGS[id].type,{building:id,rotation}),parcel=visualParcels(world).get(r.owner),before=JSON.stringify(world);
  const root=lib.create(world,r.owner,parcel),asset=lib.models.find(a=>a.name===root.userData.model),model=root.children[0];
  assert.equal(asset.name,'site-'+id);assert.equal(asset.site,true);assert.equal(model.scale.x,.2,'architecture retains metre scale');assert.equal(model.scale.y,.2);assert.equal(model.scale.z,.2);
  assert.ok(asset.size.x>width*20*.6&&asset.size.z>depth*20*.6,'full-sized campus footprint');assert.ok(asset.streetFronts.length);
  for(const door of asset.streetFronts)assert.ok(door.width>.7&&door.width<3.5,'doors do not enlarge with the site');
  root.updateMatrixWorld(true);const owned=new Set(r.cells);
  root.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);const cell=Math.floor((point.z+96)/4)*48+Math.floor((point.x+96)/4);assert.ok(owned.has(cell),`${id}/${rotation} ${mesh.material.name} escaped site`);}});
  assert.equal(JSON.stringify(world),before);
 }
});

test('pitched neighborhood houses retain roof silhouettes and windows in distant geometry',async()=>{
 const lib=await library(),homes=lib.models.filter(m=>m.houseForm),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));
 lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 assert.equal(homes.length,8);assert.equal(homes.filter(m=>m.houseForm==='detached').length,6);
 for(const home of homes){
  assert.ok(home.size.y>5&&home.size.y<11);assert.ok(home.streetFronts.some(f=>f.kind==='entrance'&&f.normal[1]>.9));
  const roof=home.root.children.find(m=>m.material.name==='modern-roof');assert.ok(roof,home.name);
  const n=roof.geometry.attributes.normal;let slopes=0;
  for(let i=0;i<n.count;i++){assert.ok(n.getY(i)>=0,home.name+' roof faces upward');if(n.getY(i)>.1&&n.getY(i)<.95)slopes++;}
  assert.ok(slopes>=8,home.name+' has both pitched roof planes');
  const bounds=new THREE.Box3().setFromBufferAttribute(roof.geometry.attributes.position),far=roof.geometry.userData.lod;const used=far.index.array,p=far.attributes.position;
  assert.equal(Math.max(...Array.from(used,i=>p.getY(i))),bounds.max.y,'far ridge height retained');
  for(const glass of home.root.children.filter(m=>m.material.name.startsWith('modern-glass')))assert.deepEqual(glass.geometry.userData.lod.index.array,new Uint32Array(glass.geometry.index.array),'all glazing retained');
 }
});
test('low zoning uses detached houses and row housing keeps paired or terrace forms deterministically',async()=>{
 const lib=await library(),w=E.createWorld('House zoning','plains',431),detached=new Set(),rows=new Set();
 for(const building of ['cottage','townhouse'])for(let x=8;x<35;x++){
  const i=20*48+x;w.tiles[i]={type:'residential',density:'low',building,level:1};const before=JSON.stringify(w),root=lib.create(w,i),again=lib.create(w,i),model=lib.models.find(m=>m.name===root.userData.model),p=root.userData.plan,b=new THREE.Box3().setFromObject(root);
  assert.equal(root.userData.model,again.userData.model);assert.equal(JSON.stringify(w),before);
  assert.ok(b.min.x>=p.cx-2-1e-5&&b.max.x<=p.cx+2+1e-5&&b.min.z>=p.cz-2-1e-5&&b.max.z<=p.cz+2+1e-5,'house and porch fit owned lot');
  if(building==='townhouse'){assert.ok(['semi','terrace'].includes(model.houseForm));rows.add(model.name);}else{assert.equal(model.houseForm,'detached');detached.add(model.name);}
 }
 assert.ok(detached.size>=4);assert.equal(rows.size,2);
});

test('authored household doors position their own clear garden walks and road access points',async()=>{
 const lib=await library(),w=E.createWorld('House entrances','plains',431),index=20*48+20;w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));w.tiles[index+48].type='road';
 for(const asset of lib.models.filter(a=>a.houseForm)){
  const all=lib.models;lib.models=[asset];w.tiles[index]={type:'residential',density:'low',building:asset.houseForm==='detached'?'cottage':'townhouse',level:1};const before=JSON.stringify(w),root=lib.create(w,index),p=root.userData.plan,scale=root.children[0].scale.x;
  const front=asset.streetFronts.filter(f=>f.kind==='entrance'&&f.normal[1]>.9),frontZ=Math.max(...front.map(f=>f.position[2])),expected=front.filter(f=>f.position[2]>=frontZ-.5).map(f=>(f.position[0]+asset.origin.x)*scale);
  assert.deepEqual(p.entranceXs,expected,asset.name);for(const x of expected)assert.ok(p.accessPoints.some(a=>a.kind==='walk'&&Math.abs(a.x-x)<1e-8),asset.name+' door has matching path');
  assert.equal(JSON.stringify(w),before);lib.models=all;
 }
});
