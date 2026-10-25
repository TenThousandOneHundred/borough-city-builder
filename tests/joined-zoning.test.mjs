import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';

function district(){
 // Road IDs participate in parcel variation; keep this regression reproducible.
 let nextId=0;const ids=mock.method(globalThis.crypto,'randomUUID',()=>`joined-zoning-fixture-${nextId++}`);
 try{
 const world=E.createWorld('Joined zoning','plains',8);world.money=1e7;
 const paths=[[[19,24],[28,24]],[[28,24],[33,24],[36,19]],[[42,14],[36,19]]].map(points=>{
  const result=E.buildRoadPath(world,points.map(([x,y])=>({x,y})));assert.ok(result.ok,result.reason);return result.path;
 });
 return {world,paths};
 }finally{ids.mock.restore();}
}
function frontage(world,source,side){return [...E.fineZoningLayout(world).values()].filter(p=>p.source===source&&p.side===side&&p.row===0).sort((a,b)=>a.col-b.col);}

test('one strip follows joined straight, curved and reverse-drawn streets on both physical sides',()=>{
 for(const side of [-1,1]){
  const {world:w,paths}=district(),grid=E.fineZoningLayout(w),a=frontage(w,paths[0].id,side)[3],b=frontage(w,paths[2].id,-side)[3],before=JSON.stringify(w);
  assert.ok(a&&b);
  for(const depth of [2,4,6]){
   const ids=E.fineZoneStrip(w,a,b,depth),points=ids.map(id=>grid.get(id));
   assert.deepEqual(new Set(points.map(p=>p.source)),new Set(paths.map(p=>p.id)));
   assert.ok(points.every(p=>p.side===(p.source===paths[2].id?-side:side)&&p.row<depth));
   assert.ok(points.filter(p=>p.source===a.source).every(p=>p.col>=a.col));
   assert.ok(points.filter(p=>p.source===b.source).every(p=>p.col>=b.col));
   assert.deepEqual(new Set(E.fineZoneStrip(w,b,a,depth)),new Set(ids),'reverse drag covers the same land');
  }
  const hit=E.fineZoneDragPoint(w,a,b.cx,b.cz);assert.equal(hit.id,b.id);
  assert.equal(JSON.stringify(w),before,'hover and selection do not change saves');
 }
});

test('starter street extensions join the original frontage and refresh after demolition',()=>{
 const {world:w,paths}=district(),a=frontage(w,'legacy-h-24',-1).at(-8),b=frontage(w,paths[1].id,-1).at(-4);
 const before=E.fineZoneStrip(w,a,b,3);assert.ok(before.some(id=>JSON.parse(id)[0]===paths[1].id));
 E.removeRoadPath(w,paths[0].id);
 const hit=E.fineZoneDragPoint(w,a,b.cx,b.cz);assert.equal(hit.source,a.source);
 const after=E.fineZoneStrip(w,a,b,3);assert.ok(after.every(id=>JSON.parse(id)[0]===a.source));
});

test('a T junction follows the straight street and an equal fork stops at the junction',()=>{
 const w=E.createWorld('Junction zoning','plains',8);w.money=1e7;
 const build=points=>{const r=E.buildRoadPath(w,points.map(([x,y])=>({x,y})));assert.ok(r.ok,r.reason);return r.path;};
 const approach=build([[19,24],[28,24]]),straight=build([[28,24],[38,24]]),branch=build([[28,24],[28,12]]);
 const a=frontage(w,approach.id,-1)[2],b=frontage(w,straight.id,-1).at(-3),branchEnd=frontage(w,branch.id,1).at(-3);
 const selected=E.fineZoneStrip(w,a,b,3);assert.ok(selected.some(id=>JSON.parse(id)[0]===straight.id));assert.ok(selected.every(id=>JSON.parse(id)[0]!==branch.id));
 assert.notEqual(E.fineZoneDragPoint(w,a,branchEnd.cx,branchEnd.cz).source,branch.id);
 E.removeRoadPath(w,straight.id);E.removeRoadPath(w,branch.id);
 const left=build([[28,24],[38,14]]);build([[28,24],[38,34]]);
 const far=frontage(w,left.id,-1).at(-2);assert.equal(E.fineZoneDragPoint(w,a,far.cx,far.cz).source,approach.id);
});

test('disconnected parallel roads and highways never become a zoning continuation',()=>{
 const {world:w,paths}=district();const near=E.buildRoadPath(w,[{x:19,y:30},{x:40,y:30}]).path;
 const a=frontage(w,paths[0].id,1)[2],b=frontage(w,near.id,-1).at(-2);
 assert.notEqual(E.fineZoneDragPoint(w,a,b.cx,b.cz).source,near.id);
 const highway=E.buildRoadPath(w,[{x:42,y:14},{x:42,y:5}],'highway');assert.ok(highway.ok);
 assert.ok([...E.fineZoningLayout(w).values()].every(p=>p.source!==highway.path.id));
});

test('joined-street previews grow distinct multi-cell housing lots and retain them on save reload',()=>{
 for(const [zone,building]of [['residential_low','cottage'],['residential_row','townhouse'],['residential_medium','apartments'],['residential_mixed','mixeduse'],['residential_lowrent','lowrent'],['residential_high','tower']]){
  const {world:w,paths}=district();E.place(w,1,23,'power');E.place(w,2,23,'water');
  const grid=E.fineZoningLayout(w),a=frontage(w,paths[0].id,1)[2],b=frontage(w,paths[2].id,-1)[2],ids=E.fineZoneStrip(w,a,b,4),preview=E.fineZonePreview(w,ids,zone),saved=JSON.stringify(w);
  assert.ok(preview.lots.length>2,zone);assert.ok(preview.lots.every(p=>p.cells.length>1&&p.depth>=E.fineLotMinimumDepth(E.ZONES[zone])));
  assert.equal(JSON.stringify(w),saved);E.fineZoneCells(w,ids,zone);assert.deepEqual(E.fineZonePlan(w),preview.lots);
  for(let i=0;i<160;i++)E.tick(w);
  const lots=Object.values(w.development.parcels);assert.ok(lots.length>2,zone);
  for(const p of lots){assert.equal(p.occupant.building,building);assert.equal(p.cells.length,p.width*p.depth);assert.ok(p.cells.every(id=>w.development.cells[id].owner===p.id));assert.equal(p.frame.angle,grid.get(p.cells[0]).angle);}
  for(let i=0;i<lots.length;i++)for(let j=0;j<i;j++)assert.equal(Z.overlaps(lots[i].frame,lots[j].frame),false);
  const restored=JSON.parse(JSON.stringify(w));assert.ok(E.valid(restored));assert.deepEqual(restored.development,w.development);
 }
});

test('closed street loops terminate and return a bounded selection',()=>{
 const w=E.createWorld('Loop zoning','plains',8);w.money=1e7;
 const paths=[[[20,14],[32,14]],[[32,14],[32,5]],[[32,5],[20,5]],[[20,5],[20,14]]].map(points=>E.buildRoadPath(w,points.map(([x,y])=>({x,y}))).path);
 const a=frontage(w,paths[0].id,1)[2],b=frontage(w,paths[2].id,1)[2],ids=E.fineZoneStrip(w,a,b,3);
 assert.ok(ids.length>20);assert.equal(ids.length,new Set(ids).size);assert.ok(ids.length<=E.fineZoningLayout(w).size);
});

test('rectangle and brush follow joined bends instead of cutting through the block',()=>{
 for(const side of [-1,1]){
  const {world:w,paths}=district(),layout=E.fineZoningLayout(w),a=frontage(w,paths[0].id,side)[3],b=frontage(w,paths[2].id,-side)[3];
  const deep=layout.get(JSON.stringify([b.source,b.side,b.col,3]));assert.ok(deep);
  const saved=JSON.stringify(w),rectangle=E.fineZoneRectangle(w,a,deep),strip=E.fineZoneStrip(w,a,b,4);
  assert.deepEqual(new Set(rectangle),new Set(strip),'rectangle must follow the selected street, even where it leaves the world-axis rectangle');
  assert.deepEqual(new Set(E.fineZoneRectangle(w,deep,a)),new Set(rectangle));
  for(const size of [1,2,4]){
   const stroke=E.fineZoneStroke(w,a,b,size),expected=new Set();
   for(const id of E.fineZoneStrip(w,a,b,1))for(const cell of E.fineZoneBrush(w,layout.get(id),size))expected.add(cell);
   assert.deepEqual(new Set(stroke),expected);
   assert.deepEqual(new Set(E.fineZoneStroke(w,b,a,size)),expected,'reverse-drawn streets and reverse drags cover the same cells');
   assert.ok(stroke.every(id=>layout.get(id).side===(layout.get(id).source===paths[2].id?-side:side)));
  }
  assert.equal(JSON.stringify(w),saved,'selection is read only');
 }
});

test('block fill crosses a road drawing seam but stops at painted bands and crossing streets',()=>{
 const w=E.createWorld('Fill joined blocks','plains',8);w.money=1e7;
 const build=points=>{const r=E.buildRoadPath(w,points.map(([x,y])=>({x,y})));assert.ok(r.ok,r.reason);return r.path;};
 const a=build([[19,24],[29,24]]),b=build([[39,24],[29,24]]);
 for(const side of [-1,1]){
  const first=frontage(w,a.id,side)[5],fill=E.fineZoneFill(w,first),layout=E.fineZoningLayout(w);
  assert.ok(fill.some(id=>layout.get(id).source===b.id),'fill continues across reverse-drawn extension');
  assert.ok(fill.every(id=>layout.get(id).side===(layout.get(id).source===b.id?-side:side)));
 }
 let layout=E.fineZoningLayout(w);const first=frontage(w,b.id,1).at(-2),barrier=frontage(w,b.id,1)[5];
 E.fineZoneCells(w,[...layout.values()].filter(p=>p.source===b.id&&p.side===1&&p.col===barrier.col).map(p=>p.id),'commercial_low');
 const blocked=E.fineZoneFill(w,first);assert.ok(blocked.every(id=>{const p=layout.get(id);return p.source!==b.id||p.col>barrier.col;}));
 E.fineZoneCells(w,Object.keys(w.development.cells),'erase');
 build([[29,24],[29,12]]);layout=E.fineZoningLayout(w);
 const cut=E.fineZoneFill(w,frontage(w,a.id,-1)[3]);assert.ok(cut.every(id=>layout.get(id).source!==b.id),'fill must stop at the cross street');
});

test('joined rectangle produces varied multi-cell homes, retains all six housing forms, and saves exact footprints',()=>{
 for(const zone of Object.keys(E.ZONES).filter(key=>key.startsWith('residential_'))){
  const {world:w,paths}=district();E.place(w,1,23,'power');E.place(w,2,23,'water');
  const layout=E.fineZoningLayout(w),a=frontage(w,paths[0].id,1)[2],end=frontage(w,paths[2].id,-1)[2],b=layout.get(JSON.stringify([end.source,end.side,end.col,5]));assert.ok(b);
  const ids=E.fineZoneRectangle(w,a,b),preview=E.fineZonePreview(w,ids,zone);
  assert.ok(preview.lots.length>4);assert.ok(preview.lots.every(p=>p.cells.length>1));
  E.fineZoneCells(w,ids,zone);assert.deepEqual(E.fineZonePlan(w),preview.lots);
  for(let n=0;n<140;n++)E.tick(w);
  const lots=Object.values(w.development.parcels);assert.ok(lots.length>3);assert.ok(new Set(lots.map(p=>p.width+'x'+p.depth)).size>1);
  assert.ok(lots.every(p=>p.zone===zone&&p.cells.length===p.width*p.depth&&p.frame.angle===layout.get(p.cells[0]).angle));
  const storage={value:null,getItem(){return this.value;},setItem(key,value){this.value=value;}};
  const store=new E.WorldStore(storage);store.save(w);const restored=new E.WorldStore(storage).get(w.id);
  assert.deepEqual(restored.development,w.development);assert.ok(E.valid(restored));
 }
});
