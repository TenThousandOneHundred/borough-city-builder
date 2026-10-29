import './roundabout-state.js?v=147';
const R=globalThis.BoroughRoundabouts,TAU=Math.PI*2;
export const roundaboutKey=R.key;
const polar=(j,r,a)=>({x:j.x+r*Math.cos(a),z:j.z+r*Math.sin(a)});
const armPoint=(j,a,d,o)=>({x:j.x+a.tx*d-a.tz*o,z:j.z+a.tz*d+a.tx*o});
export function roundaboutCorners(j){const s=j.roundabout;return j.arms.map((a,i)=>{
 const b=j.arms[(i+1)%j.arms.length],start=Math.atan2(a.tz,a.tx)+Math.asin(a.width/2/s.outer);let end=Math.atan2(b.tz,b.tx)-Math.asin(b.width/2/s.outer);while(end<start)end+=TAU;
 const blend=Math.min(.18,(end-start)/4),lo=start+blend,hi=end-blend,p=armPoint(j,a,s.radius,a.width/2),q=armPoint(j,b,s.radius,-b.width/2),u=polar(j,s.outer,lo),v=polar(j,s.outer,hi),h=.5;
 const points=[p,...cubic(p,{x:p.x-a.tx*h,z:p.z-a.tz*h},{x:u.x+Math.sin(lo)*h,z:u.z-Math.cos(lo)*h},u)],steps=Math.max(2,Math.ceil((hi-lo)/.08));for(let n=1;n<=steps;n++)points.push(polar(j,s.outer,lo+(hi-lo)*n/steps));points.push(...cubic(v,{x:v.x-Math.sin(hi)*h,z:v.z+Math.cos(hi)*h},{x:q.x-b.tx*h,z:q.z-b.tz*h},q));for(const p of points){const d=Math.hypot(p.x-j.x,p.z-j.z);if(d<s.outer){p.x=j.x+(p.x-j.x)*s.outer/d;p.z=j.z+(p.z-j.z)*s.outer/d;}}return {points,sidewalk:true};
});}
function at(points,distances,d){let i=1;while(i<points.length-1&&distances[i]<d)i++;const a=points[i-1],b=points[i],t=(d-distances[i-1])/(distances[i]-distances[i-1]||1);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};}
function cubic(a,b,c,d){const points=[];for(let i=1;i<=12;i++){const t=i/12,u=1-t;points.push({x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,z:u*u*u*a.z+3*u*u*t*b.z+3*u*t*t*c.z+t*t*t*d.z});}return points;}
// Clip lane polylines at the approach, then join a clockwise circulating lane.
// Built only on route/road edits; residents, deliveries and buses share it.
export function roundaboutRoute(source,junctions){let points=source;
 for(const j of junctions){const s=j.roundabout;if(!s||points.length<2)continue;const ds=[0];for(let i=1;i<points.length;i++)ds.push(ds[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));let entry=Infinity,exit=-Infinity;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,ox=a.x-j.x,oz=a.z-j.z,A=dx*dx+dz*dz,B=2*(ox*dx+oz*dz),C=ox*ox+oz*oz-s.radius*s.radius,D=B*B-4*A*C;if(A<1e-10||D<0)continue;const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));if(lo>hi)continue;entry=Math.min(entry,ds[i-1]+lo*Math.sqrt(A));exit=Math.max(exit,ds[i-1]+hi*Math.sqrt(A));}
  if(!Number.isFinite(entry)||exit-entry<.2)continue;
  const a=at(points,ds,entry),d=at(points,ds,exit);let start=Math.atan2(a.z-j.z,a.x-j.x)-.28,end=Math.atan2(d.z-j.z,d.x-j.x)+.28;while(end>=start)end-=TAU;
  // A trip beginning/ending on an approach is projected to the circulating
  // lane; it may never cut across the grass island.
  const b=polar(j,s.ring,start),c=polar(j,s.ring,end),ain=at(points,ds,Math.min(exit,entry+.05)),dout=at(points,ds,Math.max(entry,exit-.05)),al=Math.hypot(ain.x-a.x,ain.z-a.z)||1,dl=Math.hypot(d.x-dout.x,d.z-dout.z)||1,handle=Math.min(.75,(s.radius-s.ring)*.55),prefix=points.filter((_,i)=>ds[i]<entry-1e-6),suffix=points.filter((_,i)=>ds[i]>exit+1e-6);
  const part=[a,...cubic(a,{x:a.x+(ain.x-a.x)/al*handle,z:a.z+(ain.z-a.z)/al*handle},{x:b.x-Math.sin(start)*handle,z:b.z+Math.cos(start)*handle},b)];
  const count=Math.ceil((start-end)/.09);for(let k=1;k<=count;k++)part.push(polar(j,s.ring,start+(end-start)*k/count));
  part.push(...cubic(c,{x:c.x+Math.sin(end)*handle,z:c.z-Math.cos(end)*handle},{x:d.x-(d.x-dout.x)/dl*handle,z:d.z-(d.z-dout.z)/dl*handle},d));
  for(const p of part){const dx=p.x-j.x,dz=p.z-j.z,len=Math.hypot(dx,dz),min=s.island+.55;if(len<min){p.x=j.x+dx/(len||1)*min;p.z=j.z+dz/(len||1)*min;}}
  points=[...prefix,...part,...suffix];
 }return points;
}
export function roundaboutQuote(world,engine,junctions,id,size,height){const q=R.quote(world,junctions,id,size,engine);if(!q.ok||size==='none'||!height)return q;const s=q.shape,heights=[];for(let i=0;i<16;i++){const a=i/16*TAU;heights.push(height(world,s.x+Math.cos(a)*s.radius,s.z+Math.sin(a)*s.radius));}if(Math.max(...heights)-Math.min(...heights)>.9)return {...q,ok:false,reason:'This ground is too steep. Level the junction first.'};return q;}
