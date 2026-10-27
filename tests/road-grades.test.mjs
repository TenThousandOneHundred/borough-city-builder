import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {planRoadGrades} from '../dist/road-grades.js';
import {streetStations,atDistance} from '../dist/street-geometry.js';
import {planJunctions,roadGeometry,planWidthTransitions} from '../dist/road-junction-plan.js';
import {planBridges,bridgeHeight} from '../dist/bridge-spans.js';
import {floorHeight,wetness} from '../dist/landscape.js';
import {Roadworks} from '../dist/roadworks.js';
globalThis.CityEngine=E;
const close=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const road=(id,points,type='street')=>({id,stations:streetStations(points),spec:E.ROADS[type]});
const layout=roads=>({roads,...planJunctions(roads),tapers:new Map()});

test('dry grades smooth longitudinal ripples and level cross sections while preserving free-end terrain joins',()=>{
 const r=road('main',Array.from({length:251},(_,i)=>({x:i*.2,z:0}))),source=layout([r]),natural=(x,z)=>1+x*.01+.08*Math.sin(x*2)+z*.07;
 const before=JSON.stringify(source),plan=planRoadGrades(source,null,natural);assert.equal(JSON.stringify(source),before);
 let variation=0;for(let x=10;x<40;x+=.2){const y=plan.sampleRoad('main',x,0);variation=Math.max(variation,Math.abs(y-(1+x*.01)));close(plan.sampleRoad('main',x,-1.5),plan.sampleRoad('main',x,1.5));}
 assert.ok(variation<.04,'road grading removes the original8cm-world ripples instead of merely tracing them');
 for(const x of [0,50])for(const u of [-1.5,0,1.5])close(plan.sampleRoad('main',x,u),natural(x,u));
 assert.equal(plan.sampleDatum(-.01,0),null);assert.equal(plan.sampleDatum(50.01,0),null);
 const stations=plan.stationsFor('main');for(const p of r.stations)assert.ok(stations.includes(p),'every original station remains present');
 for(const p of stations){const expected=atDistance(r.stations,p.distance);close(p.x,expected.x,1e-10);close(p.z,expected.z,1e-10);}
});

test('junction arms share a modest local grade field and join it with continuous full-width grades',()=>{
 const source=layout([road('east',[{x:-40,z:0},{x:40,z:0}],'avenue'),road('north',[{x:0,z:-40},{x:0,z:40}])]),natural=(x,z)=>2+x*.11+z*.08+.03*Math.sin(x*.5),plan=planRoadGrades(source,null,natural),j=[...plan.junctions.values()][0];
 assert.ok(Math.hypot(j.gx,j.gz)<=.040000001);assert.equal(j.preserveBridge,false);
 for(const record of plan.roads.values())for(const zone of record.zones){
  for(const d of [zone.start,(zone.start+zone.end)/2,zone.end])for(const u of [-1.5,0,1.5]){const p=atDistance(record.source.stations,d),x=p.x+p.nx*u,z=p.z+p.nz*u;close(plan.sampleRoad(record.id,d,u),j.height(x,z));}
  for(const d of [zone.start,zone.end])for(const u of [-1,0,1]){const e=.0005,y=plan.sampleRoad(record.id,d,u),left=(y-plan.sampleRoad(record.id,d-e,u))/e,right=(plan.sampleRoad(record.id,d+e,u)-y)/e;close(left,right,.0005);}
 }
 close(plan.sampleDatum(.3,.4),j.height(.3,.4));assert.equal(plan.corridorAt(.3,.4).mode,'junction');
});

test('overlapping junctions share one continuous full-width field instead of switching between planes',()=>{
 const source=layout([road('east',[{x:-20,z:0},{x:20,z:0}]),road('north-a',[{x:0,z:-20},{x:0,z:20}]),road('north-b',[{x:4,z:-20},{x:4,z:20}])]),natural=(x,z)=>2+.1*x+.02*z,plan=planRoadGrades(source,null,natural);
 // The previous nearest-plane selection jumped .243world here: two ordinary
 // intersections one grid tile apart produced a1.22m step in their pavement.
 close(plan.sampleDatum(1.999,0),plan.sampleDatum(2.001,0),.0006);
 for(const u of [-1,0,1])for(let x=1.5;x<=2.6;x+=.1)close(plan.sampleDatum(x,u),plan.sampleRoad('east',x+20,u),1e-9);
 for(const u of [-1,0,1]){const e=.0001,y=plan.sampleDatum(2,u);close((y-plan.sampleDatum(2-e,u))/e,(plan.sampleDatum(2+e,u)-y)/e,.0005);}
 for(const r of plan.roads.values())for(const zone of r.zones)for(const d of [zone.start,zone.end])if(d>.01&&d<r.length-.01)for(const u of [-1,0,1]){
  const e=.0001,y=r.sample(d,u);close((y-r.sample(d-e,u))/e,(r.sample(d+e,u)-y)/e,.0005);
 }
});

test('a dense junction chain follows broad terrain locally without flattening the whole neighborhood',()=>{
 const xs=[-12,-8,-4,0,4,8,12],source=layout([road('main',[{x:-30,z:0},{x:30,z:0}]),...xs.map(x=>road('cross'+x,[{x,z:-20},{x,z:20}]))]),natural=(x,z)=>2+.008*x*x+.02*z+.03*Math.sin(x*.4),plan=planRoadGrades(source,null,natural);
 assert.equal(plan.junctions.size,7);for(const x of xs)close(plan.sampleDatum(x,0),natural(x,0),1e-9);
 for(let x=-14;x<=14;x+=.05)assert.ok(Math.abs(plan.sampleDatum(x,0)-natural(x,0))<.25,'local correction must not turn this curved neighborhood into one flat plane');
 assert.ok(plan.sampleDatum(12,0)-plan.sampleDatum(0,0)>1,'broad terrain rise remains visible');
});

test('native legacy grid descriptors share junction fields and retain rendered samples when grade joins are inserted',()=>{
 const w=E.createWorld('Legacy grade continuity','plains',8);for(const t of w.tiles)Object.assign(t,{type:null,level:0});w.roadPaths=[];
 for(let x=10;x<=40;x++)Object.assign(w.tiles[24*48+x],{type:'road',roadType:'street',roadWidth:1,legacyRoad:true});
 for(const x of [24,25])for(let y=10;y<=40;y++)Object.assign(w.tiles[y*48+x],{type:'road',roadType:'street',roadWidth:1,legacyRoad:true});
 const saved=JSON.stringify(w),source=roadGeometry(w,E),original=JSON.stringify(source),natural=(x,z)=>Math.max(.32,floorHeight(w,x,z))-.06+wetness(w,x,z)*1.2,plan=planRoadGrades(source,null,natural);
 close(plan.sampleDatum(3.999,2),plan.sampleDatum(4.001,2),.0001);
 let extended=false,inserted=false;
 for(const r of plan.roads.values()){
  extended ||= r.zones.some(q=>q.junction&&!q.junction.source.arms.some(a=>a.roadId===r.id));
  for(let d=0;d<=r.length;d+=.25){const p=atDistance(r.source.stations,d);close(plan.sampleRoad(r.id,d),plan.sampleDatum(p.x,p.z),1e-8);}
  if(r.source.stations.length!==2||Math.abs(r.length-4)>1e-6)continue;
  // The renderer has five samples, whereas this descriptor has two and can
  // run in the opposite direction. Every original render point must survive.
  const a=r.source.stations.at(-1),b=r.source.stations[0],points=Array.from({length:5},(_,i)=>({x:a.x+(b.x-a.x)*i/4,z:a.z+(b.z-a.z)*i/4})),merged=Roadworks.prototype.legacyPoints.call({gradePlan:plan},r.id,points);
  for(const p of points)assert.ok(merged.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1e-9));
  for(const p of plan.stationsFor(r.id))assert.ok(merged.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1e-9));
  close(merged[0].x,a.x);close(merged[0].z,a.z);close(merged.at(-1).x,b.x);close(merged.at(-1).z,b.z);inserted ||= merged.length>points.length;
 }
 assert.ok(extended,'a junction reaches the adjacent legacy descriptor beyond its half-tile arm');assert.ok(inserted,'the fixture emits new grade boundaries in legacy strips');
 assert.equal(JSON.stringify(w),saved);assert.equal(JSON.stringify(source),original);
});

test('new dry grades meet the unchanged bridge dry-end height, derivative and lateral crossfall',()=>{
 const r=road('bridge',Array.from({length:501},(_,i)=>({x:-50+i*.2,z:0}))),source=layout([r]),old=(x,z)=>1+x*.004+z*.02+z*z*.003,lower=(x,z)=>old(x,z)-.16;
 const bridges=planBridges(source.roads,x=>x> -6&&x<6,old,(x,z)=>old(x,z)-.1),before=JSON.stringify(bridges.spans),plan=planRoadGrades(source,bridges,lower);
 assert.equal(JSON.stringify(bridges.spans),before);
 const span=bridges.spans[0],height=(x,z)=>bridgeHeight(bridges,x,z)??plan.sampleDatum(x,z)??lower(x,z),epsilon=.001;
 for(const p of [span.points[0],span.points.at(-1)])for(const u of [-1.5,0,1.5]){
  const x=p.x+p.nx*u,z=p.z+p.nz*u,y=height(x,z);close(y,old(x,z));
  const left=(y-height(x-epsilon,z))/epsilon,right=(height(x+epsilon,z)-y)/epsilon;close(left,right,.0006);
 }
 close(plan.sampleDatum(-40,0),lower(-40,0),.005);close(plan.sampleDatum(40,0),lower(40,0),.005);
});

test('bridge-overlapping junctions retain their released elevation field',()=>{
 const source=layout([road('east',[{x:-30,z:0},{x:30,z:0}]),road('north',[{x:0,z:-30},{x:0,z:30}])]),old=(x,z)=>1+x*.02+z*.015,bridges=planBridges(source.roads,(x,z)=>Math.abs(x)<8,old,(x,z)=>old(x,z)-.1),plan=planRoadGrades(source,bridges,(x,z)=>old(x,z)-.16);
 assert.ok(plan.stats.preservedJunctions>0);for(const [x,z]of [[0,0],[.5,.4],[-.8,-.2]])close(plan.sampleDatum(x,z),bridgeHeight(bridges,x,z)??old(x,z));
});

test('width tapers, reversed bridge-chain descriptors and empty plans keep their existing domains',()=>{
 const source=layout([road('narrow',[{x:-30,z:0},{x:0,z:0}]),road('wide',[{x:0,z:0},{x:30,z:0}],'avenue')]);source.tapers=planWidthTransitions(source.roads,source.junctions);
 const plan=planRoadGrades(source,null,()=>1);close(plan.roads.get('wide').widthAt(0),E.ROADS.street.width);close(plan.roads.get('wide').widthAt(20),E.ROADS.avenue.width);
 for(const x of [1,10,25]){const edge=plan.roads.get('wide').widthAt(x)/2+.38;assert.ok(plan.corridorAt(x,edge));assert.equal(plan.corridorAt(x,edge+.2),null);}
 const reversed=layout([road('a',[{x:0,z:0},{x:20,z:0}]),road('b',[{x:40,z:0},{x:20,z:0}]),road('c',[{x:40,z:0},{x:60,z:0}])]),old=(x,z)=>1+x*.004+z*.01,bridges=planBridges(reversed.roads,x=>x>23&&x<37,old),grade=planRoadGrades(reversed,bridges,(x,z)=>old(x,z)-.16);
 assert.ok(grade.roads.get('b').zones.some(z=>z.mode==='bridge'));
 for(let d=0;d<=20;d+=.2)close(grade.sampleRoad('b',d,0),bridgeHeight(bridges,40-d,0)??old(40-d,0)-.16,.001);
 const empty=planRoadGrades(layout([]),null,()=>1);assert.equal(empty.bounds,null);assert.equal(empty.sampleDatum(0,0),null);assert.equal(empty.stationsFor('missing'),null);
});

test('real plains, river and island plans preserve saves, sampled curves and local query bounds',()=>{
 for(const terrain of ['plains','river','islands']){
  const w=E.createWorld('Road grades',terrain,23);for(const tile of w.tiles)Object.assign(tile,{type:null,level:0});w.roadPaths=[];w.money=1e8;
  E.buildRoadPath(w,[{x:10,y:24},{x:22,y:18},{x:40,y:24}],'avenue');E.buildRoadPath(w,[{x:32,y:10},{x:32,y:35}],'street');
  const source=roadGeometry(w,E),old=(x,z)=>Math.max(.32,floorHeight(w,x,z))+.1+wetness(w,x,z)*1.2,water=(x,z)=>{const gx=Math.floor((x+96)/4),gy=Math.floor((z+96)/4);return wetness(w,x,z)>.08||(gx>=0&&gy>=0&&gx<48&&gy<48&&w.tiles[gy*48+gx].ground==='water');};
  const bridges=planBridges(source.roads,water,old,(x,z)=>floorHeight(w,x,z)),saved=JSON.stringify(w),original=JSON.stringify(source),profile=JSON.stringify(bridges.spans),plan=planRoadGrades(source,bridges,(x,z)=>old(x,z)-.16);
  for(const r of source.roads){const stations=plan.stationsFor(r.id);assert.ok(stations.length>=r.stations.length);for(const p of r.stations){assert.ok(stations.includes(p));const h=bridgeHeight(bridges,p.x,p.z)??plan.sampleDatum(p.x,p.z);assert.ok(Number.isFinite(h));assert.ok(plan.stats.lastCandidateCount<150,'height queries stay local instead of scanning the road network');}}
  const height=(x,z)=>bridgeHeight(bridges,x,z)??plan.sampleDatum(x,z)??old(x,z)-.16;
  for(const span of bridges.spans)for(const p of [span.points[0],span.points.at(-1)])if(p.distance>0&&p.distance<span.stations.at(-1).distance)for(const u of [-1.5,0,1.5]){
   const x=p.x+p.nx*u,z=p.z+p.nz*u,e=.001,y=height(x,z);close(y,old(x,z),2e-7);
   const a=(y-height(x-p.tx*e,z-p.tz*e))/e,b=(height(x+p.tx*e,z+p.tz*e)-y)/e;close(a,b,.0002);
  }
  assert.equal(JSON.stringify(w),saved);assert.equal(JSON.stringify(source),original);assert.equal(JSON.stringify(bridges.spans),profile);
  assert.equal(plan.sampleDatum(1000,1000),null);assert.equal(plan.sampleDatum(NaN,0),null);
 }
});
