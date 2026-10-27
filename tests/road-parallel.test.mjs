import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {planParallelRoads,quoteParallelRoads,buildParallelRoads} from '../dist/road-parallel.js';

const curve=[{x:8,y:26},{x:24,y:10},{x:39,y:28}],at=(x,y)=>y*48+x;
const width=type=>(E.ROADS[type].width+(E.ROADS[type].sidewalk?.8:0))/4;
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function world(){const w=E.createWorld('Parallel roads','plains',8);w.money=1e7;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});return w;}
function evalCurve(c,t){const u=1-t;return c.length===2?{x:c[0].x+(c[1].x-c[0].x)*t,y:c[0].y+(c[1].y-c[0].y)*t}:{x:u*u*c[0].x+2*u*t*c[1].x+t*t*c[2].x,y:u*u*c[0].y+2*u*t*c[1].y+t*t*c[2].y};}
function tangent(c,t){return c.length===2?{x:c[1].x-c[0].x,y:c[1].y-c[0].y}:{x:2*((1-t)*(c[1].x-c[0].x)+t*(c[2].x-c[1].x)),y:2*((1-t)*(c[1].y-c[0].y)+t*(c[2].y-c[1].y))};}
function offset(c,t,d){const p=evalCurve(c,t),v=tangent(c,t),s=Math.hypot(v.x,v.y);return {x:p.x-d*v.y/s,y:p.y+d*v.x/s};}
function nearest(p,polyline){let best=Infinity;for(let i=1;i<polyline.length;i++){const a=polyline[i-1],b=polyline[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return best;}
function dense(paths,n=64){const points=[];for(const c of paths)for(let i=0;i<=n;i++)if(!points.length||i)points.push(evalCurve(c,i/n));return points;}

test('straight parallel roads have exact perpendicular spacing for both sides and directions',()=>{
 for(const c of [[{x:10,y:10},{x:30,y:10}],[{x:10,y:10},{x:30,y:25}],[{x:20,y:8},{x:20,y:35}]])for(const side of [-1,1])for(const reverse of [false,true]){
  const p=planParallelRoads(c,{roadWidth:1,clearGap:.8,side,reverse});assert.ok(p.ok,p.reason);assert.equal(p.secondary.length,1);close(p.offset,1.8);close(p.maxError,0);
  const expected=[offset(c,0,side*1.8),offset(c,1,side*1.8)];if(reverse)expected.reverse();assert.deepEqual(p.secondary[0],expected);close(dist(p.gapGuide.a,p.gapGuide.b),.8);
  assert.deepEqual(p.primary,c);assert.ok(p.samples.primary.length+p.samples.secondary.length<=768);
 }
});

test('curved offsets follow the true normal-distance locus within the certified error',()=>{
 for(const c of [curve,[{x:10,y:20},{x:20,y:0},{x:30,y:20}]])for(const side of [-1,1]){
  const p=planParallelRoads(c,{side});assert.ok(p.ok,p.reason);assert.ok(p.maxError<=.01);assert.ok(p.secondary.length>1&&p.secondary.length<=16);
  const fit=dense(p.secondary),truth=Array.from({length:601},(_,i)=>offset(c,i/600,side*p.offset));let error=0;
  for(const v of truth)error=Math.max(error,nearest(v,fit));for(const v of fit)error=Math.max(error,nearest(v,truth));
  assert.ok(error<=p.maxError+.001,`${error} exceeds ${p.maxError}`);assert.ok(error<.011);
  for(const c of p.secondary){const a=tangent(c,0),b=tangent(c,1),acceleration={x:b.x-a.x,y:b.y-a.y};for(let n=0;n<=32;n++){const v=tangent(c,n/32),curvature=Math.abs(v.x*acceleration.y-v.y*acceleration.x)/Math.hypot(v.x,v.y)**3;assert.ok(.8125/2*curvature<1,'a sidewalk must not fold across its curvature centre');}}
  for(let i=1;i<p.secondary.length;i++){
   const a=p.secondary[i-1],b=p.secondary[i];assert.deepEqual(a.at(-1),b[0]);const u=tangent(a,1),v=tangent(b,0),scale=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);
   close((u.x*v.y-u.y*v.x)/scale,0,1e-7);assert.ok(u.x*v.x+u.y*v.y>0);
  }
  close(dist(p.gapGuide.a,p.gapGuide.b),p.gap,.011);assert.ok(p.samples.primary.length+p.samples.secondary.length<=768);
 }
});

test('reversing a curved secondary reverses segment order, control order and travel samples only',()=>{
 const a=planParallelRoads(curve,{side:-1}),b=planParallelRoads(curve,{side:-1,reverse:true});assert.ok(a.ok&&b.ok);
 assert.deepEqual(b.primary,a.primary);assert.deepEqual(b.secondary,a.secondary.slice().reverse().map(c=>c.slice().reverse()));assert.deepEqual(b.samples.secondary,a.samples.secondary.slice().reverse());assert.deepEqual(b.gapGuide,a.gapGuide);
});

test('nonuniform collinear quadratics retain exact primary controls and one straight offset',()=>{
 const controls=[{x:10,y:10,kind:'endpoint'},{x:11,y:10,label:'bend'},{x:30,y:10}],before=structuredClone(controls),p=planParallelRoads(controls);
 assert.ok(p.ok,p.reason);assert.equal(p.secondary.length,1);assert.equal(p.secondary[0].length,2);close(p.maxError,0);assert.deepEqual(controls,before);
 assert.deepEqual(p.primary,controls.map(({x,y})=>({x,y})));assert.ok(p.paths.flat().every(p=>Object.keys(p).sort().join(',')==='x,y'));
});

test('degenerate directions, inner cusps, out-of-bounds offsets and excessive fitting requirements reject',()=>{
 for(const [c,options]of [
  [[{x:10,y:10},{x:10,y:10}],{}],
  [[{x:10,y:10},{x:20,y:20},{x:10,y:10}],{}],
  [[{x:10,y:20},{x:20,y:0},{x:30,y:20}],{roadWidth:1,clearGap:5,side:1}],
  [[{x:10,y:0},{x:30,y:0}],{side:-1}],
  [curve,{maxSegments:1}],
  [curve,{maxSegments:100000}],
  [curve,{roadWidth:0}],
  [curve,{clearGap:-1}],
  [curve,{clearGap:9}],
  [curve,{side:0}]
 ]){const p=planParallelRoads(c,options);assert.equal(p.ok,false);assert.ok(p.reason);}
 assert.ok(planParallelRoads([{x:10,y:10},{x:30,y:10}],{clearGap:0}).ok,'exact straight road edges may touch');
 assert.equal(planParallelRoads(curve,{clearGap:0}).ok,false,'an uncertain fitted surface must not overlap at zero gap');
});

test('all road styles use complete corridor widths and exactly the combined quoted price',()=>{
 for(const type of Object.keys(E.ROADS)){
  const w=world();for(let y=0;y<48;y++)for(let x=16;x<19;x++)w.tiles[at(x,y)].ground='water';
  const p=planParallelRoads([{x:8,y:20},{x:32,y:20}],{roadWidth:width(type),reverse:!!E.ROADS[type].oneway}),before=JSON.stringify(w),q=quoteParallelRoads(w,p,type,E,{zoneSides:'left'});
  assert.ok(q.ok,q.reason);assert.equal(q.costComplete,true);assert.equal(JSON.stringify(w),before);
  const funds=w.money,r=buildParallelRoads(w,p,type,E,{zoneSides:'left'});assert.ok(r.ok,r.reason);assert.equal(r.cost,q.cost);assert.equal(w.money,funds-q.cost);assert.equal(r.roads.length,p.paths.length);assert.ok(E.valid(w));
  assert.deepEqual(r.roads.map(p=>p.controls),p.paths);assert.ok(new Set(r.roads.map(p=>p.id)).size===r.roads.length);
 }
});

test('short fitted pieces share one saved secondary road without dropping zero-new-tile geometry',()=>{
 const w=world(),p=planParallelRoads([{x:12,y:24},{x:14,y:20},{x:16,y:24}],{side:-1}),q=quoteParallelRoads(w,p,'street',E);
 assert.ok(p.ok&&q.ok,q.reason||p.reason);const pieces=E.roadBatchQuote(w,[p.primary,...p.secondary],'street');assert.ok(pieces.quotes.some(piece=>piece.cost===0));assert.equal(q.cost,pieces.cost);
 const r=buildParallelRoads(w,p,'street',E);assert.ok(r.ok,r.reason);assert.equal(r.roads.length,2);assert.deepEqual(r.roads.map(p=>p.controls),p.paths);
 assert.equal(r.roads[1].controls.length,p.secondary.length*2+1);assert.deepEqual(E.sampleRoad(r.roads[1].controls),p.secondary.flatMap((piece,i)=>E.sampleRoad(piece).slice(i?1:0)));
 assert.ok(r.roads.every(p=>p.tiles.length&&p.tiles.every(i=>w.tiles[i].pathIds.includes(p.id))));assert.ok(E.valid(w));
});

test('a secondary-only obstruction or insufficient total funds never leaves the primary behind',()=>{
 const controls=[{x:8,y:20},{x:32,y:20}],p=planParallelRoads(controls,{clearGap:1});
 for(const blocked of [true,false]){
  const w=world();if(blocked)Object.assign(w.tiles[at(25,22)],{type:'hospital',building:'clinic',level:1});else w.money=quoteParallelRoads(w,p,'street',E).cost-1;
  const before=JSON.stringify(w),q=quoteParallelRoads(w,p,'street',E);assert.equal(q.ok,false);assert.equal(q.costComplete,!blocked);assert.equal(buildParallelRoads(w,p,'street',E).ok,false);assert.equal(JSON.stringify(w),before);
 }
});

test('planning and quotation do not mutate controls, saves, RNG or large resident state',()=>{
 const w=world();w.citizens={version:1,time:0,nextId:1,residents:[],untouched:()=>{}};const citizens=w.citizens,p=planParallelRoads(curve),before=JSON.stringify(w),random=Math.random,uuid=globalThis.crypto.randomUUID;
 try{Math.random=()=>assert.fail('quotation consumed RNG');globalThis.crypto.randomUUID=()=>assert.fail('quotation allocated road ID');assert.ok(quoteParallelRoads(w,p,'street',E).ok);}finally{Math.random=random;globalThis.crypto.randomUUID=uuid;}
 assert.equal(JSON.stringify(w),before);assert.ok(buildParallelRoads(w,p,'street',E).ok);assert.equal(w.citizens,citizens);
});

test('manual save/reload retains fitted directions, path ownership and zoning policies',()=>{
 const w=world(),p=planParallelRoads(curve,{reverse:true}),r=buildParallelRoads(w,p,'oneway',E,{zoneSides:'left'});assert.ok(r.ok,r.reason);assert.ok(r.roads.every(p=>p.zoneSides==='left'));
 let raw;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};new E.WorldStore(storage).save(w,137);
 const restored=new E.WorldStore(storage).get(w.id);assert.ok(E.valid(restored));assert.deepEqual(restored.roadPaths,w.roadPaths);assert.deepEqual(restored.tiles,w.tiles);
 const cells=[...E.fineZoningLayout(restored).values()].filter(p=>r.roads.some(r=>r.id===p.source));assert.ok(cells.length);assert.ok(cells.every(p=>p.side===-1));assert.equal(new Set(cells.map(p=>p.source)).size,2);
});
