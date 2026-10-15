import {TreeSelection} from './tree-selection.js?v=65';
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export class Vegetation{
 constructor(view){this.v=view;this.prototypes=[];this.impostors=[];this.broadleaf=[];this.ready=this.load()}
 async load(){try{const loader=new THREE.TextureLoader();this.broadleaf=await Promise.all([0,1,2,3].map(async i=>{const tex=await loader.loadAsync(new URL('./assets/trees/broadleaf-'+i+'.png',import.meta.url).href);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return{material:new THREE.MeshBasicMaterial({map:tex,alphaTest:.3,side:THREE.DoubleSide,fog:true}),broad:true}}));const broad=await new GLTFLoader().loadAsync(new URL('./assets/trees/broadleaf.glb',import.meta.url).href);this.broadPrototype=new THREE.Group();const source=broad.scene;this.broadPrototype.add(source);source.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());source.position.set(-center.x,-bounds.min.y,-center.z);this.broadPrototype.scale.setScalar(1/size.y);this.broadPrototype.traverse(o=>{if(o.isMesh){o.userData.sharedAsset=true;o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=.2;}});const gltf=await new GLTFLoader().loadAsync(new URL('./assets/pine/source.gltf',import.meta.url).href);for(const source of gltf.scene.children){const root=new THREE.Group(),mesh=source.clone(true);mesh.position.set(0,0,0);root.add(mesh);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());mesh.position.set(-center.x,-bounds.min.y,-center.z);root.scale.setScalar(1/size.y);root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh){o.userData.sharedAsset=true;o.castShadow=true;o.receiveShadow=true;o.material.roughness=.9;o.material.envMapIntensity=.35}});this.prototypes.push(root);this.impostors.push(this.bake(root,size.x/size.y));}}catch(e){console.warn('Vegetation fallback:',e.message)}}
 bake(source,ratio){const r=this.v.renderer,scene=new THREE.Scene(),tree=source.clone(true);scene.add(tree,new THREE.HemisphereLight('#e8eef1','#737b57',2));const sun=new THREE.DirectionalLight('#fff1da',2.5);sun.position.set(-3,5,4);scene.add(sun);const camera=new THREE.OrthographicCamera(-.65,.65,.58,-.58,.1,20);camera.position.set(2,.54,4);camera.lookAt(0,.54,0);const target=new THREE.WebGLRenderTarget(384,384,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.UnsignedByteType});const old=r.getRenderTarget(),alpha=r.getClearAlpha(),clear=r.getClearColor(new THREE.Color());r.setRenderTarget(target);r.setClearColor(0,0);r.clear();r.render(scene,camera);r.setRenderTarget(old);r.setClearColor(clear,alpha);const material=new THREE.MeshBasicMaterial({map:target.texture,alphaTest:.35,side:THREE.DoubleSide,color:'#dce2cf',fog:true});return{target,material,ratio}}
 populate(group,positions,heightAt){
  if(!this.impostors.length)return null;
  const styles=[...this.broadleaf,...this.broadleaf,...this.impostors],objects=[],records=[],meshes=[];
  for(let style=0;style<styles.length;style++){
   const indices=positions.map((_,i)=>i).filter(i=>i%styles.length===style),mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.28,1.2),styles[style].material,indices.length);
   mesh.userData.sharedMaterial=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);objects.push(mesh);meshes.push(mesh);
   const bounds=new THREE.Box3();
   for(let slot=0;slot<indices.length;slot++){const i=indices[slot],[x,z,h]=positions[i],y=heightAt(x,z);bounds.expandByPoint(new THREE.Vector3(x-h*.7,y-h*.1,z-h*.7));bounds.expandByPoint(new THREE.Vector3(x+h*.7,y+h*1.2,z+h*.7));records.push({i,x,z,h,y,slot,mesh,angle:NaN,hidden:false,source:i%styles.length<this.broadleaf.length*2?this.broadPrototype:this.prototypes[i%this.prototypes.length]});}
   mesh.boundingSphere=indices.length?bounds.getBoundingSphere(new THREE.Sphere()):new THREE.Sphere(new THREE.Vector3(),0);
  }
  this.population={group,objects,records,meshes,near:new Map()};this.instances=meshes;this.nearCamera=null;this.facingCamera=null;this.lastNight=null;this.update();return objects;
 }
 update(){
  const v=this.v;if(this.lastNight!==v.night){for(const p of [...this.impostors,...this.broadleaf])p.material.color.set(v.night?'#45545f':'#ffffff');this.lastNight=v.night;}
  const population=this.population;if(!population)return;const {records,near,objects,group}=population,camera=v.camera.position,detail=v.detailEnabled!==false;
  const moved=!this.nearCamera||camera.distanceToSquared(this.nearCamera)>=4||this.nearDetail!==detail;
  if(moved){
   this.treeSelection ||= new TreeSelection();const candidates=this.treeSelection.select(records,camera,near,detail),selected=new Set(candidates.map(r=>r.i));let changed=false;
   for(const [i,tree]of near)if(!selected.has(i)){group.remove(tree);objects.splice(objects.indexOf(tree),1);near.delete(i);changed=true;}
   for(const r of candidates)if(!near.has(r.i)){const tree=r.source.clone(true);tree.position.set(r.x,r.y,r.z);tree.scale.multiplyScalar(r.h);tree.rotation.y=r.i*2.399;tree.traverse(o=>{o.userData.sharedAsset=true;o.userData.sharedMaterial=true;});group.add(tree);objects.push(tree);near.set(r.i,tree);changed=true;}
   this.nearCamera ||= new THREE.Vector3();this.nearCamera.copy(camera);this.nearDetail=detail;
   if(changed&&v.renderer?.shadowMap)v.renderer.shadowMap.needsUpdate=true;
  }
  if(!moved&&this.facingCamera&&(camera.x-this.facingCamera.x)**2+(camera.z-this.facingCamera.y)**2<.0625){this.lastMatrixWrites=0;return;}
  this.facingCamera ||= new THREE.Vector2();this.facingCamera.set(camera.x,camera.z);
  this.treeDummy ||= new THREE.Object3D();const dummy=this.treeDummy,dirty=new Map();
  for(const r of records){const hidden=near.has(r.i),angle=Math.atan2(camera.x-r.x,camera.z-r.z),difference=Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle));
   if(hidden===r.hidden&&Number.isFinite(r.angle)&&(hidden||Math.abs(difference)<.035))continue;
   dummy.position.set(r.x,r.y+r.h*.54,r.z);dummy.scale.setScalar(hidden?0:r.h);dummy.rotation.set(0,angle,0);dummy.updateMatrix();r.mesh.setMatrixAt(r.slot,dummy.matrix);r.angle=angle;r.hidden=hidden;
   const previous=dirty.get(r.mesh),start=r.slot*16,end=start+16;dirty.set(r.mesh,previous?[Math.min(previous[0],start),Math.max(previous[1],end)]:[start,end]);
  }
  for(const [mesh,range]of dirty){const attribute=mesh.instanceMatrix;for(const pending of attribute.updateRanges){range[0]=Math.min(range[0],pending.start);range[1]=Math.max(range[1],pending.start+pending.count);}attribute.clearUpdateRanges();attribute.addUpdateRange(range[0],range[1]-range[0]);attribute.needsUpdate=true;}
  this.lastMatrixWrites=[...dirty.values()].reduce((sum,[start,end])=>sum+(end-start)/16,0);
 }
}
