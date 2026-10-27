import {coverPlan,coverRandom} from './ground-cover-plan.js?v=133';
import {coverBatches} from './ground-cover-batches.js?v=133';
import * as THREE from './vendor/three.module.js';
// Narrow, curved leaf ribbons replace the old solid triangular grass spikes.
// Shared static buffers retain the bounded draw ranges and reflection handling.
export function groundCover(view,world,height,wetness){
 const plan=coverPlan(world,height,wetness,view.engine||globalThis.CityEngine),leaves=c=>c.kind==='reed'?5:c.kind==='verge'?4:6;
 let vertexCount=0,indexCount=0;for(const c of plan.clumps){vertexCount+=leaves(c)*(c.kind==='reed'?7:5);indexCount+=leaves(c)*(c.kind==='reed'?15:9);}
 // Each row is shared by its neighboring triangles. Retain double precision
 // positions until spatial packing so chunk boundaries match the original.
 const positions=new Float64Array(vertexCount*3),normals=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),indices=new Uint32Array(indexCount),normal=new THREE.Vector3();let cursor=0,indexCursor=0;
 const vertex=(x,y,z,n,color,shade)=>{positions[cursor]=x;positions[cursor+1]=y;positions[cursor+2]=z;normals[cursor]=n.x;normals[cursor+1]=n.y;normals[cursor+2]=n.z;colors[cursor]=color[0]*shade;colors[cursor+1]=color[1]*shade;colors[cursor+2]=color[2]*shade;cursor+=3;};
 for(const clump of plan.clumps){const rand=coverRandom(clump.seed,clump.id),reed=clump.kind==='reed',count=reed?5:clump.kind==='verge'?4:6,color=reed?[.16,.205,.075]:[.12+clump.dry*.055,.19+clump.dry*.025,.065+clump.dry*.015];
  for(let j=0;j<count;j++){const angle=j*2.39996+rand()*.6,r=Math.sqrt(rand())*(reed?.13:.1),dx=Math.cos(angle)*r,dz=Math.sin(angle)*r,x=clump.x+dx,z=clump.z+dz,y=clump.y+clump.sx*dx+clump.sz*dz-.007,h=clump.height*(.65+rand()*.5),width=reed?.007+rand()*.006:.004+rand()*.006,turn=angle+(rand()-.5),wx=Math.cos(turn)*width/2,wz=Math.sin(turn)*width/2,bend=h*(.18+rand()*.3),bx=Math.cos(angle)*bend,bz=Math.sin(angle)*bend,n=normal.set(-Math.sin(turn),.26,Math.cos(turn)).normalize();
   const levels=reed?[0,.4,.75,1]:[0,.56,1],start=cursor/3;
   for(let k=0;k<levels.length;k++){const t=levels[k],taper=t===1?0:t===0?.75:1-t*.65,cx=x+bx*t*t,cy=y+h*(t-.12*t*t),cz=z+bz*t*t,shade=.64+t*.6;vertex(cx-wx*taper,cy,cz-wz*taper,n,color,shade);if(t!==1)vertex(cx+wx*taper,cy,cz+wz*taper,n,color,shade);}
   for(let k=1;k<levels.length;k++){const a=start+(k-1)*2,b=a+2;indices[indexCursor++]=a;indices[indexCursor++]=a+1;indices[indexCursor++]=b;if(k<levels.length-1){indices[indexCursor++]=a+1;indices[indexCursor++]=b+1;indices[indexCursor++]=b;}}
  }
 }
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.45});
 // A soft upward component approximates light scattered through a thin leaf;
 // both faces receive the same sky fill without extra transparent passes.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz)*.8);');};material.customProgramCacheKey=()=> 'borough-grass-ribbons-122';
 const group=coverBatches(positions,normals,colors,material,indices);group.visible=view.detailEnabled!==false;group.userData.clumps=plan.clumps;return group;
}
