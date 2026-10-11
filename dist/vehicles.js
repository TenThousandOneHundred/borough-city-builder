import * as THREE from './vendor/three.module.js';
import {MeshBuilder} from './mesh-builder.js?v=19';
export class Vehicles{
 constructor(){this.materials=new Map();}
 rebuildFleet(cars,group){for(const mesh of this.fleet||[]){group.remove(mesh);mesh.dispose();mesh.geometry.dispose()}this.fleet=[];this.transforms=new WeakMap();const batches=new Map();cars.forEach((car,i)=>{group.remove(car.mesh);car.mesh.updateMatrix();for(const part of car.mesh.children){part.updateMatrix();const key=(i%8===0)+':'+part.material.uuid;if(!batches.has(key))batches.set(key,{geometry:part.geometry,material:part.material,parts:[]});batches.get(key).parts.push({car,local:part.matrix.clone()});}});for(const {geometry,material,parts}of batches.values()){const mesh=new THREE.InstancedMesh(geometry.clone(),material,parts.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.parts=parts;group.add(mesh);this.fleet.push(mesh)}this.updateFleet(cars);}
 updateFleet(cars){if(!this.fleet)return;this.matrix ||= new THREE.Matrix4();this.transforms ||= new WeakMap();this.changed ||= new Set();this.changed.clear();for(const car of cars){car.mesh.updateMatrix();const previous=this.transforms.get(car);if(!previous||!previous.equals(car.mesh.matrix)){this.changed.add(car);if(previous)previous.copy(car.mesh.matrix);else this.transforms.set(car,car.mesh.matrix.clone());}}if(!this.changed.size)return;
 for(const mesh of this.fleet){let dirty=false;mesh.userData.parts.forEach(({car,local},i)=>{if(!this.changed.has(car))return;mesh.setMatrixAt(i,this.matrix.multiplyMatrices(car.mesh.matrix,local));dirty=true;});if(dirty)mesh.instanceMatrix.needsUpdate=true;}}
 mat(name,color,metalness=0,roughness=.7){if(!this.materials.has(name))this.materials.set(name,new THREE.MeshStandardMaterial({color,metalness,roughness}));return this.materials.get(name);}
 create(seed){const b=new MeshBuilder(),palette=['#bbc3c4','#4c6472','#893e35','#e0dfd3','#536665','#343b43','#a69678'],body=this.mat('car'+seed%7,palette[seed%7],.4,.3),glass=this.mat('glass','#283f4c',.55,.2),tire=this.mat('tire','#242b2d'),chrome=this.mat('chrome','#9ba8ad',.7,.28),head=this.mat('head','#dfdfc9'),tail=this.mat('tail','#9a2821');
 const van=seed%8===0;
 const sections=van?[[-.55,.23,.18],[-.46,.43,.215],[.18,.43,.215],[.36,.26,.21],[.5,.21,.18]]:[[-.46,.18,.17],[-.31,.215,.215],[-.17,.315,.19],[.13,.315,.19],[.29,.21,.215],[.46,.17,.18]];
 const ring=([z,h,w])=>[[-w,.085,z],[w,.085,z],[w,h,z],[-w,h,z]];
 for(let i=0;i<sections.length-1;i++){const a=ring(sections[i]),c=ring(sections[i+1]);for(let k=0;k<4;k++){const j=(k+1)%4;b.quad(a[k],a[j],c[j],c[k],body);}}
 const back=ring(sections[0]),front=ring(sections.at(-1));b.quad(back[3],back[2],back[1],back[0],body);b.quad(front[0],front[1],front[2],front[3],body);
 if(van){b.quad([.185,.425,.182],[-.185,.425,.182],[-.185,.27,.354],[.185,.27,.354],glass);for(const s of [-1,1])b.box(s*.216,.335,.06,.008,.14,.25,glass);}
 else{
  b.quad([.174,.312,.135],[-.174,.312,.135],[-.195,.217,.282],[.195,.217,.282],glass);
  b.quad([-.174,.312,-.174],[.174,.312,-.174],[.195,.218,-.301],[-.195,.218,-.301],glass);
  for(const s of [-1,1]){b.box(s*.195,.268,-.015,.01,.071,.247,glass);b.box(s*.203,.265,-.019,.015,.08,.015,body);}
 }
 for(const s of [-1,1]){
  b.box(s*.12,.165,sections.at(-1)[0]+.003,.1,.042,.017,head);b.box(s*.12,.163,sections[0][0]-.003,.09,.04,.015,tail);
  b.box(s*.233,.245,.10,.057,.028,.049,body);
  for(const z of [-.29,.29]){
   const x=s*.216,r=.082;
   for(let j=0;j<14;j++){const a=j/14*Math.PI*2,c=(j+1)/14*Math.PI*2,p=[.087+Math.cos(a)*r,z+Math.sin(a)*r],q=[.087+Math.cos(c)*r,z+Math.sin(c)*r];b.quad([x-.028,p[0],p[1]],[x+.028,p[0],p[1]],[x+.028,q[0],q[1]],[x-.028,q[0],q[1]],tire);const xx=x+s*.03;b.quad([xx,.087,z],[xx,p[0],p[1]],[xx,q[0],q[1]],[xx,.087,z],s>0?tire:tire);}
   b.box(x+s*.031,.087,z,.012,.073,.073,chrome);
  }
 }
 b.box(0,.12,sections.at(-1)[0]+.005,.16,.05,.016,tire);b.box(0,.13,sections.at(-1)[0]+.017,.083,.026,.007,head);
 const result=b.finish();result.traverse(o=>o.castShadow=true);return result;
 }
}
