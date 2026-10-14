import * as THREE from './vendor/three.module.js';
// Shared vertices, at most four contiguous draws. Only wholly invisible chunks
// may be skipped; reflection cameras receive their own selection before drawing.
export function coverBatches(positions,normals,colors,material){
 const buckets=new Map();
 for(let i=0;i<positions.length;i+=9){const x=Math.floor((positions[i]+positions[i+3]+positions[i+6])/192),z=Math.floor((positions[i+2]+positions[i+5]+positions[i+8])/192),key=x+','+z;if(!buckets.has(key))buckets.set(key,{x,z,indices:[]});buckets.get(key).indices.push(i);}
 const packed={position:new Float32Array(positions.length),normal:new Float32Array(normals.length),color:new Float32Array(colors.length)},ranges=[];let cursor=0;const point=new THREE.Vector3();
 for(const {indices}of [...buckets.values()].sort((a,b)=>a.z-b.z||a.x-b.x)){
  const start=cursor,box=new THREE.Box3();
  for(const i of indices)for(let k=0;k<9;k++){packed.position[cursor]=positions[i+k];packed.normal[cursor]=normals[i+k];packed.color[cursor]=colors[i+k];cursor++;}
  for(let i=start;i<cursor;i+=3)box.expandByPoint(point.set(packed.position[i],packed.position[i+1],packed.position[i+2]));
  ranges.push({start:start/3,count:(cursor-start)/3,sphere:box.getBoundingSphere(new THREE.Sphere())});
 }
 const geometry=new THREE.BufferGeometry();for(const [name,data]of Object.entries(packed))geometry.setAttribute(name,new THREE.BufferAttribute(data,3));geometry.computeBoundingSphere();
 const root=new THREE.Group(),meshes=[];
 for(let i=0;i<4;i++){const g=i?new THREE.BufferGeometry():geometry;if(i){for(const [name,a]of Object.entries(geometry.attributes))g.setAttribute(name,a);g.boundingSphere=geometry.boundingSphere;}g.setDrawRange(0,i?0:positions.length/3);const mesh=new THREE.InstancedMesh(g,material,1);mesh.boundingSphere=geometry.boundingSphere;mesh.count=i?0:1;mesh.receiveShadow=true;mesh.userData.sharedAsset=true;mesh.userData.sharedMaterial=true;root.add(mesh);meshes.push(mesh);}
 const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),previous=new Float64Array(16).fill(NaN),stats={totalVertices:positions.length/3,totalChunks:ranges.length,visibleVertices:positions.length/3,visibleChunks:1,mode:'whole',replans:0};
 root.userData.cover=true;root.userData.stats=stats;
 const update=camera=>{
  camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(matrix.elements.every((v,i)=>v===previous[i]))return;previous.set(matrix.elements);stats.replans++;
  frustum.setFromProjectionMatrix(matrix);const visible=ranges.map(r=>frustum.intersectsSphere(r.sphere));
  const first=visible.indexOf(true),last=visible.lastIndexOf(true),gaps=[];let selected=[];
  if(first>=0){
   for(let i=first;i<=last;i++)if(!visible[i]){const begin=ranges[i].start;while(i<=last&&!visible[i])i++;gaps.push({start:begin,end:ranges[i].start});}
   const cuts=gaps.sort((a,b)=>(b.end-b.start)-(a.end-a.start)).slice(0,3).sort((a,b)=>a.start-b.start);let start=ranges[first].start;
   for(const cut of cuts){selected.push({start,count:cut.start-start});start=cut.end;}
   selected.push({start,count:ranges[last].start+ranges[last].count-start});
   const count=selected.reduce((sum,r)=>sum+r.count,0);
   if(selected.length>1&&count>stats.totalVertices*.8)selected=[{start:0,count:stats.totalVertices}];
  }
  for(let i=0;i<meshes.length;i++){meshes[i].geometry.setDrawRange(selected[i]?.start||0,selected[i]?.count||0);meshes[i].count=selected[i]?1:0;}
  stats.visibleVertices=selected.reduce((sum,r)=>sum+r.count,0);stats.visibleChunks=selected.length;stats.mode=stats.visibleVertices===stats.totalVertices?'whole':'local';
 };
 root.userData.update=update;for(const mesh of meshes)mesh.onBeforeRender=(_renderer,_scene,camera)=>update(camera);
 let disposed=false;root.userData.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of meshes){mesh.dispose();mesh.geometry.dispose();}material.dispose();};
 return root;
}
