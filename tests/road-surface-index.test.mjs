import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {RoadSurfaceIndex} from '../dist/road-surface-index.js';

function geometry(points,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));if(indices)g.setIndex(indices);return g;}
function quad(x,z,y=0,w=2,d=2){return geometry([[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d]],[0,1,2,0,2,3]);}
function strip(stations,profile){
 const points=[],indices=[];for(const s of stations)for(const [offset,height]of profile)points.push([s.x+s.nx*offset*s.width,s.y+height,s.z+s.nz*offset*s.width]);
 const n=profile.length;for(let row=0;row<stations.length-1;row++)for(let col=0;col<n-1;col++){const a=row*n+col,b=a+n;indices.push(a,b,b+1,a,b+1,a+1);}return geometry(points,indices);
}
function triangles(g){const p=g.attributes.position,idx=g.index,out=[];for(let i=0;i+2<(idx?.count??p.count);i+=3)out.push([0,1,2].map(k=>{const j=idx?idx.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j)];}));return out;}
// Exhaustive signed-area oracle, independent of the cached edge coefficients.
function exhaustive(surfaces,x,z,kind){
 const cross=(ax,az,bx,bz)=>ax*bz-az*bx;let top=null;
 for(const surface of surfaces){if(kind!=null&&kind!==surface.kind)continue;for(const [a,b,c]of surface.triangles){
  const area=cross(b[0]-a[0],b[2]-a[2],c[0]-a[0],c[2]-a[2]);if(Math.abs(area)<1e-12)continue;
  const wa=cross(b[0]-x,b[2]-z,c[0]-x,c[2]-z)/area,wb=cross(c[0]-x,c[2]-z,a[0]-x,a[2]-z)/area,wc=1-wa-wb;
  if(wa < -1e-9||wb < -1e-9||wc < -1e-9)continue;const y=wa*a[1]+wb*b[1]+wc*c[1];if(top===null||y>top)top=y;
 }}return top;
}
function close(actual,expected,label){if(expected===null)assert.equal(actual,null,label);else{assert.notEqual(actual,null,label);assert.ok(Math.abs(actual-expected)<1e-8,label+': '+actual+' vs '+expected);}}

test('indexed surface heights match exhaustive road slopes, tapers, curves, junctions and raised kerb profiles',()=>{
 const straight=[-12,-4,4,12].map(x=>({x,y:x*.06,z:0,nx:0,nz:1,width:2}));
 const taper=[0,6,12,18].map((x,i)=>({x,y:x*.035,z:8,nx:0,nz:1,width:[1,1.4,2.2,3][i]}));
 const curve=Array.from({length:13},(_,i)=>{const a=-Math.PI/3+i*Math.PI/18,x=-28+15*Math.cos(a),z=25+15*Math.sin(a);return{x,z,y:.04*x+.01*z,nx:Math.cos(a),nz:Math.sin(a),width:2+.2*Math.sin(a)};});
 const boundary=[[10,17],[18,17],[18,10],[22,10],[22,17],[30,17],[30,23],[22,23],[22,30],[18,30],[18,23],[10,23]],junctionPoints=[[20,.72,20],...boundary.map(([x,z])=>[x,.6+.02*(x-20)+.015*(z-20),z])],junctionIndices=[];
 for(let i=1;i<=boundary.length;i++)junctionIndices.push(0,i,i===boundary.length?1:i+1);
 const kerbStations=straight.map(s=>({...s,width:1}));
 const fixtures=[
  {name:'crowned slope',kind:'asphalt',geometry:strip(straight,[[-1,-.015],[0,.025],[1,-.015]])},
  {name:'taper',kind:'asphalt',geometry:strip(taper,[[-1,-.015],[0,.025],[1,-.015]])},
  {name:'curve',kind:'asphalt',geometry:strip(curve,[[-1,-.015],[0,.025],[1,-.015]])},
  {name:'junction',kind:'asphalt',geometry:geometry(junctionPoints,junctionIndices)},
  {name:'kerb',kind:'kerb',geometry:strip(kerbStations,[[2,-.015],[2.04,-.015],[2.04,.03],[2.3,.03]])},
  {name:'sidewalk',kind:'sidewalk',geometry:strip(kerbStations,[[2.3,.03],[3.8,.025]])}
 ];
 const surfaces=fixtures.map(f=>({...f,triangles:triangles(f.geometry)})),index=new RoadSurfaceIndex();for(const f of fixtures)index.add(f.geometry,f.kind);
 let queries=0;for(const f of surfaces)for(const [a,b,c]of f.triangles){
  const area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(area)<1e-12)continue;
  for(const [u,v]of [[.17,.23],[.57,.11],[1/3,1/3],[0,.5],[.5,0],[0,0]]){
   const x=a[0]*u+b[0]*v+c[0]*(1-u-v),z=a[2]*u+b[2]*v+c[2]*(1-u-v);
   close(index.sample(x,z),exhaustive(surfaces,x,z),f.name+' highest');close(index.sample(x,z,f.kind),exhaustive(surfaces,x,z,f.kind),f.name+' kind');queries++;
  }
 }
 assert.ok(queries>600);assert.equal(index.sample(200,200),null);assert.equal(index.sample(0,0,'access'),null);
 assert.ok(index.sample(0,2.2)>index.sample(0,1.99,'asphalt'),'raised kerb top is distinct from the asphalt edge');
});

test('overlapping surfaces select the highest matching kind regardless of insertion order or triangle winding',()=>{
 const entries=[['asphalt',quad(-2,-2,-1,4,4)],['asphalt',quad(-2,-2,.25,4,4)],['sidewalk',quad(-2,-2,.5,4,4)],['kerb',quad(-2,-2,.65,4,4)],['access',quad(-2,-2,.4,4,4)]];
 entries[3][1].setIndex([2,1,0,3,2,0]);
 for(const ordered of [entries,[...entries].reverse()]){
  const index=new RoadSurfaceIndex();for(const [kind,g]of ordered)index.add(g,kind);
  close(index.sample(0,0),Math.fround(.65));close(index.sample(0,0,null),Math.fround(.65));close(index.sample(0,0,'asphalt'),.25);close(index.sample(0,0,'access'),Math.fround(.4));assert.equal(index.sample(0,0,'water'),null);
 }
});

test('copied indexed, nonindexed and interleaved surfaces survive source disposal and rebuild without retaining stale roads',()=>{
 const indexed=geometry([[-2,0,-2],[2,.4,-2],[2,.8,2],[-2,.4,2]],[0,1,2,0,2,3]),nonindexed=indexed.toNonIndexed();
 const packed=new Float32Array([-2,0,-2,7,2,.4,-2,7,2,.8,2,7,-2,.4,2,7]),interleaved=new T.BufferGeometry();interleaved.setAttribute('position',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(packed,4),3,0));interleaved.setIndex([0,1,2,0,2,3]);
 for(const source of [indexed,nonindexed,interleaved]){
  const index=new RoadSurfaceIndex();index.add(source,'asphalt');const expected=index.sample(.3,.7);assert.notEqual(expected,null);
  source.dispose();source.attributes.position.getX=()=>{throw Error('query read disposed geometry');};if(source.index)source.index.array.fill(99);
  close(index.sample(.3,.7),expected);assert.equal(index.triangleCount,2);
  index.clear();assert.equal(index.triangleCount,0);assert.equal(index.lastCandidateCount,0);assert.equal(index.sample(.3,.7),null);
  index.add(quad(-2,-2,5,4,4),'sidewalk');assert.equal(index.sample(.3,.7,'asphalt'),null);close(index.sample(.3,.7),5);
 }
});

test('edge tolerance bridges Float32 joins across positive and negative grid-cell boundaries without filling actual gaps',()=>{
 for(const x of [-4,4,96]){
  const index=new RoadSurfaceIndex();index.add(quad(x-2,0,.3,2,2),'asphalt');
  close(index.sample(x+0.000003,1),Math.fround(.3),'tiny join offset');assert.equal(index.sample(x+.002,1),null,'a real gap remains uncovered');
  close(index.sample(x,0),Math.fround(.3),'corner');close(index.sample(x-1,1),Math.fround(.3),'shared triangle diagonal');
 }
});

test('empty, degenerate, vertical and nonfinite inputs never manufacture a surface height',()=>{
 const index=new RoadSurfaceIndex();index.add(null,'asphalt');index.add(new T.BufferGeometry(),'asphalt');index.add(geometry([[0,0,0],[0,5,0],[0,2,5]]),'kerb');index.add(geometry([[0,0,0],[1,2,1],[2,4,2]]),'asphalt');
 index.add(geometry([[0,0,0],[1e-12,10,0],[0,5,2]]),'kerb');index.add(geometry([[0,0,0],[1,Infinity,0],[0,0,1]]),'asphalt');index.add(geometry([[NaN,0,0],[1,0,0],[0,0,1]]),'asphalt');
 index.add(geometry([[0,0,0],[1,0,0],[0,0,1]],[0,1,99]),'asphalt');assert.equal(index.triangleCount,0);assert.equal(index.sample(0,0),null);
 index.add(quad(0,0,2),'asphalt');for(const [x,z]of [[NaN,0],[0,NaN],[Infinity,0],[0,-Infinity]]){assert.equal(index.sample(x,z),null);assert.equal(index.lastCandidateCount,0);}
 const huge=new RoadSurfaceIndex();huge.add(geometry([[-1e6,3,-1e6],[1e6,3,-1e6],[0,3,1e6]]),'asphalt');assert.equal(huge.triangleCount,1);assert.equal(huge.rows.size,0,'oversized triangles do not allocate an unbounded grid');close(huge.sample(0,0),3);assert.equal(huge.sample(2e6,0),null);
});

test('thousands of distant road triangles do not become candidates for a local height query',()=>{
 const index=new RoadSurfaceIndex();for(let i=0;i<2400;i++)index.add(quad((i%80)*10+.25,Math.floor(i/80)*10+.25,i*.001),'asphalt');
 assert.equal(index.triangleCount,4800);const x=401,z=151,expected=Math.fround((15*80+40)*.001);
 close(index.sample(x,z,'asphalt'),expected);assert.ok(index.lastCandidateCount<=4,index.lastCandidateCount+' local candidates, not 4800');
 const rows=index.rows,trianglesBefore=index.triangleCount;for(let i=0;i<1000;i++)close(index.sample(x,z),expected);
 assert.equal(index.rows,rows);assert.equal(index.triangleCount,trianglesBefore);index.sample(-100,-100);assert.equal(index.lastCandidateCount,0);
});
