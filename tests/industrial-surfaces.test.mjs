import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {IndustrialSurfaces,configureIndustrialPaint,configureIndustrialBark} from '../dist/industrial-surfaces.js';
import {ModelLibrary} from '../dist/model-library.js';

const slots=['map','normalMap','roughnessMap'];
const files=['color','normal','roughness'];
const configure={paint:configureIndustrialPaint,bark:configureIndustrialBark};
const renderer=max=>({capabilities:{getMaxAnisotropy:()=>max}});
class FakeTextureLoader {
 requests=[];
 load(url,onLoad,onProgress,onError){
  const texture=new T.Texture();
  texture.clone=()=>{throw Error('Shared industrial textures must not be cloned');};
  this.requests.push({url,texture,succeed:()=>onLoad(texture),fail:()=>onError(Error('test image failure'))});
  return texture;
 }
}
function surfaces(max=16){const loader=new FakeTextureLoader();return {loader,surfaces:new IndustrialSurfaces(renderer(max),loader)};}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
function shaderFor(material){const shader={fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader.fragmentShader;}

test('six shared textures start once and readiness waits for the last image',async()=>{
 const {loader,surfaces:library}=surfaces();
 assert.equal(loader.requests.length,6);
 const names=loader.requests.map(r=>new URL(r.url).pathname.split('/').pop()).sort();
 assert.deepEqual(names,['bark-color.jpg','bark-normal.jpg','bark-roughness.jpg','paint-color.jpg','paint-normal.jpg','paint-roughness.jpg']);
 assert.equal(new Set(loader.requests.map(r=>r.texture)).size,6);
 let ready=false;library.ready.then(()=>ready=true);
 await nextTurn();assert.equal(ready,false);
 for(const i of [5,2,0,4,1])loader.requests[i].succeed();
 await nextTurn();assert.equal(ready,false,'five completed images cannot start a fully loaded city');
 loader.requests[3].succeed();await library.ready;assert.equal(ready,true);
 await library.ready;assert.equal(loader.requests.length,6,'waiting again does not request another texture set');
});

test('color maps use sRGB while normal and roughness remain linear, with bounded filtering',async()=>{
 for(const maximum of [1,2,16]){
  const {loader,surfaces:library}=surfaces(maximum);
  for(const kind of ['paint','bark'])for(const slot of slots){
   const texture=library.textures[kind][slot];
   assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.wrapT,T.RepeatWrapping);
   assert.equal(texture.anisotropy,Math.min(4,maximum));
   assert.equal(texture.colorSpace,slot==='map'?T.SRGBColorSpace:T.NoColorSpace);
  }
  loader.requests.forEach(r=>r.succeed());await library.ready;
 }
});

test('many paint and bark finishes share all maps without texture clones or palette mutation',()=>{
 const {loader,surfaces:library}=surfaces();
 for(const kind of ['paint','bark'])for(const color of ['#65817f','#a38858','#c3c7c4']){
  const material=new T.MeshStandardMaterial({color,roughness:.72,metalness:.12});
  const original=material.color.clone();
  assert.equal(configure[kind](material,library.textures),material);
  for(const slot of slots)assert.equal(material[slot],library.textures[kind][slot]);
  assert.deepEqual(material.color.toArray(),original.toArray(),'the source photo does not overwrite authored paint colors');
  assert.equal(material.roughness,.72);assert.equal(material.metalness,.12);
  assert.deepEqual(material.normalScale.toArray(),kind==='paint'?[.12,.12]:[.65,.65]);
  assert.equal(material.userData.industrialSurface,kind);
  configure[kind](material,library.textures);
  for(const slot of slots)assert.equal(material[slot],library.textures[kind][slot]);
 }
 assert.equal(loader.requests.length,6);
 const material=new T.MeshStandardMaterial(),hook=material.onBeforeCompile;
 assert.equal(configureIndustrialPaint(material),material);assert.equal(configureIndustrialBark(material),material);
 assert.equal(material.onBeforeCompile,hook);assert.equal(material.map,null);
});

test('paint borrows bounded luminance wear while bark retains photographed color',()=>{
 const {surfaces:library}=surfaces(),paint=configureIndustrialPaint(new T.MeshStandardMaterial(),library.textures);
 const bark=configureIndustrialBark(new T.MeshStandardMaterial(),library.textures),fragment=shaderFor(paint);
 assert.ok(!fragment.includes('#include <map_fragment>'));
 assert.ok(!fragment.includes('#include <roughnessmap_fragment>'));
 assert.ok(fragment.includes('#include <normal_fragment_maps>'),'normal-map lighting remains Three.js standard shading');
 assert.equal(fragment.match(/float\s+roughnessFactor\s*=/g)?.length,1,'the replacement chunk retains the standard roughness variable declaration');
 assert.ok(fragment.indexOf('float roughnessFactor')<fragment.indexOf('roughnessFactor*='),'roughness is initialized before photographic modulation');
 const weights=fragment.match(/float grain=dot\(wear,vec3\(([^)]+)\)\)/)?.[1].split(',').map(Number);
 assert.ok(weights?.every(n=>n>0));assert.ok(Math.abs(weights.reduce((a,b)=>a+b)-1)<1e-6);
 const wear=fragment.match(/diffuseColor\.rgb\*=([\d.]+)\+([\d.]+)\*grain/);
 assert.ok(wear,'paint applies one scalar to every color channel rather than the rusty orange photograph');
 for(const grain of [0,.25,.5,.75,1]){
  const factor=Number(wear[1])+Number(wear[2])*grain;
  assert.ok(factor>=.8&&factor<=1.2,'photographic wear stays within twenty percent of the paint palette');
 }
 const rough=fragment.match(/roughnessFactor\*=([\d.]+)\+([\d.]+)\*texture2D/);
 assert.ok(rough);
 assert.ok(Number(rough[1])>=.8);assert.ok(Number(rough[1])+Number(rough[2])<=1);
 assert.match(shaderFor(bark),/mix\(diffuseColor\.rgb,bark,\.88\)/);
 assert.notEqual(paint.customProgramCacheKey(),bark.customProgramCacheKey());
 const differentlyColored=configureIndustrialPaint(new T.MeshStandardMaterial({color:'#557755'}),library.textures);
 assert.equal(paint.customProgramCacheKey(),differentlyColored.customProgramCacheKey(),'palette changes do not create new shader programs');
});

test('failed images fall back before or after material configuration without retaining broken normal maps',async t=>{
 t.mock.method(console,'warn',()=>{});
 for(const kind of ['paint','bark'])for(let slotIndex=0;slotIndex<slots.length;slotIndex++)for(const failFirst of [true,false]){
  const {loader,surfaces:library}=surfaces(),material=new T.MeshStandardMaterial();
  const request=loader.requests.find(r=>new URL(r.url).pathname.endsWith(`${kind}-${files[slotIndex]}.jpg`));
  if(failFirst)request.fail();
  configure[kind](material,library.textures);const version=material.version;
  if(!failFirst){request.fail();assert.ok(material.version>version,'rendered material recompiles after a missing map');}
  assert.equal(material[slots[slotIndex]],null);
  for(const slot of slots.filter(s=>s!==slots[slotIndex]))assert.equal(material[slot],library.textures[kind][slot]);
  loader.requests.filter(r=>r!==request).forEach(r=>r.succeed());await library.ready;
  const later=configure[kind](new T.MeshStandardMaterial(),library.textures);
  assert.equal(later[slots[slotIndex]],null,'materials created after loading also skip failed textures');
 }
});

test('a late error cannot clear a replacement texture assigned to the same material',async t=>{
 t.mock.method(console,'warn',()=>{});
 const older=surfaces(),replacement=surfaces();
 for(const kind of ['paint','bark']){
  const material=new T.MeshStandardMaterial();
  configure[kind](material,older.surfaces.textures);configure[kind](material,replacement.surfaces.textures);
  older.loader.requests.filter(r=>new URL(r.url).pathname.includes(`/${kind}-`)).forEach(r=>r.fail());
  for(const slot of slots)assert.equal(material[slot],replacement.surfaces.textures[kind][slot]);
 }
 replacement.loader.requests.forEach(r=>r.succeed());await Promise.all([older.surfaces.ready,replacement.surfaces.ready]);
});

test('model ingestion keeps the shared industrial maps at the four-sample filtering budget',()=>{
 const {surfaces:library}=surfaces(16),models=Object.create(ModelLibrary.prototype);
 Object.assign(models,{models:[],materials:new Set(),surfaces:library,view:{renderer:renderer(16)}});
 const scene=new T.Group(),source=new T.Group();source.name='industrial-test';source.userData={family:'modern',category:'industrial'};
 source.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({name:'modern-painted',color:'#74817e'})));
 scene.add(source);models.ingest(scene);
 assert.equal(models.models.length,1);const finish=models.models[0].root.children[0].material;
 for(const slot of slots){assert.equal(finish[slot],library.textures.paint[slot]);assert.equal(finish[slot].anisotropy,4);}
});

function jpegDimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG start marker');
 const startOfFrame=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 let offset=2;
 while(offset<bytes.length){
  assert.equal(bytes[offset++],0xff,'valid JPEG segment marker');
  while(bytes[offset]===0xff)offset++;
  const marker=bytes[offset++];
  if(marker===0xd9||marker===0xda)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const length=bytes.readUInt16BE(offset);assert.ok(length>=2&&offset+length<=bytes.length);
  if(startOfFrame.has(marker))return {height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
  offset+=length;
 }
 assert.fail('JPEG contains no image dimensions');
}

test('the six shipped photographic maps are valid bounded one-kilopixel JPEGs',()=>{
 let transfer=0;
 for(const kind of ['paint','bark'])for(const file of files){
  const bytes=fs.readFileSync(new URL(`../dist/assets/industrial/${kind}-${file}.jpg`,import.meta.url));
  const {width,height}=jpegDimensions(bytes);assert.ok(width>0&&height>0&&width<=1024&&height<=1024,`${kind}-${file}: ${width}x${height}`);
  assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9,'complete JPEG end marker');transfer+=bytes.length;
 }
 assert.ok(transfer<3.3*1024*1024,'photographic detail stays within a shared transfer budget');
});
