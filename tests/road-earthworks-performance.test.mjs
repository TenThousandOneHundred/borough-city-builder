import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {createRoadEarthworks} from '../dist/road-earthworks.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
function typedSummary(array){return {type:array.constructor.name,length:array.length,bytes:array.byteLength,backingBytes:array.buffer.byteLength,hash:hash(Buffer.from(array.buffer,array.byteOffset,array.byteLength))};}
function geometrySummary(g){if(!g)return null;return {attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{size:a.itemSize,normalized:a.normalized,...typedSummary(a.array)}])),index:g.index?typedSummary(g.index.array):null,drawRange:g.drawRange};}
function terrain(height,size=12,segments=8){
 const g=new T.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));colors.push(.4+x*.01,.5+z*.01,.6);}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function rectangle(x0,x1,z0,z1,y,kind='asphalt'){
 const a=[x0,y,z0],b=[x0,y,z1],c=[x1,y,z1],d=[x1,y,z0];return [{kind,meshId:0,vertices:[a,b,c]},{kind,meshId:0,vertices:[a,c,d]}];
}
function fixture(name){
 const ground=name==='indexedCut'?(x,z)=>2+x*.04+z*.03:()=>0;
 let geometry=terrain(ground),surfaces=rectangle(-4,4,-.8,.8,name==='indexedCut'?1.2:.35),options={},disposed=false;
 if(name==='nonindexedFill'){geometry=geometry.toNonIndexed();surfaces=rectangle(-4,4,-.8,.8,1.8);}
 if(name==='partialJunction'){surfaces.push(...rectangle(-.8,.8,.8,4,.35));geometry.setDrawRange(9,geometry.index.count-23);}
 if(name==='wetProtected'){
  surfaces=rectangle(-4,4,-.8,.8,1.8);
  options={bridgePlan:{spans:[{wetStart:3,wetEnd:5,points:[{x:-4,z:0,width:1.6,distance:0},{x:4,z:0,width:1.6,distance:8}]}]},wetness:(_w,x)=>Math.abs(x)<1?.5:0,protectedParcels:[{id:'occupied',polygon:[{x:2,z:-2},{x:3,z:-2},{x:3,z:2},{x:2,z:2}]}],structuralSurfaces:rectangle(-4,4,-.85,.85,1.79)};
 }
 if(name==='sparseFar')geometry=terrain(ground,80,40);
 if(name==='empty')surfaces=[];
 if(name==='disposed')disposed=true;
 const world={seed:139,elevationRevision:3,money:1428,tiles:[{ground:'grass',type:'residential',level:1}],residents:[{id:'unchanged',home:0,work:null}],roadPaths:[]};
 return {world,geometry,surfaces,disposed,options:{groundHeight:(_w,x,z)=>ground(x,z),...options}};
}
function evaluate(name){
 const f=fixture(name),{world,geometry,surfaces,options}=f,before=geometrySummary(geometry),saved=JSON.stringify(world),surfaceBefore=JSON.stringify(surfaces);
 const plan=createRoadEarthworks({world,surfaces,...options});plan.beginApplication();if(f.disposed)plan.dispose();
 const result=plan.applyToGeometry(geometry),samples=[];
 for(let x=-5;x<=5;x+=.5)for(let z=-2;z<=2;z+=.25)samples.push([x,z,plan.sample(x,z),plan.contains(x,z),plan.excluded(x,z)]);
 samples.push([plan.sample(NaN,0),plan.sample(0,Infinity),plan.mayAffectProtectedParcel([{x:2,z:1},{x:3,z:1},{x:3,z:2},{x:2,z:2}])]);
 assert.deepEqual(geometrySummary(geometry),before,'all original terrain bytes and draw ranges remain unchanged');
 assert.equal(JSON.stringify(world),saved,'terrain rendering cannot mutate the saved city');assert.equal(JSON.stringify(surfaces),surfaceBefore,'road snapshots remain caller-owned');
 assert.equal(result.indices.byteOffset,0);assert.equal(result.indices.buffer.byteLength,result.indices.byteLength,'returned indices own an exactly sized backing buffer');
 const value={indices:typedSummary(result.indices),geometry:hash(JSON.stringify({replacement:geometrySummary(result.replacement),walls:geometrySummary(result.walls)})),state:hash(JSON.stringify({stats:result.stats,removedCoreArea:result.removedCoreArea,samples}))};
 plan.dispose();geometry.dispose();result.replacement.dispose();result.walls?.dispose();return value;
}

// Frozen Edition138 (b5978cd) output: original order, every attribute/index byte,
// exact backing sizes, query values and accumulated stats. CI needs no archived
// source or external fixture; these constants were produced by that release.
const ORACLES={
  "indexedCut": {
    "indices": {
      "type": "Uint32Array",
      "length": 312,
      "bytes": 1248,
      "backingBytes": 1248,
      "hash": "a145afd08fa3b9c8f8cb692989f21a704e6ea3a715979453e89079d765cec00a"
    },
    "geometry": "68f03873ed2529d1017ca366d73991f7a2a3a6a5481594c24707b754eec92872",
    "state": "0eb637a34ad8b026df4ed55df9d54b9c2869f46c72a85a791a303d315f9cfdb9"
  },
  "nonindexedFill": {
    "indices": {
      "type": "Uint32Array",
      "length": 312,
      "bytes": 1248,
      "backingBytes": 1248,
      "hash": "8b2cb20f6737deb6ed0f982c4811a3b8aad4e5b68757874d0e5b158f208615ae"
    },
    "geometry": "2498660f292c405b0ecb89daaa1979bc65c28a211091fb1a5e400466d387e922",
    "state": "c7cc18ecb0a95f25a4c4baaa049d24491e16443e6b307b1fb8e6e92cf01fe8ed"
  },
  "partialJunction": {
    "indices": {
      "type": "Uint32Array",
      "length": 264,
      "bytes": 1056,
      "backingBytes": 1056,
      "hash": "9bb8955b5313d8465822f13a05a08e428f2fb73e9ab43a8afc9fbec3f00cc96f"
    },
    "geometry": "afe2964629d371755d70c453412453c4a817ce4d4702a3bf285331052ef0e991",
    "state": "66250ef1b8567e3d7920a17b1a0f4a6653b632cfbba7bc1ebe1dade7ae45d891"
  },
  "wetProtected": {
    "indices": {
      "type": "Uint32Array",
      "length": 321,
      "bytes": 1284,
      "backingBytes": 1284,
      "hash": "34457c3129a72d390ecdb545e2f702a88a5ced359470e1743fb81867d4eea177"
    },
    "geometry": "dbac3bca03132775f9028f5839e859d7c3396812d8940f3360143a183db8064e",
    "state": "3986f7883a6b9d128f2da798ad9625a244afce0ba822195a4402015e32796d97"
  },
  "sparseFar": {
    "indices": {
      "type": "Uint32Array",
      "length": 9534,
      "bytes": 38136,
      "backingBytes": 38136,
      "hash": "9ab8150f20460855e516089dd4fff75091a3fc246baa7b1dfc3d217057deec73"
    },
    "geometry": "ffcfcd007b6906c6321df57fda998b48dd2c474cc3fe153f911508da7457388f",
    "state": "0a20bc7a8924329bf87660c6ffba36d8da4fc5de7beee6ad1a7e6b70bbb7337a"
  },
  "empty": {
    "indices": {
      "type": "Uint32Array",
      "length": 384,
      "bytes": 1536,
      "backingBytes": 1536,
      "hash": "e074530e917e97b509036aeb67490d6dc2625420ccbecc30a93ae5d237ac64f2"
    },
    "geometry": "9ca4e824b1f4cf2db35245e9aea47deb40e8bec60a2af4356a80a6cdc5151037",
    "state": "860400760b9fc54a56e09eb4e97c8e9ca1cd88aa74071fa4e69d556a00413082"
  },
  "disposed": {
    "indices": {
      "type": "Uint32Array",
      "length": 384,
      "bytes": 1536,
      "backingBytes": 1536,
      "hash": "e074530e917e97b509036aeb67490d6dc2625420ccbecc30a93ae5d237ac64f2"
    },
    "geometry": "9ca4e824b1f4cf2db35245e9aea47deb40e8bec60a2af4356a80a6cdc5151037",
    "state": "341ab2fa1316f870622efdda66354927f3ffa5a83cad1181779c45f5d0a0ca7c"
  }
};
for(const name of Object.keys(ORACLES))test(`earthworks optimization preserves frozen138 ${name} geometry, queries and save`,()=>assert.deepEqual(evaluate(name),ORACLES[name]));

test('existence lookup matches ordered overlap queries without changing their borrowed results',()=>{
 // Exercise the private production index directly without widening runtime API.
 const source=readFileSync(new URL('../dist/road-earthworks.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('class Index{'),source.indexOf('// Partition a convex polygon'));
 const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
 const Index=new Function('CELL','MAX_CELLS','overlaps',`${body};return Index;`)(4,4096,overlaps),box=(minX,maxX,minZ,maxZ)=>({minX,maxX,minZ,maxZ});
 const indexes=[new Index(),new Index(),new Index()];
 for(const bounds of [box(-12,-4,-8,0),box(4,8,4,8),box(-4,4,-4,4),box(0,0,0,0),box(20,25,-6,-1)])indexes[1].add({bounds});
 for(const bounds of [box(-140,140,-140,140),box(-12,-4,-8,0),box(4,8,4,8),box(-4,4,-4,4),box(0,0,0,0),box(320,321,0,1)])indexes[2].add({bounds});
 const queries=[box(-1e4,1e4,-1e4,1e4),box(1e3,2e3,1e3,2e3),box(-4,-4,0,0),box(8,8,8,8),box(4,4,4,4),box(140,140,0,0),box(140.001,141,0,1),box(321,321,1,1),box(-140,-140,-140,-140)];
 let seed=137;for(let i=0;i<256;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=(seed%800-400)/2;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const z=(seed%800-400)/2;queries.push(box(x,x+(i%17),z,z+(i%11)));}
 for(const index of indexes)for(const b of queries){
  const expected=index.items.filter(item=>overlaps(item.bounds,b)).map(item=>item.id),borrowed=index.query(b),copy=borrowed.slice(),generation=index.queryGeneration;
  assert.deepEqual(borrowed.map(item=>item.id),expected);assert.equal(index.intersects(b),expected.length>0);
  assert.deepEqual(borrowed,copy,'existence lookups do not overwrite an active ordered query');assert.equal(index.queryGeneration,generation,'existence lookups do not spend or alter duplicate marks');
  assert.deepEqual(index.query(b).map(item=>item.id),expected,'later ordered queries keep insertion order');
 }
});

test('retained-index allocation preserves indexed/nonindexed partial, empty and incomplete draw ranges',()=>{
 for(const nonindexed of [false,true])for(const [start,count]of [[0,Infinity],[3,12],[6,2],[6,2.5],[12,0],[9999,3],[0,-3]]){
  const original=terrain(()=>0,4,2),geometry=nonindexed?original.toNonIndexed():original;geometry.setDrawRange(start,count);
  const plan=createRoadEarthworks({world:{seed:1},surfaces:[],groundHeight:()=>0}),available=geometry.index?.count??geometry.attributes.position.count,end=Math.min(available,Math.max(0,start)+count),expected=[];
  for(let i=Math.max(0,start);i+2<end;i+=3)for(let k=0;k<3;k++)expected.push(geometry.index?geometry.index.getX(i+k):i+k);
  const result=plan.applyToGeometry(geometry);assert.deepEqual(result.indices,Uint32Array.from(expected));assert.equal(result.indices.buffer.byteLength,expected.length*4);
  result.replacement.dispose();plan.dispose();geometry.dispose();if(nonindexed)original.dispose();
 }
});
