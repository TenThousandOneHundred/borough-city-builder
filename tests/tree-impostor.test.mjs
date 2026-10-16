import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {treeElevation,elevationTreeMaterial} from '../dist/tree-impostor.js';
import {Vegetation} from '../dist/vegetation.js';

test('tree elevations remain finite from ground level to directly overhead',()=>{
 const tree={x:4,z:6,y:1,h:5},centre=1+5*.54;
 assert.equal(treeElevation({x:4,y:centre,z:16},tree),0);
 assert.ok(Math.abs(treeElevation({x:4,y:centre+10,z:16},tree)-Math.PI/4)<1e-12);
 assert.equal(treeElevation({x:4,y:centre+10,z:6},tree),Math.PI/2);
 assert.equal(treeElevation({x:4,y:-10,z:6},tree),0);
});

test('elevated tree cards track vertical camera movement without changing tree locations or buffer capacity',()=>{
 const camera=new THREE.PerspectiveCamera(),material=elevationTreeMaterial(new THREE.Texture()),vegetation=Object.create(Vegetation.prototype);
 camera.position.set(6,3,10);Object.assign(vegetation,{v:{camera,detailEnabled:false,night:false,renderer:{shadowMap:{needsUpdate:false}}},broadleaf:[{material}],impostors:[{material:new THREE.MeshBasicMaterial()}],prototypes:[]});
 const positions=[[0,0,4],[10,0,4],[20,0,4]],saved=JSON.stringify(positions);vegetation.populate(new THREE.Group(),positions,()=>0);
 const mesh=vegetation.instances[0],attribute=mesh.instanceMatrix,initial=attribute.array.slice();attribute.clearUpdateRanges();camera.position.y=30;vegetation.update();assert.notDeepEqual(attribute.array,initial);assert.equal(mesh.instanceMatrix,attribute);
 const record=vegetation.population.records.find(r=>r.mesh===mesh),matrix=new THREE.Matrix4();mesh.getMatrixAt(record.slot,matrix);const normal=new THREE.Vector3(0,0,1).transformDirection(matrix);assert.ok(normal.y>.8,'canopy card faces the high camera');
 for(let n=0;n<16;n++){
  camera.position.set(Math.sin(n)*12,15+n,Math.cos(n)*12);vegetation.update();
  for(const r of vegetation.population.records){r.mesh.getMatrixAt(r.slot,matrix);const points=r.mesh.geometry.attributes.position;for(let i=0;i<points.count;i++)assert.ok(r.mesh.boundingSphere.containsPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(matrix)));}
 }
 const version=attribute.version;vegetation.update();assert.equal(attribute.version,version);assert.equal(vegetation.lastMatrixWrites,0);assert.equal(JSON.stringify(positions),saved);
 assert.ok(mesh.customDepthMaterial?.isMeshDepthMaterial);assert.equal(mesh.customDepthMaterial.map,material.map);assert.equal(vegetation.v.renderer.shadowMap.needsUpdate,false,'camera-only canopy changes cannot trigger a city-wide shadow redraw');
});
