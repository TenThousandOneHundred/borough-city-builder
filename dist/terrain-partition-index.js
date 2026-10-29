// Native terrain triangles are roughly one world unit wide. The
// construction grid is coarser, so testing every partition in its cell repeats
// many distant polygon clips. Buckets retain the original ownership order.
const LIMIT=4096;
export class TerrainPartitionIndex{
 constructor(triangles){
  this.triangles=triangles;this.rows=new Map();this.large=[];this.order=new Map(triangles.map((t,i)=>[t,i]));this.lastCandidates=0;
  for(const t of triangles){const b=t.bounds,x0=Math.floor(b.minX),x1=Math.ceil(b.maxX)-1,z0=Math.floor(b.minZ),z1=Math.ceil(b.maxZ)-1;
   if((x1-x0+1)*(z1-z0+1)>LIMIT){this.large.push(t);continue;}
   for(let x=x0;x<=x1;x++){let row=this.rows.get(x);if(!row)this.rows.set(x,row=new Map());for(let z=z0;z<=z1;z++){let bucket=row.get(z);if(!bucket)row.set(z,bucket=[]);bucket.push(t);}}
  }
 }
 query(b){
  const x0=Math.floor(b.minX),x1=Math.ceil(b.maxX)-1,z0=Math.floor(b.minZ),z1=Math.ceil(b.maxZ)-1;
  let result;
  if(x0===x1&&z0===z1&&!this.large.length)result=this.rows.get(x0)?.get(z0)||[];
  else if((x1-x0+1)*(z1-z0+1)>LIMIT)result=this.triangles;
  else{const found=new Set(this.large);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const t of this.rows.get(x)?.get(z)||[])found.add(t);result=[...found].sort((a,b)=>this.order.get(a)-this.order.get(b));}
  this.lastCandidates=result.length;return result;
 }
}
