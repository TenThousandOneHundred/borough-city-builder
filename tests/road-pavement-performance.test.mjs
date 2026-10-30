import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {Roadworks} from '../dist/roadworks.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
import '../dist/roundabout-state.js';
import {unifyPavement} from '../dist/road-pavement.js';

function view(){const materials=new Map();return {scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
 mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c}));return materials.get(c);},
 box(group,x,y,z,w,h,d,c){const m=new T.Mesh(this.unitBox,this.mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;},
 landscape:{assets:{},material:()=>new T.MeshStandardMaterial()}};}
function rectangle(x0,z0,x1,z1,y=()=>0){
 const points=[[x0,y(x0,z0),z0],[x1,y(x1,z0),z0],[x1,y(x1,z1),z1],[x0,y(x0,z1),z1]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,2,1,0,3,2]);
 g.setAttribute('uv',new T.Float32BufferAttribute(points.flatMap(([x,,z])=>[x*2,z*3]),2));g.setAttribute('roadFinish',new T.Float32BufferAttribute(points.flatMap(([x,,z])=>[1+x*.01,.3+z*.02,1]),3));g.computeVertexNormals();return new T.Mesh(g,new T.MeshStandardMaterial());
}
export function makePavementFixture(name){
 if(name==='attributes'){
  const strip=rectangle(-3,-.3,3,.3);strip.geometry=strip.geometry.toNonIndexed();const uv=strip.geometry.attributes.uv,data=new Float32Array(uv.count*3);
  for(let i=0;i<uv.count;i++)data.set([uv.getX(i),99,uv.getY(i)],i*3);const interleaved=new T.InterleavedBuffer(data,3);strip.geometry.setAttribute('uv',new T.InterleavedBufferAttribute(interleaved,1,0));strip.geometry.setAttribute('custom',new T.InterleavedBufferAttribute(interleaved,1,2));strip.geometry.setAttribute('color',new T.Uint8BufferAttribute(Array.from({length:uv.count*3},(_,i)=>30+i*7),3,true));
  strip.geometry.addGroup(0,3,0);strip.geometry.addGroup(3,3,1);strip.material=[strip.material,new T.MeshStandardMaterial()];
  const shared=rectangle(20,0,24,4),duplicate=new T.Mesh(shared.geometry,shared.material),far=rectangle(-20,0,-16,4),covered=rectangle(-.8,-.1,.8,.1,()=>-1);
  return {strips:[strip,shared,duplicate,far,covered],patches:[rectangle(-1,-1,1,1,(x,z)=>1+x*.1-z*.04),rectangle(.6,-.7,2,.7,()=>.4)]};
 }
 if(name==='boundaries')return {strips:[rectangle(254.5,-.23,256.3,.23,()=>0),rectangle(255.5,-.23,257,.23,()=>-.2),rectangle(-8,-8,-4,-4)],patches:[rectangle(255.1,-.7,255.8,.7,(x,z)=>3+x*.003+z*.2)]};
 const terrain=['river','islands'].includes(name)?name:'plains',w=E.createWorld('Pavement fixture '+name,terrain,name==='starter'||name==='district'?431:23);w.landformVersion=2;w.money=1e8;
 if(name!=='starter'){
  for(const t of w.tiles)Object.assign(t,{type:null,level:0,construction:undefined,zone:null,tree:false});w.roadPaths=[];
  const paths=name==='district'?[['avenue',[[0,24],[47,24]]],['street',[[24,5],[24,40]]],['street',[[8,24],[8,8],[24,8]]],['avenue',[[36,10],[36,40]]],['boulevard',[[24,40],[36,40]]]]:[['avenue',[[10,24],[22,18],[40,24]]],['street',[[32,10],[32,35]]]];
  for(const [kind,points]of paths)assert.ok(E.buildRoadPath(w,points.map(([x,y])=>({x,y})),kind).ok);
  if(name==='district'){const plan=roadGeometry(w,E),j=plan.junctions.find(j=>Math.hypot(j.x-50,j.z-2)<.01);assert.ok(globalThis.BoroughRoundabouts.apply(w,plan.junctions,globalThis.BoroughRoundabouts.key(j),'medium',E).ok);}
 }
 const previousDocument=globalThis.document,previousEngine=globalThis.CityEngine,stop={},r=new Roadworks(view());let fixture;
 // This oracle isolates the pavement optimization with its released input
 // geometry. Road-grade changes have separate continuity/integration tests.
 r.naturalDatum=(world,x,z)=>r.baseHeight(world,x,z);
 Object.defineProperty(r,'gradePlan',{get:()=>null,set(){}});
 globalThis.CityEngine=E;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
 r.finalizePavementSteps=function*(){fixture={strips:[],patches:[]};r.group.traverse(m=>{if(m.userData.roadSurface==='asphalt')(m.userData.roadJunction?fixture.patches:fixture.strips).push(m);});throw stop;};
 try{r.build(w);}catch(error){if(error!==stop)throw error;}finally{globalThis.document=previousDocument;globalThis.CityEngine=previousEngine;}
 assert.ok(fixture);return fixture;
}
function hashGeometry(geometry){
 const hash=createHash('sha256'),add=value=>hash.update(JSON.stringify(value)+'\n');
 for(const [name,a]of Object.entries(geometry.attributes)){const array=a.isInterleavedBufferAttribute?a.data.array:a.array;add([name,a.itemSize,a.normalized,a.name,a.usage??a.data?.usage,array.constructor.name,a.isInterleavedBufferAttribute?[a.data.stride,a.offset]:null]);hash.update(Buffer.from(array.buffer,array.byteOffset,array.byteLength));}
 if(geometry.index){const a=geometry.index.array;add(['index',a.constructor.name]);hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
 add([geometry.groups,geometry.drawRange,geometry.name,geometry.userData,geometry.boundingBox,geometry.boundingSphere]);return hash.digest('hex');
}
export function pavementDigest(fixture,unify=unifyPavement){
 const meshes=[...fixture.patches,...fixture.strips],source=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material),unique=[...new Set(source)],disposed=unique.map(()=>0);unique.forEach((g,i)=>g.addEventListener('dispose',()=>disposed[i]++));
 const digest=()=>createHash('sha256').update(JSON.stringify(meshes.map(m=>hashGeometry(m.geometry)))).digest('hex'),input=digest(),stats=unify(fixture.strips,fixture.patches),output=digest();
 meshes.forEach((m,i)=>assert.equal(m.material,materials[i],'pavement retains material ownership'));
 return {input,output,retained:meshes.map((m,i)=>Number(m.geometry===source[i])).join(''),disposed:disposed.join(','),inputTriangles:stats.inputTriangles,outputTriangles:stats.outputTriangles};
}

// Published Edition 130 snapshots. Hashes include every raw attribute/index
// byte, buffer ordering, groups, bounds, and unchanged-geometry/disposal state.
// These are fixed release oracles; CI never imports the untracked references.
const EDITION130={
  "starter": {
    "input": "ec4caa3cd408e1161ce96e2f8365e775df28f2df5ade4505f175664a859bf4ab",
    "output": "d6dd21cb6b12f8652bd8a1c1a01924b7ada826ea38a687db9dcb2db4627c080d",
    "retained": "011111111111111111110",
    "disposed": "1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1",
    "inputTriangles": 300,
    "outputTriangles": 304
  },
  "district": {
    "input": "11d83a12d91f9963ab6bff0c272edfb6b7e0333b60666fb5ee71d590cbceb31a",
    "output": "0781650b41e510da4d097d2e845c7bc3946128d85f6ae6da6a181c008032c17e",
    "retained": "0000000000011",
    "disposed": "1,1,1,1,1,1,1,1,1,1,1,0,0",
    "inputTriangles": 3680,
    "outputTriangles": 3553
  },
  "river": {
    "input": "7cf84fc53e562d7ee484b02a8ee4e124d96a2b05c9fc13b6df15dacdc1021b46",
    "output": "692c0b0b5a009a71c042a92931164bf82494fb32ca2521f4e589adebaaa78241",
    "retained": "000",
    "disposed": "1,1,1",
    "inputTriangles": 1204,
    "outputTriangles": 1228
  },
  "islands": {
    "input": "eec5c686df19e7f67af00e427f3189f2503d62cf918d18db4d1d0e07a218dd73",
    "output": "8bd58918daace1295511f653c9659f3779992b46f0bb48e769fd38bff490bfd8",
    "retained": "000",
    "disposed": "1,1,1",
    "inputTriangles": 1204,
    "outputTriangles": 1228
  },
  "attributes": {
    "input": "a958693d0aa1136ead46853835b1739066852dd06e95d2873bb3a948785f1f04",
    "output": "af95c7f19aedf70e8254c7f3c2b2832effae784e8761e539c3afe61e99991fe7",
    "retained": "0001010",
    "disposed": "1,1,1,0,0,1",
    "inputTriangles": 14,
    "outputTriangles": 30
  },
  "boundaries": {
    "input": "079ddea5ab3dc1465f9a58c2227a10e1d5aad3ddc41f970291113e8b68a8e8a0",
    "output": "7c98dae1a8c15cfccdc44f86916d5ccece9d8d712ae1d1dadd330ba5054770ec",
    "retained": "0001",
    "disposed": "1,1,1,0",
    "inputTriangles": 8,
    "outputTriangles": 26
  }
};

test('pavement optimization preserves published starter, district, river and island geometry byte for byte',()=>{
 for(const name of ['starter','district','river','islands'])assert.deepEqual(pavementDigest(makePavementFixture(name)),EDITION130[name],name);
});
test('priority, interleaved attributes, normals, shared buffer disposal and Float32 boundary vertices retain release bytes',()=>{
 for(const name of ['attributes','boundaries'])assert.deepEqual(pavementDigest(makePavementFixture(name)),EDITION130[name],name);
});
