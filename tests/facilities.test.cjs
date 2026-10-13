const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const fresh=()=>E.createWorld('Facility test','plains',41);
const copy=w=>JSON.parse(JSON.stringify(w));
const place=(w,building='hospital',rotation=0,x=10,y=23)=>E.place(w,x,y,E.BUILDINGS[building].type,{building,rotation});
const memory=()=>{let saved=null;return {getItem:()=>saved,setItem:(_,value)=>saved=value}};

test('all civic footprints and rotations charge once and survive exact independent saves',()=>{
 for(const [id,[width,depth]] of Object.entries(E.FACILITY_SITES))for(let rotation=0;rotation<4;rotation++){
  const w=fresh(),before=w.money,r=place(w,id,rotation,20,15);assert.ok(r.ok,`${id}/${rotation}`);
  assert.equal(r.cells.length,width*depth);assert.equal(new Set(r.cells).size,width*depth);
  assert.equal(w.money,before-E.BUILDINGS[id].cost);
  assert.deepEqual(r.site,{width:rotation%2?depth:width,depth:rotation%2?width:depth,rotation});
  assert.ok(r.cells.includes(15*48+20));assert.equal(r.cells.filter(i=>w.tiles[i].level>0).length,1);
  for(const i of r.cells){assert.equal(E.facilityOwner(w,i),r.owner);assert.deepEqual(E.facilityCells(w,i),r.cells);assert.equal(E.place(w,i%48,Math.floor(i/48),'inspect').tile,w.tiles[r.owner]);}
  assert.equal(E.analyze(w).counts[E.BUILDINGS[id].type],1);assert.ok(E.valid(w),`${id}/${rotation} valid`);
  const storage=memory(),store=new E.WorldStore(storage);store.save(w,123);assert.deepEqual(new E.WorldStore(storage).get(w.id),copy(w));
 }
});

test('any facility edge connects to the outside road network and capacity/upkeep count once',()=>{
 for(const rotation of [0,1,2,3]){
  const w=fresh(),before=E.analyze(w),r=place(w,'hospital',rotation,30,15);assert.ok(r.ok);
  assert.equal(E.analyze(w).connected.hospital||0,0);
  const x=r.owner%48,y=Math.floor(r.owner/48),end={x:x+r.site.width-1,y:y+r.site.depth};
  // Attach the edge farthest from the anchor, using a road that stays outside the site.
  assert.ok(E.buildRoad(w,{x:19,y:24},{x:end.x,y:24}).ok);
  assert.ok(E.buildRoad(w,{x:end.x,y:24},end).ok);
  const a=E.analyze(w);assert.equal(a.connected.hospital,2.5);assert.equal(a.counts.hospital,1);
  assert.ok(a.active.includes(r.owner));assert.ok(!a.active.includes(r.cells.at(-1)));
  const without=copy(w);for(const i of r.cells){without.tiles[i]={ground:'land',type:null,level:0,people:0,variant:0};}
  assert.ok(Math.abs(a.upkeep-E.analyze(without).upkeep-65)<1e-8);assert.equal(before.connected.hospital||0,0);
  assert.ok(E.place(w,end.x,end.y,'bulldoze').ok);assert.equal(E.analyze(w).connected.hospital||0,0);
 }
});

test('blocked, wet, out-of-bounds, invalid and unaffordable facilities are atomic',()=>{
 for(const problem of ['building','road','construction','water','funds','bounds','rotation','category']){
  const w=fresh(),q=E.facilityQuote(w,10,23,'hospital',{building:'hospital'}),t=w.tiles[q.owner];
  if(problem==='building')Object.assign(t,{type:'park',level:1});
  if(problem==='road')Object.assign(t,{type:'road',level:1});
  if(problem==='construction')t.construction=1;
  if(problem==='water')t.ground='water';if(problem==='funds')w.money=1;
  const before=JSON.stringify(w),r=E.place(w,problem==='bounds'?47:10,23,problem==='category'?'school':'hospital',{building:'hospital',rotation:problem==='rotation'?4:0});
  assert.equal(r.ok,false,problem);assert.equal(JSON.stringify(w),before,problem);
 }
});

test('demolition from every footprint cell removes exactly one complete facility',()=>{
 for(let n=0;n<12;n++){
  const w=fresh(),r=place(w);const i=r.cells[n],before=w.money;
  assert.ok(E.place(w,i%48,Math.floor(i/48),'bulldoze').ok);assert.equal(w.money,before-10);
  for(const j of r.cells){assert.equal(w.tiles[j].type,null);assert.equal(w.tiles[j].facilityOwner,undefined);assert.equal(w.tiles[j].facilitySite,undefined);}
  assert.ok(E.valid(w));
 }
 const w=fresh(),r=place(w);w.money=9;const before=JSON.stringify(w);assert.equal(E.place(w,10,23,'bulldoze').ok,false);assert.equal(JSON.stringify(w),before);
});

test('road, pedestrian path and zoning tools cannot consume facility cells',()=>{
 const w=fresh(),r=place(w),before=JSON.stringify(w);
 assert.equal(E.buildRoadPath(w,[{x:8,y:22},{x:16,y:22}],'street').ok,false);
 assert.equal(E.buildWalkPath(w,[{x:8,y:22},{x:16,y:22}]).ok,false);
 assert.equal(E.zoneCells(w,r.cells.map(i=>({x:i%48,y:Math.floor(i/48)})),'residential_low').changed,0);
 assert.equal(JSON.stringify(w),before);
});

test('facility validation rejects incomplete or conflicting ownership while preserving old one-cell saves',()=>{
 const w=fresh(),r=place(w);assert.ok(E.valid(w));
 const mutations=[
  a=>delete a.tiles[r.cells[1]].facilityOwner,
  a=>a.tiles[r.cells[1]].facilityOwner=r.owner+1,
  a=>a.tiles[r.cells[1]].building='clinic',
  a=>a.tiles[r.cells[1]].level=1,
  a=>a.tiles[r.cells[1]].people=1,
  a=>a.tiles[r.cells[1]].zone='residential_low',
  a=>a.tiles[r.cells[1]].ground='water',
  a=>a.tiles[r.cells[1]].pathIds=['intruder'],
  a=>a.tiles[r.cells[1]].walkPathIds=['intruder'],
  a=>a.tiles[r.cells[1]].facilitySite={...a.tiles[r.owner].facilitySite},
  a=>a.tiles[r.owner].facilitySite.width=3,
  a=>a.tiles[r.owner].facilitySite.rotation=1,
  a=>delete a.tiles[r.owner].facilitySite,
  a=>a.tiles[0].facilityOwner=r.owner
 ];
 for(const mutate of mutations){const a=copy(w);mutate(a);assert.equal(E.valid(a),false);assert.throws(()=>new E.WorldStore(memory()).save(a));}
 const legacy=fresh();Object.assign(legacy.tiles[23*48+5],{type:'hospital',building:'hospital',level:1});assert.ok(E.valid(legacy));
 const storage=memory(),store=new E.WorldStore(storage);store.save(legacy,100);const restored=new E.WorldStore(storage).get(legacy.id);assert.deepEqual(restored,copy(legacy));assert.deepEqual(E.facilityCells(restored,23*48+5),[23*48+5]);assert.equal(E.analyze(restored).connected.hospital,2.5);
});


test('perimeter-only road access matches every adjacent cell without corner or row-wrap connections',()=>{
 for(const rotation of [0,1,2,3]){
  const base=fresh(),r=place(base,'college',rotation,20,15),owned=new Set(r.cells);
  for(let y=Math.floor(r.owner/48)-1;y<=Math.floor(r.owner/48)+r.site.depth;y++)for(let x=r.owner%48-1;x<=r.owner%48+r.site.width;x++){
   const i=y*48+x;if(owned.has(i))continue;const w=copy(base);
   // Isolate one attached street from the rest, then connect it to the map edge
   // through an unobstructed row or column outside the footprint.
   const above=y<Math.floor(r.owner/48),below=y>=Math.floor(r.owner/48)+r.site.depth;
   if(above||below)E.buildRoad(w,{x:0,y},{x,y});else E.buildRoad(w,{x,y:0},{x,y});
   const a=E.analyze(w),expected=r.cells.some(j=>E.neighbors(j).some(n=>a.roads.has(n)));assert.equal(a.active.includes(r.owner),expected,`${rotation}: ${x},${y}`);
  }
 }
});
