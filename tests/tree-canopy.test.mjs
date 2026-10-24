import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const file=fs.readFileSync(new URL('../dist/assets/trees/broadleaf.glb',import.meta.url)),length=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+length)),data=file.subarray(28+length),dims={SCALAR:1,VEC2:2,VEC3:3},types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5120:Int8Array};
const read=id=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],T=types[a.componentType],size=dims[a.type],values=new T(a.count*size),stride=v.byteStride||size*T.BYTES_PER_ELEMENT;for(let i=0;i<a.count;i++)values.set(new T(data.buffer,data.byteOffset+(v.byteOffset||0)+(a.byteOffset||0)+i*stride,size),i*size);return values;};
const leaf=doc.meshes.flatMap(m=>m.primitives).find(p=>doc.materials[p.material].name==='tree_small_02_leaves');
test('the shipped canopy keeps all 30250 leaf pieces inside a bounded near-tree mesh',()=>{
 const positions=read(leaf.attributes.POSITION),indices=read(leaf.indices),parent=Uint32Array.from({length:positions.length/3},(_,i)=>i),used=new Set();const find=i=>{while(i!==parent[i]){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<indices.length;i+=3){for(let j=0;j<3;j++){assert.ok(indices[i+j]<parent.length);used.add(indices[i+j]);}const a=find(indices[i]);parent[find(indices[i+1])]=a;parent[find(indices[i+2])]=find(a);}
 assert.equal(new Set([...used].map(find)).size,30250,'every original leaf piece survives');assert.equal(used.size,parent.length,'no unused vertices');assert.ok(indices.length/3<61000);assert.ok(positions.every(Number.isFinite));
 const bounds=doc.accessors[leaf.attributes.POSITION];assert.ok(bounds.max[1]>4.5&&bounds.min[1]<1.5);assert.ok(bounds.max[2]>2.8&&bounds.min[2]<-1.3);assert.ok(file.length<4*1024*1024);assert.ok(fs.statSync(new URL('../dist/assets/trees/broadleaf.glb.gz',import.meta.url)).size<2.5*1024*1024);
});
test('leaf outlines face their textured normals and use opaque depth instead of duplicate transparency passes',()=>{
 const p=read(leaf.attributes.POSITION),n=read(leaf.attributes.NORMAL),uv=read(leaf.attributes.TEXCOORD_0),ix=read(leaf.indices);let inverted=0;
 for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3,ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],nx=n[a]+n[b]+n[c],ny=n[a+1]+n[b+1]+n[c+1],nz=n[a+2]+n[b+2]+n[c+2];if((ay*bz-az*by)*nx+(az*bx-ax*bz)*ny+(ax*by-ay*bx)*nz< -1e-6)inverted++;}
 assert.equal(inverted,0,'leaf winding agrees with lighting normals');assert.equal(doc.materials[leaf.material].alphaMode,'OPAQUE');assert.equal(doc.materials[leaf.material].doubleSided,true);assert.ok(doc.images.every(i=>i.mimeType==='image/jpeg'));assert.equal(doc.accessors[leaf.attributes.NORMAL].normalized,true);assert.equal(doc.accessors[leaf.attributes.TEXCOORD_0].normalized,true);assert.ok(uv.every(v=>v>=0&&v<=65535));assert.ok(doc.extensionsRequired.includes('KHR_mesh_quantization'));
});
test('tree bark geometry, texture images and material texture bindings are unchanged',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex'),actual={wood:{},images:doc.images.map(img=>{const v=doc.bufferViews[img.bufferView];return hash(data.subarray(v.byteOffset,v.byteOffset+v.byteLength));}),materials:doc.materials.map(m=>{const copy=structuredClone(m);delete copy.alphaMode;delete copy.alphaCutoff;return copy;})};
 for(const m of doc.meshes)for(const p of m.primitives){const name=doc.materials[p.material].name;if(name==='tree_small_02_leaves')continue;actual.wood[name]=Object.fromEntries(Object.entries({...p.attributes,indices:p.indices}).map(([key,id])=>{const a=read(id);return[key,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]}));}
 assert.deepEqual(actual,JSON.parse(fs.readFileSync(new URL('./fixtures/tree-source-116.json',import.meta.url))));
});
function alphaCoverage(png){let offset=8,idat=[];const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.equal(png[24],8);assert.equal(png[25],6);while(offset<png.length){const size=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8);if(kind==='IDAT')idat.push(png.subarray(offset+8,offset+8+size));offset+=size+12;}const raw=inflateSync(Buffer.concat(idat)),stride=width*4,rows=Buffer.alloc(height*stride),counts=[0,0,0,0],paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?rows[i-4]:0,b=y?rows[i-stride]:0,c=y&&x>=4?rows[i-stride-4]:0,predict=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];assert.notEqual(predict,undefined);rows[i]=(raw[y*(stride+1)+x+1]+predict)&255;if(x%4===3&&rows[i]>76)counts[Math.floor(y/512)]++;}}return counts;}
test('all four distant canopy elevations retain the fuller silhouette and transparent background',()=>{
 const coverage=alphaCoverage(fs.readFileSync(new URL('../dist/assets/trees/broadleaf-elevations.png',import.meta.url))),previous=[32056,30427,25348,24653];for(let i=0;i<4;i++){assert.ok(coverage[i]>previous[i]*1.4,'coverage is restored at every elevation');assert.ok(coverage[i]<512*512*.4,'transparent surroundings remain');}
});
