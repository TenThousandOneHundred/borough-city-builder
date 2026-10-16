import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {terrainField} from '../dist/terrain-field.js';
import {groundHeight} from '../dist/landscape.js';
import {footprint,buildUrban} from '../dist/city-architecture.js';
import {MeshBuilder} from '../dist/mesh-builder.js';
test('concave and curved floor plates stay bounded and triangulate without filling courtyards',()=>{
 for(const kind of ['L','U','ellipse','round','chamfer']){
  const p=footprint(kind,8,12),v=p.map(x=>new THREE.Vector2(...x));assert.ok(p.every(([x,z])=>Math.abs(x)<=4.001&&Math.abs(z)<=6.001));
  const area=Math.abs(THREE.ShapeUtils.area(v));const triangles=THREE.ShapeUtils.triangulateShape(v,[]);let total=0;
  for(const t of triangles)total+=Math.abs(THREE.ShapeUtils.area(t.map(i=>v[i])));
  assert.ok(Math.abs(total-area)<.0001);if(kind==='U'||kind==='L')assert.ok(area<8*12*.8);
 }
});
test('urban roofs face skyward across every concave and curved family',()=>{
 const mats=new Map(),m=name=>{if(!mats.has(name))mats.set(name,new THREE.MeshStandardMaterial());return mats.get(name);};
 for(let style=0;style<6;style++){
  const b=new MeshBuilder();buildUrban(b,{lotWidth:8,lotDepth:12,style,type:'office',floors:13,seed:84,night:false},m);
  const root=b.finish();for(const mesh of root.children){assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));if(mesh.material===m('roof')){const n=mesh.geometry.attributes.normal;for(let j=0;j<n.count;j++)assert.ok(n.getY(j)>=-.001,'roof cap cannot face down');}}
 }
});
test('eroded terrain is finite, reproducible, distinct by seed, and keeps the editable valley intact',()=>{
 const a=terrainField(427),b=terrainField(428);assert.equal(terrainField(427),a);assert.ok(a.heights.every(Number.isFinite));assert.notEqual(a.sample(225,341),b.sample(225,341));
 for(let x=-96;x<=96;x+=12)for(let z=-96;z<=96;z+=12){const w={seed:427,terrain:'flat'};assert.ok(groundHeight(w,x,z)>=.35&&groundHeight(w,x,z)<3);}
 for(let x=-450;x<450;x+=50)assert.ok(Math.abs(a.sample(x+.001,222)-a.sample(x,222))<.01);
 assert.ok(Math.max(...a.heights)>50);
});

test('version-one saved landforms create usable inland terraces while preserving legacy heights and the starter road',async()=>{
 const {default:E}=await import('../dist/engine.js');
 for(const terrain of ['river','islands','plains']){
  const w=E.createWorld('New landform',terrain,427);w.landformVersion=1;const legacy=structuredClone(w);delete legacy.landformVersion;let raised=0;
  for(let x=-90;x<=90;x+=6)for(let z=-90;z<=90;z+=6){const h=groundHeight(w,x,z),old=groundHeight(legacy,x,z);assert.ok(Number.isFinite(h));assert.ok(h>=old-1e-9);if(h>old+1)raised++;assert.ok(Math.abs(groundHeight(w,x+.001,z)-h)<.005);}
  assert.ok(raised>100,terrain+' contains real inland relief');
  for(let x=-94;x<-16;x+=4)assert.equal(groundHeight(w,x,2),groundHeight(legacy,x,2),'outside road remains unchanged');
  assert.equal(groundHeight(w,0,0),groundHeight(legacy,0,0),'starter valley stays flat');
  const copy=JSON.parse(JSON.stringify(w));assert.equal(groundHeight(copy,-70,60),groundHeight(w,-70,60));assert.ok(E.valid(copy));copy.landformVersion=3;assert.equal(E.valid(copy),false);
 }
});

test('retaining walls meet sampled ground and stay inside the owned lot at road angles',async()=>{
 const {lotFoundation,lotPerimeter}=await import('../dist/lot-foundation.js');
 for(const angle of [0,.3,Math.PI/4,Math.PI/2]){
  const plan={parcelWidth:12,parcelDepth:8,cx:10,cz:12,angle},height=(w,x,z)=>2+x*.12+z*.04,base=Math.max(...lotPerimeter(plan).map(p=>height(null,plan.cx+p.x,plan.cz+p.z)))+.04;
  const geometry=lotFoundation({},plan,base,height),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.rotation.y=-angle;const root=new THREE.Group();root.rotation.y=angle;root.position.set(plan.cx,base,plan.cz);root.add(mesh);root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.x>plan.cx-6&&bounds.max.x<plan.cx+6);assert.ok(bounds.min.z>plan.cz-4&&bounds.max.z<plan.cz+4);
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert.ok(Math.abs(v.y-(base-.025))<1e-5||Math.abs(v.y-(height({},v.x,v.z)-.08))<1e-5,'wall reaches ground or flat lot surface');}
  assert.ok([...p.array].every(Number.isFinite));
 }
});

test('trees occupy supported ground and reject steep slopes in every direction',async()=>{
 const {supportsTree}=await import('../dist/tree-placement.js'),w={seed:40};
 for(let a=0;a<Math.PI*2;a+=.2){const slope=m=>(world,x,z)=>x*Math.cos(a)*m+z*Math.sin(a)*m;assert.ok(supportsTree(w,17,-22,slope(.69)));assert.equal(supportsTree(w,17,-22,slope(.71)),false);}
 assert.ok(supportsTree(w,0,0,()=>2));assert.equal(supportsTree(w,0,0,()=>NaN),false);assert.deepEqual(w,{seed:40});
});


test('water-bed textures encode the rendered terrain without resampling or mutating its geometry',async()=>{
 const {waterHeightTexture,writeWaterHeights}=await import('../dist/water-depth.js');
 const g=new THREE.PlaneGeometry(8,8,8,8);g.rotateX(-Math.PI/2);const p=g.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,p.getX(i)*.23+p.getZ(i)*.51-.2);
 const before=p.array.slice(),texture=waterHeightTexture(g),data=texture.image.data;
 assert.equal(texture.image.width,9);assert.equal(texture.image.height,9);assert.equal(data.length,81*4);
 for(let i=0;i<p.count;i++)assert.ok(Math.abs(data[i*4]+data[i*4+1]/256-64-p.getY(i))<=1/512);
 assert.deepEqual(p.array,before);assert.equal(writeWaterHeights(g,data),data,'brush updates reuse the same byte buffer');
 assert.equal(texture.generateMipmaps,false);texture.dispose();g.dispose();
});
test('sculpted shoreline refreshes the actual shader texture and water resources dispose together',async()=>{
 const {reflectedWater}=await import('../dist/water.js');
 const ground=new THREE.PlaneGeometry(192,192,2,2),far=new THREE.PlaneGeometry(1100,1100,2,2);ground.rotateX(-Math.PI/2);far.rotateX(-Math.PI/2);
 const water=reflectedWater({reflectionsEnabled:false},ground,far),near=water.material.uniforms.nearHeight.value,distant=water.material.uniforms.farHeight.value;
 const previous=near.image.data.slice(),version=near.version;ground.attributes.position.setY(4,-3);water.userData.refreshDepth(ground);
 assert.notDeepEqual(near.image.data,previous);assert.ok(near.version>version);assert.equal(near.image.data[16]+near.image.data[17]/256-64,-3);
 let disposed=0;near.addEventListener('dispose',()=>disposed++);distant.addEventListener('dispose',()=>disposed++);water.getRenderTarget().addEventListener('dispose',()=>disposed++);water.userData.dispose();assert.equal(disposed,3);
 ground.dispose();far.dispose();water.geometry.dispose();water.material.dispose();
});


test('new terrace terrain preserves historical world heights and saves its own version',async()=>{
 const {default:E}=await import('../dist/engine.js'),{readFile}=await import('node:fs/promises');
 const samples=JSON.parse(await readFile(new URL('./fixtures/landform-legacy.json',import.meta.url),'utf8'));
 for(const p of samples){const w=E.createWorld('Legacy terrain',p.terrain,427);if(p.version)w.landformVersion=p.version;else delete w.landformVersion;assert.ok(E.valid(w));assert.ok(Math.abs(groundHeight(w,p.x,p.z)-p.height)<1e-10,'old cities retain '+JSON.stringify(p));}
 for(const terrain of ['river','islands']){const w=E.createWorld('Terraced terrain',terrain,427);assert.equal(w.landformVersion,2);const old={...w,landformVersion:1};let difference=0,buildable=0;for(let x=-90;x<=90;x+=3)for(let z=-90;z<=90;z+=3){const h=groundHeight(w,x,z);if(h>groundHeight(old,x,z)+2)difference++;const slope=Math.hypot(groundHeight(w,x+1,z)-h,groundHeight(w,x,z+1)-h);if(h>3&&slope<.12)buildable++;}assert.ok(difference>200,terrain+' gains distinct upper terraces');assert.ok(buildable>100,terrain+' retains broad gentle development shelves');const saved=JSON.parse(JSON.stringify(w));assert.ok(E.valid(saved));assert.equal(groundHeight(w,70,-70),groundHeight(saved,70,-70));}
});

test('coastal worlds have connected mainland access, offshore islands and consistent rendered water',async()=>{
 const {default:E}=await import('../dist/engine.js');await import('../dist/coastline.js');const coast=globalThis.BoroughCoastline;
 for(const seed of [8,427,777]){const w=E.createWorld('Coast','islands',seed),seen=new Set(),parts=[];
  for(let i=0;i<w.tiles.length;i++){const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96,d=coast.distance(seed,x,z);if(w.tiles[i].type!=='road')assert.equal(w.tiles[i].ground,d<1.5?'water':'land');if(d<0)assert.ok(groundHeight(w,x,z)<0,'sea cells remain submerged');if(d>4)assert.ok(groundHeight(w,x,z)>0,'inland cells remain dry');if(seen.has(i)||w.tiles[i].ground==='water')continue;const q=[i];seen.add(i);for(let j=0;j<q.length;j++)for(const k of E.neighbors(q[j]))if(!seen.has(k)&&w.tiles[k].ground==='land'){seen.add(k);q.push(k);}parts.push(q);}
  const significant=parts.filter(p=>p.length>40).sort((a,b)=>b.length-a.length);assert.equal(significant.length,3,'mainland and two offshore islands');assert.ok(significant[0].includes(24*48));assert.ok(significant[0].includes(24*48+19),'starter road stays on connected mainland');assert.ok(w.tiles.filter(t=>t.ground==='water').length>600);const copy=JSON.parse(JSON.stringify(w));assert.ok(E.valid(copy));assert.equal(groundHeight(w,70,-40),groundHeight(copy,70,-40));
 }
});
