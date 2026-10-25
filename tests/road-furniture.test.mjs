import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {Roadworks} from '../dist/roadworks.js';
import {groundHeight} from '../dist/landscape.js';
import {ASPHALT_HEIGHT,PAINT_CLEARANCE} from '../dist/road-profile.js';
globalThis.CityEngine=E;

function fixture(){
 const materials=new Map(),view={scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
  mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));return materials.get(color);},
  box(group,x,y,z,w,h,d,color){const mesh=new T.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;}};
 const roads=new Roadworks(view),world=E.createWorld('Final road furniture','plains',8);roads.clear();roads.world=world;
 return {roads,world,view};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<2e-5,`${a} differs from ${b}`);
const pole=roads=>roads.lamps[0].parent.children.find(mesh=>mesh.geometry?.type==='CylinderGeometry');
function assertProjectedPool(roads,pool){
 assert.ok(pool.geometry.userData.projectedRoadPool);const p=pool.geometry.attributes.position,uv=pool.geometry.attributes.uv;
 assert.equal(pool.geometry.index,null);assert.equal(p.count%3,0);assert.equal(p.count,uv.count);
 assert.ok(p.count/3<roads.surfaces.triangleCount*26,'clipping has a bounded local triangle cost');
 for(let i=0;i<p.count;i+=3){
  const vertices=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k));
  const samples=[...vertices,vertices[0].clone().add(vertices[1]).multiplyScalar(.5),vertices[1].clone().add(vertices[2]).multiplyScalar(.5),vertices[2].clone().add(vertices[0]).multiplyScalar(.5),vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3)];
  for(const sample of samples){
   const surface=roads.surfaceHeight(sample.x,sample.z);assert.notEqual(surface,null,'no light triangle bridges unsupported ground/water');
   const gap=sample.y-surface;
   assert.ok(gap>PAINT_CLEARANCE-.0005&&gap<PAINT_CLEARANCE+.0001,`whole light triangle clears its final receiving plane: ${gap}`);
  }
 }
 for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=-1e-6&&uv.getX(i)<=1+1e-6);assert.ok(uv.getY(i)>=-1e-6&&uv.getY(i)<=1+1e-6);}
}

function finalizedStreet(){
 const result=fixture(),{roads}=result;roads.building=true;
 roads.height=(_w,x,z)=>2+x*.04+z*.18;
 const x=1.5,z=1.45,declared=roads.height(roads.world,x,0);
 roads.lamp(x,declared,z,true,{x:0,z:-1});
 assert.equal(roads.lamps.length,0);assert.equal(roads.group.children.length,0,'lamps wait for pavement finalization');
 const points=[{x:-5,z:0},{x:5,z:0}],width=2.45;
 roads.ribbon(roads.world,points,width,0,roads.v.mat('#555'),ASPHALT_HEIGHT,{lanes:2,width});
 roads.curbs(roads.world,points,width,roads.walkMaterial,roads.v.mat('#aaa'));
 // Simulate a finalized road elevation different from the initial construction
 // datum. The copied index must be rebuilt before furniture samples it.
 for(const mesh of roads.group.children)if(mesh.userData.roadSurface)mesh.geometry.translate(0,.8,0);
 roads.finalizePavement();
 return {...result,x,z,declared};
}

test('queued lamp poles meet their actual offset sidewalk on slopes after the final index rebuild',()=>{
 const {roads,world,x,z,declared}=finalizedStreet(),saved=JSON.stringify(world),triangles=roads.surfaces.triangleCount;
 const foot=roads.surfaceHeight(x,z,'sidewalk');assert.ok(foot>declared+.9);
 roads.finalizeLamps();assert.equal(roads.lamps.length,1);close(pole(roads).position.y-1.5,foot);
 assert.equal(roads.lamps[0].material,roads.lampMaterial,'existing shared lamp finish is preserved');
 assert.equal(roads.surfaces.triangleCount,triangles,'furniture cannot enter the road surface index');
 const children=roads.group.children.length;roads.finalizeLamps();assert.equal(roads.group.children.length,children,'finishing twice cannot duplicate lamps');
 assert.equal(roads.finishingLamps,false);assert.equal(roads.pendingLamps.length,0);assert.equal(JSON.stringify(world),saved);
});

test('light-pool triangles follow finished asphalt and sidewalks without connecting them to lower ground',()=>{
 const {roads,world}=finalizedStreet(),saved=JSON.stringify(world);
 roads.height=()=>{throw Error('Finished furniture must not resample the old road datum');};
 roads.finalizeLamps();const pool=roads.group.children.find(mesh=>mesh.material===roads.lightPoolMaterial);
 assert.ok(pool);assertProjectedPool(roads,pool);
 const positions=pool.geometry.attributes.position;let road=0,sidewalk=0;
 for(let i=0;i<positions.count;i++)if(roads.surfaceHeight(positions.getX(i),positions.getZ(i),'sidewalk')!==null)sidewalk++;else road++;
 assert.ok(road>0&&sidewalk>0,'asphalt and sidewalks both receive projected light');
 assert.equal(roads.lampSurfaceIndex,null,'temporary projection index is discarded after building');
 assert.equal(JSON.stringify(world),saved);
});

test('a high bridge light pool has no triangular wedges descending through its deck to terrain',()=>{
 const {roads,world}=fixture(),saved=JSON.stringify(world);roads.building=true;roads.height=(_w,x)=>8+x*.015;
 roads.lamp(0,8,1.45,true,{x:0,z:-1});
 const points=[{x:-5,z:0},{x:5,z:0}],width=2.45;
 roads.ribbon(world,points,width,0,roads.v.mat('#555'),ASPHALT_HEIGHT,{lanes:2,width});roads.curbs(world,points,width,roads.walkMaterial,roads.v.mat('#aaa'));
 roads.finalizePavement();roads.finalizeLamps();const pool=roads.group.children.find(mesh=>mesh.material===roads.lightPoolMaterial);
 assert.ok(8-groundHeight(world,0,3)>4,'fixture has a large bridge-to-ground drop beside the footprint');
 assertProjectedPool(roads,pool);pool.geometry.computeBoundingBox();
 assert.ok(pool.geometry.boundingBox.min.y>7.9,'no projected light vertex falls below the bridge deck');
 assert.ok(pool.geometry.boundingBox.max.z<=width/2+.42+1e-5,'light stops at the outer sidewalk edge');
 const uv=pool.geometry.attributes.uv,p=pool.geometry.attributes.position,cx=0,cz=1.45-.9;
 for(let i=0;i<p.count;i++){close(uv.getX(i),.5+(p.getX(i)-cx)/4.8);close(uv.getY(i),.5-(p.getZ(i)-cz)/4.8);}
 assert.equal(JSON.stringify(world),saved);
});

test('unindexed bridge shoulders preserve the declared pole height and clearing discards queued lamps',()=>{
 const {roads,world}=fixture(),saved=JSON.stringify(world);roads.lamp(40,8.4,40,false);
 close(pole(roads).position.y-1.5,8.4,'an off-surface pole retains its supplied bridge/shoulder elevation');
 const pool=roads.group.children.find(mesh=>mesh.material===roads.lightPoolMaterial);assert.equal(pool.geometry.index.count,72,'standalone unindexed lamps retain the released fan');
 const positions=pool.geometry.attributes.position;for(let i=0;i<positions.count;i++)close(positions.getY(i),roads.height(world,positions.getX(i),positions.getZ(i))+.24);
 roads.building=true;roads.lamp(42,9.1,40,false);assert.equal(roads.pendingLamps.length,1);
 roads.clear();roads.finalizeLamps();assert.equal(roads.lamps.length,0);assert.equal(roads.group.children.length,0);
 assert.equal(roads.pendingLamps.length,0);assert.equal(roads.finishingLamps,false);assert.equal(JSON.stringify(world),saved);
});
