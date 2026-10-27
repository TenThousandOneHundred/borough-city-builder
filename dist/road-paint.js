import * as THREE from './vendor/three.module.js';

// Rendering support only: the road and physical paint position buffers are
// unchanged. The shader integrates the original stripe over a pixel footprint.
export const PAINT_FILTER_RADIUS=.75;
export const PAINT_MAX_EXPANSION=.5;
export const PAINT_MAX_SCALE=64;
export function paintCoverage(distance,halfWidth,pixelWidth){
 if(!Number.isFinite(distance)||!Number.isFinite(halfWidth)||halfWidth<=0)return 0;
 if(!Number.isFinite(pixelWidth)||pixelWidth<=0)return Math.abs(distance)<=halfWidth?1:0;
 const clamp=x=>Math.max(0,Math.min(1,x));
 return clamp((halfWidth-distance)/pixelWidth+.5)-clamp((-halfWidth-distance)/pixelWidth+.5);
}

export function annotatePaintRibbon(geometry){
 const p=geometry.attributes.position;if(!p||p.count<4||p.count%2)return false;
 const data=new Float32Array(p.count*4);
 for(let i=0;i<p.count;i+=2){
  const x=(p.getX(i+1)-p.getX(i))/2,y=(p.getY(i+1)-p.getY(i))/2,z=(p.getZ(i+1)-p.getZ(i))/2;
  data.set([x,y,z,-1],i*4);data.set([x,y,z,1],(i+1)*4);
 }
 geometry.setAttribute('roadPaint',new THREE.BufferAttribute(data,4));geometry.userData.roadPaintPairs=true;return true;
}

// Paint conformance first gives the two physical edges their final heights.
// Carry that cross-slope into the support so it stays on the local road plane.
export function fitPaintRibbon(geometry){
 const p=geometry.attributes.position,a=geometry.attributes.roadPaint;if(!a||!geometry.userData.roadPaintPairs)return;
 for(let i=0;i<p.count;i+=2){const y=(p.getY(i+1)-p.getY(i))/2;a.setY(i,y);a.setY(i+1,y);}a.needsUpdate=true;
}

export function createPaintMaterial(source){
 const material=source.clone(),resolution=new THREE.Vector2(1,1),viewport=new THREE.Vector4();
 material.transparent=true;material.depthWrite=false;material.userData.roadPaint=true;material.userData.roadPaintExpansion=PAINT_MAX_EXPANSION;
 const previousCompile=source.onBeforeCompile,previousRender=source.onBeforeRender;
 material.onBeforeRender=function(renderer,...args){previousRender.call(this,renderer,...args);renderer.getCurrentViewport(viewport);resolution.set(Math.max(1,viewport.z),Math.max(1,viewport.w));};
 material.onBeforeCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);shader.uniforms.roadPaintResolution={value:resolution};
  shader.vertexShader=`attribute vec4 roadPaint;
uniform vec2 roadPaintResolution;
varying vec2 vRoadPaint;
`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float paintHalf=length(roadPaint.xyz);
   float paintScale=1.;
   if(paintHalf>0.0000001){
    vec3 paintCenter=transformed-roadPaint.xyz*roadPaint.w;
    vec3 paintTangent=cross(normal,roadPaint.xyz);
    float tangentLength=length(paintTangent);
    vec4 paintC=projectionMatrix*modelViewMatrix*vec4(paintCenter,1.);
    vec4 paintA=projectionMatrix*modelViewMatrix*vec4(paintCenter+roadPaint.xyz,1.);
    vec4 paintT=projectionMatrix*modelViewMatrix*vec4(paintCenter+paintTangent/max(tangentLength,0.0000001)*paintHalf,1.);
    if(paintC.w>0.0001&&paintA.w>0.0001&&paintT.w>0.0001){
     vec2 across=(paintA.xy/paintA.w-paintC.xy/paintC.w)*roadPaintResolution*.5;
     vec2 along=(paintT.xy/paintT.w-paintC.xy/paintC.w)*roadPaintResolution*.5;
     float alongLength=length(along);
     float halfPixels=alongLength>0.00001?abs(across.x*along.y-across.y*along.x)/alongLength:length(across);
     float desired=1.+${PAINT_FILTER_RADIUS.toFixed(2)}/max(halfPixels,0.0001);
     paintScale=min(desired,min(${PAINT_MAX_SCALE.toFixed(1)},1.+${PAINT_MAX_EXPANSION.toFixed(2)}/paintHalf));
    }
   }
   transformed+=roadPaint.xyz*roadPaint.w*(paintScale-1.);
   vRoadPaint=vec2(roadPaint.w*paintHalf*paintScale,paintHalf);
  `);
  shader.fragmentShader='varying vec2 vRoadPaint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float paintPixel=max(fwidth(vRoadPaint.x),0.0000001);
   float paintCoverage=clamp((vRoadPaint.y-vRoadPaint.x)/paintPixel+.5,0.,1.)-clamp((-vRoadPaint.y-vRoadPaint.x)/paintPixel+.5,0.,1.);
   diffuseColor.a*=paintCoverage;
  `);
 };
 material.customProgramCacheKey=()=> 'borough-road-paint-138-v1/'+source.customProgramCacheKey();
 return material;
}
