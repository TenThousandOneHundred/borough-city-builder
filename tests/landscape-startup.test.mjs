import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {CityView} from '../dist/renderer.js';
import {Vegetation} from '../dist/vegetation.js';
import {ScannedRocks} from '../dist/scanned-rocks.js';
globalThis.CityEngine=E;

// Exercise the production landscape lifecycle and all scenery generators with
// smaller terrain tessellation. Terrain generation itself has separate tests.
const landscapeURL=new URL('../dist/landscape.js',import.meta.url);
let source=await readFile(landscapeURL,'utf8');
assert.match(source,/import \{terrainMeshes\} from '[^']+';/);
source=source.replace(/import \{terrainMeshes\} from '[^']+';/,`function terrainMeshes(world,height,color){
 const make=(extent,segments)=>{const g=new THREE.PlaneGeometry(extent,extent,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(world,x,z));colors.push(...color(world,x,z).toArray());}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;};
 return {ground:make(192,12),far:make(1100,10),cacheHit:false};
}`);
source=source.replace('import {groundCover}', 'import {groundCover as buildGroundCover}');
source+='\nfunction groundCover(view,...args){view.counts.cover++;return buildGroundCover(view,...args);}\n';
source=source.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,landscapeURL).href}'`)
 .replace(/import '(\.\/[^']+)'/g,(_,path)=>`import '${new URL(path,landscapeURL).href}'`);
const {Landscape,groundHeight}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function world(seed=23){const w=E.createWorld('Startup scenery','river',seed);for(const t of w.tiles)if(t.type==='road')Object.assign(t,{type:null,roadType:undefined,roadWidth:undefined,pathIds:undefined});w.roadPaths=[];return w;}
function support(fallback=false){return {
 stats:{fallback},sample(x,z){return !fallback&&Math.abs(x)<8&&Math.abs(z)<8?2.5:null;},excluded(x,z){return !fallback&&Math.abs(x)<1&&Math.abs(z)<1;},
 applyToGeometry(g){const replacement=!fallback?new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-2,2.5,-2,2,2.5,-2,0,2.5,2],3)):null;return {indices:g.index.array.slice(),replacement,walls:null};}
};}
function harness({plan=null,loaded=false}={}){
 const v=Object.create(CityView.prototype),counts={trees:0,rocks:0,cover:0,grid:0,roads:0,cars:0},materials=new Map();
 Object.assign(v,{counts,scene:new THREE.Scene(),materials,unitBox:new THREE.BoxGeometry(),camera:new THREE.PerspectiveCamera(45,1,.1,200),controls:{target:new THREE.Vector3(),update(){}},night:false,overlay:'none',assetsReady:false,detailEnabled:true,buildings:new Map(),tileGroup:new THREE.Group(),carGroup:new THREE.Group(),grid:new THREE.Group(),cars:[],vehicles:{fleet:[]},renderer:{shadowMap:{}},models:{accepts:()=>false,rebuild(){},materials:{reset(){}}},architecture:{cache:new Map()},streetLife:{build(){}},clearRoadZoning(){},updateZones(){},updateOverlay(){},drawFootpaths(){},ensureCarCapacity(){},setupCars(){counts.cars++;},loadingElement:{hidden:false}});
 v.camera.position.set(0,15,20);v.mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);};
 v.roadworks={plan,build(){counts.roads++;this.earthworks=this.plan;},syncSignals(){},syncEarthworks(){},buildAccess(){},surfaceHeight(){return 2.7;}};
 const land=Object.create(Landscape.prototype);Object.assign(land,{view:v,group:new THREE.Group(),assets:{},scannedRocks:{populate:()=>false},leafMat:new THREE.MeshStandardMaterial({color:'#7b925b'})});v.landscape=land;v.scene.add(land.group);
 v.vegetation={populate:()=>null};
 if(loaded){
  const tree=new THREE.Group();tree.add(new THREE.Mesh(new THREE.ConeGeometry(.3,1,5),v.mat('#718653')));
  v.vegetation=Object.assign(Object.create(Vegetation.prototype),{v,impostors:[{material:v.mat('#87945d')}],broadleaf:[],prototypes:[tree]});
  land.scannedRocks=Object.assign(Object.create(ScannedRocks.prototype),{parts:[{geometry:new THREE.IcosahedronGeometry(1),material:v.mat('#899080')}]});
 }
 for(const [method,key]of [['makeTrees','trees'],['makeRocks','rocks']]){const original=land[method];land[method]=function(...args){counts[key]++;return original.apply(this,args);};}
 v.makeGrid=function(){counts.grid++;return CityView.prototype.makeGrid.call(this);};
 v.cleanup=()=>{land.clear();for(const group of [v.grid,v.tileGroup])group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});land.leafMat.dispose();for(const m of materials.values())m.dispose();v.unitBox.dispose();};
 return v;
}
function digest(land){const hash=createHash('sha256'),add=value=>hash.update(JSON.stringify(value));land.group.updateMatrixWorld(true);land.group.traverse(o=>{
 add([o.type,o.children.length,o.matrixWorld.elements,o.castShadow,o.receiveShadow,o.count??null]);
 for(const [name,a]of Object.entries(o.geometry?.attributes||{})){add([name,a.itemSize,a.normalized]);hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
 for(const a of [o.geometry?.index,o.instanceMatrix,o.instanceColor])if(a)hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 if(o.geometry)add(o.geometry.drawRange);
 for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])add([m.type,m.color?.toArray(),m.roughness,m.side,m.transparent,m.opacity,m.depthWrite]);
 });add(land.cover?.userData.clumps);return hash.digest('hex');}
function order(land){return land.group.children.map(o=>o===land.ground?'ground':o===land.surroundings?'far':o===land.water?'water':o===land.rockGroup?'rocks':o===land.cover?'cover':land.earthworkMeshes?.includes(o)?'earthworks':'tree');}
function assertOnce(v){assert.equal(v.counts.trees,1);assert.equal(v.counts.rocks,1);assert.equal(v.counts.cover,1);assert.equal(v.landscape.developmentPending,false);}

test('default landscape build remains complete; deferred no-road build produces exactly the same scenery',()=>{
 const w=world(),before=JSON.stringify(w),ordinary=harness(),deferred=harness();try{
  ordinary.landscape.build(w);assertOnce(ordinary);assert.equal(ordinary.landscape.ensureDevelopment(w),false);
  deferred.landscape.build(w,{deferDevelopment:true});assert.deepEqual([deferred.counts.trees,deferred.counts.rocks,deferred.counts.cover],[0,0,0]);
  assert.equal(deferred.landscape.ensureDevelopment({...w}),false,'another world cannot finish pending scenery');
  assert.equal(deferred.landscape.ensureDevelopment(w),true);assertOnce(deferred);assert.equal(digest(deferred.landscape),digest(ordinary.landscape));assert.deepEqual(order(deferred.landscape),order(ordinary.landscape));assert.equal(JSON.stringify(w),before);
 }finally{ordinary.cleanup();deferred.cleanup();}
});

for(const loaded of [false,true])test(`setWorld constructs final scenery and grid once with ${loaded?'loaded models':'fallback models'}`,()=>{
 const w=world(),before=JSON.stringify(w),v=harness({plan:support(),loaded}),ordinary=harness({loaded});try{
  ordinary.world=w;ordinary.landscape.build(w);ordinary.focusWorld(false);ordinary.landscape.applyRoadEarthworks(w,support());
  v.setWorld(w);assertOnce(v);assert.equal(v.counts.grid,1);assert.equal(v.counts.roads,1);assert.equal(v.gridPending,false);
  assert.equal(digest(v.landscape),digest(ordinary.landscape),'all geometry, transforms, colors, cover clumps and mesh ordering match the eager final scene');assert.deepEqual(order(v.landscape),order(ordinary.landscape));
  const p=v.grid.children[0].geometry.attributes.position;let changed=0;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-v.renderFloor(w,p.getX(i),p.getZ(i))-.15)<1e-5);if(Math.abs(p.getX(i))<8&&Math.abs(p.getZ(i))<8)changed++;}assert.ok(changed>0);
  const counts={...v.counts};v.refresh();assert.deepEqual(v.counts,counts);assert.equal(JSON.stringify(w),before);
 }finally{v.cleanup();ordinary.cleanup();}
});

test('no-road startup and world switches finish scenery without a support plan and replace the grid once',()=>{
 const a=world(),b=world(31),v=harness({plan:support()});try{
  v.setWorld(a);const old=[...v.landscape.group.children],oldGrid=v.grid.children[0];v.roadworks.plan=null;for(const key of Object.keys(v.counts))v.counts[key]=0;
  v.setWorld(b,{reset:false});assertOnce(v);assert.equal(v.counts.grid,1);assert.equal(v.landscape.earthworks,null);assert.equal(v.landscape.world,b);assert.equal(v.world,b);assert.ok(old.every(o=>o.parent===null));assert.equal(oldGrid.parent,null);
  const p=v.grid.children[0].geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-Math.max(.2,groundHeight(b,p.getX(i),p.getZ(i)))-.15)<1e-5);
  const last=order(v.landscape);assert.equal(last.at(-1),'cover');assert.equal(last.at(-2),'rocks');
 }finally{v.cleanup();}
});

test('a fallback support plan still completes the same natural scenery exactly once',()=>{
 const w=world(),v=harness({plan:support(true)}),ordinary=harness();try{
  ordinary.world=w;ordinary.landscape.build(w);ordinary.landscape.applyRoadEarthworks(w,support(true));
  v.setWorld(w);assertOnce(v);assert.equal(v.counts.grid,1);assert.equal(v.landscape.earthworks.stats.fallback,true);assert.equal(digest(v.landscape),digest(ordinary.landscape));
 }finally{v.cleanup();ordinary.cleanup();}
});

for(const hasRoads of [false,true])test(`late assets finish scenery once ${hasRoads?'with':'without'} road support while retaining running agents and elapsed time`,()=>{
 const w=world(),v=harness({plan:hasRoads?support():null});try{
  v.setWorld(w);const traffic={agents:[{active:true,x:4,z:5}]},transit={entries:new Map([[1,{agent:{x:9,z:7}}]])},residents={reconcile(){},state:{residents:[{id:1,activity:'Walking',walk:{x:3,z:2}}]}},clock={pending:1.25,total:52};
  Object.assign(v,{traffic,transit,residents,simulationClock:clock,_running:true});const before=JSON.stringify(w),beforeAgents=JSON.stringify([traffic.agents,[...transit.entries],residents.state,clock]),grid=v.grid.children[0];for(const key of Object.keys(v.counts))v.counts[key]=0;
  v.refreshAssets();assertOnce(v);assert.equal(v.counts.grid,hasRoads?1:0);assert.equal(v.counts.roads,1);assert.equal(v.counts.cars,0);assert.equal(v.assetsReady,true);assert.equal(v.loadingElement.hidden,true);
  if(!hasRoads)assert.equal(v.grid.children[0],grid);
  assert.equal(v.traffic,traffic);assert.equal(v.transit,transit);assert.equal(v.residents,residents);assert.equal(v.simulationClock,clock);assert.equal(v.running,true);assert.equal(JSON.stringify(w),before);assert.equal(JSON.stringify([traffic.agents,[...transit.entries],residents.state,clock]),beforeAgents);
 }finally{v.cleanup();}
});
