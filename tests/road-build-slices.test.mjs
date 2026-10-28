import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {constructionGridSteps} from '../dist/construction-grid.js';
import {batchStaticSteps} from '../dist/static-batch.js';
import E from '../dist/engine.js';
import {Roadworks} from '../dist/roadworks.js';
import {harness} from './fixtures/road-build-view.mjs';

test('staged construction grid retains every released vertex while reusing shared height samples',()=>{
 const height=(x,z)=>Math.max(.2,Math.sin(x*.1)+Math.cos(z*.2)),expected=[];
 for(let s=0;s<=48;s++)for(let k=0;k<96;k++){const a=-96+s*4,b=-96+k*2;expected.push(a,height(a,b)+.15,b,a,height(a,b+2)+.15,b+2,b,height(b,a)+.15,a,b+2,height(b+2,a)+.15,a);}
 let calls=0,checkpoints=0,next;const steps=constructionGridSteps((x,z)=>{calls++;return height(x,z);});do{next=steps.next();if(!next.done)checkpoints++;}while(!next.done);
 try{assert.deepEqual(next.value.attributes.position.array,new Float32Array(expected));assert.ok(calls<49*96*2,'shared vertices reduce height queries by at least half');assert.ok(checkpoints>1);}finally{next.value.dispose();}
});

test('cancelling mesh preparation releases temporary geometry and retains source meshes',()=>{
 const group=new THREE.Group(),shared=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),copies=[];
 const clone=shared.clone.bind(shared);shared.clone=()=>{const copy=clone(),flat=copy.toNonIndexed.bind(copy);copy.toNonIndexed=()=>{const g=flat();copies.push(g);return g;};copies.push(copy);return copy;};
 for(let i=0;i<3;i++){const mesh=new THREE.Mesh(shared,material);mesh.position.x=i;group.add(mesh);}const children=group.children.slice(),disposed=new Set(),oldDispose=THREE.BufferGeometry.prototype.dispose;
 THREE.BufferGeometry.prototype.dispose=function(){assert.ok(!disposed.has(this),'no double disposal');disposed.add(this);return oldDispose.call(this);};
 try{const steps=batchStaticSteps(group,shared);steps.next();steps.next();assert.ok(copies.length>0);steps.return();assert.deepEqual(group.children,children);assert.ok(copies.every(g=>disposed.has(g)));assert.ok(!disposed.has(shared));}
 finally{THREE.BufferGeometry.prototype.dispose=oldDispose;shared.dispose();material.dispose();}
});

function digest(r){const hash=createHash('sha256');r.group.traverse(o=>{if(!o.geometry)return;for(const [k,a]of Object.entries(o.geometry.attributes)){hash.update(k);hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(o.geometry.index)hash.update(new Uint8Array(o.geometry.index.array.buffer));hash.update(JSON.stringify([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));});return hash.digest('hex');}
const EDITION143={starter:'a8b89bab1c2fe5a1dec560923b2b778d3894ba3245da0f2c981c95bbad316b3f',district:'97630d851b4839a3d0485b65bd6d68fb1e2f77b01f3bb6e92e9a4b65fecdbc0c',river:'4fb9c5aa91417fff0d9a9bbf930d59bcbf788fa6e02355c7da50cf7126cf9d7b',islands:'a5cdcf81ccd063ddfbc86de09a2b4313e404fedbbc0b70cdad8c90b2a8b2f6a8'};
for(const [name,expected]of Object.entries(EDITION143))test('smaller construction steps retain released '+name+' road geometry byte for byte',()=>{
 const originalDocument=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
 const w=E.createWorld('Unchanged geometry',name==='river'||name==='islands'?name:'plains',431);w.money=1e8;
 if(name!=='starter'){for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,tree:false});w.roadPaths=[];for(const [kind,p]of [['avenue',[[6,24],[20,18],[42,24]]],['street',[[24,8],[24,40]]],['highway',[[8,36],[40,36]]]])assert.ok(E.buildRoadPath(w,p.map(([x,y])=>({x,y})),kind).ok);}
 const saved=JSON.stringify(w),v=harness(w),r=new Roadworks(v);
 try{r.build(w);assert.equal(digest(r),expected);assert.equal(JSON.stringify(w),saved);}finally{r.dispose();v.cleanup();globalThis.document=originalDocument;}
});
