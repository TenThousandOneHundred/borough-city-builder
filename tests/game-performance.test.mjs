import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {CityView} from '../dist/renderer.js';
import {batchStatic} from '../dist/static-batch.js';
const E=createRequire(import.meta.url)('../dist/engine.js');globalThis.CityEngine=E;
test('camera movement and population ticks do not rebuild static scenery; road deletion does',()=>{
 const v=Object.create(CityView.prototype),world=E.createWorld('Refresh regression','flat',33),counts={roads:0,trees:0,models:0,overlay:0};
 Object.assign(v,{world,camera:new THREE.PerspectiveCamera(),buildings:new Map(),tileGroup:new THREE.Group(),models:{accepts:t=>['residential','commercial','industrial','office'].includes(t.type),rebuild:()=>counts.models++},renderer:{shadowMap:{}},roadworks:{build:()=>counts.roads++},landscape:{refreshTrees:()=>counts.trees++},streetLife:{build:()=>{}},setupCars:()=>{},updateOverlay:()=>counts.overlay++,updateZones:()=>{},overlay:'none',night:false});
 v.refresh(true);const baseline={...counts};v.camera.position.set(60,50,30);world.day++;world.money+=100;v.refresh();assert.deepEqual(counts,baseline);
 const road=world.tiles.findIndex(t=>t.type==='road');world.tiles[road].type=null;v.refresh();assert.equal(counts.roads,baseline.roads+1);assert.equal(counts.overlay,0);
});
test('static batching preserves vertices, material and shadow state while reducing draw calls',()=>{
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),box=new THREE.BoxGeometry(1,1,1);for(let i=0;i<40;i++){const mesh=new THREE.Mesh(box,material);mesh.position.set(i%8,0,Math.floor(i/8));mesh.castShadow=true;group.add(mesh);}const before=new THREE.Box3().setFromObject(group),result=batchStatic(group,box),after=new THREE.Box3().setFromObject(group);assert.equal(result.before,40);assert.equal(result.after,1);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);assert.equal(group.children[0].geometry.attributes.position.count,40*36);assert.equal(group.children[0].material,material);assert.equal(group.children[0].castShadow,true);
});
test('vehicle instancing preserves geometry and movement while reducing draw submissions',async()=>{
 const {Vehicles}=await import('../dist/vehicles.js'),vehicles=new Vehicles(),group=new THREE.Group(),cars=Array.from({length:65},(_,i)=>({mesh:vehicles.create(i)}));let originalTriangles=0,draws=0;for(const {mesh}of cars){group.add(mesh);mesh.traverse(o=>{if(o.isMesh){draws++;originalTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}})}vehicles.rebuildFleet(cars,group);const instancedTriangles=vehicles.fleet.reduce((n,o)=>n+o.count*(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0);assert.equal(instancedTriangles,originalTriangles);assert.ok(vehicles.fleet.length<draws/5);cars[0].mesh.position.x=12;vehicles.updateFleet(cars);const first=vehicles.fleet[0],matrix=new THREE.Matrix4();first.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],12);
});
