import * as THREE from './vendor/three.module.js';
// Lateral road coordinates and lane spacing ride on the existing pavement mesh.
// Intersections have zero coverage; no decals, extra meshes or frame updates.
export function roadFinishData(geometry,stations,width,spec){
 const data=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<stations.length;i++){
  const p=stations[i],w=typeof width==='function'?width(p):width,median=spec.median?.16:0;
  const laneWidth=spec.oneway?w/spec.lanes:(w/2-median)/Math.max(1,spec.lanes/2);
  const start=spec.oneway?-w/2:median;
  for(let side=0;side<2;side++)data.set([laneWidth,start,1],(i*2+side)*3);
 }
 geometry.setAttribute('roadFinish',new THREE.BufferAttribute(data,3));
}
export function configureRoadFinish(material){
 material.userData.roadFinish=true;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 roadFinish;\nvarying vec3 roadFinishData;\nvarying vec2 roadFinishUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   roadFinishData=roadFinish;roadFinishUv=uv;
  `);
  shader.fragmentShader='varying vec3 roadFinishData;\nvarying vec2 roadFinishUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float laneWidth=max(roadFinishData.x,.1);
   float lanePosition=(abs(roadFinishUv.x)-roadFinishData.y)/laneWidth;
   float trackDistance=abs(abs(fract(lanePosition)-.5)-.23)*laneWidth;
   float trackAA=max(fwidth(roadFinishUv.x),.008);
   float wheelWear=1.-smoothstep(.045-trackAA,.105+trackAA,trackDistance);
   float wearVisibility=1.-smoothstep(.04,.18,trackAA);
   diffuseColor.rgb*=1.-wheelWear*wearVisibility*.16*roadFinishData.z;
  `);
 };
 material.customProgramCacheKey=()=> 'borough-road-wheel-wear-60';return material;
}
