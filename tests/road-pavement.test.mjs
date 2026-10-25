import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {unifyPavement} from '../dist/road-pavement.js';
import {streetStations,streetSurface} from '../dist/street-geometry.js';
import {planJunctions,junctionCorners,roadGeometry} from '../dist/road-junction-plan.js';
import {planBridges,bridgeHeight} from '../dist/bridge-spans.js';
import {floorHeight,groundHeight,wetness} from '../dist/landscape.js';
import E from '../dist/engine.js';

function mesh(points,indices,color='#555555'){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));if(indices)g.setIndex(indices);
 g.setAttribute('uv',new T.Float32BufferAttribute(points.flatMap(([x,,z])=>[x*2,z*3]),2));
 g.setAttribute('roadFinish',new T.Float32BufferAttribute(points.flatMap(([x,,z])=>[1+x*.01,.3+z*.02,1]),3));g.computeVertexNormals();
 return new T.Mesh(g,new T.MeshStandardMaterial({color}));
}
function rectangle(x0,z0,x1,z1,y=()=>0){return mesh([[x0,y(x0,z0),z0],[x1,y(x1,z0),z0],[x1,y(x1,z1),z1],[x0,y(x0,z1),z1]],[0,2,1,0,3,2]);}
function polygon(outline,y){const g=new T.ShapeGeometry(new T.Shape(outline.map(([x,z])=>new T.Vector2(x,-z))),1);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,y(p.getX(i),p.getZ(i)));g.computeVertexNormals();return new T.Mesh(g,new T.MeshStandardMaterial());}
function triangles(m){const g=m.geometry,p=g.attributes.position,idx=g.index,result=[];for(let i=0;i+2<(idx?.count??p.count);i+=3)result.push([0,1,2].map(k=>{const j=idx?idx.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j)];}));return result;}
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
const projectedArea=meshes=>meshes.flatMap(triangles).reduce((sum,[a,b,c])=>sum+Math.abs(cross(a,b,c))/2,0);
// Independent exhaustive oracle. Strict interior counts do not treat a shared
// triangulation edge as double coverage; height sampling includes those edges.
function samples(source,x,z,strict=false){const result=[];for(const [a,b,c]of source){const det=cross(a,b,c);if(Math.abs(det)<1e-12)continue;const point=[x,0,z],u=cross(point,b,c)/det,v=cross(a,point,c)/det,w=1-u-v;if(strict?Math.min(u,v,w)>1e-8:Math.min(u,v,w)>=-1e-7)result.push(u*a[1]+v*b[1]+w*c[1]);}return result;}
function assertCoverage(before,meshes,bounds){const output=meshes.flatMap(triangles);let checked=0;for(let i=0;i<2000;i++){const x=bounds[0]+((i*.61803398875)%1)*(bounds[2]-bounds[0]),z=bounds[1]+((i*.41421356237+.137)%1)*(bounds[3]-bounds[1]);const expected=before.some(ts=>samples(ts,x,z).length),hits=samples(output,x,z,true);assert.equal(hits.length,expected?1:0,`single coverage at ${x},${z}`);checked++;}return checked;}
function positions(m){const p=m.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);}

test('junction ownership removes overlapping strips while preserving area, material, UVs and exact shared boundary vertices',()=>{
 const strip=rectangle(-4,-.4,4,.4),patch=rectangle(-1,-1,1,1,(x,z)=>2+x*.13-z*.07),before=[triangles(strip),triangles(patch)],materials=[strip.material,patch.material],old=[strip.geometry,patch.geometry];
 let disposed=0;old.forEach(g=>g.addEventListener('dispose',()=>disposed++));
 const stats=unifyPavement([strip],[patch]);assert.equal(disposed,2);assert.equal(strip.material,materials[0]);assert.equal(patch.material,materials[1]);assert.ok(stats.cutTriangles>0);assert.ok(stats.seamVertices>0);assert.equal(stats.changedMeshes,2);
 assert.ok(Math.abs(projectedArea([strip,patch])-8.8)<1e-6);assertCoverage(before,[strip,patch],[-5,-2,5,2]);
 const patchPositions=new Set(positions(patch).map(p=>p.join(','))),seams=positions(strip).filter(p=>Math.abs(Math.abs(p[0])-1)<1e-7);assert.ok(seams.length>=4);
 for(const p of seams){assert.ok(patchPositions.has(p.join(',')),'both sides retain the same Float32 XYZ');assert.ok(Math.abs(p[1]-(2+p[0]*.13-p[2]*.07))<3e-7);}
 const p=strip.geometry.attributes.position,uv=strip.geometry.attributes.uv,finish=strip.geometry.attributes.roadFinish;
 for(let i=0;i<p.count;i++){assert.ok(Math.abs(uv.getX(i)-p.getX(i)*2)<1e-6);assert.ok(Math.abs(uv.getY(i)-p.getZ(i)*3)<1e-6);assert.ok(Math.abs(finish.getX(i)-(1+p.getX(i)*.01))<1e-6);assert.ok(Math.abs(finish.getY(i)-(.3+p.getZ(i)*.02))<1e-6);assert.equal(finish.getZ(i),1);}
});

test('concave and overlapping junction patches have deterministic first-patch ownership with no holes',()=>{
 const first=polygon([[-3,-2],[1,-2],[1,-.5],[-1,-.5],[-1,2],[-3,2]],(x,z)=>5+x*.04+z*.03),second=rectangle(-2,-1,3,1,()=>1),strip=rectangle(-5,-.3,5,.3,()=>-2),before=[triangles(first),triangles(second),triangles(strip)];
 unifyPavement([strip],[first,second]);assertCoverage(before,[first,second,strip],[-6,-3,6,3]);
 for(const [x,z]of [[-2.5,0],[-1.8,-.8],[.5,-1.2]]){const heights=[first,second,strip].flatMap(m=>samples(triangles(m),x,z));assert.ok(heights.length);assert.ok(heights.every(y=>Math.abs(y-(5+x*.04+z*.03))<1e-6));}
 assert.ok(samples(triangles(second),2,.5).length,'non-overlapped part of the second patch remains');
});

test('curved approaches retain the original pavement footprint and shared road plan',()=>{
 const roads=[{id:'curve',spec:E.ROADS.avenue,stations:streetStations([{x:-12,z:-2},{x:-6,z:-1},{x:0,z:0},{x:5,z:2},{x:10,z:6}])},{id:'cross',spec:E.ROADS.street,stations:streetStations([{x:-1,z:-10},{x:1,z:10}])}],plan=planJunctions(roads),saved=JSON.stringify(plan);
 assert.equal(plan.junctions.length,1);const strips=roads.map(road=>new T.Mesh(streetSurface(road.stations,[[-road.spec.width/2,.08],[road.spec.width/2,.08]],(x,z)=>1+x*.04+z*.02),new T.MeshStandardMaterial()));
 const patches=plan.junctions.map(j=>polygon(junctionCorners(j).flatMap(c=>c.points.map(p=>[p.x,p.z])),(x,z)=>1.2+x*.01+z*.03)),before=[...strips,...patches].map(triangles);
 const stats=unifyPavement(strips,patches);assertCoverage(before,[...strips,...patches],[-14,-12,14,12]);assert.equal(JSON.stringify(plan),saved);assert.ok(stats.outputTriangles<stats.inputTriangles*12,'only local overlap is refined');
});

test('collinear outside connections and fully covered meshes get single coverage without changing unrelated geometry',()=>{
 const first=rectangle(0,-1,10,1,(x)=>x*.03),outside=rectangle(8,-1,30,1,(x)=>x*.03),covered=rectangle(9,-.5,9.8,.5,()=>4),far=rectangle(-40,-1,-30,1),farGeometry=far.geometry,before=[first,outside,covered,far].map(triangles);
 const stats=unifyPavement([first,outside,covered,far],[]);assert.equal(far.geometry,farGeometry);assert.equal(covered.geometry.attributes.position.count,0);assert.equal(stats.emptyMeshes,1);assert.ok(Math.abs(projectedArea([first,outside,covered,far])-80)<1e-5);assertCoverage(before,[first,outside,covered,far],[-45,-2,35,2]);
 assert.ok([...covered.geometry.attributes.position.array].every(Number.isFinite));assert.equal(covered.geometry.boundingSphere.radius,0);
});

test('shared source geometries are not disposed while an unchanged supplied mesh retains them',()=>{
 const first=rectangle(0,0,4,4),same=new T.Mesh(first.geometry,first.material),source=first.geometry;let disposed=0;source.addEventListener('dispose',()=>disposed++);
 const stats=unifyPavement([first,same],[]);assert.equal(first.geometry,source);assert.equal(disposed,0);assert.equal(same.geometry.attributes.position.count,0);assert.equal(stats.emptyMeshes,1);
});

test('nonindexed/interleaved attributes and material groups survive clipping',()=>{
 const strip=rectangle(-3,-.3,3,.3);strip.geometry=strip.geometry.toNonIndexed();const uv=strip.geometry.attributes.uv,array=new Float32Array(uv.count*3);for(let i=0;i<uv.count;i++)array.set([uv.getX(i),99,uv.getY(i)],i*3);
 const data=new T.InterleavedBuffer(array,3);strip.geometry.setAttribute('uv',new T.InterleavedBufferAttribute(data,1,0));strip.geometry.setAttribute('custom',new T.InterleavedBufferAttribute(data,1,2));strip.geometry.clearGroups();strip.geometry.addGroup(0,3,0);strip.geometry.addGroup(3,3,1);const materials=[strip.material,new T.MeshStandardMaterial()];strip.material=materials;
 unifyPavement([strip],[rectangle(-1,-1,1,1,()=>1)]);assert.equal(strip.material,materials);assert.ok(strip.geometry.groups.some(g=>g.materialIndex===0));assert.ok(strip.geometry.groups.some(g=>g.materialIndex===1));
 const p=strip.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Math.abs(strip.geometry.attributes.uv.getX(i)-2*p.getX(i))<1e-6);assert.ok(Math.abs(strip.geometry.attributes.custom.getX(i)-3*p.getZ(i))<1e-6);}
});

test('clipping retains interpolated smooth normals except where seam correction changes a triangle height',()=>{
 const strip=mesh([[-3,0,-.3],[3,0,-.3],[3,0,.3],[-3,0,.3],[10,0,-.3],[14,0,-.3],[14,0,.3],[10,0,.3]],[0,2,1,0,3,2,4,6,5,4,7,6]),normal=strip.geometry.attributes.normal;
 for(let i=0;i<normal.count;i++)normal.setXYZ(i,.2,.97,.1);const expected=[normal.getX(0),normal.getY(0),normal.getZ(0)];
 unifyPavement([strip],[rectangle(-1,-1,1,1,()=>1)]);const p=strip.geometry.attributes.position,n=strip.geometry.attributes.normal;let unchanged=0,corrected=0;
 for(let i=0;i<p.count;i++){const value=[n.getX(i),n.getY(i),n.getZ(i)];if(p.getX(i)>=10){assert.deepEqual(value,expected);unchanged++;}else if(value.some((v,k)=>v!==expected[k]))corrected++;}
 assert.ok(unchanged>=6);assert.ok(corrected>0,'height-corrected seam triangles have their actual face normal');
});

test('real river and island approach scenes have one junction surface and matching seams without altering routes or saved worlds',()=>{
 for(const terrain of ['river','islands']){
  const w=E.createWorld('Junction overlap',terrain,23);w.money=1e8;for(const t of w.tiles)Object.assign(t,{type:null,level:0,construction:undefined});w.roadPaths=[];
  assert.ok(E.buildRoadPath(w,[{x:10,y:24},{x:22,y:18},{x:40,y:24}],'avenue').ok);assert.ok(E.buildRoadPath(w,[{x:32,y:10},{x:32,y:35}],'street').ok);
  const plan=roadGeometry(w,E),saved=JSON.stringify(w),routes=JSON.stringify(plan),base=(x,z)=>Math.max(.32,floorHeight(w,x,z))+.1+wetness(w,x,z)*1.2,bridges=planBridges(plan.roads,(x,z)=>wetness(w,x,z)>.08,base,(x,z)=>groundHeight(w,x,z)),datum=(x,z)=>bridgeHeight(bridges,x,z)??base(x,z);
  const strips=plan.roads.map(road=>new T.Mesh(streetSurface(road.stations,[[-road.spec.width/2,.08],[road.spec.width/2,.08]],datum),new T.MeshStandardMaterial())),patches=plan.junctions.map(j=>polygon(junctionCorners(j).flatMap(c=>c.points.map(p=>[p.x,p.z])),(x,z)=>datum(x,z)+.082)),before=[...strips,...patches].map(triangles);
  const stats=unifyPavement(strips,patches);assert.ok(stats.cutTriangles>0);assert.ok(stats.outputTriangles<stats.inputTriangles*3);assert.equal(JSON.stringify(w),saved);assert.equal(JSON.stringify(plan),routes);
  for(const j of plan.junctions)assertCoverage(before,[...strips,...patches],[j.x-j.radius-3,j.z-j.radius-3,j.x+j.radius+3,j.z+j.radius+3]);
  const patchVertices=new Map(patches.flatMap(positions).map(p=>[p[0]+','+p[2],p[1]]));let joined=0;
  for(const p of strips.flatMap(positions)){const key=p[0]+','+p[2];if(patchVertices.has(key)){assert.equal(p[1],patchVertices.get(key),terrain+' shared seam Y');joined++;}}
  assert.ok(joined>=6,terrain+' clipped approaches actually share boundary vertices');
 }
});

test('spatial bins bound candidate tests on a large separated road network and retain untouched buffers',()=>{
 const strips=Array.from({length:1000},(_,i)=>rectangle((i%50)*12,Math.floor(i/50)*12,(i%50)*12+3,Math.floor(i/50)*12+1)),original=strips.map(m=>m.geometry),stats=unifyPavement(strips,[]);
 assert.equal(stats.changedMeshes,0);assert.equal(stats.outputTriangles,2000);assert.ok(stats.candidateTests<=2000);assert.ok(stats.maxCandidates<=2);assert.ok(stats.indexReferences<8000);assert.equal(stats.oversizedTriangles,0);strips.forEach((m,i)=>assert.equal(m.geometry,original[i]));
});

test('large-coordinate seams share exact Float32 vertices and broad triangles cannot create unbounded grid cells',()=>{
 const patch=rectangle(255.1,-.7,255.8,.7,(x,z)=>3+x*.003+z*.2),strip=rectangle(254.5,-.23,256.3,.23,()=>0),before=[triangles(strip),triangles(patch)];
 unifyPavement([strip],[patch]);assertCoverage(before,[strip,patch],[254.3,-1,256.5,1]);const patchVertices=new Set(positions(patch).map(p=>p.join(',')));
 for(const p of positions(strip))if(Math.abs(p[0]-Math.fround(255.1))<1e-7||Math.abs(p[0]-Math.fround(255.8))<1e-7)assert.ok(patchVertices.has(p.join(',')));
 const broad=mesh([[-10000,0,-10000],[10000,0,-10000],[0,0,10000]]),stats=unifyPavement([], [broad]);assert.equal(stats.oversizedTriangles,1);assert.equal(stats.indexCells,0);
});
