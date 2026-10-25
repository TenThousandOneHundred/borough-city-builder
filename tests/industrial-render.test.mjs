import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {IndustrialProps} from '../dist/industrial-props.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {SiteDetails} from '../dist/site-details.js';

const released=JSON.parse(fs.readFileSync(new URL('./fixtures/industrial-props-126.json',import.meta.url)));
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function geometrySnapshot(g){
 const attributes={};for(const [name,a]of Object.entries(g.attributes))attributes[name]={hash:hash(a.array),itemSize:a.itemSize,normalized:a.normalized,count:a.count};
 return {attributes,index:hash(g.index.array),indexCount:g.index.count};
}
function library(){return new IndustrialProps({wood:new T.MeshStandardMaterial({name:'site-wood',color:'#8c806b',roughness:.94})});}
function factoryPair(camera,roots){
 const views=[0,1].map(()=>({scene:new T.Scene(),camera,landscape:{assets:{}},reflectionsEnabled:true,detailEnabled:true}));
 const [before,after]=views.map(v=>new BuildingFactory(v)),duplicates=new Map(),geometryKeys=new WeakMap();
 for(const root of roots.values())root.traverse(o=>{
  if(!o.isMesh||!o.userData.industrialProp)return;
  if(o.material.name==='industrial-chain-link')assert.deepEqual(o.userData.siteRange,[0,24]);
  else assert.equal(o.userData.siteRange,undefined,'retain released whole-lot visibility rules for complete props');
  const g=o.geometry;if(g.userData.lod||duplicates.has(g))return;
  const copy=new T.BufferGeometry();for(const [name,a]of Object.entries(g.attributes))copy.setAttribute(name,a);copy.setIndex(g.index.clone());copy.computeBoundingSphere();
  assert.notEqual(copy.index.array,g.index.array);assert.deepEqual(geometrySnapshot(copy),geometrySnapshot(g));duplicates.set(g,copy);
 });
 const rebuild=(next=roots)=>{
  // Restore only the redundant distant buffers that Edition 126 allocated.
  // The immutable fixture independently proves the underlying bytes are released bytes.
  for(const [g,copy]of duplicates)g.userData.lod=copy;
  try{before.rebuild(next);}finally{for(const g of duplicates.keys())delete g.userData.lod;}
  after.rebuild(next);
 };
 const snapshot=(factory,shadows=false)=>{
  const payload=new Map();for(const b of factory.instanceBatches)for(const m of shadows?[b.shadow]:[b.near,b.far]){
   if(!m||!m.geometry.index.count)continue;const count=shadows?m.userData.casterCount:m.count;if(!count)continue;
   let geometry=geometryKeys.get(m.geometry);if(!geometry){geometry=JSON.stringify(geometrySnapshot(m.geometry));geometryKeys.set(m.geometry,geometry);}
   const key=m.material.uuid+':'+geometry;if(!payload.has(key))payload.set(key,[]);
   for(let i=0;i<count;i++)payload.get(key).push(Array.from(m.instanceMatrix.array.subarray(i*16,i*16+16)).join(','));
  }
  return [...payload].map(([key,matrices])=>[key,matrices.sort()]).sort((a,b)=>a[0].localeCompare(b[0]));
 };
 const compare=()=>{before.updateVisibility();after.updateVisibility();assert.deepEqual(snapshot(after),snapshot(before),'same visible geometry/material/world-transform multiset');assert.deepEqual(snapshot(after,true),snapshot(before,true),'same complete shadow geometry and world transforms');};
 rebuild();return {before,after,views,rebuild,compare,snapshot};
}
function visibleCount(factory){return factory.instanceBatches.reduce((n,b)=>n+b.near.count+(b.far?.count||0),0);}

test('optimized yard props retain every released near, distant and shadow triangle plus their texture and finish',()=>{
 const props=library();let parts=0,differentLods=0;
 for(const [kind,expected]of Object.entries(released.models)){
  const model=props.model(kind);assert.equal(model.children.length,expected.length,kind);
  for(let i=0;i<expected.length;i++){
   const mesh=model.children[i],g=mesh.geometry,m=mesh.material,e=expected[i];parts++;
   assert.equal(m.name,e.material);assert.deepEqual(geometrySnapshot(g),e.near,kind+' near');
   assert.deepEqual(geometrySnapshot(g.userData.lod||g),e.far,kind+' far');
   assert.deepEqual(geometrySnapshot(g.userData.shadowLod||g),e.shadow,kind+' shadows');
   assert.deepEqual(m.color.toArray(),e.color);for(const key of ['roughness','metalness','alphaTest','transparent','side','depthWrite'])assert.equal(m[key],e[key],kind+' '+key);
   assert.equal(m.map?.image?.data?hash(m.map.image.data):null,e.texture,kind+' texture');
   if(g.userData.lod)differentLods++;
  }
 }
 assert.equal(parts,17);assert.equal(differentLods,1,'only container corrugation needs a different distant mesh');
 const wire=props.model('security-fence').children.find(m=>m.material.name==='industrial-chain-link');
 wire.geometry.computeBoundingBox();assert.equal(wire.geometry.boundingBox.min.z,wire.geometry.boundingBox.max.z,'released wire geometry stays flat');
 assert.equal(wire.material.forceSinglePass,false,'retain the released two-pass fence shader and transparent blending order');
});

test('duplicate distant buffers collapse without changing visible payloads across distance, settings, poses and demolition',()=>{
 const camera=new T.PerspectiveCamera(50,16/9,.1,300),details=new SiteDetails({landscape:{assets:{}}}),roots=new Map();
 const forms=['industrial-distribution-hall','industrial-processing-yard','industrial-sawtooth-works','industrial-trade-depot'];
 for(let i=0;i<24;i++){
  const plan={type:'industrial',lotWidth:9.56,lotDepth:9.56,industrialForm:forms[i%4],entranceXs:[2.77],loadingBays:[{x:-1.72,width:.76}],seed:123};
  const root=details.build(plan,{minX:-3.824,maxX:3.824,minZ:-4.4,maxZ:-1.8});
  root.userData={factory:true,asset:true,renderImmutable:true,lodDistance:64};root.position.set((i%6)*12,0,Math.floor(i/6)*12);root.rotation.y=.12*i;roots.set(i,root);
 }
 camera.position.set(-30,12,0);camera.lookAt(30,0,20);const pair=factoryPair(camera,roots),{before,after,views,rebuild,compare,snapshot}=pair;
 assert.equal(before.instanceBatches.filter(b=>b.far).length,17);assert.equal(after.instanceBatches.filter(b=>b.far).length,1);
 const bytes=f=>f.batchRoot.children.reduce((n,m)=>n+(m.instanceMatrix?.array.byteLength||0),0);assert.ok(bytes(after)<bytes(before)*.75,'duplicate buffers are actually removed');
 const shadows=snapshot(after,true);let crossedBoundary=false;
 for(const [x,y,z,tx,ty,tz]of [[-30,12,0,30,0,20],[20,20,35,20,0,20],[20,2,8,20,2,20],[90,60,110,20,0,20],[20,3,40,20,-4,-20],[150,10,120,180,0,120]]){
  camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);
  for(const reflectionsEnabled of [true,false])for(const detailEnabled of [true,false]){
   for(const v of views)Object.assign(v,{reflectionsEnabled,detailEnabled});compare();
   crossedBoundary ||= before.instanceBatches.some(b=>b.near.count&&b.far?.count);
   assert.deepEqual(snapshot(after,true),shadows,'camera and rendering settings never remove shadow casters');
  }
 }
 assert.ok(crossedBoundary,'comparison exercises simultaneous near and far lots');
 const root=roots.get(0);root.position.x+=13;rebuild();compare();
 const prop=root.children.find(o=>o.children.some(c=>c.userData.industrialProp));prop.position.z+=.2;root.userData.renderVersion=1;rebuild();compare();
 roots.delete(1);rebuild();compare();
 let disposed=0;for(const model of details.industrialProps.models.values())for(const m of model.children)m.geometry.addEventListener('dispose',()=>disposed++);
 rebuild(new Map());compare();assert.equal(before.batchRoot.children.length,0);assert.equal(after.batchRoot.children.length,0);assert.equal(disposed,0,'shared models survive instance demolition');
});

test('reflection-only industrial props match released visibility, including wire range and offscreen shadows',()=>{
 const camera=new T.PerspectiveCamera(18,16/9,.1,300),props=library(),root=new T.Group();root.userData={factory:true,asset:true,renderImmutable:true,lodDistance:64};
 const container=props.place(root,{kind:'container',x:0,z:-20,w:1.22,d:.5,height:.52});container.position.y=8;
 const fence=props.place(root,{kind:'security-fence',x:0,z:-19.5,w:1.22,d:.02,height:.44});fence.position.y=8;
 camera.position.set(0,1,0);camera.lookAt(0,-8.46,-20);const {before,after,views,compare,snapshot}=factoryPair(camera,new Map([[1,root]]));
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const sphere=after.instanceBatches[0].transforms[0].sphere;assert.equal(frustum.intersectsSphere(sphere),false);const mirrored=sphere.clone();mirrored.center.y=-.2-mirrored.center.y;assert.equal(frustum.intersectsSphere(mirrored),true);
 compare();assert.equal(visibleCount(after),5,'all container and fence parts contribute through the reflection');const shadows=snapshot(after,true);
 for(const v of views)v.reflectionsEnabled=false;compare();assert.equal(visibleCount(after),0);assert.deepEqual(snapshot(after,true),shadows);
 for(const v of views)v.reflectionsEnabled=true;compare();assert.equal(visibleCount(after),5);
 camera.position.set(0,1,20);camera.lookAt(0,-8.46,-20);compare();
 const wire=after.instanceBatches.find(b=>b.near.material.name==='industrial-chain-link');assert.equal(wire.near.count,0,'the released 24-unit wire range is retained');assert.equal(visibleCount(after),4);
 assert.deepEqual(snapshot(after,true),shadows);assert.equal(visibleCount(before),visibleCount(after));
});
