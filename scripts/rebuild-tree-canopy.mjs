// Rebuild a complete canopy from the CC0 source, keeping every connected leaf
// piece. Usage: node scripts/rebuild-tree-canopy.mjs SOURCE.gltf BASELINE.glb
// OUTPUT.glb
// Source: https://polyhaven.com/a/tree_small_02 (CC0). Supply its original
// glTF and binary alongside the Edition 116 GLB for unchanged bark and images.
// Each connected source leaf is reconstructed from its UV outline. At least
// 60% of that convex outline remains, instead of shrinking leaves with a
// whole-tree distance tolerance. Positions and texture images remain original.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const [sourcePath,baselinePath,outputPath]=process.argv.slice(2);if(!outputPath)throw Error('Source glTF, baseline GLB and output GLB are required');
const original=JSON.parse(fs.readFileSync(sourcePath)),sourceData=fs.readFileSync(path.resolve(path.dirname(sourcePath),original.buffers[0].uri));
const baseline=fs.readFileSync(baselinePath),jsonSize=baseline.readUInt32LE(12),doc=JSON.parse(baseline.subarray(20,20+jsonSize)),oldData=baseline.subarray(28+jsonSize);
const dims={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5122:Int16Array,5121:Uint8Array,5120:Int8Array};
function read(d,data,id){const a=d.accessors[id],v=d.bufferViews[a.bufferView],T=types[a.componentType],size=dims[a.type],stride=v.byteStride||size*T.BYTES_PER_ELEMENT,start=(v.byteOffset||0)+(a.byteOffset||0);if(stride===size*T.BYTES_PER_ELEMENT)return new T(data.buffer,data.byteOffset+start,a.count*size);const result=new T(a.count*size);for(let i=0;i<a.count;i++)result.set(new T(data.buffer,data.byteOffset+start+i*stride,size),i*size);return result;}
const leafPrimitive=original.meshes.flatMap(m=>m.primitives).find(p=>original.materials[p.material].name==='tree_small_02_leaves');
const positions=read(original,sourceData,leafPrimitive.attributes.POSITION),indices=read(original,sourceData,leafPrimitive.indices),parent=Uint32Array.from({length:positions.length/3},(_,i)=>i);
const find=i=>{while(i!==parent[i]){parent[i]=parent[parent[i]];i=parent[i];}return i;};
for(let i=0;i<indices.length;i+=3){const a=find(indices[i]);parent[find(indices[i+1])]=a;parent[find(indices[i+2])]=find(a);}
const groups=new Map();
for(let i=0;i<parent.length;i++){const id=find(i);parent[i]=id;if(!groups.has(id))groups.set(id,{vertices:[]});groups.get(id).vertices.push(i);}
const sourceUv=read(original,sourceData,leafPrimitive.attributes.TEXCOORD_0);
function hull(vertices){const points=vertices.map(i=>({i,x:sourceUv[i*2],y:sourceUv[i*2+1]})).sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const lower=[],upper=[];for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of points.toReversed()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
const polygonArea=points=>Math.abs(points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-p.y*q.x;},0))/2;
const selected=[];let maxError=0,planarPieces=0;
const sourceNormals=read(original,sourceData,leafPrimitive.attributes.NORMAL);
function triangle(a,b,c){const ax=positions[b*3]-positions[a*3],ay=positions[b*3+1]-positions[a*3+1],az=positions[b*3+2]-positions[a*3+2],bx=positions[c*3]-positions[a*3],by=positions[c*3+1]-positions[a*3+1],bz=positions[c*3+2]-positions[a*3+2],nx=sourceNormals[a*3]+sourceNormals[b*3]+sourceNormals[c*3],ny=sourceNormals[a*3+1]+sourceNormals[b*3+1]+sourceNormals[c*3+1],nz=sourceNormals[a*3+2]+sourceNormals[b*3+2]+sourceNormals[c*3+2];if((ay*bz-az*by)*nx+(az*bx-ax*bz)*ny+(ax*by-ay*bx)*nz<0)selected.push(a,c,b);else selected.push(a,b,c);}
for(const g of groups.values()){
 const polygon=hull(g.vertices),originalArea=polygonArea(polygon);let area=originalArea;
 if(polygon.length>=3&&originalArea>1e-10){
  while(polygon.length>4){let smallest=Infinity,best=-1;for(let i=0;i<polygon.length;i++){const a=polygon[(i+polygon.length-1)%polygon.length],b=polygon[i],c=polygon[(i+1)%polygon.length],loss=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;if(loss<smallest){smallest=loss;best=i;}}if(area-smallest<originalArea*.6)break;area-=smallest;polygon.splice(best,1);}
  for(let i=1;i<polygon.length-1;i++)triangle(polygon[0].i,polygon[i].i,polygon[i+1].i);planarPieces++;maxError=Math.max(maxError,1-area/originalArea);
 }else throw Error('A source leaf has no usable texture-space silhouette');
}
const remap=new Map(),vertices=[];const reducedIndices=Uint32Array.from(selected,i=>{if(!remap.has(i)){remap.set(i,vertices.length);vertices.push(i);}return remap.get(i);});
const leafAttributes=Object.fromEntries(Object.entries(leafPrimitive.attributes).map(([name,id])=>{const a=original.accessors[id],values=read(original,sourceData,id),size=dims[a.type];return[name,{descriptor:a,values:Float32Array.from(vertices.flatMap(i=>Array.from(values.subarray(i*size,i*size+size))))}];}));
const accessors=[],views=[],chunks=[];let offset=0;
function block(bytes,target){const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}const id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);offset+=bytes.length;return id;}
function accessor(a,values,target){const descriptor={type:a.type,componentType:a.componentType,count:values.length/dims[a.type],bufferView:block(Buffer.from(values.buffer,values.byteOffset,values.byteLength),target),...(a.normalized?{normalized:true}:{})};if(a.type==='VEC3'&&target===34962){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++) {min[i%3]=Math.min(min[i%3],values[i]);max[i%3]=Math.max(max[i%3],values[i]);}descriptor.min=min;descriptor.max=max;}accessors.push(descriptor);return accessors.length-1;}
for(const mesh of doc.meshes)for(const p of mesh.primitives){const leaf=doc.materials[p.material].name==='tree_small_02_leaves';for(const [name,id]of Object.entries(p.attributes)){if(leaf&&name==='TEXCOORD_1'){delete p.attributes[name];continue;}const a=leaf?leafAttributes[name].descriptor:doc.accessors[id],values=leaf?leafAttributes[name].values:read(doc,oldData,id);if(leaf&&name==='NORMAL'){const packed=new Int8Array(values.length/3*4);for(let i=0;i<values.length;i++)packed[Math.floor(i/3)*4+i%3]=Math.round(Math.max(-1,Math.min(1,values[i]))*127);const id=accessors.length,view=block(Buffer.from(packed.buffer),34962);views[view].byteStride=4;accessors.push({type:'VEC3',componentType:5120,normalized:true,count:values.length/3,bufferView:view});p.attributes[name]=id;}else if(leaf&&name==='TEXCOORD_0'){assert.ok(values.every(v=>v>=0&&v<=1));p.attributes[name]=accessor({...a,componentType:5123,normalized:true},Uint16Array.from(values,v=>Math.round(v*65535)),34962);}else p.attributes[name]=accessor(a,values,34962);}const a=leaf?{type:'SCALAR',componentType:5125}:doc.accessors[p.indices];p.indices=accessor(a,leaf?reducedIndices:read(doc,oldData,p.indices),34963);}
for(const image of doc.images){const view=doc.bufferViews[image.bufferView];image.bufferView=block(oldData.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));}
// The source uses physical leaf outlines and opaque JPEG textures. Opaque
// foliage writes depth once; BLEND unnecessarily rendered both sides twice.
assert.ok(doc.images.every(i=>i.mimeType==='image/jpeg'));
const leafMaterial=doc.materials.find(m=>m.name==='tree_small_02_leaves');leafMaterial.alphaMode='OPAQUE';delete leafMaterial.alphaCutoff;
doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'KHR_mesh_quantization'])];doc.extensionsRequired=[...new Set([...(doc.extensionsRequired||[]),'KHR_mesh_quantization'])];
doc.accessors=accessors;doc.bufferViews=views;doc.buffers=[{byteLength:offset}];
const json=Buffer.from(JSON.stringify(doc)),jsonPadding=Buffer.alloc((4-json.length%4)%4,32),binary=Buffer.concat(chunks),binaryPadding=Buffer.alloc((4-binary.length%4)%4),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jsonPadding.length+binary.length+binaryPadding.length,8);header.writeUInt32LE(json.length+jsonPadding.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length+binaryPadding.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(outputPath,Buffer.concat([header,json,jsonPadding,binHeader,binary,binaryPadding]));
console.log(JSON.stringify({sourceLeafTriangles:indices.length/3,preservedLeafPieces:groups.size,leafTriangles:reducedIndices.length/3,vertices:vertices.length,maxSilhouetteAreaLoss:maxError,planarPieces,bytes:fs.statSync(outputPath).size},null,2));
