import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {lotAccess} from '../dist/lot-access.js';
import {floorHeight} from '../dist/landscape.js';
import {lotPlan} from '../dist/building-plan.js';
import {Roadworks} from '../dist/roadworks.js';
import E from '../dist/engine.js';
globalThis.CityEngine=E;
function fixture(type='office'){
 const w=E.createWorld('Lot access','plains',23);for(const t of w.tiles)Object.assign(t,{type:null,construction:0,ground:'grass',tree:false});
 const index=24*48+24;w.tiles[index]={type,level:1,density:type==='residential'?'low':'high',ground:'grass'};w.tiles[index+48]={type:'road',roadWidth:1,ground:'grass'};
 return {w,index,p:lotPlan(w,index)};
}
const ground=()=>0,road=()=>.1;
test('street-facing urban aprons and narrow private walks reach the sidewalk with upward surfaces',()=>{
 for(const type of ['office','residential']){
  const {w,p}=fixture(type),before=JSON.stringify(w),g=lotAccess(w,p,.04,E,ground,road);assert.ok(g);
  const pos=g.attributes.position,n=g.attributes.normal;assert.ok([...pos.array].every(Number.isFinite));for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>0);
  const box=new THREE.Box3().setFromBufferAttribute(pos);assert.ok(Math.abs(box.max.z-(p.frontage.z-2.45/2-.42+.025))<1e-5);assert.ok(Math.abs(box.max.y-.215)<1e-5);
  assert.ok(g.userData.span===(type==='office'?2.8:.48));assert.equal(JSON.stringify(w),before);
 }
});
test('road removal, water, occupied intervening lots and highways do not get access pavement',()=>{
 const {w,p,index}=fixture();w.tiles[index+48].type=null;assert.equal(lotAccess(w,p,.04,E,ground,road),null);
 w.tiles[index+48]={type:'road',ground:'water'};assert.equal(lotAccess(w,p,.04,E,ground,road),null);
 w.tiles[index+48]={type:'hospital',ground:'grass'};w.tiles[index+96]={type:'road',ground:'grass'};
 const distant={...p,frontage:{roadIndex:index+96,x:p.cx,z:p.cz+8}};assert.equal(lotAccess(w,distant,.04,E,ground,road),null);
 w.roadPaths=[{id:'h',type:'highway'}];assert.equal(lotAccess(w,{...p,frontage:{pathId:'h',x:p.cx,z:p.cz+4}},.04,E,ground,road),null);
});
test('rotated frontages start on their owned parcel and join curved-road sidewalk elevations',()=>{
 const {w,index}=fixture();w.tiles[index+48].type=null;w.money=100000;const built=E.buildRoadPath(w,[{x:18,y:27},{x:26,y:29},{x:31,y:25}],'street');assert.ok(built.ok);
 let count=0,angled=0;
 for(let y=23;y<=26;y++)for(let x=21;x<=29;x++){
  const i=y*48+x;if(w.tiles[i].type==='road')continue;w.tiles[i].type='office';w.tiles[i].level=1;
  const p=lotPlan(w,i),g=lotAccess(w,p,.04,E,ground,road);w.tiles[i].type=null;if(!g)continue;
  count++;assert.ok(p.frontage.pathId);if(Math.abs(Math.sin(p.angle))>.01)angled++;const n=g.attributes.normal;for(let j=0;j<n.count;j++)assert.ok(n.getY(j)>0);
  const pos=g.attributes.position;assert.ok(Math.max(...Array.from({length:pos.count},(_,j)=>pos.getY(j)))>=.214);
 }
 assert.ok(count>=3,'several lots along the bend connect');assert.ok(angled>=3,'multiple rotated lots connect');
});
test('access paving follows gentle terrain and omits an abrupt unbuildable cliff',()=>{
 const {w,p}=fixture(),height=(_w,_x,z)=>Math.max(0,(z-p.cz-2)*.15),roadHeight=(w,x,z)=>height(w,x,z)+.1;
 const g=lotAccess(w,p,.04,E,height,roadHeight);assert.ok(g);const pos=g.attributes.position;for(let i=0;i<pos.count;i++)assert.ok(pos.getY(i)>=height(w,pos.getX(i),pos.getZ(i))+.0249);
 assert.equal(lotAccess(w,p,8,E,ground,road),null);
});
test('access surfaces batch by material and are removed when a building is demolished',()=>{
 const {w,p}=fixture(),v={scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false},r=new Roadworks(v),root=new THREE.Group();root.position.y=floorHeight(w,p.cx,p.cz)+.04;root.userData={plan:p,asset:true};
 r.buildAccess(w,new Map([[p.index,root]]));assert.ok(r.accessGroup.children.length);let disposed=0;r.accessGroup.children[0].geometry.addEventListener('dispose',()=>disposed++);
 r.buildAccess(w,new Map());assert.equal(r.accessGroup.children.length,0);assert.equal(disposed,1);
});

test('offset household entrances and driveway aprons independently reach the sidewalk',()=>{
 const {w,p}=fixture('residential');p.accessPoints=[{x:-.7,width:.36},{x:.5,width:.36},{x:1.4,width:.55}];const before=JSON.stringify(w),g=lotAccess(w,p,.04,E,ground,road);assert.ok(g);assert.equal(g.userData.connections,3);
 const pos=g.attributes.position;for(const a of p.accessPoints){const endX=p.cx+a.x;assert.ok(Array.from({length:pos.count},(_,i)=>({x:pos.getX(i),y:pos.getY(i)})).some(v=>Math.abs(v.x-endX)<a.width/2+.001&&Math.abs(v.y-.215)<1e-5));}
 assert.equal(JSON.stringify(w),before);for(let i=0;i<g.attributes.normal.count;i++)assert.ok(g.attributes.normal.getY(i)>0);
 assert.equal(lotAccess(w,{...p,accessPoints:[]},.04,E,ground,road),null,'no disconnected apron when the lot has no front route');
});

test('wide independent parcels have centered frontage and sidewalk access',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),F=require('../dist/fine-zoning-state.js'),B=require('../dist/building-entities.js'),w=E.createWorld('Wide fine frontage','plains',8),layout=F.grid(w,E.ROADS);w.development=F.create();F.paint(w.development,layout,[...layout.keys()],'residential_low');
 let parcel;for(const cell of layout.values())if(cell.row===0&&cell.cx>-70&&cell.cx<-40){parcel=F.reserve(w.development,layout,cell.id,3,3);if(parcel)break;}assert.ok(parcel);parcel.occupant={type:'residential',density:'low',building:'cottage',level:1,people:4};w.development.revision++;
 const adapter=B.renderParcel(w,parcel.id),plan=lotPlan(w,adapter.index,adapter),tangentOffset=(plan.frontage.x-plan.cx)*Math.cos(plan.angle)-(plan.frontage.z-plan.cz)*Math.sin(plan.angle);assert.ok(Math.abs(tangentOffset)<1e-8);const before=JSON.stringify(w),g=lotAccess(w,plan,.04,E,ground,road);assert.ok(g);assert.equal(JSON.stringify(w),before);for(let i=0;i<g.attributes.normal.count;i++)assert.ok(g.attributes.normal.getY(i)>0);
});

test('offset office walks and the side drive receive their own sidewalk aprons',()=>{
 const {w,p}=fixture('office');p.accessPoints=[{x:-.7,width:.36},{x:1.3,width:.72}];const before=JSON.stringify(w),g=lotAccess(w,p,.04,E,ground,road);assert.ok(g);assert.equal(g.userData.connections,2);
 const pos=g.attributes.position;for(const a of p.accessPoints){const endX=p.cx+a.x;assert.ok(Array.from({length:pos.count},(_,i)=>({x:pos.getX(i),y:pos.getY(i)})).some(v=>Math.abs(v.x-endX)<a.width/2+.001&&Math.abs(v.y-.215)<1e-5));}
 assert.equal(JSON.stringify(w),before);
});

test('industrial truck gates and separate office walks both reach the road without changing saved lots',async()=>{
 const {industrialSitePlan}=await import('../dist/industrial-site-plan.js'),{w,p}=fixture('industrial'),items=industrialSitePlan({...p,entranceXs:[1.1],loadingBays:[{x:-.65,width:.64}]},{minX:-1.4,maxX:1.4,minZ:-1.7,maxZ:-.8});
 p.accessPoints=items.filter(a=>['walk','drive'].includes(a.kind)&&a.z+a.d/2>=p.lotDepth/2-.091).map(a=>({x:a.x,width:a.w}));assert.equal(p.accessPoints.length,2);assert.ok(p.accessPoints.some(a=>a.width>=1.2));const saved=JSON.stringify(w),g=lotAccess(w,p,.04,E,ground,road);assert.ok(g);assert.equal(g.userData.connections,2);assert.equal(JSON.stringify(w),saved);const pos=g.attributes.position;for(const a of p.accessPoints){const vertices=Array.from({length:pos.count},(_,i)=>({x:pos.getX(i)-p.cx,y:pos.getY(i)})).filter(v=>Math.abs(v.y-.215)<1e-5&&Math.abs(v.x-a.x)<=a.width/2+.001);assert.ok(vertices.length>=3);assert.ok(Math.max(...vertices.map(p=>p.x))-Math.min(...vertices.map(p=>p.x))>=a.width-.002,'street apron retains full gate width');}
});
