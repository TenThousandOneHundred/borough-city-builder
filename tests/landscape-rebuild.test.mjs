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

test('new saved landforms create usable inland terraces while preserving legacy heights and the starter road',async()=>{
 const {default:E}=await import('../dist/engine.js');
 for(const terrain of ['river','islands','plains']){
  const w=E.createWorld('New landform',terrain,427),legacy=structuredClone(w);delete legacy.landformVersion;let raised=0;
  for(let x=-90;x<=90;x+=6)for(let z=-90;z<=90;z+=6){const h=groundHeight(w,x,z),old=groundHeight(legacy,x,z);assert.ok(Number.isFinite(h));assert.ok(h>=old-1e-9);if(h>old+1)raised++;assert.ok(Math.abs(groundHeight(w,x+.001,z)-h)<.005);}
  assert.ok(raised>100,terrain+' contains real inland relief');
  for(let x=-94;x<-16;x+=4)assert.equal(groundHeight(w,x,2),groundHeight(legacy,x,2),'outside road remains unchanged');
  assert.equal(groundHeight(w,0,0),groundHeight(legacy,0,0),'starter valley stays flat');
  const copy=JSON.parse(JSON.stringify(w));assert.equal(groundHeight(copy,-70,60),groundHeight(w,-70,60));assert.ok(E.valid(copy));copy.landformVersion=2;assert.equal(E.valid(copy),false);
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
