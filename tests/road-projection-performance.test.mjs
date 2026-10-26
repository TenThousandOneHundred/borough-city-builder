import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {Roadworks} from '../dist/roadworks.js';

function view(){
 const materials=new Map();
 return {scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
  mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));return materials.get(color);},
  box(group,x,y,z,w,h,d,color){const mesh=new T.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;}};
}
function geometryHash(geometry){
 const hash=createHash('sha256');
 for(const name of Object.keys(geometry.attributes).sort()){
  const attribute=geometry.attributes[name];hash.update(name+':'+attribute.itemSize);
  hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
 }
 if(geometry.index)hash.update(Buffer.from(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength));
 return hash.digest('hex');
}
function project(K,triangles,centers=[[0,0]],{indexed=false,transform=null}={}){
 const roads=new K(view());roads.clear();roads.world={name:'Projection equivalence',roads:[]};roads.building=true;
 roads.height=(_w,x,z)=>8+x*.03+z*.06;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(triangles.flat(2),3));
 if(indexed)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
 const mesh=new T.Mesh(geometry,roads.v.mat('#55585b'));mesh.userData.roadSurface='asphalt';
 if(transform){mesh.position.set(...transform.position);mesh.rotation.y=transform.rotation;}
 roads.group.add(mesh);roads.surfaces.add(geometry,'asphalt');
 const saved=JSON.stringify(roads.world);
 for(const [cx,cz]of centers)roads.lamp(cx-.9,8,cz,true,{x:1,z:0});
 roads.finalizeLamps();
 assert.equal(JSON.stringify(roads.world),saved,'projection never mutates the saved world');
 assert.equal(roads.lampSurfaceIndex,null,'temporary clipping data is discarded');
 return {roads,pools:roads.group.children.filter(mesh=>mesh.material===roads.lightPoolMaterial)};
}
const point=(x,z)=>[x,8+x*.03+z*.06,z];
const tri=(...coordinates)=>coordinates.map(([x,z])=>point(x,z));
// Recorded from the deployed Edition 130 implementation, before the clipping
// optimization. The oracle includes every position, UV, normal and index byte;
// CI needs no historical source files or downloaded assets.
function verifyProjection(triangles,centers,options,hashes){
 const result=project(Roadworks,triangles,centers,options);
 assert.equal(result.pools.length,hashes.length);
 result.pools.forEach((pool,i)=>{
  assert.equal(geometryHash(pool.geometry),hashes[i],'the entire released light-pool geometry must remain unchanged');
  assert.equal(pool.material.opacity,.22);
  assert.equal(pool.material.blending,T.AdditiveBlending);
  assert.equal(pool.material.depthWrite,false);
  const {position,normal,uv}=pool.geometry.attributes;
  assert.equal(position.count,normal.count);assert.equal(position.count,uv.count);
  for(const attribute of [position,normal,uv])assert.ok(attribute.array.every(Number.isFinite));
  for(const coordinate of uv.array)assert.ok(coordinate>=-1e-6&&coordinate<=1+1e-6);
 });
 return result;
}

test('light clipping preserves released vertices, UVs and normals for inside, crossing and rejected triangles',()=>{
 const triangles=[
  tri([-.6,-.5],[.6,-.5],[0,.6]), // No clipping edge changes this triangle.
  tri([1.5,-.5],[3.1,-.3],[1.5,1.4]), // Crosses several circle edges.
  tri([-3,-3],[3,-3],[0,3]), // Polygon changes repeatedly while clipping.
  tri([2.5,-.2],[3.2,-.2],[2.8,.4]), // Same spatial cells, outside pool AABB.
  tri([2,2],[2.3,2],[2.2,2.3]), // Inside AABB but outside the circular pool.
  tri([2.4,0],[2.7,-.2],[2.7,.2]), // Touches the rightmost boundary only.
  tri([-2.400001,0],[-2.399999,-.2],[-2.399999,.2]),
  tri([0,0],[0,0],[0,0]), // Zero projected area is ignored by both versions.
 ];
 const current=verifyProjection(triangles,[[0,0]],{},['97b197fe27ceb609820ed8c7f39891a8037ef869f5dcd8302b7a4cd47c84fc5c']);
 assert.equal(current.pools[0].geometry.userData.projectedRoadPool,true);
 assert.ok(current.pools[0].geometry.attributes.position.count>triangles.length*3,'crossing triangles retain their subdivided boundary geometry');
});

test('indexed slopes and dense shared cells retain every projected triangle on final road planes',()=>{
 const triangles=[];
 for(let x=-4;x<4;x+=.4)for(let z=-3;z<3;z+=.4){
  triangles.push(tri([x,z],[x+.4,z],[x,z+.4]),tri([x+.4,z],[x+.4,z+.4],[x,z+.4]));
 }
 const current=verifyProjection(triangles,[[-1.25,-.75],[0,0],[1.25,.75]],{indexed:true},[
  'b32df4afd67efcc62b06dba61a03dde504878663eae8289a2572076934182955',
  'e3f84804c607068bc95489fb19d1cfbe01031b7d9e51347c2470368f90e5312a',
  '1e2590953ff774441cb0ec11344df1adb942e5c7c4543560d9ff6883ade01158']);
 for(const pool of current.pools){
  assert.ok(pool.geometry.userData.projectedRoadPool);
  const position=pool.geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
   assert.ok(Math.abs(y-(8+x*.03+z*.06+.002))<2e-6,'every illuminated vertex stays on the sloping final surface');
  }
 }
});

test('negative-coordinate transformed surfaces preserve clipping order and exact radial UVs',()=>{
 const triangles=[tri([-4,-2],[4,-2],[-4,2]),tri([4,-2],[4,2],[-4,2]),tri([6,3],[7,3],[6,4])];
 const centers=[[-7.75,4.125],[-8.5,3.25]];
 const current=verifyProjection(triangles,centers,{transform:{position:[-8,2,4],rotation:.31}},[
  'f52ac8577c18936fe17b8b03a2e7de8faee6b52a9ead11589389dd563b17499c',
  '628b5ceb3e35a8ea894a0334c177532ced27175df53e221f58050cb45ba3be65']);
 assert.ok(current.pools.every(pool=>pool.geometry.userData.projectedRoadPool));
});

test('empty or entirely rejected receiving surfaces keep the released standalone fallback',()=>{
 const triangles=[tri([2.5,-.2],[3,-.2],[2.8,.2]),tri([2,2],[2.3,2],[2.2,2.3])];
 for(const source of [[],triangles]){
  const current=verifyProjection(source,[[0,0]],{},['e15cf3cc203f480173bfeb0453bfe9ff8c2770033946810d3836c5e771da08ef']);
  assert.equal(current.pools[0].geometry.userData.projectedRoadPool,undefined);
  assert.equal(current.pools[0].geometry.index.count,72);
 }
});
