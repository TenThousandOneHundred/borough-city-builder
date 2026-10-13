import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const check=process.argv.includes('--check');
for(const name of ['modern.glb','lod.bin']){
 const url=new URL('../dist/assets/buildings/'+name,import.meta.url),raw=await readFile(url);
 const zipped=check?await readFile(new URL(url.href+'.gz')):gzipSync(raw,{level:9});
 assert.deepEqual(gunzipSync(zipped),raw,name+' must decode byte-for-byte');
 assert.ok(zipped.length<raw.length*.3,name+' compressed download budget');
 if(!check)await writeFile(new URL(url.href+'.gz'),zipped);
 console.log(`${name}: ${raw.length} → ${zipped.length} bytes, identical decoded asset`);
}
