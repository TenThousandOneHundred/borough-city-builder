import {finishBuild} from './build-scheduler.js?v=150';
import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Preserve every vertex/material; combine only static meshes with matching render state.
export function batchStatic(group,sharedGeometry){return finishBuild(batchStaticSteps(group,sharedGeometry));}
export function* batchStaticSteps(group,sharedGeometry){
 group.updateMatrixWorld(true);const batches=new Map(),originals=new Set();let before=0;
 const meshes=[],temporary=new Set();group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material))meshes.push(o);});
 try{
 for(const o of meshes){yield;before++;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),paint=g.attributes.roadPaint;if(paint){const e=o.matrixWorld.elements;for(let i=0;i<paint.count;i++){const x=paint.getX(i),y=paint.getY(i),z=paint.getZ(i);paint.setXYZ(i,e[0]*x+e[4]*y+e[8]*z,e[1]*x+e[5]*y+e[9]*z,e[2]*x+e[6]*y+e[10]*z);}}temporary.add(g);if(g.index){const flat=g.toNonIndexed();temporary.add(flat);g.dispose();temporary.delete(g);originals.add(o.geometry);add(flat,o);}else{originals.add(o.geometry);add(g,o);}}
 function add(g,o){if(o.material.userData.roadFinish&&!g.attributes.roadFinish)g.setAttribute('roadFinish',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3),3));for(const name of Object.keys(g.attributes))if(!['position','normal','uv','roadFinish','roadPaint'].includes(name))g.deleteAttribute(name);if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position),center=box.getCenter(new THREE.Vector3()),key=[o.material.uuid,o.castShadow,o.receiveShadow,Math.floor(center.x/32),Math.floor(center.z/32)].join(':');if(!batches.has(key))batches.set(key,{parts:[],material:o.material,cast:o.castShadow,receive:o.receiveShadow});batches.get(key).parts.push(g);}
 group.clear();for(const g of originals)if(g!==sharedGeometry)g.dispose();
 for(const {parts,material,cast,receive}of batches.values()){yield;const geometry=mergeGeometries(parts,false);parts.forEach(g=>{g.dispose();temporary.delete(g);});if(!geometry)throw Error('Static batch attributes differ');geometry.computeBoundingSphere();geometry.boundingSphere.radius+=material.userData.roadPaintExpansion||0;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=receive;group.add(mesh);}
 return{before,after:group.children.length};
 }finally{for(const g of temporary)g.dispose();}
}
