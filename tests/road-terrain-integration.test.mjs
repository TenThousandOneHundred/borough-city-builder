import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {Landscape,groundHeight,terrainColor} from '../dist/landscape.js';
import {RoadSurfaceIndex} from '../dist/road-surface-index.js';
import {reflectedWater} from '../dist/water.js';
import {waterHeightTexture} from '../dist/water-depth.js';
import {createRoadEarthworks} from '../dist/road-earthworks.js';

function terrain(world,x=0){
 const g=new THREE.PlaneGeometry(4,4,1,1);g.rotateX(-Math.PI/2);g.translate(x,0,0);
 const p=g.attributes.position,color=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){p.setY(i,groundHeight(world,p.getX(i),p.getZ(i)));const c=terrainColor(world,p.getX(i),p.getZ(i));color.set([c.r,c.g,c.b],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(color,3));g.computeVertexNormals();return g;
}
function landscape(world){
 const materials=new Map(),view={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),engine:E,materials,reflectionsEnabled:false,
  mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);}};
 const land=Object.create(Landscape.prototype);Object.assign(land,{world,view,assets:{},group:new THREE.Group()});
 land.ground=new THREE.Mesh(terrain(world),new THREE.MeshStandardMaterial({vertexColors:true}));
 land.surroundings=new THREE.Mesh(terrain(world,20),new THREE.MeshStandardMaterial({vertexColors:true}));
 land.baseColors=land.ground.geometry.attributes.color.array.slice();land.group.add(land.ground,land.surroundings);
 land.terrainBases=[land.ground,land.surroundings].map(mesh=>({mesh,indices:mesh.geometry.index.array.slice(),drawRange:{...mesh.geometry.drawRange}}));
 land.refreshDevelopment=()=>{land.developmentRefreshes=(land.developmentRefreshes||0)+1;};return land;
}
// This fixture intentionally replaces only one terrain triangle. A broad
// corridor fixture would miss masked-index, picking and unchanged-half errors.
function earthworks(){
 const surface=new RoadSurfaceIndex(),created=[];let began=0,applied=0,disposed=0;
 return {created,get began(){return began;},get applied(){return applied;},get disposed(){return disposed;},
  beginApplication(){began++;surface.clear();},
  applyToGeometry(source){
   applied++;const indices=source.index.array.slice();
   if(source.attributes.position.getX(0)>10)return {indices,replacement:null,walls:null};
   const p=source.attributes.position,uv=source.attributes.uv,c=source.attributes.color,positions=[],texcoords=[],colors=[];
   for(const i of indices.slice(0,3)){positions.push(p.getX(i),-.5,p.getZ(i));texcoords.push(uv.getX(i),uv.getY(i));colors.push(c.getX(i),c.getY(i),c.getZ(i));}
   const replacement=new THREE.BufferGeometry();replacement.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));replacement.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));replacement.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));replacement.computeVertexNormals();
   let releases=0;replacement.addEventListener('dispose',()=>releases++);created.push({geometry:replacement,get releases(){return releases;}});surface.add(replacement,'ground');
   return {indices:indices.slice(3),replacement,walls:null};
  },sample(x,z){return surface.sample(x,z);},excluded(x,z){return surface.sample(x,z)!==null;},dispose(){disposed++;surface.clear();}};
}

test('road earthworks preserve canonical grid attributes and water while picking the visible clipped ground',()=>{
 const world=E.createWorld('Earthworks integration','plains',431),land=landscape(world),plan=earthworks();
 const natural=land.ground.geometry,index=natural.index,originalIndices=index.array.slice(),originalPositions=natural.attributes.position.array.slice(),originalNormals=natural.attributes.normal.array.slice(),originalUV=natural.attributes.uv.array.slice(),originalColors=natural.attributes.color.array.slice();
 const beforeWater=waterHeightTexture(natural),waterBytes=beforeWater.image.data.slice(),savedWorld=JSON.stringify(world);
 assert.equal(land.applyRoadEarthworks(world,plan),true);assert.equal(plan.began,1);assert.equal(plan.applied,2);assert.equal(land.developmentRefreshes,1);
 assert.equal(natural.index,index,'the existing GPU index allocation remains reusable');assert.equal(natural.drawRange.count,3);assert.deepEqual(index.array.slice(0,3),originalIndices.slice(3));
 for(const [name,expected]of [['position',originalPositions],['normal',originalNormals],['uv',originalUV],['color',originalColors]])assert.deepEqual(natural.attributes[name].array,expected,name+' stays canonical');
 const afterWater=waterHeightTexture(natural);assert.deepEqual(afterWater.image.data,waterBytes);assert.equal(JSON.stringify(world),savedWorld);
 const p=plan.created[0].geometry.attributes.position,x=(p.getX(0)+p.getX(1)+p.getX(2))/3,z=(p.getZ(0)+p.getZ(1)+p.getZ(2))/3;
 assert.equal(land.renderHeight(world,x,z),-.5,'render height is raw and does not clamp above a cut');assert.equal(land.earthworksExcluded(world,x,z),true);
 land.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObjects(land.renderGroundTargets(),false)[0];assert.ok(hit);assert.equal(hit.point.y,-.5,'picking reaches the replacement instead of the removed natural face');
 assert.equal(land.renderHeight(world,20,0),groundHeight(world,20,0));const other={...world,seed:world.seed+1};assert.equal(land.renderHeight(other,x,z),groundHeight(other,x,z));assert.equal(land.earthworksExcluded(other,x,z),false);
 const version=index.version;assert.equal(land.applyRoadEarthworks(world,plan),false);assert.equal(plan.applied,2);assert.equal(index.version,version,'unchanged plan causes no upload or solving');
 assert.equal(land.applyRoadEarthworks(world,null),true);assert.deepEqual(index.array,originalIndices);assert.equal(natural.drawRange.count,Infinity);assert.equal(land.renderGroundTargets().length,2);assert.equal(plan.created[0].releases,1);assert.equal(plan.disposed,0,'Roadworks retains plan ownership');
 assert.equal(land.renderHeight(world,x,z),groundHeight(world,x,z));assert.equal(land.developmentRefreshes,2);assert.equal(land.applyRoadEarthworks(world,null),false);
 beforeWater.dispose();afterWater.dispose();land.clear();
});

test('terrain edits and world replacement discard old fragments, restore full topology and allow the same plan to reapply',()=>{
 const world=E.createWorld('Earthworks edit','plains',431),land=landscape(world),plan=earthworks(),source=land.ground.geometry,fullIndex=source.index.array.slice();
 land.water=reflectedWater(land.view,source,land.surroundings.geometry);land.waterMaterial=land.water.material;land.group.add(land.water);
 const depth=land.waterMaterial.uniforms.nearHeight.value,oldDepth=depth.image.data.slice();land.applyRoadEarthworks(world,plan);
 world.elevation=new Array(97*97).fill(1);world.elevationRevision=1;
 land.refreshTerrain(world,{minX:-2,maxX:2,minZ:-2,maxZ:2},false);
 assert.equal(land.earthworks,null);assert.deepEqual(source.index.array,fullIndex);assert.equal(source.drawRange.count,Infinity);assert.equal(plan.created[0].releases,1);assert.notDeepEqual(depth.image.data,oldDepth);
 for(let i=0;i<source.attributes.position.count;i++){const p=source.attributes.position;assert.equal(p.getY(i),Math.fround(groundHeight(world,p.getX(i),p.getZ(i))));}
 assert.equal(land.applyRoadEarthworks(world,plan),true);assert.equal(plan.began,2);assert.equal(plan.created.length,2);assert.notEqual(plan.created[0].geometry,plan.created[1].geometry);
 land.makeTrees=()=>{land.trees=[];};land.makeRocks=()=>{};
 const other=E.createWorld('Replacement world','plains',432);land.build(other);
 assert.equal(plan.created[1].releases,1);assert.equal(plan.disposed,0);assert.equal(land.world,other);assert.equal(land.earthworks,null);assert.equal(land.renderGroundTargets().length,2);
 assert.equal(land.applyRoadEarthworks(world,plan),false,'an old world cannot attach its earthworks after switching');assert.equal(plan.began,2);
 assert.equal(land.ground.geometry.attributes.position.count,193*193);assert.equal(land.surroundings.geometry.attributes.position.count,401*401);
 land.clear();
});

test('vegetation uses derived support and exclusions while planted street trees retain their road wells',()=>{
 const world=E.createWorld('Vegetation earthworks','plains',431),land=landscape(world),previous=globalThis.CityEngine;globalThis.CityEngine=E;
 try{
  let trees,treeHeight;land.view.vegetation={populate(group,points,height){trees=points;treeHeight=height;return [];}};
  land.earthworks={sample:()=>3,excluded:()=>true};land.view.roadworks={surfaceHeight:()=>3.115};land.makeTrees(world);
  assert.ok(trees.length>0,'fixture includes planted road trees');assert.ok(trees.every(p=>p[4]===true),'ordinary vegetation cannot grow through earthworks');for(const [x,z]of trees)assert.equal(treeHeight(x,z),3.115);
  land.earthworks={sample:()=>3,excluded:()=>false};land.makeTrees(world);assert.ok(trees.some(p=>!p[4]));const natural=trees.find(p=>!p[4]);assert.equal(treeHeight(natural[0],natural[1]),3);
  let rocks,rockHeight;land.scannedRocks={populate(group,points,height){rocks=points;rockHeight=height;return true;}};
  const shore=E.createWorld('Shore earthworks','river',431);land.world=shore;land.earthworks={sample:()=>3,excluded:()=>true};land.makeRocks(shore);assert.equal(rocks.length,0);
  land.earthworks={sample:()=>3,excluded:()=>false};land.makeRocks(shore);assert.ok(rocks.length>0);assert.equal(rockHeight(shore,rocks[0][0],rocks[0][1]),3);
  land.earthworks={sample:()=>3,excluded:()=>true};assert.equal(land.coverWetness(shore,0,0),1,'cover generation rejects construction footprints');assert.equal(land.coverHeight(shore,0,0),3);
 }finally{globalThis.CityEngine=previous;land.earthworks=null;land.clear();}
});

test('real earthworks share one retaining material, preserve protected lots and restore natural overlay colors after rebuilds',()=>{
 const world=E.createWorld('Real earthworks integration','plains',431),land=landscape(world),surfaces=[];
 for(const x of [0,20]){const g=new THREE.PlaneGeometry(2,2,1,1);g.rotateX(-Math.PI/2);g.translate(x,4,0);const mesh=new THREE.Mesh(g);mesh.userData.roadSurface='asphalt';surfaces.push(mesh);}
 const protectedParcels=[{polygon:[{x:-.25,z:-2},{x:.25,z:-2},{x:.25,z:2},{x:-.25,z:2}]}];
 const plan=createRoadEarthworks({world,surfaces,groundHeight,protectedParcels});let assetsDisposed=0;
 for(const name of ['color','normal','rough']){const texture=new THREE.Texture();texture.anisotropy=4;texture.addEventListener('dispose',()=>assetsDisposed++);land.assets['road-concrete-'+name]=texture;}
 const blue=new THREE.Color('#0044ff');land.applyGroundOverlay(()=>blue);const displayed=land.ground.geometry.attributes.color.array.slice();
 land.applyRoadEarthworks(world,plan,{refreshVegetation:false});assert.deepEqual(land.ground.geometry.attributes.color.array,displayed,'building derived pieces preserves an active overlay');
 // Buried terrain may use a coarse plane below opaque pavement, but the
 // exposed retaining cap outside its x=1 edge must meet the constant road.
 assert.ok(Math.abs(land.renderHeight(world,1.1,0)-3.98)<1e-5,'exposed retaining cap remains level with its road support');assert.equal(land.renderHeight(world,0,0),groundHeight(world,0,0),'protected lot stays on natural terrain');
 const walls=land.earthworkMeshes.filter(m=>!land.earthworkGroundMeshes.includes(m));assert.equal(walls.length,2,'near and far contacts both render');assert.equal(walls[0].material,walls[1].material);
 const material=walls[0].material;assert.equal(material.roughness,.95);assert.equal(material.normalScale.x,.2);assert.equal(material.map.repeat.x,5/2.7);assert.equal(material.normalMap.repeat.y,5/2.7);assert.equal(material.map.anisotropy,4);assert.notEqual(material.map,land.assets['road-concrete-color']);
 const near=land.earthworkGroundMeshes.find(m=>m.userData.nearTerrain),far=land.earthworkGroundMeshes.find(m=>!m.userData.nearTerrain),natural=near.userData.baseColors.slice(),farColors=far.geometry.attributes.color.array.slice();
 assert.ok(natural.some((v,i)=>v!==displayed[i%displayed.length]),'natural patch colors are not captured from the heatmap');
 land.applyGroundOverlay(()=>blue);assert.equal(near.geometry.attributes.color.getX(0),Math.fround(blue.r));assert.deepEqual(far.geometry.attributes.color.array,farColors,'far backdrop retains its normal colors');
 land.restoreGroundColors();assert.deepEqual(near.geometry.attributes.color.array,natural);assert.deepEqual(land.ground.geometry.attributes.color.array,land.baseColors);
 let materialDisposed=0,mapsDisposed=0;material.addEventListener('dispose',()=>materialDisposed++);for(const name of ['map','normalMap','roughnessMap'])material[name].addEventListener('dispose',()=>mapsDisposed++);
 land.clearRoadEarthworks();land.applyRoadEarthworks(world,plan,{refreshVegetation:false});assert.equal(land.earthworkWallMaterial,material);assert.equal(land.earthworkMeshes.filter(m=>!land.earthworkGroundMeshes.includes(m)).length,2,'walls return on a second application');assert.equal(materialDisposed,0);
 land.clear();assert.equal(materialDisposed,1);assert.equal(mapsDisposed,3);assert.equal(assetsDisposed,0,'shared loaded textures remain owned by the asset cache');plan.dispose();for(const mesh of surfaces){mesh.geometry.dispose();mesh.material.dispose();}
 land.assets={};const fallback=land.retainingMaterial();assert.equal(fallback.normalScale.x,.2);assert.equal(fallback.map,null);assert.equal(fallback.normalMap,null);assert.equal(fallback.roughnessMap,null);land.disposeRetainingMaterial();
});

test('retaining concrete neutralizes photographed diffuse without replacing standard lighting, maps or alpha',()=>{
 const land=landscape(E.createWorld('Concrete shader','plains',431));for(const slot of ['color','normal','rough'])land.assets['road-concrete-'+slot]=new THREE.Texture();
 const material=land.retainingMaterial(),normal=material.normalMap,rough=material.roughnessMap,source=THREE.ShaderLib.standard,uniforms={sentinel:{value:7}},shader={fragmentShader:source.fragmentShader,vertexShader:source.vertexShader,uniforms};
 material.onBeforeCompile(shader);assert.equal(shader.vertexShader,source.vertexShader);assert.equal(shader.uniforms,uniforms);assert.equal(material.normalMap,normal);assert.equal(material.roughnessMap,rough);assert.equal(material.normalScale.x,.2);
 const adjustment=shader.fragmentShader.slice(shader.fragmentShader.indexOf('#include <map_fragment>')+'#include <map_fragment>'.length,shader.fragmentShader.indexOf('#include <color_fragment>'));
 assert.match(adjustment,/#ifdef USE_MAP/);assert.match(adjustment,/dot\(diffuseColor\.rgb,vec3\(\.2126,\.7152,\.0722\)\)/);assert.match(adjustment,/mix\(diffuseColor\.rgb,vec3\(retainingLuminance\),\.8\)/);assert.doesNotMatch(adjustment,/diffuseColor\.a|texture2D|texture\(/,'reuse the decoded map sample and retain alpha');
 const chunks=[...source.fragmentShader.matchAll(/#include <([^>]+)>/g)].map(m=>m[1]);assert.deepEqual([...shader.fragmentShader.matchAll(/#include <([^>]+)>/g)].map(m=>m[1]),chunks,'normal, roughness, light, shadow and output chunks remain intact and ordered');
 assert.equal(land.retainingMaterial(),material);const key=material.customProgramCacheKey();assert.equal(key,'borough-retaining-concrete-132');land.disposeRetainingMaterial();land.assets={};const fallback=land.retainingMaterial();assert.equal(fallback.customProgramCacheKey(),key);assert.equal(fallback.map,null);land.clear();
});
