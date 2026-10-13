import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {Architecture} from '../dist/architecture.js';
import {canvasDocument,architectureView,architectureDigest} from './architecture-fixture.mjs';

test('local facade detail starts without any asset request and retains nearby window geometry',async()=>{
 const originalDocument=globalThis.document,originalFetch=globalThis.fetch;let requests=0;
 globalThis.document=canvasDocument();globalThis.fetch=async()=>{requests++;throw Error('Network unavailable');};
 try{
  const architecture=new Architecture(architectureView());await architecture.ready;architecture.detail=true;
  const material=architecture.facade('brick',3,1,false),root=new THREE.Group();architecture.volume(root,0,0,3,2,2.7,0,material);
  assert.equal(requests,0);const windows=root.children.filter(o=>o.isInstancedMesh);assert.ok(windows.length>=4);assert.ok(windows.reduce((n,o)=>n+o.count,0)>300);
  const detailed=architectureDigest(root);architecture.detail=false;const far=new THREE.Group();architecture.volume(far,0,0,3,2,2.7,0,architecture.facade('brick',3,1,false));
  assert.equal(far.children.some(o=>o.isInstancedMesh),false);assert.notEqual(architectureDigest(far),detailed);
  assert.ok(far.children.flatMap(o=>Array.isArray(o.material)?o.material:[o.material]).some(m=>m.map?.image?.commands.some(c=>c[0]==='createLinearGradient')),'distant facade retains drawn windows');
 }finally{globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});
