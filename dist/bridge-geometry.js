import {bridgeWidth} from './bridge-spans.js?v=123';
import * as THREE from './vendor/three.module.js';
import {atDistance,distanceSection} from './street-geometry.js?v=123';
import {junctionCuts,clearRanges} from './road-junction-plan.js?v=123';
// Concrete profiles and rail sections are swept along the complete crossing.
// One buffer per material is added to the existing static road batches.
export function bridgeGeometry(plan,height,ground,junctions=[]){
 const parts={concrete:[],metal:[]};let piers=0;
 const quad=(target,a,b,c,d)=>parts[target].push(...a,...b,...c,...a,...c,...d);
 const point=(p,u,h)=>[p.x+p.nx*u,height(p.x+p.nx*u,p.z+p.nz*u)+h,p.z+p.nz*u];
 function sweep(points,profile,target='concrete'){
  const profiles=points.map(p=>profile(p));for(let i=1;i<points.length;i++)for(let k=0;k<profiles[i].length;k++){const next=(k+1)%profiles[i].length,a=profiles[i-1][k],b=profiles[i-1][next],c=profiles[i][next],d=profiles[i][k];quad(target,point(points[i-1],...a),point(points[i-1],...b),point(points[i],...c),point(points[i],...d));}
  for(const [p,profile,reverse]of [[points[0],profiles[0],true],[points.at(-1),profiles.at(-1),false]])for(let i=1;i<profile.length-1;i++){const triangle=[point(p,...profile[0]),point(p,...profile[i]),point(p,...profile[i+1])];if(reverse)triangle.reverse();parts[target].push(...triangle.flat());}
 }
 function box(p,across,along,bottom,top,target='concrete'){
  const local=(u,v,y)=>[p.x+p.nx*u+p.tx*v,y,p.z+p.nz*u+p.tz*v],a=across/2,b=along/2;
  const corners=[local(-a,-b,bottom),local(a,-b,bottom),local(a,b,bottom),local(-a,b,bottom),local(-a,-b,top),local(a,-b,top),local(a,b,top),local(-a,b,top)];
  for(const [a,b,c,d]of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]])quad(target,corners[a],corners[b],corners[c],corners[d]);
 }
 for(const span of plan.spans){const points=span.points,edge=p=>p.width/2+(span.sidewalk?.42:.2);
  // Clockwise transverse profiles yield outward side faces and an upward deck.
  sweep(points,p=>[[-edge(p),.06],[edge(p),.06],[edge(p)-.1,-.31],[-edge(p)+.1,-.31]]);
  for(const side of [-1,1])sweep(points,p=>{const x=side*p.width*.26;return [[x-.12,-.28],[x+.12,-.28],[x+.08,-.52],[x-.08,-.52]];});
  const cuts=junctionCuts(points,junctions,.2),ranges=clearRanges(span.start,span.end,cuts);
  for(const [start,end]of ranges){if(end-start<.05)continue;const section=distanceSection(points,start,end);section.forEach(p=>{p.width=bridgeWidth(points,p.distance);});
   for(const side of [-1,1]){
    const foot=span.sidewalk?.14:.08;
    sweep(section,p=>{const x=side*(edge(p)-.065);return [[x-.065,foot],[x+.065,foot],[x+.04,foot+.1],[x-.04,foot+.1]];});
    sweep(section,p=>{const x=side*(edge(p)-.065),top=foot+.25;return [[x-.018,top-.018],[x+.018,top-.018],[x+.018,top+.018],[x-.018,top+.018]];},'metal');
    for(let d=start+.15;d<end;d+=.55){const p=atDistance(section,d),width=bridgeWidth(section,d),offset=side*(width/2+(span.sidewalk?.42:.2)-.065);p.x+=p.nx*offset;p.z+=p.nz*offset;const y=height(p.x,p.z);box(p,.026,.035,y+foot+.09,y+foot+.24,'metal');}
   }
  }
  const count=Math.max(1,Math.ceil((span.end-span.start)/8));for(let i=1;i<count;i++){const p=atDistance(points,span.start+(span.end-span.start)*i/count),width=bridgeWidth(points,p.distance),top=height(p.x,p.z)-.38,bottom=ground(p.x,p.z)-.18;if(top-bottom<.35)continue;box(p,Math.min(1.05,width*.34),.44,bottom,top-.15);box(p,width*.78,.6,top-.18,top);piers++;}
  for(const [isShore,p]of [[span.shoreStart,points[0]],[span.shoreEnd,points.at(-1)]])if(isShore){const top=height(p.x,p.z)-.03,bottom=ground(p.x,p.z)-.2;if(top>bottom)box(p,edge(p)*2,.65,bottom,top);}
 }
 const geometries={};for(const [name,positions]of Object.entries(parts)){if(!positions.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingSphere();geometries[name]=g;}return {geometries,piers};
}
