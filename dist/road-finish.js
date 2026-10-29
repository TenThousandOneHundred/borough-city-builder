import * as THREE from './vendor/three.module.js';
import {travelHalfWidth} from './road-lanes.js?v=151';
// The source photograph spans 2.1 metres; one world unit represents five.
export const ROAD_TEXTURE_REPEAT=5/2.1;
// Lateral road coordinates and lane spacing ride on the existing pavement mesh.
// Intersections have zero coverage; no decals, extra meshes or frame updates.
export function roadFinishData(geometry,stations,width,spec){
 const data=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<stations.length;i++){
  const p=stations[i],w=typeof width==='function'?width(p):width,median=spec.median?.16:0,edge=travelHalfWidth(spec,w);
  const laneWidth=spec.oneway?edge*2/spec.lanes:(edge-median)/Math.max(1,spec.lanes/2);
  const start=spec.oneway?-edge:median;
  // Keep the ordinary-road payload unchanged. Negative coverage encodes the
  // highway travel edge, so tyre wear cannot repeat across its paved shoulder.
  const coverage=spec.limitedAccess?-edge:1;
  for(let side=0;side<2;side++)data.set([laneWidth,start,coverage],(i*2+side)*3);
 }
 geometry.setAttribute('roadFinish',new THREE.BufferAttribute(data,3));
}
export function configureRoadFinish(material){
 material.userData.roadFinish=true;
 material.normalScale.set(.16,.16);
 for(const slot of ['map','normalMap','roughnessMap'])if(material[slot])material[slot].anisotropy=Math.min(4,material[slot].anisotropy);
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 roadFinish;\nvarying vec3 roadFinishData;\nvarying vec2 roadFinishUv;\n'+shader.vertexShader;
  // Strips use lateral/arc-length UVs, while junctions use plan coordinates.
  // Sample all three photographic maps in one continuous world-space frame;
  // keep the original UVs below solely for lane-relative wheel wear.
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   vec2 roadSurfaceUv=(modelMatrix*vec4(position,1.)).xz;
   #ifdef USE_MAP
    vMapUv=(mapTransform*vec3(roadSurfaceUv,1.)).xy;
   #endif
   #ifdef USE_NORMALMAP
    vNormalMapUv=(normalMapTransform*vec3(roadSurfaceUv,1.)).xy;
   #endif
   #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv=(roughnessMapTransform*vec3(roadSurfaceUv,1.)).xy;
   #endif
  `);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   roadFinishData=roadFinish;roadFinishUv=uv;
  `);
  shader.fragmentShader='varying vec3 roadFinishData;\nvarying vec2 roadFinishUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float laneWidth=max(roadFinishData.x,.1);
   float laneCoordinate=roadFinishData.y<0.?roadFinishUv.x:abs(roadFinishUv.x);
   float lanePosition=(laneCoordinate-roadFinishData.y)/laneWidth;
   float laneCenterDistance=abs(fract(lanePosition)-.5)*laneWidth;
   float trackDistance=abs(laneCenterDistance-.15);
   float trackAA=max(fwidth(roadFinishUv.x),.008);
   float wheelWear=1.-smoothstep(.015-trackAA,.055+trackAA,trackDistance);
   float wearVisibility=1.-smoothstep(.04,.18,trackAA);
   float wearCoverage=roadFinishData.z<0.?1.-smoothstep(-roadFinishData.z-trackAA,-roadFinishData.z+trackAA,abs(roadFinishUv.x)):roadFinishData.z;
   diffuseColor.rgb*=1.-wheelWear*wearVisibility*.065*wearCoverage;
  `);
 };
 material.customProgramCacheKey=()=> 'borough-road-surface-138';return material;
}
