import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {lotPlan} from '../dist/building-plan.js';
import {BuildingFactory} from '../dist/building-factory.js';
import {Vehicles} from '../dist/vehicles.js';
const E=createRequire(import.meta.url)('../dist/engine.js');
function fixture(){const world=E.createWorld('Renderer test','flat',431);world.tiles.forEach(t=>Object.assign(t,{type:null,level:0,tree:false}));const view={scene:new THREE.Scene(),night:false,landscape:{assets:{},material:()=>new THREE.MeshStandardMaterial({color:'#829267'})}};return{world,factory:new BuildingFactory(view)};}
test('true-sized parcels rotate toward roads without scaling their geometry',()=>{
 const {world,factory}=fixture(),index=20*48+20;world.tiles[index]={type:'office',density:'high',level:2};world.tiles[index+3].type='road';
 const parcel={width:2,depth:3,members:[index]},p=lotPlan(world,index,parcel),g=factory.create(world,index,parcel);
 assert.equal(p.angle,Math.PI/2);assert.equal(p.lotWidth,12);assert.equal(p.lotDepth,8);assert.deepEqual(g.scale.toArray(),[1,1,1]);
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);assert.ok(bounds.max.x-bounds.min.x<=8.5);assert.ok(bounds.max.z-bounds.min.z<=12.5);
});
test('all replacement building categories produce finite geometry and preserve save data',()=>{
 const {world,factory}=fixture();
 for(const [type,density]of [['residential','low'],['residential','medium'],['residential','high'],['commercial','low'],['commercial','high'],['office','high'],['industrial','high']]){
  for(let k=0;k<6;k++){const index=10*48+10+k;world.tiles[index]={type,density,level:2,building:null};const before=JSON.stringify(world),g=factory.create(world,index,k%2?{width:2,depth:2}:null);assert.equal(JSON.stringify(world),before);assert.ok(g.children.length<=12);g.traverse(m=>{if(m.isMesh)for(const name of ['position','normal','uv'])assert.ok([...m.geometry.attributes[name].array].every(Number.isFinite));});}
 }
});
test('pitched roofs face upward and city material batching preserves bounds',()=>{
 const {world,factory}=fixture(),buildings=new Map();
 for(let k=0;k<12;k++){const index=12*48+10+k;world.tiles[index]={type:'residential',density:'low',level:1};const g=factory.create(world,index,null),roof=factory.materials.get('roof',g.userData.plan.tone);for(const mesh of g.children)if(mesh.material===roof){const normals=mesh.geometry.attributes.normal;for(let i=0;i<normals.count;i++)if(Math.abs(normals.getY(i))>.01&&Math.abs(normals.getY(i))<.99)assert.ok(normals.getY(i)>0,'pitched roof faces outward');}buildings.set(index,g);}
 factory.rebuild(buildings);assert.ok(factory.batchRoot.children.length<50);const aggregate=new THREE.Box3();for(const g of buildings.values())aggregate.union(new THREE.Box3().setFromObject(g));const batched=new THREE.Box3().setFromObject(factory.batchRoot);assert.ok(aggregate.min.distanceTo(batched.min)<.001);assert.ok(aggregate.max.distanceTo(batched.max)<.001);
});
test('rebuilt vehicles fit their lanes and have finite visible surfaces',()=>{
 const cars=new Vehicles();for(let i=0;i<9;i++){const car=cars.create(i),b=new THREE.Box3().setFromObject(car);assert.ok(b.max.x-b.min.x<.6);assert.ok(b.max.z-b.min.z<1.2);assert.ok(b.max.y<.5);car.traverse(o=>{if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite))});}
});

test('authored diagonal frontage aligns facades and keeps rotated envelopes inside their parcels',()=>{
 const {world,factory}=fixture();world.money=100000;
 assert.ok(E.buildRoadPath(world,[{x:10,y:10},{x:30,y:30}],'street').ok);
 const index=18*48+22;world.tiles[index]={type:'residential',density:'medium',level:1};
 const parcel={width:2,depth:1},p=lotPlan(world,index,parcel);
 assert.ok(p.frontage);assert.ok(Math.abs(p.angle+Math.PI/4)<1e-8);
 const sin=Math.abs(Math.sin(p.angle)),cos=Math.abs(Math.cos(p.angle));
 assert.ok(cos*p.lotWidth+sin*p.lotDepth<=8+1e-8);
 assert.ok(sin*p.lotWidth+cos*p.lotDepth<=4+1e-8);
 const before=JSON.stringify(world),g=factory.create(world,index,parcel);
 assert.equal(g.rotation.y,p.angle);assert.equal(JSON.stringify(world),before);
 const bounds=new THREE.Box3().setFromObject(g);
 assert.ok(bounds.max.x-bounds.min.x<=8.2);assert.ok(bounds.max.z-bounds.min.z<=4.2);
});
test('curved frontage follows changing tangents and road removal invalidates cached lookup',()=>{
 const {world}=fixture();world.money=100000;
 const result=E.buildRoadPath(world,[{x:10,y:25},{x:20,y:5},{x:30,y:25}],'street');assert.ok(result.ok);
 const plans=[];
 for(const [x,y] of [[14,22],[26,22]]){const index=y*48+x;assert.notEqual(world.tiles[index].type,'road');world.tiles[index]={type:'residential',density:'low',level:1};plans.push(lotPlan(world,index));}
 assert.ok(plans.every(p=>p.frontage?.pathId===result.path.id));
 assert.ok(Math.abs(Math.sin(plans[0].angle))>.2);assert.ok(Math.sin(plans[0].angle)*Math.sin(plans[1].angle)<0);
 E.removeRoadPath(world,result.path.id);assert.equal(lotPlan(world,22*48+14).frontage,null);
});
