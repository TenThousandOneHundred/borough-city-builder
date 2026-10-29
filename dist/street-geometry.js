// Arc-length street geometry. Density of input samples must not change pavement
// texture scale, dash lengths, lamp spacing, or the width around a bend.
import {finishBuild} from './build-scheduler.js?v=151.1';
import * as THREE from './vendor/three.module.js';
export function streetStations(points){
 const clean=[];for(const p of points){if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const last=clean.at(-1);if(!last||Math.hypot(p.x-last.x,p.z-last.z)>1e-6)clean.push({x:p.x,z:p.z});}
 let distance=0;return clean.map((p,i)=>{const a=clean[Math.max(0,i-1)],b=clean[Math.min(clean.length-1,i+1)];if(i)distance+=Math.hypot(p.x-a.x,p.z-a.z);const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;return {...p,distance,tx:dx/length,tz:dz/length,nx:-dz/length,nz:dx/length};});
}
export function atDistance(stations,distance){
 if(stations.length<2)return null;const total=stations.at(-1).distance,d=Math.max(0,Math.min(total,distance));let lo=0,hi=stations.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(stations[m].distance<d)lo=m;else hi=m;}
 const a=stations[lo],b=stations[hi],f=(d-a.distance)/(b.distance-a.distance),tx=a.tx*(1-f)+b.tx*f,tz=a.tz*(1-f)+b.tz*f,l=Math.hypot(tx,tz)||1;
 return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,distance:d,tx:tx/l,tz:tz/l,nx:-tz/l,nz:tx/l};
}
export function distanceSection(stations,start,end){
 if(stations.length<2||end<=start)return [];const a=atDistance(stations,start),b=atDistance(stations,end);return [a,...stations.filter(p=>p.distance>start&&p.distance<end),b];
}
// Profile entries are [lateral offset, elevation above the road datum]. Each
// profile edge gets its own normal so curb faces stay crisp instead of rounded.
export function streetSurface(stations,profile,height){return finishBuild(streetSurfaceSteps(stations,profile,height));}
export function* streetSurfaceSteps(stations,profile,height){
 const positions=[],uv=[],indices=[],profiles=stations.map(p=>typeof profile==='function'?profile(p):profile);
 const heights=stations.map(()=>new Map());
 for(let k=0;k<profiles[0].length-1;k++){
  const base=positions.length/3;
  for(let i=0;i<stations.length;i++){if(i%32===0)yield;const p=stations[i];for(const [offset,raise]of [profiles[i][k],profiles[i][k+1]]){const x=p.x+p.nx*offset,z=p.z+p.nz*offset;const cache=heights[i];if(!cache.has(offset))cache.set(offset,height(x,z));positions.push(x,cache.get(offset)+raise,z);uv.push(offset,p.distance);}}
  for(let i=0;i<stations.length-1;i++){const q=base+i*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function pavementMaterial(){
 const m=new THREE.MeshStandardMaterial({color:'#a6a8a4',roughness:.96});
 m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n');shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 streetUV;').replace('#include <uv_vertex>','#include <uv_vertex>\nstreetUV=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 streetUV;').replace('#include <color_fragment>',`#include <color_fragment>
 vec2 tile=streetUV/vec2(.2,.3);vec2 edge=abs(fract(tile+.5)-.5);vec2 aa=max(fwidth(tile),vec2(.001));
 vec2 joints=smoothstep(vec2(.491)-aa,vec2(.498)+aa,edge);
 float seam=max(joints.x,joints.y)*(1.-smoothstep(.16,.45,max(aa.x,aa.y)));
 float fleck=fract(sin(dot(floor(tile),vec2(127.1,311.7)))*43758.5453);
 diffuseColor.rgb*=mix(.98+fleck*.04,.73,seam*.6);`);};m.customProgramCacheKey=()=> 'street-pavement-129';return m;
}
