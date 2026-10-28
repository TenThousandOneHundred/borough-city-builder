import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {finishBuild,scheduleBuild} from '../dist/build-scheduler.js';
import {prepareRoadRefresh} from '../dist/road-build-job.js';
import {createRoadEarthworks} from '../dist/road-earthworks.js';
import E from '../dist/engine.js';
import {world,harness,digest} from './fixtures/road-build-view.mjs';

function roadHash(r){const h=createHash('sha256');r.group.traverse(o=>{if(!o.geometry)return;for(const [k,a]of Object.entries(o.geometry.attributes)){h.update(k);h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(o.geometry.index)h.update(new Uint8Array(o.geometry.index.array.buffer));h.update(JSON.stringify([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));});return h.digest('hex');}
const instant=async steps=>finishBuild(steps);
const rectangle=(x,z,y=.35)=>[{kind:'asphalt',vertices:[[x,y,z],[x,y,z+2],[x+8,y,z+2]]},{kind:'asphalt',vertices:[[x,y,z],[x+8,y,z+2],[x+8,y,z]]}];

test('build scheduling yields, preserves operation order and closes cancelled generators',async()=>{
 let time=0,yields=0,closed=false;function* steps(){try{for(let i=0;i<30;i++){time++;yield i;}return 42;}finally{closed=true;}}
 assert.equal(await scheduleBuild(steps(),{budgetMs:4,now:()=>time,yieldTask:async()=>{yields++;}}),42);assert.ok(yields>=7);assert.ok(closed);
 closed=false;let cancel=false;await assert.rejects(scheduleBuild(steps(),{budgetMs:4,now:()=>time,cancelled:()=>cancel,yieldTask:async()=>{cancel=true;}}),{name:'AbortError'});assert.ok(closed);
});

test('unchanged terrain cells reuse exact partitions and distant edits retain the cache',()=>{
 const regionCache={},options={world:{},groundHeight:()=>0,surfaces:rectangle(-20,-2),regionCache};
 const a=createRoadEarthworks(options);assert.ok(a.cacheStats.builtRegions>0);
 const b=createRoadEarthworks(options);assert.equal(b.cacheStats.builtRegions,0);assert.ok(b.cacheStats.reusedRegions>0);
 const c=createRoadEarthworks({...options,surfaces:[...options.surfaces,...rectangle(20,20)]});assert.ok(c.cacheStats.reusedRegions>0);assert.ok(c.cacheStats.builtRegions>0);
 const d=createRoadEarthworks({...options,surfaces:rectangle(-20,-2,.8)});const uncached=createRoadEarthworks({...options,surfaces:rectangle(-20,-2,.8),regionCache:null});
 for(let x=-21;x<=-10;x+=.25)for(let z=-3;z<=1;z+=.25){assert.equal(d.sample(x,z),uncached.sample(x,z));assert.equal(d.contains(x,z),uncached.contains(x,z));}
 for(const plan of [a,b,c,d,uncached])plan.dispose();
});

test('interactive placement keeps the old scene visible then adopts exact synchronous geometry and terrain',async()=>{
 const a=world(),b=structuredClone(a),sync=harness(a),interactive=harness(b);sync.refresh(true);interactive.refresh(true);
 try{
  const result=E.buildRoadPath(a,[{x:24,y:20},{x:24,y:28}],'street');assert.ok(result.ok);Object.assign(b,structuredClone(a));const saved=JSON.stringify(b),old=interactive.roadworks,originalRoads=roadHash(old),originalTerrain=digest(interactive.landscape);let checkpoints=0;
  sync.refresh();
  const schedule=async steps=>{let result;do{assert.equal(interactive.roadworks,old);assert.equal(old.group.visible,true);assert.equal(roadHash(old),originalRoads);assert.equal(digest(interactive.landscape),originalTerrain);checkpoints++;for(let i=0;i<300;i++){result=steps.next();if(result.done)break;}}while(!result.done);return result.value;};
  assert.equal(await prepareRoadRefresh(interactive,{schedule}),true);assert.ok(checkpoints>2);assert.notEqual(interactive.roadworks,old);assert.equal(old.group.parent,null);assert.equal(roadHash(interactive.roadworks),roadHash(sync.roadworks));assert.equal(digest(interactive.landscape),digest(sync.landscape));assert.equal(JSON.stringify(b),saved);assert.equal(interactive.roadRefreshJob,null);
  assert.equal(interactive.scene.children.filter(g=>g===old.group||g===old.signalGroup).length,0);
 }finally{sync.cleanup();interactive.roadworks.dispose();interactive.cleanup();}
});

test('leaving a world cancels staged work and releases its groups without replacing the visible roads',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const old=v.roadworks,before=v.scene.children.slice();let release;
 try{const pending=prepareRoadRefresh(v,{schedule:async(steps,{cancelled})=>{await new Promise(resolve=>release=resolve);assert.ok(cancelled());throw new DOMException('cancelled','AbortError');}});v.world={...w};v.roadRefreshJob=null;release();assert.equal(await pending,false);assert.equal(v.roadworks,old);assert.deepEqual(v.scene.children,before);assert.ok(old.earthworks);}
 finally{v.cleanup();}
});

test('a second edit invalidates staged work and can be retried without losing either road',async()=>{
 const w=world(),v=harness(w);v.refresh(true);let release;const old=v.roadworks;
 try{
  const pending=prepareRoadRefresh(v,{schedule:async steps=>{if(!release)await new Promise(resolve=>release=resolve);return finishBuild(steps);}});
  assert.ok(E.buildRoadPath(w,[{x:24,y:20},{x:24,y:28}],'street').ok);release();assert.equal(await pending,false);assert.equal(v.roadworks,old);assert.equal(v.roadRefreshJob,null);
  assert.equal(await prepareRoadRefresh(v,{schedule:instant}),true);assert.equal(w.roadPaths.length,2);assert.equal(v.roadworks.world,w);
 }finally{v.roadworks.dispose();v.cleanup();}
});

test('manual save during preparation persists the entire new road and resumes from home',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const storage={data:null,getItem(){return this.data},setItem(k,value){this.data=value}},store=new E.WorldStore(storage);store.save(w);const session=new E.GameSession(store);session.start(w.id);session.world=w;let release;
 try{
  assert.ok(E.buildRoadPath(w,[{x:24,y:20},{x:24,y:28}],'street').ok);
  const pending=prepareRoadRefresh(v,{schedule:async steps=>{if(!release)await new Promise(resolve=>release=resolve);return finishBuild(steps);}});
  session.save(5000);const saved=structuredClone(w.roadPaths);assert.deepEqual(new E.WorldStore(storage).get(w.id).roadPaths,saved);
  session.exit(6000);v.roadRefreshJob=null;release();assert.equal(await pending,false);assert.equal(session.screen,'home');
  session.start(w.id);assert.deepEqual(session.world.roadPaths,saved);assert.equal(session.world.savedAt,6000);
 }finally{v.cleanup();}
});

test('failed preparation releases staged resources and permits a fresh attempt',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const groups=v.scene.children.slice(),old=v.roadworks;
 try{await assert.rejects(prepareRoadRefresh(v,{schedule:async()=>{throw Error('fixture failure');}}),/fixture failure/);assert.equal(v.roadRefreshJob,null);assert.equal(v.roadworks,old);assert.deepEqual(v.scene.children,groups);assert.equal(await prepareRoadRefresh(v,{schedule:instant}),true);}
 finally{v.roadworks.dispose();v.cleanup();}
});

test('sliced grass preparation retains every visible vertex, index and clump',async()=>{
 const {groundCover,groundCoverSteps}=await import('../dist/ground-cover.js');const w=world(),view={detailEnabled:true,engine:E},height=()=>0,wet=()=>0,a=groundCover(view,w,height,wet),b=await instant(groundCoverSteps(view,w,height,wet));
 try{assert.equal(roadHash({group:a}),roadHash({group:b}));assert.deepEqual(a.userData.clumps,b.userData.clumps);}finally{a.userData.dispose();b.userData.dispose();}
});

test('asphalt textures survive cancellation and transfer ownership on adoption',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const material=v.roadworks.asphalt;let releases=0;material.addEventListener('dispose',()=>releases++);
 try{await assert.rejects(prepareRoadRefresh(v,{schedule:async()=>{throw Error('fixture failure');}}));assert.equal(releases,0);assert.equal(v.roadworks.asphalt,material);await prepareRoadRefresh(v,{schedule:instant});assert.equal(v.roadworks.asphalt,material);assert.equal(releases,0);v.roadworks.dispose();assert.equal(releases,1);}
 finally{v.cleanup();}
});

test('replacement programs acquire references before old materials are released and use the city render target',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const old=v.roadworks,previous={name:'screen'},cityTarget={name:'city'},events=[];let current=previous,release;
 v.graphics={enabled:true,target:cityTarget};Object.assign(v.renderer,{getRenderTarget:()=>current,setRenderTarget(target){current=target;},compileAsync(group,camera,scene){assert.equal(current,cityTarget);assert.equal(scene,v.scene);assert.equal(camera,v.camera);assert.ok(group.children.length);assert.equal(old.group.parent,v.scene);events.push('compile');return new Promise(resolve=>release=resolve);}});
 const originalDispose=old.dispose.bind(old);old.dispose=()=>{events.push('dispose');originalDispose();};
 try{const pending=prepareRoadRefresh(v,{schedule:instant});while(!release)await Promise.resolve();assert.equal(current,previous,'restore the renderer before waiting');assert.deepEqual(events,['compile']);assert.equal(v.roadworks,old);release();assert.equal(await pending,true);assert.deepEqual(events,['compile','dispose']);assert.equal(current,previous);}
 finally{v.roadworks.dispose();v.cleanup();}
});

test('leaving during program preparation releases only staged roads and restores the render target',async()=>{
 const w=world(),v=harness(w);v.refresh(true);const old=v.roadworks,previous={};let current=previous,release;
 v.graphics={enabled:true,target:{}};Object.assign(v.renderer,{getRenderTarget:()=>current,setRenderTarget(target){current=target;},compileAsync(){return new Promise(resolve=>release=resolve);}});
 try{const pending=prepareRoadRefresh(v,{schedule:instant});while(!release)await Promise.resolve();v.world={...w};v.roadRefreshJob=null;release();assert.equal(await pending,false);assert.equal(v.roadworks,old);assert.equal(current,previous);assert.ok(old.earthworks);assert.equal(v.scene.children.filter(o=>o===old.group).length,1);}
 finally{v.cleanup();}
});

test('visible construction waits for animation frames while hidden construction keeps progressing',async()=>{
 const saved={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};let frames=0,time=0;
 try{
  globalThis.document={visibilityState:'visible'};globalThis.requestAnimationFrame=callback=>{frames++;return setTimeout(callback,0);};globalThis.cancelAnimationFrame=clearTimeout;
  function* steps(){for(let i=0;i<4;i++){time+=10;yield;}return 'ready';}
  assert.equal(await scheduleBuild(steps(),{now:()=>time}),'ready');assert.equal(frames,4);
  globalThis.document.visibilityState='hidden';assert.equal(await scheduleBuild(steps(),{now:()=>time}),'ready');assert.equal(frames,4,'hidden worlds do not depend on animation frames');
 }finally{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
