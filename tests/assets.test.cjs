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
