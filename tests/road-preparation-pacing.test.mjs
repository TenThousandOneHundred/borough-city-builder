import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {createRoadEarthworksSteps} from '../dist/road-earthworks.js';
import {coverLandSteps,coverPlanSteps} from '../dist/ground-cover-plan.js';
import {Roadworks} from '../dist/roadworks.js';
import {harness} from './fixtures/road-build-view.mjs';
import {roadGeometry,reuseRoadGeometry} from '../dist/road-junction-plan.js';

test('traffic reuses prepared centerlines only for matching roads, map dimensions and engine',()=>{
 const world=E.createWorld('Shared road plan','plains',431),snapshot=structuredClone(world),plan=roadGeometry(snapshot,E);
 world.money++;world.day++;
 assert.equal(reuseRoadGeometry(snapshot,world,E),true);
 assert.equal(roadGeometry(world,E),plan);
 assert.equal(reuseRoadGeometry(snapshot,world,{...E}),false);
 for(const mutate of [w=>{w.mapSize=72},w=>{w.roundabouts={test:{outer:5}}},w=>{w.tiles.find(t=>t.type==='road').roadWidth=2},w=>{(w.roadPaths||=[]).push({id:'new',controls:[{x:4,y:4},{x:10,y:4}],type:'street'})}]){
  const changed=structuredClone(world);mutate(changed);assert.equal(reuseRoadGeometry(snapshot,changed,E),false);
 }
 const road=world.tiles.find(t=>t.type==='road');road.roadWidth=2;
 assert.notEqual(roadGeometry(world,E),plan,'a later live edit invalidates the adopted plan');
 assert.equal(reuseRoadGeometry({},world,E),false);
});

test('long sidewalk foundations yield before quantizing an entire road boundary',()=>{
 const surfaces=[];
 for(let i=0;i<512;i++){
  const x=i*2,a=[x,.3,0],b=[x,.3,1],c=[x+2,.3,1],d=[x+2,.3,0];
  for(const vertices of [[a,b,c],[a,c,d]])surfaces.push({kind:'sidewalk',vertices});
 }
 const saved=JSON.stringify(surfaces),steps=createRoadEarthworksSteps({world:{seed:1,tiles:[]},surfaces,groundHeight:()=>0});
 const round=Math.round;let calls=0,maxCalls=0,total=0,next;
 Math.round=(...args)=>{calls++;return round(...args);};
 try{do{calls=0;next=steps.next();maxCalls=Math.max(maxCalls,calls);total+=calls;}while(!next.done);}
 finally{Math.round=round;steps.return?.();}
 try{
  assert.ok(!next.value.stats.fallback,'terrain support must finish rather than silently fall back');
  assert.ok(maxCalls<=1024,`one uninterrupted step performed ${maxCalls} quantizations`);
  assert.equal(total,97436,'same work and quantization order as the released foundation');
  assert.equal(JSON.stringify(surfaces),saved);
 }finally{next.value.dispose();}
});

test('surface capture can be cancelled between meshes and releases partial copies',()=>{
 const world=E.createWorld('Capture pacing','plains',431),v=harness(world),roads=new Roadworks(v);
 const material=new THREE.MeshBasicMaterial(),originals=[];
 for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4,4,8,8),material);mesh.userData.roadSurface='sidewalk';mesh.position.x=i*5;roads.group.add(mesh);originals.push(mesh);
 }
 const steps=roads.captureEarthworkSurfacesSteps();let previous=0;
 try{
  for(let i=0;i<5;i++){assert.equal(steps.next().done,false);assert.ok(roads.earthworkSurfaces.length-previous<=1);previous=roads.earthworkSurfaces.length;}
  assert.ok(previous>0&&previous<originals.length);
  const copies=roads.earthworkSurfaces.slice(),disposed=new Set();
  for(let i=0;i<copies.length;i++){
   assert.notEqual(copies[i].geometry,originals[i].geometry);
   assert.deepEqual(copies[i].geometry.attributes.position.array,originals[i].geometry.attributes.position.array);
   assert.deepEqual(copies[i].matrix.elements,originals[i].matrixWorld.elements);
   copies[i].geometry.addEventListener('dispose',()=>disposed.add(copies[i]));
  }
  steps.return();roads.dispose();assert.equal(disposed.size,copies.length);
 }finally{steps.return();v.cleanup();material.dispose();}
});

test('cancelling vegetation clearance does not scan the rest of an extra-large city',()=>{
 let inspected=0;const world={mapSize:96,tiles:Array.from({length:96*96},()=>({get type(){inspected++;return null;}}))};
 const steps=coverLandSteps(world,null);assert.equal(steps.next().done,false);assert.equal(steps.next().done,false);steps.return();
 assert.ok(inspected>0&&inspected<512,`read ${inspected} cells before cancellation`);
});

// Recorded from Edition 167 before changing scheduling. Mixed-size jobs are
// interleaved to exercise the coordinate context at every yield boundary.
const COVER167={"48":"6e95ab7868489adc408c2aa59343ee99c957355805ccfed605541f4d21bb5fda","72":"ee726b169c44c4819ba1ffbf025b44e757366fadb63ae7e5d2d860c09a433d23","96":"ec7254c1f964807b742e2181e6cbda1dc9aadd9195f3824ed5f0701eeb056257"};
test('interleaved vegetation jobs retain released plant positions and sizes',()=>{
 const jobs=[48,72,96].map(mapSize=>{
  const world=E.createWorld('Cover pacing','plains',431,{mapSize});
  for(const tile of world.tiles)Object.assign(tile,{type:null,ground:'land',tree:false,zone:null});
  world.roadPaths=[];world.money=1e8;
  assert.ok(E.buildRoadPath(world,[{x:4,y:12},{x:mapSize-4,y:12}],'street').ok);
  return {mapSize,steps:coverPlanSteps(world,(_w,x,z)=>.2+x*.001+z*.002,()=>0,E)};
 });
 while(jobs.some(job=>!job.done))for(const job of jobs)if(!job.done){const next=job.steps.next();job.done=next.done;if(next.done)job.hash=createHash('sha256').update(JSON.stringify(next.value.clumps)).digest('hex');}
 for(const job of jobs)assert.equal(job.hash,COVER167[job.mapSize]);
});
