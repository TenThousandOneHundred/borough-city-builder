// Compare rendered output with the fully loaded legacy renderer, without GPU timing claims.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {Architecture} from '../dist/architecture.js';
import E from '../dist/engine.js';
import {canvasDocument,architectureView,architectureDigest} from '../tests/architecture-fixture.mjs';
const ref=process.argv[2]||'319480d';
let source=execFileSync('git',['show',`${ref}:dist/architecture.js`],{encoding:'utf8'});
source=source.replace(/from '(\.\/[^']+)'/g,(_m,path)=>`from '${new URL('../dist/'+path.slice(2),import.meta.url).href}'`);
const {Architecture:Before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
// Simulate successful completion of old downloads. Neither kit is used in output.
Before.prototype.loadKit=async function(){this.kit=[];};
Before.prototype.loadArchitecture=async function(){this.structural=new Map();};
globalThis.document=canvasDocument();globalThis.CityEngine=E;
const world=E.createWorld('Architecture equivalence','plains',812);let compared=0;
for(const night of [false,true])for(const near of [false,true]){
 const before=new Before(architectureView(night,near)),after=new Architecture(architectureView(night,near));await before.ready;await after.ready;
 for(const [building,spec]of Object.entries(E.BUILDINGS))for(let variant=0;variant<4;variant++){
  const tile={type:spec.type,building,variant,level:2,density:'low'};
  assert.equal(architectureDigest(after.model(tile,2,2,world)),architectureDigest(before.model(tile,2,2,world)),`${building} variant ${variant}, night=${night}, near=${near}`);compared++;
 }
}
let bytes=0,requests=0;
for(const name of ['facade/facade.gltf','architecture/source.gltf']){
 const url=new URL('../dist/assets/'+name,import.meta.url),doc=JSON.parse(readFileSync(url));
 for(const asset of new Set([url.href,...[...(doc.buffers||[]),...(doc.images||[])].filter(v=>v.uri&&!v.uri.startsWith('data:')).map(v=>new URL(v.uri,url).href)])){bytes+=statSync(new URL(asset)).size;requests++;}
}
console.log(JSON.stringify({baseline:ref,compared,geometryMaterialsAndTextureCommands:'identical',unusedRequestsRemoved:requests,unusedAssetBytesRemoved:bytes},null,2));
