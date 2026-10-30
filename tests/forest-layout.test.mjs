import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/forest-layout.js';
import {MAPS} from '../dist/map-catalog.js';
import {Landscape,groundHeight,wetness} from '../dist/landscape.js';
import {finishBuild} from '../dist/build-scheduler.js';
import {Vegetation} from '../dist/vegetation.js';
import * as THREE from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;
function originalTrees(w){
 let seed=w.seed;const random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 return w.tiles.map(t=>{const tree=t.ground==='land'&&random()<.16;assert.equal(t.variant,Math.floor(random()*4),'building variant random stream stays unchanged');return tree&&!t.type;});
}
function plan(w){const land=Object.assign(Object.create(Landscape.prototype),{view:{roadworks:null}});return finishBuild(land.treePlanSteps(w,{height:groundHeight,excluded:()=>false,earthworks:false}));}
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}

for(const map of MAPS)for(const n of [48,72])test(`${map.name} ${n}: coherent groves reuse the original tree-cell budget and random building variants`,()=>{
 const w=E.createWorld('Forest',map.id,map.seed,{mapSize:n}),old=originalTrees(w),trees=w.tiles.map((t,i)=>t.tree?i:-1).filter(i=>i>=0);
 assert.ok(E.valid(w));assert.equal(trees.length,old.filter(Boolean).length);
 let linked=0,oldLinked=0;
 for(let i=0;i<w.tiles.length;i++)for(const j of [i%n<n-1?i+1:-1,i+n<w.tiles.length?i+n:-1])if(j>=0){if(w.tiles[i].tree&&w.tiles[j].tree)linked++;if(old[i]&&old[j])oldLinked++;}
 assert.ok(linked>oldLinked*2,`connected canopy edges ${linked} vs scattered ${oldLinked}`);
 assert.ok(trees.every(i=>w.tiles[i].ground==='land'&&!w.tiles[i].type));
 const replay=E.createWorld('Replay',map.id,map.seed,{mapSize:n});assert.deepEqual(w.tiles,replay.tiles);assert.deepEqual(w.forest,replay.forest);
 for(const i of trees){const x=(i%n+.5)*4-n*2,z=(Math.floor(i/n)+.5)*4-n*2;for(const [px,pz,h,,,species]of F.pair(w,x,z,i)){assert.ok(Math.abs(px-x)<2&&Math.abs(pz-z)<2,'tree remains in its saved cell');assert.ok(h>=2.7&&h<7.5);assert.ok(['pine','broadleaf'].includes(species));}}
});

test('forest ownership survives saving, clearing, roads, and old saves without regeneration',()=>{
 const w=E.createWorld('Clearings','plains',813,{mapSize:72}),i=w.tiles.findIndex(t=>t.tree),store=new E.WorldStore(memory());
 assert.ok(E.place(w,i%72,Math.floor(i/72),'road').ok);assert.ok(E.place(w,i%72,Math.floor(i/72),'bulldoze').ok);const built=E.buildRoadPath(w,[{x:1,y:36},{x:30,y:36}],'street');assert.ok(built.ok);store.save(w);
 const restored=store.get(w.id);assert.deepEqual(restored.forest,w.forest);assert.deepEqual(restored.tiles,w.tiles);assert.ok(!restored.tiles[i].tree);
 const before=JSON.stringify(restored),result=plan(restored),n=72,half=n*2;
 for(const [x,z,, ,street]of result.positions)if(!street&&Math.abs(x)<half&&Math.abs(z)<half){const t=restored.tiles[Math.floor((z+half)/4)*n+Math.floor((x+half)/4)];assert.ok(t.tree&&!t.type,'no scenic tree can bypass saved clearing inside the map');}
 assert.equal(JSON.stringify(restored),before);const legacy=structuredClone(restored);delete legacy.forest;assert.ok(E.valid(legacy));const legacyBefore=JSON.stringify(legacy);const legacyPlan=plan(legacy);for(const [x,z,,,street]of legacyPlan.positions)if(!street&&Math.abs(x)<half&&Math.abs(z)<half)assert.ok(legacy.tiles[Math.floor((z+half)/4)*n+Math.floor((x+half)/4)].tree,'legacy large maps also respect saved clearing');assert.equal(JSON.stringify(legacy),legacyBefore);
 for(const forest of [{version:2,threshold:.6},{version:1,threshold:NaN},{version:1,threshold:2},null]){const bad={...w,forest};assert.ok(!E.valid(bad));}
});

test('forest plans remain dry, slope-safe, bounded and deterministic across mixed-size suspended jobs',()=>{
 const a=E.createWorld('Highlands','highlands',216,{mapSize:72}),b=E.createWorld('Lake','lake',1847,{mapSize:48});
 const make=w=>Object.assign(Object.create(Landscape.prototype),{view:{roadworks:null}}).treePlanSteps(w,{height:groundHeight,excluded:()=>false,earthworks:false});
 const ai=make(a),bi=make(b);let ar,br;while(!ar?.done||!br?.done){if(!ar?.done)ar=ai.next();if(!br?.done)br=bi.next();}
 for(const [w,result]of [[a,ar.value],[b,br.value]]){
  assert.deepEqual(result,plan(w));const half=(w.mapSize||48)*2,far=result.positions.filter(p=>Math.abs(p[0])>half||Math.abs(p[1])>half);
  assert.ok(far.length<=F.FAR_LIMIT);assert.ok(result.positions.length<=w.tiles.filter(t=>t.tree).length*2+F.FAR_LIMIT+40);
  for(const [x,z,,,street]of result.positions){assert.ok(Number.isFinite(result.heights.get(x+':'+z)));assert.ok(Math.hypot(groundHeight(w,x+.5,z)-groundHeight(w,x-.5,z),groundHeight(w,x,z+.5)-groundHeight(w,x,z-.5))<=.7);if(!street)assert.ok(wetness(w,x,z)<.18);}
 }
});

test('stand species use the same prototype for distant cards and close models without extra batches',()=>{
 const broad=new THREE.Group(),pineA=new THREE.Group(),pineB=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.set(0,3,8);
 const v=Object.assign(Object.create(Vegetation.prototype),{v:{camera,detailEnabled:true,night:false,renderer:{shadowMap:{}}},broadleaf:[{material:new THREE.MeshBasicMaterial()}],broadPrototype:broad,impostors:[{material:new THREE.MeshBasicMaterial()},{material:new THREE.MeshBasicMaterial()}],prototypes:[pineA,pineB]});
 const positions=[[0,0,5,0,false,'pine'],[4,0,5,0,false,'broadleaf'],[8,0,5,0,false,'pine']],group=new THREE.Group();v.populate(group,positions,()=>0);
 assert.equal(v.instances.length,2,'only the occupied broadleaf and pine A batches are needed');assert.equal(v.instances.reduce((sum,m)=>sum+m.count,0),positions.length);assert.equal(v.population.records.find(r=>r.i===1).source,broad);
 for(const r of v.population.records.filter(r=>r.i!==1)){assert.ok([pineA,pineB].includes(r.source));assert.equal(r.mesh.material,v.impostors[r.i%2].material);assert.ok(v.population.near.has(r.i));}
 assert.ok(v.population.near.size<=10);v.update();assert.equal(v.lastMatrixWrites,0);
 group.traverse(o=>o.geometry?.dispose());for(const m of [...v.broadleaf,...v.impostors])m.material.dispose();
});
