import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WalkingSearch} from '../dist/walking-search.js';
import {Walking} from '../dist/walking.js';
import {Traffic} from '../dist/traffic.js';
import E from '../dist/engine.js';
import {walkingDistrict} from './walking-search-fixture.mjs';

// Independent relaxation oracle covers weighted routes and disconnected nodes.
function shortest(nodes,starts,ends,a,b){
 const costs=Array(nodes.length).fill(Infinity);for(const n of starts)costs[n.id]=Math.hypot(a.x-n.x,a.z-n.z);
 for(let pass=0;pass<nodes.length;pass++){let changed=false;for(const n of nodes)for(const [id,length]of n.links)if(costs[n.id]+length<costs[id]){costs[id]=costs[n.id]+length;changed=true;}if(!changed)break;}
 return Math.min(...ends.map(n=>costs[n.id]+Math.hypot(b.x-n.x,b.z-n.z)));
}
test('reused pedestrian search retains shortest weighted routes, ties and isolated destinations',()=>{
 const search=new WalkingSearch();let seed=7;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(const size of [0,12,100,24,170,6]){
  const nodes=Array.from({length:size},(_,id)=>({id,x:random()*40,z:random()*40,links:new Map()}));
  for(const n of nodes)for(let k=0;k<3;k++){const id=Math.floor(random()*size);if(id!==n.id)n.links.set(id,1+Math.floor(random()*12));}
  for(let run=0;run<45;run++){
   const starts=nodes.filter(()=>random()<.1),ends=nodes.filter(()=>random()<.1),a={x:0,z:0},b={x:40,z:40},expected=shortest(nodes,starts,ends,a,b),actual=search.find(nodes,starts,ends,a,b);
   if(!Number.isFinite(expected)){assert.equal(actual,null);continue;}
   assert.ok(Math.abs(actual.length-expected)<1e-9);
   assert.ok(starts.some(n=>n.id===actual.ids[0]));assert.ok(ends.some(n=>n.id===actual.ids.at(-1)));
   let length=Math.hypot(a.x-nodes[actual.ids[0]].x,a.z-nodes[actual.ids[0]].z)+Math.hypot(b.x-nodes[actual.ids.at(-1)].x,b.z-nodes[actual.ids.at(-1)].z);
   for(let i=1;i<actual.ids.length;i++){const edge=nodes[actual.ids[i-1]].links.get(actual.ids[i]);assert.ok(Number.isFinite(edge));length+=edge;}assert.ok(Math.abs(actual.length-length)<1e-9);
  }
 }
 const nodes=Array.from({length:4},(_,id)=>({id,x:0,z:0,links:new Map()}));nodes[0].links=new Map([[1,1],[2,1]]);nodes[1].links.set(3,1);nodes[2].links.set(3,1);
 const a=nodes[0],b=nodes[3],first=search.find(nodes,[a],[b],a,b);assert.deepEqual(first,{ids:[0,1,3],length:2});
 const costs=search.costs;search.generation=0xffffffff;assert.deepEqual(search.find(nodes,[a],[b],a,b),first);assert.equal(search.costs,costs);assert.equal(search.generation,1);
 nodes[0].links.clear();assert.equal(search.find(nodes,[a],[b],a,b),null);assert.deepEqual(first,{ids:[0,1,3],length:2},'later searches do not overwrite returned paths');
});
test('pedestrian route caches survive workspace reuse and road rebuilding invalidates them',()=>{
 const {world,pairs}=walkingDistrict(),traffic=new Traffic(world,E),walker=new Walking(world,traffic),saved=JSON.stringify(world),[from,to]=pairs[0],first=walker.route(from,to),copy=structuredClone(first);
 assert.ok(first);for(const [a,b]of pairs)assert.ok(walker.route(a,b));assert.equal(walker.route(from,to),first);assert.deepEqual(first,copy);assert.equal(JSON.stringify(world),saved);
 for(const t of world.tiles)if(t.type==='road')t.type=null;traffic.rebuild(world);walker.rebuild();assert.equal(walker.route(from,to),null);
 const fresh=walkingDistrict().world;world.tiles=fresh.tiles;traffic.rebuild(world);walker.rebuild();assert.deepEqual(walker.route(from,to),copy);
});
