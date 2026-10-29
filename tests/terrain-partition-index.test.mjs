import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TerrainPartitionIndex} from '../dist/terrain-partition-index.js';
const intersects=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
test('terrain partition buckets retain every positive-area candidate in its original order',()=>{
 const triangles=[];for(let i=0;i<1000;i++){const x=Math.sin(i*91)*20,z=Math.cos(i*37)*20;triangles.push({bounds:{minX:x,maxX:x+.02+(i%31)/10,minZ:z,maxZ:z+.03+(i%17)/9}});}
 triangles.push({bounds:{minX:-1000,maxX:1000,minZ:-1000,maxZ:1000}});
 const index=new TerrainPartitionIndex(triangles);
 const queries=[{minX:-2000,maxX:2000,minZ:-2000,maxZ:2000}];
 for(let i=0;i<1000;i++){const x=Math.sin(i*13)*25,z=Math.cos(i*43)*25;queries.push({minX:x,maxX:x+.1+(i%4),minZ:z,maxZ:z+.1+(i%7)});}
 for(const b of queries){const expected=triangles.filter(t=>intersects(t.bounds,b));assert.deepEqual(index.query(b).filter(t=>intersects(t.bounds,b)),expected);}
});
test('aligned native terrain triangles avoid unrelated partitions without losing boundary overlap',()=>{
 const triangles=[];for(let x=-4;x<4;x++)for(let z=-4;z<4;z++)for(let k=0;k<8;k++)triangles.push({bounds:{minX:x+k/8,maxX:x+(k+1)/8,minZ:z,maxZ:z+1}});
 const index=new TerrainPartitionIndex(triangles),b={minX:0,maxX:1,minZ:0,maxZ:1};assert.equal(index.query(b).length,8);assert.equal(index.triangles.length,512);
 const crossing={minX:-.00001,maxX:1.00001,minZ:-.00001,maxZ:1.00001};assert.deepEqual(index.query(crossing).filter(t=>intersects(t.bounds,crossing)),triangles.filter(t=>intersects(t.bounds,crossing)));
});

test('cancelling terrain buffer packing disposes its unfinished geometry',async()=>{
 const T=await import('../dist/vendor/three.module.js'),{createRoadEarthworks}=await import('../dist/road-earthworks.js');
 const g=new T.PlaneGeometry(24,24,48,48);g.rotateX(-Math.PI/2);
 const plan=createRoadEarthworks({world:{},groundHeight:()=>0,surfaces:[{kind:'asphalt',vertices:[[-8,.4,-1],[-8,.4,1],[8,.4,1]]},{kind:'asphalt',vertices:[[-8,.4,-1],[8,.4,1],[8,.4,-1]]}]});
 const original=T.BufferGeometry.prototype.setAttribute;let packed=null,disposed=false;
 T.BufferGeometry.prototype.setAttribute=function(name,a){if(name==='position'&&this!==g&&!packed){packed=this;this.addEventListener('dispose',()=>disposed=true);}return original.call(this,name,a);};
 const steps=plan.applyToGeometrySteps(g);
 try{let r;do{r=steps.next();}while(!packed&&!r.done);assert.ok(packed);assert.equal(r.done,false,'packing yields before returning geometry');steps.return();assert.equal(disposed,true);}
 finally{T.BufferGeometry.prototype.setAttribute=original;steps.return();plan.dispose();g.dispose();}
});
