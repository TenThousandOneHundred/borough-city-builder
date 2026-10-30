import {finishBuild} from './build-scheduler.js?v=157';
import * as THREE from './vendor/three.module.js';
// Shared vertices, at most four contiguous draws. Only wholly invisible chunks
// may be skipped; reflection cameras receive their own selection before drawing.
export function coverBatches(...args){return finishBuild(coverBatchSteps(...args));}
export function* coverBatchSteps(positions,normals,colors,material,sourceIndices){
 const buckets=new Map(),count=sourceIndices?.length??positions.length/3,source=i=>sourceIndices?sourceIndices[i]:i;
 for(let i=0;i<count;i+=3){if(i%2304===0)yield;const a=source(i)*3,b=source(i+1)*3,c=source(i+2)*3,x=Math.floor((positions[a]+positions[b]+positions[c])/192),z=Math.floor((positions[a+2]+positions[b+2]+positions[c+2])/192),key=x+','+z;if(!buckets.has(key))buckets.set(key,{x,z,indices:[]});buckets.get(key).indices.push(i);}
 const packed={position:new Float32Array(positions.length),normal:new Float32Array(normals.length),color:new Float32Array(colors.length)},indices=new Uint32Array(count),remap=new Uint32Array(positions.length/3),ranges=[];let cursor=0,indexCursor=0;const point=new THREE.Vector3();
 for(const bucket of [...buckets.values()].sort((a,b)=>a.z-b.z||a.x-b.x)){
  const start=indexCursor,box=new THREE.Box3();
  let processed=0;for(const i of bucket.indices){if(processed++%768===0)yield;for(let k=0;k<3;k++){const input=source(i+k);let output=remap[input]-1;if(output<0){output=cursor/3;remap[input]=output+1;for(let j=0;j<3;j++){packed.position[cursor]=positions[input*3+j];packed.normal[cursor]=normals[input*3+j];packed.color[cursor]=colors[input*3+j];cursor++;}}indices[indexCursor++]=output;box.expandByPoint(point.set(packed.position[output*3],packed.position[output*3+1],packed.position[output*3+2]));}}
  ranges.push({start,count:indexCursor-start,sphere:box.getBoundingSphere(new THREE.Sphere())});
 }
 const geometry=new THREE.BufferGeometry();for(const [name,data]of Object.entries(packed))geometry.setAttribute(name,new THREE.BufferAttribute(data.subarray(0,cursor),3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
 const root=new THREE.Group(),meshes=[];
 for(let i=0;i<4;i++){const g=i?new THREE.BufferGeometry():geometry;if(i){for(const [name,a]of Object.entries(geometry.attributes))g.setAttribute(name,a);g.setIndex(geometry.index);g.boundingSphere=geometry.boundingSphere;}g.setDrawRange(0,i?0:count);const mesh=new THREE.InstancedMesh(g,material,1);mesh.boundingSphere=geometry.boundingSphere;mesh.count=i?0:1;mesh.receiveShadow=true;mesh.userData.sharedAsset=true;mesh.userData.sharedMaterial=true;root.add(mesh);meshes.push(mesh);}
 // Draw counts describe index references, not the smaller unique vertex buffer.
 const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),plans=new WeakMap(),stats={totalVertices:count,uniqueVertices:cursor/3,totalChunks:ranges.length,visibleVertices:count,visibleChunks:1,mode:'whole',replans:0};let active;
 root.userData.cover=true;root.userData.stats=stats;
 const update=camera=>{
  camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const cached=plans.get(camera);let selected;
  if(cached&&matrix.elements.every((v,i)=>v===cached.matrix[i])){if(active===cached)return;active=cached;selected=cached.selected;}
  else{stats.replans++;frustum.setFromProjectionMatrix(matrix);const visible=ranges.map(r=>frustum.intersectsSphere(r.sphere));
  const first=visible.indexOf(true),last=visible.lastIndexOf(true),gaps=[];selected=[];
  if(first>=0){
   for(let i=first;i<=last;i++)if(!visible[i]){const begin=ranges[i].start;while(i<=last&&!visible[i])i++;gaps.push({start:begin,end:ranges[i].start});}
   const cuts=gaps.sort((a,b)=>(b.end-b.start)-(a.end-a.start)).slice(0,3).sort((a,b)=>a.start-b.start);let start=ranges[first].start;
   for(const cut of cuts){selected.push({start,count:cut.start-start});start=cut.end;}
   selected.push({start,count:ranges[last].start+ranges[last].count-start});
   const count=selected.reduce((sum,r)=>sum+r.count,0);
   if(selected.length>1&&count>stats.totalVertices*.8)selected=[{start:0,count:stats.totalVertices}];
  }
  active={matrix:new Float64Array(matrix.elements),selected};plans.set(camera,active);}
  for(let i=0;i<meshes.length;i++){meshes[i].geometry.setDrawRange(selected[i]?.start||0,selected[i]?.count||0);meshes[i].count=selected[i]?1:0;}
  stats.visibleVertices=selected.reduce((sum,r)=>sum+r.count,0);stats.visibleChunks=selected.length;stats.mode=stats.visibleVertices===stats.totalVertices?'whole':'local';
 };
 root.userData.update=update;for(const mesh of meshes)mesh.onBeforeRender=(_renderer,_scene,camera)=>update(camera);
 let disposed=false;root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of meshes){mesh.dispose();mesh.geometry.dispose();}material.dispose();};
 return root;
}
