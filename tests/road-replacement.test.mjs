import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import R from '../dist/road-replacement.js';
import {Traffic} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';
import {Transit,createBusLine} from '../dist/transit.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
import {roadReplacementPanel} from '../dist/road-replacement-panel.js';
import {moveToRoute} from '../dist/route-progress.js';
const at=(x,y)=>y*48+x,key=p=>JSON.stringify(['path',p.id]);
function world(blank=false){const w=E.createWorld('Road replacement','plains',8);w.money=1e7;if(blank)for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});return w;}
function build(w,controls,type='street'){const r=E.buildRoadPath(w,controls,type);assert.ok(r.ok,r.reason);return r.path;}
function reserve(w,path,side=1,construction=false){const grid=E.fineZoningLayout(w),ids=[...grid.values()].filter(p=>p.source===path.id&&p.side===side&&p.col>5).map(p=>p.id);w.development ||= F.create();F.paint(w.development,grid,ids,'residential_medium');const p=[...grid.values()].find(p=>ids.includes(p.id)&&p.row===0&&F.proposal(w.development,grid,p.id,3,3));assert.ok(p);const lot=F.reserve(w.development,grid,p.id,3,3);lot.occupant={type:'residential',building:'apartments',density:'medium',level:1,people:construction?0:8,variant:0,...(construction?{construction:1}:{})};return lot;}

test('replacement handles every road type, preserves curves and policies, and charges the displayed amount',()=>{
 const w=world(true),p=build(w,[{x:8,y:28},{x:25,y:8},{x:39,y:28}]),controls=structuredClone(p.controls),id=p.id;E.setRoadZoning(w,key(p),'left');
 for(const type of ['avenue','green','boulevard','highway','oneway','alley','gravel','street']){const before=w.money,q=E.roadReplacementQuote(w,key(p),type),snapshot=JSON.stringify(w);assert.ok(q.ok,q.reason);assert.equal(JSON.stringify(w),snapshot);const r=E.replaceRoad(w,key(p),type);assert.ok(r.ok);assert.equal(w.money,before-q.cost);assert.equal(r.cost,q.cost);assert.equal(p.id,id);assert.equal(p.zoneSides,'left');assert.deepEqual(p.controls,controls);assert.equal(p.type,type);assert.deepEqual(new Set(p.tiles),new Set(R.footprint(controls,E.ROADS[type],E).tiles));assert.ok(p.tiles.every(i=>w.tiles[i].pathIds.includes(id)));assert.ok(E.valid(w));}
 assert.equal(w.roadEditRevision,8);
});

test('widening identifies whole occupied lots and cannot mutate anything until demolition is chosen',()=>{
 const w=world(true),p=build(w,[{x:8,y:24},{x:39,y:24}]),home=reserve(w,p),construction=reserve(w,p,-1,true),before=JSON.stringify(w),q=E.roadReplacementQuote(w,key(p),'boulevard');assert.equal(q.ok,false);assert.deepEqual(new Set(q.conflicts.map(c=>c.id)),new Set([home.id,construction.id]));assert.equal(q.residentsAffected,8);assert.equal(E.replaceRoad(w,key(p),'boulevard').ok,false);assert.equal(JSON.stringify(w),before);
 const funds=w.money,r=E.replaceRoad(w,key(p),'boulevard',{demolish:true});assert.ok(r.ok);assert.equal(w.money,funds-q.cost);assert.deepEqual(new Set(r.removed),new Set([home.id,construction.id]));assert.equal(Object.keys(w.development.parcels).length,0);assert.ok(Object.values(w.development.cells).every(c=>!c.owner));assert.ok(E.valid(w));
});

test('narrowing preserves saved apartments, residents and geometry and restores replacement state through saves',()=>{
 const w=world(),p=build(w,[{x:19,y:24},{x:39,y:24}],'avenue'),home=reserve(w,p),saved=structuredClone(home),population=E.analyze(w).population;const r=E.replaceRoad(w,key(p),'street');assert.ok(r.ok,r.reason);assert.deepEqual(home,saved);assert.equal(E.analyze(w).population,population);assert.ok(E.analyze(w).active.includes(home.id));
 let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v},store=new E.WorldStore(storage);store.save(w,1);const session=new E.GameSession(new E.WorldStore(storage));session.start(w.id);session.exit(2);const restored=new E.WorldStore(storage).get(w.id);assert.equal(restored.roadPaths[0].type,'street');assert.equal(restored.roadEditRevision,1);assert.deepEqual(restored.development,w.development);for(const bad of [-1,.5,'1']){restored.roadEditRevision=bad;assert.equal(E.valid(restored),false);}
});

test('insufficient money, same type, missing targets and invalid types leave the full world untouched',()=>{
 const w=world(true),p=build(w,[{x:8,y:20},{x:38,y:20}]);reserve(w,p);w.money=1;for(const [id,type,options]of [[key(p),'highway',{demolish:true}],[key(p),'street',{}],['missing','avenue',{}],[key(p),'invalid',{}]]){const before=JSON.stringify(w);assert.equal(E.replaceRoad(w,id,type,options).ok,false);assert.equal(JSON.stringify(w),before);}
});

test('legacy replacement retains occupied parcels, migrates painted cells and keeps the outside connection',()=>{
 const w=world(),t=E.roadZoningTargets(w,at(8,24))[0],grid=E.fineZoningLayout(w);E.fineZoneCells(w,[...grid.values()].filter(c=>c.cx>-74&&c.cx<-35).map(c=>c.id),'residential_medium');const first=[...grid.values()].find(c=>c.row===0&&F.proposal(w.development,grid,c.id,3,3)),p=F.reserve(w.development,grid,first.id,3,3);p.occupant={type:'residential',building:'apartments',density:'medium',level:1,people:8,variant:0};const saved=structuredClone(p),pop=E.analyze(w).population;
 const r=E.replaceRoad(w,t.id,'alley');assert.ok(r.ok,r.reason);assert.deepEqual(p,saved);assert.equal(E.analyze(w).population,pop);assert.ok(E.analyze(w).active.includes(p.id));assert.ok(w.tiles[at(0,24)].type==='road');assert.ok(r.path.tiles.includes(at(0,24)));assert.ok([...E.fineZoningLayout(w)].some(([id,c])=>c.source===r.path.id&&w.development.cells[id]?.zone==='residential_medium'));assert.ok(E.valid(w));
});

test('legacy replacement honors side-policy boundaries and retains crossing streets and their ownership',()=>{
 const w=world(true);for(let x=5;x<=30;x++)E.place(w,x,20,'road');for(let y=8;y<32;y++)E.place(w,18,y,'road');for(let x=5;x<11;x++)w.tiles[at(x,20)].zoneSides='left';
 const t=E.roadZoningTargets(w,at(7,20))[0],q=E.roadReplacementQuote(w,t.id,'avenue');assert.ok(q.ok);assert.deepEqual(q.target.tiles,Array.from({length:6},(_,n)=>at(n+5,20)));const r=E.replaceRoad(w,t.id,'avenue');assert.ok(r.ok);assert.equal(r.path.zoneSides,'left');assert.equal(w.tiles[at(14,20)].pathIds,undefined);assert.equal(w.tiles[at(18,20)].type,'road');assert.ok(E.valid(w));
 const crossing=build(w,[{x:18,y:8},{x:35,y:28}]);const ids=[...w.tiles[at(18,8)].pathIds];E.replaceRoad(w,key(crossing),'gravel');assert.deepEqual(w.tiles[at(18,8)].pathIds,ids);assert.equal(w.tiles[at(18,8)].legacyRoad,true);
});

test('replacement collision detection removes a whole service site only after the explicit choice',()=>{
 const w=world(true),p=build(w,[{x:4,y:20},{x:40,y:20}]);assert.ok(E.place(w,12,22,'hospital').ok);const owner=at(12,21),q=E.roadReplacementQuote(w,key(p),'highway');assert.ok(q.conflicts.some(c=>c.id===owner));assert.equal(q.ok,false);const r=E.replaceRoad(w,key(p),'highway',{demolish:true});assert.ok(r.ok);for(const i of [owner,owner+1,owner+48,owner+49])assert.equal(w.tiles[i].facilityOwner,undefined);assert.ok(E.valid(w));
});

test('bridge replacement rebuilds its width, charges water construction and remains connected',()=>{
 const w=world(true);for(let y=0;y<48;y++)for(let x=18;x<=22;x++)w.tiles[at(x,y)].ground='water';const p=build(w,[{x:0,y:24},{x:40,y:24}]);const q=E.roadReplacementQuote(w,key(p),'boulevard'),dry=structuredClone(w);dry.tiles.forEach(t=>t.ground='land');assert.ok(q.cost>E.roadReplacementQuote(dry,key(p),'boulevard').cost);assert.ok(E.replaceRoad(w,key(p),'boulevard').ok);assert.equal(roadGeometry(w,E).roads.find(r=>r.id===p.id).spec.width,E.ROADS.boulevard.width);const traffic=new Traffic(w,E);assert.ok(traffic.trace(traffic.search(at(0,24)),at(40,24)));assert.ok(E.valid(w));
});

function trafficWorld(){const w=world(true),p=build(w,[{x:0,y:24},{x:46,y:24}],'avenue');for(const [x,type,building]of [[8,'residential','cottage'],[30,'office','business'],[38,'commercial','shops'],[4,'bus','bus']])Object.assign(w.tiles[at(x,23)],{type,building,level:1,people:type==='residential'?6:0,density:'low'});const traffic=new Traffic(w,E);traffic.residentsEnabled=true;for(let i=0;i<32;i++)traffic.addAgent();return {w,p,traffic};}
test('replacement retargets moving residents onto new lanes without losing their journey or restarting it',()=>{
 const {w,p,traffic}=trafficWorld(),residents=new Residents(w,traffic);for(let n=0;n<600;n++){traffic.update(.05);residents.update(.05);}const travelling=[...residents.agents].filter(([,a])=>a.active);assert.ok(travelling.length);const before=travelling.map(([id,a])=>({id,agent:a,x:a.x,z:a.z,trip:structuredClone(w.citizens.residents.find(r=>r.id===id).trip)}));const replacement=E.replaceRoad(w,key(p),'street');assert.ok(replacement.ok,replacement.reason);traffic.rebuild(w);residents.reconcile();
 for(const old of before){const a=residents.agents.get(old.id),person=w.citizens.residents.find(r=>r.id===old.id);assert.equal(a,old.agent);assert.equal(a.active,true);assert.equal(person.trip.from,old.trip.from);assert.equal(person.trip.to,old.trip.to);assert.equal(person.trip.purpose,old.trip.purpose);assert.ok(Math.hypot(a.x-old.x,a.z-old.z)<2);}
 const atBefore=before[0].agent.x;for(let n=0;n<50;n++){traffic.update(.05);residents.update(.05);}assert.notEqual(before[0].agent.x,atBefore);assert.ok(E.valid(w));
});

test('a moving bus retains its line, vehicle, progress and passengers when road lanes change',()=>{
 const {w,p,traffic}=trafficWorld();const created=createBusLine(w,traffic,[at(10,24),at(30,24)]);assert.ok(created.ok,created.reason);const transit=new Transit(w,traffic),residents=new Residents(w,traffic,transit);for(let n=0;n<5000&&!transit.summary.riding;n++){traffic.update(.05);transit.update(.05);residents.update(.05);}assert.ok(transit.summary.riding>0);const assignments=()=>residents.state.residents.filter(r=>r.transit?.phase==='ride').map(r=>({id:r.id,line:r.transit.line,from:r.transit.from,to:r.transit.to,phase:r.transit.phase})),riders=assignments(),completed=created.line.completed;const entry=transit.entries.get(created.line.id),agent=entry.agent,before={x:agent.x,z:agent.z,leg:entry.line.vehicle.leg,phase:entry.line.vehicle.phase};assert.ok(agent.active);assert.ok(E.replaceRoad(w,key(p),'street').ok);traffic.rebuild(w);transit.rebuild();assert.equal(entry.agent,agent);assert.ok(agent.active);assert.equal(entry.line.vehicle.leg,before.leg);assert.equal(entry.line.vehicle.phase,before.phase);assert.ok(Math.hypot(agent.x-before.x,agent.z-before.z)<2);assert.deepEqual(agent.points,entry.line.vehicle.leg<0?entry.plan.entry.points:entry.plan.legs[entry.line.vehicle.leg].points);assert.deepEqual(assignments(),riders);for(let n=0;n<6000&&created.line.completed<=completed;n++){traffic.update(.05);transit.update(.05);residents.update(.05);}assert.ok(created.line.completed>completed);assert.ok(E.valid(w));
});

test('route reprojection preserves identity and speed and follows the nearest segment',()=>{
 const a={x:8,z:1,speed:4,residentId:3},points=[{x:0,z:0},{x:10,z:0},{x:10,z:10}];assert.ok(moveToRoute(a,points));assert.equal(a.segment,0);assert.equal(a.distance,8);assert.equal(a.x,8);assert.equal(a.z,0);assert.equal(a.speed,4);assert.equal(a.residentId,3);assert.equal(moveToRoute(a,[]),false);
});

test('replacement panel previews costs, requires the demolition choice and rechecks a changed city',()=>{
 const old=globalThis.document;class Element{constructor(tag){this.tagName=tag;this.children=[];this.checked=false;this.classList={toggle(){}};}append(...c){this.children.push(...c);}setAttribute(k,v){this[k]=v;}}
 globalThis.document={createElement:tag=>new Element(tag)};try{const w=world(true),p=build(w,[{x:8,y:24},{x:39,y:24}]);reserve(w,p);const previews=[],results=[],panel=roadReplacementPanel(E,w,at(20,24),{initialType:'boulevard',onPreview:q=>previews.push(q),onApply:r=>results.push(r),onError:reason=>assert.fail(reason)}),all=panel.children.flatMap(c=>[c,...c.children]),checkbox=all.find(e=>e.id==='replacementDemolish'),button=all.find(e=>e.id==='applyRoadReplacement');assert.ok(button.disabled);assert.equal(previews.at(-1).conflicts.length,1);checkbox.checked=true;checkbox.onchange();assert.equal(button.disabled,false);reserve(w,p,-1);button.onclick();assert.equal(results.length,0);assert.equal(previews.at(-1).conflicts.length,2);button.onclick();assert.equal(results.length,1);assert.equal(results[0].removed.length,2);assert.ok(E.valid(w));}finally{globalThis.document=old;}
});

test('one-way replacement applies to its own direction without turning a crossing street into one-way traffic',()=>{
 const w=world(true),horizontal=build(w,[{x:5,y:24},{x:42,y:24}]),vertical=build(w,[{x:24,y:5},{x:24,y:42}]);assert.ok(E.replaceRoad(w,key(horizontal),'oneway').ok);const traffic=new Traffic(w,E),center=at(24,24);assert.ok(traffic.graph.get(center).includes(center+1));assert.equal(traffic.graph.get(center).includes(center-1),false);assert.ok(traffic.graph.get(center).includes(center+48));assert.ok(traffic.graph.get(center).includes(center-48));assert.equal(vertical.type,'street');assert.ok(traffic.trace(traffic.search(at(24,40)),at(24,8)));
});
