import {test} from 'node:test';
import assert from 'node:assert/strict';
import C from '../dist/road-curves.js';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {lotPlan} from '../dist/building-plan.js';

// Frozen legacy arithmetic, including sampling density and operation order.
function oldSample(controls,density=10){const out=[],steps=Math.max(2,Math.ceil(controls.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-controls[i].x,p.y-controls[i].y),0)*density));for(let i=0;i<=steps;i++){const t=i/steps,u=1-t,a=controls[0],b=controls[1],c=controls[2];out.push(c?{x:u*u*a.x+2*u*t*b.x+t*t*c.x,y:u*u*a.y+2*u*t*b.y+t*t*c.y}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}return out;}
function blank(){const w=E.createWorld('Continuous streets','plains',8);w.money=1e7;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});return w;}
function build(w,controls){const r=E.buildRoadPath(w,controls,'street');assert.ok(r.ok,r.reason);return r.path;}
function named(path,w,id){const old=path.id;path.id=id;for(const t of w.tiles)if(t.pathIds)t.pathIds=t.pathIds.map(p=>p===old?id:p);}

test('two- and three-control samples remain exactly equal to the legacy sampler',()=>{
 let seed=137;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const count of [2,3])for(const density of [8,10])for(let n=0;n<30;n++){
  const controls=Array.from({length:count},()=>({x:random()*47,y:random()*47}));assert.deepEqual(C.sample(controls,density),oldSample(controls,density));
 }
});

test('valid control counts are bounded while coordinate bounds remain the engine responsibility',()=>{
 for(const count of [2,3,5,17,65])assert.equal(C.validControls(Array.from({length:count},()=>({x:-1,y:48}))),true);
 for(const count of [0,1,4,6,64,66,67,1000])assert.equal(C.validControls(Array.from({length:count},()=>({x:10,y:10}))),false);
 assert.equal(C.validControls([{x:0,y:0},{x:NaN,y:1}]),false);assert.equal(C.validControls(null),false);assert.deepEqual(C.sample([]),[]);
 assert.equal(E.roadQuote(blank(),[{x:-1,y:10},{x:20,y:10}]).ok,false);
});

test('piece joining preserves all quadratic handles and converts mixed straight pieces exactly',()=>{
 const pieces=[[{x:4,y:12,kind:'snap'},{x:8,y:4},{x:12,y:12}],[{x:12,y:12},{x:20,y:12}],[{x:20,y:12},{x:28,y:20},{x:36,y:12}]],snapshot=structuredClone(pieces),joined=C.joinPieces(pieces);
 assert.deepEqual(joined,[{x:4,y:12},{x:8,y:4},{x:12,y:12},{x:16,y:12},{x:20,y:12},{x:28,y:20},{x:36,y:12}]);assert.deepEqual(pieces,snapshot);
 for(const density of [8,10]){
  const quadratics=pieces.map(p=>p.length===3?p:[p[0],{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},p[1]]),expected=quadratics.flatMap((p,i)=>oldSample(p,density).slice(i?1:0));assert.deepEqual(C.sample(joined,density),expected);
 }
 assert.equal(C.joinPieces([]),null);assert.equal(C.joinPieces([[{x:0,y:0},{x:2,y:0}],[{x:3,y:0},{x:4,y:0}]]),null);
 assert.deepEqual(C.joinPieces([[{x:0,y:0},{x:2,y:0}]]),[{x:0,y:0},{x:2,y:0}]);
});

test('reversing flattened controls traverses every piece backwards without losing joins',()=>{
 const joined=C.joinPieces([[{x:4,y:10},{x:8,y:2},{x:12,y:10}],[{x:12,y:10},{x:18,y:18},{x:26,y:10}]]),a=C.sample(joined),b=C.sample([...joined].reverse()).reverse();assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++)assert.ok(Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y)<1e-12);
});

test('one continuous piecewise street retains full frontage columns across former piece boundaries',()=>{
 const a=blank(),b=blank(),straight=build(a,[{x:8,y:24},{x:40,y:24}]),pieces=Array.from({length:8},(_,i)=>[{x:8+i*4,y:24},{x:12+i*4,y:24}]),joined=build(b,C.joinPieces(pieces));named(straight,a,'continuous-frontage');named(joined,b,'continuous-frontage');
 const old=E.fineZoningLayout(a),layout=E.fineZoningLayout(b);assert.deepEqual([...layout],[...old]);assert.equal(new Set([...layout.values()].map(p=>p.source)).size,1);
 const cells=[...layout.values()].filter(p=>p.side===1);E.fineZoneCells(b,cells.map(p=>p.id),'residential_medium');
 const start=cells.find(p=>p.row===0&&p.col===8),lot=F.proposal(b.development,layout,start.id,3,2);assert.ok(lot,'a lot spans former piece column10');assert.deepEqual(lot.cells.slice(0,3).map(id=>JSON.parse(id)[2]),[8,9,10]);
 assert.ok(E.valid(b));
});

test('building frontage follows the final piece rather than repeating the first quadratic',()=>{
 const w=blank(),controls=[{x:8,y:20},{x:12,y:12},{x:20,y:20},{x:26,y:28},{x:36,y:20}],path=build(w,controls),index=25*48+32;
 Object.assign(w.tiles[index],{type:'residential',density:'low',level:1,people:4});const p=lotPlan(w,index);
 assert.equal(p.frontage.pathId,path.id);assert.ok(p.frontage.x>(20.5*4-96),'frontage must lie beyond the first piece endpoint');assert.ok(p.frontage.z>(20.5*4-96),'the final arc bends south');
 assert.ok(E.valid(w));
});
