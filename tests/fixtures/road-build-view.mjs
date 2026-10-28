import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../../dist/vendor/three.module.js';
import E from '../../dist/engine.js';
import {CityView} from '../../dist/renderer.js';
import {Landscape,groundHeight,terrainColor} from '../../dist/landscape.js';
import {Roadworks} from '../../dist/roadworks.js';
globalThis.CityEngine=E;
export function world(){const w=E.createWorld('Earthworks lifecycle','plains',431);for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});w.roadPaths=[];w.money=1e8;assert.ok(E.buildRoadPath(w,[{x:20,y:24},{x:28,y:24}],'street').ok);return w;}
function grid(w){
 const g=new THREE.PlaneGeometry(48,48,48,48);g.rotateX(-Math.PI/2);const p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,groundHeight(w,x,z));const color=terrainColor(w,x,z);c.set([color.r,color.g,color.b],i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeVertexNormals();return g;
}
export function harness(w,{raised=false}={}){
 const v=Object.create(CityView.prototype),materials=new Map();Object.assign(v,{world:w,scene:new THREE.Scene(),materials,unitBox:new THREE.BoxGeometry(),camera:new THREE.PerspectiveCamera(45,1,.1,200),night:false,overlay:'none',assetsReady:false,detailEnabled:true,buildings:new Map(),tileGroup:new THREE.Group(),renderer:{shadowMap:{}},sun:{intensity:3},ambient:{intensity:.5},models:{accepts:()=>false,rebuild(){}},streetLife:{build(){}},cars:[],grid:new THREE.Group()});
 v.scene.fog=new THREE.Fog('#ffffff',100,200);v.camera.position.set(0,15,20);
 v.mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);};
 v.setupCars=()=>{};v.updateZones=()=>{};v.updateOverlay=()=>{};v.makeGrid=()=>{};v.drawFootpaths=()=>{};
 const land=Object.create(Landscape.prototype);Object.assign(land,{view:v,world:w,group:new THREE.Group(),assets:{}});v.scene.add(land.group);
 land.ground=new THREE.Mesh(grid(w),new THREE.MeshStandardMaterial({vertexColors:true}));land.group.add(land.ground);land.baseColors=land.ground.geometry.attributes.color.array.slice();land.terrainBases=[{mesh:land.ground,indices:land.ground.geometry.index.array.slice(),drawRange:{...land.ground.geometry.drawRange}}];
 land.refreshDevelopment=()=>{};land.refreshTrees=()=>{};land.refreshCover=()=>{};v.landscape=land;
 const roads=new Roadworks(v);v.roadworks=roads;
 // A modest, controlled fill reaches an adjacent parcel and creates retaining
 // faces once its shoulder is constrained. Grade generation has separate tests.
 if(raised)roads.height=(world,x,z)=>roads.baseHeight(world,x,z)+.04;
 v.cleanup=()=>{land.clear();roads.clear();roads.accessGroup?.traverse(o=>o.geometry?.dispose());roads.lampMaterial.dispose();roads.walkMaterial.dispose();roads.lightPoolMaterial.dispose();for(const mat of materials.values())mat.dispose();v.unitBox.dispose();};
 return v;
}
export function digest(land){const h=createHash('sha256');for(const mesh of [land.ground,...land.earthworkMeshes||[]]){const g=mesh.geometry;for(const name of Object.keys(g.attributes).sort()){const a=g.attributes[name].array;h.update(name);h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}if(g.index){const a=g.index.array;h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}h.update(String(g.drawRange.start)+':'+g.drawRange.count);}return h.digest('hex');}

