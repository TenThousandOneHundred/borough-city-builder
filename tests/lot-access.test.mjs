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
  const box=new THREE.Box3().setFromBufferAttribute(pos);assert.ok(Math.abs(box.max.z-(p.frontage.z-2.45/2-.42+.025))<1e-5);assert.ok(Math.abs(box.max.y-.24)<1e-5);
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
  const pos=g.attributes.position;assert.ok(Math.max(...Array.from({length:pos.count},(_,j)=>pos.getY(j)))>=.239);
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
