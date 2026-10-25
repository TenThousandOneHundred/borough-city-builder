import * as T from './vendor/three.module.js';
const failed=new WeakSet(),users=new WeakMap();
function applyMaps(material,maps){
 for(const [slot,texture]of Object.entries(maps))if(texture&&!failed.has(texture)){
  material[slot]=texture;if(!users.has(texture))users.set(texture,new Set());users.get(texture).add(material);
 }
}

// One set of photographic surfaces is shared by the industrial catalogue and
// yard props. UVs are authored in metres; no per-building texture allocations.
export class IndustrialSurfaces {
 constructor(renderer,loader=new T.TextureLoader()){
  this.textures={paint:{},bark:{}};const requests=[];
  for(const kind of ['paint','bark'])for(const [slot,file]of [['map','color'],['normalMap','normal'],['roughnessMap','roughness']]){
   requests.push(new Promise(resolve=>{
    const texture=loader.load(new URL(`./assets/industrial/${kind}-${file}.jpg?v=128`,import.meta.url).href,()=>resolve(),undefined,error=>{
     failed.add(texture);for(const material of users.get(texture)||[])if(material[slot]===texture){material[slot]=null;material.needsUpdate=true;}
     console.warn('Industrial surface fallback:',kind,file,error?.message||'image unavailable');resolve();
    });
    texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    texture.colorSpace=slot==='map'?T.SRGBColorSpace:T.NoColorSpace;
    this.textures[kind][slot]=texture;
   }));
  }
  this.ready=Promise.all(requests);
 }
}

export function configureIndustrialPaint(material,textures={}){
 const maps=textures.paint;if(!maps?.map)return material;
 applyMaps(material,maps);material.normalScale.set(.12,.12);
 // Preserve each building's paint palette. Only the photographic wear pattern
 // is borrowed from the rusted source; its orange color would stain every silo.
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
   vec3 wear=texture2D(map,vMapUv).rgb;
   float grain=dot(wear,vec3(.2126,.7152,.0722));
   diffuseColor.rgb*=.84+.35*grain;
  #endif`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
  #ifdef USE_ROUGHNESSMAP
   roughnessFactor*=.84+.16*texture2D(roughnessMap,vRoughnessMapUv).g;
  #endif`);
 };
 material.customProgramCacheKey=()=> 'borough-industrial-paint-128';
 material.userData.industrialSurface='paint';return material;
}

export function configureIndustrialBark(material,textures={}){
 const maps=textures.bark;if(!maps?.map)return material;
 applyMaps(material,maps);material.normalScale.set(.65,.65);
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
  vec3 bark=texture2D(map,vMapUv).rgb;
  diffuseColor.rgb=mix(diffuseColor.rgb,bark,.88);
 #endif`);};
 material.customProgramCacheKey=()=> 'borough-industrial-bark-128';
 material.userData.industrialSurface='bark';return material;
}
