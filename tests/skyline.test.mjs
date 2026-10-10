import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {contour,sculptedBuilding} from '../dist/skyline.js';
test('curved profiles sample finite positions within lot bounds',()=>{
 for(const style of ['lens','ellipse','soft','chamfer']){
  const points=contour(style,2.8,2.4);assert.equal(points.length,48);
  assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1.4&&Math.abs(p.y)<=1.2));
 }
});
test('all architectural families produce valid bounded batched geometry without changing city data',()=>{
 for(const type of ['office','residential'])for(const seed of [9,17,25,33]){
  const t={type,density:'high',level:3,variant:1},before=JSON.stringify(t),group=new THREE.Group();
  const a={v:{night:false},box(){}};assert.equal(sculptedBuilding(a,group,t,seed),true);
  assert.equal(JSON.stringify(t),before);assert.ok(group.children.length<12);
  group.traverse(mesh=>{if(!mesh.isMesh)return;const position=mesh.geometry.attributes.position;assert.ok([...position.array].every(Number.isFinite));mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;assert.ok(b.min.y>=-.01);assert.ok(b.max.x<1.8&&b.min.x>-1.8);assert.ok(b.max.z<1.8&&b.min.z>-1.8);});
 }
});
