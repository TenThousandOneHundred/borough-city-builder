import * as THREE from '../dist/vendor/three.module.js';
import {createHash} from 'node:crypto';

// Record canvas drawing rather than requiring a browser/GPU for this comparison.
export function canvasDocument(){return {createElement(tag){
 if(tag!=='canvas')throw Error('Unexpected element '+tag);
 const commands=[],canvas={width:0,height:0,commands};let gradient=0;
 const ctx=new Proxy({}, {set(target,key,value){commands.push(['set',key,value]);target[key]=value;return true;},get(target,key){
  if(key in target)return target[key];
  if(String(key).startsWith('create'))return (...args)=>{const id=gradient++;commands.push([key,id,...args]);return {id,addColorStop(...stop){commands.push(['stop',id,...stop]);}}};
  return (...args)=>commands.push([key,...args]);
 }});canvas.getContext=()=>ctx;return canvas;
 }};}
export function architectureView(night=false,near=true){
 const materials=new Map(),view={night,camera:{position:new THREE.Vector3(0,near?8:100,0)},unitBox:new THREE.BoxGeometry(1,1,1),vegetation:{prototypes:[]},landscape:{assets:{}}};
 view.mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color)};
 view.landscape.material=(_name,_scale,color)=>view.mat(color);
 view.carModel=()=>new THREE.Group();
 view.box=(g,x,y,z,w,h,d,color)=>{const m=new THREE.Mesh(view.unitBox,view.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 return view;
}
export function architectureDigest(root){
 const hash=createHash('sha256'),add=value=>hash.update(JSON.stringify(value));root.updateMatrixWorld(true);
 root.traverse(o=>{if(!o.isMesh)return;add([o.matrixWorld.elements,o.castShadow,o.receiveShadow,o.count??null]);
  for(const [name,a]of Object.entries(o.geometry.attributes)){add([name,a.itemSize,a.normalized]);hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
  for(const a of [o.geometry.index,o.instanceMatrix])if(a)hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  for(const m of Array.isArray(o.material)?o.material:[o.material]){add([m.type,m.color?.toArray(),m.emissive?.toArray(),m.roughness,m.metalness,m.envMapIntensity,m.emissiveIntensity,m.bumpScale,m.side,m.transparent,m.opacity,m.depthWrite]);for(const key of ['map','bumpMap']){const t=m[key];add(t?[key,t.image?.width,t.image?.height,t.image?.commands,t.colorSpace,t.wrapS,t.wrapT,t.repeat.toArray(),t.anisotropy]:null);}}
 });return hash.digest('hex');
}
