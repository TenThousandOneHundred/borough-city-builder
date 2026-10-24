// Compare actual shipped building/tree preparation with a frozen release.
// GIT_BIN=/path/to/git node scripts/benchmark-detail-bounds.mjs [baseline-ref]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {visualParcels} from '../dist/parcels.js';
import {trafficCity} from '../tests/traffic-city-fixture.mjs';
const baseline=process.argv[2]||'b55a24d',base=new URL('../dist/',import.meta.url).href;
const oldSource=execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/building-factory.js'],{encoding:'utf8'}).replaceAll("from './","from '"+base);
const {BuildingFactory:Previous}=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
const loader=new GLTFLoader();loader.register(()=>({name:'benchmark-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const parse=async path=>{const bytes=fs.readFileSync(new URL('../dist/assets/'+path,import.meta.url));return(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
const tree=await parse('trees/broadleaf.glb'),prototype=new THREE.Group();prototype.add(tree);tree.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(tree),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());tree.position.set(-center.x,-bounds.min.y,-center.z);prototype.scale.setScalar(1/size.y);tree.traverse(o=>{if(o.isMesh)o.userData.sharedAsset=true;});
const view={renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new THREE.MeshStandardMaterial()},vegetation:{broadPrototype:prototype,broadleaf:[{material:new THREE.MeshStandardMaterial()}]}};
const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{view,models:[],materials:new Set(),lotGeometry:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)});for(const file of ['urban','industry','modern'])lib.ingest(await parse('buildings/'+file+'.glb'));
const data=fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url));lib.ingestLod(JSON.parse(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
const {world}=trafficCity(),saved=JSON.stringify(world),parcels=visualParcels(world),buildings=new Map();for(let i=0;i<world.tiles.length;i++){const t=world.tiles[i],p=parcels.get(i);if(!t.level||!lib.models.some(a=>a.category===t.type)||p&&p.owner!==i)continue;buildings.set(i,lib.create(world,i,p));}
const make=C=>{const camera=new THREE.PerspectiveCamera(55,1,.1,500);camera.position.set(-20,30,40);camera.lookAt(0,0,0);return new C({scene:new THREE.Scene(),camera,detailEnabled:true,reflectionsEnabled:true});};
const snapshot=f=>f.instanceBatches.map(b=>({geometry:b.near.geometry.uuid,material:b.near.material.uuid,transforms:b.transforms.map(t=>({matrix:t.matrix.elements,sphere:t.sphere,detailBounds:t.detailBounds,range:t.renderRange,origin:t.rangeOrigin})),near:[b.near.count,...b.near.instanceMatrix.array.slice(0,b.near.count*16)],far:b.far&&[b.far.count,...b.far.instanceMatrix.array.slice(0,b.far.count*16)],shadow:[b.shadow.userData.casterCount,...b.shadow.instanceMatrix.array.slice(0,b.shadow.userData.casterCount*16)]}));
const timings={before:[],after:[]},median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];let instances=0;
for(let trial=0;trial<9;trial++){const pair={before:make(Previous),after:make(BuildingFactory)};for(const name of trial%2?['after','before']:['before','after']){const start=performance.now();pair[name].rebuild(buildings);const elapsed=performance.now()-start;if(trial>1)timings[name].push(elapsed);}
 assert.deepEqual(snapshot(pair.after),snapshot(pair.before),'all geometry, material identities, bounds, visible transforms and shadows match');instances=pair.after.instanceBatches.reduce((n,b)=>n+b.transforms.length,0);for(const f of Object.values(pair))f.rebuild(new Map());
}
assert.equal(JSON.stringify(world),saved);
console.log(JSON.stringify({baseline,scope:'Initial CPU preparation of shipped buildings and garden trees; not rendering FPS or network loading',buildings:buildings.size,instances,trials:7,beforeMedianMs:median(timings.before),afterMedianMs:median(timings.after),samples:timings,identicalGeometryMaterialsBoundsAndTransforms:true,worldUnchanged:true},null,2));
