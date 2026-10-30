import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const check=process.argv.includes('--check');
const assets=[['buildings/modern.glb',.3],['buildings/lod.bin',.3],['buildings/urban.glb',.9],['buildings/industry.glb',.99],['trees/broadleaf.glb',.75],['trees/mature-conifers.glb',.75]];
let totalRaw=0,totalCompressed=0;
for(const [name,ratio]of assets){
 const url=new URL('../dist/assets/'+name,import.meta.url),raw=await readFile(url);
 const zipped=check?await readFile(new URL(url.href+'.gz')):gzipSync(raw,{level:9});
 assert.deepEqual(gunzipSync(zipped),raw,name+' must decode byte-for-byte');
 assert.ok(zipped.length<raw.length*ratio,name+' compressed download budget');
 if(!check)await writeFile(new URL(url.href+'.gz'),zipped);
 console.log(`${name}: ${raw.length} → ${zipped.length} bytes, identical decoded asset`);
 totalRaw+=raw.length;totalCompressed+=zipped.length;
}
console.log(`Total: ${totalRaw} → ${totalCompressed} bytes`);
