import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {streetStations,atDistance} from '../dist/street-geometry.js';
import {planBridges,bridgeHeight,bridgeElevation} from '../dist/bridge-spans.js';
import {bridgeGeometry} from '../dist/bridge-geometry.js';
import {CityView} from '../dist/renderer.js';
import {Roadworks} from '../dist/roadworks.js';
import E from '../dist/engine.js';
globalThis.CityEngine=E;
const road=(id,points,width=2.45)=>({id,spec:{width,sidewalk:true},stations:streetStations(points)});
const straight=()=>road('main',[{x:0,z:0},{x:30,z:0}]);
const water=x=>x>8&&x<22;
const ray=(mesh,x,y,z,dy=-1)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,dy,0)).intersectObject(mesh)[0];
function view(){const materials=new Map();return {scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false,mat(c){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c}));return materials.get(c);},box(g,x,y,z,w,h,d,c){const m=new THREE.Mesh(this.unitBox,this.mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;},landscape:{assets:{},material:()=>new THREE.MeshStandardMaterial()}};}

test('bridge planning joins reversed street extensions and leaves roads and dry ground untouched',()=>{
 const full=[straight()],pieces=[road('a',[{x:0,z:0},{x:10,z:0}]),road('b',[{x:20,z:0},{x:10,z:0}]),road('c',[{x:20,z:0},{x:30,z:0}])],saved=JSON.stringify(pieces),a=planBridges(full,water,()=>.8),b=planBridges(pieces,water,()=>.8);
 assert.equal(a.spans.length,1);assert.equal(b.spans.length,1);assert.equal(b.spans[0].roads.length,3);assert.equal(JSON.stringify(pieces),saved);assert.equal(planBridges(full,()=>false,()=>.8).spans.length,0);
 for(let x=6;x<24;x+=.17)assert.ok(Math.abs(bridgeHeight(a,x,0)-bridgeHeight(b,x,0))<.0002);
 assert.equal(bridgeHeight(a,2,0),null);assert.equal(bridgeHeight(a,15,4),null);assert.ok(Math.abs(bridgeHeight(a,15,0)-1.9)<.0001);
});

test('curved crossings have continuous height coverage across the pavement and both railings',()=>{
 const r=road('bend',Array.from({length:301},(_,i)=>({x:i/10,z:Math.sin(i/30)*2})),3.5),plan=planBridges([r],water,()=>.8),span=plan.spans[0];
 for(const p of span.points)for(const offset of [-2.2,-1,0,1,2.2]){const h=bridgeHeight(plan,p.x+p.nx*offset,p.z+p.nz*offset);assert.notEqual(h,null,'curve offsets must not fall through gaps between height segments');assert.ok(Math.abs(h-bridgeElevation(span,p.distance))<.025);}
 for(let d=span.start+.01;d<span.end;d+=.05){const a=atDistance(span.points,d),b=atDistance(span.points,d+.01),ha=bridgeHeight(plan,a.x,a.z),hb=bridgeHeight(plan,b.x,b.z);assert.ok(Math.abs(ha-hb)<.02,'the approach and bridge grade have no height steps');}
});

test('bridge decks have upward tops, downward soffits, open lanes and supporting piers',()=>{
 const plan=planBridges([straight()],water,()=>.8),height=(x,z)=>bridgeHeight(plan,x,z)??.8,{geometries,piers}=bridgeGeometry(plan,height,()=>-1.6),mesh=new THREE.Mesh(geometries.concrete,new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
 assert.ok(piers>=1);for(const g of Object.values(geometries)){assert.ok([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));assert.ok(g.attributes.position.count/3<6500);}
 for(const x of [9.2,13.1,17.3,20.1]){const top=ray(mesh,x,10,0);assert.ok(top);assert.ok(Math.abs(top.point.y-height(x,0)-.06)<.003);assert.ok(top.face.normal.y>.9);const bottom=ray(mesh,x,-5,0,1);assert.ok(bottom);assert.ok(bottom.face.normal.y<-.9);assert.ok(top.point.y-bottom.point.y>=.36);}
 const rail=new THREE.Mesh(geometries.metal,new THREE.MeshBasicMaterial());rail.updateMatrixWorld();assert.equal(ray(rail,15,10,0),undefined,'railings do not cross a driving lane');assert.ok(ray(rail,15,10,2.45/2+.42-.065),'top rails follow the outside edge');
});

test('bridge railings stop outside junction mouths and road-width transitions remain covered',()=>{
 const r=straight();r.widthAt=p=>2.45+p.distance/30;const plan=planBridges([r],water,()=>1.8),height=(x,z)=>bridgeHeight(plan,x,z)??1.8,junction={x:15,z:0,radius:3},parts=bridgeGeometry(plan,height,()=>-1.6,[junction]);
 const metal=parts.geometries.metal.attributes.position;for(let i=0;i<metal.count;i++)assert.ok(Math.hypot(metal.getX(i)-15,metal.getZ(i))>=3.1);
 const concrete=new THREE.Mesh(parts.geometries.concrete,new THREE.MeshBasicMaterial());concrete.updateMatrixWorld();for(const x of [7,10,20,23]){const half=(2.45+x/30)/2;assert.ok(ray(concrete,x,10,half-.04));assert.ok(ray(concrete,x,10,-half+.04));}
});

test('road rebuilds derive bridges for every road style without editing saved worlds and remove obsolete structures',()=>{
 for(const type of Object.keys(E.ROADS)){
  const w=E.createWorld('Bridge QA','river',431);for(const t of w.tiles)Object.assign(t,{type:null,level:0});w.money=1e6;const result=E.buildRoadPath(w,[{x:20,y:24},{x:32,y:18},{x:44,y:24}],type);assert.ok(result.ok);
  const saved=JSON.stringify(w),v=view(),r=new Roadworks(v);r.outside=()=>{};r.build(w);assert.equal(JSON.stringify(w),saved);assert.ok(r.bridgeStats.spans>=1);assert.ok(r.bridgeStats.piers>=1);assert.ok(r.bridgeStats.triangles<12000);assert.ok(r.batchStats.after<=r.batchStats.before);
  const restored=new Roadworks(view());restored.outside=()=>{};restored.build(JSON.parse(saved));assert.deepEqual(restored.bridgePlan.spans,r.bridgePlan.spans,'restored cities derive identical bridge geometry');
  const span=r.bridgePlan.spans[0],point=span.points[Math.floor(span.points.length/2)],h=r.height(w,point.x,point.z);assert.ok(h>1.6);const car={agent:{active:true,x:point.x,z:point.z,heading:0},mesh:new THREE.Object3D()},city={world:w,roadworks:r,running:false};CityView.prototype.moveCar.call(city,car);assert.ok(Math.abs(car.mesh.position.y-h-.08)<1e-8);
  E.removeRoadPath(w,result.path.id);r.build(w);assert.equal(r.bridgeStats.spans,0);assert.equal(r.bridgeStats.triangles,0);CityView.prototype.moveCar.call(city,car);assert.equal(car.heightRevision,r.heightRevision);assert.ok(Math.abs(car.mesh.position.y-r.baseHeight(w,point.x,point.z)-.08)<1e-8,'a stationary vehicle cannot retain the demolished bridge height');
 }
});


test('bridge height stops at each shore endpoint rather than leaking from adjacent search segments',()=>{
 const plan=planBridges([straight()],water,()=>.8),s=plan.spans[0];
 for(const offset of [0,.8,-.8,1.5])for(const d of [.01,.1,.5,1,2]){assert.equal(bridgeHeight(plan,s.start-d,offset),null);assert.equal(bridgeHeight(plan,s.end+d,offset),null);}
 assert.ok(Math.abs(bridgeHeight(plan,s.start,0)-.8)<1e-8);assert.ok(Math.abs(bridgeHeight(plan,s.end,0)-.8)<1e-8);
});
