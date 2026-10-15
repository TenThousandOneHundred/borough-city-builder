import {addWindowRooms,configureWindowLighting} from './window-lighting.js?v=60';
import {loadBinary} from './asset-transfer.js?v=60';
import {SiteDetails} from './site-details.js?v=60';
import {lotFoundation,lotPerimeter} from './lot-foundation.js?v=60';
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {lotPlan} from './building-plan.js?v=60';
import {floorHeight} from './landscape.js?v=60';
const IDENTITY=new THREE.Matrix4();
const civicDefaults={hospital:'clinic',school:'elementary',police:'police',fire:'fire'};
// Complete textured assets are loaded once, batched per material, and instanced.
export class ModelLibrary {
 constructor(view){this.view=view;this.models=[];this.materials=new Set();this.lotGeometry=new THREE.PlaneGeometry(1,1);this.lotGeometry.rotateX(-Math.PI/2);this.ready=this.load();}
 async load(){
  const loader=new GLTFLoader();
  // Fetch the distant indices alongside the models instead of adding another
  // large download after all three catalogues have finished.
  const distant=Promise.all([fetch(new URL('./assets/buildings/lod.json?v=53',import.meta.url)).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),loadBinary(new URL('./assets/buildings/lod.bin?v=53',import.meta.url))]).then(value=>({value}),error=>({error}));
  await Promise.all(['urban','industry','modern'].map(async file=>{
   try{const url=new URL(`./assets/buildings/${file}.glb?v=${file==='modern'?'43':21}`,import.meta.url),{scene}=file==='modern'?await loader.parseAsync(await loadBinary(url),new URL('.',url).href):await loader.loadAsync(url.href);
    this.ingest(scene);
   }catch(error){console.warn('Building model fallback:',file,error.message);}
  }));
  try{const result=await distant;if(result.error)throw result.error;this.ingestLod(...result.value);}catch(error){console.warn('Distant model fallback:',error.message);}
  this.setNight(this.view.night);
 }
 ingest(scene){
    for(const source of scene.children){
     const batches=new Map(),styled=new Map();source.updateMatrixWorld(true);
     source.traverse(o=>{if(!o.isMesh)return;let geometry=o.geometry.clone();if(!o.matrixWorld.equals(IDENTITY))geometry.applyMatrix4(o.matrixWorld);if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));for(const attr of Object.keys(geometry.attributes))if(!['position','normal','uv','color'].includes(attr))geometry.deleteAttribute(attr);
      const modern=source.userData.family==='modern';this.modernMaterials ||= new Map();const materialCache=modern?this.modernMaterials:styled;let material=materialCache.get(o.material);if(!material){material=o.material.clone();materialCache.set(o.material,material);
       if(!modern&&/plaster|brick|trim/.test(material.name)&&!source.name.includes('brick')&&!source.name.includes('loft')){
        const palette=['#beb8a4','#c9c7ba','#9babad','#c0b39b','#c6bfb0'];let hash=0;for(const char of source.name)hash=(hash+char.charCodeAt(0))%5;material.color.set(palette[hash]);
        material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
         vec4 texel=texture2D(map,vMapUv);float luminance=dot(texel.rgb,vec3(.3,.59,.11));diffuseColor.rgb*=mix(vec3(luminance),texel.rgb,.12)*1.8;
         #endif`);};material.customProgramCacheKey=()=> 'borough-asset-cladding-13';
       }
      }if(modern&&material.name==='modern-concrete'&&!material.userData.weathered){
       material.userData.weathered=true;
       material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 modernPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmodernPoint=position;');shader.fragmentShader='varying vec3 modernPoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float stain=sin(modernPoint.x*13.1+modernPoint.z*17.3)*sin(modernPoint.x*5.7-modernPoint.z*7.9);
        diffuseColor.rgb*=.94+.035*stain+.02*sin(modernPoint.y*2.3+modernPoint.x*.3);`);};material.customProgramCacheKey=()=> 'borough-modern-concrete-21';
      }this.materials.add(material);material.envMapIntensity=.55;material.roughness=Math.max(.24,material.roughness);material.userData.modelAsset=true;
      if(material.name.includes('glass')){if(!modern){material.metalness=.38;material.roughness=.24;}else material.envMapIntensity=.85;material.userData.glass=true;if(modern&&['modern-glass','modern-glass-occupied'].includes(material.name))configureWindowLighting(material);}
      for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key])material[key].anisotropy=Math.min(8,this.view.renderer.capabilities.getMaxAnisotropy());
      if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);
     });
     const root=new THREE.Group();root.name=source.name;
     for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)continue;geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.userData.sharedAsset=true;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
     const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
     for(const child of root.children){child.geometry.translate(-center.x,-bounds.min.y,-center.z);child.geometry.computeBoundingSphere();if(child.material.userData.roomLighting)addWindowRooms(child.geometry);}
     this.models.push({name:source.name,category:source.userData.category,family:source.userData.family||'masonry',floors:source.userData.floors,building:source.userData.building,site:!!source.userData.site,houseForm:source.userData.houseForm,roofForm:source.userData.roofForm,gardens:source.userData.gardens||[],streetFronts:source.userData.streetFronts||[],origin:{x:-center.x,y:-bounds.min.y,z:-center.z},size,root});
    }
    // The merged model library owns its buffers, the import hierarchy can go.
    scene.traverse(o=>o.geometry?.dispose());
 }
 ingestLod(manifest,data){for(const model of this.models)model.root.children.forEach((mesh,i)=>{const entry=manifest[model.name]?.[i];if(!entry)return;const geometry=new THREE.BufferGeometry();if(entry.sharedAttributes)for(const [name,a]of Object.entries(mesh.geometry.attributes))geometry.setAttribute(name,a);for(const [name,a]of Object.entries(entry.attributes||{}))geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(data,a.offset,a.count),a.itemSize));geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data,entry.index.offset,entry.index.count),1));geometry.computeBoundingSphere();mesh.geometry.userData.lod=geometry;});}
 setNight(on){for(const material of this.materials)if(material.userData.glass){const lit=on;if(material.userData.roomLightingState)material.userData.roomLightingState.value=on?1:0;material.emissive.set(lit?(material.userData.roomLighting?'#ffffff':'#bc9d6e'):'#000000');material.emissiveIntensity=lit?(material.userData.roomLighting?1.15:.23):0;material.emissiveMap=lit?material.map:null;material.needsUpdate=true;}}
 acceptsCivic(tile){const id=tile.building||civicDefaults[tile.type];return !!id&&this.models.some(a=>a.category===tile.type&&a.building===id&&a.site===!!tile.facilitySite);}
 create(world,index,parcel){
  if(!this.models.length)return null;const p=lotPlan(world,index,parcel),category=p.low?'residential-low':p.type;
  const civic=civicDefaults[p.type],id=world.tiles[index].building||civic;let candidates=this.models.filter(a=>a.category===category&&(!civic||a.building===id&&a.site===p.facility));if(!candidates.length)return null;
  if(p.low){const homes=candidates.filter(a=>a.houseForm);if(homes.length)candidates=homes;const forms=candidates.filter(a=>id==='townhouse'?['semi','terrace'].includes(a.houseForm):a.houseForm==='detached');if(forms.length)candidates=forms;}
  const densityFit=candidates.filter(a=>!a.floors||(p.type==='residential'&&!p.low?(p.density==='medium'?a.floors<=9:a.floors>=9):p.type==='commercial'?(p.density==='low'?a.floors<=3:a.floors>=4):true));if(densityFit.length)candidates=densityFit;
  const W=p.lotWidth,D=p.lotDepth,fit=a=>Math.min(.2,(W-.3)/a.size.x,(D-.3)/a.size.z);
  // First fit metre-sized architecture to the parcel. A large block must not
  // shrink into a miniature tower when selected for a single-cell lot.
  const fullScale=candidates.filter(a=>fit(a)>=.17);if(fullScale.length)candidates=fullScale;
  // Mix perimeter blocks with tower or retail-plaza lots. Coverage alone
  // otherwise suppresses almost every slender and rounded model.
  const openLot=p.density==='high'&&((p.type==='office'||p.type==='residential')&&p.style%2===0||p.type==='commercial'&&p.style%3===0);
  const targetCoverage=openLot?.32+p.tone*.055:p.low?.34:p.type==='commercial'&&p.density==='low'?.48:.72;
  const targetHeight=p.floors*.64,score=a=>{
   const scale=fit(a),coverage=a.size.x*a.size.z*scale*scale/(W*D);
   return Math.abs(Math.log(Math.max(.1,a.size.y*scale)/targetHeight))*(openLot?1.1:.45)+Math.abs(targetCoverage-coverage)*3;
  };
  candidates.sort((a,b)=>score(a)-score(b)||a.name.localeCompare(b.name));
  const best=score(candidates[0]);candidates=candidates.filter(a=>score(a)<=best+(p.low?.65:openLot?.38:p.type==='office'?.3:.16));
  const modernShare=p.type==='office'?.82:p.low?.28:p.type==='commercial'?.60:.58,familyVariation=(Math.imul(p.seed^(p.seed>>>16),0x45d9f3b)>>>0)/4294967296;const family=familyVariation<modernShare?'modern':'masonry',preferred=candidates.filter(a=>a.family===family);if(preferred.length)candidates=preferred;
  const asset=candidates[(p.style+p.tone)%candidates.length],root=new THREE.Group(),model=asset.root.clone(true),scale=fit(asset);
  // Move frontage toward its road, within the original owned rectangle.
  // Project the remaining axis-aligned clearance onto the local front vector.
  const c=Math.abs(Math.cos(p.angle)),s=Math.abs(Math.sin(p.angle));
  const occupiedX=(asset.size.x*c+asset.size.z*s)*scale,occupiedZ=(asset.size.x*s+asset.size.z*c)*scale;
  const clearanceX=Math.max(0,(p.parcelWidth-occupiedX)/2-.18),clearanceZ=Math.max(0,(p.parcelDepth-occupiedZ)/2-.18);
  const frontageSpace=Math.max(0,(D-asset.size.z*scale)/2-.25);const setback=p.frontage&&!p.facility?Math.min(!p.oriented&&s>1e-6?clearanceX/s:Infinity,!p.oriented&&c>1e-6?clearanceZ/c:Infinity,frontageSpace)*(p.type==='industrial'||p.type==='commercial'&&p.density==='low'?-1:p.low?.2+p.variation*.45:1):0;
  model.position.z=setback;
  if(p.low){const fronts=asset.streetFronts.filter(f=>f.kind==='entrance'&&f.normal[1]>.9),frontZ=Math.max(...fronts.map(f=>f.position[2]));p.entranceXs=fronts.filter(f=>f.position[2]>=frontZ-.5).map(f=>(f.position[0]+asset.origin.x)*scale);}
  model.scale.setScalar(scale);root.add(model);root.rotation.y=p.angle;
  const lawn=category==='residential-low',surface=lawn?'grass':category==='industrial'?'asphalt':'paving';this.lotMaterials ||= {};
  let lotMaterial=this.lotMaterials[surface];
  if(!lotMaterial){lotMaterial=this.lotMaterials[surface]=this.view.landscape.material(lawn?'grass':'asphalt',lawn?2:3,lawn?'#9fb78c':surface==='paving'?'#93988e':'#a7aaa5');
   if(surface==='paving'){
    // World-space joints stay aligned across neighbouring, rotated building lots.
    lotMaterial.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 lotPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vec4 lotPosition=vec4(transformed,1.);
     #ifdef USE_INSTANCING
     lotPosition=instanceMatrix*lotPosition;
     #endif
     lotPoint=(modelMatrix*lotPosition).xyz;`);shader.fragmentShader='varying vec3 lotPoint;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     #ifdef USE_MAP
     float grain=dot(texture2D(map,vMapUv).rgb,vec3(.3,.59,.11));
     diffuseColor.rgb*=.55+grain*1.2;
     #endif
     vec2 tile=abs(fract(lotPoint.xz*5.)-.5);float edge=max(tile.x,tile.y);
     float grout=smoothstep(.48-fwidth(edge),.495,edge);
     diffuseColor.rgb*=mix(1.,.76,grout);`);};lotMaterial.customProgramCacheKey=()=> 'borough-paved-lots-21';
   }
  }
  const lot=new THREE.Mesh(this.lotGeometry,lotMaterial);lot.rotation.y=p.oriented?0:-p.angle;lot.scale.set((p.oriented?W:p.parcelWidth)-.12,1,(p.oriented?D:p.parcelDepth)-.12);lot.position.y=-.025;lot.receiveShadow=true;lot.userData.sharedAsset=true;root.add(lot);
  if(surface==='paving'&&!p.oriented){
   const gardenMaterial=this.lotMaterials.grass ||= this.view.landscape.material('grass',2,'#9fb78c');
   const offsetX=Math.sin(p.angle)*setback,offsetZ=Math.cos(p.angle)*setback;
   const gardens=new THREE.Group();gardens.rotation.y=-p.angle;
   const patch=(x,z,w,d)=>{const mesh=new THREE.Mesh(this.lotGeometry,gardenMaterial);mesh.position.set(x,-.012,z);mesh.scale.set(w,1,d);mesh.receiveShadow=true;mesh.userData.sharedAsset=true;gardens.add(mesh);};
   // Unbuilt setbacks become gardens rather than oversized empty parking pads.
   for(const sign of [-1,1]){
    const sideGap=(p.parcelWidth-occupiedX)/2-sign*offsetX,endGap=(p.parcelDepth-occupiedZ)/2-sign*offsetZ;
    if(sideGap>.6)patch(sign*(p.parcelWidth/2-sideGap/2),0,sideGap-.28,p.parcelDepth-.5);
    if(endGap>.6)patch(offsetX,sign*(p.parcelDepth/2-endGap/2),Math.min(occupiedX,p.parcelWidth-.5),endGap-.28);
   }
   root.add(gardens);
  }

  this.siteDetails ||= new SiteDetails(this.view,this.lotMaterials);const grounds=this.siteDetails.build(p,{minX:-asset.size.x*scale/2,maxX:asset.size.x*scale/2,minZ:setback-asset.size.z*scale/2,maxZ:setback+asset.size.z*scale/2});root.add(grounds);
  if(p.low)p.accessPoints=grounds.userData.sitePlan.filter(a=>['walk','drive'].includes(a.kind)&&a.z+a.d/2>=p.lotDepth/2-.091).map(a=>({x:a.x,width:a.w,kind:a.kind}));
  root.add(this.siteDetails.buildGardens(asset.gardens,asset.origin,scale,setback));
  const footprintX=asset.size.x*scale/2,footprintZ=asset.size.z*scale/2;let base=floorHeight(world,p.cx,p.cz);
  for(const x of [-footprintX,footprintX])for(const z of [-footprintZ,footprintZ])base=Math.max(base,floorHeight(world,p.cx+x*Math.cos(p.angle)+(z+setback)*Math.sin(p.angle),p.cz-x*Math.sin(p.angle)+(z+setback)*Math.cos(p.angle)));
  if(world.landformVersion===1)for(const point of lotPerimeter(p))base=Math.max(base,floorHeight(world,p.cx+point.x,p.cz+point.z));
  const foundation=lotFoundation(world,p,base+.04,floorHeight);if(foundation){if(!this.foundationMaterial){const material=this.view.landscape.material('brick',1,'#9b9e94');material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
vec3 sampleColor=texture2D(map,vMapUv).rgb;float grain=dot(sampleColor,vec3(.3,.59,.11));diffuseColor.rgb*=.55+grain*.9;
#endif`);};material.customProgramCacheKey=()=> 'borough-retaining-masonry-28';this.foundationMaterial=material;}const wall=new THREE.Mesh(foundation,this.foundationMaterial);wall.rotation.y=-p.angle;wall.castShadow=wall.receiveShadow=true;root.add(wall);}
  root.position.set(p.cx,base+.04,p.cz);root.userData={factory:true,asset:true,renderImmutable:true,model:asset.name,plan:p,lodDistance:asset.family==='modern'?64:undefined};return root;
 }
}
