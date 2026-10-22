// Shared ground materials use metres rather than stretching one image over a
// whole property. Existing maps, normal maps and roughness maps stay aligned.
export function lotSurface(material,surface){
 const frequency=surface==='grass'?.8:1.25;
 material.userData.lotSurface=surface;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 lotPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 lotPosition=vec4(transformed,1.);
   #ifdef USE_INSTANCING
   lotPosition=instanceMatrix*lotPosition;
   #endif
   lotPoint=(modelMatrix*lotPosition).xyz;
   // Keep ordinary face UVs on vertical curbs; horizontal surfaces share a
   // continuous projection even across differently sized, rotated instances.
   if(abs(normal.y)>.5){
    vec2 groundUv=lotPoint.xz*${frequency.toFixed(2)};
    #ifdef USE_MAP
    vMapUv=groundUv;
    #endif
    #ifdef USE_NORMALMAP
    vNormalMapUv=groundUv;
    #endif
    #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv=groundUv;
    #endif
   }`);
  if(surface==='grass'){
   // Keep the scanned lawn detail in the terrain's temperate palette.
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
    float grain=dot(texture2D(map,vMapUv).rgb,vec3(.3,.59,.11));
    diffuseColor.rgb*=vec3(.135,.175,.095)*(.48+grain*3.4);
    #endif`);
  }
  if(surface==='paving'){
   shader.fragmentShader='varying vec3 lotPoint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
    float grain=dot(texture2D(map,vMapUv).rgb,vec3(.3,.59,.11));
    diffuseColor.rgb*=.55+grain*1.2;
    #endif
    vec2 tile=abs(fract(lotPoint.xz*5.)-.5);float edge=max(tile.x,tile.y);
    float grout=smoothstep(.48-fwidth(edge),.495,edge);
    diffuseColor.rgb*=mix(1.,.76,grout);`);
  }
 };
 material.customProgramCacheKey=()=> 'borough-lot-surface-94-'+surface;
 return material;
}
export function lotMaterials(landscape){
 return Object.fromEntries([['grass','grass','#c8e0ad'],['paving','asphalt','#93988e'],['asphalt','asphalt','#a7aaa5']].map(([surface,texture,color])=>[surface,lotSurface(landscape.material(texture,1,color),surface)]));
}
