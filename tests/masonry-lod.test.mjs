import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new T.Texture())}));
const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}}}});
const bytes=fs.readFileSync(new URL('../dist/assets/buildings/urban.glb',import.meta.url));lib.ingest((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene);
const data=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),data.buffer.slice(data.byteOffset,data.byteOffset+data.length));

test('urban distant models retain valid shared vertex buffers within a separate geometry budget',()=>{
 let near=0,far=0;assert.equal(lib.models.length,16);
 for(const model of lib.models)for(const mesh of model.root.children){const g=mesh.geometry,low=g.userData.lod;assert.ok(low,model.name);for(const [key,attribute]of Object.entries(g.attributes))assert.equal(low.attributes[key],attribute,'near and distant share '+key);for(const index of low.index.array)assert.ok(index<g.attributes.position.count,model.name+' valid vertex');assert.equal(low.index.count%3,0);near+=g.index.count;far+=low.index.count;
  if(g.index.count<900)assert.deepEqual(low.index.array,new Uint32Array(g.index.array),'small roofs, plant and entrance details are intact');
 }
 assert.ok(far<near*.45,'intact imported facades retain less than 45% of full triangles');
});

test('distant walls, glass and frames retain at least 95% of sampled full-model surfaces',()=>{
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),point=new T.Vector3(),normal=new T.Vector3(),edge=new T.Vector3(),ray=new T.Raycaster(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 // Probe actual source triangles rather than comparing bounding boxes: a broken
 // facade can keep its outer bounds while losing most of its window surfaces.
 for(const model of lib.models){let checked=0,broken=0;for(const mesh of model.root.children.filter(m=>/objects|plaster|glass/.test(m.material.name))){const g=mesh.geometry,p=g.attributes.position,index=g.index,low=new T.Mesh(g.userData.lod,material);low.updateMatrixWorld();for(let t=0;t<index.count;t+=Math.max(3,Math.floor(index.count/384/3)*3)){
  a.fromBufferAttribute(p,index.getX(t));b.fromBufferAttribute(p,index.getX(t+1));c.fromBufferAttribute(p,index.getX(t+2));normal.subVectors(b,a).cross(edge.subVectors(c,a));if(normal.length()<.005)continue;normal.normalize();point.copy(a).add(b).add(c).multiplyScalar(1/3);ray.set(point.clone().addScaledVector(normal,.2),normal.clone().negate());ray.far=.5;
  const hits=ray.intersectObject(low);checked++;if(!hits.length||Math.abs(hits[0].distance-.2)>.075)broken++;
 }}assert.ok(checked>800,model.name+' sufficient coverage');assert.ok(broken/checked<.05,model.name+': '+broken+'/'+checked+' missing or displaced surface probes');}
});

test('identical imported finishes share materials while each building keeps its original wall palette',()=>{
 const palettes=['#beb8a4','#c9c7ba','#9babad','#c0b39b','#c6bfb0'],shared=new Map(),tones=new Set();
 for(const model of lib.models){let tone=0;for(const char of model.name)tone=(tone+char.charCodeAt(0))%5;for(const mesh of model.root.children){const m=mesh.material,tinted=/plaster|brick|trim/.test(m.name);if(tinted){assert.equal(m.color.getHexString(),new T.Color(palettes[tone]).getHexString());tones.add(tone);}const key=m.name+':'+(tinted?tone:'original');if(shared.has(key))assert.equal(m,shared.get(key),'reuse '+key);else shared.set(key,m);}}
 assert.equal(tones.size,5);assert.ok(shared.size<40,'shared finishes bound material draws');lib.setNight(true);for(const m of lib.materials)if(m.userData.glass)assert.equal(m.emissiveIntensity,.23);lib.setNight(false);for(const m of lib.materials)if(m.userData.glass)assert.equal(m.emissiveIntensity,0);
});
