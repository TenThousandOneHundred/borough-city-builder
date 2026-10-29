import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';
const names=['raised-stoop-brick-terrace','dormer-roof-brick-terrace'];
let loading;
function library(){return loading ||= (async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});
 for(const file of ['urban','industry','modern']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);}
 const lod=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),lod.buffer.slice(lod.byteOffset,lod.byteOffset+lod.byteLength));return lib;
})();}

test('street terraces retain visible recessed windows, entrances, party walls and distinct roofs at both detail levels',async()=>{
 const lib=await library();for(const name of names){const a=lib.models.find(m=>m.name===name),root=a.root.clone(true);root.updateMatrixWorld(true);const base=name===names[0]?1:.12,h=base+8.85;
  const ray=(x,y,z,dir)=>new THREE.Raycaster(new THREE.Vector3(x+a.origin.x,y+a.origin.y,z+a.origin.z),dir).intersectObject(root,true)[0],front=(x,y)=>ray(x,y,30,new THREE.Vector3(0,0,-1)),down=(x,z)=>ray(x,100,z,new THREE.Vector3(0,-1,0));
  const check=()=>{
   for(let f=0;f<3;f++){const hit=front(.25,base+f*2.95+1.3);assert.ok(hit.object.material.name.startsWith('modern-glass'));assert.ok(hit.point.z-a.origin.z<5.85,'window lies behind its masonry face');}
   const entry=a.streetFronts.find(e=>e.kind==='entrance'&&e.normal[1]===1);assert.ok(entry);assert.ok(['modern-wood','modern-painted'].includes(front(entry.position[0]+.1,base+1.3).object.material.name),'entrance is not hidden behind a solid wall');
   assert.equal(ray(30,2,0,new THREE.Vector3(-1,0,0)).object.material.name,'modern-brick','attached side is a solid party wall');
   if(name===names[0]){assert.ok(Math.abs(down(0,1).point.y-a.origin.y-h)<.002,'flat roof stays below its parapet');assert.ok(down(-7.6/3,6.2).point.y-a.origin.y>.9,'stoop reaches the raised door');}
   else{assert.ok(down(2.3,0).point.y-a.origin.y>h+2.3,'ridge runs parallel to the street');assert.ok(Math.abs(down(2.3,4).point.y-a.origin.y-h-3.7*(1-4/6.24))<.03,'the steeper roof slopes toward the street at its authored pitch');assert.ok(front(.3,h+1.9).object.material.name.startsWith('modern-glass'),'dormer has an actual opening in the roof');}
  };check();const brick=root.children.find(m=>m.material.name==='modern-brick'),positions=brick.geometry.attributes.position,normals=brick.geometry.attributes.normal,uv=brick.geometry.attributes.uv;for(let i=0;i<8;i++){assert.ok(Math.abs(normals.getX(i))>.99);assert.ok(Math.abs(uv.getX(i)-(positions.getZ(i)-a.origin.z)/2)<1e-5);assert.ok(Math.abs(uv.getY(i)-(positions.getY(i)-a.origin.y)/2)<1e-5,'party-wall courses run horizontally');}const near=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);for(const m of root.children)m.geometry=m.geometry.userData.lod;check();const far=root.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
  assert.ok(a.size.x<=7.601,'no side eaves or trim prevent wall-to-wall placement');assert.ok(near<2300);assert.ok(far<near*.70);assert.ok(root.children.length<=8);
 }
});

test('ordinary row zoning chooses the new forms as attached homes across saved multi-cell lots',async()=>{
 const lib=await library(),w=E.createWorld('Terrace growth','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');E.buildRoadPath(w,[{x:19,y:24},{x:38,y:24}]);
 const grid=E.fineZoningLayout(w);E.fineZoneCells(w,[...grid.values()].filter(c=>c.row<4).map(c=>c.id),'residential_row');for(let i=0;i<140;i++)E.tick(w);
 const lots=Object.values(w.development.parcels).filter(p=>p.occupant&&!p.occupant.construction),saved=JSON.stringify(w),seen=new Set();assert.ok(lots.length>=12);assert.ok(lots.every(p=>p.cells.length>1));
 for(const p of lots){const parcel=B.renderParcel(w,p.id),root=lib.create(w,parcel.index,parcel);seen.add(root.userData.model);const a=lib.models.find(m=>m.name===root.userData.model),copies=root.children.filter(c=>c.name===a.name);assert.ok(copies.length>=1);assert.ok(root.userData.plan.rowEntrances.length>=copies.length);assert.equal(root.rotation.y,p.frame.angle);for(const m of copies){assert.equal(m.scale.x,m.scale.y);assert.equal(m.scale.x,m.scale.z);assert.ok(m.scale.x>=.17);}
  for(let i=1;i<copies.length;i++){assert.ok(Math.abs(copies[i].position.x-copies[i-1].position.x-a.size.x*copies[i].scale.x)<1e-6,'party walls join without stretching individual homes');const boundary=(copies[i].position.x+copies[i-1].position.x)/2;assert.equal(root.userData.plan.rowDividers[i-1],boundary,'gardens divide at the shared wall, not the offset front door');const grounds=root.children.find(c=>c.userData.sitePlan);assert.ok(grounds.userData.sitePlan.some(p=>p.kind==='fence'&&p.axis==='z'&&Math.abs(p.x-boundary)<1e-6),'each shared wall continues into a private garden divider');}
 }
 for(const name of names)assert.ok(seen.has(name),name+' grows naturally');assert.ok(seen.size>=4,'older terrace styles remain available');assert.equal(JSON.stringify(w),saved,'model selection never edits the city');
 const storage={data:null,getItem(){return this.data;},setItem(k,v){this.data=v;}},store=new E.WorldStore(storage);store.save(w,1234);const restored=new E.WorldStore(storage).get(w.id);assert.ok(E.valid(restored));assert.deepEqual(restored.development,w.development);
 for(const p of lots){const before=B.renderParcel(w,p.id),after=B.renderParcel(restored,p.id);assert.equal(lib.create(w,before.index,before).userData.model,lib.create(restored,after.index,after).userData.model);}
});

test('terrace models fit small and rotated row lots without changing their saved footprint',async()=>{
 const lib=await library(),w=E.createWorld('Terrace fit','plains',9),seen=new Set();for(let seed=0;seed<30;seed++)for(const [width,depth]of [[1,2],[2,3],[3,3],[4,4],[6,6]]){
  const id='row-fit-'+seed,parcel={entityId:id,entitySeed:B.seed(id),definition:{type:'residential',building:'townhouse',density:'medium',level:2},width,depth,oriented:{cx:0,cz:0,angle:.73,width:width*1.6-.04,depth:depth*1.6-.04,frontage:{x:0,z:6,roadIndex:1176}}};
  const saved=JSON.stringify(parcel),root=lib.create(w,1176,parcel),a=lib.models.find(m=>m.name===root.userData.model);seen.add(a.name);root.rotation.y=0;root.position.set(0,0,0);root.updateMatrixWorld(true);
  for(const home of root.children.filter(c=>c.name===a.name)){const box=new THREE.Box3().setFromObject(home);assert.ok(box.min.x>=-parcel.oriented.width/2&&box.max.x<=parcel.oriented.width/2);assert.ok(box.min.z>=-parcel.oriented.depth/2&&box.max.z<=parcel.oriented.depth/2);}
  assert.equal(JSON.stringify(parcel),saved);
 }for(const name of names)assert.ok(seen.has(name));
});

test('adding street terraces leaves all 61 previous authored buildings byte-identical',()=>{
 const b=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url)),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length)),start=28+length,expected=JSON.parse(fs.readFileSync(new URL('./fixtures/unmodified-models-113.json',import.meta.url))),actual={};
 for(const node of doc.nodes){if(node.name.startsWith('industrial-')||names.includes(node.name))continue;const hash=createHash('sha256');hash.update(JSON.stringify(Object.fromEntries(Object.entries(node.extras).sort(([a],[b])=>a.localeCompare(b)))));for(const p of doc.meshes[node.mesh].primitives){hash.update(String(p.material));for(const [key,index]of Object.entries({...p.attributes,indices:p.indices}).sort(([a],[b])=>a<b?-1:a>b?1:0)){hash.update(key);const v=doc.bufferViews[doc.accessors[index].bufferView],offset=start+(v.byteOffset||0);hash.update(b.subarray(offset,offset+v.byteLength));}}actual[node.name]=hash.digest('hex');}
 assert.equal(doc.nodes.length,68);assert.equal(Object.keys(actual).length,61);assert.deepEqual(actual,expected);
});

test('rebuilt street fronts have slender sash openings and projecting entrance surrounds without sealing glass',async()=>{
 const lib=await library();for(const name of names){const a=lib.models.find(m=>m.name===name),root=a.root.clone(true),base=name===names[0]?1:.12;root.updateMatrixWorld(true);
  const front=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x+a.origin.x,y+a.origin.y,30),new THREE.Vector3(0,0,-1)).intersectObject(root,true)[0];
  const check=()=>{for(let f=0;f<3;f++){
   for(const dy of [.66,1.5,2.25]){const hit=front(.3,base+f*2.95+dy);assert.ok(hit.object.material.name.startsWith('modern-glass'),'tall sash remains open');assert.ok(Math.abs(hit.point.z-a.origin.z-5.8)<.002);}
   assert.equal(front(.8,base+f*2.95+1.3).object.material.name,'modern-brick','narrower windows leave real masonry piers');
  }
  const door=a.streetFronts.find(p=>p.kind==='entrance'&&p.normal[1]>0),head=front(door.position[0],base+2.76);assert.equal(head.object.material.name,'modern-concrete');assert.ok(head.point.z-a.origin.z>6.3,'entrance cornice projects beyond the wall');
  };check();for(const m of root.children)m.geometry=m.geometry.userData.lod;check();
 }
});

test('raised stoops reserve individual street gardens and connected paths without moving saved parcels',async()=>{
 const lib=await library(),models=lib.models,w=E.createWorld('Stoop gardens','plains',8),plots={};
 try{for(const name of names){lib.models=models.filter(m=>m.name===name);const parcel={entityId:'garden-fit',entitySeed:B.seed('garden-fit'),definition:{type:'residential',building:'townhouse',density:'medium',level:2},width:4,depth:4,oriented:{cx:0,cz:0,angle:.73,width:6.36,depth:6.36,frontage:{x:0,z:6,roadIndex:1176}}},saved=JSON.stringify(parcel),root=lib.create(w,1176,parcel),p=root.userData.plan,grounds=root.children.find(c=>c.userData.sitePlan),items=grounds.userData.sitePlan;
  const paths=items.filter(a=>a.kind==='walk'&&a.z+a.d/2>=p.lotDepth/2-.10),gardens=items.filter(a=>a.kind==='garden'&&a.z+a.d/2>=p.lotDepth/2-.10);plots[name]={paths,gardens};if(name===names[0]){const front=Math.min(...gardens.map(g=>g.z-g.d/2));assert.ok(!items.some(a=>a.kind==='tree'&&a.z>=front),'low planting keeps street windows visible');assert.ok(items.some(a=>a.kind==='shrub'&&a.z>=front),'front lawns retain planting');for(const a of items.filter(a=>a.kind==='shrub'&&a.z>=front))assert.ok(a.height<=.31,'street shrubs stay below ground-floor windows');}
  assert.equal(paths.length,p.rowEntrances.length,'every home has an independent route to the sidewalk');
  for(const path of paths)for(const a of items.filter(a=>['fence','shrub','tree','shed'].includes(a.kind)))assert.ok(Math.abs(a.x-path.x)>=(a.w+path.w)/2-1e-7||Math.abs(a.z-path.z)>=(a.d+path.d)/2-1e-7,'planting and boundaries leave entrance routes clear');
  root.rotation.y=0;root.position.set(0,0,0);const bounds=new THREE.Box3();for(const child of root.children)if(child.name===name||child.userData.sitePlan)bounds.expandByObject(child);assert.ok(bounds.min.x>=-p.lotWidth/2-.001&&bounds.max.x<=p.lotWidth/2+.001);assert.ok(bounds.min.z>=-p.lotDepth/2-.001&&bounds.max.z<=p.lotDepth/2+.001);assert.equal(JSON.stringify(parcel),saved);
 }}finally{lib.models=models;}
 assert.ok(plots[names[0]].gardens.length>=3,'raised homes have several usable front lawns');assert.ok(plots[names[0]].gardens.every(g=>g.d>.7),'front lawns have real depth');assert.ok(plots[names[1]].paths.every(p=>p.d<.3),'street dormers retain their close sidewalk frontage');
});
