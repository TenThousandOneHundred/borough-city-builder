import './map-grid.js?v=166';
const G=globalThis.BoroughGrid;
import * as THREE from './vendor/three.module.js';
import {finishBuild} from './build-scheduler.js?v=166';

export function constructionGrid(height){return finishBuild(constructionGridSteps(height));}
export function* constructionGridSteps(height){
 const points=[],heights=new Map();
 // Adjacent segments share endpoints. Sample each point once without changing
 // the released vertex order, resolution, or terrain-fitting calculation.
 const y=(x,z)=>{const key=x+','+z;if(!heights.has(key))heights.set(key,height(x,z)+.15);return heights.get(key);};
 for(let s=0;s<=G.n;s++){yield;for(let k=0;k<G.half;k++){
  const a=-G.half+s*4,b=-G.half+k*2;
  points.push(a,y(a,b),b,a,y(a,b+2),b+2);
  points.push(b,y(b,a),a,b+2,y(b+2,a),a);
 }}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return geometry;
}

constructionGridSteps=G.bind(constructionGridSteps);
