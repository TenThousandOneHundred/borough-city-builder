import {bridgeWidth} from './bridge-spans.js?v=158';
import * as THREE from './vendor/three.module.js';
import {atDistance,distanceSection} from './street-geometry.js?v=158';
import {junctionCuts,clearRanges} from './road-junction-plan.js?v=158';
import {SIDEWALK_HEIGHT,ASPHALT_HEIGHT} from './road-profile.js?v=158';
// Concrete profiles and rail sections are swept along the complete crossing.
// One buffer per material is added to the existing static road batches.
export function bridgeGeometry(plan,height,ground,junctions=[],pavement=[],stationsForSpan=span=>span.points){
 const parts={concrete:[],metal:[]},stationHeights=new Map();let piers=0;
 const quad=(target,a,b,c,d)=>parts[target].push(...a,...b,...c,...a,...c,...d);
 // Adjacent sweep faces repeat their station/offset vertices. Height lookup is
 // the expensive part; cache it only for this build, leaving the emitted
 // vertices and their ordering exactly as authored.
 const point=(p,u,h)=>{let offsets=stationHeights.get(p);if(!offsets){offsets=new Map();stationHeights.set(p,offsets);}let sample=offsets.get(u);if(!sample){const x=p.x+p.nx*u,z=p.z+p.nz*u;sample=[x,height(x,z),z];offsets.set(u,sample);}return [sample[0],sample[1]+h,sample[2]];};
 function sweep(points,profile,target='concrete'){
  const profiles=points.map(p=>profile(p));for(let i=1;i<points.length;i++)for(let k=0;k<profiles[i].length;k++){const next=(k+1)%profiles[i].length,a=profiles[i-1][k],b=profiles[i-1][next],c=profiles[i][next],d=profiles[i][k];quad(target,point(points[i-1],...a),point(points[i-1],...b),point(points[i],...c),point(points[i],...d));}
  for(const [p,profile,reverse]of [[points[0],profiles[0],true],[points.at(-1),profiles.at(-1),false]])for(let i=1;i<profile.length-1;i++){const triangle=[point(p,...profile[0]),point(p,...profile[i]),point(p,...profile[i+1])];if(reverse)triangle.reverse();parts[target].push(...triangle.flat());}
 }
 function box(p,across,along,bottom,top,target='concrete'){
  const local=(u,v,y)=>[p.x+p.nx*u+p.tx*v,y,p.z+p.nz*u+p.tz*v],a=across/2,b=along/2;
  const corners=[local(-a,-b,bottom),local(a,-b,bottom),local(a,b,bottom),local(-a,b,bottom),local(-a,-b,top),local(a,-b,top),local(a,b,top),local(-a,b,top)];
  for(const [a,b,c,d]of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]])quad(target,corners[a],corners[b],corners[c],corners[d]);
 }
 for(const span of plan.spans){const points=stationsForSpan(span),edge=p=>p.width/2+(span.sidewalk?.42:.2);
  // Clockwise transverse profiles yield outward side faces and an upward deck.
  sweep(points,p=>[[-edge(p),.06],[edge(p),.06],[edge(p)-.1,-.31],[-edge(p)+.1,-.31]]);
  for(const side of [-1,1])sweep(points,p=>{const x=side*p.width*.26;return [[x-.12,-.28],[x+.12,-.28],[x+.08,-.52],[x-.08,-.52]];});
  const cuts=junctionCuts(points,junctions,.2),ranges=clearRanges(span.start,span.end,cuts);
  for(const [start,end]of ranges){if(end-start<.05)continue;const section=distanceSection(points,start,end);section.forEach(p=>{p.width=bridgeWidth(points,p.distance);});
   // The road's paint sampling is much denser than slender rails need.
   // Simplify only metal sweeps, bounding both rail-edge 3D errors to 5 mm.
   const railSamples=section.map(p=>[-1,1].flatMap(side=>[-.012,.012].map(offset=>point(p,side*(edge(p)-.065)+offset,0))));
   const kept=new Set([0,section.length-1]),pending=[[0,section.length-1]];
   while(pending.length){const [a,b]=pending.pop();let worst=.001,index=-1;for(let i=a+1;i<b;i++){const t=(section[i].distance-section[a].distance)/(section[b].distance-section[a].distance);let error=0;for(let k=0;k<4;k++)error=Math.max(error,Math.hypot(...railSamples[i][k].map((v,c)=>v-(railSamples[a][k][c]+(railSamples[b][k][c]-railSamples[a][k][c])*t))));if(error>worst){worst=error;index=i;}}if(index>=0){kept.add(index);pending.push([a,index],[index,b]);}}
   const railSection=[...kept].sort((a,b)=>a-b).map(i=>section[i]);
   for(const side of [-1,1]){
    const foot=span.sidewalk?SIDEWALK_HEIGHT:ASPHALT_HEIGHT;
    sweep(section,p=>{const x=side*(edge(p)-.065);return [[x-.065,foot],[x+.065,foot],[x+.04,foot+.1],[x-.04,foot+.1]];});
    for(const level of [.13,.25])sweep(railSection,p=>{const x=side*(edge(p)-.065),top=foot+level;return [[x-.012,top-.012],[x+.012,top-.012],[x+.012,top+.012],[x-.012,top+.012]];},'metal');
    for(let d=start+.15;d<end;d+=.55){const p=atDistance(section,d),width=bridgeWidth(section,d),offset=side*(width/2+(span.sidewalk?.42:.2)-.065);p.x+=p.nx*offset;p.z+=p.nz*offset;const y=height(p.x,p.z);box(p,.026,.035,y+foot+.09,y+foot+.24,'metal');}
   }
  }
  const count=Math.max(1,Math.ceil((span.end-span.start)/8));for(let i=1;i<count;i++){const p=atDistance(points,span.start+(span.end-span.start)*i/count),width=bridgeWidth(points,p.distance),top=height(p.x,p.z)-.38,bottom=ground(p.x,p.z)-.18;if(top-bottom<.35)continue;box(p,Math.min(1.05,width*.34),.44,bottom,top-.15);box(p,width*.78,.6,top-.18,top);piers++;}
  for(const [isShore,p]of [[span.shoreStart,points[0]],[span.shoreEnd,points.at(-1)]])if(isShore){const top=height(p.x,p.z)-.03,bottom=ground(p.x,p.z)-.2;if(top>bottom)box(p,edge(p)*2,.65,bottom,top);}
 }
 const contact=fitConcrete(parts.concrete,pavement);parts.concrete=contact.positions;
 const geometries={};for(const [name,positions]of Object.entries(parts)){if(!positions.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingSphere();geometries[name]=g;}return {geometries,piers,contact:{changed:contact.changed,before:contact.before,after:contact.positions.length/9}};
}

// A deck and an abutment can cross several final pavement planes, especially
// where a junction replaced the original road strip. Trim their local upper
// surface to those actual triangles, leaving the soffit and exposed edges in
// place. Sampling only the two outer deck vertices cannot cover this case.
function fitConcrete(positions,pavement){
 const before=positions.length/9;if(!pavement.length||!positions.length)return {positions,before,changed:0};
 const rows=new Map(),roofs=[],oversized=[],cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
 const bounds=([a,b,c])=>({x0:Math.min(a[0],b[0],c[0]),x1:Math.max(a[0],b[0],c[0]),z0:Math.min(a[2],b[2],c[2]),z1:Math.max(a[2],b[2],c[2])});
 for(const geometry of pavement){const p=geometry.attributes.position,index=geometry.index,count=index?.count??p.count;
  for(let i=0;i<count;i+=3){const v=[0,1,2].map(k=>{const n=index?index.getX(i+k):i+k;return [p.getX(n),p.getY(n)-.02,p.getZ(n)];}),den=cross(...v);if(Math.abs(den)<1e-12)continue;
   if(!v.flat().every(Number.isFinite))continue;
   const roof={v,den,minY:Math.min(...v.map(p=>p[1])),...bounds(v),id:roofs.length};roofs.push(roof);
   if((Math.floor(roof.x1/4)-Math.floor(roof.x0/4)+1)*(Math.floor(roof.z1/4)-Math.floor(roof.z0/4)+1)>4096){oversized.push(roof);continue;}
   for(let x=Math.floor(roof.x0/4);x<=Math.floor(roof.x1/4);x++){let row=rows.get(x);if(!row){row=new Map();rows.set(x,row);}for(let z=Math.floor(roof.z0/4);z<=Math.floor(roof.z1/4);z++){let cell=row.get(z);if(!cell){cell=[];row.set(z,cell);}cell.push(roof);}}
  }
 }
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 function split(polygon,distance){const positive=[],negative=[];let a=polygon.at(-1),da=distance(a);for(const b of polygon){const db=distance(b);if(da*db<0){const p=mix(a,b,da/(da-db));positive.push(p);negative.push(p);}if(db>=0)positive.push(b);if(db<=0)negative.push(b);a=b;da=db;}return {positive,negative};}
 function inside(polygon,roof){let remaining=polygon;const outside=[];for(let k=0;k<3&&remaining.length>=3;k++){const a=roof.v[k],b=roof.v[(k+1)%3],result=split(remaining,p=>Math.sign(roof.den)*cross(a,b,p));if(result.negative.length>=3)outside.push(result.negative);remaining=result.positive;}return {remaining,outside};}
 const roofHeight=(roof,p)=>{const [a,b,c]=roof.v,u=((p[0]-a[0])*(c[2]-a[2])-(p[2]-a[2])*(c[0]-a[0]))/roof.den,v=((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]))/roof.den;return a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);};
 const output=[];let changed=0;
 function emit(polygon){for(let k=1;k<polygon.length-1;k++){const a=polygon[0],b=polygon[k],c=polygon[k+1],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-10)output.push(...a,...b,...c);}}
 for(let i=0;i<positions.length;i+=9){const triangle=[positions.slice(i,i+3),positions.slice(i+3,i+6),positions.slice(i+6,i+9)],b=bounds(triangle),maxY=Math.max(triangle[0][1],triangle[1][1],triangle[2][1]),candidates=[];
  const add=roof=>{if(roof.visit!==i&&maxY>roof.minY+1e-7&&roof.x0<=b.x1&&roof.x1>=b.x0&&roof.z0<=b.z1&&roof.z1>=b.z0){roof.visit=i;candidates.push(roof);}};
  if((Math.floor(b.x1/4)-Math.floor(b.x0/4)+1)*(Math.floor(b.z1/4)-Math.floor(b.z0/4)+1)>4096)for(const roof of roofs)add(roof);
  else{for(let x=Math.floor(b.x0/4);x<=Math.floor(b.x1/4);x++)for(let z=Math.floor(b.z0/4);z<=Math.floor(b.z1/4);z++)for(const roof of rows.get(x)?.get(z)||[])add(roof);for(const roof of oversized)add(roof);}
  let pending=[triangle],modified=false;
  for(const roof of candidates){const next=[];for(const polygon of pending){const distance=p=>p[1]-roofHeight(roof,p);
    // Height difference between two planes is affine: a face whose original
    // vertices are safely below the roof cannot intrude after polygon clipping.
    // The conservative margin leaves all near-contact cases on the exact path.
    if(polygon.every(p=>distance(p)<-1e-6)){next.push(polygon);continue;}
    const {remaining,outside}=inside(polygon,roof);if(remaining.length<3||!remaining.some(p=>distance(p)>1e-7)){next.push(polygon);continue;}
    modified=true;next.push(...outside);const {positive,negative}=split(remaining,distance);if(negative.length>=3)emit(negative);if(positive.length>=3)emit(positive.map(p=>[p[0],roofHeight(roof,p),p[2]]));
   }pending=next;if(!pending.length)break;}
  if(modified)changed++;for(const polygon of pending)emit(polygon);
 }
 return {positions:output,before,changed};
}
