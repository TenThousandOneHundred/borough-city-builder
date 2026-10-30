import './map-grid.js?v=161';
import './forest-layout.js?v=161';
const Forest=globalThis.BoroughForest;
const G=globalThis.BoroughGrid;
import {finishBuild} from './build-scheduler.js?v=161';
import './map-terrain.js?v=161';
import './coastline.js?v=161';
import './building-entities.js?v=161';
const Buildings=globalThis.BoroughBuildings;
import {supportsTree} from './tree-placement.js?v=161';
import {terrainMeshes} from './terrain-mesh.js?v=161';
import {inlandRelief} from './landforms.js?v=161';
import {streetStations,atDistance} from './street-geometry.js?v=161';
import {terrainOffset} from './terrain-edit.js?v=161';
import {outsidePortals} from './traffic.js?v=161';
import {ScannedRocks} from './scanned-rocks.js?v=161';
import {groundCover} from './ground-cover.js?v=161';
import {terrainField} from './terrain-field.js?v=161';
import {reflectedWater} from './water.js?v=161';
import {naturalTerrain} from './terrain-material.js?v=161';
import * as THREE from './vendor/three.module.js';
export const TILE=4,SIZE=48,HALF=96;
const landBase=new THREE.Color('#c8e0ad'),landLight=new THREE.Color('#d4dfb3'),shoreColor=new THREE.Color('#c3bda6'),slopeColor=new THREE.Color('#959a8d');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>t*t*(3-2*t);
function hash(x,y,seed){let v=Math.imul(x,374761393)+Math.imul(y,668265263)+seed*31;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967295}
function noise(x,y,seed){const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b,seed),hash(a+1,b,seed),u),THREE.MathUtils.lerp(hash(a,b+1,seed),hash(a+1,b+1,seed),u),v)}
function wetTile(w,x,y){if(globalThis.BoroughMapTerrain.isNew(w.terrain))return globalThis.BoroughMapTerrain.distance(w.terrain,w.seed,(x+.5)*4-G.half,(y+.5)*4-G.half)<1.5?1:0;if(x>=0&&y>=0&&x<G.n&&y<G.n)return w.tiles[y*G.n+x].ground==='water'?1:0;if(w.terrain==='river')return Math.abs(x-(34+Math.sin(y/7+w.seed%9)*3))<2.3?1:0;if(w.terrain==='islands')return Math.sin(x/7)+Math.cos(y/8)+Math.sin((x+y)/9)>1.05?1:0;return 0}
const waterFields=new WeakMap();
function field(w){if(waterFields.has(w))return waterFields.get(w);const f=new Float32Array(52*52),weights=[.18,.64,.18];for(let y=-2;y<50;y++)for(let x=-2;x<50;x++){let v=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)v+=wetTile(w,x+i,y+j)*weights[i+1]*weights[j+1];f[(y+2)*52+x+2]=v}waterFields.set(w,f);return f}
function baseWetness(w,x,z,shoreDistance){if(globalThis.BoroughMapTerrain.isNew(w.terrain))return 1-smooth(clamp(((shoreDistance??globalThis.BoroughMapTerrain.distance(w.terrain,w.seed,x,z))+3)/6,0,1));const gx=(x+G.half)/TILE-.5,gy=(z+G.half)/TILE-.5;if(w.terrain==='river'){const distance=Math.abs(gx-(34+Math.sin(gy/7+w.seed%9)*3));return smooth(clamp((3.35-distance)/2.1,0,1))}if(w.terrain==='islands'&&[2,3].includes(w.landformVersion))return 1-smooth(clamp((globalThis.BoroughCoastline.distance(w.seed,x,z)+3)/6,0,1));if(w.terrain==='islands'){const level=Math.sin(gx/7)+Math.cos(gy/8)+Math.sin((gx+gy)/9);return smooth(clamp((level-.72)/.65,0,1))}return 0}
export function wetness(w,x,z,height=groundHeight){const offset=terrainOffset(w,x,z);if(Math.abs(offset)<.0001)return baseWetness(w,x,z);return smooth(clamp((.65-height(w,x,z))/1.3,0,1));}
// Scenic coastal hills taper across an inland apron. Their amplitude is zero
// throughout the editable map, so this cannot lift existing buildings or roads.
function valleyFalloff(w,x,z,water,shoreDistance){if(w.landformVersion===3&&globalThis.BoroughMapTerrain.isNew(w.terrain))return smooth(clamp(((shoreDistance??globalThis.BoroughMapTerrain.distance(w.terrain,w.seed,x,z))-3)/90,0,1));if(w.terrain==='river'){const gx=(x+G.half)/4-.5,gy=(z+G.half)/4-.5,d=Math.abs(gx-(34+Math.sin(gy/7+w.seed%9)*3))*4;return smooth(clamp((d-10)/65,0,1))}if(w.terrain==='islands'&&[2,3].includes(w.landformVersion))return smooth(clamp(globalThis.BoroughCoastline.distance(w.seed,x,z)/70,0,1));return 1-smooth(clamp(water*3,0,1))}
// The scenic hills contribute zero inside the map apron. Avoid sampling their
// erosion field there; elsewhere reuse the wetness already computed below.
export function groundHeight(w,x,z){const shoreDistance=globalThis.BoroughMapTerrain.isNew(w.terrain)?globalThis.BoroughMapTerrain.distance(w.terrain,w.seed,x,z):undefined,water=baseWetness(w,x,z,shoreDistance),inland=.35+noise(x*.012,z*.012,w.seed)*1.6+noise(x*.028,z*.028,w.seed+3)*.7+noise(x*.09,z*.09,w.seed+17)*.12;const edge=smooth(clamp((Math.max(Math.abs(x),Math.abs(z))-G.halfPlus2)/150,0,1)),hills=edge>0?edge*terrainField(w.seed).sample(x,z)*valleyFalloff(w,x,z,water,shoreDistance):0,bank=smooth(clamp(water*1.85,0,1));return inland*(1-bank)+hills-bank*1.6+inlandRelief(w,x,z,water,shoreDistance)+terrainOffset(w,x,z);}
export function terrainColor(w,x,z,height=groundHeight){const wet=wetness(w,x,z,height),variation=noise(x*.037,z*.037,w.seed+51),c=landBase.clone().lerp(landLight,variation*.7);c.lerp(shoreColor,smooth(clamp(wet*3,0,1)));const slope=Math.abs(height(w,x+1,z)-height(w,x-1,z))+Math.abs(height(w,x,z+1)-height(w,x,z-1));c.lerp(slopeColor,clamp((slope-1.2)*.28,0,.8));return c.multiplyScalar(.93+noise(x*.14,z*.14,w.seed+21)*.13)}
export function floorHeight(w,x,z){return Math.max(.2,groundHeight(w,x,z))}
// Street trees may sit in a sidewalk well, but their trunks must stay clear
// of the actual pavement at bends, crossings and width transitions.
export function streetTreeClear(roads,x,z){
 if(!roads?.surfaceHeight)return true;
 for(const dx of [-.18,0,.18])for(const dz of [-.18,0,.18])if(Number.isFinite(roads.surfaceHeight(x+dx,z+dz,'asphalt')))return false;
 return true;
}
export class Landscape{
constructor(view){this.view=view;this.group=new THREE.Group();view.scene.add(this.group);this.loader=new THREE.TextureLoader();this.assets={};this.scannedRocks=new ScannedRocks(view);this.ready=Promise.all([this.load(),this.scannedRocks.ready]);}
async load(){const defs=['grass-color','grass-normal','grass-rough','asphalt-color','asphalt-normal','asphalt-rough','road-asphalt-color','road-asphalt-normal','road-asphalt-rough','road-concrete-color','road-concrete-normal','road-concrete-rough','brick-color','brick-normal','brick-rough','rock-color','rock-normal'];await Promise.all(defs.map(async name=>{try{const t=await this.loader.loadAsync(new URL('./assets/'+name+'.jpg',import.meta.url).href);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=name.startsWith('road-')?Math.min(4,this.view.renderer.capabilities.getMaxAnisotropy()):this.view.renderer.capabilities.getMaxAnisotropy();if(name.endsWith('color'))t.colorSpace=THREE.SRGBColorSpace;this.assets[name]=t}catch(e){console.warn('Texture fallback:',name)}}));}
material(name,repeat=1,color='#ffffff'){const map=this.assets[name+'-color']?.clone(),normal=this.assets[name+'-normal']?.clone(),rough=this.assets[name+'-rough']?.clone();for(let t of [map,normal,rough])if(t){t.repeat.set(repeat,repeat);t.needsUpdate=true}return new THREE.MeshStandardMaterial({color,map:map||null,normalMap:normal||null,roughnessMap:rough||null,normalScale:new THREE.Vector2(.3,.3),roughness:.92});}
clear(){this.clearRoadEarthworks();this.disposeRetainingMaterial();this.group.traverse(o=>{o.userData.dispose?.();if(o.geometry&&!o.userData.sharedAsset)o.geometry.dispose();if(o.material&&!o.userData.sharedMaterial){for(let m of Array.isArray(o.material)?o.material:[o.material]){if(m===this.leafMat||[...this.view.materials.values()].includes(m))continue;for(let k of ['map','normalMap','roughnessMap'])if(m[k]&&!Object.values(this.assets).includes(m[k]))m[k].dispose();m.dispose()}}});this.group.clear();this.terrainBases=null;this.cover=null;this.trees=null;this.rockGroup=null;this.ground=null;this.surroundings=null;this.developmentPending=false;this.world=null;}
build(w,{deferDevelopment=false}={}){this.clear();this.world=w;this.developmentPending=deferDevelopment;const meshes=terrainMeshes(w,groundHeight,terrainColor),geo=meshes.ground;this.geometryCacheHit=meshes.cacheHit;this.baseColors=geo.attributes.color.array.slice();const mat=naturalTerrain(this.material('grass',14,'#ffffff'),this.assets,w.seed);mat.vertexColors=true;mat.normalScale.set(.55,.55);this.ground=new THREE.Mesh(geo,mat);this.ground.receiveShadow=true;this.group.add(this.ground);
const far=meshes.far;const fm=naturalTerrain(this.material('grass',80.2083,'#ffffff'),this.assets,w.seed);fm.vertexColors=true;this.surroundings=new THREE.Mesh(far,fm);this.surroundings.receiveShadow=true;this.group.add(this.surroundings);
this.terrainBases=[this.ground,this.surroundings].map(mesh=>({mesh,indices:mesh.geometry.index.array.slice(),drawRange:{...mesh.geometry.drawRange}}));
this.water=reflectedWater(this.view,geo,far);this.waterMaterial=this.water.material;this.group.add(this.water);if(!deferDevelopment)this.makeTrees(w);this.rockGroup=new THREE.Group();this.group.add(this.rockGroup);if(!deferDevelopment){this.makeRocks(w);this.cover=groundCover(this.view,w,groundHeight,wetness);this.group.add(this.cover);}}
// Startup can wait for the final road support before constructing scenery.
// With no support plan, retain the ordinary build's order and natural heights.
ensureDevelopment(w){if(w!==this.world||!this.developmentPending)return false;if(this.earthworks)this.refreshDevelopment(w);else{this.group.remove(this.rockGroup);this.makeTrees(w);this.group.add(this.rockGroup);this.makeRocks(w);this.cover=groundCover(this.view,w,groundHeight,wetness);this.group.add(this.cover);this.developmentPending=false;}return true;}
// Earthworks change only render indices and separate clipped fragments. The
// square terrain samples remain the source for sculpting, water depth and saves.
retainingMaterial(){
 if(this.earthworkWallMaterial)return this.earthworkWallMaterial;
 const material=this.material('road-concrete',5/2.7,this.assets['road-concrete-color']?'#ffffff':'#9c9e93');material.normalScale.set(.2,.2);material.roughness=.95;
 // Retain the photographed formwork and pores while reducing its warm cast.
 // Work on linear diffuse after standard texture decoding, before lighting.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 #ifdef USE_MAP
 float retainingLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(retainingLuminance),.8);
 #endif`);};
 material.customProgramCacheKey=()=> 'borough-retaining-concrete-132';return this.earthworkWallMaterial=material;
}
disposeRetainingMaterial(){const material=this.earthworkWallMaterial;if(!material)return;for(const key of ['map','normalMap','roughnessMap'])material[key]?.dispose();material.dispose();this.earthworkWallMaterial=null;}
clearRoadEarthworks(){
 const changed=!!this.earthworks;for(const mesh of this.earthworkMeshes||[]){mesh.removeFromParent();mesh.geometry.dispose();}
 this.earthworkMeshes=[];this.earthworkGroundMeshes=[];
 if(changed)for(const base of this.terrainBases||[]){const g=base.mesh.geometry;g.index.array.set(base.indices);g.index.needsUpdate=true;g.setDrawRange(base.drawRange.start,base.drawRange.count);}
 this.earthworks=null;if(changed)this.earthworksRevision=(this.earthworksRevision||0)+1;return changed;
}
applyRoadEarthworks(w,earthworks,{refreshVegetation=true,prepared=null,preparedCover=null}={}){
 if(w!==this.world||!this.ground||earthworks===this.earthworks)return false;
 this.preparedRoadCover=preparedCover;const changed=this.clearRoadEarthworks();if(!earthworks){if(changed&&refreshVegetation)this.refreshDevelopment(w);return changed;}
 this.terrainBases ||= [this.ground,this.surroundings].filter(Boolean).map(mesh=>({mesh,indices:mesh.geometry.index.array.slice(),drawRange:{...mesh.geometry.drawRange}}));
 this.earthworks=earthworks;if(!prepared)earthworks.beginApplication?.();
 try{for(const base of this.terrainBases){
  const geometry=base.mesh.geometry,colors=geometry.attributes.color,overlayColors=colors?.array;let result;
  // An active heatmap must not be baked into the natural colors of new pieces.
  if(base.mesh===this.ground&&this.baseColors?.length===overlayColors?.length)colors.array=this.baseColors;
  try{result=prepared?.find(entry=>entry.base===base)?.result||earthworks.applyToGeometry(geometry);}finally{if(colors)colors.array=overlayColors;}
  // Reuse the original GPU index allocation; unused tail entries are outside
  // the draw range. Rebuilding or removing roads restores every original entry.
  geometry.index.array.set(result.indices);geometry.index.needsUpdate=true;geometry.setDrawRange(0,result.indices.length);
  for(const [part,ground]of [[result.replacement,true],[result.walls,false]]){
   if(!part)continue;if(!(part.index?.count??part.attributes.position?.count)){part.dispose();continue;}
   const mesh=new THREE.Mesh(part,ground?base.mesh.material:this.retainingMaterial());mesh.receiveShadow=true;mesh.castShadow=!ground;mesh.userData.sharedMaterial=true;
   if(ground){mesh.userData.nearTerrain=base.mesh===this.ground;mesh.userData.baseColors=part.attributes.color?.array.slice();}
   this.group.add(mesh);this.earthworkMeshes.push(mesh);if(ground)this.earthworkGroundMeshes.push(mesh);
  }
 }}catch(error){this.clearRoadEarthworks();throw error;}
 this.earthworksRevision=(this.earthworksRevision||0)+1;if(refreshVegetation)this.refreshDevelopment(w);return true;
}
renderHeight(w,x,z){const height=this.world===w?this.earthworks?.sample(x,z):null;return Number.isFinite(height)?height:groundHeight(w,x,z);}
earthworksExcluded(w,x,z){return this.world===w&&!!this.earthworks?.excluded(x,z);}
renderGroundTargets(){return [this.ground,this.surroundings,...this.earthworkGroundMeshes||[]].filter(Boolean);}
applyGroundOverlay(colorAt){
 for(const mesh of [this.ground,...(this.earthworkGroundMeshes||[]).filter(m=>m.userData.nearTerrain)].filter(Boolean)){
  const {position,color}=mesh.geometry.attributes;if(!color)continue;
  for(let i=0;i<position.count;i++){const c=colorAt(position.getX(i),position.getZ(i));color.setXYZ(i,c.r,c.g,c.b);}color.needsUpdate=true;
 }
}
restoreGroundColors(){
 for(const [mesh,base]of [[this.ground,this.baseColors],...(this.earthworkGroundMeshes||[]).filter(m=>m.userData.nearTerrain).map(m=>[m,m.userData.baseColors])]){
  const colors=mesh?.geometry.attributes.color;if(!colors||base?.length!==colors.array.length)continue;colors.array.set(base);colors.needsUpdate=true;
 }
}
coverHeight(w,x,z){return this.renderHeight(w,x,z);}
coverWetness(w,x,z){return this.earthworksExcluded(w,x,z)?1:wetness(w,x,z,(world,px,pz)=>this.renderHeight(world,px,pz));}
leafMaterial(){if(this.leafMat)return this.leafMat;const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');for(let i=0;i<380;i++){let a=i*2.39996,r=Math.sqrt(i/380)*59,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;ctx.fillStyle=['#6c8047','#70874d','#526a36','#8a9659'][i%4];ctx.beginPath();ctx.ellipse(x,y,2.3+(i%3),1.5+(i%2),a,0,Math.PI*2);ctx.fill()}const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;this.leafMat=new THREE.MeshStandardMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide,roughness:1,envMapIntensity:.1});return this.leafMat}
*treePlanSteps(w,{height=(world,x,z)=>this.renderHeight(world,x,z),roads=this.view.roadworks,excluded=(x,z)=>this.earthworksExcluded(w,x,z),earthworks=!!this.earthworks}={}){
const positions=[];for(let i=0;i<w.tiles.length;i++){if(i%64===0)yield;const t=w.tiles[i];if(t.tree&&!t.type&&t.ground==='land'){const x=(i%G.n+.5)*4-G.half,z=(Math.floor(i/G.n)+.5)*4-G.half;if(w.forest){for(const p of Forest.pair(w,x,z,i))if(wetness(w,p[0],p[1])<.18)positions.push(p);}else{for(let j=0;j<2;j++){const px=x+hash(i,j,w.seed)*3-1.5,pz=z+hash(j,i,w.seed)*3-1.5;if(wetness(w,px,pz)<.18)positions.push([px,pz,2.8+hash(i,j+3,w.seed)*2,i%4])}}}}// Street trees occupy verges on straight road sections, not intersections.
for(let i=0;i<w.tiles.length;i++){if(i%64===0)yield;const t=w.tiles[i];if(t.type!=='road'||t.ground!=='land'||t.pathIds?.length||i%3!==0)continue;const near=globalThis.BoroughRoadTypes.legacyNeighbors(w,i);if(near.length!==2||near[0]+near[1]!==2*i)continue;const horizontal=Math.abs(near[0]-i)===1,x=(i%G.n+.5)*4-G.half,z=(Math.floor(i/G.n)+.5)*4-G.half;for(const side of [-1,1])positions.push([x+(horizontal?0:side*1.73),z+(horizontal?side*1.73:0),1.6+hash(i,side,w.seed)*.5,i%4,true]);}
// Small neighborhood trees soften developed block interiors without hiding roads.
for(const path of w.roadPaths||[]){yield;const spec=CityEngine.ROADS[path.type];if(!spec?.green)continue;const stations=streetStations(CityEngine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half})));if(stations.length<2)continue;for(let d=3;d<stations.at(-1).distance-1;d+=12){const p=atDistance(stations,d),x=p.x+p.tz*(spec.width/2+.25),z=p.z-p.tx*(spec.width/2+.25);if(wetness(w,x,z)<.3)positions.push([x,z,2.6,positions.length%4,true]);}}
for(let i=0;i<w.tiles.length;i++){if(i%64===0)yield;const t=w.tiles[i];if(t.type||t.zone||t.ground!=='land'||t.tree)continue;const neighbors=CityEngine.neighbors(i);if(neighbors.some(j=>['residential','commercial','office'].includes(w.tiles[j].type))&&!neighbors.some(j=>w.tiles[j].type==='road')&&hash(i,307,w.seed)>.4){const x=(i%G.n+.5)*4-G.half,z=(Math.floor(i/G.n)+.5)*4-G.half;positions.push([x,z,1.9+hash(i,311,w.seed)*1.2,i%4])}}
if(w.forest){
 const near=[],far=[],rim=G.half+32;let k=0;
 // Continue the playable woodland's cell spacing into the first scenic band.
 // Beyond that band, fewer tree pairs represent each distant grove.
 for(const [extent,step,list]of [[rim,4,near],[320,12,far]])for(let z=-extent+step/2;z<extent;z+=step)for(let x=-extent+step/2;x<extent;x+=step){
  const id=k++;if(id%64===0)yield;
  if(list===near?Math.abs(x)<G.half&&Math.abs(z)<G.half:Math.abs(x)<rim+2&&Math.abs(z)<rim+2)continue;
  if(Math.abs(z-2)<4&&x<0)continue;
  const rank=hash(id,863,w.seed),score=Forest.field(w,x,z)+(rank-.5)*.14;
  if(score<w.forest.threshold||wetness(w,x,z)>.08)continue;
  list.push({x,z,k:id+10000,rank});
 }
 const order=(a,b)=>a.rank-b.rank||a.k-b.k;near.sort(order);far.sort(order);
 const groves=near.slice(0,500);groves.push(...far.slice(0,Forest.FAR_LIMIT/2-groves.length));
 for(let i=0;i<groves.length;i++){if(i%64===0)yield;const {x,z,k}=groves[i];for(const p of Forest.pair(w,x,z,k))if(wetness(w,p[0],p[1])<.08)positions.push(p);}

}else{
 for(let k=0;k<4200;k++){if(k%64===0)yield;const x=hash(k,77,w.seed)*640-320,z=hash(k,83,w.seed)*640-320;if(Math.abs(x)<G.half+2&&Math.abs(z)<G.half+2||Math.abs(z-2)<4&&x<0||wetness(w,x,z)>.08||noise(x*.017,z*.017,w.seed+7)<.42)continue;positions.push([x,z,4+hash(k,91,w.seed)*4,k%4])}
}const portals=outsidePortals(w),clearPositions=[],heights=new Map();
for(let i=0;i<positions.length;i++){if(i%64===0)yield;const p=positions[i],[x,z,h,v,street]=p;
 if(Buildings.blocked(w,x,z)||!(street?streetTreeClear(roads,x,z):!excluded(x,z))||!supportsTree(w,x,z,height)||portals.some(p=>(x-p.x)*p.dx+(z-p.z)*p.dz>0&&Math.abs((x-p.x)*p.dz-(z-p.z)*p.dx)<3))continue;
 clearPositions.push(p);
}
const streetTrees=new Set(clearPositions.filter(p=>p[4]).map(p=>p[0]+':'+p[1]));
for(let i=0;i<clearPositions.length;i++){if(i%64===0)yield;const [x,z]=clearPositions[i];heights.set(x+':'+z,earthworks&&streetTrees.has(x+':'+z)?(roads?.surfaceHeight?.(x,z)??Math.max(.2,height(w,x,z))):Math.max(.2,height(w,x,z)));}
return {positions:clearPositions,heights};
}
makeTrees(w){const prepared=this.preparedTreePlan;this.preparedTreePlan=null;const {positions:clearPositions,heights}=prepared||finishBuild(this.treePlanSteps(w)),treeHeight=(x,z)=>heights.get(x+':'+z);const realistic=this.view.vegetation.populate(this.group,clearPositions,treeHeight);if(realistic){this.trees=realistic;return}const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.12,1,7),this.view.mat('#746958'),clearPositions.length),leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),this.leafMaterial(),clearPositions.length*24);const d=new THREE.Object3D();clearPositions.forEach(([x,z,h,v],i)=>{const y=treeHeight(x,z);d.rotation.set(0,0,0);d.position.set(x,y+h*.43,z);d.scale.set(1,h*.85,1);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);for(let j=0;j<24;j++){const a=j*2.399+i,r=Math.sqrt((j%8)/8)*h*.24;d.position.set(x+Math.cos(a)*r,y+h*.55+Math.sin(j*1.7)*h*.13+(j%3)*h*.08,z+Math.sin(a)*r);d.rotation.set((j%3-1)*.45,a,(j%2)*.25);const size=h*(.42+(j%4)*.035);d.scale.set(size,size*(j%2?.9:1.1),1);d.updateMatrix();leaves.setMatrixAt(i*24+j,d.matrix);const col=new THREE.Color(['#b9cba4','#95b09c','#c7cfa7','#acc294'][v]);leaves.setColorAt(i*24+j,col)}});trunk.castShadow=true;leaves.castShadow=true;leaves.receiveShadow=true;this.group.add(trunk,leaves);this.trees=[trunk,leaves]}

makeRocks(w){const height=(world,x,z)=>this.renderHeight(world,x,z),group=this.rockGroup||this.group,points=[];for(let k=0;k<1700;k++){const x=hash(k,131,w.seed)*470-235,z=hash(k,139,w.seed)*470-235,wet=wetness(w,x,z);if(this.earthworksExcluded(w,x,z)||Buildings.blocked(w,x,z)||wet<.12||wet>.45||Math.abs(z-2)<5&&x<0)continue;const ix=Math.floor((x+G.half)/4),iy=Math.floor((z+G.half)/4);if(ix>=0&&iy>=0&&ix<G.n&&iy<G.n&&w.tiles[iy*G.n+ix].type)continue;points.push([x,z,.15+hash(k,143,w.seed)*.5])}if(this.scannedRocks.populate(group,points,height,w))return;const geo=new THREE.IcosahedronGeometry(1,2),a=geo.attributes.position;for(let i=0;i<a.count;i++){const v=1+.16*Math.sin(a.getX(i)*8+a.getY(i)*7+a.getZ(i)*5);a.setXYZ(i,a.getX(i)*v,a.getY(i)*v,a.getZ(i)*v)}geo.computeVertexNormals();const mesh=new THREE.InstancedMesh(geo,this.view.mat('#87897c'),points.length),d=new THREE.Object3D();points.forEach(([x,z,r],i)=>{d.position.set(x,height(w,x,z)+r*.23,z);d.scale.set(r*1.4,r*.65,r);d.rotation.set(i*.31,i*.77,0);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);mesh.setColorAt(i,new THREE.Color().setHSL(.14,.06,.68+(i%5)*.035))});mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}

refreshTerrain(w,bounds,finish=false){
 // The caller rebuilds the road plan after the stroke. Never sculpt derived
 // fragments or let their masks influence the natural terrain normals.
 this.clearRoadEarthworks?.();
 const geometry=this.ground.geometry,pos=geometry.attributes.position,colors=geometry.attributes.color;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);if(bounds&&(x<bounds.minX-3||x>bounds.maxX+3||z<bounds.minZ-3||z>bounds.maxZ+3))continue;pos.setY(i,groundHeight(w,x,z));const c=terrainColor(w,x,z);colors.setXYZ(i,c.r,c.g,c.b);if(this.baseColors)this.baseColors.set([c.r,c.g,c.b],i*3);}
 this.water?.userData.refreshDepth?.(geometry);
 pos.needsUpdate=true;colors.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 if(finish){this.refreshTrees(w);if(this.rockGroup){this.rockGroup.traverse(o=>{o.userData.dispose?.();if(o.geometry&&!o.userData.sharedAsset)o.geometry.dispose();});this.rockGroup.clear();this.makeRocks(w);}}
}
refreshDevelopment(w){this.refreshTrees(w);if(this.rockGroup){this.rockGroup.traverse(o=>{o.userData.dispose?.();if(o.geometry&&!o.userData.sharedAsset)o.geometry.dispose();});this.rockGroup.clear();this.makeRocks(w);}this.developmentPending=false;}
refreshCover(w){if(this.cover||this.developmentPending){if(this.cover){this.group.remove(this.cover);this.cover.userData.dispose();}this.cover=this.preparedRoadCover||groundCover(this.view,w,(world,x,z)=>this.coverHeight(world,x,z),(world,x,z)=>this.coverWetness(world,x,z));this.preparedRoadCover=null;this.group.add(this.cover);}}
refreshTrees(w){this.refreshCover(w);for(let o of this.trees||[]){this.group.remove(o);o.dispose?.();o.traverse(m=>{if(m.geometry&&!m.userData.sharedAsset)m.geometry.dispose()})}this.makeTrees(w)}
update(time,night){if(this.cover){this.cover.visible=this.view.detailEnabled!==false;if(this.cover.visible)this.cover.userData.update(this.view.camera);}if(this.waterMaterial){this.waterMaterial.uniforms.time.value=time;this.waterMaterial.uniforms.night.value=night?1:0;this.waterMaterial.uniforms.reflectionEnabled.value=this.view.reflectionsEnabled===false||this.view.detailEnabled===false?0:1}}
}

wetness=G.bind(wetness);
groundHeight=G.bind(groundHeight);
terrainColor=G.bind(terrainColor);
floorHeight=G.bind(floorHeight);
Landscape=G.bindClass(Landscape);
