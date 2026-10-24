import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {BuildingFactory} from '../dist/building-factory.js';

function factory(Class=BuildingFactory){const camera=new THREE.PerspectiveCamera(55,1,.1,500);camera.position.set(0,12,25);camera.lookAt(0,0,0);return new Class({scene:new THREE.Scene(),camera,detailEnabled:true,reflectionsEnabled:true});}
function building(geometry,material,x=0){const root=new THREE.Group();root.userData={asset:true,factory:true,renderImmutable:true};root.position.set(x,1,x*.2);root.rotation.y=x*.13;for(let i=0;i<4;i++){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(i*.7,0,i*.3);mesh.scale.set(1+i*.1,.8+i*.2,1-i*.1);mesh.userData={sharedAsset:true,siteRange:[0,30]};root.add(mesh);}return root;}
function expected(root){root.updateMatrixWorld(true);const bounds=[];root.traverse(o=>{if(o.isMesh&&o.userData.siteRange)bounds.push(new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld).getBoundingSphere(new THREE.Sphere()));});return bounds;}
function checkBounds(f,root){const original=expected(root),entry=f.collectBuilding(root);assert.deepEqual(entry.instances.map(p=>p.transform.detailBounds),original);}

test('shared detail geometry is scanned once while every rotated instance retains its exact bounds',()=>{
 const f=factory(),geometry=new THREE.SphereGeometry(1,32,20),material=new THREE.MeshStandardMaterial(),roots=new Map();geometry.computeBoundingBox();
 const p=geometry.attributes.position,getX=p.getX;let reads=0;p.getX=function(i){reads++;return getX.call(this,i);};
 for(let i=0;i<40;i++)roots.set(i,building(geometry,material,i-20));f.rebuild(roots);assert.equal(reads,p.count,'160 tree instances share one local vertex scan');
 for(const root of roots.values()){root.position.y+=.3;root.userData.renderVersion=1;}const prior=reads;f.rebuild(roots);assert.equal(reads,prior,'new world transforms reuse the unchanged local box');
 p.getX=getX;for(const root of roots.values())checkBounds(f,root);
});

test('revised, replaced and resized position buffers invalidate only their own local bounds',()=>{
 const f=factory(),geometry=new THREE.BoxGeometry(1,2,3),other=new THREE.BoxGeometry(2,2,2),a=f.detailGeometryBounds(geometry),b=f.detailGeometryBounds(other),p=geometry.attributes.position;
 p.setX(0,7);p.needsUpdate=true;const revised=f.detailGeometryBounds(geometry);assert.notEqual(revised,a);assert.equal(revised.max.x,7);assert.equal(f.detailGeometryBounds(other),b);
 const replacement=p.clone();replacement.setX(0,-9);geometry.setAttribute('position',replacement);assert.equal(f.detailGeometryBounds(geometry).min.x,-9);
 replacement.array=new Float32Array([1,2,3,4,5,6]);replacement.count=2;const resized=f.detailGeometryBounds(geometry);assert.deepEqual(resized,new THREE.Box3().setFromBufferAttribute(replacement));
 const root=building(geometry,new THREE.MeshStandardMaterial());geometry.computeBoundingBox();f.renderCache=new WeakMap();checkBounds(f,root);
});

test('interleaved attributes track shared-buffer revisions, replacements and offsets',()=>{
 const f=factory(),data=new THREE.InterleavedBuffer(new Float32Array([1,2,3,8,9,10,-2,-3,-4,5,6,7]),6),p=new THREE.InterleavedBufferAttribute(data,3,0),g=new THREE.BufferGeometry();g.setAttribute('position',p);
 const first=f.detailGeometryBounds(g);assert.deepEqual(first,new THREE.Box3().setFromBufferAttribute(p));data.array[0]=12;data.needsUpdate=true;assert.equal(f.detailGeometryBounds(g).max.x,12);
 p.offset=3;assert.deepEqual(f.detailGeometryBounds(g),new THREE.Box3().setFromBufferAttribute(p));data.array=data.array.slice();data.array[3]=14;assert.equal(f.detailGeometryBounds(g).max.x,14);
});

test('cached bounds preserve visible instances and full shadows through movement, quality changes and demolition',()=>{
 class Uncached extends BuildingFactory{detailGeometryBounds(g){return new THREE.Box3().setFromBufferAttribute(g.attributes.position);}}
 const before=factory(Uncached),after=factory(),g=new THREE.BoxGeometry(2,5,3),m=new THREE.MeshStandardMaterial(),roots=new Map();g.userData.lod=new THREE.BoxGeometry(2,5,3);
 for(let i=0;i<24;i++)roots.set(i,building(g,m,i*3-36));
 const snapshot=f=>f.instanceBatches.map(b=>({transforms:b.transforms.map(t=>({matrix:t.matrix.elements,sphere:t.sphere,detailBounds:t.detailBounds,renderRange:t.renderRange,rangeOrigin:t.rangeOrigin})),near:{count:b.near.count,matrices:Array.from(b.near.instanceMatrix.array.slice(0,b.near.count*16))},far:{count:b.far.count,matrices:Array.from(b.far.instanceMatrix.array.slice(0,b.far.count*16))},shadow:{count:b.shadow.userData.casterCount,matrices:Array.from(b.shadow.instanceMatrix.array.slice(0,b.shadow.userData.casterCount*16))}}));
 for(let step=0;step<28;step++){
  if(step===9){roots.get(5).position.x+=6;roots.get(5).rotation.y+=.8;}if(step===17)roots.delete(9);
  for(const f of [before,after]){f.view.detailEnabled=step%5!==0;f.view.reflectionsEnabled=step%3!==0;f.view.camera.position.set(step>20?300:Math.sin(step*.3)*40,8+step,Math.cos(step*.3)*40);f.view.camera.lookAt(step>20?300:0,0,0);f.rebuild(roots);}
  assert.deepEqual(snapshot(after),snapshot(before));
  for(const batch of after.instanceBatches){assert.equal(batch.near.geometry,g);assert.equal(batch.near.material,m);assert.equal(batch.shadow.geometry,g);batch.shadow.onBeforeShadow();assert.equal(batch.shadow.count,batch.transforms.length);batch.shadow.onAfterShadow();assert.equal(batch.shadow.count,0);}
 }
});
