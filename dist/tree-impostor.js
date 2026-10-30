import * as THREE from './vendor/three.module.js';

export function treeElevation(camera,tree){
 return Math.max(0,Math.min(Math.PI/2,Math.atan2(camera.y-tree.y-tree.h*.54,Math.hypot(camera.x-tree.x,camera.z-tree.z))));
}

// Four pre-rendered elevations share one texture and one instanced draw.
// The images are baked from the same detailed tree used at close range.
function configureAtlas(material,shadow=false,{azimuths=1,panelSize=512}={}){
 material.userData.elevationAtlas=true;
 material.userData.azimuthViews=azimuths;
 material.userData.atlasPanelSize=panelSize;
 material.onBeforeCompile=shader=>{
  const yaw=azimuths>1;
  shader.vertexShader='varying float treeView;\n'+(yaw?'attribute float treeRotation;\nvarying float treeYaw;\n':'')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 treeCentre=vec4(0.,0.,0.,1.);
   #ifdef USE_INSTANCING
    treeCentre=instanceMatrix*treeCentre;
   #endif
   vec3 treeDelta=${shadow?'vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2])':'cameraPosition-(modelMatrix*treeCentre).xyz'};
   treeView=clamp(atan(treeDelta.y,max(.0001,length(treeDelta.xz))),0.,1.57079633)*1.90985932;
   ${yaw?`treeYaw=mod((atan(treeDelta.x,treeDelta.z)-treeRotation)*${(azimuths/(Math.PI*2)).toFixed(9)},${azimuths.toFixed(1)});`:''}
  `);
  if(shadow)shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   // The sun sees its own fixed canopy view, independent of the player camera.
   float treeScale=1.;
   #ifdef USE_INSTANCING
    treeScale=length(instanceMatrix[0].xyz);
   #endif
   vec4 mvPosition=viewMatrix*modelMatrix*treeCentre;
   mvPosition.xy+=position.xy*treeScale;
   gl_Position=projectionMatrix*mvPosition;
  `);
  shader.fragmentShader='varying float treeView;\n'+(yaw?'varying float treeYaw;\n':'')+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    float lower=floor(treeView),upper=min(3.,lower+1.),blend=fract(treeView);
    // Clamp inside each atlas panel so filtering cannot bleed into its neighbor.
    vec2 uv=clamp(vMapUv,vec2(.5/${panelSize.toFixed(1)}),vec2(1.-.5/${panelSize.toFixed(1)}));
    ${yaw?`float left=floor(treeYaw),right=mod(left+1.,${azimuths.toFixed(1)}),turn=fract(treeYaw);
    vec4 al=texture2D(map,vec2((uv.x+left)/${azimuths.toFixed(1)},(uv.y+lower)/4.));
    vec4 ar=texture2D(map,vec2((uv.x+right)/${azimuths.toFixed(1)},(uv.y+lower)/4.));
    vec4 bl=texture2D(map,vec2((uv.x+left)/${azimuths.toFixed(1)},(uv.y+upper)/4.));
    vec4 br=texture2D(map,vec2((uv.x+right)/${azimuths.toFixed(1)},(uv.y+upper)/4.));
    // Blend coverage and premultiplied color across view boundaries.
    vec4 a=mix(vec4(al.rgb*al.a,al.a),vec4(ar.rgb*ar.a,ar.a),turn);
    vec4 b=mix(vec4(bl.rgb*bl.a,bl.a),vec4(br.rgb*br.a,br.a),turn);
    a.rgb/=max(.0001,a.a);b.rgb/=max(.0001,b.a);`:`vec4 a=texture2D(map,vec2(uv.x,(uv.y+lower)/4.));
    vec4 b=texture2D(map,vec2(uv.x,(uv.y+upper)/4.));`}
    float alpha=mix(a.a,b.a,blend);
    vec3 color=mix(a.rgb*a.a,b.rgb*b.a,blend)/max(.0001,alpha);
    diffuseColor*=vec4(color,alpha);
   #endif
  `);
 };
 material.customProgramCacheKey=()=> 'borough-tree-elevation-atlas-1'+(azimuths>1?'-yaw'+azimuths+'-panel'+panelSize:'')+(shadow?'-shadow':'');
 return material;
}

export function elevationTreeMaterial(map,options){return configureAtlas(new THREE.MeshBasicMaterial({map,alphaTest:.3,side:THREE.DoubleSide,fog:true}),false,options);}
export function elevationTreeDepthMaterial(map,options){return configureAtlas(new THREE.MeshDepthMaterial({map,alphaTest:.3,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking}),true,options);}
