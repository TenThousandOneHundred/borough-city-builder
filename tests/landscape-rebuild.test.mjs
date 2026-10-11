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
