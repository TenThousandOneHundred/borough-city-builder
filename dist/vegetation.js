import {loadBinary} from './asset-transfer.js?v=167';
import {treeElevation,elevationTreeMaterial,elevationTreeDepthMaterial} from './tree-impostor.js?v=167';
import {TreeSelection} from './tree-selection.js?v=167';
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export class Vegetation{
 constructor(view){this.v=view;this.prototypes=[];this.impostors=[];this.broadleaf=[];this.ready=this.load()}
 async load(){try{const loader=new THREE.TextureLoader();const atlas=await loader.loadAsync(new URL('./assets/trees/broadleaf-elevations.png?v=117',import.meta.url).href);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;const broadStyle={material:elevationTreeMaterial(atlas),broad:true};this.broadleaf=Array(4).fill(broadStyle);const broadUrl=new URL('./assets/trees/broadleaf.glb?v=117',import.meta.url),broad=await new GLTFLoader().parseAsync(await loadBinary(broadUrl),new URL('.',broadUrl).href);this.broadPrototype=new THREE.Group();const source=broad.scene;this.broadPrototype.add(source);source.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());source.position.set(-center.x,-bounds.min.y,-center.z);this.broadPrototype.scale.setScalar(1/size.y);this.broadPrototype.traverse(o=>{if(o.isMesh){o.userData.sharedAsset=true;o.castShadow=true;o.receiveShadow=true;o.material.envMapIntensity=.2;}});const coniferUrl=new URL('./assets/trees/mature-conifers.glb?v=167',import.meta.url),conifers=await new GLTFLoader().parseAsync(await loadBinary(coniferUrl),new URL('.',coniferUrl).href);
for(const [name,atlasName]of [['MatureSpruce','spruce'],['MaturePine','pine']]){
 const source=conifers.scene.getObjectByName(name);if(!source)throw Error('Missing mature conifer '+name);
 const root=new THREE.Group();root.add(source);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 source.position.set(-center.x,-bounds.min.y,-center.z);root.scale.setScalar(1/size.y);root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh){o.userData.sharedAsset=true;o.castShadow=true;o.receiveShadow=true;o.material.roughness=.9;o.material.envMapIntensity=.25;}});
 const atlas=await loader.loadAsync(new URL('./assets/trees/mature-'+atlasName+'-atlas.png?v=167',import.meta.url).href);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
 this.prototypes.push(root);this.impostors.push({material:elevationTreeMaterial(atlas,{azimuths:8,panelSize:384}),ratio:size.x/size.y});
}}catch(e){console.warn('Vegetation fallback:',e.message)}}
 populate(group,positions,heightAt){
  if(!this.impostors.length)return null;
  const styles=[...this.broadleaf,...this.broadleaf,...this.impostors],objects=[],records=[],meshes=[];
  const styleFor=i=>positions[i][5]==='pine'?this.broadleaf.length*2+i%this.impostors.length:positions[i][5]==='broadleaf'&&this.broadleaf.length?i%(this.broadleaf.length*2):i%styles.length;
  // Keep the legacy species distribution while grouping identical styles once.
  const buckets=new Map();
  for(let i=0;i<positions.length;i++){const style=styleFor(i),key=styles[style];let bucket=buckets.get(key);if(!bucket){bucket={style,indices:[]};buckets.set(key,bucket);}bucket.indices.push(i);}
  for(const {style,indices}of buckets.values()){
   const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(styles[style].material.userData.azimuthViews>1?.6:1.28,1.2),styles[style].material,indices.length);
   if(mesh.material.userData.azimuthViews>1){
    // Blender's eight views fit inside the middle half of every panel.
    // Crop only transparent margins, halving canopy fragment work.
    const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,.25+uv.getX(i)*.5);
    mesh.geometry.setAttribute('treeRotation',new THREE.InstancedBufferAttribute(Float32Array.from(indices,i=>i*2.399),1));
   }
   if(mesh.material.userData.elevationAtlas){this.treeDepth ||= new Map();if(!this.treeDepth.has(mesh.material))this.treeDepth.set(mesh.material,elevationTreeDepthMaterial(mesh.material.map,{azimuths:mesh.material.userData.azimuthViews||1,panelSize:mesh.material.userData.atlasPanelSize||512}));mesh.customDepthMaterial=this.treeDepth.get(mesh.material);}
   mesh.userData.sharedMaterial=true;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);objects.push(mesh);meshes.push(mesh);
   const bounds=new THREE.Box3();
   for(let slot=0;slot<indices.length;slot++){const i=indices[slot],[x,z,h]=positions[i],y=heightAt(x,z);bounds.expandByPoint(new THREE.Vector3(x-h*.9,y-h*.1,z-h*.9));bounds.expandByPoint(new THREE.Vector3(x+h*.9,y+h*1.2,z+h*.9));records.push({i,x,z,h,y,slot,mesh,angle:NaN,elevation:NaN,hidden:false,source:style<this.broadleaf.length*2?this.broadPrototype:this.prototypes[style-this.broadleaf.length*2]});}
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
  if(!moved&&this.facingCamera&&camera.distanceToSquared(this.facingCamera)<.0625){this.lastMatrixWrites=0;return;}
  this.facingCamera ||= new THREE.Vector3();this.facingCamera.copy(camera);
  this.treeDummy ||= new THREE.Object3D();const dummy=this.treeDummy,dirty=new Map();
  for(const r of records){const hidden=near.has(r.i),elevation=r.mesh.material.userData.elevationAtlas?treeElevation(camera,r):0,angle=Math.atan2(camera.x-r.x,camera.z-r.z),difference=Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle));
   if(hidden===r.hidden&&Number.isFinite(r.angle)&&(hidden||Math.abs(difference)<.035&&Math.abs(elevation-r.elevation)<.015))continue;
   dummy.position.set(r.x,r.y+r.h*.54,r.z);dummy.scale.setScalar(hidden?0:r.h);dummy.rotation.set(-elevation,angle,0,'YXZ');dummy.updateMatrix();r.mesh.setMatrixAt(r.slot,dummy.matrix);r.angle=angle;r.elevation=elevation;r.hidden=hidden;
   const previous=dirty.get(r.mesh),start=r.slot*16,end=start+16;dirty.set(r.mesh,previous?[Math.min(previous[0],start),Math.max(previous[1],end)]:[start,end]);
  }
  for(const [mesh,range]of dirty){const attribute=mesh.instanceMatrix;for(const pending of attribute.updateRanges){range[0]=Math.min(range[0],pending.start);range[1]=Math.max(range[1],pending.start+pending.count);}attribute.clearUpdateRanges();attribute.addUpdateRange(range[0],range[1]-range[0]);attribute.needsUpdate=true;}
  this.lastMatrixWrites=[...dirty.values()].reduce((sum,[start,end])=>sum+(end-start)/16,0);
 }
}
