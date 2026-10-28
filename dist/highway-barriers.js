import * as THREE from './vendor/three.module.js';
import {atDistance} from './street-geometry.js';
import {junctionCuts,clearSections} from './road-junction-plan.js';
import {ASPHALT_HEIGHT} from './road-profile.js';
// Five metres per world unit. Corrugated steel is 0.75 m high with posts
// every 2.5 m. One static mesh covers all authored ground-level highways.
export function highwayBarriers(roads,junctions,height,onBridge){
 const vertices=[];let runs=0,posts=0;
 const quad=(a,b,c,d)=>vertices.push(...a,...b,...c,...a,...c,...d);
 const point=(p,u,y)=>{const x=p.x+p.nx*u,z=p.z+p.nz*u;return [x,height(x,z)+ASPHALT_HEIGHT+y,z];};
 function post(p,u){
  const x=p.x+p.nx*u,z=p.z+p.nz*u,y=height(x,z)+ASPHALT_HEIGHT;
  const local=(a,b,h)=>[x+p.nx*a+p.tx*b,y+h,z+p.nz*a+p.tz*b];
  const c=[local(-.012,-.018,-.06),local(.012,-.018,-.06),local(.012,.018,-.06),local(-.012,.018,-.06),local(-.012,-.018,.16),local(.012,-.018,.16),local(.012,.018,.16),local(-.012,.018,.16)];
  for(const [a,b,d,e]of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]])quad(c[a],c[b],c[d],c[e]);posts++;
 }
 for(const road of roads){if(!road.spec.limitedAccess||road.stations.length<2)continue;
  const stations=road.stations,cuts=junctionCuts(stations,junctions,.45);
  // Sample every 3.75 m instead of copying dense paint stations.
  // Both sides use the same visible road datum.
  for(const section of clearSections(stations,cuts)){
   const start=section[0].distance,end=section.at(-1).distance,ds=new Set([start,end]);
   for(let d=start+.75;d<end;d+=.75)ds.add(d);
   const samples=[...ds].sort((a,b)=>a-b).map(d=>atDistance(stations,d));let run=[],bridgeStart=false;
   const emit=(bridgeEnd=false)=>{if(run.length<2){run=[];return;}const length=run.at(-1).distance-run[0].distance;if(length<.3){run=[];return;}runs++;
    for(const side of [-1,1]){
     const join=p=>Math.max(bridgeStart?Math.max(0,1-(p.distance-run[0].distance)/2):0,bridgeEnd?Math.max(0,1-(run.at(-1).distance-p.distance)/2):0);
     const profile=p=>{const width=road.widthAt?road.widthAt(p):road.spec.width,t=join(p),blend=t*t*(3-2*t),u=side*(width/2-.025+.16*blend),terminal=Math.min(1,bridgeStart?1:(p.distance-run[0].distance)/.3,bridgeEnd?1:(run.at(-1).distance-p.distance)/.3),base=.045+.035*terminal+.02*blend;
      // Closed thin W-section, mirrored toward traffic on each shoulder.
      const face=[[0,0],[-.012,.014],[0,.03],[-.012,.046],[0,.06]],back=face.map(([x,y])=>[x+.004,y]).reverse();
      return [...face,...back].map(([x,y])=>point(p,u+side*x,base+y));};
     const profiles=run.map(profile);
     for(let i=1;i<run.length;i++)for(let k=0;k<10;k++){const n=(k+1)%10;const q=[profiles[i-1][k],profiles[i-1][n],profiles[i][n],profiles[i][k]];if(side<0)q.reverse();quad(...q);}
     // End plates close each terminal without an open steel edge.
     for(const [p,reverse]of [[profiles[0],side>0],[profiles.at(-1),side<0]])for(let k=1;k<9;k++){const t=[p[0],p[k],p[k+1]];if(reverse)t.reverse();vertices.push(...t.flat());}
     for(let d=run[0].distance+.15;d<run.at(-1).distance-.05;d+=.5){const p=atDistance(stations,d);const t=join(p);post(p,side*((road.widthAt?road.widthAt(p):road.spec.width)/2-.007+.16*t*t*(3-2*t)));}
    }run=[];
   };
   // Locate each shore boundary to sub-millimetre precision rather than
   // dropping the last full sample interval. Keep the endpoint on dry ground.
   const boundary=(a,b,aWet)=>{let lo=a.distance,hi=b.distance;for(let n=0;n<18;n++){const d=(lo+hi)/2,p=atDistance(stations,d);if(!!onBridge(p.x,p.z)===aWet)lo=d;else hi=d;}return atDistance(stations,aWet?hi:lo);};
   const visit=(a,b)=>{const aWet=!!onBridge(a.x,a.z),bWet=!!onBridge(b.x,b.z);
    if(aWet!==bWet){const shore=boundary(a,b,aWet);if(aWet){bridgeStart=true;run=[shore,b];}else{run.push(shore);emit(true);bridgeStart=false;}}
    else if(!bWet){if(!run.length)run.push(a);run.push(b);}
   };
   // Midpoint checks retain short bridge exclusions between dry samples.
   for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],m=atDistance(stations,(a.distance+b.distance)/2);if(!!onBridge(a.x,a.z)===!!onBridge(m.x,m.z)&&!!onBridge(b.x,b.z)===!!onBridge(m.x,m.z))visit(a,b);else{visit(a,m);visit(m,b);}}emit();
  }
 }
 if(!vertices.length)return {geometry:null,runs,posts};
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();return {geometry,runs,posts};
}
