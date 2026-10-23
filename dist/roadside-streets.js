// Join zoning frontages across separately drawn sections of the same street.
(function(root){
'use strict';
const cache=new WeakMap();
function streetGraph(world,layout){
 let graph=cache.get(layout);if(graph)return graph;
 const sources=new Set([...layout.values()].map(p=>p.source)),ends=new Map(),bins=new Map();
 function add(source,controls){
  const pair=[0,1].map(end=>{
   const p=end?controls.at(-1):controls[0],q=end?controls.slice(0,-1).reverse().find(q=>Math.hypot(q.x-p.x,q.y-p.y)>1e-6):controls.slice(1).find(q=>Math.hypot(q.x-p.x,q.y-p.y)>1e-6);
   if(!q)return null;const length=Math.hypot(q.x-p.x,q.y-p.y);
   return {source,end,x:p.x,z:p.y,dx:(q.x-p.x)/length,dz:(q.y-p.y)/length};
  });
  if(pair.some(p=>!p))return;ends.set(source,pair);
  for(const p of pair){const key=Math.floor(p.x*10)+','+Math.floor(p.z*10);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}
 }
 for(const road of world.roadPaths||[])if(sources.has(road.id)&&road.type!=='highway')add(road.id,road.controls);
 // Legacy streets use terrain coordinates; their end tile centers are also
 // where the road drawing tool snaps an extension.
 for(const source of sources){
  const match=/^legacy-([hv])-(\d+)$/.exec(source);if(!match)continue;
  const vertical=match[1]==='v',fixed=Number(match[2]),coords=[];
  for(let n=0;n<48;n++){const t=world.tiles[vertical?n*48+fixed:fixed*48+n];if(t.type==='road'&&(!t.pathIds?.length||t.legacyRoad)&&t.roadType!=='highway')coords.push(n);}
  if(coords.length>1)add(source,[coords[0],coords.at(-1)].map(n=>vertical?{x:fixed,y:n}:{x:n,y:fixed}));
 }
 for(const pair of ends.values())for(const p of pair){
  const candidates=[],x=Math.floor(p.x*10),z=Math.floor(p.z*10);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const q of bins.get((x+dx)+','+(z+dz))||[]){
   if(q.source===p.source||Math.hypot(p.x-q.x,p.z-q.z)>.025)continue;
   const score=-(p.dx*q.dx+p.dz*q.dz);if(score>=-.01)candidates.push({q,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  // Prefer the straight continuation at a T junction. An ambiguous fork
  // ends the strip, rather than choosing a branch the player did not paint.
  if(candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>.1))p.next=candidates[0].q;
 }
 for(const pair of ends.values())for(const p of pair)if(p.next?.next!==p)p.next=null;
 graph={ends,corridors:new Map()};cache.set(layout,graph);return graph;
}
function corridor(world,layout,first){
 const graph=streetGraph(world,layout),key=JSON.stringify([first.source,first.side]);
 if(graph.corridors.has(key))return graph.corridors.get(key);
 const result=[{source:first.source,side:first.side,dir:1}],seen=new Set([first.source]);
 for(const forward of [true,false]){
  let current=result[forward?result.length-1:0];
  while(true){
   const exit=forward?(current.dir===1?1:0):(current.dir===1?0:1),next=graph.ends.get(current.source)?.[exit].next;
   if(!next||seen.has(next.source))break;
   const dir=forward?(next.end===0?1:-1):(next.end===1?1:-1);
   current={source:next.source,side:first.side*dir,dir};seen.add(next.source);
   if(forward)result.push(current);else result.unshift(current);
  }
 }
 graph.corridors.set(key,result);return result;
}
const api={corridor};if(typeof module!=='undefined')module.exports=api;else root.BoroughStreets=api;
})(globalThis);
