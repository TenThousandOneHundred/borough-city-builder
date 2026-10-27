import * as THREE from './vendor/three.module.js';
import {crossingPhase} from './crossing-control.js?v=139';
import {SIDEWALK_HEIGHT} from './road-profile.js?v=139';
// Original, small signal silhouettes share two instanced meshes city-wide.
function symbol(walking){const vertices=[],triangle=(a,b,c)=>vertices.push(...a,0,...b,0,...c,0),bar=(x,y,u,v,width)=>{const d=Math.hypot(u-x,v-y),nx=-(v-y)/d*width/2,ny=(u-x)/d*width/2,a=[x+nx,y+ny],b=[u+nx,v+ny],c=[u-nx,v-ny],e=[x-nx,y-ny];triangle(a,b,c);triangle(a,c,e);};
 const head=[walking?.07:0,.32];for(let i=0;i<10;i++){const a=i*Math.PI/5,b=(i+1)*Math.PI/5;triangle(head,[head[0]+Math.cos(a)*.095,head[1]+Math.sin(a)*.095],[head[0]+Math.cos(b)*.095,head[1]+Math.sin(b)*.095]);}
 if(walking){bar(.03,.15,-.03,-.08,.13);bar(.02,.11,-.2,-.04,.07);bar(.02,.11,.22,.03,.07);bar(-.03,-.07,-.22,-.36,.09);bar(-.03,-.07,.2,-.29,.09);}else{bar(0,.15,0,-.1,.16);bar(-.13,.13,-.13,-.1,.07);bar(.13,.13,.13,-.1,.07);bar(-.055,-.08,-.055,-.36,.08);bar(.055,-.08,.055,-.36,.08);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}
export function signalHousing(view,group,x,y,z,width,height,depth,yaw){const r=.012,a=width/2,b=height/2,shape=new THREE.Shape();shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:3,steps:1});geometry.translate(0,0,-depth/2);const mesh=new THREE.Mesh(geometry,view.mat('#252d2b'));mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.castShadow=true;group.add(mesh);return mesh;}
export function signalPole(view,group,x,y,z,height){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.017,.022,height,8),view.mat('#a49e68'));mesh.position.set(x,y+height/2,z);mesh.castShadow=true;group.add(mesh);const base=new THREE.Mesh(new THREE.CylinderGeometry(.034,.041,.08,8),view.mat('#707773'));base.position.set(x,y+.04,z);group.add(base);}
export class PedestrianSignals {
 constructor(view,group,world,crossings,height,surfaceHeight=null){this.entries=[];const controlled=crossings.filter(c=>crossingPhase(world,c,0)!=='uncontrolled'),count=controlled.length*2;this.meshes=[];if(!count)return;
  const dummy=new THREE.Object3D();for(const walking of [false,true])this.meshes.push(new THREE.InstancedMesh(symbol(walking),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide}),count));
  for(const c of controlled)for(let side=0;side<2;side++){const end=c.ends[side],other=c.ends[1-side],d=Math.hypot(other.x-end.x,other.z-end.z),tx=(other.x-end.x)/d,tz=(other.z-end.z)/d,x=end.x+c.arm.tx*.4,z=end.z+c.arm.tz*.4,y=surfaceHeight?.(x,z)??height(x,z)+SIDEWALK_HEIGHT,index=this.entries.length;
   signalPole(view,group,x,y,z,.9);const head=signalHousing(view,group,x,y+.84,z,.13,.25,.075,Math.atan2(tx,tz));
   for(let k=0;k<2;k++){dummy.position.set(x+tx*.041,y+.9-k*.11,z+tz*.041);dummy.rotation.set(0,head.rotation.y,0);dummy.scale.setScalar(.105);dummy.updateMatrix();this.meshes[k].setMatrixAt(index,dummy.matrix);this.meshes[k].setColorAt(index,new THREE.Color('#192820'));}this.entries.push({crossing:c,index});
  }this.update(world,0);
 }
 update(world,time){for(const entry of this.entries){const walk=crossingPhase(world,entry.crossing,time)==='walk';for(let k=0;k<2;k++)this.meshes[k].setColorAt(entry.index,new THREE.Color((k===1)===walk?(k?'#5dffa9':'#ff5144'):'#18221d'));}for(const mesh of this.meshes)mesh.instanceColor.needsUpdate=true;}
 dispose(){for(const mesh of this.meshes)mesh.material.dispose();}
}
