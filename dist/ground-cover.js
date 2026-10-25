import {coverPlan,coverRandom} from './ground-cover-plan.js?v=122';
import {coverBatches} from './ground-cover-batches.js?v=122';
import * as THREE from './vendor/three.module.js';
// Narrow, curved leaf ribbons replace the old solid triangular grass spikes.
// Shared static buffers retain the bounded draw ranges and reflection handling.
export function groundCover(view,world,height,wetness){
 const positions=[],colors=[],normals=[],plan=coverPlan(world,height,wetness,view.engine||globalThis.CityEngine);
 const vertex=(p,n,color,shade)=>{positions.push(...p);normals.push(...n);colors.push(color[0]*shade,color[1]*shade,color[2]*shade);};
 for(const clump of plan.clumps){const rand=coverRandom(clump.seed,clump.id),reed=clump.kind==='reed',count=reed?5:clump.kind==='verge'?4:6,color=reed?[.16,.205,.075]:[.12+clump.dry*.055,.19+clump.dry*.025,.065+clump.dry*.015];
  for(let j=0;j<count;j++){const angle=j*2.39996+rand()*.6,r=Math.sqrt(rand())*(reed?.13:.1),dx=Math.cos(angle)*r,dz=Math.sin(angle)*r,x=clump.x+dx,z=clump.z+dz,y=clump.y+clump.sx*dx+clump.sz*dz-.007,h=clump.height*(.65+rand()*.5),width=reed?.007+rand()*.006:.004+rand()*.006,turn=angle+(rand()-.5),wx=Math.cos(turn)*width/2,wz=Math.sin(turn)*width/2,bend=h*(.18+rand()*.3),bx=Math.cos(angle)*bend,bz=Math.sin(angle)*bend,n=new THREE.Vector3(-Math.sin(turn),.26,Math.cos(turn)).normalize().toArray();
   const levels=reed?[0,.4,.75,1]:[0,.56,1],rows=levels.map(t=>{const taper=t===1?0:t===0?.75:1-t*.65,cx=x+bx*t*t,cy=y+h*(t-.12*t*t),cz=z+bz*t*t;return [[cx-wx*taper,cy,cz-wz*taper],[cx+wx*taper,cy,cz+wz*taper]];});
   for(let k=1;k<rows.length;k++){const a=rows[k-1],b=rows[k],low=.64+levels[k-1]*.6,high=.64+levels[k]*.6;vertex(a[0],n,color,low);vertex(a[1],n,color,low);vertex(b[0],n,color,high);if(k<rows.length-1){vertex(a[1],n,color,low);vertex(b[1],n,color,high);vertex(b[0],n,color,high);}}
  }
 }
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.45});
 // A soft upward component approximates light scattered through a thin leaf;
 // both faces receive the same sky fill without extra transparent passes.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz)*.8);');};material.customProgramCacheKey=()=> 'borough-grass-ribbons-122';
 const group=coverBatches(positions,normals,colors,material);group.visible=view.detailEnabled!==false;group.userData.clumps=plan.clumps;return group;
}
