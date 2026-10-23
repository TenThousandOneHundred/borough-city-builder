import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {waterRippleTexture} from '../dist/water-ripples.js';

test('water ripple resources stay independent across worlds and filter distant detail',()=>{
 const a=waterRippleTexture(),b=waterRippleTexture();
 assert.notEqual(a,b);assert.notEqual(a.image.data,b.image.data);assert.deepEqual(a.image.data,b.image.data);
 assert.equal(a.image.data.length,65536);assert.equal(a.wrapS,THREE.RepeatWrapping);assert.equal(a.wrapT,THREE.RepeatWrapping);
 assert.equal(a.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(a.magFilter,THREE.LinearFilter);assert.equal(a.generateMipmaps,true);
 let disposedB=false;b.addEventListener('dispose',()=>{disposedB=true;});a.dispose();assert.equal(disposedB,false);
 a.image.data.fill(0);assert.ok(b.image.data.some(v=>v!==0));b.dispose();
});

test('ripple gradients have no flat clipping, color bias or discontinuity at repeating edges',()=>{
 const t=waterRippleTexture(),{data,width:n}=t.image;
 for(const channel of [0,1]){
  let sum=0,seam=0,inside=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const i=(y*n+x)*4+channel,v=data[i];assert.ok(v>0&&v<255);sum+=v;
   if(x<n-1)inside+=Math.abs(v-data[i+4]);if(y<n-1)inside+=Math.abs(v-data[i+n*4]);
  }
  for(let i=0;i<n;i++){seam+=Math.abs(data[i*n*4+channel]-data[(i*n+n-1)*4+channel]);seam+=Math.abs(data[i*4+channel]-data[((n-1)*n+i)*4+channel]);}
  assert.ok(Math.abs(sum/(n*n)-127.5)<.02,'normal map has no preferred tilt');
  assert.ok(seam/(2*n)<inside/(2*n*(n-1))*1.5,'wrapping is no sharper than adjacent texels');
 }
 t.dispose();
});
