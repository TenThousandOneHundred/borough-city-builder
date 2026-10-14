// Conservative lane-corridor broad phase. Every active vehicle remains simulated.
// Buckets are updated after each move, preserving the simulation's sequential order.
export class TrafficSpatial {
 constructor(){this.x=new Map();this.z=new Map();this.cells=new WeakMap();this.candidates=[];this.active=[];this.size=4;this.u=new Map();this.v=new Map();this.diagonalReady=false;}
 reset(agents){
  for(const bins of [this.x,this.z])for(const bucket of bins.values())bucket.length=0;
  this.diagonalReady=false;this.active.length=0;this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;
  for(const a of agents)if(a.active){this.active.push(a);const x=Math.floor(a.x/this.size),z=Math.floor(a.z/this.size);this.insert(this.x,x,a);this.insert(this.z,z,a);let cell=this.cells.get(a);if(cell){cell.x=x;cell.z=z;}else this.cells.set(a,{x,z});this.bounds(a);}
 }
 insert(bins,key,a){let bucket=bins.get(key);if(!bucket)bins.set(key,bucket=[]);bucket.push(a);}
 bounds(a){this.minX=Math.min(this.minX,a.x);this.maxX=Math.max(this.maxX,a.x);this.minZ=Math.min(this.minZ,a.z);this.maxZ=Math.max(this.maxZ,a.z);}
 move(a){const cell=this.cells.get(a);if(!cell)return;for(const axis of ['x','z']){const key=Math.floor(a[axis]/this.size);if(key!==cell[axis]){const bucket=this[axis].get(cell[axis]);bucket.splice(bucket.indexOf(a),1);this.insert(this[axis],key,a);cell[axis]=key;}}if(this.diagonalReady){for(const axis of ['u','v']){const value=axis==='u'?(a.x+a.z)*Math.SQRT1_2:(a.z-a.x)*Math.SQRT1_2,key=Math.floor(value/this.size);if(key!==cell[axis]){const bucket=this[axis].get(cell[axis]);bucket.splice(bucket.indexOf(a),1);this.insert(this[axis],key,a);cell[axis]=key;}}this.diagonalBounds(a);}this.bounds(a);}
 diagonalBounds(a){const u=(a.x+a.z)*Math.SQRT1_2,v=(a.z-a.x)*Math.SQRT1_2;this.minU=Math.min(this.minU,u);this.maxU=Math.max(this.maxU,u);this.minV=Math.min(this.minV,v);this.maxV=Math.max(this.maxV,v);}
 diagonal(a,f){
  if(!this.diagonalReady){for(const bins of [this.u,this.v])for(const bucket of bins.values())bucket.length=0;this.minU=this.minV=Infinity;this.maxU=this.maxV=-Infinity;for(const b of this.active){const c=this.cells.get(b);c.u=Math.floor((b.x+b.z)*Math.SQRT1_2/this.size);c.v=Math.floor((b.z-b.x)*Math.SQRT1_2/this.size);this.insert(this.u,c.u,b);this.insert(this.v,c.v,b);this.diagonalBounds(b);}this.diagonalReady=true;}
  const u=(a.x+a.z)*Math.SQRT1_2,v=(a.z-a.x)*Math.SQRT1_2,fu=(f.x+f.z)*Math.SQRT1_2,fv=(f.z-f.x)*Math.SQRT1_2,alongU=Math.abs(fu)>=Math.abs(fv),denom=alongU?fu:fv,slope=(alongU?fv:fu)/denom,margin=.650000001/Math.abs(denom),minor=alongU?v:u,major=alongU?u:v,lo=alongU?this.minU:this.minV,hi=alongU?this.maxU:this.maxV,p=minor+(lo-major)*slope,q=minor+(hi-major)*slope,first=Math.floor((Math.min(p,q)-margin)/this.size),last=Math.floor((Math.max(p,q)+margin)/this.size);
  if(last-first+1>Math.max(4,this.active.length/12))return this.active;
  const result=this.candidates;result.length=0;const bins=alongU?this.v:this.u;for(let key=first;key<=last;key++){const bucket=bins.get(key);if(bucket)for(const b of bucket)result.push(b);}return result;
 }
 corridor(a,forward){
  if(this.active.length<48)return this.active;
  const alongZ=Math.abs(forward.z)>=Math.abs(forward.x),axis=alongZ?'x':'z',other=alongZ?'z':'x';
  const denominator=forward[other],slope=forward[axis]/denominator,margin=.650000001/Math.abs(denominator);
  const lo=alongZ?this.minZ:this.minX,hi=alongZ?this.maxZ:this.maxX;
  const p=a[axis]+(lo-a[other])*slope,q=a[axis]+(hi-a[other])*slope;
  const first=Math.floor((Math.min(p,q)-margin)/this.size),last=Math.floor((Math.max(p,q)+margin)/this.size);
  // Oblique routes use lazily built 45-degree bins before falling back to a full scan.
  if(last-first+1>Math.max(4,this.active.length/12))return this.diagonal(a,forward);
  const result=this.candidates;result.length=0;const bins=this[axis];
  for(let key=first;key<=last;key++){const bucket=bins.get(key);if(bucket)for(const b of bucket)result.push(b);}
  return result;
 }
}
