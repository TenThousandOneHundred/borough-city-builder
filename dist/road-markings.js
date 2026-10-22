import {atDistance} from './street-geometry.js?v=93';
import {laneLayout} from './road-lanes.js?v=93';
// Static travel guidance, not new lane restrictions. Through approaches show
// forward arrows; terminal approaches show the available turn directions.
export function approachMarkings(roads,junctions){
 const byId=new Map(roads.map(r=>[r.id,r])),result=[];
 for(const j of junctions){if(j.arms.length<3)continue;
  for(const arm of j.arms){if(arm.spec.oneway&&arm.sign>0)continue;
   const road=byId.get(arm.roadId);if(!road||!arm.spec.sidewalk)continue;
   let nearest=Infinity,along=0;const s=road.stations;
   for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;if(!l)continue;const f=Math.max(0,Math.min(1,((j.x-a.x)*dx+(j.z-a.z)*dz)/l)),d=(a.x+dx*f-j.x)**2+(a.z+dz*f-j.z)**2;if(d<nearest){nearest=d;along=a.distance+(b.distance-a.distance)*f;}}
   const distance=along+arm.sign*(j.radius+2.6);if(distance<.65||distance>s.at(-1).distance-.65)continue;
   const p=atDistance(s,distance),tx=-arm.sign*p.tx,tz=-arm.sign*p.tz,nx=-tz,nz=tx;
   if(junctions.some(other=>other!==j&&Math.hypot(other.x-p.x,other.z-p.z)<other.radius+1.2))continue;
   const exits=j.arms.filter(a=>a!==arm&&(!a.spec.oneway||a.sign>0)),directions=new Set();
   for(const exit of exits){const forward=-arm.tx*exit.tx-arm.tz*exit.tz,right=arm.tz*exit.tx-arm.tx*exit.tz;if(forward>.65)directions.add('straight');else directions.add(right>0?'right':'left');}
   const turns=directions.has('straight')?['straight']:[...directions].sort();if(!turns.length)continue;
   const layout=laneLayout(arm.spec),offsets=layout.forward;
   for(const offset of offsets){
    const center={x:p.x+nx*offset,z:p.z+nz*offset};
    result.push({roadId:road.id,junction:j,center,tx,tz,turns,width:Math.min(.42,arm.width/(arm.spec.lanes||2)*.65)});
   }
  }
 }
 return result;
}
export function arrowPolygons(turns){
 const shapes=[[[-.035,-.45],[.035,-.45],[.035,.02],[-.035,.02]]];
 if(turns.includes('straight')){shapes.push([[-.035,0],[.035,0],[.035,.22],[-.035,.22]],[[-.17,.16],[.17,.16],[0,.45]]);}
 for(const [name,side]of [['left',-1],['right',1]])if(turns.includes(name)){
  shapes.push([[0,-.035],[side*.25,-.035],[side*.25,.035],[0,.035]],[[side*.21,-.15],[side*.4,0],[side*.21,.15]]);
 }
 return shapes;
}
