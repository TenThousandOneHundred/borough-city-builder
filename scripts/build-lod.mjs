import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import * as THREE from '../dist/vendor/three.module.js';
import {ModelLibrary} from '../dist/model-library.js';
const {MeshoptSimplifier}=await import(pathToFileURL(process.argv[2]+'/meshoptimizer/meshopt_simplifier.js'));await MeshoptSimplifier.ready;
const loader=new GLTFLoader();loader.register(()=>({name:'images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const lib=Object.create(ModelLibrary.prototype);lib.models=[];lib.materials=new Set();lib.view={renderer:{capabilities:{getMaxAnisotropy:()=>1}}};
for(const file of ['urban','industry','modern']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene);}
const manifest={},chunks=[];let offset=0,before=0,after=0;
function pack(array){const b=Buffer.from(array.buffer,array.byteOffset,array.byteLength),entry={offset,count:array.length};chunks.push(b);offset+=b.length;return entry;}
for(const model of lib.models){if(model.family==='modern')continue;manifest[model.name]=model.root.children.map(mesh=>{const g=mesh.geometry,index=new Uint32Array(g.index.array);before+=index.length/3;
const [reduced]=MeshoptSimplifier.simplifySloppy(index,g.attributes.position.array,3,null,Math.max(12,Math.floor(index.length*.08/3)*3),.02);after+=reduced.length/3;
const used=[...new Set(reduced)],remap=new Map(used.map((v,i)=>[v,i])),entry={attributes:{}};
for(const [name,attribute]of Object.entries(g.attributes)){const array=new Float32Array(used.length*attribute.itemSize);used.forEach((old,i)=>{for(let k=0;k<attribute.itemSize;k++)array[i*attribute.itemSize+k]=attribute.array[old*attribute.itemSize+k]});entry.attributes[name]={...pack(array),itemSize:attribute.itemSize};}
entry.index=pack(new Uint32Array(Array.from(reduced,i=>remap.get(i))));return entry;});}
fs.writeFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url),Buffer.concat(chunks));fs.writeFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url),JSON.stringify(manifest));console.log({before,after,bytes:offset});
