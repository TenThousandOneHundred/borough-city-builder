import * as THREE from './vendor/three.module.js';
export function lotPerimeter(plan){
 const w=(plan.oriented?plan.lotWidth:plan.parcelWidth)/2-.06,d=(plan.oriented?plan.lotDepth:plan.parcelDepth)/2-.06,points=[];
 const corners=[[-w,-d],[w,-d],[w,d],[-w,d]];
 for(let side=0;side<4;side++){const a=corners[side],b=corners[(side+1)%4],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let i=0;i<steps;i++)points.push({x:a[0]+(b[0]-a[0])*i/steps,z:a[1]+(b[1]-a[1])*i/steps});}
 if(plan.oriented){const c=Math.cos(plan.angle),s=Math.sin(plan.angle);return points.map(p=>({x:p.x*c+p.z*s,z:-p.x*s+p.z*c}));}
 return points;
}
// The lot remains horizontal; each retaining-wall foot follows actual ground.
// Geometry is owned by the lot and merged with other walls by BuildingFactory.
export function lotFoundation(world,plan,base,height){
 const points=lotPerimeter(plan),positions=[],uvs=[];let distance=0;
 const vertex=(p,y,u,v)=>{positions.push(p.x,y,p.z);uvs.push(u,v);};
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.z-a.z),top=-.025;
  const ay=Math.min(top,height(world,plan.cx+a.x,plan.cz+a.z)-base-.08),by=Math.min(top,height(world,plan.cx+b.x,plan.cz+b.z)-base-.08);
  if(Math.min(ay,by)<-.12){
   vertex(a,ay,distance/2,ay/2);vertex(a,top,distance/2,top/2);vertex(b,top,(distance+length)/2,top/2);
   vertex(a,ay,distance/2,ay/2);vertex(b,top,(distance+length)/2,top/2);vertex(b,by,(distance+length)/2,by/2);
  }distance+=length;
 }
 if(!positions.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
