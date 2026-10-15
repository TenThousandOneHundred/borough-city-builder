import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Preserve every vertex/material; combine only static meshes with matching render state.
export function batchStatic(group,sharedGeometry){
 group.updateMatrixWorld(true);const batches=new Map(),originals=new Set();let before=0;
 group.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;before++;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const flat=g.toNonIndexed();g.dispose();originals.add(o.geometry);add(flat,o);}else{originals.add(o.geometry);add(g,o);}});
 function add(g,o){if(o.material.userData.roadFinish&&!g.attributes.roadFinish)g.setAttribute('roadFinish',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3),3));for(const name of Object.keys(g.attributes))if(!['position','normal','uv','roadFinish'].includes(name))g.deleteAttribute(name);if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position),center=box.getCenter(new THREE.Vector3()),key=[o.material.uuid,o.castShadow,o.receiveShadow,Math.floor(center.x/32),Math.floor(center.z/32)].join(':');if(!batches.has(key))batches.set(key,{parts:[],material:o.material,cast:o.castShadow,receive:o.receiveShadow});batches.get(key).parts.push(g);}
 group.clear();for(const g of originals)if(g!==sharedGeometry)g.dispose();
 for(const {parts,material,cast,receive}of batches.values()){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geometry)throw Error('Static batch attributes differ');geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=cast;mesh.receiveShadow=receive;group.add(mesh);}
 return{before,after:group.children.length};
}
