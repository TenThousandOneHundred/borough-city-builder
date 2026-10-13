const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
for(const folder of ['architecture','pine','facade']){
 const base=path.join(root,'assets',folder),model=JSON.parse(fs.readFileSync(path.join(base,folder==='facade'?'facade.gltf':'source.gltf')));
 for(const b of model.buffers){assert.equal(fs.statSync(path.join(base,b.uri)).size,b.byteLength,folder+' buffer length')}
 for(const v of model.bufferViews){assert.ok((v.byteOffset||0)+v.byteLength<=model.buffers[v.buffer].byteLength,folder+' buffer bounds')}
 for(const i of model.images){assert.ok(fs.existsSync(path.join(base,i.uri)),folder+' missing image '+i.uri)}
 for(const m of model.meshes)for(const p of m.primitives){assert.ok(model.materials[p.material]);for(const accessor of Object.values(p.attributes))assert.ok(model.accessors[accessor])}
}
for(let i=0;i<4;i++){const b=fs.readFileSync(path.join(root,'assets/trees/broadleaf-'+i+'.png'));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),640);assert.equal(b.readUInt32BE(20),768)}
assert.ok(fs.readFileSync(path.join(root,'assets/daylight.hdr')).subarray(0,11).toString().includes('RADIANCE'));
console.log('Model buffers, local texture dependencies, tree images and HDR environment verified');

const tree=fs.readFileSync(path.join(root,'assets/trees/broadleaf.glb'));
assert.equal(tree.toString('utf8',0,4),'glTF');assert.equal(tree.readUInt32LE(4),2);assert.equal(tree.readUInt32LE(8),tree.length);
const jsonLength=tree.readUInt32LE(12),model=JSON.parse(tree.toString('utf8',20,20+jsonLength));
for(const v of model.bufferViews)assert.ok((v.byteOffset||0)+v.byteLength<=model.buffers[v.buffer].byteLength);
for(const image of model.images)assert.ok(model.bufferViews[image.bufferView]);
assert.ok(tree.length<4*1024*1024,'nearby tree stays within download budget');

for(const file of ['rock-color.jpg','rock-normal.jpg']){const b=fs.readFileSync(path.join(root,'assets',file));assert.equal(b.readUInt16BE(0),0xffd8);assert.ok(b.length>10000&&b.length<2*1024*1024);}

let buildingCount=0;
for(const file of ['buildings/urban.glb','buildings/industry.glb','buildings/modern.glb','coast.glb']){
 const data=fs.readFileSync(path.join(root,'assets',file));
 assert.equal(data.toString('utf8',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 assert.ok(data.length<12*1024*1024,file+' download budget');
 for(const buffer of gltf.buffers)assert.equal(buffer.uri,undefined,'self contained GLB');
 for(const view of gltf.bufferViews)assert.ok((view.byteOffset||0)+view.byteLength<=gltf.buffers[view.buffer].byteLength);
 for(const image of gltf.images||[])assert.ok(gltf.bufferViews[image.bufferView],'embedded texture');
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){assert.ok(gltf.accessors[primitive.attributes.POSITION]);assert.ok(gltf.materials[primitive.material]);}
 if(file==='buildings/modern.glb'){
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
   const normal=gltf.accessors[primitive.attributes.NORMAL];assert.equal(normal.componentType,5120);assert.equal(normal.normalized,true);assert.equal(gltf.bufferViews[normal.bufferView].byteStride,4,'packed normals use aligned strides');
   const colors=gltf.accessors[primitive.attributes.COLOR_0],indices=gltf.accessors[primitive.indices];
   assert.equal(colors.componentType,5121);assert.equal(colors.normalized,true);assert.equal(colors.type,'VEC4','byte vertex colors stay four-byte aligned');
   assert.equal(indices.componentType,5123,'modern parts fit compact lossless indices');
  }
  assert.ok(data.length<10*1024*1024,'full modern geometry uses compact vertex encoding');
 }
 if(file.startsWith('buildings/')){
  const roots=gltf.scenes[gltf.scene||0].nodes;buildingCount+=roots.length;
  const triangles=index=>{const node=gltf.nodes[index];return (node.mesh===undefined?0:gltf.meshes[node.mesh].primitives.reduce((n,p)=>n+gltf.accessors[p.indices ?? p.attributes.POSITION].count/3,0))+(node.children||[]).reduce((n,i)=>n+triangles(i),0)};
  for(const index of roots){assert.ok(gltf.nodes[index].extras.category);assert.ok(triangles(index)<200000,'complete building triangle budget');}
 }
}
assert.equal(buildingCount,51);
console.log('51 complete GLB buildings and scanned coast verified');
const coastData=fs.readFileSync(path.join(root,'assets/coast.glb')),coast=JSON.parse(coastData.toString('utf8',20,20+coastData.readUInt32LE(12)));
assert.ok(coast.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+coast.accessors[p.indices??p.attributes.POSITION].count/3,0),0)<5000,'coastal patch triangle budget');
assert.ok(fs.statSync(path.join(root,'assets/buildings/lod.bin')).size<10*1024*1024,'distant geometry download budget');
