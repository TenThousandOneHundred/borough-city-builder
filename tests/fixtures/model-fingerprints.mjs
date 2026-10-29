import fs from 'node:fs';
import {createHash} from 'node:crypto';
export function fingerprints(glbPath,lodPath,binPath){
 const b=fs.readFileSync(glbPath),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length)),start=28+length,result={models:{},lod:{}};
 for(const node of doc.nodes){const h=createHash('sha256');h.update(JSON.stringify(node.extras));for(const p of doc.meshes[node.mesh].primitives){h.update(String(p.material));for(const [name,id]of Object.entries({...p.attributes,indices:p.indices})){h.update(name);const a=doc.accessors[id],v=doc.bufferViews[a.bufferView];h.update(b.subarray(start+(v.byteOffset||0),start+(v.byteOffset||0)+v.byteLength));}}result.models[node.name]=h.digest('hex');}
 const lod=JSON.parse(fs.readFileSync(lodPath)),data=fs.readFileSync(binPath);
 for(const [name,parts]of Object.entries(lod)){const h=createHash('sha256');for(const p of parts){h.update(JSON.stringify({shared:p.sharedAttributes,indexCount:p.index.count,attributes:Object.keys(p.attributes||{})}));for(const a of [...Object.values(p.attributes||{}),p.index])h.update(data.subarray(a.offset,a.offset+a.count*4));}result.lod[name]=h.digest('hex');}
 return result;
}
