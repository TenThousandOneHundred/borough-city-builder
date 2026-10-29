import * as THREE from './vendor/three.module.js';

// Muted masonry, slate and painted joinery from the residential street
// references. Values are linear multipliers; the original texture, normal map,
// recessed openings and weathering remain on the shared building geometry.
const palettes=[
 {wall:[.74,.80,.80],roof:[.73,.79,.82],trim:[.65,.69,.68],door:[.30,.43,.45]},
 {wall:[.92,.94,.83],roof:[.81,.79,.72],trim:[.76,.75,.68],door:[.48,.34,.26]},
 {wall:[1.18,1.10,.93],roof:[.86,.83,.75],trim:[.80,.79,.72],door:[.32,.43,.35]},
 {wall:[1.45,.89,.67],roof:[.73,.76,.77],trim:[.80,.79,.73],door:[.33,.38,.43]},
 {wall:[.75,.70,.63],roof:[.76,.72,.67],trim:[.72,.71,.65],door:[.49,.27,.24]},
 {wall:[1.28,1.25,1.13],roof:[.85,.85,.80],trim:[.70,.72,.70],door:[.28,.36,.40]},
 {wall:[.85,.88,.73],roof:[.76,.77,.69],trim:[.78,.77,.68],door:[.33,.37,.28]},
 {wall:[1.18,.87,.72],roof:[.82,.74,.67],trim:[.74,.72,.66],door:[.49,.32,.24]}
];
export function residentialFinish(seed,copy=0){
 let h=(seed^Math.imul(copy+1,0x9e3779b1))>>>0;h=Math.imul(h^(h>>>16),0x21f0aaad);h=Math.imul(h^(h>>>15),0x735a2d97);h=(h^(h>>>15))>>>0;
 const index=h%palettes.length;return {index,...palettes[index]};
}
export function applyResidentialFinish(home,seed,copy=0){
 const finish=residentialFinish(seed,copy),roles={'modern-brick':'wall','modern-roof':'roof','modern-painted':'trim','modern-wood':'door'};
 home.traverse(mesh=>{const role=roles[mesh.material?.name];if(role)mesh.userData.instanceColor=new THREE.Color().setRGB(...finish[role]);});
 home.userData.residentialFinish=finish.index;return finish.index;
}
export function configureResidentialBrick(material){
 if(material.userData.residentialBrick)return;material.userData.residentialBrick=true;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 homeFinish;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   homeFinish=vec3(1.);
   #ifdef USE_INSTANCING_COLOR
    homeFinish=instanceColor;
   #endif
  `);
  shader.fragmentShader='varying vec3 homeFinish;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   // Remove the instance multiplier before neutralizing the photographed red
   // brick, then apply it once to the retained mortar and surface variation.
   vec3 originalBrick=diffuseColor.rgb/max(homeFinish,vec3(.001));
   float brickLight=dot(originalBrick,vec3(.30,.59,.11));
   diffuseColor.rgb=mix(originalBrick,vec3(brickLight),.88)*homeFinish;
  `);
 };
 material.customProgramCacheKey=()=> 'borough-residential-brick-146';
}
