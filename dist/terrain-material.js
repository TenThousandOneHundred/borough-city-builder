// World-space terrain texture blending avoids a visible repeated tile pattern.
export function naturalTerrain(material,assets={},seed=0){
 material.onBeforeCompile=shader=>{
 shader.uniforms.terrainSeed={value:[(seed>>>0)%997,Math.floor((seed>>>0)/997)%991]};
 shader.uniforms.rockSurface={value:assets['rock-color']||material.map};
 shader.uniforms.rockNormal={value:assets['rock-normal']||material.normalMap};
 shader.uniforms.grassNormal={value:assets['grass-normal']||material.normalMap};
 shader.uniforms.grassRoughness={value:assets['grass-rough']||material.roughnessMap};
 shader.vertexShader='varying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainPosition=(modelMatrix*vec4(position,1.)).xyz;\nvTerrainNormal=normalize(mat3(modelMatrix)*normal);');
 shader.fragmentShader=`uniform vec2 terrainSeed;uniform sampler2D rockSurface,rockNormal,grassNormal,grassRoughness;varying vec3 vTerrainPosition;varying vec3 vTerrainNormal;
 float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1.,0.)),f.x),mix(terrainHash(i+vec2(0.,1.)),terrainHash(i+vec2(1.,1.)),f.x),f.y);}
 vec2 terrainGrassUv(vec2 p){return p*.16;}
 vec2 terrainGrassSecondaryUv(vec2 p){return mat2(.8,-.6,.6,.8)*p*.073+vec2(.37,.71);}
 vec3 terrainRockWeights(vec3 n){vec3 weights=pow(abs(normalize(n)),vec3(4.));return weights/max(.00001,weights.x+weights.y+weights.z);}
 // Derivative-based tangent frames follow each texture projection, including
 // rotated grass layers and both sides of steep cliffs. Flat normal maps keep
 // the actual terrain normal, rather than replacing it with a projection axis.
 vec3 terrainMappedNormal(vec3 q0,vec3 q1,vec3 n,vec2 st0,vec2 st1,vec3 sampleNormal,vec2 scale){
  vec3 q1perp=cross(q1,n),q0perp=cross(n,q0);
  vec3 t=q1perp*st0.x+q0perp*st1.x,b=q1perp*st0.y+q0perp*st1.y;
  float determinant=max(dot(t,t),dot(b,b)),inverseLength=determinant>1e-20?inversesqrt(determinant):0.;
  vec3 mapNormal=sampleNormal*2.-1.;mapNormal.xy*=scale;
  return normalize(t*inverseLength*mapNormal.x+b*inverseLength*mapNormal.y+n*max(.01,mapNormal.z));
 }
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
 // Compute shared surface masks once: color, bump and roughness use exactly
 // the same boundaries. Seed offsets do not shift the scanned texture scale.
 vec2 p=vTerrainPosition.xz,region=p*.017+terrainSeed;
 float broad=terrainNoise(region),mottle=terrainNoise(p*.12+terrainSeed.yx);
 float grain=terrainNoise(p*1.7+terrainSeed);
 float grassBlend=smoothstep(.2,.8,mottle);
 vec3 terrainN=normalize(vTerrainNormal);
 float slope=1.-abs(terrainN.y);
 // Broken outcrops follow steep faces, with vegetated pockets and scree below.
 float rockBlend=smoothstep(.105,.39,slope+(mottle-.5)*.19+(grain-.5)*.035);
 float shoreHeight=.72+(mottle-.5)*.6;
 float shoreBlend=1.-smoothstep(.12,shoreHeight,vTerrainPosition.y);
 float wetEdge=1.-smoothstep(.08,.42,vTerrainPosition.y);
 float dryness=clamp((broad-.3)*1.5+(mottle-.5)*.25+slope*.25,0.,1.);
 vec3 rockWeights=terrainRockWeights(terrainN);
 vec2 rockUvX=vTerrainPosition.zy*.11,rockUvY=p*.11,rockUvZ=vTerrainPosition.xy*.11;
 // Derivatives are evaluated before any per-pixel branch. Explicit gradients
 // keep texture mip selection valid where grass and rock meet.
 vec3 terrainDx=dFdx(vTerrainPosition),terrainDy=dFdy(vTerrainPosition);
 #ifdef USE_MAP
 vec3 grassA=texture2D(map,terrainGrassUv(p)).rgb;
 vec3 grassB=texture2D(map,terrainGrassSecondaryUv(p)).rgb;
 float detail=dot(mix(grassA,grassB,grassBlend),vec3(.3,.59,.11));
 vec3 meadow=mix(vec3(.095,.148,.064),vec3(.21,.205,.112),dryness)*(.54+detail*3.2);
 // A darker green lower bank gives way to granular silt and wet sediment.
 meadow*=1.-(1.-smoothstep(.4,2.8,vTerrainPosition.y))*.1;
 vec3 rock=vec3(.3);
 if(rockBlend+shoreBlend>.001){
  rock=textureGrad(rockSurface,rockUvX,terrainDx.zy*.11,terrainDy.zy*.11).rgb*rockWeights.x+textureGrad(rockSurface,rockUvY,terrainDx.xz*.11,terrainDy.xz*.11).rgb*rockWeights.y+textureGrad(rockSurface,rockUvZ,terrainDx.xy*.11,terrainDy.xy*.11).rgb*rockWeights.z;
 }
 float stoneDetail=dot(rock,vec3(.3,.59,.11));
 vec3 soil=mix(vec3(.225,.205,.155),vec3(.34,.315,.25),grain)*(.7+stoneDetail*.8);
 soil*=mix(1.,.53,wetEdge);
 // Slow bedding variation makes broad cliffs readable without extra geometry.
 float strata=.82+.18*terrainNoise(vec2(vTerrainPosition.y*.4+broad*.6,(p.x+p.y)*.07)+terrainSeed);
 rock*=strata*(.83+grain*.17);
 vec3 surface=mix(meadow,rock,rockBlend);
 surface=mix(surface,soil,shoreBlend*(1.-rockBlend*.65));
 diffuseColor.rgb*=surface;
 #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
 #ifdef USE_NORMALMAP
 vec2 grassUv=terrainGrassUv(vTerrainPosition.xz),grassUv2=terrainGrassSecondaryUv(vTerrainPosition.xz);
 vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
 vec3 grassNormalA=terrainMappedNormal(q0,q1,normal,dFdx(grassUv),dFdy(grassUv),texture2D(grassNormal,grassUv).xyz,normalScale);
 vec3 grassNormalB=terrainMappedNormal(q0,q1,normal,dFdx(grassUv2),dFdy(grassUv2),texture2D(grassNormal,grassUv2).xyz,normalScale);
 vec3 meadowNormal=normalize(mix(grassNormalA,grassNormalB,grassBlend));
 vec3 landNormal=meadowNormal;
 if(rockBlend>.001){
  vec3 cliffNormal=terrainMappedNormal(q0,q1,normal,terrainDx.zy*.11,terrainDy.zy*.11,textureGrad(rockNormal,rockUvX,terrainDx.zy*.11,terrainDy.zy*.11).xyz,vec2(.4))*rockWeights.x
   +terrainMappedNormal(q0,q1,normal,terrainDx.xz*.11,terrainDy.xz*.11,textureGrad(rockNormal,rockUvY,terrainDx.xz*.11,terrainDy.xz*.11).xyz,vec2(.4))*rockWeights.y
   +terrainMappedNormal(q0,q1,normal,terrainDx.xy*.11,terrainDy.xy*.11,textureGrad(rockNormal,rockUvZ,terrainDx.xy*.11,terrainDy.xy*.11).xyz,vec2(.4))*rockWeights.z;
  landNormal=normalize(mix(meadowNormal,normalize(cliffNormal),rockBlend));
 }
 // Sediment has lower bump contrast than turf; wetness does not flatten rock.
 normal=normalize(mix(landNormal,normal,shoreBlend*(1.-rockBlend)*.65));
 #endif
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
 float roughnessFactor=roughness;
 #ifdef USE_ROUGHNESSMAP
 float grassRoughA=texture2D(grassRoughness,terrainGrassUv(vTerrainPosition.xz)).g;
 float grassRoughB=texture2D(grassRoughness,terrainGrassSecondaryUv(vTerrainPosition.xz)).g;
 float groundRoughness=mix(grassRoughA,grassRoughB,grassBlend);
 roughnessFactor*=mix(mix(groundRoughness,.92,rockBlend),.62,wetEdge*shoreBlend*(1.-rockBlend));
 #endif
 `);
 };
 material.customProgramCacheKey=()=> 'borough-natural-terrain-101';
 return material;
}
