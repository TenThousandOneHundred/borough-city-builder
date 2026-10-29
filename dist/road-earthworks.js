import {TerrainPartitionIndex} from './terrain-partition-index.js?v=151.1';
import {finishBuild} from './build-scheduler.js?v=151.1';
import * as THREE from './vendor/three.module.js';
import clipping from './vendor/polygon-clipping.umd.min.js';

const EPS=1e-10,CELL=4,MAX_CELLS=4096,MAX_SHOULDER=3;
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const smooth=t=>t*t*(3-2*t);
const key=p=>Math.round(p[0]*1e5)+','+Math.round(p[2]*1e5);
const area=p=>{let sum=0;for(let i=1;i+1<p.length;i++)sum+=cross(p[0],p[i],p[i+1]);return Math.abs(sum)/2;};
function bounds(p){if(p.bounds)return p.bounds;let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const v of p){minX=Math.min(minX,v[0]);maxX=Math.max(maxX,v[0]);minZ=Math.min(minZ,v[2]);maxZ=Math.max(maxZ,v[2]);}return p.bounds={minX,maxX,minZ,maxZ};}
const overlaps=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const record=(p,extra={})=>({p,den:cross(...p),bounds:bounds(p),...extra});
function pointIn(t,x,z,epsilon=0){
 const [a,b,c]=t.p,u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/t.den,v=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/t.den;
 if(!epsilon)return u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8?[1-u-v,u,v]:null;
 const den=Math.abs(t.den),ea=1e-8+epsilon*Math.hypot(c[0]-b[0],c[2]-b[2])/den,eb=1e-8+epsilon*Math.hypot(c[0]-a[0],c[2]-a[2])/den,ec=1e-8+epsilon*Math.hypot(b[0]-a[0],b[2]-a[2])/den;
 return u>=-eb&&v>=-ec&&u+v<=1+ea?[1-u-v,u,v]:null;
}
const value=(t,b,k)=>t.p[0][k]*b[0]+t.p[1][k]*b[1]+t.p[2][k]*b[2];
class Index{
 constructor(){this.cells=new Map();this.large=[];this.items=[];this.queryResult=[];this.queryGeneration=0;this.queryMark=Symbol('spatial-query');this.bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};}
 add(t){t.id=this.items.length;this.items.push(t);const b=t.bounds;this.bounds.minX=Math.min(this.bounds.minX,b.minX);this.bounds.maxX=Math.max(this.bounds.maxX,b.maxX);this.bounds.minZ=Math.min(this.bounds.minZ,b.minZ);this.bounds.maxZ=Math.max(this.bounds.maxZ,b.maxZ);const x0=Math.floor(b.minX/CELL),x1=Math.floor(b.maxX/CELL),z0=Math.floor(b.minZ/CELL),z1=Math.floor(b.maxZ/CELL);
  if((x1-x0+1)*(z1-z0+1)>MAX_CELLS){this.large.push(t);return;}
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;let bucket=this.cells.get(k);if(!bucket)this.cells.set(k,bucket=[]);bucket.push(t);}
 }
 // Borrowed scratch is consumed synchronously; no caller re-enters the same
 // index while iterating it. Preserve insertion/id ordering in every branch.
 query(b){const result=this.queryResult;result.length=0;if(!overlaps(this.bounds,b))return result;const x0=Math.floor(b.minX/CELL),x1=Math.floor(b.maxX/CELL),z0=Math.floor(b.minZ/CELL),z1=Math.floor(b.maxZ/CELL);
  if(x0===x1&&z0===z1&&!this.large.length){for(const t of this.cells.get(x0+','+z0)||[])if(overlaps(t.bounds,b))result.push(t);return result;}
  if((x1-x0+1)*(z1-z0+1)>MAX_CELLS){for(const t of this.items)if(overlaps(t.bounds,b))result.push(t);return result;}
  const generation=++this.queryGeneration,mark=this.queryMark,add=t=>{if(t[mark]===generation)return;t[mark]=generation;if(overlaps(t.bounds,b))result.push(t);};
  for(const t of this.large)add(t);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const t of this.cells.get(x+','+z)||[])add(t);
  return result.sort((a,b)=>a.id-b.id);
 }
 // Existence-only callers need neither a sorted result nor duplicate marks.
 // Keep the same inclusive bounds and oversized-query rules as query().
 intersects(b){if(!overlaps(this.bounds,b))return false;const x0=Math.floor(b.minX/CELL),x1=Math.floor(b.maxX/CELL),z0=Math.floor(b.minZ/CELL),z1=Math.floor(b.maxZ/CELL);
  if((x1-x0+1)*(z1-z0+1)>MAX_CELLS){for(const t of this.items)if(overlaps(t.bounds,b))return true;return false;}
  for(const t of this.large)if(overlaps(t.bounds,b))return true;
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const t of this.cells.get(x+','+z)||[])if(overlaps(t.bounds,b))return true;
  return false;
 }
 at(x,z){const bucket=this.cells.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[];return this.large.length?[...bucket,...this.large]:bucket;}
}
// Partition a convex polygon into the portion within a convex triangle and
// nonoverlapping outside fragments. All attributes follow the same exact edge
// interpolation, so untouched terrain retains its original plane/UV/colour.
function partition(polygon,t){
 const b=bounds(polygon),tb=t.bounds;if(b.minX>=tb.maxX||b.maxX<=tb.minX||b.minZ>=tb.maxZ||b.maxZ<=tb.minZ)return null;
 let inside=polygon;const outside=[],sign=Math.sign(t.den);
 for(let i=0;i<3&&inside.length>=3;i++){
  const a=t.p[i],b=t.p[(i+1)%3],positive=[],negative=[];let p=inside.at(-1),dp=sign*cross(a,b,p);
  for(const q of inside){const dq=sign*cross(a,b,q);if(dp*dq<0){const v=mix(p,q,dp/(dp-dq));positive.push(v);negative.push(v);}if(dq>=0)positive.push(q);if(dq<=0)negative.push(q);p=q;dp=dq;}
  if(negative.length>=3&&area(negative)>EPS)outside.push(negative);inside=positive;
 }
 return inside.length>=3&&area(inside)>EPS?{inside,outside}:null;
}
function intersectTriangle(polygon,t){
 if(!overlaps(bounds(polygon),t.bounds))return null;let inside=polygon;const sign=Math.sign(t.den);
 for(let i=0;i<3&&inside.length>=3;i++){const a=t.p[i],b=t.p[(i+1)%3],next=[];let p=inside.at(-1),dp=sign*cross(a,b,p);
  for(const q of inside){const dq=sign*cross(a,b,q);if(dp*dq<0)next.push(mix(p,q,dp/(dp-dq)));if(dq>=0)next.push(q);p=q;dp=dq;}inside=next;
 }return inside.length>=3&&area(inside)>EPS?inside:null;
}
function subtractAll(polygon,index){
 let pieces=[polygon];for(const exclusion of index.query(bounds(polygon))){const next=[];for(const p of pieces){const cut=partition(p,exclusion);next.push(...(cut?cut.outside:[p]));}pieces=next;if(!pieces.length)break;}return pieces;
}
function triangulate(polygon,fn){for(let i=1;i+1<polygon.length;i++){const p=[polygon[0],polygon[i],polygon[i+1]];if(Math.abs(cross(...p))>EPS)fn(p);}}
function polygonTriangles(polygon){
 const points=polygon.map(p=>Array.isArray(p)?[p[0],0,p.length>2?p[2]:p[1]]:[p.x,0,p.z]);
 if(points.length<3||!points.flat().every(Number.isFinite))return [];
 return THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p[0],p[2])),[]).map(indices=>record(indices.map(i=>points[i])));
}
function stationAt(points,d){
 if(d<=points[0].distance)return {...points[0]};if(d>=points.at(-1).distance)return {...points.at(-1)};
 let i=1;while(points[i].distance<d)i++;const a=points[i-1],b=points[i],t=(d-a.distance)/(b.distance-a.distance);
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,width:a.width+(b.width-a.width)*t,distance:d};
}
function snapshotSurfaces(surfaces,kindOverride=null){return finishBuild(snapshotSurfacesSteps(surfaces,kindOverride));}
function* snapshotSurfacesSteps(surfaces,kindOverride=null){
 const result=[],point=new THREE.Vector3();let meshId=0;
 for(const source of surfaces||[]){yield;
  if(source.vertices){result.push({kind:kindOverride||source.kind,meshId:source.meshId??meshId++,vertices:source.vertices.map(v=>v.slice())});continue;}
  const id=meshId++;
  const kind=kindOverride||source.userData?.roadSurface||source.kind;if(kind!=='asphalt'&&kind!=='sidewalk'&&!kindOverride)continue;
  const geometry=source.geometry||source,p=geometry.attributes?.position,index=geometry.index;if(!p)continue;
  source.updateWorldMatrix?.(true,false);const count=index?.count??p.count;
  for(let i=0;i+2<count;i+=3){if(i%384===0)yield;const vertices=[];for(let k=0;k<3;k++){point.fromBufferAttribute(p,index?index.getX(i+k):i+k);if(source.matrixWorld)point.applyMatrix4(source.matrixWorld);vertices.push([point.x,point.y,point.z]);}if(vertices.flat().every(Number.isFinite))result.push({kind,meshId:id,vertices});}
 }
 return result;
}
const ringArea=ring=>{let a=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;};
function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function onRing(x,z,ring,epsilon){for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;if(length2<EPS)continue;const t=((x-a[0])*dx+(z-a[1])*dz)/length2;if(t>=0&&t<=1&&Math.abs(dx*(z-a[1])-dz*(x-a[0]))<=epsilon*Math.sqrt(length2))return true;}return false;}
function inMulti(x,z,multi,epsilon=0){for(const polygon of multi){if(onRing(x,z,polygon[0],epsilon))return true;if(inRing([x,z],polygon[0])&&!polygon.slice(1).some(r=>inRing([x,z],r)&&!onRing(x,z,r,epsilon)))return true;}return false;}
const TOPOLOGY_SCALE=1e5;
function gridGeometry(shape){
 const multi=typeof shape[0]?.[0]?.[0]==='number'?[shape]:shape,result=[];
 for(const polygon of multi){const rings=[];for(const ring of polygon){let points=[];for(const p of ring){const q=[Math.round(p[0]*TOPOLOGY_SCALE),Math.round(p[1]*TOPOLOGY_SCALE)],last=points.at(-1);if(!last||last[0]!==q[0]||last[1]!==q[1])points.push(q);}if(points.length>1&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
   if(points.some(p=>!p.every(Number.isSafeInteger)))throw new RangeError('Road footprint is outside the finite topology grid');
   points=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0])!==0;});
   if(points.length<3||Math.abs(ringArea(points))<.5){if(rings.length===0)break;continue;}rings.push(points);
  }if(rings.length)result.push(rings);
 }return result;
}
function boolean(op,...shapes){
 const normalized=shapes.map(gridGeometry);let ox=Infinity,oz=Infinity;for(const multi of normalized)for(const polygon of multi)for(const ring of polygon)for(const p of ring){ox=Math.min(ox,p[0]);oz=Math.min(oz,p[1]);}
 if(!Number.isFinite(ox))return [];
 // Work in the local cell frame. Large absolute world coordinates amplify
 // roundoff where fitted concrete creates almost coincident intersections.
 for(const multi of normalized)for(const polygon of multi)for(const ring of polygon)for(const p of ring){p[0]-=ox;p[1]-=oz;}
 const result=clipping[op](...normalized);
 return result.map(polygon=>polygon.map(ring=>ring.map(p=>[(p[0]+ox)/TOPOLOGY_SCALE,(p[1]+oz)/TOPOLOGY_SCALE])));
}
function union(polygons){return polygons.length?boolean('union',...polygons):[];}
function coverage(multi,kind){const result=[];for(const polygon of multi){const rings=polygon.map(r=>r.slice(0,-1)),points=rings.flat(),contour=rings[0].map(p=>new THREE.Vector2(...p)),holes=rings.slice(1).map(r=>r.map(p=>new THREE.Vector2(...p)));
 for(const ids of THREE.ShapeUtils.triangulateShape(contour,holes)){const p=ids.map(i=>[points[i][0],0,points[i][1]]);if(Math.abs(cross(...p))>EPS)result.push(record(p,{kind}));}
}return result;}
function lineInterval(a,b,t,epsilon=0){
 let lo=0,hi=1;const sign=Math.sign(t.den);
 for(let i=0;i<3;i++){const p=t.p[i],q=t.p[(i+1)%3],margin=epsilon*Math.hypot(q[0]-p[0],q[2]-p[2]),da=sign*cross(p,q,a)+margin,db=sign*cross(p,q,b)+margin;if(da<0&&db<0)return null;if(da<0)lo=Math.max(lo,da/(da-db));else if(db<0)hi=Math.min(hi,da/(da-db));if(hi-lo<1e-9)return null;}return [lo,hi];
}
function removeIntervals(interval,used){let parts=[interval];for(const [a,b]of used){const next=[];for(const [lo,hi]of parts){if(b<=lo||a>=hi)next.push([lo,hi]);else{if(a>lo+1e-9)next.push([lo,a]);if(b<hi-1e-9)next.push([b,hi]);}}parts=next;}return parts;}
function segmentDistanceSquared(a,b,c,d){
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.max(c[0],d[0])>=Math.min(a[0],b[0])&&Math.max(a[2],b[2])>=Math.min(c[2],d[2])&&Math.max(c[2],d[2])>=Math.min(a[2],b[2]))return 0;
 const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/length)):0;return (p[0]-a[0]-dx*t)**2+(p[2]-a[2]-dz*t)**2;};
 return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));
}
function geometryFrom(vertices,layout){return finishBuild(geometryFromSteps(vertices,layout));}
function* geometryFromSteps(vertices,layout){
 const geometry=new THREE.BufferGeometry();let complete=false;
 try{
  const positions=new Float32Array(vertices.length*3);for(let i=0;i<vertices.length;i++){if(i%1024===0)yield;const v=vertices[i];positions[i*3]=v[0];positions[i*3+1]=v[1];positions[i*3+2]=v[2];}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  for(const {name,offset,size}of layout){const values=new Float32Array(vertices.length*size);for(let i=0;i<vertices.length;i++){if(i%1024===0)yield;for(let k=0;k<size;k++)values[i*size+k]=vertices[i][offset+k];}geometry.setAttribute(name,new THREE.BufferAttribute(values,size));}
  yield;if(!geometry.attributes.normal)geometry.computeVertexNormals();yield;geometry.computeBoundingSphere();complete=true;return geometry;
 }finally{if(!complete)geometry.dispose();}
}

/** Build-local derived terrain. Natural height data and source mesh buffers are
 * never modified. Landscape owns every geometry returned by applyToGeometry;
 * Roadworks owns/disposes this plan and may reuse surfaceSnapshot to rebuild it.
 */
const warnedWorlds=new WeakSet();let warnedWithoutWorld=false;
function warnFallback(world,error){const object=world&&typeof world==='object';if(object?warnedWorlds.has(world):warnedWithoutWorld)return;if(object)warnedWorlds.add(world);else warnedWithoutWorld=true;console.warn('Road terrain support was skipped for this layout; the original ground is retained.',error);}
export function createRoadEarthworks(options){return finishBuild(createRoadEarthworksSteps(options));}
export function* createRoadEarthworksSteps(options){
 try{return yield* buildRoadEarthworks(options);}catch(error){
  warnFallback(options?.world,error);let surfaceSnapshot=[],structuralSnapshot=[];try{surfaceSnapshot=snapshotSurfaces(options?.surfaces);structuralSnapshot=snapshotSurfaces(options?.structuralSurfaces,'structure');}catch{}
  const stats={fallback:true,reason:String(error?.message||error),sourceTriangles:surfaceSnapshot.length,roadTriangles:0,patches:0,influenceTriangles:0,wallSegments:0,affectedTriangles:0,replacementTriangles:0,wallTriangles:0,removedCoreArea:0,applications:0};
  return {surfaceSnapshot,structuralSnapshot,stats,beginApplication(){stats.applications=0;},sample(){return null;},contains(){return false;},excluded(){return false;},mayAffectProtectedParcel(){return true;},dispose(){},rebuild(overrides={}){return createRoadEarthworks({...options,surfaces:surfaceSnapshot,structuralSurfaces:structuralSnapshot,...overrides});},
   applyToGeometry(geometry){const p=geometry.attributes.position,index=geometry.index,start=Math.max(0,geometry.drawRange?.start||0),end=Math.min(index?.count??p.count,start+(geometry.drawRange?.count??Infinity)),indices=new Uint32Array(end-start);for(let i=start;i<end;i++)indices[i-start]=index?index.getX(i):i;
    const layout=[];let offset=3;for(const [name,a]of Object.entries(geometry.attributes))if(name!=='position'){layout.push({name,offset,size:a.itemSize});offset+=a.itemSize;}stats.applications++;return {indices,replacement:geometryFrom([],layout),walls:null,removedCoreArea:0,stats:{...stats}};
   }};
 }
}
function* buildRoadEarthworks({world,surfaces=[],structuralSurfaces=[],bridgePlan,groundHeight,wetness=()=>0,protectedParcels=[],regionCache=null}){
 const surfaceSnapshot=yield* snapshotSurfacesSteps(surfaces),structuralSnapshot=yield* snapshotSurfacesSteps(structuralSurfaces,'structure'),natural=(x,z)=>groundHeight(world,x,z),wet=(x,z)=>wetness(world,x,z)>.08;
 const exclusions=new Index(),protectedIndex=new Index(),roadIndex=new Index(),structureIndex=new Index(),patches=new Index(),wallIndex=new Index(),perimeterIndex=new Index(),regions=new Index();
 // The actual concrete tops are opaque covers. Soffits and buried pier faces
 // must not remove visible ground merely because they project over it.
 for(const {vertices}of structuralSnapshot)if(cross(...vertices)<-EPS)structureIndex.add(record(vertices,{foundation:vertices.map(p=>[p[0],p[1]-.02,p[2]])}));
 for(const parcel of protectedParcels)for(const t of polygonTriangles(parcel.polygon||parcel)){exclusions.add({...t});protectedIndex.add({...t});}
 // Bridge plans include dry approaches. Only the wet interval is excluded;
 // padding prevents shoulders from extending laterally into the water channel.
 for(const span of bridgePlan?.spans||[]){if(!span.points?.length)continue;
  const start=stationAt(span.points,span.wetStart),end=stationAt(span.points,span.wetEnd),points=[start,...span.points.filter(p=>p.distance>span.wetStart&&p.distance<span.wetEnd),end];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-8)continue;const nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length,wa=a.width/2+.5+MAX_SHOULDER,wb=b.width/2+.5+MAX_SHOULDER;
   const p=[[a.x+nx*wa,0,a.z+nz*wa],[a.x-nx*wa,0,a.z-nz*wa],[b.x-nx*wb,0,b.z-nz*wb],[b.x+nx*wb,0,b.z+nz*wb]];triangulate(p,t=>exclusions.add(record(t)));
  }
 }
 const minimum=new Map(),edges=new Map();
 for(const {kind,vertices}of surfaceSnapshot){if(kind==='sidewalk')for(const p of vertices){const k=key(p);minimum.set(k,Math.min(minimum.get(k)??Infinity,p[1]));}}
 for(const {kind,vertices}of surfaceSnapshot){yield;let p=vertices.map(v=>v.slice());if(Math.abs(cross(...p))<EPS)continue;if(cross(...p)<0)p=[p[0],p[2],p[1]];
  roadIndex.add(record(p,{kind}));
  for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],ka=key(a),kb=key(b),sign=ka<kb?1:-1,k=ka<kb?ka+'|'+kb:kb+'|'+ka,entry=edges.get(k);if(entry)entry.balance+=sign;else edges.set(k,{a,b,kind,sign,balance:sign});}
 }
 if(roadIndex.large.length)throw new RangeError('Road footprint exceeds the bounded local construction grid');
 function protectedPoint(x,z){return protectedIndex.at(x,z).some(t=>pointIn(t,x,z));}
 function excludedPoint(x,z){return exclusions.at(x,z).some(t=>pointIn(t,x,z));}
 function coreAt(x,z,includeStructures=true){for(const t of roadIndex.at(x,z)){const b=pointIn(t,x,z);if(b)return excludedPoint(x,z)||wet(x,z)?null:{t,b};}if(!includeStructures)return null;
  let highest=-Infinity,result=null;for(const t of structureIndex.at(x,z)){const b=pointIn(t,x,z);if(!b)continue;const y=value(t,b,1);if(y>highest){highest=y;result={t,b};}}
  return result&&!excludedPoint(x,z)&&!wet(x,z)&&regions.at(x,z).some(r=>inMulti(x,z,r.core))?result:null;
 }
 function addPatch(p,kind,group=null){
  for(const clipped of subtractAll(p,exclusions))triangulate(clipped,triangle=>{
   const cx=triangle.reduce((n,v)=>n+v[0]/3,0),cz=triangle.reduce((n,v)=>n+v[2]/3,0);
   if(wet(cx,cz)||triangle.some(v=>wet(v[0],v[2])))return;
   patches.add(record(triangle,{kind,group}));
  });
 }
 // Beneath asphalt/footways the replacement is a road-shaped solid platform.
 // A footway's vertical back face supplies the exact bottom at its outer edge.
 for(const t of roadIndex.items)t.foundation=t.p.map(v=>[v[0],t.kind==='sidewalk'?Math.min(v[1]-.015,minimum.get(key(v))??v[1]-.05):v[1]-.02,v[2],1]);
 const shoulderRaw=[],shoulderFootprints=[],joins=new Map(),boundary=[];
 const support=(p,kind)=>kind==='sidewalk'?(minimum.get(key(p))??p[1]-.05):p[1]-.02;
 function addWall(a,b,nx,nz,u0,u1){let intervals=[[0,1]];for(const e of [...exclusions.query(bounds([a,b])),...roadIndex.query(bounds([a,b]))]){const cut=lineInterval(a,b,e);if(cut)intervals=intervals.flatMap(interval=>removeIntervals(interval,[cut]));}
  for(const [lo,hi]of intervals){const p=mix(a,b,lo),q=mix(a,b,hi);if(!wet((p[0]+q[0])/2,(p[2]+q[2])/2))wallIndex.add({a:p,b:q,bounds:bounds([p,q]),nx,nz,u0:u0+(u1-u0)*lo,u1:u0+(u1-u0)*hi});}
 }
 for(const edge of edges.values()){yield;
  if(!edge.balance)continue;const [a,b]=Math.sign(edge.balance)===edge.sign?[edge.a,edge.b]:[edge.b,edge.a],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<1e-7)continue;
  const nx=(b[2]-a[2])/length,nz=-(b[0]-a[0])/length,probeA=[a[0]+nx*.025,a[1],a[2]+nz*.025],probeB=[b[0]+nx*.025,b[1],b[2]+nz*.025];let intervals=[[0,1]];
  // A long edge may be only partly covered by a junction arm. Clip its outward
  // probe against the final footprint instead of classifying its midpoint.
  for(const t of roadIndex.query(bounds([probeA,probeB]))){const cut=lineInterval(probeA,probeB,t);if(cut)intervals=intervals.flatMap(interval=>removeIntervals(interval,[cut]));}
  for(const [lo,hi]of intervals)boundary.push({...edge,a:mix(a,b,lo),b:mix(a,b,hi),length:length*(hi-lo),nx,nz});
 }
 const starts=new Map(),visited=new Set();for(const edge of boundary){const k=key(edge.a);if(!starts.has(k))starts.set(k,[]);starts.get(k).push(edge);}
 for(const edge of boundary)perimeterIndex.add({a:edge.a,b:edge.b,bounds:bounds([edge.a,edge.b])});
 for(const t of exclusions.items)for(let i=0;i<3;i++){const a=t.p[i],b=t.p[(i+1)%3];perimeterIndex.add({a,b,bounds:bounds([a,b])});}
 // Texture distance follows a continuous boundary chain, including curved
 // sections. Water/protection cuts do not restart the wall's texture phase.
 for(const seed of boundary){yield;let edge=seed,distance=0;while(edge&&!visited.has(edge)){visited.add(edge);edge.distance=distance;distance+=edge.length;edge=starts.get(key(edge.b))?.find(next=>!visited.has(next));}}
 let nextGroup=0;
 for(const edge of boundary){yield;
  const {a,b,kind,length,nx,nz}=edge;
  const count=Math.max(1,Math.ceil(length/1.25));
  for(let i=0;i<count;i++){
   const aa=mix(a,b,i/count),bb=mix(a,b,(i+1)/count);aa[1]=support(aa,kind);bb[1]=support(bb,kind);
   if(wet(aa[0],aa[2])||wet(bb[0],bb[2])||excludedPoint((aa[0]+bb[0])/2,(aa[2]+bb[2])/2))continue;
   const delta=Math.max(Math.abs(aa[1]-natural(aa[0],aa[2])),Math.abs(bb[1]-natural(bb[0],bb[2]))),width=Math.min(MAX_SHOULDER,Math.max(.4,.4+delta*2.5));
   const toeA=[aa[0]+nx*width,aa[1],aa[2]+nz*width],toeB=[bb[0]+nx*width,bb[1],bb[2]+nz*width],sweep=[aa,bb,toeB,toeA];
   const constrained=protectedIndex.query(bounds(sweep)).some(t=>partition(sweep,t));
   const transition=p=>{const d=Math.abs(p[1]-natural(p[0],p[2])),retain=constrained?1:smooth(Math.max(0,Math.min(1,(d-.3)/.3))),soil=Math.min(MAX_SHOULDER,Math.max(.4,.4+d*2.5));return {retain,reach:soil*(1-retain)+.12*retain};};
   const ta=transition(aa),tb=transition(bb),wall=ta.retain>0||tb.retain>0;
   // A retaining shelf meets the full footway support. Blending a tall dirt
   // slope above a partial wall creates a ragged floating retaining face.
   if(wall){ta.retain=tb.retain=1;ta.reach=tb.reach=.12;}
   const group=nextGroup++;
   const bands=[0,.25,.5,.75,1];
   for(let k=1;k<bands.length;k++){
    const vertex=(p,edge,t)=>[p[0]+nx*edge.reach*t,p[1],p[2]+nz*edge.reach*t,1-smooth(t)*(1-edge.retain)];
    const p=[vertex(aa,ta,bands[k-1]),vertex(bb,tb,bands[k-1]),vertex(bb,tb,bands[k]),vertex(aa,ta,bands[k])];
    triangulate(p,t=>shoulderRaw.push(record(t,{kind:wall?'wall-cap':'shoulder',group})));
   }
   const endA=[aa[0]+nx*ta.reach,aa[1],aa[2]+nz*ta.reach,ta.retain],endB=[bb[0]+nx*tb.reach,bb[1],bb[2]+nz*tb.reach,tb.retain];
   shoulderFootprints.push([[aa,bb,endB,endA].map(p=>[p[0],p[2]])]);
   if(wall)addWall(endA,endB,nx,nz,edge.distance+length*i/count,edge.distance+length*(i+1)/count);
   // Close the small wedges at convex road bends using the adjacent toes.
   for(const [p,toe,u]of [[aa,endA,edge.distance+length*i/count],[bb,endB,edge.distance+length*(i+1)/count]]){const k=key(p);if(!joins.has(k))joins.set(k,[]);joins.get(k).push({p,toe,wall,u});}
  }
 }
 for(const candidates of joins.values()){yield;if(candidates.length===2){
  const [a,b]=candidates,p=[[a.p[0],a.p[1],a.p[2],1],[a.toe[0],a.toe[1],a.toe[2],a.toe[3]],[b.toe[0],b.toe[1],b.toe[2],b.toe[3]]];if(Math.abs(cross(...p))>EPS){shoulderRaw.push(record(p,{kind:'shoulder',group:nextGroup++}));shoulderFootprints.push([p.map(v=>[v[0],v[2]])]);
   if(a.wall||b.wall){const dx=b.toe[0]-a.toe[0],dz=b.toe[2]-a.toe[2],length=Math.hypot(dx,dz);let nx=dz/length,nz=-dx/length;if((a.p[0]-(a.toe[0]+b.toe[0])/2)*nx+(a.p[2]-(a.toe[2]+b.toe[2])/2)*nz>0){nx=-nx;nz=-nz;}addWall(a.toe,b.toe,nx,nz,a.u,a.u+length);}
  }
 }
 }
 // The continuous field gives core pavement precedence at overlaps. Keeping
 // shoulder polygons whole avoids subdividing them by buried kerb profiles.
 for(const t of shoulderRaw){yield;addPatch(t.p,t.kind,t.group);}
 // Work only with clipped local inputs. Intersecting a small tile with an
 // entire city-sized ring repeats that ring's sweep thousands of times.
 const shoulderIndex=new Index();for(const polygon of shoulderFootprints){yield;const p=polygon[0].map(v=>[v[0],0,v[1]]);shoulderIndex.add({p,bounds:bounds(p)});}
 const cells=new Set([...roadIndex.cells.keys(),...patches.cells.keys()]),regionByCell=new Map(),nextRegions=new Map();let reusedRegions=0,builtRegions=0;
 const rectangleClip=(vertices,b)=>{
  let p=vertices.map(v=>[v[0],v[2]]);
  for(const [axis,limit,sign]of [[0,b.minX,1],[0,b.maxX,-1],[1,b.minZ,1],[1,b.maxZ,-1]]){
   if(p.length<3)return null;const out=[];let a=p.at(-1),da=(a[axis]-limit)*sign;
   for(const q of p){const dq=(q[axis]-limit)*sign;if(da*dq<0){const t=da/(da-dq);out.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);}if(dq>=0)out.push(q);a=q;da=dq;}p=out;
  }
  return p.length>=3&&Math.abs(ringArea(p))>EPS?[p]:null;
 };
 const input=(index,b)=>index.query(b).map(t=>rectangleClip(t.p,b)).filter(Boolean);
 for(const key of cells){yield;const [x,z]=key.split(',').map(Number),b={minX:x*CELL,maxX:(x+1)*CELL,minZ:z*CELL,maxZ:(z+1)*CELL},cp=input(roadIndex,b),sp=input(shoulderIndex,b);if(!cp.length&&!sp.length)continue;
  const ep=input(exclusions,b),concrete=input(structureIndex,b),signature=regionCache?JSON.stringify([cp,sp,ep,concrete]):null,cached=regionCache?.cells?.get(key);
  // Cell partitions depend only on these clipped footprints. Heights and
  // materials are fitted afresh below; a cache never stores simulation state.
  if(cached&&cached.signature===signature){const r={...cached.region};regions.add(r);regionByCell.set(key,r);nextRegions.set(key,cached);reusedRegions++;continue;}
  builtRegions++;const exclusion=union(ep);yield;const raw=union(cp);yield;let core=raw,all=union([...raw,...sp]);yield;
  if(concrete.length&&all.length){const covered=boolean('intersection',union(concrete),all);if(covered.length)core=union([...core,...covered]);}
  if(exclusion.length){core=core.length?boolean('difference',core,exclusion):[];all=all.length?boolean('difference',all,exclusion):[];}const shoulder=core.length?boolean('difference',all,core):all;
  if(all.length){const rectangle=[[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ]]],outside=boolean('difference',rectangle,all),r={core,shoulder,all,bounds:b,triangles:[...coverage(core,'core'),...coverage(shoulder,'shoulder'),...coverage(outside,'outside')]};regions.add(r);regionByCell.set(key,r);if(regionCache)nextRegions.set(key,{signature,region:r});}
 }
 const constructionAt=(x,z)=>regions.at(x,z).some(r=>inMulti(x,z,r.all)),perimeter=[],perimeterKeys=new Set();
 for(const region of regions.items)for(const polygon of region.all)for(const ring of polygon)for(let i=1;i<ring.length;i++){yield;
  let a=[Math.fround(ring[i-1][0]),0,Math.fround(ring[i-1][1])],b=[Math.fround(ring[i][0]),0,Math.fround(ring[i][1])],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<1e-5)continue;
  const nx=dz/length,nz=-dx/length,x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,probe=Math.min(.0002,Math.max(.00002,length*.01)),right=constructionAt(x+nx*probe,z+nz*probe),left=constructionAt(x-nx*probe,z-nz*probe);if(right===left)continue;if(right)[a,b]=[b,a];
  const ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka;if(perimeterKeys.has(id))continue;perimeterKeys.add(id);perimeter.push({a,b,ka,kb,id,length,bounds:bounds([a,b])});
 }
 const perimeterStarts=new Map(),perimeterVisited=new Set();for(const edge of perimeter){if(!perimeterStarts.has(edge.ka))perimeterStarts.set(edge.ka,[]);perimeterStarts.get(edge.ka).push(edge);}
 for(const seed of perimeter){let edge=seed,distance=0;while(edge&&!perimeterVisited.has(edge)){perimeterVisited.add(edge);edge.u0=distance;distance+=edge.length;edge.u1=distance;edge=perimeterStarts.get(edge.kb)?.find(next=>!perimeterVisited.has(next));}}
 function field(x,z,base){
  // This is evaluated only for clipped construction vertices. At a protected
  // boundary the construction side retains its elevation; the preserved side
  // is emitted separately. A Float32-sized physical tolerance keeps narrow
  // caps from missing their own edge after canonical coordinate rounding.
  const epsilon=Math.max(1e-5,Math.max(Math.abs(x),Math.abs(z))*2**-22),box={minX:x-epsilon,maxX:x+epsilon,minZ:z-epsilon,maxZ:z+epsilon};
  for(const t of roadIndex.query(box)){const b=pointIn(t,x,z,epsilon);if(b)return t.foundation[0][1]*b[0]+t.foundation[1][1]*b[1]+t.foundation[2][1]*b[2];}
  const groups=new Map();for(const t of patches.query(box)){if(t.kind==='core')continue;const b=pointIn(t,x,z,epsilon);if(!b)continue;const w=Math.max(0,Math.min(1,value(t,b,3))),old=groups.get(t.group);if(!old||w>old.w)groups.set(t.group,{w,y:value(t,b,1)});}
  let numerator=base,denominator=1,edge=0,edgeY=0;
  for(const {w,y}of groups.values()){if(w>=1-1e-8){edge++;edgeY+=y;}else if(w>0){const influence=w/(1-w);numerator+=y*influence;denominator+=influence;}}
  return edge?edgeY/edge:numerator/denominator;
 }
 let rendered=new Index(),usedWalls=new Map(),disposed=false;
 if(regionCache)regionCache.cells=nextRegions;
 const cacheStats={reusedRegions,builtRegions};
 const stats={fallback:false,sourceTriangles:surfaceSnapshot.length,roadTriangles:roadIndex.items.length,patches:regions.items.length,influenceTriangles:patches.items.length,wallSegments:wallIndex.items.length,affectedTriangles:0,replacementTriangles:0,wallTriangles:0,removedCoreArea:0,applications:0};
 function beginApplication(){if(disposed)return;rendered=new Index();usedWalls=new Map();stats.affectedTriangles=stats.replacementTriangles=stats.wallTriangles=stats.removedCoreArea=stats.applications=0;}
 function mayAffectProtectedParcel(polygon){
  const source=polygon?.polygon||polygon;if(disposed||!Array.isArray(source)||source.length<3)return true;
  const p=source.map(v=>Array.isArray(v)?[v[0],0,v.length>2?v[2]:v[1]]:[v.x,0,v.z]);if(p.some(v=>!Number.isFinite(v[0])||!Number.isFinite(v[2])))return true;
  // Use original road triangles, never the already narrowed/protected result:
  // removing an occupant must also restore the unconstrained shoulder.
  // Any endpoint above the .3 cut/fill threshold forces BOTH endpoints to
  // .12 retaining caps regardless of occupancy. Otherwise the widest possible
  // unconstrained sweep is .4+.3*2.5=1.15. Include the full wall thickness.
  const reach=Math.min(MAX_SHOULDER,.4+.3*2.5)+.061,b=bounds(p),query={minX:b.minX-reach,maxX:b.maxX+reach,minZ:b.minZ-reach,maxZ:b.maxZ+reach},ring=p.map(v=>[v[0],v[2]]),distance2=reach*reach;
  for(const road of roadIndex.query(query)){
   if(p.some(v=>pointIn(road,v[0],v[2]))||road.p.some(v=>inRing([v[0],v[2]],ring)))return true;
   for(let i=0;i<p.length;i++)for(let j=0;j<3;j++)if(segmentDistanceSquared(p[i],p[(i+1)%p.length],road.p[j],road.p[(j+1)%3])<=distance2)return true;
  }return false;
 }
 function contains(x,z){
  if(disposed||!Number.isFinite(x)||!Number.isFinite(z)||protectedPoint(x,z)||excludedPoint(x,z))return false;
  const epsilon=Math.max(1e-5,Math.max(Math.abs(x),Math.abs(z))*2**-22);
  if(regions.at(x,z).some(t=>inMulti(x,z,t.all,epsilon)))return true;
  if(regions.query({minX:x-epsilon,maxX:x+epsilon,minZ:z-epsilon,maxZ:z+epsilon}).some(t=>inMulti(x,z,t.all,epsilon)))return true;
  // Retaining thickness also excludes vegetation, including the exposed side
  // of cut walls just beyond the narrow cap footprint.
  for(const wall of wallIndex.query({minX:x-.061,maxX:x+.061,minZ:z-.061,maxZ:z+.061})){
   const dx=wall.b[0]-wall.a[0],dz=wall.b[2]-wall.a[2],length=dx*dx+dz*dz,t=((x-wall.a[0])*dx+(z-wall.a[2])*dz)/length;
   if(t>=0&&t<=1&&Math.hypot(x-wall.a[0]-dx*t,z-wall.a[2]-dz*t)<=.061)return true;
  }return false;
 }
 // The opaque road seals the omitted core top. Queries there use the exact
 // source foundation plane; exposed terrain queries use emitted triangles.
 function sample(x,z){if(disposed||!Number.isFinite(x)||!Number.isFinite(z))return null;const core=coreAt(x,z);if(core)return core.t.foundation.reduce((sum,p,i)=>sum+p[1]*core.b[i],0);let highest=-Infinity;for(const t of rendered.at(x,z)){const b=pointIn(t,x,z);if(b)highest=Math.max(highest,value(t,b,1));}return highest===-Infinity||protectedPoint(x,z)||excludedPoint(x,z)?null:highest;}
 function applyToGeometry(geometry){return finishBuild(applyToGeometrySteps(geometry));}
 function* applyToGeometrySteps(geometry){
  const position=geometry.attributes.position,index=geometry.index,count=index?.count??position.count,start=Math.max(0,geometry.drawRange?.start||0),end=Math.min(count,start+(geometry.drawRange?.count??count));
  // Native triangles retain their original order. A bounded typed buffer avoids
  // growing a boxed-number array and then converting every retained index.
  const keep=new Uint32Array(Math.max(0,Math.ceil((end-start)/3))*3),output=[],walls=[],layout=[],vertexHeights=new Map();let kept=0,offset=3,removedCoreArea=0;
  const retain=(a,b,c)=>{keep[kept++]=a;keep[kept++]=b;keep[kept++]=c;};
  for(const [name,a]of Object.entries(geometry.attributes))if(name!=='position'){layout.push({name,offset,size:a.itemSize,attribute:a});offset+=a.itemSize;}
  const normal=layout.find(a=>a.name==='normal'),read=i=>{const p=[position.getX(i),position.getY(i),position.getZ(i)];for(const {attribute,size}of layout)for(let k=0;k<size;k++)p.push(attribute.array[i*size+k]);return p;};
  const validTriangle=p=>{const a=p[0],b=p[1],c=p[2],longest=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2])),scale=Math.max(Math.abs(a[0]),Math.abs(a[2]),Math.abs(b[0]),Math.abs(b[2]),Math.abs(c[0]),Math.abs(c[2])),tolerance=Math.max(2e-6,scale*2**-22);return Math.abs(cross(a,b,c))>Math.max(EPS,longest*tolerance);};
  const project=p=>{p[0]=Math.fround(p[0]);p[2]=Math.fround(p[2]);if(!p.changed){p[1]=p.nativeY;return p;}let row=vertexHeights.get(p[0]);if(!row)vertexHeights.set(p[0],row=new Map());if(row.has(p[2]))p[1]=row.get(p[2]);else{p[1]=Math.fround(field(p[0],p[2],p.nativeY));row.set(p[2],p[1]);}return p;};
  const normals=vertices=>{if(vertices[0].changed&&normal){const [a,b,c]=vertices,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz)||1;for(const p of vertices){p[normal.offset]=nx/length;p[normal.offset+1]=ny/length;p[normal.offset+2]=nz/length;}}};
  const emit=(polygon,patch=null)=>triangulate(polygon,triangle=>{
   const vertices=triangle.map(v=>{const p=v.slice();p.nativeY=p[1];p.changed=!!patch;return project(p);});if(!validTriangle(vertices))return;normals(vertices);output.push(...vertices);
  });
  for(let i=start;i+2<end;i+=3){if((i-start)%48===0)yield;const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2,
   ax=position.getX(ia),bx=position.getX(ib),cx=position.getX(ic),az=position.getZ(ia),bz=position.getZ(ib),cz=position.getZ(ic),minX=Math.min(ax,bx,cx),maxX=Math.max(ax,bx,cx),minZ=Math.min(az,bz,cz),maxZ=Math.max(az,bz,cz),rb=regions.bounds,wb=wallIndex.bounds;
   if(disposed||!(minX<=rb.maxX&&maxX>=rb.minX&&minZ<=rb.maxZ&&maxZ>=rb.minZ)&&!(minX<=wb.maxX&&maxX>=wb.minX&&minZ<=wb.maxZ&&maxZ>=wb.minZ)){retain(ia,ib,ic);continue;}
   const b={minX,maxX,minZ,maxZ},hasPatches=regions.intersects(b);if(!hasPatches&&!wallIndex.intersects(b)){retain(ia,ib,ic);continue;}
   const ids=[ia,ib,ic],original=ids.map(read);original.bounds=b;const terrain=record(original);let changed=false;
   // Buried core surfaces do not need every kerb/bevel micro-edge. Preserve the
   // native triangle whenever it lies entirely in the union footprint; only a
   // true road/protected/wet perimeter can require an additional terrain cut.
   const buried=original.every(p=>coreAt(p[0],p[2],false))&&!perimeterIndex.query(b).some(edge=>lineInterval(edge.a,edge.b,terrain));
   if(buried){changed=true;removedCoreArea+=area(original);}
   else if(!disposed&&hasPatches){
    const fragments=[];
    for(let x=Math.floor(b.minX/CELL);x<=Math.floor(b.maxX/CELL);x++)for(let z=Math.floor(b.minZ/CELL);z<=Math.floor(b.maxZ/CELL);z++){
     // Intersect disjoint cached cell partitions independently against the
     // original native triangle. No internal clipping diagonal propagates
     // through a growing list of outside fragments, and booleans run once
     // per construction cell rather than three times per terrain triangle.
     const region=regionByCell.get(x+','+z);
     if(region){region.triangleIndex ||= new TerrainPartitionIndex(region.triangles);for(const t of region.triangleIndex.query(b)){const clipped=intersectTriangle(original,t);if(clipped){fragments.push({p:clipped,kind:t.kind});changed ||= t.kind!=='outside';}}}
     else{let p=original;for(const [axis,limit,sign]of [[0,x*CELL,1],[0,(x+1)*CELL,-1],[2,z*CELL,1],[2,(z+1)*CELL,-1]]){if(p.length<3)break;const next=[];let a=p.at(-1),da=(a[axis]-limit)*sign;for(const q of p){const dq=(q[axis]-limit)*sign;if(da*dq<0)next.push(mix(a,q,da/(da-dq)));if(dq>=0)next.push(q);a=q;da=dq;}p=next;}if(p.length>=3&&area(p)>EPS)fragments.push({p,kind:'outside'});}
    }
    if(changed)for(const {p,kind}of fragments){if(kind==='core')removedCoreArea+=area(p);else emit(p,kind==='shoulder'?{kind}:null);}
   }
   if(changed)stats.affectedTriangles++;else retain(ia,ib,ic);
   if(disposed)continue;
  }
  // A common height field is insufficient when one polygon has an extra point
  // on its neighbour's edge. Insert every shared XZ vertex before triangulating
  // with an interior fan, retaining collinear boundary points in 3D as well.
  const unique=new Map(),bins=new Map(),edgeCell=.25;
  let vertexCheckpoint=0;for(const v of output){if(vertexCheckpoint++%128===0)yield;const k=v[0]+','+v[2];if(unique.has(k))continue;const entry={v,order:unique.size};unique.set(k,entry);const x=Math.floor(v[0]/edgeCell),z=Math.floor(v[2]/edgeCell);let row=bins.get(x);if(!row)bins.set(x,row=new Map());let bucket=row.get(z);if(!bucket)row.set(z,bucket=[]);bucket.push(entry);}
  // Scratch containers belong to this application and never escape a step.
  const conformed=[],candidateScratch=[],emptyEdge=[],triangleScratch=[null,null,null],polygonScratch=[],copy=v=>{const p=v.slice();p.nativeY=v.nativeY;p.changed=v.changed;return p;};
  const edgePoints=(a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],length2=dx*dx+dz*dz;if(length2<1e-14)return emptyEdge;
   const epsilon=Math.max(2e-6,Math.max(Math.abs(a[0]),Math.abs(a[2]),Math.abs(b[0]),Math.abs(b[2]))*2**-22),length=Math.sqrt(length2),x0=Math.floor(Math.min(a[0],b[0])-epsilon),x1=Math.floor(Math.max(a[0],b[0])+epsilon),z0=Math.floor(Math.min(a[2],b[2])-epsilon),z1=Math.floor(Math.max(a[2],b[2])+epsilon),candidates=candidateScratch;candidates.length=0;
   const add=entry=>{const {v,order}=entry,t=((v[0]-a[0])*dx+(v[2]-a[2])*dz)/length2;if(t<=1e-6||t>=1-1e-6||Math.abs(dx*(v[2]-a[2])-dz*(v[0]-a[0]))>epsilon*length)return;candidates.push({v,t,order});};
   const large=(x1-x0+1)*(z1-z0+1)>4096;
   if(large)for(const entry of unique.values())add(entry);else{const sx0=Math.floor((Math.min(a[0],b[0])-epsilon)/edgeCell),sx1=Math.floor((Math.max(a[0],b[0])+epsilon)/edgeCell),sz0=Math.floor((Math.min(a[2],b[2])-epsilon)/edgeCell),sz1=Math.floor((Math.max(a[2],b[2])+epsilon)/edgeCell);for(let x=sx0;x<=sx1;x++){const row=bins.get(x);if(row)for(let z=sz0;z<=sz1;z++)for(const entry of row.get(z)||[])add(entry);}}
   if(!candidates.length)return emptyEdge;
   // Equal projected positions keep the original coarse-cell/insertion order.
   candidates.sort((a,b)=>a.t-b.t||(large?0:Math.floor(a.v[0])-Math.floor(b.v[0])||Math.floor(a.v[2])-Math.floor(b.v[2]))||a.order-b.order);return candidates.map(({v,t})=>{const p=mix(a,b,t);p[0]=v[0];p[2]=v[2];p.nativeY=a.nativeY+(b.nativeY-a.nativeY)*t;p.changed=a.changed;return project(p);});
  };
  for(let i=0;i<output.length;i+=3){if(i%48===0)yield;const triangle=triangleScratch,polygon=polygonScratch;triangle[0]=output[i];triangle[1]=output[i+1];triangle[2]=output[i+2];polygon.length=0;let split=false;
   for(let edge=0;edge<3;edge++){const a=triangle[edge],b=triangle[(edge+1)%3],points=edgePoints(a,b);polygon.push(a,...points);split ||= points.length>0;}
   // emit() already validated these unchanged vertices.
   if(!split){conformed.push(...triangle);continue;}
   const center=triangle[0].map((_,k)=>(triangle[0][k]+triangle[1][k]+triangle[2][k])/3);center.nativeY=(triangle[0].nativeY+triangle[1].nativeY+triangle[2].nativeY)/3;center.changed=triangle[0].changed;project(center);
   for(let j=0;j<polygon.length;j++){const child=[copy(center),copy(polygon[j]),copy(polygon[(j+1)%polygon.length])];if(!validTriangle(child))continue;normals(child);conformed.push(...child);}
  }
  for(let i=0;i<conformed.length;i+=3){if(i%192===0)yield;if(conformed[i].changed){const p=[conformed[i],conformed[i+1],conformed[i+2]].map(v=>[...v.slice(0,3).map(Math.fround),v.nativeY]);if(Math.abs(cross(...p))>EPS)rendered.add(record(p));}
  }
 // Authoritative union outlines own the wall runs. Final clipped triangles
  // can contain coincident edges after Float32 rounding, so incident-face
  // counts cannot decide whether an exterior wall exists. Fit each perimeter
  // interval to the actual final shoulder plane, including its original base.
  const boundaryWalls=[];
  for(const edge of perimeter){yield;
   const epsilon=Math.max(2e-5,Math.max(Math.abs(edge.a[0]),Math.abs(edge.a[2]),Math.abs(edge.b[0]),Math.abs(edge.b[2]))*2**-22),box={minX:edge.bounds.minX-epsilon,maxX:edge.bounds.maxX+epsilon,minZ:edge.bounds.minZ-epsilon,maxZ:edge.bounds.maxZ+epsilon},contacts=[];
   for(const t of rendered.query(box)){const range=lineInterval(edge.a,edge.b,t,epsilon);if(range)contacts.push({t,range});}if(!contacts.length)continue;
   const knots=[...new Set(contacts.flatMap(c=>c.range))].sort((a,b)=>a-b),used=usedWalls.get(edge.id)||[],inherited=used.slice(),fitted=[],active=[];
   contacts.forEach((c,i)=>c.order=i);const entering=contacts.slice().sort((a,b)=>a.range[0]-b.range[0]||a.order-b.order),leaving=contacts.slice().sort((a,b)=>a.range[1]-b.range[1]||a.order-b.order);let enter=0,leave=0;
   const locate=order=>{let lo=0,hi=active.length;while(lo<hi){const mid=(lo+hi)>>>1;if(active[mid].order<order)lo=mid+1;else hi=mid;}return lo;};
   for(let i=1;i<knots.length;i++){const lo=knots[i-1],hi=knots[i],mid=(lo+hi)/2;
    while(enter<entering.length&&entering[enter].range[0]<=mid){const c=entering[enter++];active.splice(locate(c.order),0,c);}while(leave<leaving.length&&leaving[leave].range[1]<mid){const c=leaving[leave++],at=locate(c.order);if(active[at]===c)active.splice(at,1);}
    if((hi-lo)*edge.length<1e-6)continue;const p=mix(edge.a,edge.b,mid);let contact=null,highest=-Infinity;
    for(const c of active){const weights=pointIn(c.t,p[0],p[2],epsilon*2);if(!weights)continue;const y=value(c.t,weights,1);if(y>highest){highest=y;contact=c.t;}}if(!contact)continue;
    // New intervals are disjoint and ordered; only prior applications can
    // overlap this interval. Appending still records ownership for near/far.
    for(const [start,end]of removeIntervals([lo,hi],inherited)){const a=mix(edge.a,edge.b,start),b=mix(edge.a,edge.b,end),wa=pointIn(contact,a[0],a[2],epsilon*2),wb=pointIn(contact,b[0],b[2],epsilon*2);if(!wa||!wb)continue;a[1]=value(contact,wa,1);b[1]=value(contact,wb,1);a.nativeY=value(contact,wa,3);b.nativeY=value(contact,wb,3);
     if(Math.max(Math.abs(a[1]-a.nativeY),Math.abs(b[1]-b.nativeY))<.015)continue;
     const previous=fitted.at(-1),join=previous&&Math.abs(previous.end-start)*edge.length<1e-6&&Math.abs(previous.b[1]-a[1])<1e-5&&Math.abs(previous.b.nativeY-a.nativeY)<1e-5;
     let merge=false;if(join){const length=(end-previous.start)*edge.length,t=(previous.end-previous.start)/(end-previous.start),top=previous.a[1]+(b[1]-previous.a[1])*t,base=previous.a.nativeY+(b.nativeY-previous.a.nativeY)*t;merge=Math.abs(top-previous.b[1])<1e-6&&Math.abs(base-previous.b.nativeY)<1e-6&&length>0;}
     if(merge){previous.b=b;previous.end=end;}else fitted.push({a,b,start,end});used.push([start,end]);
    }
   }usedWalls.set(edge.id,used);
   for(const {a,b,start,end}of fitted){const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);boundaryWalls.push({a,b,nx:dz/length,nz:-dx/length,u0:edge.u0+edge.length*start,u1:edge.u0+edge.length*end});}
  }
  for(const wall of boundaryWalls){yield;const {a,b,nx,nz,u0:ua,u1:ub}=wall,ya=a.nativeY,yb=b.nativeY,fill=a[1]+b[1]>=ya+yb,side=fill?-1:1,thickness=.06;
   // A three-centimetre coping stands above the soil shelf. Raising the whole
   // closed upper rim keeps side/end faces joined and avoids a coplanar grass
   // and concrete cap without changing terrain or adding clipping work.
   const topA=Math.max(a[1],ya)+.006,topB=Math.max(b[1],yb)+.006;
   const p=[a[0],Math.min(a[1],ya),a[2],ua,Math.min(a[1],ya)],q=[a[0],topA,a[2],ua,topA],r=[b[0],topB,b[2],ub,topB],s=[b[0],Math.min(b[1],yb),b[2],ub,Math.min(b[1],yb)];
   const back=v=>[v[0]+nx*thickness*side,v[1],v[2]+nz*thickness*side,v[3],v[4]],pp=back(p),qq=back(q),rr=back(r),ss=back(s),quad=(a,b,c,d,reverse=false)=>{if(reverse)walls.push(a,c,b,a,d,c);else walls.push(a,b,c,a,c,d);};
   quad(p,q,r,s,!fill);quad(pp,ss,rr,qq,!fill);
   // Caps have a second physical UV dimension across their thickness. Using
   // only wall-distance/world-height collapses cap UVs and breaks normal maps.
   const uv=(p,u,v)=>[p[0],p[1],p[2],u,v];
   quad(q,uv(qq,ua,q[4]+thickness),uv(rr,ub,r[4]+thickness),r,!fill);
   quad(p,s,uv(ss,ub,s[4]+thickness),uv(pp,ua,p[4]+thickness),!fill);
   quad(p,uv(pp,ua+thickness,p[4]),uv(qq,ua+thickness,q[4]),q,!fill);
   quad(s,r,uv(rr,ub+thickness,r[4]),uv(ss,ub+thickness,s[4]),!fill);
  }
  stats.applications++;stats.replacementTriangles+=conformed.length/3;stats.wallTriangles+=walls.length/3;stats.removedCoreArea+=removedCoreArea;
  const replacement=yield* geometryFromSteps(conformed,layout);let wallGeometry,complete=false;
  try{wallGeometry=walls.length?yield* geometryFromSteps(walls,[{name:'uv',offset:3,size:2}]):null;complete=true;}finally{if(!complete)replacement.dispose();}
  return {indices:kept===keep.length?keep:keep.slice(0,kept),replacement,walls:wallGeometry,removedCoreArea,stats:{...stats}};
 }
 return {surfaceSnapshot,structuralSnapshot,beginApplication,applyToGeometry,applyToGeometrySteps,sample,contains,excluded:contains,mayAffectProtectedParcel,stats,cacheStats,
  rebuild(options={}){return createRoadEarthworks({world,surfaces:surfaceSnapshot,structuralSurfaces:structuralSnapshot,bridgePlan,groundHeight,wetness,protectedParcels,...options});},
  dispose(){disposed=true;rendered=new Index();usedWalls.clear();for(const index of [patches,wallIndex,structureIndex]){index.cells.clear();index.items.length=0;index.large.length=0;}}};
}
