import {roundaboutLimit} from './roundabout-traffic.js?v=124';
// Route geometry and intersection control, independent of rendering.
export function smoothRoute(points) {
 const clean=points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>.001);
 if(clean.length<3)return clean;
 const result=[clean[0]];
 for(let i=1;i<clean.length-1;i++){
  const a=clean[i-1],b=clean[i],c=clean[i+1],ab=Math.hypot(b.x-a.x,b.z-a.z),bc=Math.hypot(c.x-b.x,c.z-b.z);
  if(((b.x-a.x)*(c.x-b.x)+(b.z-a.z)*(c.z-b.z))/(ab*bc)>.999){result.push(b);continue;}
  const radius=Math.min(1.15,ab*.35,bc*.35),start={x:b.x+(a.x-b.x)*radius/ab,z:b.z+(a.z-b.z)*radius/ab},end={x:b.x+(c.x-b.x)*radius/bc,z:b.z+(c.z-b.z)*radius/bc};
  result.push(start);for(let n=1;n<=6;n++){const t=n/6,u=1-t;result.push({x:u*u*start.x+2*u*t*b.x+t*t*end.x,z:u*u*start.z+2*u*t*b.z+t*t*end.z});}
 }
 result.push(clean.at(-1));return result;
}
export function signalPhase(time,axis){const phase=((time%20)+20)%20,local=(phase+(axis==='x'?0:10))%20;return local<7?'green':local<9?'amber':'red';}
export function junctionPolicy(world,id){return world?.roundabouts?.[id]?'roundabout':world?.junctionControls?.[id]||world?.trafficPolicy||'signals';}
export function setJunctionPolicy(world,id,policy){
 if(!/^junction\/-?\d{1,7}\/-?\d{1,7}$/.test(id)||!['default','signals','stop'].includes(policy))return false;
 // Replace only the settings object. Roads, cached routes and an occupied
 // intersection's reservation remain intact while its current vehicle clears.
 if(policy!=='default'&&!world.junctionControls?.[id]&&Object.keys(world.junctionControls||{}).length>=2304)return false;
 const settings={...world.junctionControls};if(policy==='default')delete settings[id];else settings[id]=policy;
 if(Object.keys(settings).length)world.junctionControls=settings;else delete world.junctionControls;
 return true;
}
export class Junctions {
 constructor(graph,point,geometry){this.items=[];
  if(geometry){this.routes=new WeakMap();this.items=geometry.filter(j=>j.arms.length>=3).map(j=>({id:'junction/'+Math.round(j.x*10000)+'/'+Math.round(j.z*10000),cells:[],x:j.x,z:j.z,radius:j.radius+1.2,roundabout:j.roundabout,owner:null}));return;}
 this.routes=new WeakMap();const candidates=new Set([...graph.keys()].filter(i=>{return [i%48?i-1:-1,i%48<47?i+1:-1,i-48,i+48].filter(n=>graph.has(n)).length>=3;}));
  while(candidates.size){const first=candidates.values().next().value,cells=[first];candidates.delete(first);for(let k=0;k<cells.length;k++)for(const n of [cells[k]-1,cells[k]+1,cells[k]-48,cells[k]+48])if(candidates.delete(n))cells.push(n);const points=cells.map(point),x=points.reduce((s,p)=>s+p.x,0)/points.length,z=points.reduce((s,p)=>s+p.z,0)/points.length,radius=Math.max(...points.map(p=>Math.hypot(p.x-x,p.z-z)))+1.8;this.items.push({id:first,cells,x,z,radius,owner:null});}
 }
 route(points){if(this.routes.has(points))return this.routes.get(points);const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));const gates=[];
  // Segment-circle intersections also catch long, unsampled straight roads.
  for(const junction of this.items){let entry=Infinity,exit=-Infinity,axis='x';for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],dx=q.x-p.x,dz=q.z-p.z,length=distances[i+1]-distances[i],a=dx*dx+dz*dz;if(!a)continue;const ox=p.x-junction.x,oz=p.z-junction.z,b=2*(ox*dx+oz*dz),c=ox*ox+oz*oz-junction.radius**2,disc=b*b-4*a*c;if(disc<0)continue;const lo=Math.max(0,(-b-Math.sqrt(disc))/(2*a)),hi=Math.min(1,(-b+Math.sqrt(disc))/(2*a));if(lo>hi)continue;const begin=distances[i]+lo*length,end=distances[i]+hi*length;if(begin<entry){entry=begin;axis=Math.abs(dx)>Math.abs(dz)?'x':'z';}exit=Math.max(exit,end);}
   if(Number.isFinite(entry)){let mergeAngle=0,mergeDistance=entry;if(junction.roundabout){const s=junction.roundabout,k=points.findIndex((p,i)=>distances[i]>=entry&&Math.abs(Math.hypot(p.x-junction.x,p.z-junction.z)-s.ring)<.02);if(k>=0){const p=points[k];mergeAngle=Math.atan2(p.z-junction.z,p.x-junction.x);mergeDistance=distances[k];}}gates.push({junction,entry,exit,axis,mergeAngle,mergeDistance});}}
  const result={distances,gates:gates.sort((a,b)=>a.entry-b.entry)};this.routes.set(points,result);return result;
 }
 limit(agent,time,dt,policy,agents,spatial){const route=this.route(agent.points),position=(route.distances[agent.segment]??route.distances.at(-1))+(agent.distance||0);let limit=Infinity;agent.waitReason='';agent.turnSpeed=Infinity;agent.circulatingJunction=null;
  for(const gate of route.gates){const j=gate.junction;if(j.owner&&(!j.owner.active||j.owner.points!==j.owner.gatePoints))j.owner=null;
   if(position>gate.exit){if(agent.roundaboutEntry?.id===j.id)agent.roundaboutEntry=null;if(position>gate.exit+1.4&&j.owner===agent)j.owner=null;continue;}
   if(position<gate.entry-9)break;
   if(j.roundabout){if(Math.abs(Math.hypot(agent.x-j.x,agent.z-j.z)-j.roundabout.ring)<.12)agent.circulatingJunction=j;limit=Math.min(limit,roundaboutLimit(agent,gate,position,agents,spatial));continue;}
   if(j.owner===agent)continue;
   const remaining=Math.max(0,gate.entry-position-.3);
   if(remaining>1){limit=Math.min(limit,remaining+2);continue;}
   agent.stopTime=(agent.stopJunction===j.id?agent.stopTime||0:0)+(remaining<.1&&(agent.speed||0)<.2?dt:0);agent.stopJunction=j.id;
   const blocked=spatial?.occupied?spatial.occupied(j,j.radius-.05,agent):agents.some(b=>b!==agent&&b.active&&Math.hypot(b.x-j.x,b.z-j.z)<j.radius-.05);
   const control=typeof policy==='string'?policy:junctionPolicy(policy,j.id),phase=signalPhase(time,gate.axis),allowed=control==='stop'?agent.stopTime>=.8:phase==='green';
   if(!j.owner&&!blocked&&allowed){j.owner=agent;agent.gatePoints=agent.points;agent.stopTime=0;}
   else{limit=Math.min(limit,remaining);agent.waitReason=j.owner||blocked?'Intersection occupied':control==='stop'?'Stop sign':phase==='amber'?'Amber signal':'Red signal';}
  }
  return limit;
 }
}
