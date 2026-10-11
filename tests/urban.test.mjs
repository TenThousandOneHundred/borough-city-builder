import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {roofPlant} from '../dist/urban.js';
test('roof equipment is batched, finite and contained by each roof perimeter',()=>{
 for(const [w,d]of [[.85,2.8],[2.85,2.55],[3.5,3.4]]){
  const q=new THREE.Group(),unitBox=new THREE.BoxGeometry(1,1,1),cache=new Map();
  const a={v:{unitBox,mat(c){if(!cache.has(c))cache.set(c,new THREE.MeshStandardMaterial({color:c}));return cache.get(c)}},box(g,x,y,z,w,h,d,c){const m=new THREE.Mesh(unitBox,this.v.mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;}};
  roofPlant(a,q,0,0,0,w,d,123);
  assert.ok(q.children[0].children.length<=10);
  q.traverse(m=>{if(!m.isMesh)return;m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;assert.ok(b.min.x>=-w/2-.025&&b.max.x<=w/2+.025);assert.ok(b.min.z>=-d/2-.025&&b.max.z<=d/2+.025);assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite))});
 }
});
