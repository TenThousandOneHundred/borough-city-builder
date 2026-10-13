// World-space terrain texture blending avoids a visible repeated tile pattern.
export function naturalTerrain(material,assets={}){
 material.onBeforeCompile=shader=>{
 shader.uniforms.rockSurface={value:assets['rock-color']||material.map};
 shader.uniforms.rockNormal={value:assets['rock-normal']||material.normalMap};
 shader.uniforms.grassNormal={value:assets['grass-normal']||material.normalMap};
 shader.uniforms.grassRoughness={value:assets['grass-rough']||material.roughnessMap};
 shader.vertexShader='varying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainPosition=(modelMatrix*vec4(position,1.)).xyz;\nvTerrainNormal=normalize(mat3(modelMatrix)*normal);');
 shader.fragmentShader=`uniform sampler2D rockSurface,rockNormal,grassNormal,grassRoughness;varying vec3 vTerrainPosition;varying vec3 vTerrainNormal;
 float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1.,0.)),f.x),mix(terrainHash(i+vec2(0.,1.)),terrainHash(i+vec2(1.,1.)),f.x),f.y);}
 vec2 terrainGrassUv(vec2 p){return p*.16;}
 vec2 terrainGrassSecondaryUv(vec2 p){return mat2(.8,-.6,.6,.8)*p*.073+vec2(.37,.71);}
 float terrainBlend(vec2 p){return smoothstep(.18,.82,terrainNoise(p*.037));}
 vec3 terrainRockWeights(vec3 n){vec3 weights=pow(abs(normalize(n)),vec3(4.));return weights/max(.00001,weights.x+weights.y+weights.z);}
 // Derivative-based tangent frames follow each texture projection, including
 // rotated grass layers and both sides of steep cliffs. Flat normal maps keep
 // the actual terrain normal, rather than replacing it with a projection axis.
 vec3 terrainMappedNormal(vec3 position,vec3 n,vec2 uv,vec3 sampleNormal,vec2 scale){
  vec3 q0=dFdx(position),q1=dFdy(position);vec2 st0=dFdx(uv),st1=dFdy(uv);
  vec3 q1perp=cross(q1,n),q0perp=cross(n,q0);
  vec3 t=q1perp*st0.x+q0perp*st1.x,b=q1perp*st0.y+q0perp*st1.y;
  float determinant=max(dot(t,t),dot(b,b)),inverseLength=determinant>1e-20?inversesqrt(determinant):0.;
  vec3 mapNormal=sampleNormal*2.-1.;mapNormal.xy*=scale;
  return normalize(t*inverseLength*mapNormal.x+b*inverseLength*mapNormal.y+n*max(.01,mapNormal.z));
 }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
 #ifdef USE_MAP
 vec2 p=vTerrainPosition.xz;
 float variation=terrainNoise(p*.037),fine=terrainNoise(p*1.7);
 vec3 grassA=texture2D(map,terrainGrassUv(p)).rgb;
 vec3 grassB=texture2D(map,terrainGrassSecondaryUv(p)).rgb;
 vec3 grass=mix(grassA,grassB,terrainBlend(p));
 // Preserve scanned surface detail while using a temperate grass palette.
 float detail=dot(grass,vec3(.3,.59,.11));float micro=terrainNoise(p*6.0);
 vec3 meadow=mix(vec3(.085,.125,.065),vec3(.185,.22,.125),variation)*(.48+detail*3.4+micro*.12);
 float shore=1.-smoothstep(.15,1.15,vTerrainPosition.y);
 float slope=1.-abs(normalize(vTerrainNormal).y);
 float stone=smoothstep(.055,.3,slope);
 vec3 soil=mix(vec3(.25,.23,.175),vec3(.36,.335,.255),fine);
 vec3 weights=terrainRockWeights(vTerrainNormal);
 vec3 rock=texture2D(rockSurface,vTerrainPosition.zy*.11).rgb*weights.x+texture2D(rockSurface,p*.11).rgb*weights.y+texture2D(rockSurface,vTerrainPosition.xy*.11).rgb*weights.z;
 rock*=.75+fine*.25;
 vec3 surface=mix(meadow,soil,shore*.9);surface=mix(surface,rock,stone);
 diffuseColor.rgb*=surface;
 #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
 #ifdef USE_NORMALMAP
 vec2 grassUv=terrainGrassUv(vTerrainPosition.xz),grassUv2=terrainGrassSecondaryUv(vTerrainPosition.xz);
 vec3 grassNormalA=terrainMappedNormal(-vViewPosition,normal,grassUv,texture2D(grassNormal,grassUv).xyz,normalScale);
 vec3 grassNormalB=terrainMappedNormal(-vViewPosition,normal,grassUv2,texture2D(grassNormal,grassUv2).xyz,normalScale);
 vec3 meadowNormal=normalize(mix(grassNormalA,grassNormalB,terrainBlend(vTerrainPosition.xz)));
 vec3 rockWeights=terrainRockWeights(vTerrainNormal);vec2 rockUvX=vTerrainPosition.zy*.11,rockUvY=vTerrainPosition.xz*.11,rockUvZ=vTerrainPosition.xy*.11;
 vec3 cliffNormal=terrainMappedNormal(-vViewPosition,normal,rockUvX,texture2D(rockNormal,rockUvX).xyz,vec2(.4))*rockWeights.x
  +terrainMappedNormal(-vViewPosition,normal,rockUvY,texture2D(rockNormal,rockUvY).xyz,vec2(.4))*rockWeights.y
  +terrainMappedNormal(-vViewPosition,normal,rockUvZ,texture2D(rockNormal,rockUvZ).xyz,vec2(.4))*rockWeights.z;
 float rockBlend=smoothstep(.055,.3,1.-abs(normalize(vTerrainNormal).y));
 normal=normalize(mix(meadowNormal,normalize(cliffNormal),rockBlend));
 #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
 float roughnessFactor=roughness;
 #ifdef USE_ROUGHNESSMAP
 float grassRoughA=texture2D(grassRoughness,terrainGrassUv(vTerrainPosition.xz)).g;
 float grassRoughB=texture2D(grassRoughness,terrainGrassSecondaryUv(vTerrainPosition.xz)).g;
 float groundRoughness=mix(grassRoughA,grassRoughB,terrainBlend(vTerrainPosition.xz));
 float cliffRoughness=smoothstep(.055,.3,1.-abs(normalize(vTerrainNormal).y));
 roughnessFactor*=mix(groundRoughness,.9,cliffRoughness);
 #endif
 `);
 };
 material.customProgramCacheKey=()=> 'borough-natural-terrain-40';
 return material;
}
