import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {planBridges,bridgeHeight} from '../dist/bridge-spans.js';
import {bridgeGeometry} from '../dist/bridge-geometry.js';
import {roadGeometry,transitionWidth,junctionCorners} from '../dist/road-junction-plan.js';
import {streetSurface} from '../dist/street-geometry.js';
import {unifyPavement} from '../dist/road-pavement.js';
import {floorHeight,groundHeight,wetness} from '../dist/landscape.js';
globalThis.CityEngine=E;

// Edition130 release oracles include every profile scalar, station and width,
// plus every geometry attribute byte in its original triangle/vertex order.
const ORACLES={
 "islands23": {
  "profile": "bc9a344355dd467a5ef10594533a4676750714e82ca40c2da207eec4c7559838",
  "geometry": "4996266c6abc220f516a9850404e22ab1630325aed4d380862e7271f64971933"
 },
 "river23": {
  "profile": "e445f34c2f0f4698a5e96ccfdac607aed8bb06e4a85c80e14571d2c7f9c286e9",
  "geometry": "08b5362ba4c449e31fc854ad91f28115b47021b8bdb5d9116b510bb9ae457dcb"
 },
 "gravel431": {
  "profile": "5a36110b121f1307eb4dbe890485480775bd6eae65265ab5b399d98a47486355",
  "geometry": "a281f91ad99167542ae8e9031e8ce69c1290919b9048ac30bc28d3aa661a5b9e"
 },
 "alley431": {
  "profile": "ae2229d4b44c5eb13fc8483319e871b1c2e919d52dae6798a4485cc10026b002",
  "geometry": "2acc7b8ded44d741cd4329292308c4cc938476ff39b299d46be00677eb485996"
 },
 "street431": {
  "profile": "b4f2e83ea720f81defe11267a1e86d7ebdc6a480dc4107e4420776b9f382502d",
  "geometry": "9fe5ab09fa7a2cc98a5c6faa9e36e7fa3d956fb0a20236f6ff970e3668da7f1a"
 },
 "oneway431": {
  "profile": "b4f2e83ea720f81defe11267a1e86d7ebdc6a480dc4107e4420776b9f382502d",
  "geometry": "9fe5ab09fa7a2cc98a5c6faa9e36e7fa3d956fb0a20236f6ff970e3668da7f1a"
 },
 "avenue431": {
  "profile": "866efbad8081db9d5c348823d415bf13fcfd11e323b8911494c778b7781d4f5d",
  "geometry": "62c7271fe9e3165dedd0edb49450364a3ec112239e0d0f77ac63b84c09b20923"
 },
 "green431": {
  "profile": "cbf7c9b418a6d56de0813d20b918106a31b9f0bd93270c0dd665e754c33ab794",
  "geometry": "21780a1869b60b4b5f9e3187ce83cd6cebc0bf1950ff505ef4d4cfc2fdf32d92"
 },
 "boulevard431": {
  "profile": "5813b7dfee8c4e53bfaf8556596e099cc96ca250892601e8f745d6d462aabe1d",
  "geometry": "6901eb9ca2e54911c6acb2014a1d4b372d6abfb1b33df2196fabed1c35bbe486"
 },
 "highway431": {
  "profile": "f767f0d06d0eb46066573ad88c7d7c7cf5743ccd46bdeec4979b2e0403eb2a8e",
  "geometry": "c1830bbee553b6a70ba12089f92915b18e483ef22719e40910611432eb085cb2"
 }
};
const hash=value=>createHash('sha256').update(value).digest('hex');
function geometryHash(result){const digest=createHash('sha256');digest.update(JSON.stringify({piers:result.piers,contact:result.contact}));for(const [name,g]of Object.entries(result.geometries)){digest.update(name);for(const key of Object.keys(g.attributes).sort()){const a=g.attributes[key];digest.update(key);digest.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}if(g.index){const a=g.index.array;digest.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}return digest.digest('hex');}
function fixture(terrain,type,seed){
 const w=E.createWorld('Bridge optimization',terrain,seed);for(const tile of w.tiles)Object.assign(tile,{type:null,level:0,construction:undefined});w.roadPaths=[];w.money=1e8;
 const controls=seed===23?[[{x:10,y:24},{x:22,y:18},{x:40,y:24}],[{x:32,y:10},{x:32,y:35}]]:[[{x:20,y:24},{x:32,y:18},{x:44,y:24}]];
 controls.forEach((points,i)=>E.buildRoadPath(w,points,i?'street':type));
 w.roadPaths.forEach((path,i)=>{const old=path.id;path.id='fixture-'+i;for(const tile of w.tiles)if(tile.pathIds)tile.pathIds=tile.pathIds.map(id=>id===old?path.id:id);});
 return w;
}
function evaluate(world){
 const saved=JSON.stringify(world),junctions=roadGeometry(world,E),roads=junctions.roads.map(r=>({...r,widthAt:p=>transitionWidth(r,junctions.tapers.get(r.id)||[],p.distance)}));let baseCalls=0,groundCalls=0,heightCalls=0;
 const base=(x,z)=>{baseCalls++;return Math.max(.32,floorHeight(world,x,z))+.1+wetness(world,x,z)*1.2;},ground=(x,z)=>{groundCalls++;return floorHeight(world,x,z);};
 const water=(x,z)=>{const gx=Math.floor((x+96)/4),gy=Math.floor((z+96)/4);return wetness(world,x,z)>.08||(gx>=0&&gy>=0&&gx<48&&gy<48&&world.tiles[gy*48+gx].ground==='water');};
 const plan=planBridges(roads,water,base,ground),calls={base:baseCalls,ground:groundCalls},height=(x,z)=>{heightCalls++;return bridgeHeight(plan,x,z)??base(x,z);};
 const strips=roads.map(r=>new T.Mesh(streetSurface(r.stations,p=>[[-r.widthAt(p)/2,.08],[r.widthAt(p)/2,.08]],height)));
 const patches=junctions.junctions.map(j=>{const outline=junctionCorners(j).flatMap(c=>c.points),g=new T.ShapeGeometry(new T.Shape(outline.map(p=>new T.Vector2(p.x,-p.z))),1);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i))+.082);g.computeVertexNormals();return new T.Mesh(g);});
 unifyPavement(strips,patches);const pavement=[...strips,...patches].map(m=>m.geometry),beforeGeometry=heightCalls,result=bridgeGeometry(plan,height,(x,z)=>groundHeight(world,x,z),junctions.junctions,pavement);calls.geometryHeight=heightCalls-beforeGeometry;
 const actual={profile:hash(JSON.stringify(plan.spans)),geometry:geometryHash(result)};
 assert.equal(JSON.stringify(world),saved,'render optimization cannot mutate the save');
 for(const g of [...pavement,...Object.values(result.geometries)])g.dispose();
 return {actual,calls};
}

test('bridge optimization preserves released profiles and every geometry byte on real terrain and all road styles',()=>{
 for(const [key,terrain,type,seed]of [['islands23','islands','avenue',23],['river23','river','avenue',23],...Object.keys(E.ROADS).map(type=>[type+'431','river',type,431])]){
  const {actual,calls}=evaluate(fixture(terrain,type,seed));assert.deepEqual(actual,ORACLES[key],key);
  const baseline=key==='islands23'?{base:20179,ground:3880,height:47328}:key==='river23'?{base:47455,ground:9115,height:26609}:{base:32348,ground:6215,height:21398};
  assert.ok(calls.base<=baseline.base*.7,'shared longitudinal probes avoid repeated central terrain calculations');
  assert.equal(calls.ground,baseline.ground,'every original terrain-clearance sample is retained');
  assert.ok(calls.geometryHeight<=baseline.height*.22,'adjacent sweep faces reuse identical station/offset height samples');
 }
});
