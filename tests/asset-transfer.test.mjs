import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {loadBinary,trackAssetGroups} from '../dist/asset-transfer.js';
const raw=new TextEncoder().encode('Detailed buildings, textures, indices and normals.');
test('compressed asset restores identical bytes and retains project path and version',async()=>{
 const requests=[];
 const result=await loadBinary('https://example.test/borough/assets/modern.glb?v=27.1',{fetcher:async(url)=>{requests.push(url);return new Response(gzipSync(raw));}});
 assert.deepEqual(new Uint8Array(result),raw);assert.deepEqual(requests,['https://example.test/borough/assets/modern.glb.gz?v=27.1']);
});
test('older browsers download the original asset without a compressed request',async()=>{
 const requests=[];
 const result=await loadBinary('https://example.test/lod.bin',{Decompressor:null,fetcher:async url=>{requests.push(url);return new Response(raw);}});
 assert.deepEqual(new Uint8Array(result),raw);assert.deepEqual(requests,['https://example.test/lod.bin']);
});
test('missing and corrupt gzip copies fall back to full-detail originals',async()=>{
 for(const response of [()=>new Response('',{status:404}),()=>new Response('corrupt')]){
  const requests=[];const result=await loadBinary('https://example.test/lod.bin',{fetcher:async url=>{requests.push(url);return url.endsWith('.gz')?response():new Response(raw);}});
  assert.equal(requests.length,2);assert.deepEqual(new Uint8Array(result),raw);
 }
});
test('stalled downloads abort and reject after bounded fallback attempts',async()=>{
 let requests=0;
 await assert.rejects(loadBinary('https://example.test/lod.bin',{timeoutMs:5,fetcher:(_,options)=>new Promise((resolve,reject)=>{requests++;options.signal.addEventListener('abort',()=>reject(new Error('aborted')));})}),/aborted/);
 assert.equal(requests,2);
});
test('slow downloads continue while bytes arrive even past the inactivity timeout',async()=>{
 let signal,index=0;
 const result=await loadBinary('https://example.test/lod.bin',{Decompressor:null,timeoutMs:50,fetcher:async(_,options)=>{
  signal=options.signal;return new Response(new ReadableStream({async pull(controller){await new Promise(resolve=>setTimeout(resolve,20));if(index<6)controller.enqueue(raw.slice(index*8,++index*8));else controller.close();}}));
 }});
 assert.equal(signal.aborted,false);assert.deepEqual(new Uint8Array(result),raw.slice(0,48));
});
test('loading progress identifies pending groups regardless of completion order',async()=>{
 let finishModels,finishTerrain;const reports=[];
 const ready=trackAssetGroups({Buildings:new Promise(resolve=>finishModels=resolve),Terrain:new Promise(resolve=>finishTerrain=resolve)},state=>reports.push(state));
 finishTerrain();await Promise.resolve();assert.deepEqual(reports.at(-1),{completed:1,total:2,pending:['Buildings']});
 finishModels();await ready;assert.deepEqual(reports.at(-1),{completed:2,total:2,pending:[]});
});
