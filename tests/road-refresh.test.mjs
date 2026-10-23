import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {CityView} from '../dist/renderer.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {lotPlan} from '../dist/building-plan.js';
import {visualParcels} from '../dist/parcels.js';
import {changedRoadCells,frontageTouches} from '../dist/road-frontage.js';
globalThis.CityEngine=E;
const index=(x,y)=>y*48+x;
function world(){const w=E.createWorld('Frontage refresh','plains',431);for(const t of w.tiles)Object.assign(t,{type:null,level:0,tree:false,zone:null,ground:'land'});w.roadPaths=[];return w;}
function home(w,x,y){const i=index(x,y);Object.assign(w.tiles[i],{type:'residential',density:'low',building:'cottage',level:1,people:4});return i;}
function road(w,x,y){Object.assign(w.tiles[index(x,y)],{type:'road',roadType:'street',roadWidth:1});}
function view(w){const v=Object.create(CityView.prototype),calls={access:0,roads:0,traffic:0,batches:0};Object.assign(v,{world:w,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(45,1,.1,500),buildings:new Map(),tileGroup:new THREE.Group(),landscape:{assets:{},material:()=>new THREE.MeshStandardMaterial(),refreshTrees(){},refreshDevelopment(){}},streetLife:{build(){}},roadworks:{buildAccess(){calls.access++;},build(){calls.roads++;}},setupCars(){calls.traffic++;},updateOverlay(){},updateZones(){},overlay:'none',night:false,architecture:{construction(){return new THREE.Group();},model(){return new THREE.Group();}}});v.camera.position.set(0,60,80);v.models=new BuildingFactory(v);v.renderer={shadowMap:{}};const rebuild=v.models.rebuild.bind(v.models);v.models.rebuild=(...args)=>{calls.batches++;return rebuild(...args);};v.calls=calls;v.refresh(true);return v;}
function roots(v){return new Map(v.buildings);}
function assertRetained(v,before){for(const [id,g]of before)assert.equal(v.buildings.get(id),g);}

test('distant road edits retain building roots and batches but update access, roads and traffic',()=>{
 const w=world();home(w,10,10);home(w,30,30);road(w,10,7);road(w,30,27);const v=view(w),before=roots(v),batches=v.calls.batches;
 for(const type of ['road',null,'road']){w.tiles[index(44,44)].type=type;v.refresh();assertRetained(v,before);assert.equal(v.calls.batches,batches);}
 assert.equal(v.calls.access,4);assert.equal(v.calls.roads,4);assert.equal(v.calls.traffic,4);
});

test('nearby road additions and removals update frontage while distant homes retain their geometry',()=>{
 const w=world(),near=home(w,10,10),far=home(w,30,30);road(w,10,7);road(w,30,27);const v=view(w),farRoot=v.buildings.get(far),north=v.buildings.get(near);
 road(w,11,10);v.refresh();assert.notEqual(v.buildings.get(near),north);assert.equal(v.buildings.get(near).userData.plan.angle,Math.PI/2);assert.equal(v.buildings.get(far),farRoot);
 const east=v.buildings.get(near);w.tiles[index(11,10)].type=null;v.refresh();assert.notEqual(v.buildings.get(near),east);assert.deepEqual(v.buildings.get(near).userData.plan,lotPlan(w,near));assert.equal(v.buildings.get(far),farRoot);
});

test('the full width and depth of merged lots participate in frontage invalidation',()=>{
 const w=world(),owner=index(12,12);for(let y=12;y<14;y++)for(let x=12;x<15;x++)Object.assign(w.tiles[index(x,y)],{type:'office',density:'high',level:1});
 const v=view(w),parcel=visualParcels(w).get(owner);assert.equal(parcel.width,3);assert.equal(parcel.depth,2);
 const initial=v.buildings.get(owner);road(w,18,12);v.refresh();assert.notEqual(v.buildings.get(owner),initial);assert.equal(v.buildings.get(owner).userData.plan.frontage.roadIndex,index(18,12));
 const changed=changedRoadCells(w.tiles,[]).changed;assert.equal(frontageTouches(changed,owner,parcel),true);assert.equal(frontageTouches(changed,owner,null),false);
});

test('curved road creation and deletion regenerate the nearby building with the exact new plan',()=>{
 const w=world(),id=home(w,14,22),far=home(w,42,42);w.money=1e7;const v=view(w),farRoot=v.buildings.get(far),initial=v.buildings.get(id);
 const result=E.buildRoadPath(w,[{x:10,y:25},{x:20,y:5},{x:30,y:25}],'street');assert.ok(result.ok);v.refresh();assert.notEqual(v.buildings.get(id),initial);assert.deepEqual(v.buildings.get(id).userData.plan,lotPlan(w,id));assert.equal(v.buildings.get(id).userData.plan.frontage.pathId,result.path.id);assert.equal(v.buildings.get(far),farRoot);
 E.removeRoadPath(w,result.path.id);v.refresh();assert.equal(v.buildings.get(id).userData.plan.frontage,null);assert.equal(v.buildings.get(far),farRoot);
});

test('independent occupied lots keep their saved frames when their street disappears and still update when rebuilt',()=>{
 const w=world();for(let x=8;x<30;x++)road(w,x,10);const grid=F.grid(w,E.ROADS),state=w.development=F.create();F.paint(state,grid,[...grid.keys()],'residential_low');
 for(const p of grid.values())if(p.row===0)F.reserve(state,grid,p.id,3,3);
 for(const p of Object.values(state.parcels))p.occupant={type:'residential',building:'cottage',density:'low',level:1,people:4,variant:0};
 const v=view(w),before=roots(v),saved=JSON.stringify(state),batchCount=v.calls.batches;assert.ok(before.size>3);
 for(let x=8;x<30;x++)w.tiles[index(x,10)].type=null;v.refresh();assertRetained(v,before);assert.equal(v.calls.batches,batchCount);assert.equal(v.calls.traffic,2);assert.equal(v.calls.access,2);assert.equal(JSON.stringify(state),saved);
 const [a,b]=Object.values(state.parcels);a.frame.angle+=.1;v.refresh();assert.notEqual(v.buildings.get(a.id),before.get(a.id));assert.equal(v.buildings.get(b.id),before.get(b.id));
 const changed=v.buildings.get(a.id);a.occupant.level++;v.refresh();assert.notEqual(v.buildings.get(a.id),changed);assert.equal(v.buildings.get(b.id),before.get(b.id));
 F.release(state,a.id);v.refresh();assert.equal(v.buildings.has(a.id),false);assert.equal(v.buildings.get(b.id),before.get(b.id));
 const final=roots(v);v.refresh(true);for(const [id,g]of final)assert.notEqual(v.buildings.get(id),g);
});

test('nearby road upgrades, service buildings and construction retain their existing refresh behavior',()=>{
 const w=world(),service=index(10,10),building=home(w,32,32);Object.assign(w.tiles[service],{type:'park',level:1});road(w,10,7);const v=view(w),before=roots(v);
 w.tiles[index(10,7)].roadWidth=2;v.refresh();assert.notEqual(v.buildings.get(service),before.get(service));assert.equal(v.buildings.get(building),before.get(building));
 w.tiles[building].construction=5;v.refresh();assert.notEqual(v.buildings.get(building),before.get(building));const construction=v.buildings.get(building);delete w.tiles[building].construction;v.refresh();assert.notEqual(v.buildings.get(building),construction);
 const day=roots(v);v.night=true;v.refresh();for(const [id,g]of day)assert.notEqual(v.buildings.get(id),g);
});
