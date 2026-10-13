// Conservative lane-corridor broad phase. Every active vehicle remains simulated.
// Buckets are updated after each move, preserving the simulation's sequential order.
export class TrafficSpatial {
 constructor(){this.x=new Map();this.z=new Map();this.cells=new WeakMap();this.candidates=[];this.active=[];this.size=4;}
 reset(agents){
  for(const bins of [this.x,this.z])for(const bucket of bins.values())bucket.length=0;
  this.active.length=0;this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;
  for(const a of agents)if(a.active){this.active.push(a);const x=Math.floor(a.x/this.size),z=Math.floor(a.z/this.size);this.insert(this.x,x,a);this.insert(this.z,z,a);let cell=this.cells.get(a);if(cell){cell.x=x;cell.z=z;}else this.cells.set(a,{x,z});this.bounds(a);}
 }
 insert(bins,key,a){let bucket=bins.get(key);if(!bucket)bins.set(key,bucket=[]);bucket.push(a);}
 bounds(a){this.minX=Math.min(this.minX,a.x);this.maxX=Math.max(this.maxX,a.x);this.minZ=Math.min(this.minZ,a.z);this.maxZ=Math.max(this.maxZ,a.z);}
 move(a){const cell=this.cells.get(a);if(!cell)return;for(const axis of ['x','z']){const key=Math.floor(a[axis]/this.size);if(key!==cell[axis]){const bucket=this[axis].get(cell[axis]);bucket.splice(bucket.indexOf(a),1);this.insert(this[axis],key,a);cell[axis]=key;}}this.bounds(a);}
 corridor(a,forward){
  if(this.active.length<48)return this.active;
  const alongZ=Math.abs(forward.z)>=Math.abs(forward.x),axis=alongZ?'x':'z',other=alongZ?'z':'x';
  const denominator=forward[other],slope=forward[axis]/denominator,margin=.650000001/Math.abs(denominator);
  const lo=alongZ?this.minZ:this.minX,hi=alongZ?this.maxZ:this.maxX;
  const p=a[axis]+(lo-a[other])*slope,q=a[axis]+(hi-a[other])*slope;
  const first=Math.floor((Math.min(p,q)-margin)/this.size),last=Math.floor((Math.max(p,q)+margin)/this.size);
  // Oblique routes may cross most buckets: a linear scan is cheaper in that case.
  if(last-first+1>Math.max(4,this.active.length/12))return this.active;
  const result=this.candidates;result.length=0;const bins=this[axis];
  for(let key=first;key<=last;key++){const bucket=bins.get(key);if(bucket)for(const b of bucket)result.push(b);}
  return result;
 }
}
