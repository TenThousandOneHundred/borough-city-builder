import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {lotPlan} from './building-plan.js?v=17';
import {floorHeight} from './landscape.js?v=17';
// Complete textured assets are loaded once, batched per material, and instanced.
export class ModelLibrary {
 constructor(view){this.view=view;this.models=[];this.materials=new Set();this.lotGeometry=new THREE.PlaneGeometry(1,1);this.lotGeometry.rotateX(-Math.PI/2);this.ready=this.load();}
 async load(){
  const loader=new GLTFLoader();
  await Promise.all(['urban','industry'].map(async file=>{
   try{const {scene}=await loader.loadAsync(new URL(`./assets/buildings/${file}.glb`,import.meta.url).href);
    this.ingest(scene);
   }catch(error){console.warn('Building model fallback:',file,error.message);}
  }));
  try{const [manifest,data]=await Promise.all([fetch(new URL('./assets/buildings/lod.json',import.meta.url)).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),fetch(new URL('./assets/buildings/lod.bin',import.meta.url)).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer()})]);this.ingestLod(manifest,data);}catch(error){console.warn('Distant model fallback:',error.message);}
  this.setNight(this.view.night);
 }
 ingest(scene){
    for(const source of scene.children){
     const batches=new Map(),styled=new Map();source.updateMatrixWorld(true);
     source.traverse(o=>{if(!o.isMesh)return;let geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));for(const attr of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(attr))geometry.deleteAttribute(attr);
      let material=styled.get(o.material);if(!material){material=o.material.clone();styled.set(o.material,material);
       if(/plaster|brick|trim/.test(material.name)&&!source.name.includes('brick')&&!source.name.includes('loft')){
        const palette=['#beb8a4','#c9c7ba','#9babad','#c0b39b','#c6bfb0'];let hash=0;for(const char of source.name)hash=(hash+char.charCodeAt(0))%5;material.color.set(palette[hash]);
        material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
         vec4 texel=texture2D(map,vMapUv);float luminance=dot(texel.rgb,vec3(.3,.59,.11));diffuseColor.rgb*=mix(vec3(luminance),texel.rgb,.12)*1.8;
         #endif`);};material.customProgramCacheKey=()=> 'borough-asset-cladding-13';
       }
      }this.materials.add(material);material.envMapIntensity=.55;material.roughness=Math.max(.24,material.roughness);material.userData.modelAsset=true;
      if(material.name.includes('glass')){material.metalness=.38;material.roughness=.24;material.userData.glass=true;}
      for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key])material[key].anisotropy=Math.min(8,this.view.renderer.capabilities.getMaxAnisotropy());
      if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);
     });
     const root=new THREE.Group();root.name=source.name;
     for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)continue;geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
     const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
     for(const child of root.children){child.geometry.translate(-center.x,-bounds.min.y,-center.z);child.geometry.computeBoundingSphere();}
     this.models.push({name:source.name,category:source.userData.category,size,root});
    }
    // The merged model library owns its buffers, the import hierarchy can go.
    scene.traverse(o=>o.geometry?.dispose());
 }
 ingestLod(manifest,data){for(const model of this.models)model.root.children.forEach((mesh,i)=>{const entry=manifest[model.name]?.[i];if(!entry)return;const geometry=new THREE.BufferGeometry();for(const [name,a]of Object.entries(entry.attributes))geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(data,a.offset,a.count),a.itemSize));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data,entry.index.offset,entry.index.count),1));geometry.computeBoundingSphere();mesh.geometry.userData.lod=geometry;});}
 setNight(on){for(const material of this.materials)if(material.userData.glass){material.emissive.set(on?'#bc9d6e':'#000000');material.emissiveIntensity=on?.23:0;material.emissiveMap=on?material.map:null;material.needsUpdate=true;}}
 create(world,index,parcel){
  if(!this.models.length)return null;const p=lotPlan(world,index,parcel),category=p.low?'residential-low':p.type;
  let candidates=this.models.filter(a=>a.category===category);if(!candidates.length)return null;
  const W=p.lotWidth,D=p.lotDepth,fit=a=>Math.min(.2,(W-.3)/a.size.x,(D-.3)/a.size.z);
  // Favor models that fit at real-world scale; do not stretch facade bays.
  const targetHeight=p.floors*.64;candidates.sort((a,b)=>Math.abs(a.size.y*fit(a)-targetHeight)-Math.abs(b.size.y*fit(b)-targetHeight)||a.name.localeCompare(b.name));
  const asset=candidates[(p.style+p.tone)%Math.min(4,candidates.length)],root=new THREE.Group(),model=asset.root.clone(true),scale=fit(asset);
  model.scale.setScalar(scale);root.add(model);root.rotation.y=p.angle;
  const lawn=category==='residential-low';this.lotMaterials ||= {};
  const lotMaterial=this.lotMaterials[lawn?'grass':'paving'] ||= this.view.landscape.material(lawn?'grass':'asphalt',lawn?2:3,lawn?'#9fb78c':'#a7aaa5');
  const lot=new THREE.Mesh(this.lotGeometry,lotMaterial);lot.scale.set(W-.12,1,D-.12);lot.position.y=-.025;lot.receiveShadow=true;lot.userData.sharedAsset=true;root.add(lot);

  const footprintX=asset.size.x*scale/2,footprintZ=asset.size.z*scale/2;let base=floorHeight(world,p.cx,p.cz);
  for(const x of [-footprintX,footprintX])for(const z of [-footprintZ,footprintZ])base=Math.max(base,floorHeight(world,p.cx+x*Math.cos(p.angle)+z*Math.sin(p.angle),p.cz-x*Math.sin(p.angle)+z*Math.cos(p.angle)));
  root.position.set(p.cx,base+.04,p.cz);root.userData={factory:true,asset:true,model:asset.name,plan:p};return root;
 }
}
