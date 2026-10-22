import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';

function world(){const w=E.createWorld('Roadside zoning','plains',8);w.money=1e6;return w;}
test('roadside strips start at the sidewalk and stay on the anchored side around curves',()=>{
 const w=world(),road=E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]).path,grid=E.fineZoningLayout(w);
 for(const side of [-1,1]){
  const cells=[...grid.values()].filter(p=>p.source===road.id&&p.side===side),a=cells.find(p=>p.row===2),b=cells.filter(p=>p.row===4).at(-1);
  assert.ok(a&&b);for(const depth of [2,3,6]){
   const strip=E.fineZoneStrip(w,a,b,depth),expected=cells.filter(p=>p.col>=a.col&&p.col<=b.col&&p.row<depth);
   assert.deepEqual(new Set(strip),new Set(expected.map(p=>p.id)));assert.deepEqual(new Set(E.fineZoneStrip(w,b,a,depth)),new Set(strip));
   assert.ok(strip.some(id=>grid.get(id).row===0));assert.ok(new Set(strip.map(id=>grid.get(id).angle.toFixed(2))).size>2);
  }
  const across=[...grid.values()].find(p=>p.source===road.id&&p.side===-side);
  assert.ok(E.fineZoneStrip(w,a,across,3).every(id=>grid.get(id).side===side));
 }
});
test('new lots consume the painted depth instead of stranding back cells',()=>{
 for(const zone of ['residential_low','residential_row','residential_medium','residential_mixed','residential_high','residential_lowrent'])for(const depth of [4,5,6]){
  const w=world(),grid=E.fineZoningLayout(w),a=[...grid.values()].find(p=>p.row===0&&p.side===-1&&p.cx>-70),b=grid.get(JSON.stringify([a.source,a.side,a.col+23,0]));assert.ok(b);
  const ids=E.fineZoneStrip(w,a,b,depth);E.fineZoneCells(w,ids,zone);const plans=E.fineZonePlan(w),claimed=plans.flatMap(p=>p.cells);
  assert.deepEqual(new Set(claimed),new Set(ids),zone+' depth '+depth);assert.equal(claimed.length,new Set(claimed).size);assert.ok(plans.every(p=>p.depth===depth&&p.cells.length>1));
 }
});
test('small painted rectangles become single buildings with the selected depth',()=>{
 for(const [zone,width,depth]of [['residential_low',2,3],['residential_low',2,6],['residential_medium',2,5],['residential_high',3,6],['residential_lowrent',4,5],['residential_mixed',3,4]]){
  const w=world(),grid=E.fineZoningLayout(w),a=[...grid.values()].find(p=>p.row===0&&p.side===-1&&p.cx>-60),b=grid.get(JSON.stringify([a.source,a.side,a.col+width-1,depth-1]));
  const ids=E.fineZoneRectangle(w,a,b);E.fineZoneCells(w,ids,zone);const plans=E.fineZonePlan(w);
  assert.equal(plans.length,1);assert.equal(plans[0].width,width);assert.equal(plans[0].depth,depth);assert.equal(plans[0].cells.length,ids.length);
  E.place(w,1,23,'power');E.place(w,2,23,'water');for(let i=0;i<100;i++)E.tick(w);
  assert.equal(Object.keys(w.development.parcels).length,1);assert.ok(E.valid(JSON.parse(JSON.stringify(w))));
 }
});
test('saved occupied parcels retain their exact boundaries when new frontage develops',()=>{
 const w=world(),grid=E.fineZoningLayout(w),ids=[...grid.keys()];E.fineZoneCells(w,ids,'residential_low');
 const start=[...grid.values()].find(p=>p.row===0&&p.cx>-60),old=F.reserve(w.development,grid,start.id,2,2);assert.ok(old);
 old.occupant={type:'residential',building:'cottage',density:'low',people:4,level:1,variant:0};const before=JSON.stringify(old);
 E.fineZonePlan(w);assert.equal(JSON.stringify(old),before);const restored=JSON.parse(JSON.stringify(w));E.fineZonePlan(restored);assert.equal(JSON.stringify(restored.development.parcels[old.id]),before);assert.ok(E.valid(restored));
});
test('drag hit testing remains attached to the starting frontage outside the cell grid',async()=>{
 const {CityView}=await import('../dist/renderer.js'),w=world(),grid=E.fineZoningLayout(w),anchor=[...grid.values()].find(p=>p.row===0&&p.side===-1&&p.cx>-60),previous=globalThis.CityEngine;globalThis.CityEngine=E;
 try{const view={world:w,point:{x:-30,z:35},getTile:()=>({x:16,y:32})};const hit=CityView.prototype.getZoneDragTile.call(view,0,0,anchor);assert.ok(hit);const cell=grid.get(hit.id);assert.equal(cell.source,anchor.source);assert.equal(cell.side,anchor.side);assert.equal(cell.row,0);view.getTile=()=>null;assert.equal(CityView.prototype.getZoneDragTile.call(view,0,0,anchor),null);}finally{globalThis.CityEngine=previous;}
});

test('the depth offered for every zone permits development and shallower strips do not',()=>{
 for(const [id,zone] of Object.entries(E.ZONES)){
  const minimum=E.fineLotMinimumDepth(zone);assert.ok(minimum>=2&&minimum<=4);
  for(const depth of [minimum-1,minimum]){
   const w=world(),grid=E.fineZoningLayout(w),a=[...grid.values()].find(p=>p.row===0&&p.side===-1&&p.cx>-60),b=grid.get(JSON.stringify([a.source,a.side,a.col+11,depth-1]));
   E.fineZoneCells(w,E.fineZoneRectangle(w,a,b),id);const plans=E.fineZonePlan(w);
   assert.equal(plans.length>0,depth===minimum,id+' at '+depth+' cells deep');
  }
 }
 assert.equal(E.fineLotMinimumDepth(E.ZONES.residential_lowrent),4);
});

test('live lot previews match committed road-facing lots for all six housing types without changing the world',()=>{
 for(const zone of Object.keys(E.ZONES).filter(id=>id.startsWith('residential_'))){
  const w=world();E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);const grid=E.fineZoningLayout(w),ids=[...grid.values()].filter(p=>!p.source.startsWith('legacy')&&p.side===-1&&p.row<4).map(p=>p.id),saved=JSON.stringify(w),preview=E.fineZonePreview(w,ids,zone);
  assert.ok(preview.lots.length,zone);assert.ok(preview.lots.every(p=>p.cells.length>1));assert.equal(JSON.stringify(w),saved);assert.equal(E.fineZonePreview(w,ids,zone),preview,'unchanged drags reuse their plan');
  E.fineZoneCells(w,ids,zone);assert.deepEqual(preview.lots,E.fineZonePlan(w));const used=new Set(preview.lots.flatMap(p=>p.cells));assert.deepEqual(preview.unbuildable,ids.filter(id=>!used.has(id)));assert.deepEqual(preview.blocked,[]);
  assert.notEqual(E.fineZonePreview(w,ids,zone),preview,'painting invalidates preview');
 }
});
test('preview combines new cells with existing zoning and warns about isolated single cells',()=>{
 const w=world(),grid=E.fineZoningLayout(w),a=[...grid.values()].find(p=>p.row===0&&p.side===-1&&p.cx>-60),cell=(col,row)=>JSON.stringify([a.source,a.side,a.col+col,row]);
 const one=E.fineZonePreview(w,[a.id],'residential_low');assert.equal(one.lots.length,0);assert.deepEqual(one.unbuildable,[a.id]);
 E.fineZoneCells(w,[cell(0,0),cell(1,0),cell(0,1)],'residential_low');const saved=JSON.stringify(w),preview=E.fineZonePreview(w,[cell(1,1)],'residential_low');assert.equal(preview.lots.length,1);assert.equal(preview.lots[0].cells.length,4);assert.equal(preview.unbuildable.length,0);assert.equal(JSON.stringify(w),saved);
});
test('rezoning and erasing previews preserve occupied homes and only virtually release construction',()=>{
 for(const construction of [false,true])for(const zone of ['residential_medium','erase']){
  const w=world(),grid=E.fineZoningLayout(w);E.fineZoneCells(w,[...grid.keys()],'residential_low');const first=E.fineZonePlan(w)[0],parcel=F.reserve(w.development,grid,first.startId,first.width,first.depth);parcel.occupant={type:'residential',density:'low',building:'cottage',level:1,people:0,variant:0,...(construction?{construction:1}:{} )};const ids=parcel.cells.slice(),saved=JSON.stringify(w),preview=E.fineZonePreview(w,ids,zone);
  assert.equal(JSON.stringify(w),saved);assert.equal(preview.blocked.length,construction?0:ids.length);
  E.fineZoneCells(w,ids,zone);const selection=new Set(ids),plans=zone==='erase'?[]:E.fineZonePlan(w).filter(p=>p.cells.some(id=>selection.has(id)));assert.deepEqual(preview.lots,plans);assert.ok(E.valid(w));
 }
});
