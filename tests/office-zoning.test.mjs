import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {lotPlan} from '../dist/building-plan.js';
import {Traffic,carCapacity} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';
import {Transit} from '../dist/transit.js';
import {district} from './independent-fixture.mjs';

function grow(zone,fine=true){
 const w=E.createWorld('Office zoning','plains',8);E.place(w,1,23,'power');E.place(w,2,23,'water');
 if(fine)E.fineZoneCells(w,[...E.fineZoningLayout(w).values()].filter(p=>p.cx>-65&&p.cx<-30&&p.side===-1).map(p=>p.id),zone);
 else E.zoneCells(w,E.rectangleCells({x:5,y:21},{x:12,y:23}),zone);
 for(let i=0;i<100;i++)E.tick(w);return w;
}
test('small offices and office towers grow separately in fine and older zoning and round-trip through storage',()=>{
 for(const fine of [true,false])for(const zone of ['office_low','office']){
  const w=grow(zone,fine),offices=fine?Object.values(w.development.parcels).map(p=>p.occupant):w.tiles.filter(t=>t.zoneSite).map(t=>t);
  assert.ok(offices.length);assert.ok(offices.every(t=>t.type==='office'&&!t.construction));
  assert.ok(offices.every(t=>zone==='office_low'?t.density==='low'&&t.building==='localoffice':t.density==='high'&&['business','glass'].includes(t.building)));
  assert.ok(offices.every(t=>E.jobCapacity(t)===t.level*(zone==='office_low'?6:15)));
  const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},store=new E.WorldStore(storage);store.save(w);const loaded=new E.WorldStore(storage).get(w.id);
  assert.ok(E.valid(loaded));assert.deepEqual(loaded.development,w.development);assert.equal(JSON.stringify(loaded.tiles),JSON.stringify(w.tiles));
 }
});
test('low office floor planning remains small through all levels without changing existing office capacities',()=>{
 const w=E.createWorld('Office height','plains',324);
 for(let i=100;i<140;i++)for(const level of [1,5]){w.tiles[i]={type:'office',building:'localoffice',density:'low',level};const plan=lotPlan(w,i);assert.ok(plan.floors>=2&&plan.floors<=3);}
 for(const building of ['business','glass',undefined])for(const density of ['low','high'])assert.equal(E.jobCapacity({type:'office',building,density,level:3}),45);
 assert.equal(E.jobCapacity({type:'office',building:'localoffice',level:3,construction:1}),0);
});
test('residents take jobs in small offices, travel to work and retain them after reload without rendering',()=>{
 const {world,office}=district();office.zone='office_low';for(const id of office.cells)world.development.cells[id].zone='office_low';Object.assign(office.occupant,{building:'localoffice',density:'low',level:2});world.development.revision++;
 const traffic=new Traffic(world,E);traffic.residentsEnabled=true;for(let i=0;i<carCapacity(world);i++)traffic.addAgent();const transit=new Transit(world,traffic),residents=new Residents(world,traffic,transit);
 for(let time=0;time<160;time+=.05){traffic.update(.05);transit.update(.05);residents.update(.05);}
 const staff=residents.state.residents.filter(r=>r.work===office.id);assert.ok(staff.length>0);assert.ok(staff.length<=E.jobCapacity(office.occupant));assert.ok(staff.some(r=>r.workdays>0));const copy=JSON.parse(JSON.stringify(world));assert.ok(E.valid(copy));const resumed=new Residents(copy,new Traffic(copy,E));
 assert.deepEqual(resumed.state.residents.filter(r=>r.work===office.id).map(r=>[r.id,r.work,r.workdays]),staff.map(r=>[r.id,r.work,r.workdays]));
});
