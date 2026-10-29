import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {residentialFinish,applyResidentialFinish,configureResidentialBrick} from '../dist/residential-finishes.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {ModelLibrary} from '../dist/model-library.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';

const close=(a,b)=>{for(const key of ['r','g','b'])assert.ok(Math.abs(a[key]-b[key])<1e-6);};
function fixture(){
 const camera=new THREE.PerspectiveCamera(45,1,.1,300);camera.position.set(0,3,12);camera.lookAt(0,0,0);
 const factory=new BuildingFactory({scene:new THREE.Scene(),camera,landscape:{assets:{}},reflectionsEnabled:false}),geometry=new THREE.BoxGeometry(1,2,1),material=new THREE.MeshStandardMaterial();geometry.userData.lod=new THREE.BoxGeometry(1,2,1);
 const root=(x,color)=>{const group=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);mesh.userData={sharedAsset:true,...color?{instanceColor:new THREE.Color(...color)}:{}};group.add(mesh);group.position.x=x;group.userData={factory:true,asset:true,renderImmutable:true};return group;};
 return {factory,camera,root};
}
test('individual homes have stable coordinated finishes across copies and save reloads',()=>{
 const seen=new Set();for(let seed=0;seed<32;seed++)for(let copy=0;copy<6;copy++){const a=residentialFinish(seed,copy);assert.deepEqual(a,residentialFinish(seed,copy));seen.add(a.index);for(const role of ['wall','roof','trim','door'])assert.ok(a[role].every(n=>Number.isFinite(n)&&n>0&&n<2));}assert.equal(seen.size,8);assert.ok(new Set(Array.from({length:6},(_,i)=>residentialFinish(431,i).index)).size>2);
});
test('finishes keep every source geometry and shared material while leaving glass and garden foliage unchanged',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),names=['modern-brick','modern-roof','modern-painted','modern-wood','modern-glass','modern-glass-occupied','modern-leaves','modern-recess'],materials=names.map(name=>Object.assign(new THREE.MeshStandardMaterial(),{name}));
 for(const material of materials)root.add(new THREE.Mesh(geometry,material));const before=geometry.attributes.position.array.slice();applyResidentialFinish(root,431,0);
 root.children.forEach((mesh,i)=>{assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,materials[i]);assert.equal(!!mesh.userData.instanceColor,i<4);});assert.deepEqual(geometry.attributes.position.array,before);
});
test('neutral masonry shader preserves map sampling, normals and standard lighting and applies tint once',()=>{
 const m=new THREE.MeshStandardMaterial({map:new THREE.Texture(),normalMap:new THREE.Texture()}),map=m.map,normal=m.normalMap;configureResidentialBrick(m);const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <normal_fragment_maps>'};m.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes('homeFinish=instanceColor'));assert.ok(shader.fragmentShader.includes('diffuseColor.rgb/max(homeFinish'));assert.ok(shader.fragmentShader.includes('#include <map_fragment>'));assert.ok(shader.fragmentShader.includes('#include <normal_fragment_maps>'));assert.equal(m.map,map);assert.equal(m.normalMap,normal);assert.equal(m.isMeshStandardMaterial,true);
});
test('colored homes retain one material batch and stable color uploads across camera culling, LOD and relocation',()=>{
 const {factory,camera,root}=fixture(),red=root(-2,[.9,.4,.3]),gray=root(2,[.6,.65,.7]),buildings=new Map([[1,red],[2,gray]]);factory.rebuild(buildings);const batch=factory.instanceBatches[0],color=new THREE.Color();assert.equal(factory.instanceBatches.length,1);assert.equal(batch.near.count,2);batch.near.getColorAt(0,color);close(color,red.children[0].userData.instanceColor);
 const version=batch.near.instanceColor.version;factory.rebuild(buildings);assert.equal(batch.near.instanceColor.version,version,'idle frames do not upload colors');
 camera.position.set(0,4,60);camera.lookAt(0,0,0);factory.updateVisibility();assert.equal(batch.far.count,2);batch.far.getColorAt(1,color);close(color,gray.children[0].userData.instanceColor);
 buildings.delete(1);factory.rebuild(buildings);const remaining=factory.instanceBatches[0];remaining.far.getColorAt(0,color);close(color,gray.children[0].userData.instanceColor);
 gray.position.x=0;gray.children[0].userData.instanceColor.setRGB(.3,.5,.4);gray.userData.renderVersion=1;factory.rebuild(buildings);factory.instanceBatches[0].far.getColorAt(0,color);close(color,gray.children[0].userData.instanceColor);
});
test('untinted replacements reset reused instance slots to white and exports retain the complete colored set',()=>{
 const {factory,root}=fixture(),buildings=new Map([[1,root(0,[.3,.4,.5])]]);factory.rebuild(buildings);const batch=factory.instanceBatches[0],mesh=batch.near;buildings.set(1,root(0));factory.rebuild(buildings);assert.equal(factory.instanceBatches[0].near,mesh);const color=new THREE.Color();mesh.getColorAt(0,color);close(color,new THREE.Color(1,1,1));
 factory.view.camera=null;buildings.set(2,root(3,[.5,.6,.7]));factory.rebuild(buildings);assert.equal(factory.instanceBatches[0].near.count,2);factory.instanceBatches[0].near.getColorAt(1,color);close(color,new THREE.Color(.5,.6,.7));
});
test('naturally grown row lots retain model choices, individual finishes and authored buffers after save reload',async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});
 const bytes=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url));lib.ingest((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 const w=E.createWorld('Finish persistence','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');E.buildRoadPath(w,[{x:19,y:24},{x:38,y:24}]);E.fineZoneCells(w,[...E.fineZoningLayout(w).values()].filter(c=>c.row<4).map(c=>c.id),'residential_row');for(let i=0;i<140;i++)E.tick(w);
 const storage={data:null,getItem(){return this.data;},setItem(k,v){this.data=v;}},store=new E.WorldStore(storage);store.save(w,1234);const restored=new E.WorldStore(storage).get(w.id),before=JSON.stringify(w),finishes=new Set();
 const describe=root=>{const all=[];root.traverse(m=>{if(m.userData.instanceColor){finishes.add(m.userData.instanceColor.toArray().join(','));all.push([m.material.name,m.userData.instanceColor.toArray()]);}});return {model:root.userData.model,all};};
 for(const p of Object.values(w.development.parcels)){if(!p.occupant||p.occupant.construction)continue;const a=B.renderParcel(w,p.id),b=B.renderParcel(restored,p.id);assert.deepEqual(describe(lib.create(w,a.index,a)),describe(lib.create(restored,b.index,b)));}assert.ok(finishes.size>10);assert.equal(JSON.stringify(w),before);
 const brick=lib.models.filter(m=>m.houseForm==='terrace').flatMap(m=>m.root.children).find(m=>m.material.name==='modern-brick');assert.ok(brick.material.userData.residentialBrick);
 const apartment=lib.models.find(m=>m.category==='residential');assert.ok(apartment.root.children.every(m=>!m.material.userData.residentialBrick),'apartment materials do not inherit row-house treatment');
});
