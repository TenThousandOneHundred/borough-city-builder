import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {planBridges,bridgeHeight,bridgeElevation} from '../dist/bridge-spans.js';
import {bridgeGeometry} from '../dist/bridge-geometry.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
import {streetStations,streetSurface,atDistance} from '../dist/street-geometry.js';
import {floorHeight,groundHeight,wetness} from '../dist/landscape.js';
import {RoadSurfaceIndex} from '../dist/road-surface-index.js';
import {Roadworks} from '../dist/roadworks.js';
import * as T from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;

function view(){const materials=new Map();return {scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
 mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c}));return materials.get(c);},
 box(group,x,y,z,w,h,d,c){const m=new T.Mesh(this.unitBox,this.mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;},
 landscape:{assets:{},material:()=>new T.MeshStandardMaterial()}};}

function fixture(terrain,version=2){
 const world=E.createWorld('Road grading',terrain,23);world.landformVersion=version;
 for(const tile of world.tiles)Object.assign(tile,{type:null,level:0,construction:undefined});
 world.roadPaths=[];world.money=1e8;
 E.buildRoadPath(world,[{x:10,y:24},{x:22,y:18},{x:40,y:24}],'avenue');
 E.buildRoadPath(world,[{x:32,y:10},{x:32,y:35}],'street');
 const roads=roadGeometry(world,E).roads,base=(x,z)=>Math.max(.32,floorHeight(world,x,z))+.1+wetness(world,x,z)*1.2;
 const water=(x,z)=>{const gx=Math.floor((x+96)/4),gy=Math.floor((z+96)/4);return wetness(world,x,z)>.08||(gx>=0&&gy>=0&&gx<48&&gy<48&&world.tiles[gy*48+gx].ground==='water');};
 return {world,roads,base,water};
}

test('bridge sampling coalesces floating-point duplicate stations without altering authored roads',()=>{
 for(const terrain of ['islands','river']){
  const {world,roads,base,water}=fixture(terrain),saved=JSON.stringify(world),authored=JSON.stringify(roads),plan=planBridges(roads,water,base);
  assert.equal(JSON.stringify(world),saved);assert.equal(JSON.stringify(roads),authored);
  for(const span of plan.spans){
   assert.equal(span.points[0].distance,span.start);assert.equal(span.points.at(-1).distance,span.end);
   for(let i=1;i<span.points.length;i++){
    const a=span.points[i-1],b=span.points[i];assert.ok(b.distance-a.distance>1e-6);
    assert.ok(Math.hypot(b.x-a.x,b.z-a.z)>1e-6,'every indexed segment has a usable direction');
   }
  }
  const span=plan.spans.find(s=>s.points[0].x===34&&s.start===0);assert.ok(span);
  for(let d=0;d<Math.min(6,span.end);d+=.025)for(const offset of [-1.5,0,1.5]){
   const actual=bridgeHeight(plan,34+offset,-54+d);
   assert.notEqual(actual,null,'duplicate samples cannot make bridge height fall back to uneven terrain');
   if(offset===0||d<=span.wetEnd)assert.ok(Math.abs(actual-bridgeElevation(span,d))<1e-10,'nearest segment remains correct between refinement stations');
  }
 }
});

test('bridge height queries ignore invalid or zero-length segments defensively',()=>{
 const stations=streetStations([{x:0,z:0},{x:20,z:0}]),road={id:'street',spec:{width:2.45,sidewalk:true},stations};
 const plan=planBridges([road],()=>true,()=>.8),expected=bridgeHeight(plan,2,0),bucket=plan.bins.get('0,0')[0],p=bucket.segments[0].a;
 bucket.segments.push({a:p,b:{...p,distance:p.distance+1},margin:2,span:bucket.span});
 bucket.segments.push({a:p,b:{...p,x:NaN},margin:2,span:bucket.span});
 assert.equal(bridgeHeight(plan,2,0),expected);
 assert.equal(bridgeHeight(plan,NaN,0),null);assert.equal(bridgeHeight(plan,0,Infinity),null);
});

test('real shoreline bridge decks remain beneath pavement through the formerly exposed northern band',()=>{
 for(const terrain of ['islands','river']){
  const {world,roads,base,water}=fixture(terrain),plan=planBridges(roads,water,base),height=(x,z)=>bridgeHeight(plan,x,z)??base(x,z);
  const asphalt=new RoadSurfaceIndex(),deck=new RoadSurfaceIndex(),surfaces=[];
  for(const road of roads){const geometry=streetSurface(road.stations,[[-road.spec.width/2,.08],[road.spec.width/2,.08]],height);surfaces.push(geometry);asphalt.add(geometry,'asphalt');}
  const {geometries}=bridgeGeometry(plan,height,(x,z)=>groundHeight(world,x,z));deck.add(geometries.concrete,'deck');
  let samples=0;
  for(let x=32.8;x<=35.2;x+=.08)for(let z=-53.98;z<=-48;z+=.08){
   const a=asphalt.sample(x,z),b=deck.sample(x,z);assert.notEqual(a,null);assert.notEqual(b,null);
   assert.ok(a-b>.018,`${terrain}: structural concrete intersects the driving surface at ${x}, ${z}`);samples++;
  }
  assert.ok(samples>2200);
  for(const geometry of [...surfaces,...Object.values(geometries)])geometry.dispose();
 }
});

test('bridge approaches join the full natural road width with continuous height and slope',()=>{
 const stations=streetStations(Array.from({length:201},(_,i)=>({x:i*.4,z:0}))),road={id:'graded',spec:{width:2.45,sidewalk:true},stations};
 const base=(x,z)=>.8+.005*x+.004*z+.02*Math.sin(x/8),plan=planBridges([road],x=>x>30&&x<50,base,(x,z)=>base(x,z)-.1),span=plan.spans[0];
 const height=(x,z)=>bridgeHeight(plan,x,z)??base(x,z),epsilon=.0005;
 for(const x of [span.start,span.wetStart,span.wetEnd,span.end])for(const z of [-1.5,0,1.5]){
  const y=height(x,z),left=(y-height(x-epsilon,z))/epsilon,right=(height(x+epsilon,z)-y)/epsilon;
  assert.ok(Math.abs(left-right)<.0003,'natural terrain, approaches and the deck meet without a grade kink');
  if(x===span.start||x===span.end)assert.ok(Math.abs(y-base(x,z))<1e-9,'both sidewalk edges preserve their dry-boundary elevations');
 }
 const start=bridgeElevation(span,span.wetStart),end=bridgeElevation(span,span.wetEnd);
 for(let t=0;t<=1;t+=.05){const d=span.wetStart+(span.wetEnd-span.wetStart)*t,y=bridgeElevation(span,d);assert.ok(Math.abs(y-(start+(end-start)*t))<1e-10,'the water deck has a coherent linear grade, without an automatic hump');assert.ok(y>=1.9-1e-9);}
});

test('real bridge profiles preserve terrain clearance and distinguish constrained road ends from gentle approaches',()=>{
 for(const terrain of ['islands','river']){
  const {world,roads,base,water}=fixture(terrain),plan=planBridges(roads,water,base,(x,z)=>floorHeight(world,x,z));
  for(const span of plan.spans){
   for(let d=span.start;d<=span.end;d=Math.min(span.end,d+.1)){
    const p=atDistance(span.stations,d),width=roads.find(r=>span.roads.includes(r.id)).spec.width,edge=width/2+.42;
    for(const u of [-edge,-edge/2,0,edge/2,edge]){
     const x=p.x+p.nx*u,z=p.z+p.nz*u,h=bridgeHeight(plan,x,z);
     assert.notEqual(h,null);assert.ok(h+.08>floorHeight(world,x,z)+.08,'asphalt and sidewalks stay above the original terrain');
    }
    if(d===span.end)break;
   }
   assert.ok(span.profile.approach<=26,'grading never extends beyond the bounded approach search');
   if(Math.abs(span.profile.slope1)<.3)assert.ok(span.profile.maxGrade<=.12,'a feasible gentle approach is selected');
   else assert.ok(span.profile.maxGrade<.38,'the short, naturally steep terminal retains its constrained grade without a new sharp hump');
  }
 }
});

for(const version of [2,3])test('terrain '+version+' whole bridge plans fit final asphalt planes while retaining their soffits and exposed railings',()=>{
 for(const terrain of ['islands','river']){
  const {world}=fixture(terrain,version),r=new Roadworks(view());r.outsideSteps=function*(){};let pavement;
  r.buildBridges=function(w){pavement=this.group.children.filter(m=>m.userData.roadSurface==='asphalt').map(m=>m.geometry.clone());Roadworks.prototype.buildBridges.call(this,w);};
  const saved=JSON.stringify(world);r.build(world);assert.equal(JSON.stringify(world),saved);
  const args=[r.bridgePlan,(x,z)=>r.height(world,x,z),(x,z)=>groundHeight(world,x,z),r.junctionPlan.junctions];
  const original=bridgeGeometry(...args),fitted=bridgeGeometry(...args,pavement),before=new RoadSurfaceIndex(),after=new RoadSurfaceIndex();
  before.add(original.geometries.concrete);after.add(fitted.geometries.concrete);
  assert.ok(fitted.contact.changed>0,'fixture exercises final pavement contact corrections');assert.ok(fitted.contact.after<fitted.contact.before*1.7,'extra topology stays local to intersecting faces');
  assert.deepEqual(fitted.geometries.metal.attributes.position.array,original.geometries.metal.attributes.position.array,'railings outside the driving lanes retain their authored geometry');
  const oldMesh=new T.Mesh(original.geometries.concrete,new T.MeshBasicMaterial()),newMesh=new T.Mesh(fitted.geometries.concrete,new T.MeshBasicMaterial());oldMesh.updateMatrixWorld();newMesh.updateMatrixWorld();
  let checked=0,underneath=0;
  for(const g of pavement){const p=g.attributes.position,index=g.index,count=index?.count??p.count;
   for(let i=0;i<count;i+=3)for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
    let x=0,y=0,z=0;for(let k=0;k<3;k++){const n=index?index.getX(i+k):i+k;x+=p.getX(n)*weights[k];y+=p.getY(n)*weights[k];z+=p.getZ(n)*weights[k];}
    if(before.sample(x,z)===null)continue;const deck=after.sample(x,z);assert.notEqual(deck,null,'fitting cannot open a hole in existing bridge coverage');assert.ok(deck-y<-.01998,'all bridge concrete remains beneath the actual final asphalt, including junctions and abutments');checked++;
    if(checked%80===0){const ray=new T.Raycaster(new T.Vector3(x,-10,z),new T.Vector3(0,1,0)),oldHit=ray.intersectObject(oldMesh)[0],newHit=ray.intersectObject(newMesh)[0];assert.ok(oldHit&&newHit,'undersides remain closed');assert.ok(Math.abs(oldHit.point.y-newHit.point.y)<1e-5,'contact fitting leaves the original supporting soffit in place');underneath++;}
   }
  }
  assert.ok(checked>(version===2?2000:800));assert.ok(underneath>10);
  for(const g of [...pavement,...Object.values(original.geometries),...Object.values(fitted.geometries)])g.dispose();
 }
});
