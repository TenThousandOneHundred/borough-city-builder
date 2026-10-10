// World-space terrain texture blending avoids a visible repeated tile pattern.
export function naturalTerrain(material){
 material.onBeforeCompile=shader=>{
 shader.vertexShader='varying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainPosition=(modelMatrix*vec4(position,1.)).xyz;\nvTerrainNormal=normalize(mat3(modelMatrix)*normal);');
 shader.fragmentShader=`varying vec3 vTerrainPosition;varying vec3 vTerrainNormal;
 float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1.,0.)),f.x),mix(terrainHash(i+vec2(0.,1.)),terrainHash(i+vec2(1.,1.)),f.x),f.y);}
 `+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
 #ifdef USE_MAP
 vec2 p=vTerrainPosition.xz;
 float variation=terrainNoise(p*.037),fine=terrainNoise(p*1.7);
 vec3 grassA=texture2D(map,p*.16).rgb;
 vec3 grassB=texture2D(map,mat2(.8,-.6,.6,.8)*p*.073+vec2(.37,.71)).rgb;
 vec3 grass=mix(grassA,grassB,smoothstep(.18,.82,variation));
 // Preserve scanned surface detail while using a temperate grass palette.
 float detail=dot(grass,vec3(.3,.59,.11));
 vec3 meadow=mix(vec3(.105,.155,.064),vec3(.205,.255,.125),variation)*(.65+detail*2.8);
 float shore=1.-smoothstep(.15,1.15,vTerrainPosition.y);
 float slope=1.-abs(normalize(vTerrainNormal).y);
 float stone=smoothstep(.15,.49,slope);
 vec3 soil=mix(vec3(.25,.23,.175),vec3(.36,.335,.255),fine);
 vec3 rock=mix(vec3(.21,.225,.215),vec3(.38,.385,.355),terrainNoise(p*.65))*(.8+fine*.35);
 vec3 surface=mix(meadow,soil,shore*.9);surface=mix(surface,rock,stone);
 diffuseColor.rgb*=surface;
 #endif
 `);
 };
 material.customProgramCacheKey=()=> 'borough-natural-terrain-9';
 return material;
}
