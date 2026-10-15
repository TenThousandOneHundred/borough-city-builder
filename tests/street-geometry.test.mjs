import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {streetStations,atDistance,distanceSection,streetSurface} from '../dist/street-geometry.js';
import {Roadworks} from '../dist/roadworks.js';
import {batchStatic} from '../dist/static-batch.js';
import E from '../dist/engine.js';
globalThis.CityEngine=E;
function view(){const materials=new Map();const v={scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false,mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);},box(group,x,y,z,w,h,d,color){const m=new THREE.Mesh(this.unitBox,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}};return v;}
test('arc distance and dash positions are independent of input sample density',()=>{
 const sparse=streetStations([{x:0,z:0},{x:12,z:0}]),dense=streetStations(Array.from({length:121},(_,i)=>({x:i/10,z:0})));
 for(const d of [0,.25,2.4,7,11.9,12])assert.deepEqual(atDistance(sparse,d),atDistance(dense,d));
 const section=distanceSection(dense,2.4,3.65);assert.equal(section[0].x,2.4);assert.equal(section.at(-1).x,3.65);
});
test('swept road surfaces face upward and retain physical texture scale on sloping bends',()=>{
 const points=Array.from({length:40},(_,i)=>({x:Math.sin(i/39)*20,z:Math.cos(i/39)*20})),stations=streetStations(points),g=streetSurface(stations,[[-1.5,.1],[1.5,.1]],(x,z)=>x*.02+z*.03);
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 assert.ok([...p.array].every(Number.isFinite));for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.9);
 for(let i=0;i<stations.length;i++){const a=new THREE.Vector3().fromBufferAttribute(p,i*2),b=new THREE.Vector3().fromBufferAttribute(p,i*2+1);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-3)<.00001);}
 assert.ok(Math.abs(uv.getY(uv.count-1)-stations.at(-1).distance)<.00001);assert.equal(uv.getX(1)-uv.getX(0),3);
});
test('duplicate road samples cannot create nonfinite or zero tangent geometry',()=>{
 const stations=streetStations([{x:0,z:0},{x:0,z:0},{x:3,z:4},{x:3,z:4}]);assert.equal(stations.length,2);assert.equal(stations[1].distance,5);assert.equal(atDistance(stations,2.5).x,1.5);
});
test('curved road styles retain lane geometry, raised sidewalks and shared lamps through batching',()=>{
 const v=view(),r=new Roadworks(v),w=E.createWorld('Road QA','plains',32);for(const type of Object.keys(E.ROADS)){
 r.clear();const path={type,controls:[{x:20,y:20},{x:24,y:15},{x:31,y:21}]};r.path(w,path,v.mat('#454a48'),r.walkMaterial,v.mat('#aaaaaa'));
 let triangles=0;r.group.traverse(o=>{if(!o.isMesh)return;assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});assert.ok(triangles>30);const stats=batchStatic(r.group,v.unitBox);assert.ok(stats.after<=stats.before);
 }
});
test('lamp batching preserves every triangle and night lighting with one shared glowing material',()=>{
 const v=view(),r=new Roadworks(v);r.world=E.createWorld('Lights','plains',4);for(let i=0;i<40;i++)r.lamp(2+i%8*2,1,2+Math.floor(i/8)*2,true);
 const bulbs=r.lamps.slice();assert.equal(new Set(bulbs.map(b=>b.material)).size,1);
 let before=0;r.group.traverse(o=>{if(o.isMesh)before+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});batchStatic(r.group,v.unitBox);
 let after=0,glowDraws=0;r.group.traverse(o=>{if(o.isMesh){after+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;if(o.material===r.lampMaterial)glowDraws++;}});
 assert.equal(after,before);assert.equal(glowDraws,1);const pools=r.group.children.filter(m=>m.material===r.lightPoolMaterial);assert.equal(pools.length,1);r.night(true);assert.equal(r.lampMaterial.emissiveIntensity,3);assert.ok(pools.every(m=>m.visible));r.night(false);assert.equal(r.lampMaterial.emissiveIntensity,0);assert.ok(pools.every(m=>!m.visible));
});
test('road material cache refreshes when asynchronous textures arrive, then reuses them',()=>{
 const v=view();let creations=0;v.landscape={assets:{},material(){creations++;return new THREE.MeshStandardMaterial({map:this.assets['asphalt-color']?.clone()||null});}};
 const r=new Roadworks(v),w=E.createWorld('Loading streets','plains',4);r.outside=()=>{};r.build(w);assert.equal(r.asphalt.map,null);
 const initial=r.asphalt;v.landscape.assets['asphalt-color']=new THREE.Texture();r.build(w);assert.notEqual(r.asphalt,initial);assert.ok(r.asphalt.map);const ready=r.asphalt;r.build(w);assert.equal(r.asphalt,ready);assert.equal(creations,2);
});

test('legacy bridge decks support the unified pavement height instead of floating below it',()=>{
 const v=view(),boxes=[],box=v.box;v.box=function(...args){boxes.push(args);return box.apply(this,args);};v.landscape={assets:{},material:()=>v.mat('#555555')};
 const r=new Roadworks(v),w=E.createWorld('Bridge support','plains',42);w.tiles[24*48+10].ground='water';r.outside=()=>{};r.build(w);
 const deck=boxes.find(([,x,y,z,width,height])=>width===4&&height===.55);assert.ok(deck);const [,x,y,z,,thickness]=deck;assert.ok(Math.abs(y+thickness/2-(r.height(w,x,z)+.075))<1e-8);
});


test('variable street profiles keep finite geometry and continuous arc-length texture coordinates',()=>{
 const stations=streetStations([{x:0,z:0},{x:4,z:0},{x:8,z:0}]),g=streetSurface(stations,p=>[[-(2-p.distance/8),.08],[2-p.distance/8,.08]],()=>0),pos=g.attributes.position,uv=g.attributes.uv;
 assert.equal(pos.count,6);assert.equal(pos.getZ(0),-2);assert.equal(pos.getZ(4),-1);assert.equal(uv.getY(4),8);
 assert.ok([...pos.array,...g.attributes.normal.array].every(Number.isFinite));assert.equal(g.index.count,12);
});

test('wheel-path finish follows all road widths and survives batching without adding triangles',async()=>{
 const {roadFinishData,configureRoadFinish}=await import('../dist/road-finish.js');
 for(const spec of Object.values(E.ROADS)){
  const stations=streetStations([{x:0,z:0},{x:3,z:2},{x:5,z:6}]),width=p=>spec.width*(1-p.distance*.01),g=streetSurface(stations,p=>[[-width(p)/2,.08],[width(p)/2,.08]],()=>0),positions=g.attributes.position.array.slice(),indices=g.index.array.slice();
  roadFinishData(g,stations,width,spec);assert.deepEqual(g.attributes.position.array,positions);assert.deepEqual(g.index.array,indices);
  const finish=g.attributes.roadFinish;for(let i=0;i<stations.length;i++){const expected=spec.oneway?width(stations[i])/spec.lanes:(width(stations[i])/2-(spec.median?.16:0))/Math.max(1,spec.lanes/2);assert.ok(Math.abs(finish.getX(i*2)-expected)<1e-6);assert.equal(finish.getZ(i*2),1);assert.equal(finish.getX(i*2),finish.getX(i*2+1));}
  const m=configureRoadFinish(new THREE.MeshStandardMaterial()),group=new THREE.Group();group.add(new THREE.Mesh(g,m));const junction=new THREE.PlaneGeometry(2,2);group.add(new THREE.Mesh(junction,m));const before=g.index.count+junction.index.count;
  batchStatic(group);let count=0,covered=0,plain=0;group.traverse(o=>{if(!o.isMesh)return;const f=o.geometry.attributes.roadFinish;count+=o.geometry.attributes.position.count;for(let i=0;i<f.count;i++){if(f.getZ(i))covered++;else plain++;}});assert.equal(count,before);assert.ok(covered>0&&plain>0,'junctions stay free of lane wear');
 }
});
