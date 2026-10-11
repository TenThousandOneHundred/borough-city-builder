import * as THREE from './vendor/three.module.js';
// A few meshes per building, with all dimensions expressed in world units.
export class MeshBuilder{
 constructor(){this.batches=new Map();}
 batch(material){if(!this.batches.has(material))this.batches.set(material,{p:[],n:[],uv:[],c:[]});return this.batches.get(material);}
 quad(a,b,c,d,material,color=[1,1,1],uvScale=1){
  const batch=this.batch(material),ab=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)),ac=new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)),normal=ab.clone().cross(ac).normalize(),u=ab.length()*uvScale,v=new THREE.Vector3(...d).distanceTo(new THREE.Vector3(...a))*uvScale;
  for(const [point,uv]of [[a,[0,0]],[b,[u,0]],[c,[u,v]],[a,[0,0]],[c,[u,v]],[d,[0,v]]]){batch.p.push(...point);batch.n.push(normal.x,normal.y,normal.z);batch.uv.push(...uv);batch.c.push(...color);}
 }
 box(x,y,z,w,h,d,mat,color){const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;
  this.quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],mat,color);this.quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],mat,color);
  this.quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],mat,color);this.quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],mat,color);
  this.quad([a,e,g],[b,e,g],[b,e,f],[a,e,f],mat,color);this.quad([a,c,f],[b,c,f],[b,c,g],[a,c,g],mat,color);
 }
 cylinder(x,y,z,r,h,mat,segments=12){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,p=[x+Math.cos(a)*r,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,z+Math.sin(b)*r];this.quad([q[0],y,q[1]],[p[0],y,p[1]],[p[0],y+h,p[1]],[q[0],y+h,q[1]],mat);this.quad([x,y+h,z],[q[0],y+h,q[1]],[p[0],y+h,p[1]],[x,y+h,z],mat);}}
 finish(){const root=new THREE.Group();for(const [material,b]of this.batches){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}return root;}
}
