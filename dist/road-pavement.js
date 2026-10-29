import {finishBuild} from './build-scheduler.js?v=150';
import * as THREE from './vendor/three.module.js';

const CELL=4,MAX_CELLS=4096,AREA_EPS=1e-12;
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
const area=vertices=>{let sum=0;for(let i=1;i+1<vertices.length;i++)sum+=cross(vertices[0],vertices[i],vertices[i+1]);return Math.abs(sum)/2;};
// Polygon vertex arrays are immutable after construction. Most fragments pass
// many candidate triangles unchanged, so calculate their bounds only once.
function bounds(vertices){
 if(vertices.pavementBounds)return vertices.pavementBounds;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const vertex of vertices){minX=Math.min(minX,vertex[0]);maxX=Math.max(maxX,vertex[0]);minZ=Math.min(minZ,vertex[2]);maxZ=Math.max(maxZ,vertex[2]);}
 return vertices.pavementBounds={minX,maxX,minZ,maxZ};
}
const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);
const positionKey=v=>v[0]+','+v[2];

// Subtract a convex triangle from a convex fragment. Each outside half-plane
// is emitted once; the still-inside remainder moves on to the next edge.
// If there was no positive-area intersection, retain the original fragment.
function subtract(polygon,triangle){
 let inside=polygon;const outside=[],sign=Math.sign(triangle.determinant);
 for(let edge=0;edge<3&&inside.length>=3;edge++){
  const a=triangle.vertices[edge],b=triangle.vertices[(edge+1)%3],positive=[],negative=[];
  let previous=inside.at(-1),dp=sign*cross(a,b,previous);
  for(const current of inside){
   const dc=sign*cross(a,b,current);
   if((dp<0&&dc>0)||(dp>0&&dc<0)){
    const point=mix(previous,current,dp/(dp-dc));positive.push(point);negative.push(point);
   }
   if(dc>=0)positive.push(current);if(dc<=0)negative.push(current);
   previous=current;dp=dc;
  }
  if(negative.length>=3&&area(negative)>AREA_EPS)outside.push(negative);
  inside=positive;
 }
 return inside.length>=3&&area(inside)>AREA_EPS?outside:null;
}

class TriangleIndex{
 constructor(){this.rows=new Map();this.oversized=[];this.count=0;this.references=0;this.queryStamp=0;this.queries=0;this.singleCellQueries=0;this.sortedQueries=0;}
 add(triangle){
  triangle.id=this.count++;const b=triangle.bounds,x0=Math.floor(b.minX/CELL),x1=Math.floor(b.maxX/CELL),z0=Math.floor(b.minZ/CELL),z1=Math.floor(b.maxZ/CELL);
  if((x1-x0+1)*(z1-z0+1)>MAX_CELLS){this.oversized.push(triangle);return;}
  for(let x=x0;x<=x1;x++){let row=this.rows.get(x);if(!row){row=new Map();this.rows.set(x,row);}for(let z=z0;z<=z1;z++){let bucket=row.get(z);if(!bucket){bucket=[];row.set(z,bucket);}bucket.push(triangle);this.references++;}}
 }
 append(bucket,result,stamp){for(const triangle of bucket)if(triangle.queryStamp!==stamp){triangle.queryStamp=stamp;result.push(triangle);}}
 query(b,result){
  this.queries++;result.length=0;
  const x0=Math.floor(b.minX/CELL),x1=Math.floor(b.maxX/CELL),z0=Math.floor(b.minZ/CELL),z1=Math.floor(b.maxZ/CELL);
  // A single bucket already has unique entries in ownership order. It is only
  // borrowed while clipping or checking seams; neither operation adds entries.
  if(x0===x1&&z0===z1&&!this.oversized.length){this.singleCellQueries++;return this.rows.get(x0)?.get(z0)||result;}
  const stamp=++this.queryStamp;
  // Broad individual triangles query existing cells instead of walking a huge
  // empty range. Normal road triangles take only the nearby small buckets.
  if((x1-x0+1)*(z1-z0+1)>MAX_CELLS){for(const [x,row]of this.rows)if(x>=x0&&x<=x1)for(const [z,bucket]of row)if(z>=z0&&z<=z1)this.append(bucket,result,stamp);}
  else for(let x=x0;x<=x1;x++){const row=this.rows.get(x);if(row)for(let z=z0;z<=z1;z++){const bucket=row.get(z);if(bucket)this.append(bucket,result,stamp);}}
  this.append(this.oversized,result,stamp);this.sortedQueries++;
  // Spatial buckets may discover the same owners in a different order.
  return result.sort((a,b)=>a.id-b.id);
 }
}

function contains(triangle,point,epsilon){
 const vertices=triangle.vertices,sign=Math.sign(triangle.determinant);
 for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3];if(sign*cross(a,b,point)<-epsilon*Math.hypot(b[0]-a[0],b[2]-a[2]))return false;}
 return true;
}
function height(triangle,point){
 const [a,b,c]=triangle.vertices,u=((point[0]-a[0])*(c[2]-a[2])-(point[2]-a[2])*(c[0]-a[0]))/triangle.determinant,v=((b[0]-a[0])*(point[2]-a[2])-(b[2]-a[2])*(point[0]-a[0]))/triangle.determinant;
 return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
}
function attributeLayout(geometry){
 const result=[];let offset=3;
 for(const [name,attribute]of Object.entries(geometry.attributes))if(name!=='position'){
  result.push({name,attribute,offset,size:attribute.itemSize});offset+=attribute.itemSize;
 }
 return result;
}
function readVertex(geometry,layout,index){
 const position=geometry.attributes.position,vertex=[position.getX(index),position.getY(index),position.getZ(index)];
 for(const {attribute,size}of layout){const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array,offset=attribute.isInterleavedBufferAttribute?index*attribute.data.stride+attribute.offset:index*size;for(let k=0;k<size;k++)vertex.push(array[offset+k]);}
 return vertex;
}
function record(vertices,state,materialIndex,normalDirty=false){return {vertices,state,materialIndex,normalDirty,determinant:cross(...vertices),bounds:bounds(vertices),splits:[null,null,null]};}
function faceNormal([a,b,c]){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,length=Math.hypot(x,y,z)||1;return [x/length,y/length,z/length];}

/**
 * Resolve world-space pavement coverage at build time. Earlier patches win,
 * followed by earlier strips. Geometry/material identity is retained whenever
 * no overlap or seam subdivision affects a mesh. All returned stats are plain
 * numbers; fully covered meshes receive valid empty geometry.
 */
export function unifyPavement(strips,patches){return finishBuild(unifyPavementSteps(strips,patches));}
export function* unifyPavementSteps(strips,patches){
 const stats={inputTriangles:0,outputTriangles:0,changedMeshes:0,emptyMeshes:0,cutTriangles:0,seamVertices:0,candidateTests:0,maxCandidates:0,indexTriangles:0,indexReferences:0,indexCells:0,oversizedTriangles:0};
 const meshes=[...new Set([...patches,...strips])],states=meshes.map(mesh=>({mesh,source:mesh.geometry,layout:attributeLayout(mesh.geometry),triangles:[],changed:false})),index=new TriangleIndex(),canonical=new Map(),candidateScratch=[],seamScratch=[];
 let magnitude=1;for(const {source}of states){const p=source.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(Number.isFinite(x)&&Number.isFinite(z))magnitude=Math.max(magnitude,Math.abs(x),Math.abs(z));}}
 const epsilon=Math.max(1e-6,magnitude*2**-23);

 function seam(vertex,state){
  const point=[Math.fround(vertex[0]),Math.fround(vertex[1]),Math.fround(vertex[2])],key=positionKey(point),near=index.query({minX:point[0]-epsilon,maxX:point[0]+epsilon,minZ:point[2]-epsilon,maxZ:point[2]+epsilon},seamScratch);
  const winner=near.find(triangle=>contains(triangle,point,epsilon));
  if(canonical.has(key))point[1]=canonical.get(key)[1];else{if(winner)point[1]=Math.fround(height(winner,point));canonical.set(key,point);}
  if(point[0]!==vertex[0]||point[1]!==vertex[1]||point[2]!==vertex[2])state.changed=true;
  const result=vertex.slice();result[0]=point[0];result[1]=point[1];result[2]=point[2];
  // Insert every new seam point into both sides of a winning triangle edge.
  // A later centroid fan keeps these collinear boundary vertices explicit.
  if(winner)for(const triangle of near)for(let edge=0;edge<3;edge++){
   const a=triangle.vertices[edge],b=triangle.vertices[(edge+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],length2=dx*dx+dz*dz;if(length2<=AREA_EPS)continue;
   const t=((point[0]-a[0])*dx+(point[2]-a[2])*dz)/length2;
   if(t<=1e-7||t>=1-1e-7||Math.abs(cross(a,b,point))>epsilon*Math.sqrt(length2))continue;
   const splits=triangle.splits[edge] ||= new Map();if(!splits.has(key)){
    const split=mix(a,b,t);split[0]=point[0];split[1]=point[1];split[2]=point[2];splits.set(key,{t,vertex:split});triangle.state.changed=true;stats.seamVertices++;
   }
  }
  return result;
 }

 for(const state of states){
  const geometry=state.source,p=geometry.attributes.position,indices=geometry.index,count=indices?.count??p.count,hasGroups=geometry.groups.length>0;
  for(let at=0;at+2<count;at+=3){if(at%192===0)yield;
   stats.inputTriangles++;const vertices=[0,1,2].map(k=>readVertex(geometry,state.layout,indices?indices.getX(at+k):at+k)),materialIndex=hasGroups?(geometry.groups.find(group=>at>=group.start&&at<group.start+group.count)?.materialIndex??0):0;
   if(!vertices.every(v=>v.slice(0,3).every(Number.isFinite))||Math.abs(cross(...vertices))<=AREA_EPS){state.triangles.push(record(vertices,state,materialIndex));continue;}
   const sourceTriangle={vertices,determinant:cross(...vertices),bounds:bounds(vertices)},candidates=index.query(sourceTriangle.bounds,candidateScratch);stats.maxCandidates=Math.max(stats.maxCandidates,candidates.length);let fragments=[vertices],cut=false;
   for(const triangle of candidates){
    const next=[];for(const polygon of fragments){if(!overlaps(bounds(polygon),triangle.bounds)){next.push(polygon);continue;}stats.candidateTests++;const difference=subtract(polygon,triangle);if(difference===null)next.push(polygon);else{cut=true;next.push(...difference);}}
    fragments=next;if(!fragments.length)break;
   }
   if(cut){state.changed=true;stats.cutTriangles++;}
   for(const polygon of fragments){const points=polygon.map(vertex=>seam(vertex,state));for(let k=1;k+1<points.length;k++){
    const vertices=[points[0],points[k],points[k+1]],normalDirty=vertices.some(point=>Math.abs(point[1]-height(sourceTriangle,point))>epsilon),triangle=record(vertices,state,materialIndex,normalDirty);if(Math.abs(triangle.determinant)<=AREA_EPS)continue;state.triangles.push(triangle);index.add(triangle);
   }}
  }
 }

 for(const state of states){yield;
  const output=[];
  for(const triangle of state.triangles){
   if(!triangle.splits.some(points=>points?.size)){output.push(triangle);continue;}
   const ring=[];for(let edge=0;edge<3;edge++){ring.push(triangle.vertices[edge]);if(triangle.splits[edge])ring.push(...[...triangle.splits[edge].values()].sort((a,b)=>a.t-b.t).map(point=>point.vertex));}
   const [a,b,c]=triangle.vertices,centre=a.map((value,i)=>(value+b[i]+c[i])/3);centre[0]=Math.fround(centre[0]);centre[1]=Math.fround(centre[1]);centre[2]=Math.fround(centre[2]);
   for(let k=0;k<ring.length;k++){const vertices=[centre,ring[k],ring[(k+1)%ring.length]],normalDirty=triangle.normalDirty||vertices.some(point=>Math.abs(point[1]-height(triangle,point))>epsilon);if(Math.abs(cross(...vertices))>AREA_EPS)output.push({vertices,materialIndex:triangle.materialIndex,normalDirty});}
  }
  stats.outputTriangles+=output.length;
  if(!state.changed)continue;
  const geometry=new THREE.BufferGeometry(),positions=[],values=state.layout.map(()=>[]);let groupStart=0,groupMaterial=output[0]?.materialIndex??0;
  for(let i=0;i<output.length;i++){
   const triangle=output[i],normal=triangle.normalDirty?faceNormal(triangle.vertices):null;if(state.source.groups.length&&triangle.materialIndex!==groupMaterial){geometry.addGroup(groupStart,i*3-groupStart,groupMaterial);groupStart=i*3;groupMaterial=triangle.materialIndex;}
   for(const vertex of triangle.vertices){positions.push(...vertex.slice(0,3));state.layout.forEach(({name,offset,size},k)=>{for(let n=0;n<size;n++)values[k].push(name==='normal'&&normal?normal[n]:vertex[offset+n]);});}
  }
  if(state.source.groups.length&&output.length)geometry.addGroup(groupStart,output.length*3-groupStart,groupMaterial);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  state.layout.forEach(({name,attribute,size},k)=>{const original=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array,ArrayType=original.constructor,attributeValues=ArrayType===Float32Array||ArrayType===Float64Array?values[k]:values[k].map(Math.round),replacement=new THREE.BufferAttribute(new ArrayType(attributeValues),size,attribute.normalized);replacement.name=attribute.name;replacement.setUsage(attribute.usage??attribute.data?.usage??THREE.StaticDrawUsage);geometry.setAttribute(name,replacement);});
  geometry.name=state.source.name;geometry.userData={...state.source.userData};geometry.computeBoundingBox();geometry.computeBoundingSphere();state.mesh.geometry=geometry;stats.changedMeshes++;if(!positions.length)stats.emptyMeshes++;
 }
 // Shared source buffers are disposed once, and only when no supplied mesh
 // still retains them. No source materials or textures are owned here.
 const retained=new Set(states.map(state=>state.mesh.geometry)),disposed=new Set();for(const {source}of states)if(!retained.has(source)&&!disposed.has(source)){source.dispose();disposed.add(source);}
 stats.indexTriangles=index.count;stats.indexReferences=index.references;stats.oversizedTriangles=index.oversized.length;stats.indexQueries=index.queries;stats.singleCellQueries=index.singleCellQueries;stats.sortedQueries=index.sortedQueries;for(const row of index.rows.values())stats.indexCells+=row.size;
 return stats;
}
