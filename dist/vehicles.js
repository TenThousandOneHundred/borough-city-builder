import {buildVehicle} from './vehicle-model.js?v=171';
import * as THREE from './vendor/three.module.js';
import {MeshBuilder} from './mesh-builder.js?v=171';
const WHITE=new THREE.Color(1,1,1);
export class Vehicles{
 constructor(){this.materials=new Map();}
 rebuildFleet(cars,group){for(const mesh of this.fleet||[]){group.remove(mesh);mesh.dispose();mesh.geometry.dispose()}this.fleet=[];this.transforms=new WeakMap();this.revisions=new WeakMap();this.visibleCars=new Set();const batches=new Map();cars.forEach((car,i)=>{group.remove(car.mesh);car.mesh.updateMatrix();for(const part of car.mesh.children){part.updateMatrix();const material=part.userData.fleetMaterial||part.material,key=(car.mesh.userData.vehicleKind||String(i%8===0))+':'+material.uuid;if(!batches.has(key))batches.set(key,{geometry:part.geometry,material,parts:[]});batches.get(key).parts.push({car,local:part.matrix.clone(),color:part.userData.instanceColor?.clone()});}});for(const {geometry,material,parts}of batches.values()){const mesh=new THREE.InstancedMesh(geometry.clone(),material,parts.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.frustumCulled=false;mesh.userData.parts=parts;mesh.userData.packedCars=[];mesh.userData.packedVersions=[];group.add(mesh);this.fleet.push(mesh)}this.updateFleet(cars);}
 updateFleet(cars,camera){if(!this.fleet)return;this.matrix ||= new THREE.Matrix4();this.transforms ||= new WeakMap();this.revisions ||= new WeakMap();this.changed ||= new Set();this.visibleCars ||= new Set();this.nextVisible ||= new Set();this.changed.clear();this.nextVisible.clear();
 if(camera){this.frustum ||= new THREE.Frustum();this.viewProjection ||= new THREE.Matrix4();this.bounds ||= new THREE.Sphere(new THREE.Vector3(),3);camera.updateMatrixWorld();this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.viewProjection);}
 let layoutChanged=false;
 for(const car of cars){car.mesh.updateMatrix();const previous=this.transforms.get(car);if(!previous||!previous.equals(car.mesh.matrix)){this.changed.add(car);this.revisions.set(car,(this.revisions.get(car)||0)+1);if(previous)previous.copy(car.mesh.matrix);else this.transforms.set(car,car.mesh.matrix.clone());}
 const visible=!camera||(car.mesh.scale.x!==0&&this.frustum.intersectsSphere(this.bounds.set(car.mesh.position,3)));if(visible)this.nextVisible.add(car);if(visible!==this.visibleCars.has(car))layoutChanged=true;}
 const old=this.visibleCars;this.visibleCars=this.nextVisible;this.nextVisible=old;if(!layoutChanged&&!this.changed.size)return;
 for(const mesh of this.fleet){let first=Infinity,last=-1,colorFirst=Infinity,colorLast=-1,count=0;const packed=mesh.userData.packedCars,versions=mesh.userData.packedVersions;
  for(const {car,local,color}of mesh.userData.parts){if(!this.visibleCars.has(car))continue;if(packed[count]!==car||versions[count]!==this.revisions.get(car)){mesh.setMatrixAt(count,this.matrix.multiplyMatrices(car.mesh.matrix,local));if(packed[count]!==car&&(color||mesh.instanceColor)){mesh.setColorAt(count,color||WHITE);colorFirst=Math.min(colorFirst,count*3);colorLast=(count+1)*3;}packed[count]=car;versions[count]=this.revisions.get(car);first=Math.min(first,count*16);last=(count+1)*16;}count++;}
  mesh.count=count;mesh.visible=count>0;
  if(last>=0){
   // Keep pending writes until WebGL consumes them, including frames in which
   // a batch was hidden. A bounded range avoids uploading unused capacity.
   const attribute=mesh.instanceMatrix;for(const range of attribute.updateRanges){first=Math.min(first,range.start);last=Math.max(last,range.start+range.count);}
   attribute.clearUpdateRanges();attribute.addUpdateRange(first,last-first);attribute.needsUpdate=true;
  }
  if(colorLast>=0){const colors=mesh.instanceColor;for(const range of colors.updateRanges){colorFirst=Math.min(colorFirst,range.start);colorLast=Math.max(colorLast,range.start+range.count);}colors.clearUpdateRanges();colors.addUpdateRange(colorFirst,colorLast-colorFirst);colors.needsUpdate=true;
  }
 }}
 mat(name,color,metalness=0,roughness=.7){if(!this.materials.has(name))this.materials.set(name,new THREE.MeshStandardMaterial({color,metalness,roughness}));return this.materials.get(name);}
 createBus(){const b=new MeshBuilder(),body=this.mat('bus-body','#427caa',.3,.4),glass=this.mat('bus-glass','#233c48',.5,.2),trim=this.mat('bus-trim','#dce3df'),tire=this.mat('tire','#242b2d'),lamp=this.mat('bus-lamp','#fff0bd');
 b.box(0,.31,0,.5,.46,2.05,body);b.box(0,.57,-.1,.44,.06,1.8,trim);b.box(0,.4,1.032,.44,.23,.008,glass);b.box(0,.5,1.038,.31,.055,.01,lamp);
 for(const side of [-1,1]){for(let z=-.85;z<.85;z+=.25)b.box(side*.254,.425,z,.008,.18,.205,glass);b.box(side*.257,.22,0,.008,.045,2,trim);for(const z of [-.63,.64]){b.box(side*.252,.1,z,.065,.2,.2,tire);b.box(side*.288,.1,z,.006,.075,.075,trim);}b.box(side*.17,.16,1.038,.065,.045,.012,lamp);}
 for(const z of [.52,-.32]){b.box(.261,.3,z,.009,.35,.22,glass);b.box(.267,.3,z,.008,.35,.018,trim);}
 b.box(0,.62,-.48,.31,.08,.38,trim);const result=b.finish();result.userData.vehicleKind='bus';result.traverse(o=>o.castShadow=true);return result;
 }

 create(seed){
  const kind=seed%8===0?'van':seed%5===0?'suv':'sedan',palette=['#c0c6c5','#456a88','#a33e32','#e4e0d4','#426d57','#30353b','#b6aa85','#b7a32c','#d2d4d4','#644b54','#6d858f','#496247'];
  this.prototypes ||= new Map();
  const body=this.mat('vehicle-body','#ffffff',.48,.28),glass=this.mat('vehicle-glass','#243943',.5,.18),rubber=this.mat('vehicle-rubber','#202528',.02,.8),alloy=this.mat('vehicle-alloy','#7f898b',.8,.25),lamps=this.mat('vehicle-lenses','#ffffff',.2,.3);
  for(const [name,material]of Object.entries({body,glass,rubber,alloy,lamps}))material.name='vehicle-'+name;
  lamps.vertexColors=true;
  if(!this.prototypes.has(kind))this.prototypes.set(kind,buildVehicle(kind,{body,glass,rubber,alloy,lamps}));
  const root=this.prototypes.get(kind).clone(true),paint=this.mat('vehicle-paint-'+seed%palette.length,palette[seed%palette.length],.48,.28);
  for(const mesh of root.children)if(mesh.userData.vehiclePaint){mesh.material=paint;mesh.userData.fleetMaterial=body;mesh.userData.instanceColor=paint.color;}
  return root;
 }
}
