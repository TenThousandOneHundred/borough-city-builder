import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {geometryUploadSteps} from '../dist/geometry-upload.js';
import {finishBuild,scheduleBuild} from '../dist/build-scheduler.js';
function fixture(){
 const geometry=new THREE.BoxGeometry();geometry.setDrawRange(3,9);const target={city:true},renderer={target,shadowMap:{autoUpdate:true,needsUpdate:true},xr:{enabled:true},getRenderTarget(){return this.target;},getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,setRenderTarget(target,face,level){this.target=target;this.face=face;this.level=level;}};let calls=0,privateTarget,material;
 renderer.render=(scene)=>{calls++;privateTarget=renderer.target;assert.notEqual(privateTarget,target);assert.equal(privateTarget.width,1);assert.equal(privateTarget.height,1);assert.equal(renderer.shadowMap.needsUpdate,false);assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(renderer.xr.enabled,false);assert.equal(scene.children.length,1);const mesh=scene.children[0];material=mesh.material;assert.equal(mesh.geometry,geometry);assert.equal(mesh.frustumCulled,false);assert.deepEqual(geometry.drawRange,{start:0,count:0});};
 return{geometry,renderer,target,get calls(){return calls;},get privateTarget(){return privateTarget;},get material(){return material;}};
}
function restored(f){assert.equal(f.renderer.target,f.target);assert.equal(f.renderer.face,2);assert.equal(f.renderer.level,1);assert.deepEqual(f.geometry.drawRange,{start:3,count:9});assert.deepEqual(f.renderer.shadowMap,{autoUpdate:true,needsUpdate:true});assert.equal(f.renderer.xr.enabled,true);}
test('staged uploads keep every buffer and draw range, skip duplicates, and restore renderer state',()=>{
 const f=fixture(),attrs={...f.geometry.attributes},index=f.geometry.index,bytes=index.array.slice();let disposed=0;f.geometry.addEventListener('dispose',()=>disposed++);
 try{finishBuild(geometryUploadSteps(f.renderer,[f.geometry,null,f.geometry]));assert.equal(f.calls,1);restored(f);assert.deepEqual(f.geometry.attributes,attrs);assert.equal(f.geometry.index,index);assert.deepEqual(index.array,bytes);assert.equal(disposed,0);}finally{f.geometry.dispose();}
});
test('failed uploads restore the visible renderer and dispose only private staging resources',()=>{
 const f=fixture(),render=f.renderer.render;let cleaned=0;f.renderer.render=scene=>{render(scene);f.privateTarget.addEventListener('dispose',()=>cleaned++);f.material.addEventListener('dispose',()=>cleaned++);throw Error('device error');};
 try{assert.throws(()=>finishBuild(geometryUploadSteps(f.renderer,[f.geometry])),/device error/);restored(f);assert.equal(cleaned,2);}finally{f.geometry.dispose();}
});
test('cancellation between uploads does not touch later or already uploaded geometry',async()=>{
 const f=fixture();let cancelled=false,time=0,cleaned=0;const render=f.renderer.render;f.renderer.render=scene=>{render(scene);time+=5;f.privateTarget.addEventListener('dispose',()=>cleaned++);f.material.addEventListener('dispose',()=>cleaned++);};
 const later=new THREE.BoxGeometry();try{await assert.rejects(scheduleBuild(geometryUploadSteps(f.renderer,[f.geometry,later]),{budgetMs:4,now:()=>time,yieldTask:async()=>{cancelled=true;},cancelled:()=>cancelled}),{name:'AbortError'});assert.equal(f.calls,1);restored(f);assert.equal(cleaned,2);assert.ok(later.index.count);}finally{f.geometry.dispose();later.dispose();}
});
test('warming real instanced scenery retains materials, lighting ownership and live callbacks',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),source=new THREE.InstancedMesh(geometry,material,2),lighting=new THREE.Scene(),light=new THREE.DirectionalLight(),fog=new THREE.Fog('#aabbcc',10,100);lighting.add(light);lighting.fog=fog;source.receiveShadow=true;source.castShadow=true;source.count=1;const originalMatrix=source.instanceMatrix.array.slice();let draws=0,disposed=0,callback=0;
 material.addEventListener('dispose',()=>disposed++);geometry.addEventListener('dispose',()=>disposed++);source.onBeforeRender=()=>callback++;
 const f=fixture();f.renderer.render=(scene)=>{draws++;assert.equal(scene.fog,fog);assert.ok(scene.children.includes(light));assert.equal(light.parent,lighting);const copy=scene.children.find(o=>o.isMesh);assert.equal(copy,source);assert.equal(copy.instanceMatrix,source.instanceMatrix);assert.equal(copy.geometry,geometry);assert.equal(copy.material,material);assert.equal(copy.receiveShadow,true);assert.equal(copy.castShadow,false);assert.deepEqual(copy.instanceMatrix.array,originalMatrix);copy.onBeforeRender();};
 try{finishBuild(geometryUploadSteps(f.renderer,[source],lighting));assert.equal(draws,1);assert.equal(disposed,0);assert.equal(callback,0);assert.equal(source.castShadow,true);assert.equal(source.count,1);assert.deepEqual(source.instanceMatrix.array,originalMatrix);assert.equal(light.parent,lighting);assert.deepEqual(lighting.children,[light]);assert.deepEqual(geometry.drawRange,{start:0,count:Infinity});}finally{source.dispose();geometry.dispose();material.dispose();f.geometry.dispose();}
});

test('shared base geometry warms each distinct instance buffer without disposing or reparenting it',()=>{
 const f=fixture(),material=new THREE.MeshStandardMaterial(),parent=new THREE.Group(),a=new THREE.InstancedMesh(f.geometry,material,4),b=new THREE.InstancedMesh(f.geometry,material,4);parent.add(a,b);a.visible=false;b.frustumCulled=true;let disposed=0;for(const mesh of [a,b])mesh.addEventListener('dispose',()=>disposed++);
 const drawn=[];f.renderer.render=scene=>{const mesh=scene.children.find(o=>o.isMesh);drawn.push(mesh);assert.equal(mesh.parent,parent);assert.equal(scene.matrixWorldAutoUpdate,false);if(mesh===b)throw Error('upload interrupted');};
 try{assert.throws(()=>finishBuild(geometryUploadSteps(f.renderer,[a,a,b])),/upload interrupted/);assert.deepEqual(drawn,[a,b]);assert.equal(disposed,0);assert.equal(a.visible,false);assert.equal(b.frustumCulled,true);assert.deepEqual(parent.children,[a,b]);restored(f);}
 finally{a.dispose();b.dispose();f.geometry.dispose();material.dispose();}
});
