import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {Landscape,floorHeight} from '../dist/landscape.js';
import {finishBuild} from '../dist/build-scheduler.js';
import {prepareRoadRefresh} from '../dist/road-build-job.js';
import {lotPlan} from '../dist/building-plan.js';
import E from '../dist/engine.js';
import {world,harness} from './fixtures/road-build-view.mjs';
const instant=async steps=>finishBuild(steps);

// Captured from Edition 147's unsliced makeTrees: position, size, species,
// street flag and final elevation, including scenery outside the city boundary.
const golden={plains:'7b9cf0e4aa6ac6462697add0fbcc48da01ad9ce64b38facaffaeea32bf7d4563',river:'eef11b177fa9cd9ff069b77e01b314b61c0b639d8a21cdadcc1d7cea42719ea7',islands:'2f2f218df6da67ac221fb55ecd3a72288730aa82b82aecb87a13990d942edaf6'};
test('sliced tree planning preserves every existing tree and elevation across all terrains',()=>{
 for(const [terrain,expected]of Object.entries(golden)){
  const w=E.createWorld('Trees',terrain,431),land=Object.create(Landscape.prototype);w.landformVersion=2;
  land.world=w;land.earthworks={sample:(x,z)=>Math.abs(x)<5&&Math.abs(z)<5?3:null,excluded:(x,z)=>Math.abs(x)<1&&Math.abs(z)<1};land.view={roadworks:{surfaceHeight:()=>2,surfaces:{heightAt:()=>null}}};
  const steps=land.treePlanSteps(w);let count=0,result;do{result=steps.next();count++;}while(!result.done);
  assert.ok(count>200);const {positions,heights}=result.value,records=positions.map(p=>[...p,heights.get(p[0]+':'+p[1])]);
  assert.equal(createHash('sha256').update(JSON.stringify(records)).digest('hex'),expected);
 }
});
function building(v){const w=v.world,i=23*48+24,old=w.tiles[i];w.tiles[i]={...old,type:'office',level:1};const plan=lotPlan(w,i);w.tiles[i]=old;const root=new THREE.Group();root.position.y=floorHeight(w,plan.cx,plan.cz)+.04;root.userData={plan,asset:true};v.buildings.set('fixture-building',root);return root;}
function geometry(group){return group.children.map(o=>Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,Array.from(a.array)])));}
test('staged driveways remain hidden, retain exact geometry, and skip duplicate final work',async()=>{
 const v=harness(world());v.refresh(true);building(v);v.roadworks.buildAccess(v.world,v.buildings);const old=v.roadworks,original=geometry(old.accessGroup);let checked=false;
 v.renderer.getRenderTarget=()=>null;v.renderer.setRenderTarget=()=>{};v.renderer.compileAsync=async group=>{const access=group.children[1];checked=true;assert.equal(access.visible,false);assert.ok(access.children.length);assert.equal(v.roadworks,old);};
 const refresh=v.refresh.bind(v);v.refresh=(force,prepared)=>{assert.ok(prepared.accessMatches(v.buildings));v.roadworks.buildAccess=()=>assert.fail('valid prepared access should be reused');refresh(force,prepared);};
 try{
  await prepareRoadRefresh(v,{schedule:async steps=>{let r;do{r=steps.next();assert.equal(old.accessGroup.visible,true);}while(!r.done);return r.value;}});
  assert.ok(checked);assert.equal(v.roadworks.accessGroup.visible,true);assert.ok(original.length);assert.deepEqual(geometry(v.roadworks.accessGroup),original);
 }finally{v.roadworks.dispose();v.cleanup();}
});
test('a replaced building invalidates prepared driveways and rebuilds its current access',async()=>{
 const v=harness(world());v.refresh(true);const root=building(v),refresh=v.refresh.bind(v);let rebuilt=0;
 v.refresh=(force,prepared)=>{const replacement=root.clone();replacement.position.y+=.01;v.buildings.set('fixture-building',replacement);assert.equal(prepared.accessMatches(v.buildings),false);const build=v.roadworks.buildAccess.bind(v.roadworks);v.roadworks.buildAccess=(...args)=>{rebuilt++;return build(...args);};refresh(force,prepared);};
 try{assert.equal(await prepareRoadRefresh(v,{schedule:instant}),true);assert.equal(rebuilt,1);assert.equal(v.roadworks.accessGroup.visible,true);}finally{v.roadworks.dispose();v.cleanup();}
});
test('trees prepared for an older occupancy are discarded before adopting the new scene',async()=>{
 for(const change of [false,true]){
  const v=harness(world());v.refresh(true);const refresh=v.refresh.bind(v);let inspected=false;
  v.renderer.getRenderTarget=()=>null;v.renderer.setRenderTarget=()=>{};v.renderer.compileAsync=async()=>{if(change)v.world.tiles[0].tree=!v.world.tiles[0].tree;};
  v.refresh=(force,prepared)=>{inspected=true;assert.equal(!!v.landscape.preparedTreePlan,!change);refresh(force,prepared);};
  try{assert.equal(await prepareRoadRefresh(v,{schedule:instant}),true);assert.ok(inspected);assert.equal(v.landscape.preparedTreePlan,null);}finally{v.roadworks.dispose();v.cleanup();}
 }
});
test('leaving during final preparation disposes staged driveways and keeps the old ones',async()=>{
 const v=harness(world());v.refresh(true);building(v);v.roadworks.buildAccess(v.world,v.buildings);const old=v.roadworks;let release,staged,disposed=0;
 v.renderer.getRenderTarget=()=>null;v.renderer.setRenderTarget=()=>{};v.renderer.compileAsync=group=>{staged=group.children[1];for(const mesh of staged.children)mesh.geometry.addEventListener('dispose',()=>disposed++);return new Promise(resolve=>release=resolve);};
 try{const pending=prepareRoadRefresh(v,{schedule:instant});while(!release)await Promise.resolve();const count=staged.children.length;assert.ok(count);v.world={...v.world};v.roadRefreshJob=null;release();assert.equal(await pending,false);assert.equal(staged.parent,null);assert.equal(disposed,count);assert.equal(v.roadworks,old);assert.ok(old.accessGroup.children.length);}finally{v.cleanup();}
});
