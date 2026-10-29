import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {SiteDetails} from '../dist/site-details.js';
import {sitePlan} from '../dist/site-plan.js';
import {BuildingFactory} from '../dist/building-factory.js';
import fs from 'node:fs';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';

const overlap=(a,b)=>Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2)>1e-7&&Math.min(a.z+a.d/2,b.z+b.d/2)-Math.max(a.z-a.d/2,b.z-b.d/2)>1e-7;
const footprint={minX:-1.4,maxX:1.4,minZ:.8,maxZ:3.1};
const base={type:'residential',density:'low',low:true,lotWidth:6.36,lotDepth:9.56,entranceXs:[-.55,.8]};

test('private gardens reserve clear entrance and driveway routes for varied saved properties',()=>{
 const styles=new Set(),features=new Set();
 for(let seed=0;seed<80;seed++){
  const p={...base,seed},items=sitePlan(p,footprint),paths=items.filter(a=>['walk','drive'].includes(a.kind));
  const building={x:0,z:1.95,w:2.8,d:2.3};
  for(const a of items){
   assert.ok(Math.abs(a.x)+a.w/2<=p.lotWidth/2+1e-7,a.kind+' stays in property width');
   assert.ok(Math.abs(a.z)+a.d/2<=p.lotDepth/2+1e-7,a.kind+' stays in property depth');
   assert.ok(!overlap(a,building),a.kind+' cannot intersect the home');features.add(a.kind);if(a.style)styles.add(a.style);
   if(['fence','shed','pergola','tree','shrub'].includes(a.kind))for(const path of paths)assert.ok(!overlap(a,path),a.kind+' leaves access clear');
  }
  assert.equal(paths.filter(a=>a.kind==='walk'&&a.z+a.d/2>=p.lotDepth/2-.1).length,2);
  assert.deepEqual(sitePlan(JSON.parse(JSON.stringify(p)),footprint),items);
 }
 for(const feature of ['shed','pergola','shrub','tree'])assert.ok(features.has(feature));
 assert.deepEqual([...styles].sort(),['hedge','picket','privacy']);
});

test('row gardens keep separate rear properties while tiny yards omit oversized furniture',()=>{
 const p={...base,rowDividers:[-1,1],entranceXs:[-2,0,2],seed:17},items=sitePlan(p,footprint);
 for(const x of p.rowDividers)assert.ok(items.some(a=>a.kind==='fence'&&a.axis==='z'&&Math.abs(a.x-x)<1e-8));
 for(const a of items.filter(a=>['shed','pergola'].includes(a.kind)))for(const x of p.rowDividers)assert.ok(a.x+a.w/2<x||a.x-a.w/2>x,'garden furniture cannot span two homes');
 const tiny=sitePlan({...base,lotWidth:1.56,lotDepth:3.16,entranceXs:[0]},{minX:-.6,maxX:.6,minZ:-1,maxZ:1.2});
 assert.ok(!tiny.some(a=>['shed','pergola'].includes(a.kind)));
 const tight={minX:-base.lotWidth/2+.02,maxX:base.lotWidth/2-.02,minZ:1,maxZ:4.3},building={x:0,z:2.65,w:base.lotWidth-.04,d:3.3};
 for(const a of sitePlan(p,tight).filter(a=>a.kind==='fence'))assert.ok(!overlap(a,building),'side fences cannot cut through a terrace that reaches its property edge');
});

test('whole garden models stay inside rotated properties and share buffers across districts',()=>{
 const details=new SiteDetails({}),factory=new BuildingFactory({scene:new THREE.Scene()}),roots=new Map(),buffers=new Set(),materials=new Set();
 let disposed=0,triangles=0;
 for(let i=0;i<60;i++){
  const root=details.build({...base,seed:i},footprint),local=new THREE.Box3().setFromObject(root);
  assert.ok(local.min.x>=-base.lotWidth/2&&local.max.x<=base.lotWidth/2);
  assert.ok(local.min.z>=-base.lotDepth/2&&local.max.z<=base.lotDepth/2);
  root.traverse(o=>{if(!o.isMesh)return;buffers.add(o.geometry);materials.add(o.material);assert.ok(o.userData.sharedAsset);triangles+=o.geometry.index.count/3;for(const name of ['position','normal'])assert.ok([...o.geometry.attributes[name].array].every(Number.isFinite));});
  root.rotation.y=i*.31;root.position.set(i*12,0,i%3*14);root.userData={...root.userData,asset:true,factory:true,renderImmutable:true};roots.set(i,root);
 }
 assert.ok(buffers.size<=15,'the district uses a bounded shared prop catalogue');assert.ok(materials.size<=10);assert.ok(triangles/60<16000,'garden geometry remains bounded per property');
 factory.rebuild(roots);const batches=factory.instanceBatches.length;assert.ok(batches<=18);
 for(const g of buffers)g.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<30;i++)roots.delete(i);factory.rebuild(roots);assert.equal(factory.instanceBatches.length,batches,'demolition reuses the same remaining prop batches');factory.rebuild(new Map());assert.equal(disposed,0);
});

test('privacy screens have real plank geometry and hedges join without seams',()=>{
 const details=new SiteDetails({});details.build({...base,seed:6},footprint);const props=details.gardenProps;
 for(const kind of ['privacy','picket','shed','pergola','hedge','shrub']){
  const a=props.model(kind),b=props.model(kind);assert.equal(a,b);assert.ok(a.children.length>0);
  a.traverse(o=>{if(o.isMesh){assert.ok(o.castShadow&&o.receiveShadow);assert.equal(o.userData.gardenProp,kind);}});
 }
 const privacy=props.model('privacy');assert.ok(privacy.children[0].geometry.index.count/3>150,'individual planks and rails retain volume');
 const g=props.model('hedge').children[0].geometry,p=g.attributes.position;
 const ends=sign=>Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(p.getX(i)-sign*.5)<1e-7).map(i=>[p.getY(i),p.getZ(i)]);
 assert.deepEqual(ends(-1),ends(1),'adjacent hedge panels meet with the same full profile');
 assert.ok(g.index.count/3<180,'continuous hedge uses bounded geometry');
 const shrub=props.model('shrub');assert.equal(shrub.children.length,1,'leaf blades share the existing foliage draw');assert.ok(shrub.children[0].geometry.index.count/3<=600,'detailed shrubs retain a bounded shared geometry cost');
});

test('ordinary roadside growth and save reload retain complete gardens without editing residents or lots',async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});
 const bytes=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url));lib.ingest((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 const w=E.createWorld('Private garden growth','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');E.buildRoadPath(w,[{x:19,y:24},{x:38,y:24}]);E.buildRoadPath(w,[{x:38,y:24},{x:42,y:12},{x:25,y:12}]);
 E.fineZoneCells(w,[...E.fineZoningLayout(w).values()].filter(c=>c.row<6).map(c=>c.id),'residential_low');for(let i=0;i<140;i++)E.tick(w);
 const snapshot=world=>Object.values(world.development.parcels).filter(p=>p.occupant&&!p.occupant.construction).map(p=>{
  const parcel=B.renderParcel(world,p.id),root=lib.create(world,parcel.index,parcel),grounds=root.children.find(c=>c.userData.sitePlan);
  const bounds=new THREE.Box3().setFromObject(grounds);assert.ok(bounds.min.x>=-p.frame.width/2&&bounds.max.x<=p.frame.width/2);assert.ok(bounds.min.z>=-p.frame.depth/2&&bounds.max.z<=p.frame.depth/2);
  assert.equal(root.rotation.y,p.frame.angle);return{id:p.id,model:root.userData.model,grounds:grounds.userData.sitePlan,access:root.userData.plan.accessPoints};
 });
 const saved=JSON.stringify(w),before=snapshot(w);assert.equal(JSON.stringify(w),saved);assert.ok(before.length>=12);
 assert.ok(before.some(p=>p.grounds.some(a=>a.kind==='shed')));assert.ok(before.some(p=>p.grounds.some(a=>a.kind==='pergola')));
 const storage={data:null,getItem(){return this.data;},setItem(k,v){this.data=v;}},store=new E.WorldStore(storage);store.save(w,1234);const restored=new E.WorldStore(storage).get(w.id);
 assert.deepEqual(restored.development,w.development);assert.deepEqual(snapshot(restored),before);assert.equal(E.analyze(restored).population,E.analyze(w).population);assert.ok(E.valid(restored));
});
