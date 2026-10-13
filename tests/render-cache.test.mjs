import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import {groundHeight,terrainColor,Landscape} from '../dist/landscape.js';
import {CityView} from '../dist/renderer.js';
import {sculptTerrain} from '../dist/terrain-edit.js';
import E from '../dist/engine.js';
function setup(){const camera=new THREE.PerspectiveCamera(50,1,.1,200);camera.position.set(0,8,25);camera.lookAt(0,0,0);const factory=new BuildingFactory({scene:new THREE.Scene(),camera,landscape:{assets:{}}}),geometry=new THREE.BoxGeometry(1,2,1),material=new THREE.MeshStandardMaterial();const root=(x,immutable=true)=>{const r=new THREE.Group(),m=new THREE.Mesh(geometry,material);m.userData.sharedAsset=true;r.add(m);r.position.x=x;r.userData={factory:true,asset:true,renderImmutable:immutable};return r;};return {factory,root,geometry,material,camera};}
test('unchanged buildings keep their instance buffers and skip transform uploads across rebuilds',()=>{
 const {factory,root}=setup(),buildings=new Map([[1,root(0)],[2,root(3)]]);factory.rebuild(buildings);const mesh=factory.instanceBatches[0].near,version=mesh.instanceMatrix.version,matrix=Array.from(mesh.instanceMatrix.array);factory.rebuild(buildings);assert.equal(factory.cacheHits,2);assert.equal(factory.cacheMisses,0);assert.equal(factory.instanceBatches[0].near,mesh);assert.equal(mesh.instanceMatrix.version,version);assert.deepEqual(Array.from(mesh.instanceMatrix.array),matrix);
 buildings.set(3,root(-3));factory.rebuild(buildings);assert.equal(factory.cacheHits,2);assert.equal(factory.cacheMisses,1);assert.equal(factory.instanceBatches[0].near,mesh);assert.equal(mesh.count,3);assert.ok(mesh.instanceMatrix.version>version);
});
test('instance buffers grow only when needed and demolition releases obsolete buffers, not model geometry',()=>{
 const {factory,root,geometry}=setup(),buildings=new Map();let geometryDisposed=0;geometry.addEventListener('dispose',()=>geometryDisposed++);for(let i=0;i<4;i++)buildings.set(i,root(i*2));factory.rebuild(buildings);const first=factory.instanceBatches[0].near;let disposed=0;first.addEventListener('dispose',()=>disposed++);buildings.set(5,root(-2));factory.rebuild(buildings);assert.equal(disposed,1);const grown=factory.instanceBatches[0].near;assert.ok(grown.instanceMatrix.count>=5);buildings.delete(5);factory.rebuild(buildings);assert.equal(factory.instanceBatches[0].near,grown);assert.equal(grown.count,4);factory.rebuild(new Map());assert.equal(factory.batchRoot.children.length,0);assert.equal(geometryDisposed,0);
});
test('root relocation, explicit revisions and mutable descendants invalidate cached transforms',()=>{
 const {factory,root}=setup(),r=root(0),b=new Map([[1,r]]);factory.rebuild(b);r.position.x=4;factory.rebuild(b);assert.equal(factory.cacheMisses,1);assert.equal(factory.instanceBatches[0].near.instanceMatrix.array[12],4);r.children[0].position.z=2;r.userData.renderVersion=1;factory.rebuild(b);assert.equal(factory.instanceBatches[0].near.instanceMatrix.array[14],2);
 const mutable=root(0,false);b.set(2,mutable);factory.rebuild(b);mutable.children[0].position.y=3;factory.rebuild(b);assert.equal(factory.cacheHits,1);assert.equal(factory.cacheMisses,1);assert.equal(factory.instanceBatches[0].near.instanceMatrix.array[16+13],3);
});
test('unchanged terrain foundations reuse merged geometry and a changed lot replaces it accurately',()=>{
 const {factory,root,material}=setup(),r=root(0),wall=new THREE.Mesh(new THREE.BoxGeometry(2,.5,2),material);r.add(wall);const b=new Map([[1,r]]);factory.rebuild(b);const mesh=factory.batchRoot.children.find(m=>!m.isInstancedMesh),geometry=mesh.geometry;factory.rebuild(b);assert.equal(mesh.geometry,geometry);r.position.x=3;factory.rebuild(b);assert.notEqual(mesh.geometry,geometry);mesh.geometry.computeBoundingBox();assert.equal(mesh.geometry.boundingBox.min.x,2);assert.equal(mesh.geometry.boundingBox.max.x,4);
});
test('terrain caching retains full resolution, exact heights and colors, and independent mutable copies',()=>{
 const w=E.createWorld('Terrain cache','river',427),a=terrainMeshes(w,groundHeight,terrainColor);assert.equal(a.ground.attributes.position.count,193*193);assert.equal(a.far.attributes.position.count,401*401);assert.equal(a.cacheHit,false);assert.equal(a.samples,38021);
 const p=a.ground.attributes.position,c=a.ground.attributes.color;for(let i=0;i<p.count;i+=47){assert.equal(p.getY(i),Math.fround(groundHeight(w,p.getX(i),p.getZ(i))));const expected=terrainColor(w,p.getX(i),p.getZ(i));assert.equal(c.getX(i),Math.fround(expected.r));assert.equal(c.getY(i),Math.fround(expected.g));assert.equal(c.getZ(i),Math.fround(expected.b));}
 const b=terrainMeshes(w,groundHeight,terrainColor);assert.equal(b.cacheHit,true);assert.deepEqual(b.ground.attributes.position.array,a.ground.attributes.position.array);a.ground.attributes.color.array.fill(0);a.far.attributes.position.array.fill(0);const restored=terrainMeshes(w,groundHeight,terrainColor);assert.deepEqual(restored.ground.attributes.color.array,b.ground.attributes.color.array);assert.deepEqual(restored.far.attributes.position.array,b.far.attributes.position.array);
});
test('sculpting and terrain identity changes invalidate the mesh cache without changing other worlds',()=>{
 const w=E.createWorld('Sculpt cache','plains',11),a=terrainMeshes(w,groundHeight,terrainColor),copy=structuredClone(w);assert.equal(terrainMeshes(copy,groundHeight,terrainColor).cacheHit,false);const result=sculptTerrain(w,{x:35,z:40,mode:'raise',radius:6,strength:2},groundHeight);assert.ok(result.ok);const b=terrainMeshes(w,groundHeight,terrainColor);assert.equal(b.cacheHit,false);assert.notDeepEqual(b.ground.attributes.position.array,a.ground.attributes.position.array);assert.equal(terrainMeshes(copy,groundHeight,terrainColor).cacheHit,true);assert.equal(terrainMeshes(w,groundHeight,terrainColor).cacheHit,true);w.seed++;assert.equal(terrainMeshes(w,groundHeight,terrainColor).cacheHit,false);
});
test('restoring natural terrain colors uses the saved colors and sculpting updates that snapshot',()=>{
 const w=E.createWorld('Overlay cache','plains',22),ground=new THREE.Mesh(new THREE.PlaneGeometry(2,2,2,2),new THREE.MeshStandardMaterial());ground.geometry.rotateX(-Math.PI/2);ground.geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(27),3));const baseColors=new Float32Array(27).fill(.4),view={world:w,overlay:'none',landscape:{ground,baseColors}};CityView.prototype.updateOverlay.call(view);assert.deepEqual(ground.geometry.attributes.color.array,baseColors);ground.geometry.attributes.color.array.fill(.9);CityView.prototype.updateOverlay.call(view);assert.deepEqual(ground.geometry.attributes.color.array,baseColors);
 const landscape={ground,baseColors,world:w,view:{renderer:{shadowMap:{}}}};Landscape.prototype.refreshTerrain.call(landscape,w,null,false);assert.deepEqual(baseColors,ground.geometry.attributes.color.array);assert.notEqual(baseColors[0],.4);
});
