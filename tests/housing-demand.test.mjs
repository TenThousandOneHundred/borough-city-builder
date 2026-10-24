import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import F from '../dist/fine-zoning-state.js';
import {Residents} from '../dist/residents.js';
import {Traffic} from '../dist/traffic.js';

function city(seed=8){const w=E.createWorld('Housing demand','plains',seed);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');return w;}
function lot(w,zone,people=0,construction=false){
 const layout=E.fineZoningLayout(w);w.development ||= F.create();F.paint(w.development,layout,[...layout.keys()],zone);
 const side=zone==='residential_lowrent'?4:3,first=[...layout.values()].find(p=>p.row===0&&F.proposal(w.development,layout,p.id,side,side));assert.ok(first);
 const p=F.reserve(w.development,layout,first.id,side,side),types={residential_low:'cottage',residential_row:'townhouse',residential_medium:'apartments',residential_mixed:'mixeduse',residential_lowrent:'lowrent',residential_high:'tower'};
 p.occupant={type:'residential',building:types[zone],density:E.ZONES[zone].density,level:3,people,variant:0,...(construction?{construction:1}:{})};
 F.paint(w.development,layout,Object.keys(w.development.cells).filter(id=>!w.development.cells[id].owner),null);return p;
}

test('six housing forms count once in their density and distinguish occupied, vacant and construction capacity',()=>{
 const w=city(),zones=Object.keys(E.ZONES).filter(z=>z.startsWith('residential_')),lots=zones.map(zone=>lot(w,zone,zone==='residential_low'?4:8));
 const pending=lot(w,'residential_medium',0,true),a=E.analyze(w);
 assert.equal(a.housing.low.buildings,1);assert.equal(a.housing.medium.buildings,3);assert.equal(a.housing.high.buildings,2);
 assert.equal(a.housing.low.occupied,4);assert.equal(a.housing.medium.occupied,24);assert.equal(a.housing.high.occupied,16);
 assert.equal(a.housing.low.available,2);
 assert.equal(a.housing.medium.construction,E.residentialCapacity(w,pending.id));
 assert.equal(Object.values(a.housing).reduce((n,h)=>n+h.occupied,0),a.population);
 for(const p of lots)assert.ok(p.cells.length>1);
 assert.ok(E.valid(w));
});

test('vacant apartments suppress their own construction demand without suppressing detached homes or towers',()=>{
 const w=city(),before=E.analyze(w);for(let n=0;n<4;n++)lot(w,'residential_medium');
 const a=E.analyze(w);assert.ok(a.housing.medium.demand<15);assert.ok(a.housing.medium.moveIn>60);
 assert.equal(a.housing.low.demand,before.housing.low.demand);assert.equal(a.housing.high.demand,before.housing.high.demand);
 assert.equal(a.housing.medium.factors.find(f=>f.label==='Empty homes').value,-90);
 assert.ok(E.zoneDemand(a,E.ZONES.residential_row)<15);assert.ok(E.zoneDemand(a,E.ZONES.residential_mixed)<15);
 assert.ok(E.zoneDemand(a,E.ZONES.residential_high)>60);
});

test('low construction demand still lets residents move into vacant homes and resume real routines',()=>{
 const w=city();for(let n=0;n<6;n++)lot(w,'residential_medium');
 assert.ok(E.analyze(w).housing.medium.demand<15);const count=Object.keys(w.development.parcels).length;
 for(let n=0;n<30;n++)E.tick(w);
 const a=E.analyze(w);assert.ok(a.population>0);assert.equal(Object.keys(w.development.parcels).length,count);
 assert.ok(a.housing.medium.available<6*24);assert.ok(a.housing.medium.demand>20,'demand recovers when vacancies are filled');
 const residents=new Residents(w,new Traffic(w,E));assert.equal(residents.summary.population,a.population);
 assert.ok(residents.state.residents.every(r=>w.development.parcels[r.home]?.occupant.people>0));assert.ok(E.valid(w));
});

test('construction uses density demand while already reserved projects continue and mixed housing also needs shops',()=>{
 let lowStarts=0;
 for(let seed=1;seed<=12;seed++){
  const w=city(seed);for(let n=0;n<4;n++)lot(w,'residential_medium');
  const grid=E.fineZoningLayout(w),free=[...grid.values()].filter(p=>!w.development.cells[p.id]?.owner);
  E.fineZoneCells(w,free.filter(p=>p.side===-1).map(p=>p.id),'residential_medium');E.fineZoneCells(w,free.filter(p=>p.side===1).map(p=>p.id),'residential_low');
  assert.ok(E.analyze(w).housing.medium.demand<15);E.tick(w);
  const projects=Object.values(w.development.parcels).filter(p=>p.occupant?.construction);
  assert.ok(projects.every(p=>p.zone==='residential_low'));lowStarts+=projects.length;
 }
 assert.ok(lowStarts>0);
 const w=city(),pending=lot(w,'residential_medium',0,true);for(let n=0;n<4;n++)lot(w,'residential_medium');
 assert.ok(E.analyze(w).housing.medium.demand<15);for(let n=0;n<3;n++)E.tick(w);assert.equal(pending.occupant.construction,undefined);
 const a=E.analyze(city());a.demand[1]=7;assert.equal(E.zoneDemand(a,E.ZONES.residential_mixed),7);assert.ok(E.zoneDemand(a,E.ZONES.residential_medium)>7);
});

test('demand factors respond to taxes, jobs and happiness and inaccessible housing is not available supply',()=>{
 const w=city(),base=E.analyze(w);w.tax=20;const taxed=E.analyze(w);assert.ok(taxed.housing.low.demand<base.housing.low.demand);
 w.tax=10;const p=lot(w,'residential_medium',0),connected=E.analyze(w);w.tiles[24*48].type=null;const cut=E.analyze(w);assert.equal(cut.housing.medium.capacity,0);assert.equal(cut.housing.medium.available,0);assert.ok(connected.housing.medium.capacity>0);assert.equal(p.occupant.people,0);
 const employed=city();E.place(employed,10,23,'industrial');Object.assign(employed.tiles[23*48+10],{level:3});const jobs=E.analyze(employed);
 assert.ok(jobs.housing.medium.factors.find(f=>f.label==='Jobs relative to population').value>base.housing.medium.factors.find(f=>f.label==='Jobs relative to population').value);
 for(const stats of [base,taxed,connected,cut,jobs])for(const h of Object.values(stats.housing)){
  assert.equal(h.demand,Math.max(0,Math.min(100,h.factors.reduce((n,f)=>n+f.value,0))));assert.ok(Number.isFinite(h.moveIn));
 }
});

test('demand is derived without changing saves, including old worlds and restored residents',()=>{
 const w=city();lot(w,'residential_low',4);lot(w,'residential_high',12);new Residents(w,new Traffic(w,E));
 const before=JSON.stringify(w),a=E.analyze(w);assert.equal(JSON.stringify(w),before);assert.equal(w.housing,undefined);
 const storage={value:null,getItem(){return this.value;},setItem(key,value){this.value=value;}},store=new E.WorldStore(storage);store.save(w);
 const copy=new E.WorldStore(storage).get(w.id);assert.ok(E.valid(copy));assert.deepEqual(E.analyze(copy).housing,a.housing);assert.deepEqual(copy.citizens,w.citizens);
 const old=city();E.place(old,8,23,'residential',{density:'high'});Object.assign(old.tiles[23*48+8],{level:4,people:32});const snapshot=JSON.stringify(old);
 assert.equal(E.analyze(old).housing.high.occupied,32);assert.equal(JSON.stringify(old),snapshot);assert.ok(E.valid(old));
});
