// Conservative lane-corridor broad phase. Every active vehicle remains simulated.
// Buckets are updated after each move, preserving the simulation's sequential order.
const EMPTY=Object.freeze([]);
export class TrafficSpatial {
 constructor(){this.x=new Map();this.z=new Map();this.cells=new WeakMap();this.candidates=[];this.active=[];this.size=4;this.u=new Map();this.v=new Map();this.diagonalReady=false;}
 reset(agents){
  for(const bins of [this.x,this.z])for(const bucket of bins.values())bucket.length=0;
  this.diagonalReady=false;this.active.length=0;this.minX=this.minZ=Infinity;this.maxX=this.maxZ=-Infinity;
  for(const a of agents)if(a.active){this.active.push(a);const x=Math.floor(a.x/this.size),z=Math.floor(a.z/this.size);this.insert(this.x,x,a);this.insert(this.z,z,a);let cell=this.cells.get(a);if(cell){cell.x=x;cell.z=z;}else this.cells.set(a,{x,z});this.bounds(a);}
 }
 insert(bins,key,a){let bucket=bins.get(key);if(!bucket)bins.set(key,bucket=[]);bucket.push(a);}
 bounds(a){this.minX=Math.min(this.minX,a.x);this.maxX=Math.max(this.maxX,a.x);this.minZ=Math.min(this.minZ,a.z);this.maxZ=Math.max(this.maxZ,a.z);}
 move(a){if(!a.active)return;const cell=this.cells.get(a);if(!cell)return;for(const axis of ['x','z']){const key=Math.floor(a[axis]/this.size);if(key!==cell[axis]){const bucket=this[axis].get(cell[axis]);bucket.splice(bucket.indexOf(a),1);this.insert(this[axis],key,a);cell[axis]=key;}}if(this.diagonalReady){for(const axis of ['u','v']){const value=axis==='u'?(a.x+a.z)*Math.SQRT1_2:(a.z-a.x)*Math.SQRT1_2,key=Math.floor(value/this.size);if(key!==cell[axis]){const bucket=this[axis].get(cell[axis]);bucket.splice(bucket.indexOf(a),1);this.insert(this[axis],key,a);cell[axis]=key;}}this.diagonalBounds(a);}this.bounds(a);}
 diagonalBounds(a){const u=(a.x+a.z)*Math.SQRT1_2,v=(a.z-a.x)*Math.SQRT1_2;this.minU=Math.min(this.minU,u);this.maxU=Math.max(this.maxU,u);this.minV=Math.min(this.minV,v);this.maxV=Math.max(this.maxV,v);}
 diagonal(a,f){
  if(!this.diagonalReady){for(const bins of [this.u,this.v])for(const bucket of bins.values())bucket.length=0;this.minU=this.minV=Infinity;this.maxU=this.maxV=-Infinity;for(const b of this.active){const c=this.cells.get(b);c.u=Math.floor((b.x+b.z)*Math.SQRT1_2/this.size);c.v=Math.floor((b.z-b.x)*Math.SQRT1_2/this.size);this.insert(this.u,c.u,b);this.insert(this.v,c.v,b);this.diagonalBounds(b);}this.diagonalReady=true;}
  const u=(a.x+a.z)*Math.SQRT1_2,v=(a.z-a.x)*Math.SQRT1_2,fu=(f.x+f.z)*Math.SQRT1_2,fv=(f.z-f.x)*Math.SQRT1_2,alongU=Math.abs(fu)>=Math.abs(fv),denom=alongU?fu:fv,slope=(alongU?fv:fu)/denom,margin=.650000001/Math.abs(denom),minor=alongU?v:u,major=alongU?u:v,lo=alongU?this.minU:this.minV,hi=alongU?this.maxU:this.maxV,p=minor+(lo-major)*slope,q=minor+(hi-major)*slope,first=Math.floor((Math.min(p,q)-margin)/this.size),last=Math.floor((Math.max(p,q)+margin)/this.size);
  if(last-first+1>Math.max(4,this.active.length/12))return this.active;
  const bins=alongU?this.v:this.u;if(first===last)return bins.get(first)||EMPTY;
  const result=this.candidates;result.length=0;for(let key=first;key<=last;key++){const bucket=bins.get(key);if(bucket)for(const b of bucket)result.push(b);}return result;
 }
 // Junction occupancy uses the same sequentially updated positions as lane
 // following. Scan the less crowded axis, then keep the original circle test.
 occupied(point,radius,except){
  if(!(radius>0))return false;
  const firstX=Math.floor((point.x-radius)/this.size),lastX=Math.floor((point.x+radius)/this.size),firstZ=Math.floor((point.z-radius)/this.size),lastZ=Math.floor((point.z+radius)/this.size);
  let countX=0,countZ=0;
  for(let key=firstX;key<=lastX;key++)countX+=this.x.get(key)?.length||0;
  for(let key=firstZ;key<=lastZ;key++)countZ+=this.z.get(key)?.length||0;
  const alongX=countX<=countZ,bins=alongX?this.x:this.z,first=alongX?firstX:firstZ,last=alongX?lastX:lastZ;
  for(let key=first;key<=last;key++)for(const b of bins.get(key)||EMPTY)if(b!==except&&b.active&&Math.hypot(b.x-point.x,b.z-point.z)<radius)return true;
  return false;
 }
 nearby(point,radius){const result=this.candidates;result.length=0;for(let key=Math.floor((point.x-radius)/this.size);key<=Math.floor((point.x+radius)/this.size);key++)for(const b of this.x.get(key)||EMPTY)if(Math.abs(b.z-point.z)<=radius)result.push(b);return result;}
 corridor(a,forward){
  if(this.active.length<48)return this.active;
  const alongZ=Math.abs(forward.z)>=Math.abs(forward.x),axis=alongZ?'x':'z',other=alongZ?'z':'x';
  const denominator=forward[other],slope=forward[axis]/denominator,margin=.650000001/Math.abs(denominator);
  const lo=alongZ?this.minZ:this.minX,hi=alongZ?this.maxZ:this.maxX;
  const p=a[axis]+(lo-a[other])*slope,q=a[axis]+(hi-a[other])*slope;
  const first=Math.floor((Math.min(p,q)-margin)/this.size),last=Math.floor((Math.max(p,q)+margin)/this.size);
  // Oblique routes use lazily built 45-degree bins before falling back to a full scan.
  if(last-first+1>Math.max(4,this.active.length/12))return this.diagonal(a,forward);
  const bins=this[axis];
  // A narrow lane commonly falls entirely within one bin. The caller scans
  // it before moving any vehicle, so no intermediate candidate copy is needed.
  if(first===last)return bins.get(first)||EMPTY;
  const result=this.candidates;result.length=0;
  for(let key=first;key<=last;key++){const bucket=bins.get(key);if(bucket)for(const b of bucket)result.push(b);}
  return result;
 }
}
