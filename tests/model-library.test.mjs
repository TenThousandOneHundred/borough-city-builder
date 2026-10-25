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
 const lib=await library();assert.equal(lib.models.length,89);assert.deepEqual([...new Set(lib.models.map(m=>m.category))].sort(),['commercial','fire','hospital','industrial','office','police','residential','residential-low','school']);
 for(const model of lib.models){assert.ok(model.size.x>0&&model.size.y>0&&model.size.z>0);assert.ok(model.root.children.length<=(model.category==='commercial'?13:model.site?11:10));for(const mesh of model.root.children){if(mesh.material.map)assert.ok(mesh.geometry.attributes.uv);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}}
});
test('model placement fits saved lots uniformly and instancing survives demolition without disposing shared models',async()=>{
 const lib=await library(),world=E.createWorld('Model test','flat',324),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:2};const before=JSON.stringify(world),parcel={width:2,depth:3};const g=lib.create(world,index,parcel),s=g.children[0].scale;assert.equal(s.x,s.y);assert.equal(s.y,s.z);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.max.x-bounds.min.x<8);assert.ok(bounds.max.z-bounds.min.z<12);assert.equal(JSON.stringify(world),before);
 const view={scene:new THREE.Scene(),landscape:{assets:{}}},factory=new BuildingFactory(view);let disposed=false;g.children[0].children[0].geometry.addEventListener('dispose',()=>disposed=true);factory.rebuild(new Map([[index,g]]));assert.ok(factory.batchRoot.children.filter(o=>o.userData.sharedAsset).every(o=>o.isInstancedMesh));assert.ok(factory.batchRoot.children.filter(o=>!o.isInstancedMesh).length<=1,'retaining walls merge into one shared-material draw');factory.rebuild(new Map());assert.equal(factory.batchRoot.children.length,0);assert.equal(disposed,false);
});
test('distant geometry cuts workload and visibility excludes buildings behind the camera',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 let full=0,low=0,newFull=0,newLow=0,courtFull=0,courtLow=0,masonryLow=0,industryLow=0;for(const model of lib.models)for(const mesh of model.root.children){if(!model.site)full+=mesh.geometry.index.count;const distant=mesh.geometry.userData.lod||mesh.geometry;if(!model.site)low+=distant.index.count;if(model.family==='masonry'&&!['workshop','warehouse','brick-factory','loft-apartments','brick-retail'].includes(model.name)){masonryLow+=distant.index.count;}if(model.name.startsWith('industrial-'))industryLow+=distant.index.count;if(model.building==='lowrent'){newFull+=mesh.geometry.index.count;newLow+=distant.index.count;}if(model.name.startsWith('neighborhood-')&&model.name.includes('-court-')){courtFull+=mesh.geometry.index.count;courtLow+=distant.index.count;}assert.ok([...distant.attributes.position.array].every(Number.isFinite));if(model.family==='modern'){assert.notEqual(distant,mesh.geometry);assert.equal(distant.attributes.position,mesh.geometry.attributes.position,'distant models share the full-resolution vertex buffer');assert.equal(distant.attributes.normal,mesh.geometry.attributes.normal);if(mesh.material.name==='modern-glass-occupied'||mesh.material.name==='modern-brick')assert.deepEqual(distant.index.array,new Uint32Array(mesh.geometry.index.array),'distant facades retain every pane and wall opening');}}assert.ok(courtLow<courtFull*.8,'new courtyard models retain facades but reduce distant detail');assert.ok(low-newLow-courtLow-masonryLow-industryLow<=382050,'unchanged modern and industrial catalogue retains its distant geometry budget');assert.ok(newLow<newFull*.55,'new apartment blocks shed small distant details while retaining facades');
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
 const lib=await library(),modern=lib.models.filter(m=>m.family==='modern');assert.equal(modern.length,68);
 const materials=new Set();let triangles=0,industrialTriangles=0,hasWindowVariation=false;
 for(const model of modern){let count=0;for(const mesh of model.root.children){materials.add(mesh.material);count+=mesh.geometry.index.count/3;const color=mesh.geometry.attributes.color;assert.ok(color,'baked facade variation is retained');assert.ok([...color.array].every(Number.isFinite));if(new Set(color.array).size>3)hasWindowVariation=true;}assert.ok(count<(model.name.startsWith('perimeter-')?17000:model.building==='lowrent'?11000:model.site?8000:6600),model.name+' triangle budget');triangles+=count;if(model.name.startsWith('industrial-'))industrialTriangles+=count;}
 assert.ok(materials.size<=13,'materials are reused across modern buildings');const added=modern.filter(m=>m.name.endsWith('gable-brick-terrace')).reduce((n,m)=>n+m.root.children.reduce((s,part)=>s+part.geometry.index.count/3,0),0);const officeNames=new Set(['glass-podium-offices','stepped-concrete-offices','elliptic-glass-offices','slender-glass-offices']),officeUpgrade=modern.filter(m=>officeNames.has(m.name)).reduce((n,m)=>n+m.root.children.reduce((s,p)=>s+p.geometry.index.count/3,0),0)-12868;assert.ok(officeUpgrade<3000,'four rebuilt office facades share a 3000-triangle addition budget');const courts=modern.filter(m=>m.name.startsWith('neighborhood-')&&m.name.includes('-court-')).reduce((n,m)=>n+m.root.children.reduce((s,p)=>s+p.geometry.index.count/3,0),0);assert.ok(courts<10000,'two courtyard forms share a bounded geometry budget');const streetRows=modern.filter(m=>['raised-stoop-brick-terrace','dormer-roof-brick-terrace'].includes(m.name)).reduce((n,m)=>n+m.root.children.reduce((s,p)=>s+p.geometry.index.count/3,0),0);assert.ok(streetRows<4500,'two street terraces share a bounded geometry budget');assert.ok(triangles-courts-added-officeUpgrade-streetRows-industrialTriangles<196000,'unchanged catalogue budget retained');assert.ok(added<4000,'two original terraces share a 4000-triangle budget');assert.ok(triangles-courts-officeUpgrade-streetRows-industrialTriangles<200000);assert.ok(hasWindowVariation);
});
test('medium residential and low commercial zoning do not select high-rise models',async()=>{
 const lib=await library(),world=E.createWorld('Density model QA','plains',324);
 for(let x=10;x<30;x++)for(const [y,type,density,max]of [[20,'residential','medium',9],[22,'commercial','low',3]]){const index=y*48+x;world.tiles[index]={type,density,level:1};const g=lib.create(world,index,{width:2,depth:2}),model=lib.models.find(m=>m.name===g.userData.model);assert.ok(model.floors<=max,model.name+' matches '+density+' '+type);}
});

test('night lighting illuminates selected modern windows while balconies and other panes remain dark',async()=>{
 const lib=await library(),glass=[...lib.materials].filter(m=>m.name.startsWith('modern-glass'));assert.equal(glass.length,2);lib.setNight(true);
 assert.ok(glass.every(m=>m.userData.roomLighting&&m.emissiveIntensity>0),'room shaders control individual panes rather than lighting a fixed material pattern');
 lib.setNight(false);assert.ok(glass.every(m=>m.emissiveIntensity===0));
});

test('large zoned parcels retain full-scale blocks and towers with open courtyard geometry',async()=>{
 const lib=await library(),world=E.createWorld('Block coverage','plains',324),index=20*48+20;
 for(const [type,density]of [['residential','medium'],['residential','high'],['commercial','high'],['office','high']]){
  world.tiles[index]={type,density,level:2};const before=JSON.stringify(world),root=lib.create(world,index,{width:3,depth:2}),asset=lib.models.find(m=>m.name===root.userData.model),model=root.children[0];
  if(density==='medium')assert.ok(asset.name.startsWith('perimeter-'),type+' '+asset.name);assert.equal(model.scale.x,.2);
  assert.ok(asset.size.x*asset.size.z*.04/(12*8)>(asset.name.startsWith('perimeter-')?.55:.12),type+' '+asset.name+' maintains a full-scale footprint');assert.equal(JSON.stringify(world),before);
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
 const lib=await library(),bricks=lib.models.flatMap(m=>m.root.children).filter(m=>m.material.name==='modern-brick');assert.equal(bricks.length,39);
 for(const mesh of bricks){assert.ok(mesh.material.map);assert.ok(mesh.material.normalMap);assert.ok(mesh.material.roughnessMap);const uv=mesh.geometry.attributes.uv;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=4){const metres=Math.hypot(p.getX(i+1)-p.getX(i),p.getY(i+1)-p.getY(i),p.getZ(i+1)-p.getZ(i));assert.ok(Math.abs(Math.hypot(uv.getX(i+1)-uv.getX(i),uv.getY(i+1)-uv.getY(i))-metres/2)<1e-5,'brick texture maintains two-metre repeat scale');}}
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
  for(const front of model.streetFronts.filter(f=>f.kind!=='loading')){entrances++;assert.ok(front.position.every(Number.isFinite));const threshold=model.name==='raised-stoop-brick-terrace'?1.04:model.name==='dormer-roof-brick-terrace'?.16:.08;assert.ok(Math.abs(front.position[1]-threshold)<1e-6,'authored entry matches its threshold height');assert.ok(front.width>.7&&front.width<3.5);assert.ok(front.normal[1]>.9);}
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

test('neighborhood houses retain their pitched or flat roof silhouettes and windows in distant geometry',async()=>{
 const lib=await library(),homes=lib.models.filter(m=>m.houseForm),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));
 lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 assert.equal(homes.length,14);assert.equal(homes.filter(m=>m.houseForm==='detached').length,8);
 for(const home of homes){
  assert.ok(home.size.y>5&&home.size.y<(home.name.endsWith('-terrace')?12:11));assert.ok(home.streetFronts.some(f=>f.kind==='entrance'&&f.normal[1]>.9));
  const roof=home.root.children.find(m=>m.material.name==='modern-roof');assert.ok(roof,home.name);
  const n=roof.geometry.attributes.normal;let slopes=0;
  for(let i=0;i<n.count;i++){assert.ok(n.getY(i)>=0,home.name+' roof faces upward');if(n.getY(i)>.1&&n.getY(i)<.95)slopes++;}
  if(home.roofForm==='corniced-flat')assert.equal(slopes,0,'flat terrace has a level membrane and parapet');else assert.ok(slopes>=8,home.name+' has both pitched roof planes');
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
 assert.ok(detached.size>=4);assert.equal(rows.size,6);
});

test('historic terraces retain shaped crowns, recessed windows and correctly oriented party-wall brickwork',async()=>{
 const lib=await library(),homes=lib.models.filter(m=>m.name.endsWith('gable-brick-terrace'));assert.equal(homes.length,2);
 const bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 assert.deepEqual(new Set(homes.map(h=>h.roofForm)),new Set(['stepped-gable','bell-gable']));
 for(const home of homes){
  assert.equal(home.houseForm,'terrace');assert.equal(home.floors,3);assert.ok(home.size.x>7.5&&home.size.x<7.7);assert.ok(home.size.y>11&&home.size.y<12);
  assert.ok(home.root.children.reduce((n,m)=>n+m.geometry.index.count/3,0)<2000);
  const full=home.root.children.reduce((n,m)=>n+m.geometry.index.count,0),far=home.root.children.reduce((n,m)=>n+m.geometry.userData.lod.index.count,0);assert.ok(far<full*.48,'distant terraces retain facade faces with fewer small frame edges');
  const brick=home.root.children.find(m=>m.material.name==='modern-brick'),pos=brick.geometry.attributes.position,norm=brick.geometry.attributes.normal,uv=brick.geometry.attributes.uv;let sideVertices=0;
  for(let i=0;i<pos.count;i++)if(Math.abs(norm.getX(i))>.99&&Math.abs(pos.getX(i))>3.7){
   assert.ok(Math.abs(uv.getY(i)-(pos.getY(i)-home.origin.y)/2)<1e-5,'vertical brick UV follows height');
   assert.ok(Math.abs(uv.getX(i)-(pos.getZ(i)-home.origin.z)/2)<1e-5,'horizontal brick courses follow wall length');sideVertices++;
  }assert.equal(sideVertices,8);
  const front=home.streetFronts.filter(f=>f.kind==='entrance'&&f.normal[1]>.9);assert.equal(front.length,1);assert.ok(front[0].position[0]<-2,'entrance occupies its own narrow bay');
  for(const glass of home.root.children.filter(m=>m.material.name.startsWith('modern-glass'))){const n=glass.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(n.getX(i))<1e-6,'no party-wall windows');}
  // Cast through the attic opening: glazing lies behind the masonry face,
  // rather than a solid brick triangle covering the window at a distance.
  const ray=new THREE.Raycaster(new THREE.Vector3(.25,9.7,20),new THREE.Vector3(0,0,-1));home.root.updateMatrixWorld(true);
  const hits=ray.intersectObject(home.root,true);assert.ok(hits.length);assert.ok(hits[0].object.material.name.startsWith('modern-glass'),'attic opening reaches recessed glazing');
 }
});

test('ordinary row zoning grows both historic terraces on multi-cell road-facing lots and reloads the same models',async()=>{
 const lib=await library(),w=E.createWorld('Historic row district','plains',8),B=globalThis.BoroughBuildings;w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');
 const cells=[...E.fineZoningLayout(w).values()].filter(p=>p.row<3);assert.ok(E.fineZoneCells(w,cells.map(p=>p.id),'residential_row').ok);for(let i=0;i<120;i++)E.tick(w);
 const saved=JSON.stringify(w),reloaded=JSON.parse(saved),names=new Set(),lots=Object.values(w.development.parcels).filter(p=>p.occupant&&!p.occupant.construction);assert.ok(lots.length>15);
 for(const lot of lots){
  assert.ok(lot.cells.length>1);const p=B.renderParcel(w,lot.id),root=lib.create(w,p.index,p),again=B.renderParcel(reloaded,lot.id),restored=lib.create(reloaded,again.index,again);names.add(root.userData.model);assert.equal(restored.userData.model,root.userData.model);assert.equal(root.rotation.y,lot.frame.angle);
  const asset=lib.models.find(m=>m.name===root.userData.model),plan=root.userData.plan;assert.equal(asset.houseForm,'terrace');
  for(const home of root.children.slice(0,root.userData.homeCopies)){assert.ok(home.scale.x>=.17&&home.scale.x<=.24);assert.equal(home.scale.x,home.scale.y);assert.equal(home.scale.x,home.scale.z);assert.ok(Math.abs(home.position.x)+asset.size.x*home.scale.x/2<=plan.lotWidth/2-.019);assert.ok(Math.abs(home.position.z)+asset.size.z*home.scale.x/2<=plan.lotDepth/2-.14);}
  for(const x of plan.entranceXs)assert.ok(plan.accessPoints.some(a=>a.kind==='walk'&&Math.abs(a.x-x)<1e-8),'every authored door has street access');
 }
 for(const name of ['narrow-gabled-townhouse','stepped-gable-brick-terrace','bell-gable-brick-terrace'])assert.ok(names.has(name),name+' actually grows');assert.equal(JSON.stringify(w),saved);assert.ok(E.valid(reloaded));
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


test('high-density zoning uses varied full models with deterministic selection and bounded footprints',async()=>{
 const lib=await library(),world=E.createWorld('Skyline diversity','plains',324),before=()=>JSON.stringify(world);
 for(const [type,width,depth,min]of [['office',1,1,2],['office',2,2,5],['residential',2,2,5],['commercial',2,2,3]]){
  const selected=new Map();world.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));
  for(let k=0;k<120;k++){
   const i=(10+Math.floor(k/20))*48+8+k%20;world.tiles[i]={type,density:'high',level:2};const saved=before(),root=lib.create(world,i,{width,depth});
   selected.set(root.userData.model,(selected.get(root.userData.model)||0)+1);assert.equal(before(),saved);
   const model=root.children[0],asset=lib.models.find(m=>m.name===root.userData.model);if(type==='commercial')assert.ok(asset.floors>=4,'high-density commerce retains multi-storey buildings');assert.equal(model.scale.x,model.scale.y);assert.equal(model.scale.y,model.scale.z);assert.ok(asset.size.x*model.scale.x<width*4);assert.ok(asset.size.z*model.scale.z<depth*4);
   if(k%30===0)assert.equal(lib.create(world,i,{width,depth}).userData.model,root.userData.model,'rebuild is deterministic');
  }
  assert.ok(selected.size>=min,type+' '+[...selected.keys()].join(','));assert.ok(Math.max(...selected.values())<110,'one model cannot dominate every sampled lot');
  if(type==='office'&&width===2){assert.ok(selected.has('elliptic-glass-offices'));assert.ok(selected.has('glass-podium-offices'));}
 }
});

test('individual window rooms retain geometry and shared LOD attributes while excluding railings',async()=>{
 const {addWindowRooms}=await import('../dist/window-lighting.js'),lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 let litPanes=0,darkSurfaces=0,roomBytes=0;
 for(const model of lib.models)for(const mesh of model.root.children){if(!mesh.material.userData.roomLighting)continue;const g=mesh.geometry,room=g.attributes.windowRoom;assert.equal(room.count,g.attributes.position.count);assert.equal(g.userData.lod.attributes.windowRoom,room,'near and far use identical room data');roomBytes+=room.array.byteLength;
  const before=room.array.slice(),positions=g.attributes.position.array.slice(),indices=g.index.array.slice();const stats=addWindowRooms(g);assert.deepEqual(g.attributes.windowRoom.array,before,'room seeds remain stable');assert.deepEqual(g.attributes.position.array,positions);assert.deepEqual(g.index.array,indices);litPanes+=stats.eligible;darkSurfaces+=stats.panes-stats.eligible;
  for(let j=0;j<g.index.count;j+=3){const a=g.index.getX(j);for(let k=1;k<3;k++){const b=g.index.getX(j+k);assert.equal(room.getX(a),room.getX(b),'no light discontinuity across a pane');assert.equal(room.getY(a),room.getY(b));}}
 }
 assert.ok(litPanes>1000);assert.ok(darkSurfaces>0);assert.ok(roomBytes<2e6,'room data stays below two megabytes across the entire library');
 const railing=new THREE.PlaneGeometry(3,1),pane=new THREE.PlaneGeometry(2,2),skylight=new THREE.PlaneGeometry(2,2);skylight.rotateX(-Math.PI/2);assert.equal(addWindowRooms(railing).eligible,0);assert.equal(addWindowRooms(skylight).eligible,0);assert.equal(addWindowRooms(pane).eligible,1);
 const material=lib.models.flatMap(m=>m.root.children).find(m=>m.material.userData.roomLighting).material,shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'};material.onBeforeCompile(shader);assert.equal(shader.uniforms.roomNight,material.userData.roomLightingState);lib.setNight(true);assert.equal(shader.uniforms.roomNight.value,1);lib.setNight(false);assert.equal(shader.uniforms.roomNight.value,0);
});

test('roof finishes reuse shared asset materials and geometry across full and distant buildings',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));
 lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 for(const name of ['modern-roof','modern-leaves']){
  const meshes=lib.models.flatMap(m=>m.root.children).filter(m=>m.material.name===name);
  assert.ok(meshes.length>20);assert.equal(new Set(meshes.map(m=>m.material)).size,1,'finish remains one shared material');
  assert.ok(meshes.every(m=>m.material.userData.roofFinish));
  for(const mesh of meshes){assert.equal(mesh.geometry.userData.lod.attributes.position,mesh.geometry.attributes.position);assert.equal(mesh.geometry.userData.lod.attributes.normal,mesh.geometry.attributes.normal);}
 }
 const world=E.createWorld('Roof batch QA','plains',324),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:3};
 const root=lib.create(world,index,{width:3,depth:2}),view={scene:new THREE.Scene(),landscape:{assets:{}}},factory=new BuildingFactory(view);
 factory.rebuild(new Map([[index,root]]));const batches=factory.instanceBatches.filter(b=>b.near.material.userData.roofFinish);assert.ok(batches.length);
 for(const batch of batches)assert.equal(batch.near.material,batch.far.material,'distance transitions retain the same finish');
});

test('baked roof variation preserves geometry and leaves ground and pitched roofs unchanged',async()=>{
 const {bakeRoofFinish}=await import('../dist/roof-finishes.js');
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([1,8,2,1,0,2,1,8,2],3));g.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,.7,.7],3));g.setAttribute('color',new THREE.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));
 const material=new THREE.MeshStandardMaterial({vertexColors:true});material.name='modern-roof';const shader=material.onBeforeCompile,positions=g.attributes.position.array.slice();bakeRoofFinish(g,material);
 assert.deepEqual(g.attributes.position.array,positions);assert.equal(material.onBeforeCompile,shader,'no additional runtime shader');assert.equal(material.map,null,'no additional texture');assert.ok(g.attributes.color.getX(0)<1);assert.equal(g.attributes.color.getX(1),1);assert.equal(g.attributes.color.getX(2),1);
});


test('office districts mix full-scale silhouettes without increasing model geometry',async()=>{
 const lib=await library(),world=E.createWorld('Variety','flat',324),counts=new Map();let triangles=0;
 const costs=new Map(lib.models.map(m=>[m.name,m.root.children.reduce((sum,o)=>sum+o.geometry.index.count/3,0)]));
 const previous={'perimeter-campus-offices':91,'crescent-offices':11,'stepped-concrete-offices':6,'glass-podium-offices':10,'office-tower':22,'civic-offices':3,'elliptic-glass-offices':1};
 for(let y=10;y<34;y+=2)for(let x=6;x<42;x+=3){
  const i=y*48+x;world.tiles[i]={type:'office',density:'high',level:3};
  const before=JSON.stringify(world),root=lib.create(world,i,{width:3,depth:2}),name=root.userData.model;
  assert.equal(lib.create(world,i,{width:3,depth:2}).userData.model,name,'reload selects the same architecture');
  assert.equal(JSON.stringify(world),before,'visual selection never changes resident or save state');
  assert.ok(root.children[0].scale.x>=.17,'buildings retain metre-scale proportions');
  counts.set(name,(counts.get(name)||0)+1);triangles+=costs.get(name);
 }
 assert.ok(counts.size>=7);assert.ok(Math.max(...counts.values())<72,'no one model dominates half the district');
 assert.ok(counts.get('elliptic-glass-offices')>=10,'rounded towers actually appear');
 const baseline=Object.entries(previous).reduce((sum,[name,count])=>sum+costs.get(name)*count,0);
 assert.ok(triangles<=baseline,'more varied architecture does not increase full-detail geometry');
});

 test('mixed-use lots select detailed shopfront apartment models with shared geometry',async()=>{const lib=await library(),w=E.createWorld('Mixed models','plains',8),index=23*48+8;Object.assign(w.tiles[index],{type:'residential',building:'mixeduse',density:'medium',level:2});const g=lib.create(w,index,{width:2,depth:2});assert.ok(g.userData.model.includes('mixed-use'));const asset=lib.models.find(m=>m.name===g.userData.model);assert.equal(g.children[0].children[0].geometry,asset.root.children[0].geometry);assert.equal(g.children[0].children[0].material,asset.root.children[0].material);});

test('mixed-use storefronts keep broad displays, separate apartment access and open courtyard space',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 for(const name of ['neighborhood-mixed-use','perimeter-mixed-use']){
  const model=lib.models.find(m=>m.name===name),shop=model.root.children.find(m=>m.material.name==='modern-shop-glass'),p=shop.geometry.attributes.position;
  const displayWidths=[];for(let i=0;i<p.count;i+=4)displayWidths.push(Math.abs(p.getX(i+1)-p.getX(i)));
  assert.ok(displayWidths.some(w=>w>3),'street display windows are broader than apartment windows');
  assert.ok(model.streetFronts.filter(f=>f.kind==='shop').length>=2);model.root.updateMatrixWorld(true);
  const check=()=>{
   const lobby=model.streetFronts.find(f=>f.kind==='entrance');assert.ok(lobby);assert.ok(lobby.width>.8&&lobby.width<1.4);
   const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x+model.origin.x,y+model.origin.y,100),new THREE.Vector3(0,0,-1)).intersectObject(model.root,true);
   assert.equal(ray(lobby.position[0],1.4)[0].object.material.name,'modern-glass','apartment entrance is visible between shops');
   if(name==='neighborhood-mixed-use'){
    const hits=ray(7.2,1.5);assert.equal(hits[0].object.material.name,'modern-shop-glass');assert.ok(hits.some(h=>h.object.material.name==='modern-recess'&&h.point.z<hits[0].point.z-.5),'display glazing has a room behind it');
   }else{
    const hit=new THREE.Raycaster(new THREE.Vector3(model.origin.x,100,model.origin.z),new THREE.Vector3(0,-1,0)).intersectObject(model.root,true)[0];assert.ok(hit);assert.ok(hit.point.y<1+model.origin.y,'courtyard stays open to ground level');
   }
  };
  check();for(const mesh of model.root.children)mesh.geometry=mesh.geometry.userData.lod;check();
 }
});

test('mixed-use zoning grows small shopfronts and full-size courtyard blocks on varied lots and reloads them',async()=>{
 const lib=await library(),w=E.createWorld('Mixed-use street','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');
 const grid=E.fineZoningLayout(w),ids=[...grid.values()].filter(p=>p.side===-1&&p.row<6).map(p=>p.id);E.fineZoneCells(w,ids,'residential_mixed');
 for(let n=0;n<160;n++)E.tick(w);
 const B=globalThis.BoroughBuildings,lots=Object.values(w.development.parcels).filter(p=>p.occupant&&!p.occupant.construction),names=new Set(),state=JSON.stringify(w);
 assert.ok(lots.some(p=>p.width>=5),'mixed-use planning must allow larger frontage');assert.ok(lots.some(p=>p.width<=4),'small shopfront sites remain available');
 const selections=new Map();for(const p of lots){const parcel=B.renderParcel(w,p.id),root=lib.create(w,parcel.index,parcel);names.add(root.userData.model);selections.set(p.id,root.userData.model);assert.ok(root.children[0].scale.x>=.17,'larger blocks retain authored metre scale');assert.equal(root.rotation.y,p.frame.angle);assert.ok(root.userData.plan.entranceXs.length>0,'separate apartment entrances connect to the street');}
 assert.deepEqual(names,new Set(['neighborhood-mixed-use','perimeter-mixed-use']));assert.equal(JSON.stringify(w),state);
 const copy=JSON.parse(state);assert.ok(E.valid(copy));E.fineZonePlan(copy);assert.deepEqual(copy.development,w.development,'replanning cannot resize saved occupied lots');
 for(const p of lots){const parcel=B.renderParcel(copy,p.id);assert.equal(lib.create(copy,parcel.index,parcel).userData.model,selections.get(p.id));}
});

test('road-facing row lots repeat full-size shared homes with individual doors and bounded rear gardens',async()=>{
 const lib=await library(),world=E.createWorld('Terrace frontage','plains',431),index=20*48+20;world.tiles[index]={type:'residential',density:'medium',building:'townhouse',level:2};
 const parcel={width:2,depth:2,members:[index,index+1,index+48,index+49],oriented:{cx:0,cz:0,width:7.88,depth:7.88,angle:.35,frontage:{x:0,z:6}}},before=JSON.stringify(world),root=lib.create(world,index,parcel),asset=lib.models.find(m=>m.name===root.userData.model),copies=root.userData.homeCopies,p=root.userData.plan;
 assert.equal(asset.houseForm,'terrace');
 for(const mesh of asset.root.children.filter(m=>m.material.name.startsWith('modern-glass'))){const normals=mesh.geometry.attributes.normal,positions=mesh.geometry.attributes.position;for(let i=0;i<normals.count;i++)if(Math.abs(positions.getX(i))>asset.size.x/2-.3)assert.ok(Math.abs(normals.getX(i))<1e-7,'no windows face into neighbouring party walls');}
 assert.ok(copies>=2);const homes=root.children.slice(0,copies);assert.ok(homes.every(h=>h.scale.x>=.17&&h.scale.x<=.24&&h.scale.x===h.scale.y&&h.scale.x===h.scale.z));
 for(const home of homes)for(let j=0;j<home.children.length;j++){assert.equal(home.children[j].geometry,asset.root.children[j].geometry);assert.equal(home.children[j].material,asset.root.children[j].material);}
 for(const home of homes){assert.ok(Math.abs(home.position.x)+asset.size.x*home.scale.x/2<=p.lotWidth/2-.019);assert.ok(Math.abs(home.position.z)+asset.size.z*home.scale.z/2<=p.lotDepth/2-.14);}for(let j=1;j<homes.length;j++)assert.ok(Math.abs(homes[j].position.x-homes[j-1].position.x-asset.size.x*homes[j].scale.x)<1e-8,'terrace party walls meet without overlap or side alleys');
 assert.ok(p.entranceXs.length>=copies);for(const x of p.entranceXs)assert.ok(p.accessPoints.some(a=>a.kind==='walk'&&Math.abs(a.x-x)<1e-8));
 const grounds=root.children.find(c=>c.userData.sitePlan);assert.ok(grounds.userData.sitePlan.filter(a=>a.kind==='fence'&&a.axis==='z').length>=p.entranceXs.length-1);
 for(const item of grounds.userData.sitePlan)assert.ok(Math.abs(item.x)+item.w/2<=p.lotWidth/2+.001&&Math.abs(item.z)+item.d/2<=p.lotDepth/2+.001);
 const factory=new BuildingFactory({scene:new THREE.Scene(),landscape:{assets:{}}});factory.rebuild(new Map([[index,root]]));for(const part of asset.root.children){const batch=factory.instanceBatches.find(b=>b.near.geometry===part.geometry);assert.equal(batch.transforms.length,copies,'repeated homes use the same material batch');}
 assert.equal(JSON.stringify(world),before);assert.equal(lib.create(world,index,parcel).userData.homeCopies,copies);
});

test('independent households use shipped models at separate saved parcel positions',async()=>{
 const {district}=await import('./independent-fixture.mjs'),{world,homes}=district(),B=globalThis.BoroughBuildings,lib=await library(),before=JSON.stringify(world),roots=new Map();
 for(const home of homes){const p=B.renderParcel(world,home.id),root=lib.create(world,p.index,p);assert.ok(root?.userData.asset);assert.equal(root.position.x,home.frame.cx);assert.equal(root.position.z,home.frame.cz);assert.equal(root.rotation.y,home.frame.angle);assert.equal(root.userData.plan.entityId,home.id);const box=new THREE.Box3().setFromObject(root);assert.ok(Number.isFinite(box.max.y));roots.set(home.id,root);}
 assert.equal(JSON.stringify(world),before);const factory=new BuildingFactory({scene:new THREE.Scene(),landscape:{assets:{}}});factory.rebuild(roots);assert.ok(factory.instanceBatches.length);const survivor=roots.get(homes[1].id);roots.delete(homes[0].id);factory.rebuild(roots);assert.equal(roots.get(homes[1].id),survivor);assert.ok(factory.instanceBatches.some(b=>b.near.count>0));
});


test('medium-density independent lots select varied shared apartment models deterministically',async()=>{
 const lib=await library(),world=E.createWorld('Apartment variety','plains',8),B=globalThis.BoroughBuildings,models=new Set(),before=JSON.stringify(world);
 for(let i=1;i<=40;i++){const id='parcel-'+i,p={entityId:id,entitySeed:B.seed(id),definition:{type:'residential',density:'medium',building:'apartments',level:1},width:4,depth:4,oriented:{cx:0,cz:0,angle:0,width:6.36,depth:6.36,frontage:{x:0,z:5,roadIndex:1176}}},root=lib.create(world,1176,p),again=lib.create(world,1176,p);assert.equal(root.userData.model,again.userData.model);assert.ok(root.userData.asset);models.add(root.userData.model);const model=lib.models.find(m=>m.name===root.userData.model);assert.ok(!model.floors||model.floors<=9);assert.equal(root.children[0].scale.x,root.children[0].scale.y);}
 assert.ok(models.size>=3,'apartment districts need several distinct full building models');assert.equal(JSON.stringify(world),before);
});

test('narrow and deep apartment parcels keep full-scale architecture inside their actual rotated lots',async()=>{
 const lib=await library(),world=E.createWorld('Apartment dimensions','plains',8),B=globalThis.BoroughBuildings;
 for(const [width,depth]of [[2,2],[3,2],[2,3],[3,3],[4,3],[2,4],[3,4],[4,4],[4,5],[5,5],[6,5],[2,6],[3,6],[4,6],[5,6],[6,6]])for(const angle of [0,.43]){
  const id='parcel-'+(width*10+depth),p={entityId:id,entitySeed:B.seed(id),definition:{type:'residential',density:'medium',building:'apartments',level:1},width,depth,oriented:{cx:0,cz:0,angle,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:8,roadIndex:1176}}},root=lib.create(world,1176,p),model=root.children[0];
  assert.ok(model.scale.x>=.17,`${width}x${depth} must not miniaturize an oversized building`);assert.equal(model.scale.x,model.scale.y);assert.equal(model.scale.x,model.scale.z);
  root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.x>=-p.oriented.width/2&&bounds.max.x<=p.oriented.width/2);assert.ok(bounds.min.z>=-p.oriented.depth/2&&bounds.max.z<=p.oriented.depth/2);
 }
});

test('low-rent zoning selects shared apartment blocks at metre scale rather than luxury towers',async()=>{
 const lib=await library(),world=E.createWorld('Low-rent models','plains',8),names=new Set();
 for(let seed=1;seed<=20;seed++)for(const [width,depth]of [[4,4],[5,4],[4,5],[6,4],[5,5],[6,6]]){
  const p={entityId:'parcel-'+seed,entitySeed:seed,definition:{type:'residential',density:'high',building:'lowrent',level:1},width,depth,oriented:{cx:0,cz:0,angle:.4,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:8,roadIndex:1176}}};
  const root=lib.create(world,1176,p);names.add(root.userData.model);assert.equal(root.userData.model,width>=5&&depth>=5?'lowrent-court-block':'lowrent-staggered-slab');assert.ok(root.children[0].scale.x>=.17);assert.equal(root.children[0].scale.x,root.children[0].scale.y);root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root.children[0]);assert.ok(bounds.min.x>=-p.oriented.width/2&&bounds.max.x<=p.oriented.width/2);assert.ok(bounds.min.z>=-p.oriented.depth/2&&bounds.max.z<=p.oriented.depth/2);
 }
 assert.equal(names.size,2);
});

test('lot surfaces and garden paths share complete materials regardless of the first building category',async()=>{
 const lib=await library(),world=E.createWorld('Surface order','plains',8),index=23*48+8;
 for(const type of ['residential','industrial','office']){delete lib.lotMaterials;delete lib.siteDetails;world.tiles[index]={type,density:type==='residential'?'low':'high',level:1};lib.create(world,index,{width:2,depth:2});
  assert.deepEqual(Object.keys(lib.lotMaterials).sort(),['asphalt','grass','paving']);
  assert.equal(lib.siteDetails.materials.garden,lib.lotMaterials.grass);assert.equal(lib.siteDetails.materials.walk,lib.lotMaterials.paving);assert.equal(lib.siteDetails.materials.plaza,lib.lotMaterials.paving);assert.equal(lib.siteDetails.materials.drive,lib.lotMaterials.asphalt);
  const materials={...lib.lotMaterials};lib.create(world,index,{width:3,depth:4});for(const key of Object.keys(materials))assert.equal(lib.lotMaterials[key],materials[key],'different lot sizes reuse materials');
 }
});

test('compact courtyard apartment has pitched roof wings and an open furnished garden at full and distant detail',async()=>{
 const lib=await library(),model=lib.models.find(m=>m.name==='small-courtyard-apartments');assert.ok(model);
 const roof=model.root.children.find(m=>m.material.name==='modern-roof');assert.ok(roof);const normal=roof.geometry.attributes.normal;let slopes=0;
 for(let i=0;i<normal.count;i++)if(normal.getY(i)>.2&&normal.getY(i)<.95)slopes++;assert.ok(slopes>20);
 model.root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(3+model.origin.x,100,3+model.origin.z),new THREE.Vector3(0,-1,0));
 const hits=ray.intersectObject(model.root,true);assert.ok(hits.length);assert.ok(hits[0].point.y<3,'central garden must not be a filled building volume');
 const bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 assert.equal(roof.geometry.userData.lod.attributes.position,roof.geometry.attributes.position);assert.ok(roof.geometry.userData.lod.index.count<roof.geometry.index.count);assert.ok(model.gardens.length>0);
});

test('smallest apartment lots select different full-scale forms while retaining shared geometry',async()=>{
 const lib=await library(),B=(await import('../dist/building-entities.js')).default,w=E.createWorld('Compact apartments','plains',427),counts=new Map();
 for(let i=1;i<=60;i++){const id='parcel-'+i,p={entityId:id,entitySeed:B.seed(id),definition:{type:'residential',density:'medium',building:'apartments',level:1},width:2,depth:2,oriented:{cx:0,cz:0,angle:0,width:3.16,depth:3.16,frontage:{x:0,z:5,roadIndex:1176}}},root=lib.create(w,1176,p),asset=lib.models.find(m=>m.name===root.userData.model);
 counts.set(asset.name,(counts.get(asset.name)||0)+1);assert.equal(root.children[0].scale.x,.2);assert.equal(root.children[0].children[0].geometry,asset.root.children[0].geometry);
 const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.max.x-bounds.min.x<=3.16+.001);assert.ok(bounds.max.z-bounds.min.z<=3.16+.001);assert.equal(lib.create(w,1176,p).userData.model,asset.name);
 }
 assert.ok(counts.get('brick-neighborhood-walkup')>=15);assert.ok(counts.get('compact-hipped-apartments')>=15);
});

test('framed apartment windows keep recessed glass and sash profiles at full and distant detail',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 for(const name of ['compact-hipped-apartments','brick-neighborhood-walkup','small-courtyard-apartments','narrow-balcony-apartments','linear-balcony-apartments','stepped-midrise-apartments','neighborhood-mixed-use','perimeter-mixed-use']){
  const model=lib.models.find(m=>m.name===name),panes=[];
  for(const mesh of model.root.children.filter(m=>m.material.name==='modern-glass'||m.material.name==='modern-glass-occupied')){
   const pos=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
   for(let i=0;i<pos.count;i+=4){if(normal.getZ(i)<.99)continue;const xs=[0,1,2,3].map(j=>pos.getX(i+j)),ys=[0,1,2,3].map(j=>pos.getY(i+j)),lo=Math.min(...ys),hi=Math.max(...ys),left=Math.min(...xs),right=Math.max(...xs);if(lo>3.5&&hi-lo>1.8&&right-left>1)panes.push({lo,hi,left,right,z:pos.getZ(i)});}
  }
  assert.ok(panes.length,name+' has upper-floor windows');model.root.updateMatrixWorld(true);
  const hit=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,100),new THREE.Vector3(0,0,-1)).intersectObject(model.root,true)[0];
  const check=()=>panes.some(p=>{const x=(p.left+p.right)/2,y=p.lo+(p.hi-p.lo)*.3,glass=hit(x+(p.right-p.left)*.25,y),frame=hit(p.left,y),sash=hit(x,y);return glass?.object.material.name.startsWith('modern-glass')&&Math.abs(glass.point.z-p.z)<.002&&frame?.object.material.name==='modern-painted'&&sash?.object.material.name==='modern-painted'&&frame.point.z-glass.point.z>.20&&sash.point.z-glass.point.z>.07;});
  const railing=()=>{if(name!=='narrow-balcony-apartments')return;const post=hit(2.55+model.origin.x,3.65+model.origin.y),gap=hit(2.125+model.origin.x,3.65+model.origin.y);assert.equal(post?.object.material.name,'modern-frame');assert.equal(gap?.object.material.name,'modern-painted');assert.ok(post.point.z-gap.point.z>.9,'open railing gaps expose the wall behind the balcony');};
  assert.ok(check(),name+' has actual frame and glass depth, not a painted rectangle');railing();
  for(const mesh of model.root.children){assert.equal(mesh.geometry.userData.lod.attributes.position,mesh.geometry.attributes.position);mesh.geometry=mesh.geometry.userData.lod;}
  assert.ok(check(),name+' retains its window profile in distant geometry');railing();
 }
});

test('rebuilt midrise balconies have usable doors and open rails at full and distant detail',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));
 lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 for(const [name,centre,front]of [['linear-balcony-apartments',4.152,6.675],['stepped-midrise-apartments',2.22,8.125]]){
  const model=lib.models.find(m=>m.name===name);model.root.updateMatrixWorld(true);
  assert.ok(model.streetFronts.length>0);assert.ok(model.streetFronts.every(p=>p.position[1]<.2),'balcony doors must not become street entrances');
  assert.ok(model.root.children.some(p=>p.material.name==='modern-brick'),'masonry is textured geometry');
  const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x+model.origin.x,y+model.origin.y,100),new THREE.Vector3(0,0,-1)).intersectObject(model.root,true)[0];
  const check=()=>{
   const post=ray(centre,3.9),through=ray(centre+.2,3.9),door=ray(centre+.2,3.55);
   assert.equal(post.object.material.name,'modern-frame');assert.ok(Math.abs(post.point.z-(front+model.origin.z))<.002);
   assert.ok(through.object.material.name.startsWith('modern-glass'),'rail gaps reveal the balcony door');assert.ok(post.point.z-through.point.z>1);
   assert.ok(door.object.material.name.startsWith('modern-glass'),'door opening reaches the balcony deck instead of stopping at a window sill');
  };
  check();for(const mesh of model.root.children)mesh.geometry=mesh.geometry.userData.lod;check();
 }
});

test('suburban roof forms have open dormers, recessed attic windows and unlit solar panels at both distances',async()=>{
 const lib=await library(),bytes=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 for(const [name,gambrel,w,d,y]of [['compact-brick-dormer-home',false,6.4,9.2,5.7],['gambrel-garden-home',true,7.6,10.2,2.85]]){
  const model=lib.models.find(m=>m.name===name);assert.ok(model);assert.equal(model.houseForm,'detached');assert.equal(model.roofForm,gambrel?'gambrel':'cross-ridge-gable');model.root.updateMatrixWorld(true);
  const D=d+.6,front=D*(gambrel?.43:.36),back=D*(gambrel?.34:.11),z=(front+back)/2;
  const ray=(x,h,z,direction,root=model.root)=>new THREE.Raycaster(new THREE.Vector3(x+model.origin.x,h+model.origin.y,z+model.origin.z),direction).intersectObject(root,true);
  const down=(x,z,root=model.root)=>ray(x,50,z,new THREE.Vector3(0,-1,0),root);
  const check=()=>{
   const roof=model.root.children.find(m=>m.material.name==='modern-roof');
   assert.equal(down(.5,z,roof).length,0,name+' roof is cut away underneath the dormer');assert.ok(down(2.4,z,roof).length,name+' roof remains alongside the dormer');
   const glass=model.root.children.find(m=>m.material.name==='modern-glass-occupied'),p=glass.geometry.attributes.position,n=glass.geometry.attributes.normal;let high=-Infinity,low=0;
   for(let i=0;i<p.count;i+=4)if(n.getZ(i)>.99&&p.getY(i+2)>high){low=p.getY(i)-model.origin.y;high=p.getY(i+2)-model.origin.y;}
   const face=ray(.5,(low+high)/2,20,new THREE.Vector3(0,0,-1))[0];assert.equal(face.object.material.name,'modern-glass-occupied');assert.ok(Math.abs(face.point.z-model.origin.z-(front-.12))<1e-5,'dormer glass is visible and recessed');
   const atticY=y+(gambrel?1.45:.58),attic=ray(20,atticY,.3,new THREE.Vector3(-1,0,0))[0];assert.equal(attic.object.material.name,'modern-glass-occupied');assert.ok(Math.abs(attic.point.x-model.origin.x-(w/2-.16))<1e-5,'brick gable has a real window opening');
   const solar=down(-.7,-1.25)[0];assert.equal(solar.object.material.name,'modern-frame');assert.ok(!solar.object.material.userData.roomLighting,'solar panels never use glowing window materials');
   if(gambrel){const lower=down(2.6,4.8,roof)[0],upper=down(2.6,1.5,roof)[0];assert.ok(upper.face.normal.y-lower.face.normal.y>.3,'gambrel keeps a steep lower pitch and shallow upper pitch');}
  };
  check();for(const mesh of model.root.children)mesh.geometry=mesh.geometry.userData.lod;check();
 }
});

test('both new suburban houses occur in normal zoning at full scale and survive save round trips',async()=>{
 const lib=await library(),w=E.createWorld('Suburban variety','plains',431),wanted=new Set(['compact-brick-dormer-home','gambrel-garden-home']),found=new Set();w.tiles.forEach(t=>Object.assign(t,{type:null,level:0}));
 for(let k=0;k<160;k++){
  const index=(10+Math.floor(k/20))*48+8+k%20;Object.assign(w.tiles[index],{type:'residential',density:'low',building:'cottage',level:k%3+1});const root=lib.create(w,index),asset=lib.models.find(m=>m.name===root.userData.model);if(!wanted.has(asset.name))continue;found.add(asset.name);
  assert.ok(root.children[0].scale.x>=.17);assert.equal(root.userData.homeCopies,1);assert.ok(root.userData.plan.entranceXs.length>0);
  const saved=JSON.stringify(w),restored=JSON.parse(saved);assert.ok(E.valid(restored));const again=lib.create(restored,index);assert.equal(again.userData.model,asset.name);assert.equal(JSON.stringify(w),saved);
 }
 assert.deepEqual(found,wanted);
});

 test('low office zoning selects original small buildings at metre scale and high offices keep towers',async()=>{
 const lib=await library(),world=E.createWorld('Office forms','plains',324),names=new Set(),offices=lib.models.filter(m=>m.building==='localoffice');assert.equal(offices.length,2);
 for(const asset of offices){assert.ok(asset.floors>=2&&asset.floors<=3);assert.ok(asset.size.y<13);assert.ok(asset.streetFronts.some(f=>f.kind==='entrance'));assert.ok(asset.root.children.reduce((n,m)=>n+m.geometry.index.count/3,0)<1000);}
 for(const [width,depth]of [[2,2],[3,2],[3,3],[4,6]])for(let seed=1;seed<=20;seed++){
  const p={entityId:'parcel-'+seed,entitySeed:seed,definition:{type:'office',density:'low',building:'localoffice',level:5},width,depth,oriented:{cx:0,cz:0,angle:seed*.19,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:8,roadIndex:1176}}},root=lib.create(world,1176,p),asset=lib.models.find(m=>m.name===root.userData.model),model=root.children[0];names.add(asset.name);
  assert.equal(asset.building,'localoffice');assert.ok(root.userData.plan.floors<=3);assert.ok(model.scale.x>=.17);assert.equal(model.scale.x,model.scale.y);assert.equal(model.scale.y,model.scale.z);
  root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.x>=-p.oriented.width/2&&bounds.max.x<=p.oriented.width/2);assert.ok(bounds.min.z>=-p.oriented.depth/2&&bounds.max.z<=p.oriented.depth/2);
  p.definition={type:'office',density:'high',building:'glass',level:5};const high=lib.create(world,1176,p);assert.ok(lib.models.find(m=>m.name===high.userData.model).floors>=5);
 }
 assert.equal(names.size,2,'both small office forms appear in normal lot selection');
 });
