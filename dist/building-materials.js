import * as THREE from './vendor/three.module.js';
export class BuildingMaterials{
 constructor(view){this.view=view;this.cache=new Map();this.ready=false;}
 get(name,tone=0){if(['lit','recess','lawn','blind','solar','balcony'].includes(name))tone=0;const key=name+tone;if(this.cache.has(key))return this.cache.get(key);
  const palettes={masonry:['#9a7661','#8b6558','#ac9681','#756d63','#b29b80'],plaster:['#b1b5ae','#929e9d','#b5ab95','#788689','#c2bcaa'],concrete:['#a3aaa6','#909a96','#b4b6ad','#8c9290','#b3b0a6'],roof:['#505953','#585954','#67675e','#515655','#625950'],metal:['#6d7a7e','#9ca7a7','#586a72','#abb1ac','#7f8a8a'],paving:['#9ba29c','#969d98','#adb0a6','#8b9390','#b3b5ac'],wood:['#817263','#927960','#70665b','#a08b72','#7d7765']};
  let material;
  if(name==='glass')material=new THREE.MeshPhysicalMaterial({color:['#849ca4','#798f9b','#6f8790','#91a3a7','#8c989a'][tone],metalness:.68,roughness:.13,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:1.2,vertexColors:true});
  else if(name==='blind')material=new THREE.MeshStandardMaterial({color:'#999a90',roughness:.96});
  else if(name==='solar')material=new THREE.MeshStandardMaterial({color:'#243d52',metalness:.65,roughness:.22});
  else if(name==='balcony')material=new THREE.MeshPhysicalMaterial({color:'#9aafb0',roughness:.25,metalness:.3});
  else if(name==='recess')material=new THREE.MeshStandardMaterial({color:'#25343d',roughness:.86});
  else if(name==='lit')material=new THREE.MeshStandardMaterial({color:'#c7b997',emissive:'#f6ce91',emissiveIntensity:.32,roughness:.52});
  else if(name==='leaves')material=new THREE.MeshStandardMaterial({color:['#576c43','#526442','#64714e','#485d43','#75805b'][tone],roughness:1});
  else if(name==='lawn')material=this.view.landscape.material('grass',1,'#b7c8a3');
  else{
   const color=(palettes[name]||palettes.concrete)[tone];material=new THREE.MeshStandardMaterial({color,roughness:name==='metal'?.4:.84,metalness:name==='metal'?.45:0});
   const textureName=name==='masonry'?'brick':name==='roof'||name==='paving'?'asphalt':null;
   if(textureName&&this.view.landscape.assets[textureName+'-color']){
    material.map=this.view.landscape.assets[textureName+'-color'];material.normalMap=this.view.landscape.assets[textureName+'-normal'];material.roughnessMap=this.view.landscape.assets[textureName+'-rough'];material.normalScale=new THREE.Vector2(.18,.18);
    // Scans supply surface detail without multiplying the wall tint into darkness.
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec4 sampleColor=texture2D(map,vMapUv);float grain=dot(sampleColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb*=.68+grain*.8;
      #endif`);};material.customProgramCacheKey=()=> 'borough-cladding-11';
   }
  }
  if(['plaster','concrete','masonry'].includes(name)){
   const original=material.onBeforeCompile;
   material.onBeforeCompile=shader=>{original.call(material,shader);shader.vertexShader='varying vec3 facadePoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfacadePoint=(modelMatrix*vec4(position,1.)).xyz;');shader.fragmentShader='varying vec3 facadePoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float streak=sin(facadePoint.x*47.+facadePoint.z*31.)*sin(facadePoint.x*19.-facadePoint.z*29.);
   float weather=.94+.04*streak+.025*sin(facadePoint.y*7.2+facadePoint.x*.7);
   diffuseColor.rgb*=weather;`);};material.customProgramCacheKey=()=> 'borough-weathered-'+name+'-12';
  }
  this.cache.set(key,material);return material;
 }
 reset(){this.cache.forEach(m=>m.dispose());this.cache.clear();}
}
