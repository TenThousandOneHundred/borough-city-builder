import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export class ScannedRocks {
 constructor(view){this.view=view;this.parts=[];this.ready=this.load();}
 async load(){try{const {scene}=await new GLTFLoader().loadAsync(new URL('./assets/coast.glb?v=19',import.meta.url).href);scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),scale=1/Math.max(size.x,size.z);
  scene.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(scale,scale,scale);geometry.computeBoundingSphere();o.material.envMapIntensity=.35;this.parts.push({geometry,material:o.material});});scene.traverse(o=>o.geometry?.dispose());
 }catch(e){console.warn('Scanned terrain fallback:',e.message);}}
 populate(group,points,groundHeight,world){if(!this.parts.length)return false;
  const matrix=new THREE.Object3D();for(const {geometry,material}of this.parts){const mesh=new THREE.InstancedMesh(geometry,material,points.length);points.forEach(([x,z,r],i)=>{const scale=2.5+r*5;matrix.position.set(x,groundHeight(world,x,z)-.025,z);matrix.rotation.set(0,i*2.399,0);matrix.scale.setScalar(scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);});mesh.userData.sharedAsset=true;mesh.userData.sharedMaterial=true;mesh.userData.dispose=()=>mesh.dispose();mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}return true;}
}
