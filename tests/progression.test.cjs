const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js'),P=E.Progression;
const city=()=>E.createWorld('Progression QA','plains',8,{progression:'milestones'});
const storage=()=>{let value=null;return {getItem(){return value},setItem(k,v){value=v}};};

test('every road, zone and building has an explicit milestone',()=>{
 for(const [catalogue,rules] of [[E.ROADS,P.ROADS],[E.ZONES,P.ZONES],[E.BUILDINGS,P.BUILDINGS]])for(const id of Object.keys(catalogue))assert.ok(Number.isInteger(rules[id])&&rules[id]>=0&&rules[id]<P.MILESTONES.length,id);
});
test('starting city can fund essentials and grow naturally to its first unlock',()=>{
 const w=city();assert.ok(E.place(w,1,23,'power',{building:'wind'}).ok);assert.ok(E.place(w,2,23,'water',{building:'watertower'}).ok);
 assert.ok(E.zoneCells(w,E.rectangleCells({x:4,y:21},{x:17,y:23}),'residential_low').ok);
 assert.ok(E.zoneCells(w,E.rectangleCells({x:4,y:25},{x:17,y:27}),'industrial').ok);
 for(let day=0;day<250&&w.progression.level===0;day++)E.tick(w);
 assert.ok(E.analyze(w).population>=100);assert.ok(w.progression.level>=1);assert.ok(w.money>0);assert.ok(E.valid(w));
 assert.ok(P.access(w,'hospital',{building:'clinic'}).ok);assert.equal(P.access(w,'hospital',{building:'hospital'}).ok,false);
});
test('locked construction cannot mutate money, roads, zoning or facilities',()=>{
 const w=city(),controls=[{x:10,y:24},{x:10,y:10}],before=JSON.stringify(w);
 const attempts=[()=>E.place(w,4,23,'school'),()=>E.facilityQuote(w,4,23,'school'),()=>E.buildRoadPath(w,controls,'highway'),()=>E.buildRoad(w,{x:3,y:10},{x:8,y:10},{roadWidth:2}),()=>E.buildRoadBatch(w,[controls,[{x:13,y:24},{x:13,y:10}]],'avenue'),()=>E.replaceRoad(w,'["legacy",1162]','highway'),()=>E.zoneCells(w,[{x:4,y:23}],'residential_high'),()=>E.fineZoneCells(w,['invalid'],'residential_medium'),()=>E.playerZoneCells(w,[{x:4,y:23}],'office')];
 for(const attempt of attempts){const result=attempt();assert.equal(result.ok,false);assert.match(result.reason,/Unlocks at/);assert.equal(JSON.stringify(w),before);}
});
test('thresholds pay each grant exactly once and never relock after population loss',()=>{
 const w=city(),start=w.money;let grants=0;
 for(let level=1;level<P.MILESTONES.length;level++){
  const m=P.MILESTONES[level];assert.deepEqual(P.advance(w,m.population-1),[]);assert.equal(w.progression.level,level-1);
  assert.deepEqual(P.advance(w,m.population),[m]);grants+=m.reward;assert.equal(w.money,start+grants);
  assert.deepEqual(P.advance(w,0),[]);assert.equal(w.progression.level,level);assert.ok(E.valid(w));
 }
 assert.equal(P.status(w,0).next,undefined);assert.equal(P.status(w,0).progress,1);
 for(const id of Object.keys(E.BUILDINGS))assert.ok(P.access(w,E.BUILDINGS[id].type,{building:id}).ok);
});
test('jumping milestones awards all grants and manual save, autosave and continue retain receipts per world',()=>{
 const db=new E.WorldStore(storage()),a=city(),b=city();const earned=P.advance(a,1200);assert.equal(earned.length,4);
 db.save(a,1000);db.save(b,2000);const session=new E.GameSession(db);session.start(a.id);
 const cash=session.world.money;assert.deepEqual(P.advance(session.world,1200),[]);assert.equal(session.world.money,cash);
 session.save(1000+E.AUTOSAVE_MS);session.exit(400000);session.start(b.id);assert.equal(session.world.progression.level,0);
 session.start(a.id);assert.equal(session.world.progression.level,4);assert.equal(session.world.money,cash);assert.equal(session.world.progression.peak,1200);
});
test('old cities remain unrestricted and can opt into progression without rewriting built assets or paying past grants',()=>{
 const w=E.createWorld('Existing','plains',9);assert.ok(E.buildRoadPath(w,[{x:10,y:24},{x:10,y:10}],'avenue').ok);assert.ok(E.place(w,4,23,'hospital',{building:'hospital'}).ok);
 const before=JSON.stringify(w.tiles),roads=JSON.stringify(w.roadPaths),money=w.money;P.initialize(w,'milestones',300);
 assert.equal(JSON.stringify(w.tiles),before);assert.equal(JSON.stringify(w.roadPaths),roads);assert.equal(w.money,money);assert.equal(w.progression.level,2);assert.ok(E.valid(w));
 assert.equal(P.access(w,'hospital',{building:'hospital'}).ok,false);assert.ok(P.access(w,'bulldoze').ok);
 const sandbox=E.createWorld('Sandbox','plains',1,{progression:'sandbox'});assert.ok(P.access(sandbox,'road',{roadType:'highway4'}).ok);assert.deepEqual(P.advance(sandbox,10000),[]);
});
test('corrupt progression records are rejected without overwriting stored cities',()=>{
 const db=new E.WorldStore(storage()),w=city();db.save(w);
 for(const patch of [{peak:-1},{peak:NaN},{peak:100,level:0},{level:9},{mode:'anything'},{version:2}]){
  const bad=structuredClone(w);Object.assign(bad.progression,patch);assert.equal(E.valid(bad),false);assert.throws(()=>db.save(bad));assert.deepEqual(db.get(w.id).progression,w.progression);
 }
});
test('locked replacement previews keep the panel contract and leave existing roads intact',()=>{
 const w=city(),target=E.roadZoningTargets(w,24*48+10)[0],before=JSON.stringify(w),quote=E.roadReplacementQuote(w,target.id,'highway');
 assert.equal(quote.ok,false);assert.deepEqual(quote.conflicts,[]);assert.match(quote.reason,/1,200 residents/);
 assert.equal(E.replaceRoad(w,target.id,'highway',{demolish:true}).ok,false);assert.equal(JSON.stringify(w),before);
});
