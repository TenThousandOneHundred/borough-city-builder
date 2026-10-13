import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visualParcels} from '../dist/parcels.js';
const city=()=>({tiles:Array.from({length:2304},()=>({type:null,level:0}))});
const home=()=>({type:'residential',density:'high',level:1,variant:0,people:12});
test('larger visual sites preserve all simulation cells and save data',()=>{const w=city();[100,101,148,149].forEach(i=>w.tiles[i]=home());const before=JSON.stringify(w),p=visualParcels(w);assert.equal(p.get(100).members.length,4);assert.equal(p.get(149).owner,100);assert.equal(JSON.stringify(w),before)});
test('visual sites respect roads, density boundaries and map edges',()=>{const w=city();[47,48,100,101,148,149].forEach(i=>w.tiles[i]=home());w.tiles[101].type='road';w.tiles[148].density='low';w.tiles[149].construction=2;const p=visualParcels(w);assert.equal(p.size,0)});
test('demolishing one cell invalidates its old visual site',()=>{const w=city();[100,101,148,149].forEach(i=>w.tiles[i]=home());const old=visualParcels(w).get(100).key;w.tiles[149]={type:null,level:0};const p=visualParcels(w);assert.notEqual(p.get(100).key,old);assert.equal(p.has(149),false)});

test('curved streets form full-size oriented sites without consuming foreign cells',async()=>{
 const {createRequire}=await import('node:module'),E=createRequire(import.meta.url)('../dist/engine.js'),{lotPlan}=await import('../dist/building-plan.js'),{rectangleCells}=await import('../dist/road-parcels.js');
 const w=E.createWorld('Oriented lots','plains',39);w.money=1000000;for(const t of w.tiles)Object.assign(t,{type:null,level:0,ground:'land'});
 assert.ok(E.buildRoadPath(w,[{x:10,y:30},{x:24,y:8},{x:38,y:30}],'street').ok);
 for(let y=15;y<34;y++)for(let x=8;x<41;x++){const t=w.tiles[y*48+x];if(t.type!=='road')Object.assign(t,home());}
 const before=JSON.stringify(w),parcels=visualParcels(w),sites=[...new Set(parcels.values())].filter(p=>p.oriented);assert.ok(sites.length>10);
 for(const parcel of sites){const p=lotPlan(w,parcel.owner,parcel);assert.ok(Math.abs(Math.sin(p.angle*2))>=.12);assert.equal(p.lotWidth,parcel.oriented.width);assert.equal(p.lotDepth,parcel.oriented.depth);assert.deepEqual(rectangleCells(p.cx,p.cz,p.lotWidth,p.lotDepth,p.angle),parcel.members);
  for(const i of parcel.members){assert.equal(w.tiles[i].type,'residential');assert.equal(parcels.get(i),parcel);}
 }
 assert.equal(JSON.stringify(w),before);assert.equal(visualParcels(w),parcels,'unchanged city reuses frontage layout');w.tiles[sites[0].members[0]].type='park';const rebuilt=visualParcels(w);assert.notEqual(rebuilt,parcels);assert.equal(rebuilt.has(sites[0].members[0]),false);
});
test('rotated rectangle coverage includes every interior sample and rejects off-map sites',async()=>{
 const {rectangleCells}=await import('../dist/road-parcels.js');for(let a=0;a<Math.PI*2;a+=.13){const cells=new Set(rectangleCells(1.3,-2.7,12,8,a));for(let x=-5.95;x<6;x+=.23)for(let z=-3.95;z<4;z+=.23){const px=1.3+x*Math.cos(a)+z*Math.sin(a),pz=-2.7-x*Math.sin(a)+z*Math.cos(a);assert.ok(cells.has(Math.floor((pz+96)/4)*48+Math.floor((px+96)/4)));}}assert.equal(rectangleCells(95,95,8,8,.5),null);
});
test('oriented retaining boundaries follow the street-facing site instead of its grid bounding box',async()=>{
 const {lotPerimeter}=await import('../dist/lot-foundation.js'),p={oriented:true,lotWidth:12,lotDepth:8,parcelWidth:20,parcelDepth:20,angle:.6};for(const point of lotPerimeter(p)){const x=point.x*Math.cos(p.angle)-point.z*Math.sin(p.angle),z=point.x*Math.sin(p.angle)+point.z*Math.cos(p.angle);assert.ok(Math.abs(x)<=5.940001&&Math.abs(z)<=3.940001);assert.ok(Math.abs(Math.abs(x)-5.94)<1e-6||Math.abs(Math.abs(z)-3.94)<1e-6);}
});

test('facility parcels render one correctly oriented building over the full reserved site',async()=>{
 const {createRequire}=await import('node:module'),E=createRequire(import.meta.url)('../dist/engine.js'),{lotPlan}=await import('../dist/building-plan.js');
 for(const [id,[width,depth]] of Object.entries(E.FACILITY_SITES))for(let rotation=0;rotation<4;rotation++){
  const w=E.createWorld('Campus','plains',41),r=E.place(w,20,15,E.BUILDINGS[id].type,{building:id,rotation});assert.ok(r.ok);
  const before=JSON.stringify(w),parcels=visualParcels(w),parcel=parcels.get(r.owner),p=lotPlan(w,r.owner,parcel);
  assert.equal(parcel.facility,true);assert.deepEqual(parcel.members,r.cells);for(const i of r.cells)assert.equal(parcels.get(i),parcel);
  assert.equal(p.facility,true);assert.equal(p.angle,rotation*Math.PI/2);assert.ok(Math.abs(p.lotWidth-width*4)<1e-8);assert.ok(Math.abs(p.lotDepth-depth*4)<1e-8);
  assert.equal(p.cx,(r.owner%48+r.site.width/2)*4-96);assert.equal(p.cz,(Math.floor(r.owner/48)+r.site.depth/2)*4-96);
  assert.equal(JSON.stringify(w),before);assert.equal(visualParcels(w),parcels);
  E.place(w,20,15,'bulldoze');assert.equal(visualParcels(w).has(r.owner),false);
 }
});
