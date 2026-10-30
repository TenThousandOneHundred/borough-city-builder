import './map-grid.js?v=168';
const G=globalThis.BoroughGrid;
import * as THREE from './vendor/three.module.js';
// Cache CPU geometry only. Callers receive independent copies so overlays and
// sculpting cannot modify the cached natural terrain or another world's mesh.
const cache=new WeakMap();
export function terrainMeshes(world,height,color){
 const key=[world.seed,world.terrain,world.landformVersion,world.elevationRevision||0].join('|'),old=cache.get(world);
 if(old&&old.key===key&&old.elevation===world.elevation&&old.height===height&&old.color===color)return {ground:old.ground.clone(),far:old.far.clone(),cacheHit:true,samples:0};
 const ground=new THREE.PlaneGeometry(G.span,G.span,G.span,G.span);ground.rotateX(-Math.PI/2);
 const samples=new Float64Array(G.sampleN*G.sampleN),ready=new Uint8Array(samples.length);let sampleCount=0;
 const sampled=(w,x,z)=>{if(w!==world||!Number.isInteger(x)||!Number.isInteger(z)||Math.abs(x)>G.halfPlus1||Math.abs(z)>G.halfPlus1){sampleCount++;return height(w,x,z);}const i=(z+G.halfPlus1)*G.sampleN+x+G.halfPlus1;if(!ready[i]){samples[i]=height(w,x,z);ready[i]=1;sampleCount++;}return samples[i];};
 const pos=ground.attributes.position,colors=new Float32Array(pos.count*3);
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,sampled(world,x,z));const c=color(world,x,z,sampled);colors.set([c.r,c.g,c.b],i*3);}
 ground.setAttribute('color',new THREE.BufferAttribute(colors,3));ground.computeVertexNormals();
 const far=new THREE.PlaneGeometry(1100,1100,400,400);far.rotateX(-Math.PI/2);const fp=far.attributes.position;
 for(let i=0;i<fp.count;i++)fp.setY(i,height(world,fp.getX(i),fp.getZ(i))-.1);
 const indices=[],original=far.index.array;
 for(let i=0;i<original.length;i+=3){let x=0,z=0;for(let j=0;j<3;j++){x+=fp.getX(original[i+j])/3;z+=fp.getZ(original[i+j])/3;}if(Math.abs(x)>G.halfMinus1||Math.abs(z)>G.halfMinus1)indices.push(original[i],original[i+1],original[i+2]);}
 far.setIndex(indices);far.computeVertexNormals();const farColors=new Float32Array(fp.count*3);
 for(let i=0;i<fp.count;i++){const c=color(world,fp.getX(i),fp.getZ(i));farColors.set([c.r,c.g,c.b],i*3);}
 far.setAttribute('color',new THREE.BufferAttribute(farColors,3));old?.ground.dispose();old?.far.dispose();cache.set(world,{key,elevation:world.elevation,height,color,ground,far});
 return {ground:ground.clone(),far:far.clone(),cacheHit:false,samples:sampleCount};
}

terrainMeshes=G.bind(terrainMeshes);
