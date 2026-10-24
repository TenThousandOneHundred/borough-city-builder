import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import B from '../dist/building-entities.js';

function curve(points=[[19,24],[34,12],[42,25]],type='street'){
 const world=E.createWorld('Curve zoning','plains',8);world.money=1e7;
 const road=E.buildRoadPath(world,points.map(([x,y])=>({x,y})),type);assert.ok(road.ok,road.reason);
 const oldId=road.path.id;road.path.id='curve-zoning-106';for(const tile of world.tiles)if(tile.pathIds)tile.pathIds=tile.pathIds.map(id=>id===oldId?road.path.id:id);
 return {world,path:road.path,grid:E.fineZoningLayout(world)};
}
test('curve blocks retain usable frontage on both sides instead of narrow isolated spokes',()=>{
 for(const points of [[[28,24],[33,24],[36,19]],[[19,24],[34,12],[42,25]],[[12,24],[25,5],[39,24]]]){
  const {world,path,grid}=curve(points),sides=[-1,1].map(side=>[...grid.values()].filter(p=>p.source===path.id&&p.side===side));
  assert.ok(Math.min(...sides.map(c=>c.filter(p=>!p.row).length))/Math.max(...sides.map(c=>c.filter(p=>!p.row).length))>.75);
  for(const cells of sides){
   const copy=structuredClone(world);E.fineZoneCells(copy,cells.map(p=>p.id),'residential_medium');const plans=E.fineZonePlan(copy);
   assert.ok(plans.reduce((n,p)=>n+p.cells.length,0)/cells.length>.65,'usable rectangular apartment lots on either side');
   assert.ok(plans.every(p=>p.cells.length>=4&&p.frame.frontage.pathId===path.id));
  }
 }
});
test('corrected curved grids clear roads and each other across street widths and reverse drawing',()=>{
 for(const type of ['street','avenue','boulevard'])for(const reverse of [false,true]){
  const points=[[19,24],[34,12],[42,25]],{world,path,grid}=curve(reverse?points.reverse():points,type),cells=[...grid.values()].filter(p=>p.source===path.id),samples=E.sampleRoad(path.controls);
  for(let i=0;i<cells.length;i++){
   for(let j=0;j<i;j++)assert.equal(Z.overlaps(cells[i],cells[j]),false);
   for(let j=1;j<samples.length;j++){const a=samples[j-1],b=samples[j],dx=(b.x-a.x)*4,dz=(b.y-a.y)*4;
    assert.equal(Z.overlaps(cells[i],{cx:(a.x+b.x+1)*2-96,cz:(a.y+b.y+1)*2-96,angle:Math.atan2(-dz,dx),width:Math.hypot(dx,dz),depth:E.ROADS[type].width+.6}),false);
   }
  }
 }
});
test('all six housing forms grow as multi-cell parcels on curves and keep ownership after saving',()=>{
 for(const [zone,building,depth]of [['residential_low','cottage',3],['residential_row','townhouse',3],['residential_medium','apartments',4],['residential_mixed','mixeduse',4],['residential_lowrent','lowrent',6],['residential_high','tower',6]]){
  const {world,path,grid}=curve();E.place(world,1,23,'power');E.place(world,2,23,'water');
  const ids=[...grid.values()].filter(p=>p.source===path.id&&p.row<depth).map(p=>p.id);E.fineZoneCells(world,ids,zone);
  for(let i=0;i<140;i++)E.tick(world);
  const lots=Object.values(world.development.parcels).filter(p=>p.occupant&&!p.occupant.construction);assert.ok(lots.length>3,zone);
  assert.ok(new Set(lots.map(p=>p.width+'x'+p.depth)).size>1,zone+' has varied lot sizes');
  assert.ok(lots.every(p=>p.cells.length>1&&p.occupant.building===building&&p.frame.frontage.pathId===path.id));
  const storage={data:null,getItem(){return this.data;},setItem(k,v){this.data=v;}},store=new E.WorldStore(storage);store.save(world);
  const loaded=new E.WorldStore(storage).get(world.id);assert.deepEqual(loaded.development,world.development);assert.ok(E.valid(loaded));
  assert.equal(E.analyze(loaded).population,lots.reduce((n,p)=>n+p.occupant.people,0));
 }
});
test('Edition 105 curved parcels keep their saved frames, residents and road access',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/zoning-105.json',import.meta.url))),{world,path}=curve(fixture.controls.map(p=>[p.x,p.y]));
 const oldId=path.id;path.id=fixture.pathId;for(const tile of world.tiles)if(tile.pathIds)tile.pathIds=tile.pathIds.map(id=>id===oldId?path.id:id);
 world.development=fixture.development;const before=JSON.stringify(world.development);
 const grid=E.fineZoningLayout(world);E.fineZonePlan(world);assert.equal(JSON.stringify(world.development),before);
 const occupied=Object.values(world.development.parcels);for(const p of occupied)assert.ok(B.frontage(world,p.id,E.analyze(world).roads).length);
 E.fineZoneCells(world,[...grid.keys()],'residential_medium');const plans=E.fineZonePlan(world);
 for(const p of occupied)for(const plan of plans)assert.equal(Z.overlaps(p.frame,plan.frame),false);
 const copy=JSON.parse(JSON.stringify(world));assert.ok(E.valid(copy));
 assert.deepEqual(copy.development.parcels,JSON.parse(before).parcels);
});
