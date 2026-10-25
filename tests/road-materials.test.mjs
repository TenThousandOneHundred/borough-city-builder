import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {Landscape} from '../dist/landscape.js';
import {Roadworks} from '../dist/roadworks.js';
import {pavementMaterial,streetStations,streetSurface} from '../dist/street-geometry.js';
import {ROAD_TEXTURE_REPEAT,configureRoadFinish,roadFinishData} from '../dist/road-finish.js';
import E from '../dist/engine.js';
globalThis.CityEngine=E;

const names=['road-asphalt-color','road-asphalt-normal','road-asphalt-rough'];
const slots=['map','normalMap','roughnessMap'];
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
class FakeTextureLoader {
 requests=[];
 loadAsync(url){return new Promise((resolve,reject)=>{
  const texture=new T.Texture(),name=new URL(url).pathname.split('/').pop().replace(/\.jpg$/,'');
  texture.name=name;this.requests.push({name,texture,succeed:()=>resolve(texture),fail:()=>reject(Error('test texture unavailable'))});
 });}
}
function landscape(maximum=16){
 const land=Object.create(Landscape.prototype);
 Object.assign(land,{assets:{},loader:new FakeTextureLoader(),view:{renderer:{capabilities:{getMaxAnisotropy:()=>maximum}}}});
 return land;
}
function expanded(source){return source.replace(/#include <([^>]+)>/g,(_,name)=>{assert.ok(name in T.ShaderChunk,'known Three.js shader chunk '+name);return expanded(T.ShaderChunk[name]);});}
function shader(material){
 const result={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 material.onBeforeCompile(result);return result;
}
function assertStandardLighting(fragment){
 const full=expanded(fragment);
 assert.equal(full.match(/float\s+roughnessFactor\s*=/g)?.length,1,'roughness declaration is retained exactly once');
 assert.equal(full.match(/float\s+metalnessFactor\s*=/g)?.length,1,'metalness declaration is retained exactly once');
 assert.ok(full.indexOf('float roughnessFactor')<full.indexOf('material.roughness ='),'roughness is initialized before physical lighting');
 assert.ok(full.indexOf('float metalnessFactor')<full.indexOf('material.diffuseColor ='),'metalness is initialized before physical lighting');
 assert.match(full,/vec4\s+diffuseColor\s*=/);
 assert.ok(full.includes(T.ShaderChunk.normal_fragment_maps),'standard normal sampling remains intact');
 return full;
}

test('landscape readiness includes every road map even when terrain textures finish first',async()=>{
 const land=landscape(),ready=land.load();let completed=false;ready.then(()=>completed=true);
 assert.deepEqual(land.loader.requests.filter(r=>names.includes(r.name)).map(r=>r.name).sort(),[...names].sort());
 assert.equal(new Set(land.loader.requests.map(r=>r.name)).size,land.loader.requests.length,'each image has one request');
 land.loader.requests.filter(r=>!names.includes(r.name)).forEach(r=>r.succeed());
 await nextTurn();assert.equal(completed,false);
 land.loader.requests.find(r=>r.name===names[0]).succeed();land.loader.requests.find(r=>r.name===names[2]).succeed();
 await nextTurn();assert.equal(completed,false,'the road normal map is still loading');
 land.loader.requests.find(r=>r.name===names[1]).succeed();await ready;assert.equal(completed,true);
 for(const name of names)assert.equal(land.assets[name],land.loader.requests.find(r=>r.name===name).texture);
});

test('road images keep linear data maps, sRGB color, and a hardware-bounded filtering budget',async()=>{
 for(const maximum of [1,2,16]){
  const land=landscape(maximum),ready=land.load();land.loader.requests.forEach(r=>r.succeed());await ready;
  for(const name of names){
   const texture=land.assets[name];assert.equal(texture.colorSpace,name.endsWith('color')?T.SRGBColorSpace:T.NoColorSpace);
   assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.wrapT,T.RepeatWrapping);
   assert.equal(texture.anisotropy,Math.min(4,maximum));
  }
  const road=configureRoadFinish(land.material('road-asphalt',ROAD_TEXTURE_REPEAT));
  assert.ok(road.normalScale.x>0&&road.normalScale.x<=.2);assert.equal(road.normalScale.x,road.normalScale.y);
  for(let i=0;i<slots.length;i++){
   const texture=road[slots[i]],original=land.assets[names[i]];
   assert.notEqual(texture,original,'material owns its transform without changing the source image');
   assert.equal(texture.source,original.source,'cloned transforms share the same image source');
   assert.deepEqual(texture.repeat.toArray(),[ROAD_TEXTURE_REPEAT,ROAD_TEXTURE_REPEAT]);
   assert.deepEqual(original.repeat.toArray(),[1,1],'creating road materials does not rescale source textures');
   assert.equal(texture.colorSpace,original.colorSpace);assert.equal(texture.anisotropy,Math.min(4,maximum));
  }
 }
});

test('each road image can fail independently without losing successful maps or rejecting city readiness',async t=>{
 t.mock.method(console,'warn',()=>{});
 for(const failed of names){
  const land=landscape(),ready=land.load();
  for(const request of land.loader.requests)request.name===failed?request.fail():request.succeed();
  await ready;assert.equal(land.assets[failed],undefined);
  const material=configureRoadFinish(land.material('road-asphalt',ROAD_TEXTURE_REPEAT));
  for(let i=0;i<names.length;i++){
   if(names[i]===failed)assert.equal(material[slots[i]],null,'failed maps have no broken sampler');
   else assert.equal(material[slots[i]].source,land.assets[names[i]].source,'independent successful maps remain usable');
  }
  assertStandardLighting(shader(material).fragmentShader);
 }
 const empty=configureRoadFinish(landscape().material('road-asphalt',ROAD_TEXTURE_REPEAT));
 for(const slot of slots)assert.equal(empty[slot],null);assertStandardLighting(shader(empty).fragmentShader);
});

test('all asphalt maps share world-space coordinates while lane wear retains original road UVs',()=>{
 const land=landscape();for(const name of names)land.assets[name]=new T.Texture();
 const material=configureRoadFinish(land.material('road-asphalt',ROAD_TEXTURE_REPEAT)),program=shader(material);
 assertStandardLighting(program.fragmentShader);
 assert.match(program.vertexShader,/roadSurfaceUv\s*=\s*\(modelMatrix\s*\*\s*vec4\(position,1\.\)\)\.xz/);
 assert.match(program.vertexShader,/roadFinishUv\s*=\s*uv\s*;/,'lane coordinates are not replaced by photograph coordinates');
 for(const [varying,transform]of [['vMapUv','mapTransform'],['vNormalMapUv','normalMapTransform'],['vRoughnessMapUv','roughnessMapTransform']]){
  assert.match(program.vertexShader,new RegExp(`${varying}\\s*=\\s*\\(${transform}\\s*\\*\\s*vec3\\(roadSurfaceUv,1\\.\\)\\)\\.xy`));
 }
 const compiledVertex=expanded(program.vertexShader);
 assert.ok(compiledVertex.indexOf('vec2 roadSurfaceUv')>compiledVertex.indexOf('vec3( MAP_UV'),'world mapping overrides Three.js default only after its UV initialization');
 for(const slot of slots)material[slot].updateMatrix();
 // A translated/rotated strip and an identity-space junction must sample the
 // same photograph at their shared physical point, despite unrelated lane UVs.
 const worldPoint=new T.Vector3(17.3,2,-8.6),stripMatrix=new T.Matrix4().makeRotationY(.73);stripMatrix.setPosition(11,1,-4);
 const localPoint=worldPoint.clone().applyMatrix4(stripMatrix.clone().invert());
 const sample=(point,matrix,texture)=>{const p=point.clone().applyMatrix4(matrix);return new T.Vector2(p.x,p.z).applyMatrix3(texture.matrix);};
 const expected=sample(worldPoint,new T.Matrix4(),material.map);
 for(const slot of slots){
  assert.ok(sample(localPoint,stripMatrix,material[slot]).distanceTo(expected)<1e-12);
  const next=sample(worldPoint.clone().add(new T.Vector3(2.1/5,0,0)),new T.Matrix4(),material[slot]);
  assert.ok(Math.abs(next.x-expected.x-1)<1e-12,'one source-photo width repeats every 2.1 physical metres');
  assert.equal(next.y,expected.y);
 }
});

test('applying road finish preserves geometry and lane distances on curves, slopes, and widening lanes',()=>{
 const stations=streetStations([{x:0,z:0},{x:3,z:2},{x:5,z:6},{x:7,z:11}]);
 for(const spec of Object.values(E.ROADS)){
  const width=p=>spec.width*(1+p.distance*.01),geometry=streetSurface(stations,p=>[[-width(p)/2,.08],[width(p)/2,.08]],(x,z)=>.02*x+.03*z);
  const before=Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,a.array.slice()])),indices=geometry.index.array.slice();
  const bounds=geometry.boundingSphere.clone();roadFinishData(geometry,stations,width,spec);
  for(const [name,array]of Object.entries(before))assert.deepEqual(geometry.attributes[name].array,array,name+' remains unchanged');
  assert.deepEqual(geometry.index.array,indices);assert.deepEqual(geometry.boundingSphere,bounds);
  assert.equal(geometry.attributes.roadFinish.count,geometry.attributes.position.count);
  for(let i=0;i<stations.length;i++){
   assert.ok(Math.abs(geometry.attributes.uv.getY(i*2)-stations[i].distance)<1e-6,'wheel wear continues to follow arc length');
   assert.ok(geometry.attributes.uv.getX(i*2)<0);assert.ok(geometry.attributes.uv.getX(i*2+1)>0);
  }
 }
});

test('sidewalk slab detail preserves physical shading and fades fine joints without texture or geometry allocations',()=>{
 const material=pavementMaterial(),program=shader(material);assertStandardLighting(program.fragmentShader);
 assert.match(program.vertexShader,/streetUV\s*=\s*uv\s*;/);
 assert.match(program.fragmentShader,/fwidth\(tile\)/,'joints use screen derivatives for antialiasing');
 assert.match(program.fragmentShader,/1\.-smoothstep\([^;]+max\(aa\.x,aa\.y\)\)/,'distant seams fade instead of shimmering');
 const slab=program.fragmentShader.match(/streetUV\/vec2\(([\d.]+),([\d.]+)\)/);assert.ok(slab);
 for(const side of slab.slice(1).map(Number))assert.ok(side*5>=.5&&side*5<=2,'slab dimensions remain plausible in physical metres');
 assert.ok(material.roughness>=.9);for(const slot of slots)assert.equal(material[slot],null);
 assert.equal(material.customProgramCacheKey(),pavementMaterial().customProgramCacheKey(),'sidewalks share one shader variant');
});

function roadView(land){
 const materials=new Map(),v={scene:new T.Scene(),unitBox:new T.BoxGeometry(1,1,1),night:false,landscape:land,
  mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));return materials.get(color);},
  box(group,x,y,z,w,h,d,color){const mesh=new T.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;}};
 return v;
}

test('roads refresh for each successful source map and reuse the finish once all sources are stable',()=>{
 for(const order of [[1,2,0],[0,1,2]]){
  const land=landscape(),requests=[],baseMaterial=land.material;
  land.material=function(...args){requests.push(args);return baseMaterial.apply(this,args);};
  const roads=new Roadworks(roadView(land)),world=E.createWorld('Road surface cache','plains',4);roads.outside=()=>{};
  roads.build(world);let previous=roads.asphalt;assert.equal(previous.map,null);assert.equal(previous.normalMap,null);
  const fallbackColor=previous.color.toArray();let texturedColor=null,colorTransitions=0;
  assert.ok(fallbackColor.every(channel=>channel>0&&channel<.2),'missing photographs use restrained gray asphalt, not white');
  for(const index of order){
   const beforeColor=previous.color.toArray();
   let disposed=0;previous.addEventListener('dispose',()=>disposed++);
   const source=new T.Texture();let sourceDisposed=false;source.addEventListener('dispose',()=>sourceDisposed=true);land.assets[names[index]]=source;
   roads.build(world);assert.notEqual(roads.asphalt,previous,'each newly available map refreshes the cached finish');
   assert.equal(disposed,1);assert.equal(sourceDisposed,false,'shared source textures survive material replacement');
   for(let i=0;i<names.length;i++)assert.equal(roads.asphalt[slots[i]]?.source,land.assets[names[i]]?.source);
   const color=roads.asphalt.color.toArray();
   if(roads.asphalt.map){
    assert.ok(color.every(channel=>channel>1&&channel<2),'photographed asphalt receives a bounded brightness lift');
    if(!texturedColor)texturedColor=color;
    assert.deepEqual(color,texturedColor,'late normal and roughness arrivals do not compound photographic brightness');
   }else assert.deepEqual(color,fallbackColor,'successful data maps alone retain the gray fallback');
   if(color.some((channel,i)=>channel!==beforeColor[i])){colorTransitions++;assert.equal(index,0,'only the color photograph changes road tint');}
   previous=roads.asphalt;roads.build(world);assert.equal(roads.asphalt,previous,'unchanged sources reuse the complete material');
   assert.deepEqual(roads.asphalt.color.toArray(),color,'stable rebuilds never multiply brightness again');
  }
  land.assets['asphalt-color']=new T.Texture();roads.build(world);assert.equal(roads.asphalt,previous,'unrelated roof/yard asphalt does not invalidate roads');
  assert.equal(colorTransitions,1);assert.deepEqual(roads.asphalt.color.toArray(),texturedColor);
  assert.equal(requests.length,4);for(const [name,repeat]of requests){assert.equal(name,'road-asphalt');assert.equal(repeat,ROAD_TEXTURE_REPEAT);}
 }
});

function jpegDimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8);let offset=2;
 const frames=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 while(offset<bytes.length){
  assert.equal(bytes[offset++],0xff);while(bytes[offset]===0xff)offset++;const marker=bytes[offset++];
  if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const length=bytes.readUInt16BE(offset);assert.ok(length>=2&&offset+length<=bytes.length);
  if(frames.has(marker))return [bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)];offset+=length;
 }
 assert.fail('Missing JPEG dimensions');
}

test('shipped road maps match the original CC0 one-kilopixel assets and documented provenance',()=>{
 // Official https://api.polyhaven.com/files/clean_asphalt metadata, 2026-10-25.
 const expected=[['color',697630,'7edccb95cbf72e63889baade8455f9e5'],['normal',776360,'24dadd366637a722b59c19a672cbbcf6'],['rough',641634,'4238f2eab76530f4b0c66ddb929b142d']];
 let total=0;
 for(const [kind,size,md5]of expected){
  const bytes=fs.readFileSync(new URL(`../dist/assets/road-asphalt-${kind}.jpg`,import.meta.url));
  assert.equal(bytes.length,size);assert.equal(createHash('md5').update(bytes).digest('hex'),md5,'original photograph map is retained');
  assert.deepEqual(jpegDimensions(bytes),[1024,1024]);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);total+=bytes.length;
 }
 assert.equal(total,2115624);
 const credits=fs.readFileSync(new URL('../dist/assets/CREDITS.md',import.meta.url),'utf8'),section=credits.split('## Road asphalt')[1];assert.ok(section);
 for(const term of ['Clean Asphalt','Dimitrios Savva','CC0','https://polyhaven.com/a/clean_asphalt','https://polyhaven.com/license','2.1 metres'])assert.ok(section.includes(term),term+' is credited');
});
