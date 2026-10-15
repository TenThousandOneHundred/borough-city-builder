// Geometry workload comparison, not a browser FPS benchmark.
import * as THREE from '../dist/vendor/three.module.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const bytes=fs.readFileSync(new URL('../dist/assets/trees/broadleaf.glb',import.meta.url));
const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
scene.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());scene.scale.setScalar(2/size.y);
const buildings=new Map();for(let x=-30;x<=30;x+=10)for(let z=-30;z<=30;z+=10){
 const root=new THREE.Group();root.position.set(x,0,z);root.userData={factory:true,asset:true,renderImmutable:true};
 // The enclosing block shares a large visibility sphere with its roof trees.
 const block=new THREE.Mesh(new THREE.BoxGeometry(9,16,9),new THREE.MeshStandardMaterial());block.position.y=8;block.userData.sharedAsset=true;root.add(block);
 for(const dx of [-3,0,3])for(const dz of [-3,3]){const tree=scene.clone(true);tree.position.set(dx,16,dz);tree.traverse(o=>{if(o.isMesh)o.userData={sharedAsset:true,siteRange:[0,30]}});root.add(tree);}
 buildings.set(buildings.size,root);
}
const camera=new THREE.PerspectiveCamera(45,16/9,.1,500),view={scene:new THREE.Scene(),camera,landscape:{assets:{}}},factory=new BuildingFactory(view);camera.position.set(0,18,8);camera.lookAt(0,17,-12);factory.rebuild(buildings);
let before=0,after=0,shadowBefore=0,shadowAfter=0;
for(let i=0;i<24;i++){
 const a=i*Math.PI/12;camera.position.set(Math.sin(a)*20,18,Math.cos(a)*20);camera.lookAt(0,16,0);
 for(const b of factory.instanceBatches)for(const t of b.transforms){t.savedBounds=t.detailBounds;t.detailBounds=null;}
 factory.visibilitySignature=null;factory.updateVisibility();for(const b of factory.instanceBatches){before+=b.near.count*(b.near.geometry.index?.count||b.near.geometry.attributes.position.count)/3;shadowBefore+=b.shadow.userData.casterCount;}
 for(const b of factory.instanceBatches)for(const t of b.transforms)t.detailBounds=t.savedBounds;
 factory.visibilitySignature=null;factory.updateVisibility();for(const b of factory.instanceBatches){after+=b.near.count*(b.near.geometry.index?.count||b.near.geometry.attributes.position.count)/3;shadowAfter+=b.shadow.userData.casterCount;}
}
assert.equal(shadowAfter,shadowBefore);assert.ok(after<before);
console.log(JSON.stringify({lots:49,trees:294,cameraViews:24,beforeTriangles:before,afterTriangles:after,reductionPercent:100*(1-after/before),shadowMembershipUnchanged:true},null,2));
