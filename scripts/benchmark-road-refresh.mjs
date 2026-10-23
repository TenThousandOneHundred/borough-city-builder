// Model/renderer CPU work after a road edit. Network, GPU and traffic graph work
// are excluded; actual shipped building geometry is used without decoding images.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {CityView} from '../dist/renderer.js';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
const baseline=process.argv[2]||'e9c129e',base=new URL('../dist/',import.meta.url).href;
const source=execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/renderer.js'],{encoding:'utf8'}).replaceAll("'./","'"+base);
const {CityView:OldView}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.CityEngine=E;
const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1),view:{renderer:{capabilities:{getMaxAnisotropy:()=>4}},landscape:{material:()=>new THREE.MeshStandardMaterial()}}});lib.lotGeometry.rotateX(-Math.PI/2);
for(const file of ['urban','industry','modern']){const bytes=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene);}
function world(kind){const w=E.createWorld('Road edit benchmark','plains',431);for(const t of w.tiles)Object.assign(t,{type:null,level:0,tree:false});
 for(let y=8;y<=38;y+=6)for(let x=8;x<=38;x++)Object.assign(w.tiles[y*48+x],{type:'road',roadType:'street',roadWidth:1});
 if(kind==='legacy')for(let y=9;y<=39;y+=6)for(let x=9;x<38;x+=2)Object.assign(w.tiles[y*48+x],{type:'residential',density:'low',building:'cottage',level:1,people:4});
 else{const grid=F.grid(w,E.ROADS),state=w.development=F.create();F.paint(state,grid,[...grid.keys()],'residential_low');for(const p of grid.values())if(p.row===0)F.reserve(state,grid,p.id,3,3);for(const p of Object.values(state.parcels))p.occupant={type:'residential',building:'cottage',density:'low',level:1,people:4,variant:0};}
 return w;
}
function view(View,w){const v=Object.create(View.prototype);Object.assign(v,{world:w,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(45,1,.1,500),buildings:new Map(),tileGroup:new THREE.Group(),landscape:{assets:{},refreshTrees(){},refreshDevelopment(){}},streetLife:{build(){}},roadworks:{buildAccess(){},build(){}},setupCars(){},updateOverlay(){},updateZones(){},overlay:'none',night:false});v.camera.position.set(0,60,80);v.camera.lookAt(0,0,0);v.models=new BuildingFactory(v);v.models.library=lib;v.renderer={shadowMap:{}};let made=0;const create=v.models.create.bind(v.models);v.models.create=(...args)=>{made++;return create(...args);};v.created=()=>made;v.refresh(true);return v;}
const geometryDigests=new WeakMap(),rootSnapshots=new WeakMap();
function geometryDigest(g){if(geometryDigests.has(g))return geometryDigests.get(g);const hash=createHash('sha256');for(const name of Object.keys(g.attributes).sort()){const a=g.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(g.index){const a=g.index.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}const digest=hash.digest('hex');geometryDigests.set(g,digest);return digest;}
function snapshot(root){if(rootSnapshots.has(root))return rootSnapshots.get(root);root.updateMatrixWorld(true);const result=[];root.traverse(o=>{if(o.isMesh)result.push({geometry:geometryDigest(o.geometry),material:o.material.uuid,matrix:o.matrixWorld.toArray(),visible:o.visible,castShadow:o.castShadow,receiveShadow:o.receiveShadow});});rootSnapshots.set(root,result);return result;}
const reports=[];
for(const kind of ['legacy','fine']){
 const a=world(kind),b=structuredClone(a),before=view(OldView,a),after=view(CityView,b),rows={before:[],after:[]},created={before:[],after:[]};
 for(let i=0;i<13;i++){
  const index=44*48+44,order=i%2?[['after',after],['before',before]]:[['before',before],['after',after]];
  for(const [name,v]of order){const t=v.world.tiles[index];t.type=i%2?null:'road';t.roadType='street';t.roadWidth=1;const count=v.created(),start=performance.now();v.refresh();if(i>2){rows[name].push(performance.now()-start);created[name].push(v.created()-count);}}
  assert.equal(before.buildings.size,after.buildings.size);
  for(const [id,root]of before.buildings){const other=after.buildings.get(id);assert.equal(root.userData.model,other.userData.model);assert.deepEqual(snapshot(root),snapshot(other));}
  assert.deepEqual(a,b,'optimization does not mutate simulation state');
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 reports.push({kind,buildings:before.buildings.size,before:{medianMs:median(rows.before),recreatedPerEdit:median(created.before)},after:{medianMs:median(rows.after),recreatedPerEdit:median(created.after)},sameModelsGeometryMaterialsAndTransforms:true,worldsEqual:true});
}
console.log(JSON.stringify({baseline,scope:'CPU building creation and refresh only, not complete frame time',reports},null,2));
