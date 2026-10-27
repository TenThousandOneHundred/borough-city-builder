import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {RoadGuidePreview} from '../dist/road-guide-preview.js';
globalThis.CityEngine=E;

function fixture(){
 const world=E.createWorld('Parallel preview','plains',137),surfaces=Object.freeze({triangleCount:93}),calls=[];
 const view={scene:new T.Scene(),world,roadworks:{surfaces,heightRevision:4,height:(_w,x,z)=>{calls.push([x,z]);return 3+x*.02+z*.01;},ribbon:()=>{throw Error('Preview must not construct roads');}}};
 return {world,view,calls,guide:new RoadGuidePreview(view)};
}
function plan({curve=false,reverse=false,gap=.4,primaryCount=61,secondaryCount=97,type='street',shift=0}={}){
 const width=(E.ROADS[type].width+(E.ROADS[type].sidewalk?.8:0))/4,offset=width+gap,primary=curve?[{x:8,y:18+shift},{x:24,y:3+shift},{x:40,y:18+shift}]:[{x:8,y:18+shift},{x:28,y:18+shift}];
 const point=(t,amount)=>{const x=curve?8+32*t:8+20*t,y=18+shift-(curve?30*t*(1-t):0),dx=curve?32:20,dy=curve?-30+60*t:0,n=Math.hypot(dx,dy);return {x:x-dy/n*amount,y:y+dx/n*amount};};
 const primarySamples=Array.from({length:primaryCount},(_,i)=>point(i/(primaryCount-1),0)),secondarySamples=Array.from({length:secondaryCount},(_,i)=>point(i/(secondaryCount-1),offset));if(reverse)secondarySamples.reverse();
 return {ok:true,reason:'',paths:[primary],primary,secondary:[],gap,offset,side:'left',reverse,samples:{primary:primarySamples,secondary:secondarySamples},gapGuide:{a:point(.5,width/2),b:point(.5,offset-width/2)}};
}
function vertices(batch){return Array.from(batch.geometry.attributes.position?.array.subarray(0,batch.geometry.drawRange.count*3)||[]);}
function colors(batch){return Array.from(batch.geometry.attributes.color?.array.subarray(0,batch.geometry.drawRange.count*4)||[]);}
function covers(values,x,z){
 for(let i=0;i<values.length;i+=9){const ax=values[i],az=values[i+2],bx=values[i+3],bz=values[i+5],cx=values[i+6],cz=values[i+8],ab=(bx-ax)*(z-az)-(bz-az)*(x-ax),bc=(cx-bx)*(z-bz)-(cz-bz)*(x-bx),ca=(ax-cx)*(z-cz)-(az-cz)*(x-cx);if(ab>=-1e-5&&bc>=-1e-5&&ca>=-1e-5||ab<=1e-5&&bc<=1e-5&&ca<=1e-5)return true;}return false;
}

test('parallel preview shows two full-width roads, an open clear gap and travel-order arrows without world changes',()=>{
 const {guide,view,world}=fixture(),p=plan({reverse:true}),before=JSON.stringify({world,p}),index=view.roadworks.surfaces;
 guide.showParallel(p,'street',true,{cost:1500});
 assert.equal(guide.group.children.length,4);assert.equal(guide.metrics.drawObjects,4);assert.equal(guide.metrics.roadCount,2);assert.ok(Math.abs(guide.metrics.lengthMeters-800)<1e-9);assert.equal(guide.metrics.gapMeters,8);
 const fill=vertices(guide.fill),middleX=(18+.5)*4-96;
 assert.ok(covers(fill,middleX,(18+.5)*4-96));assert.ok(covers(fill,middleX,(18+p.offset+.5)*4-96));assert.equal(covers(fill,middleX,(18+p.offset/2+.5)*4-96),false,'neither ribbon fills the space between the sidewalk edges');
 const zs=[];for(let i=2;i<fill.length;i+=3)zs.push(fill[i]);assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-(p.offset*4+E.ROADS.street.width+.8))<1e-5);
 const [first,second]=guide.metrics.arrows;assert.ok(first.to.x>first.from.x);assert.ok(second.to.x<second.from.x);
 const marks=vertices(guide.dashes);for(const arrow of guide.metrics.arrows){let found=false;for(let i=0;i<marks.length;i+=3)if(Math.hypot(marks[i]-arrow.to.x,marks[i+2]-arrow.to.z)<1e-5)found=true;assert.ok(found,'the actual direction-arrow tip is in the marking geometry');}
 assert.equal(JSON.stringify({world,p}),before);assert.equal(view.roadworks.surfaces,index);assert.equal(view.roadworks.heightRevision,4);guide.dispose();
});

test('curved parallel previews use independent sample arrays, bounded stations and existing terrain cross sections',()=>{
 const {guide,view,calls}=fixture(),p=plan({curve:true,reverse:true,primaryCount:2001,secondaryCount:3007,type:E.ROADS.motorway?'motorway':'oneway'}),type=E.ROADS.motorway?'motorway':'oneway';
 guide.showParallel(p,type,true);
 assert.ok(guide.metrics.stations<=768);assert.ok(guide.metrics.stations>500);assert.ok(guide.metrics.primaryLengthMeters>640);assert.notEqual(guide.metrics.primaryLengthMeters,guide.metrics.secondaryLengthMeters);
 assert.ok(calls.length<guide.metrics.stations*3,'center dashes and inner asphalt do not make independent height queries');
 for(const batch of guide.batches){assert.ok(vertices(batch).every(Number.isFinite));assert.ok(batch.geometry.drawRange.count<=batch.geometry.attributes.position.count);}
 assert.equal(guide.fill.geometry.attributes.color.count,guide.fill.geometry.attributes.position.count);assert.ok(guide.fill.geometry.drawRange.count<=12*768);
 const fill=vertices(guide.fill),before=fill.filter((_,i)=>i%3===1),height=view.roadworks.height;view.roadworks.height=(...args)=>height(...args)+7;guide.showParallel(p,type,true);
 const after=vertices(guide.fill).filter((_,i)=>i%3===1);assert.equal(after.length,before.length);for(let i=0;i<after.length;i++)assert.ok(Math.abs(after[i]-before[i]-7)<2e-6,'a new update sees changed terrain rather than a persistent height cache');
 guide.showParallel(plan({curve:true,primaryCount:435,secondaryCount:327}),'street',true);assert.equal(guide.metrics.stations,762,'an already bounded asymmetric planner sample budget is preserved in full');guide.dispose();
});

test('parallel updates retain GPU pools and exactly preserve ordinary and grid geometry on mode switches',()=>{
 const {guide}=fixture(),p=plan({curve:true,primaryCount:601,secondaryCount:701});guide.showParallel(p,'street',true);
 const geometry=guide.batches.map(b=>b.geometry),materials=guide.batches.map(b=>b.object.material),positions=guide.batches.map(b=>b.geometry.attributes.position),color=guide.fill.geometry.attributes.color;
 for(let i=0;i<20;i++)guide.showParallel(plan({curve:true,primaryCount:601,secondaryCount:701,shift:i*.002}),'street',i%2===0);
 guide.batches.forEach((b,i)=>{assert.equal(b.geometry,geometry[i]);assert.equal(b.object.material,materials[i]);assert.equal(b.geometry.attributes.position,positions[i]);});assert.equal(guide.fill.geometry.attributes.color,color);
 const control=[{x:8,y:18},{x:24,y:3},{x:40,y:18}];guide.update(control,'street',true);const original=guide.batches.map(vertices),material=guide.fill.object.material.toJSON();
 guide.showParallel(p,'street',true);guide.update(control,'street',true);guide.batches.forEach((b,i)=>assert.deepEqual(vertices(b),original[i]));assert.deepEqual(guide.fill.object.material.toJSON(),material);assert.ok(guide.fill.colorArray.every(v=>v===1));
 const corners=[{x:8,y:8},{x:20,y:8},{x:20,y:20},{x:8,y:20}],grid={paths:corners.map((p,i)=>[p,corners[(i+1)%4]]),corners,columns:1,rows:1};guide.showGrid(grid,'street',true);const gridPositions=guide.batches.map(vertices),gridColors=colors(guide.fill);
 guide.showParallel(p,'street',false);guide.showGrid(grid,'street',true);guide.batches.forEach((b,i)=>assert.deepEqual(vertices(b),gridPositions[i]));assert.deepEqual(colors(guide.fill),gridColors);
 guide.clear();assert.equal(guide.group.visible,false);guide.showParallel(p,'street',true);assert.equal(guide.group.visible,true);guide.dispose();
});

test('zero length, zero gap and malformed parallel inputs remain finite and clear safely',()=>{
 const {guide}=fixture(),p=plan({gap:0});p.samples.primary=[{x:20,y:20},{x:20,y:20}];p.samples.secondary=[{x:21,y:20},{x:21,y:20}];p.gapGuide={a:{x:20,y:20},b:{x:20,y:20}};
 guide.showParallel(p,'street',false,{reason:'Choose a longer road'});assert.equal(guide.metrics.lengthMeters,0);assert.equal(guide.metrics.gapMeters,0);assert.equal(guide.metrics.arrows.length,0);for(const batch of guide.batches)assert.ok(vertices(batch).every(Number.isFinite));
 guide.showParallel({...p,samples:{primary:[{x:NaN,y:20}, {x:20,y:20}],secondary:p.samples.secondary}},'street',false);assert.equal(guide.group.visible,false);guide.dispose();
});

test('parallel badges disclose clear gap, both lengths and complete unaffordable cost',()=>{
 const previous=globalThis.document,element=()=>({style:{},dataset:{},children:[],textContent:'',append(child){this.children.push(child);},remove(){}});globalThis.document={createElement:element,body:element()};let guide;
 try{
  guide=fixture().guide;guide.showParallel(plan(),'street',false,{cost:1500,reason:'Not enough funds',snap:{label:'Road connection'}});
  assert.equal(guide.labels[0].textContent,'₡1,500\nNot enough funds\n2 parallel roads');assert.equal(guide.labels[1].textContent,'↔ 8.0 m clear gap');assert.equal(guide.labels[2].textContent,'Road 1 · 400 m');assert.equal(guide.labels[3].textContent,'Road 2 · 400 m');assert.equal(guide.labels[4].textContent,'Road connection');
  guide.showParallel(plan(),'street',false,{reason:'The second road is blocked'});assert.equal(guide.labels[0].textContent,'The second road is blocked');
 }finally{guide?.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
