import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import * as THREE from '../dist/vendor/three.module.js';
import {groundCover} from '../dist/ground-cover.js';
import {groundHeight,wetness} from '../dist/landscape.js';
if(!process.argv[2])throw Error('Pass the previous ground-cover module path');
const previous=await import(pathToFileURL(process.argv[2])),w=E.createWorld('Cover benchmark','plains',42),before=JSON.stringify(w);
const old=previous.groundCover({},w,groundHeight,wetness),current=groundCover({},w,groundHeight,wetness);
function digest(g){const entries=[];for(let i=0;i<g.attributes.position.count;i+=3){const data=[];for(const name of ['position','normal','color'])for(let j=i*3;j<(i+3)*3;j++)data.push(g.attributes[name].array[j]);entries.push(createHash('sha256').update(Buffer.from(new Float32Array(data).buffer)).digest('hex'));}return createHash('sha256').update(entries.sort().join('')).digest('hex');}
if(digest(old.geometry)!==digest(current.children[0].geometry))throw Error('Geometry changed');
const camera=new THREE.PerspectiveCamera(43,16/9,.2,1800),results=[];
for(const [name,position,target]of [['street',[0,8,15],[0,0,0]],['neighborhood',[30,24,40],[15,0,10]],['overview',[0,250,300],[0,0,0]],['away',[0,15,450],[0,0,500]]]){
 camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld();current.userData.update(camera);
 const f=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const oldVertices=f.intersectsSphere(old.geometry.boundingSphere)?old.geometry.attributes.position.count:0;
 results.push({name,beforeTriangles:oldVertices/3,afterTriangles:current.userData.stats.visibleVertices/3,draws:current.userData.stats.visibleChunks,mode:current.userData.stats.mode,candidates:current.userData.stats.candidateChunks});
}
if(JSON.stringify(w)!==before)throw Error('World changed');
console.log(JSON.stringify({geometryMatches:true,worldUnchanged:true,triangles:old.geometry.attributes.position.count/3,chunks:current.userData.stats.totalChunks,views:results},null,2));
old.geometry.dispose();old.material.dispose();current.userData.dispose();
