import * as THREE from './vendor/three.module.js';
import {terrainNoise} from './terrain-field.js?v=30.0';
// Small 3D grasses and reeds break up flat ground at street-level camera distances.
export function groundCover(view,world,height,wetness){
 const positions=[],colors=[],normals=[];
 const triangle=(a,b,c,col)=>{const ab=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)),ac=new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)),n=ab.cross(ac).normalize();for(const p of [a,b,c]){positions.push(...p);normals.push(n.x,n.y,n.z);colors.push(...col);}};
 let seed=world.seed>>>0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<11500;i++){
  const x=rand()*330-165,z=rand()*330-165,wet=wetness(world,x,z),gx=Math.floor((x+96)/4),gz=Math.floor((z+96)/4);
  if(gx>=0&&gx<48&&gz>=0&&gz<48){const t=world.tiles[gz*48+gx];if(t.type||t.zone||t.ground==='water')continue;}
  if(wet>.4||terrainNoise(x*.045,z*.045,world.seed+9)<.4||Math.abs(z-2)<3&&x<0)continue;
  const y=height(world,x,z),reed=wet>.12,h=reed?.45+rand()*.34:.08+rand()*.17;
  for(let j=0;j<(reed?6:4);j++){const angle=rand()*Math.PI*2,r=rand()*.18,px=x+Math.cos(angle)*r,pz=z+Math.sin(angle)*r,ww=reed?.018:.03,bend=rand()*.14,dir=rand()*6.28,dx=Math.cos(dir)*ww,dz=Math.sin(dir)*ww;
   triangle([px-dx,y,pz-dz],[px+dx,y,pz+dz],[px+bend,y+h,pz+bend*.5],reed?[.22,.26,.12]:[.2+rand()*.08,.27+rand()*.08,.12]);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.visible=view.detailEnabled!==false;mesh.userData.cover=true;return mesh;
}
