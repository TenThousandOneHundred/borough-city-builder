import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {planRoadGrid,quoteRoadGrid,buildRoadGrid} from '../dist/road-grid.js';

const at=(x,y)=>y*48+x;
const controls=[{x:10,y:10},{x:24.4,y:10},{x:24.4,y:19.6}];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function world(){const w=E.createWorld('Road grid','plains',8);w.money=1e7;for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});return w;}
function plan(type='street',c=controls,options={}){return planRoadGrid(c,{roadWidth:E.ROADS[type].width/4,...options});}
function road(w,c,type='street'){const r=E.buildRoadPath(w,c,type);assert.ok(r.ok,r.reason);return r.path;}
function freeze(value){Object.freeze(value);for(const x of Object.values(value))if(x&&typeof x==='object'&&!Object.isFrozen(x))freeze(x);return value;}

test('three-click grids project a rigid rotated rectangle in either depth direction',()=>{
 for(const third of [{x:18,y:30},{x:24,y:12}]){
  const c=[{x:10,y:10,kind:'snap'},{x:22,y:19,label:'axis'},third],before=structuredClone(c),p=plan('street',c);
  assert.ok(p.ok,p.reason);assert.equal(p.stage,3);close(p.width,15);
  const [a,b,d,e]=p.corners,u={x:b.x-a.x,y:b.y-a.y},v={x:e.x-a.x,y:e.y-a.y};
  close(u.x*v.x+u.y*v.y,0);close(d.x,b.x+v.x);close(d.y,b.y+v.y);
  assert.deepEqual(p.paths.slice(0,4),[[a,b],[b,d],[d,e],[e,a]]);
  assert.equal(p.paths.length,p.rows+p.columns+2);
  assert.deepEqual(c,before);assert.ok(p.paths.flat().every(q=>Object.keys(q).sort().join(',')==='x,y'));
 }
});

test('incomplete stages, computed-corner bounds, degenerate grids and excessive counts are explicit',()=>{
 assert.equal(planRoadGrid([]).stage,0);assert.equal(planRoadGrid([{x:4,y:4}]).stage,1);
 const edge=planRoadGrid(controls.slice(0,2));assert.ok(edge.ok);assert.equal(edge.stage,2);assert.deepEqual(edge.paths,[controls.slice(0,2)]);
 assert.equal(quoteRoadGrid(world(),edge,'street',E).ok,false);
 for(const c of [[{x:3,y:3},{x:12,y:12},{x:0,y:47}],[{x:5,y:5},{x:5,y:5},{x:10,y:10}],[{x:5,y:5},{x:10,y:5},{x:15,y:5}],[{x:0,y:0},{x:NaN,y:5},{x:5,y:10}]])assert.equal(planRoadGrid(c).ok,false);
 const outside=planRoadGrid([{x:3,y:3},{x:12,y:12},{x:0,y:47}]);assert.deepEqual(outside.paths,[[{x:3,y:3},{x:12,y:12}]],'invalid depth keeps a bounded edge preview');
 assert.match(plan('street',controls,{maxBlocks:2}).reason,/at most 2/);
 assert.equal(plan('street',controls,{maxBlocks:100000}).ok,false);
 const wide=plan('highway',controls,{blockSize:1,roadWidth:3});assert.ok(wide.ok);assert.ok(wide.width/wide.columns>=4.6);assert.ok(wide.depth/wide.rows>=4.6);
});

test('combined price charges shared intersections once, including water, and equals the committed debit',()=>{
 for(const type of Object.keys(E.ROADS)){
  const w=world(),p=plan(type);for(let y=0;y<48;y++)for(let x=16;x<=18;x++)w.tiles[at(x,y)].ground='water';
  const q=quoteRoadGrid(w,p,type,E,{zoneSides:'left'});assert.ok(q.ok,q.reason);assert.equal(q.costComplete,true);
  const all=new Set(p.paths.flatMap(line=>E.roadQuote(w,line,type).tiles));
  const expected=[...all].reduce((sum,i)=>sum+E.ROADS[type].cost*(w.tiles[i].ground==='water'?4:1),0);
  assert.equal(q.cost,expected);assert.ok(q.cost<p.paths.reduce((sum,line)=>sum+E.roadQuote(w,line,type).cost,0));
  const funds=w.money,r=buildRoadGrid(w,p,type,E,{zoneSides:'left'});assert.ok(r.ok,r.reason);assert.equal(r.cost,q.cost);assert.equal(w.money,funds-q.cost);
  assert.equal(r.roads.length,p.paths.length);assert.equal(new Set(r.roads.map(p=>p.id)).size,r.roads.length);
  for(const path of r.roads){assert.equal(path.type,type);assert.equal(path.zoneSides,E.ROADS[type].limitedAccess?undefined:'left');assert.ok(path.tiles.every(i=>w.tiles[i].pathIds.includes(path.id)));}
  assert.ok(E.valid(w));
 }
});

test('a building or construction blocking the final internal street leaves the whole city unchanged',()=>{
 for(const construction of [false,true]){
  const w=world(),p=plan(),tile=w.tiles[at(20,13)];
  Object.assign(tile,construction?{zone:'residential_low',construction:1}:{type:'hospital',building:'clinic',level:1});
  const before=JSON.stringify(w),q=quoteRoadGrid(w,p,'street',E);assert.equal(q.ok,false);assert.equal(q.costComplete,false);assert.ok(q.quotes.length>=5,'obstacle is found after multiple valid streets');
  assert.equal(JSON.stringify(w),before);assert.equal(buildRoadGrid(w,p,'street',E).ok,false);assert.equal(JSON.stringify(w),before);
 }
});

test('insufficient funds are checked against the whole grid before any placement',()=>{
 const w=world(),p=plan(),cost=quoteRoadGrid(w,p,'street',E).cost;w.money=cost-1;const before=JSON.stringify(w);
 const q=quoteRoadGrid(w,p,'street',E);assert.equal(q.ok,false);assert.equal(q.costComplete,true);assert.equal(q.cost,cost);assert.match(q.reason,/whole grid/);
 assert.equal(buildRoadGrid(w,p,'street',E).ok,false);assert.equal(JSON.stringify(w),before);
 w.money=cost;assert.ok(buildRoadGrid(w,p,'street',E).ok);assert.equal(w.money,0);
});

test('an unexpected late engine failure cannot publish roads, debit money or alter live references',()=>{
 const w=world(),p=plan(),tiles=w.tiles,first=tiles[at(10,10)],before=JSON.stringify(w);let calls=0;
 const engine={...E,buildRoadPath(...args){return ++calls===3?{ok:false,reason:'Late placement failure'}:E.buildRoadPath(...args);}};
 const r=buildRoadGrid(w,p,'street',engine);assert.equal(r.ok,false);assert.equal(calls,3);assert.match(r.reason,/Late/);
 assert.equal(w.tiles,tiles);assert.equal(w.tiles[at(10,10)],first);assert.equal(JSON.stringify(w),before);
});

test('quoting frozen saved data uses no random IDs and does not deep-copy residents',()=>{
 const w=freeze(world()),p=plan(),before=JSON.stringify(w),random=Math.random,uuid=globalThis.crypto.randomUUID;
 try{Math.random=()=>assert.fail('quote consumed random state');globalThis.crypto.randomUUID=()=>assert.fail('quote allocated an ID');assert.ok(quoteRoadGrid(w,p,'street',E).ok);assert.ok(quoteRoadGrid(w,p,'street',E).ok);}finally{Math.random=random;globalThis.crypto.randomUUID=uuid;}
 assert.equal(JSON.stringify(w),before);
 const live=world();live.citizens={version:1,time:0,nextId:1,residents:[],unrelatedData:()=>{}};const citizens=live.citizens;
 assert.ok(quoteRoadGrid(live,p,'street',E).ok);assert.ok(buildRoadGrid(live,p,'street',E).ok);assert.equal(live.citizens,citizens);
});

test('an existing full boundary is retained and partial collinear coverage becomes real extensions',()=>{
 for(const full of [false,true]){
  const w=world(),p=plan(),old=road(w,full?controls.slice(0,2):[{x:14,y:10},{x:20,y:10}]),saved=structuredClone(old);
  const q=quoteRoadGrid(w,p,'street',E);assert.ok(q.ok,q.reason);assert.equal(q.existingRoads,1);assert.equal(q.newRoads,p.paths.length+(full?-1:1));
  const r=buildRoadGrid(w,p,'street',E);assert.ok(r.ok,r.reason);assert.equal(w.roadPaths[0],old);assert.deepEqual(old,saved);
  if(!full){assert.deepEqual(r.roads[0].controls,[{x:10,y:10},{x:14,y:10}]);assert.deepEqual(r.roads[1].controls,[{x:20,y:10},{x:24.4,y:10}]);}
  assert.ok(E.valid(w));
 }
});

test('matching raster cells do not turn an offset or shallow curved road into an existing grid edge',()=>{
 for(const existing of [[{x:10,y:10.3},{x:24.4,y:10.3}],[{x:10,y:10},{x:17.2,y:10.4},{x:24.4,y:10}]]){
  const w=world();road(w,existing);const before=JSON.stringify(w),q=quoteRoadGrid(w,plan(),'street',E);
  assert.equal(q.ok,false);assert.match(q.reason,/parallel/);assert.equal(buildRoadGrid(w,plan(),'street',E).ok,false);assert.equal(JSON.stringify(w),before);
 }
});

test('opposing existing one-way edges reject rather than break the directed perimeter',()=>{
 const w=world(),p=plan('oneway');road(w,[controls[1],controls[0]],'oneway');const before=JSON.stringify(w);
 assert.match(quoteRoadGrid(w,p,'oneway',E).reason,/against/);assert.equal(buildRoadGrid(w,p,'oneway',E).ok,false);assert.equal(JSON.stringify(w),before);
});

test('legacy one-way reuse follows its actual increasing-index traffic direction',()=>{
 const w=world();for(let x=8;x<=27;x++)Object.assign(w.tiles[at(x,10)],{type:'road',level:1,roadType:'oneway'});
 assert.ok(quoteRoadGrid(w,plan('oneway'),'oneway',E).ok);
 const reverse=plan('oneway',[controls[1],controls[0],{x:10,y:19.6}]);assert.match(quoteRoadGrid(w,reverse,'oneway',E).reason,/against/);
});

test('road edits invalidate existing-centerline reuse and road limits reject before commit',()=>{
 const w=world(),p=plan(),existing=road(w,controls.slice(0,2));assert.ok(quoteRoadGrid(w,p,'street',E).ok);
 existing.type='oneway';existing.controls.reverse();assert.match(quoteRoadGrid(w,p,'street',E).reason,/against/);
 const full=world();full.roadPaths=Array.from({length:4999},(_,i)=>({id:'existing-'+i,type:'street',controls:[{x:1,y:1},{x:2,y:1}],tiles:[at(1,1),at(2,1)]}));
 const before=JSON.stringify(full);assert.match(quoteRoadGrid(full,p,'street',E).reason,/limit/);assert.equal(buildRoadGrid(full,p,'street',E).ok,false);assert.equal(JSON.stringify(full),before);
});

test('legacy wide-road changes invalidate offset clearance even without a named road type',()=>{
 const w=world();for(let x=8;x<=27;x++)Object.assign(w.tiles[at(x,10)],{type:'road',level:1,roadWidth:1});
 const p=plan('street',[{x:10,y:10.8},{x:24.4,y:10.8},{x:24.4,y:20.4}]);assert.ok(quoteRoadGrid(w,p,'street',E).ok);
 for(let x=8;x<=27;x++)w.tiles[at(x,10)].roadWidth=2;
 assert.match(quoteRoadGrid(w,p,'street',E).reason,/parallel/);
});

test('frontage reconnection remains atomic and preserves existing home and resident identities',()=>{
 const w=world(),p=plan(),old=road(w,controls.slice(0,2)),layout=E.fineZoningLayout(w),cells=[...layout.values()].filter(c=>c.source===old.id&&c.side===-1);
 E.fineZoneCells(w,cells.map(c=>c.id),'residential_low');
 const start=cells.find(c=>c.row===0&&c.col>5&&F.proposal(w.development,layout,c.id,2,2));assert.ok(start);
 const home=F.reserve(w.development,layout,start.id,2,2);home.occupant={type:'residential',building:'cottage',density:'low',level:1,people:6,variant:0};
 assert.ok(E.removeRoadPath(w,old.id).ok);const before=JSON.stringify(w),occupant=home.occupant,frontage=home.frame.frontage;let calls=0;
 const failing={...E,buildRoadPath(...args){return ++calls===3?{ok:false,reason:'Late failure'}:E.buildRoadPath(...args);}};
 assert.equal(buildRoadGrid(w,p,'street',failing).ok,false);assert.equal(JSON.stringify(w),before);assert.equal(home.frame.frontage,frontage);
 const r=buildRoadGrid(w,p,'street',E);assert.ok(r.ok,r.reason);assert.equal(w.development.parcels[home.id],home);assert.equal(home.occupant,occupant);
 assert.ok(r.roads.some(r=>r.id===home.frame.frontage.pathId));assert.notEqual(home.frame.frontage.pathId,old.id);assert.ok(E.valid(w));
});

test('grid roads have connected zoning, plain saved controls and survive save/reload',()=>{
 const w=E.createWorld('Saved grid','plains',8);w.money=1e6;
 const c=[{x:19,y:24,kind:'endpoint'},{x:33.4,y:24,label:'length'},{x:33.4,y:33.6}],p=plan('street',c),r=buildRoadGrid(w,p,'street',E,{zoneSides:'right'});
 assert.ok(r.ok,r.reason);const connected=E.analyze(w).roads;
 assert.ok(r.roads.flatMap(p=>p.tiles).every(i=>connected.has(i)));
 const cells=[...E.fineZoningLayout(w).values()].filter(p=>r.roads.some(r=>r.id===p.source));assert.ok(cells.length);assert.ok(cells.every(p=>p.side===1));
 assert.ok(r.roads.flatMap(p=>p.controls).every(p=>Object.keys(p).sort().join(',')==='x,y'));
 let raw;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};new E.WorldStore(storage).save(w,123);
 const restored=new E.WorldStore(storage).get(w.id);assert.ok(E.valid(restored));assert.deepEqual(restored.roadPaths,w.roadPaths);assert.deepEqual(restored.tiles,w.tiles);
});

test('duplicate generated street IDs fail the transaction without corrupting existing ownership',()=>{
 const w=world(),p=plan(),before=JSON.stringify(w),uuid=globalThis.crypto.randomUUID;
 try{globalThis.crypto.randomUUID=()=> 'same-grid-id';const r=buildRoadGrid(w,p,'street',E);assert.equal(r.ok,false);assert.match(r.reason,/unique/);}finally{globalThis.crypto.randomUUID=uuid;}
 assert.equal(JSON.stringify(w),before);
});
