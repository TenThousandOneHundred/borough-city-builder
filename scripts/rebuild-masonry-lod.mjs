// Rebuild only the imported urban distant meshes. Preserve authored modern
// topology and the industrial catalogue while repacking their existing data.
import fs from 'node:fs';import {pathToFileURL} from 'node:url';import * as THREE from '../dist/vendor/three.module.js';import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';import {ModelLibrary} from '../dist/model-library.js';
const modules=process.argv[2];if(!modules)throw Error('Supply a node_modules directory containing meshoptimizer');const {MeshoptSimplifier:S}=await import(pathToFileURL(modules+'/meshoptimizer/meshopt_simplifier.js'));const {MeshoptEncoder:E}=await import(pathToFileURL(modules+'/meshoptimizer/meshopt_encoder.js'));await Promise.all([S.ready,E.ready]);
const base=new URL('../dist/assets/buildings/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('lod.json',base))),data=fs.readFileSync(new URL('lod.bin',base)),loader=new GLTFLoader();loader.register(()=>({name:'images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}}}});const b=fs.readFileSync(new URL('urban.glb',base));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene);
// Anchor the corners of each disconnected frame or ornament. A thin frame can
// otherwise disappear even with a small geometric error tolerance.
function componentAnchors(g){
 const p=g.attributes.position,idx=g.index.array,parent=new Uint32Array(p.count),weld=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');if(!weld.has(key))weld.set(key,i);parent[i]=weld.get(key);}
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};for(let i=0;i<idx.length;i+=3){const root=find(idx[i]);parent[find(idx[i+1])]=root;parent[find(idx[i+2])]=root;}
 const groups=new Map();for(let i=0;i<p.count;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}const locks=new Uint8Array(p.count);
 for(const vertices of groups.values()){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const i of vertices)for(let k=0;k<3;k++){const v=p.array[i*3+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}for(let corner=0;corner<8;corner++){let best=-1,distance=Infinity;for(const i of vertices){let d=0;for(let k=0;k<3;k++)d+=(p.array[i*3+k]-((corner>>k)&1?max[k]:min[k]))**2;if(d<distance){best=i;distance=d;}}locks[best]=1;}}
 return locks;
}
// Improve post-transform vertex-cache reuse without changing any triangles or
// remapping the shared full-detail attribute buffers.
function cacheOrder(index){
 if(index.length<900)return index;
 const [remap,count]=E.reorderMesh(index,true,false),reverse=new Uint32Array(count);
 for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)reverse[remap[i]]=i;
 for(let i=0;i<index.length;i++)index[i]=reverse[index[i]];
 return index;
}
const replacements=new Map(),report=[];for(const model of lib.models){let full=0,reduced=0;replacements.set(model.name,model.root.children.map(mesh=>{const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,attributes=new Float32Array(p.count*5),name=mesh.material.name,index=new Uint32Array(g.index.array);for(let i=0;i<p.count;i++)attributes.set([n.getX(i),n.getY(i),n.getZ(i),uv?.getX(i)||0,uv?.getY(i)||0],i*5);const error=name.includes('glass')?.2:name.includes('objects')?.2:name.includes('plaster')?.03:.06;const result=index.length<900?index:S.simplifyWithAttributes(index,p.array,3,attributes,5,[.01,.01,.01,.03,.03],/objects|glass/.test(name)?componentAnchors(g):null,Math.max(12,Math.floor(index.length*.08/3)*3),error,['ErrorAbsolute','Permissive'])[0];full+=index.length/3;reduced+=result.length/3;return cacheOrder(result);}));report.push({name:model.name,full,reduced,previous:manifest[model.name].reduce((n,e)=>n+e.index.count/3,0)});}
const chunks=[],next={};let offset=0;const pack=array=>{const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),entry={offset,count:array.length};chunks.push(bytes);offset+=bytes.length;return entry;};
// Non-shared attribute blocks must precede authored modern indices: the modern
// model baker appends its indices after the last imported attribute block.
for(const [name,entries]of Object.entries(manifest)){if(!replacements.has(name)){next[name]=entries.map(entry=>{const out={};if(entry.sharedAttributes)out.sharedAttributes=true;if(entry.attributes)out.attributes=Object.fromEntries(Object.entries(entry.attributes).map(([key,a])=>[key,{...pack(new Float32Array(data.buffer,data.byteOffset+a.offset,a.count)),itemSize:a.itemSize}]));out.index=pack(new Uint32Array(data.buffer,data.byteOffset+entry.index.offset,entry.index.count));return out;});}else next[name]=replacements.get(name).map(index=>({sharedAttributes:true,index:pack(index)}));}
fs.writeFileSync(new URL('lod.json',base),JSON.stringify(next));fs.writeFileSync(new URL('lod.bin',base),Buffer.concat(chunks));console.log(JSON.stringify({models:report,bytes:offset},null,2));
