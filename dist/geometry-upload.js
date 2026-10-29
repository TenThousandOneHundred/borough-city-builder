import * as THREE from './vendor/three.module.js';
// Warm real drawing programs and buffers in small batches before replacing the
// visible city. Zero-count draws target a private pixel and retain all detail.
export function* geometryUploadSteps(renderer,entries,lighting=null){
 if(!renderer?.render||!renderer.getRenderTarget)return;
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType}),scene=new THREE.Scene(),camera=new THREE.Camera(),fallback=new THREE.MeshBasicMaterial(),seen=new Set();
 // Borrowed instance buffers must survive staging for the real city draw.
 scene.matrixWorldAutoUpdate=false;
 if(lighting){scene.environment=lighting.environment;scene.fog=lighting.fog;lighting.traverseVisible(o=>{if(o.isLight)scene.children.push(o);});}
 try{
  for(const entry of entries){
   const geometry=entry?.geometry||entry;const identity=entry?.isInstancedMesh?entry:geometry;if(!geometry||seen.has(identity))continue;seen.add(identity);yield;
   const borrowed=!!entry?.isInstancedMesh,mesh=borrowed?entry:entry?.isMesh?entry.clone(false):new THREE.Mesh(geometry,entry?.material||fallback);
   const state={frustumCulled:mesh.frustumCulled,visible:mesh.visible,onBeforeRender:mesh.onBeforeRender,onAfterRender:mesh.onAfterRender,castShadow:mesh.castShadow};
   if(!entry?.isMesh)mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.visible=true;mesh.onBeforeRender=()=>{};mesh.onAfterRender=()=>{};mesh.castShadow=false;
   // Do not reparent a borrowed mesh or dispose its instance attributes.
   scene.children.push(mesh);
   const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,level=renderer.getActiveMipmapLevel?.()||0,range={...geometry.drawRange},shadow=renderer.shadowMap,auto=shadow?.autoUpdate,update=shadow?.needsUpdate,xr=renderer.xr?.enabled;
   try{
    if(shadow){shadow.autoUpdate=false;shadow.needsUpdate=false;}if(renderer.xr)renderer.xr.enabled=false;
    geometry.setDrawRange(0,0);renderer.setRenderTarget(target);renderer.render(scene,camera);
   }finally{
    geometry.setDrawRange(range.start,range.count);renderer.setRenderTarget(previous,face,level);
    if(shadow){shadow.autoUpdate=auto;shadow.needsUpdate=update;}if(renderer.xr)renderer.xr.enabled=xr;
    scene.children.pop();Object.assign(mesh,state);
   }
  }
 }finally{scene.children.length=0;fallback.dispose();target.dispose();}
}
