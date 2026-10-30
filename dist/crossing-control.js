import {pedestrianNetwork} from './pedestrian-network.js?v=157';
import {signalPhase,junctionPolicy} from './junctions.js?v=157';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const controller=c=>'junction/'+Math.round(c.junction.x*10000)+'/'+Math.round(c.junction.z*10000);
export function crossingPhase(world,c,time){if(!c.junction||junctionPolicy(world,controller(c))!=='signals')return 'uncontrolled';const axis=Math.abs(c.arm.tx)>Math.abs(c.arm.tz)?'z':'x';return signalPhase(time,axis)==='green'?'walk':'wait';}
function local(c,p){const dx=p.x-c.center.x,dz=p.z-c.center.z;return [dx*c.arm.tx+dz*c.arm.tz,-dx*c.arm.tz+dz*c.arm.tx];}
// Clip a segment against the actual painted crossing, including the curb edge.
function clip(c,a,b,walking){const p=local(c,a),q=local(c,b),bounds=[c.halfDepth+.02,c.arm.width/2+(walking?.12:.08)];let lo=0,hi=1;for(let k=0;k<2;k++){const d=q[k]-p[k];if(Math.abs(d)<1e-9){if(Math.abs(p[k])>bounds[k])return null;continue;}let u=(-bounds[k]-p[k])/d,v=(bounds[k]-p[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}return [lo,hi];}
export class CrossingControl {
 constructor(traffic){this.traffic=traffic;this.claims=new Map();this.rebuild();}
 rebuild(){const network=pedestrianNetwork(this.traffic.world,this.traffic.engine);if(this.network===network)return;this.network=network;this.crossings=network.crossings;this.routes=new WeakMap();this.walkRoutes=new WeakMap();this.claims.clear();this.seeded=false;
  this.bins=new Map();for(const c of this.crossings){const r=c.halfWidth+.4;for(let x=Math.floor((c.center.x-r)/8);x<=Math.floor((c.center.x+r)/8);x++)for(let z=Math.floor((c.center.z-r)/8);z<=Math.floor((c.center.z+r)/8);z++){const key=x+':'+z;if(!this.bins.has(key))this.bins.set(key,[]);this.bins.get(key).push(c);}}
 }
 route(points,walking=false){const cache=walking?this.walkRoutes:this.routes;if(cache.has(points))return cache.get(points);const distances=[0],ranges=new Map();
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b),offset=distances.at(-1);distances.push(offset+length);const nearby=new Set();for(let x=Math.floor(Math.min(a.x,b.x)/8);x<=Math.floor(Math.max(a.x,b.x)/8);x++)for(let z=Math.floor(Math.min(a.z,b.z)/8);z<=Math.floor(Math.max(a.z,b.z)/8);z++)for(const c of this.bins.get(x+':'+z)||[])nearby.add(c);
   for(const c of nearby){const hit=clip(c,a,b,walking);if(!hit||length*(hit[1]-hit[0])<1e-6)continue;const entry=offset+hit[0]*length,exit=offset+hit[1]*length,list=ranges.get(c)||[],last=list.at(-1);if(last&&entry-last.exit<1e-5)last.exit=exit;else list.push({crossing:c,entry,exit});ranges.set(c,list);}
  }
  const result={distances,gates:[...ranges.values()].flat().filter(g=>!walking||g.exit-g.entry>.35).sort((a,b)=>a.entry-b.entry)};cache.set(points,result);return result;
 }
 seed(){if(this.seeded)return;this.seeded=true;for(const r of this.traffic.world.citizens?.residents||[]){const s=r.walk||(r.transit&&['walk','lastWalk','return'].includes(r.transit.phase)?r.transit:null);if(!s)continue;for(const c of this.bins.get(Math.floor(s.x/8)+':'+Math.floor(s.z/8))||[]){const [u,v]=local(c,s);if(Math.abs(u)<=c.halfDepth+.02&&Math.abs(v)<c.arm.width/2+.12)this.claims.set(s,{crossing:c,occupied:true,time:this.traffic.time});}}}
 live(c){for(const [state,claim]of this.claims){if(this.traffic.time-claim.time>.26){this.claims.delete(state);continue;}if(claim.crossing===c&&(claim.occupied||crossingPhase(this.traffic.world,c,this.traffic.time)!=='wait'))return true;}return false;}
 vehicleLimit(a){this.seed();if(!this.claims.size)return Infinity;const route=this.route(a.points),position=(route.distances[a.segment]??route.distances.at(-1))+(a.distance||0);let result=Infinity;
  for(const gate of route.gates){const stop=gate.entry-(a.length||.9)/2-.18;if(position>stop+.04)continue;if(stop-position>12)break;if(this.live(gate.crossing)){result=Math.min(result,Math.max(0,stop-position));a.waitReason='Pedestrian crossing';}}
  return result;
 }
 clearForPedestrian(c){
  // Nearby cars include held buses; a vehicle already covering the crossing
  // must be allowed to clear before anybody steps off the curb.
  const t=this.traffic,nearby=t.agents.length>=48?t.spatial.nearby(c.center,c.halfWidth+5):t.agents;
  for(const a of nearby){if(!a.active)continue;const [u,v]=local(c,a);if(Math.abs(v)>c.arm.width/2+.4)continue;const length=a.length||.9,along=Math.sin(a.heading)*c.arm.tx+Math.cos(a.heading)*c.arm.tz,cover=length/2+c.halfDepth+.16;
   if(Math.abs(u)<cover)return false;
   if((a.speed||0)>.2&&u*along<0&&Math.abs(u)-cover<a.speed**2/6+.08)return false;
  }return true;
 }
 walkLimit(state,points,segment){this.seed();const route=this.route(points,true),p=points[segment],position=(route.distances[segment]??route.distances.at(-1))+(p?distance(p,state):0);let limit=Infinity;state.waitReason='';
  for(const gate of route.gates){if(position>=gate.exit+.03)continue;if(position<gate.entry-.16)return Math.max(0,gate.entry-.12-position);const c=gate.crossing,old=this.claims.get(state),inside=position>gate.entry+.01,admitted=inside||old?.crossing===c&&old.occupied;
   if(admitted){this.claims.set(state,{crossing:c,occupied:true,time:this.traffic.time});return Infinity;}
   if(crossingPhase(this.traffic.world,c,this.traffic.time)==='wait'){this.claims.delete(state);state.waitReason='Waiting for crossing signal';return Math.max(0,gate.entry-.12-position);}
   const clear=this.clearForPedestrian(c);this.claims.set(state,{crossing:c,occupied:clear,time:this.traffic.time});if(!clear){state.waitReason='Waiting for crossing to clear';limit=Math.max(0,gate.entry-.12-position);}return limit;
  }
  this.claims.delete(state);return limit;
 }
 release(state){this.claims.delete(state);}
}
