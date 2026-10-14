import {Walking,sidewalkPosition} from './walking.js?v=49';
import {roadPoint} from './traffic.js?v=49';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const nearby=(engine,i)=>engine.neighbors(i);
export const stopPosition=sidewalkPosition;
export function transitLeg(traffic,from,to,fromDepot=false){
 const starts=fromDepot?nearby(traffic.engine,from).filter(i=>traffic.graph.has(i)):[from];
 for(const start of starts){const cells=traffic.trace(traffic.search(start),to);if(cells){let points=traffic.route(cells,null,false);points=[fromDepot?roadPoint(from):stopPosition(traffic,from),...points,stopPosition(traffic,to)];if(points.length<2)continue;return {cells,points};}}return null;
}
export function planBusLine(world,traffic,stops){
 if(!Array.isArray(stops)||stops.length<2||stops.length>12||new Set(stops).size!==stops.length||stops.some(i=>!Number.isInteger(i)||!traffic.graph.has(i)))return {ok:false,reason:'Choose 2–12 different road stops.'};
 const legs=stops.map((s,i)=>transitLeg(traffic,s,stops[(i+1)%stops.length]));if(legs.some(l=>!l))return {ok:false,reason:'Every stop must connect to the next, including the return to the first stop.'};
 let depot=-1,entry=null;for(let i=0;i<world.tiles.length;i++)if(world.tiles[i].type==='bus'&&world.tiles[i].level){const route=transitLeg(traffic,i,stops[0],true);if(route){depot=i;entry=route;break;}}
 if(!entry)return {ok:false,reason:'Build a bus depot with road access to the first stop.'};return {ok:true,legs,entry,depot,cost:500+stops.length*100};
}
export function createBusLine(world,traffic,stops){
 if((world.transit?.lines.length||0)>=8)return {ok:false,reason:'This city can operate up to 8 bus lines.'};const plan=planBusLine(world,traffic,stops);if(!plan.ok)return plan;if(world.money<plan.cost)return {ok:false,reason:'Not enough funds for the bus and stops.'};
 world.transit ||= {version:1,nextId:1,lines:[]};const id=world.transit.nextId++;const line={id,name:'Line '+id,stops:[...stops],depot:plan.depot,boardings:0,completed:0,vehicle:{leg:-1,phase:'moving',dwell:0,segment:0,distance:0,...roadPoint(plan.depot),heading:0}};world.transit.lines.push(line);world.money-=plan.cost;return {ok:true,line,cost:plan.cost};
}
export class Transit{
 constructor(world,traffic){this.world=world;this.traffic=traffic;this.entries=new Map();this.passengers=new Map();this.journeyCache=new Map();this.walking=new Walking(world,traffic);this.passengerRoutes=new Map();this.rebuild();}
 syncPassengers(){const people=this.world.citizens?.residents;if(people===this.peopleSource)return;this.peopleSource=people;this.passengers=new Map((people||[]).filter(r=>r.transit).map(r=>[r.id,r]));for(const id of this.passengerRoutes.keys())if(!this.passengers.has(id))this.passengerRoutes.delete(id);}
 rebuild(){if(this.walkingReady)this.walking.rebuild();this.walkingReady=true;this.walkRevision=this.world.walkRevision||0;this.passengerRoutes.clear();this.journeyCache.clear();const lines=this.world.transit?.lines||[],ids=new Set(lines.map(l=>l.id));for(const [id,e]of this.entries)if(!ids.has(id)){e.agent.active=false;this.entries.delete(id);}
 for(const line of lines){const plan=planBusLine(this.world,this.traffic,line.stops);let entry=this.entries.get(line.id);if(!entry){const agent=this.traffic.agents.find(a=>a.kind==='bus'&&!a.active&&![...this.entries.values()].some(e=>e.agent===a))||this.traffic.addAgent();agent.kind='bus';agent.length=2.1;entry={line,agent};this.entries.set(line.id,entry);}entry.plan=plan;entry.line=line;entry.stopPositions=line.stops.map(stop=>stopPosition(this.traffic,stop));
 if(!plan.ok){entry.agent.active=false;entry.reason=plan.reason;continue;}entry.reason='';if(this.world.tiles[line.depot]?.type!=='bus'){entry.reason='Original depot removed';entry.agent.active=false;continue;}
 if(!entry.agent.active){const dwell=line.vehicle.phase==='dwell',remaining=line.vehicle.dwell;this.launch(entry,true);if(dwell){line.vehicle.phase='dwell';line.vehicle.dwell=remaining;entry.agent.hold=true;}}
 }this.graph=this.traffic.graph;this.lineKey=lines.map(l=>l.id+':'+l.stops.join(',')).join(';');}
 launch(entry,restore=false){const {line,plan,agent}=entry,v=line.vehicle,route=v.leg<0?transitLeg(this.traffic,line.depot,line.stops[0],true):plan.legs[v.leg];if(!route){entry.reason='Route disconnected';return false;}
 const segment=restore?Math.min(v.segment,route.points.length-2):0,p=route.points[segment],q=route.points[segment+1],distance=restore?Math.min(v.distance,dist(p,q)):0;
 Object.assign(agent,{hold:false,kind:'bus',length:2.1,active:true,arrived:false,residentId:null,previousX:undefined,previousZ:undefined,phase:'bus',trip:{destination:line.stops[v.leg<0?0:(v.leg+1)%line.stops.length],cells:[route.cells],roads:new Set(route.cells)},points:route.points,segment,distance,dwell:0,speed:0,stopTime:0,stopJunction:null,x:restore?v.x:p.x,z:restore?v.z:p.z,heading:restore?v.heading:Math.atan2(q.x-p.x,q.z-p.z)});v.phase='moving';return true;}
 request(r,to,purpose){const origin=roadPoint(r.location),destination=roadPoint(to),direct=dist(origin,destination);if(r.id%3===0||direct<10)return false;const key=r.location+':'+to;let choice=this.journeyCache.get(key)||null;
 if(!this.journeyCache.has(key)){
  // Stop geometry changes only when the network or line is rebuilt. Compute
  // walkable catchments once per stop; cache the selected journey per address pair.
  for(const entry of this.entries.values()){if(entry.reason)continue;const first=entry.stopPositions.map(p=>dist(origin,p)>16?Infinity:this.walking.route(r.location,p)?.length??Infinity),last=entry.stopPositions.map(p=>dist(destination,p)>16?Infinity:this.walking.route(p,to)?.length??Infinity);
   for(let a=0;a<first.length;a++){if(first[a]>16)continue;for(let b=0;b<last.length;b++){if(a===b||last[b]>16)continue;const walk=first[a]+last[b];if(walk>direct*.9)continue;if(!choice||walk<choice.walk)choice={line:entry.line.id,board:a,alight:b,walk};}}
  }
  if(this.journeyCache.size>=4096)this.journeyCache.delete(this.journeyCache.keys().next().value);this.journeyCache.set(key,choice);
 }
 if(!choice)return false;r.transit={line:choice.line,board:choice.board,alight:choice.alight,from:r.location,to,purpose,phase:'walk',...origin};r.activity='Walking to bus stop';this.passengers.set(r.id,r);return true;}
 movePassenger(r,target,dt){const t=r.transit,key=t.phase+':'+target.x+':'+target.z;let entry=this.passengerRoutes.get(r.id);
 if(!entry||entry.key!==key){entry={key,route:this.walking.route(t,target,[t.from,t.to]),segment:0};this.passengerRoutes.set(r.id,entry);}
 if(!entry.route){r.activity='Waiting for walking access';return false;}return this.walking.advance(t,entry.route,entry,dt);}

 finish(r,time){const t=r.transit;r.location=t.to;r.activity=t.purpose==='work'?'Working':t.purpose==='shop'?'Shopping':'Home';if(t.purpose==='work')r.workdays++;if(t.purpose==='shop')r.shopping++;r.nextAt=time+(t.purpose==='work'?24:t.purpose==='shop'?8:20)+r.id%7;delete r.transit;this.passengers.delete(r.id);this.passengerRoutes.delete(r.id);}
 update(dt){if(dt<=0)return;if(this.walkRevision!==(this.world.walkRevision||0)||this.graph!==this.traffic.graph||this.lineKey!==(this.world.transit?.lines||[]).map(l=>l.id+':'+l.stops.join(',')).join(';'))this.rebuild();this.walking.update(dt);this.syncPassengers();const people=this.passengers.values(),time=this.world.citizens?.time||0;let byLine=null;
 for(const entry of this.entries.values()){const {line,agent}=entry,v=line.vehicle;if(entry.reason)continue;if(v.phase==='moving'){if(agent.active){Object.assign(v,{segment:agent.segment,distance:agent.distance,x:agent.x,z:agent.z,heading:agent.heading});}else if(agent.arrived){agent.arrived=false;agent.active=true;agent.hold=true;Object.assign(v,{x:agent.x,z:agent.z,heading:agent.heading});v.leg=v.leg<0?0:(v.leg+1)%line.stops.length;v.phase='dwell';v.dwell=4;v.segment=0;v.distance=0;}else{entry.reason='Route interrupted';}}
 if(v.phase==='dwell'){
 // Build the boarding index only while buses dwell, once per simulation step.
 if(!byLine){byLine=new Map();for(const r of this.passengers.values()){const id=r.transit?.line;let group=byLine.get(id);if(!group){group=[];byLine.set(id,group);}group.push(r);}}
 const riders=byLine.get(line.id)||[];let aboard=riders.filter(r=>r.transit?.line===line.id&&r.transit.phase==='ride').length;for(const r of riders){const t=r.transit;if(t?.line!==line.id)continue;if(t.phase==='ride'&&t.alight===v.leg){t.phase='lastWalk';t.x=v.x;t.z=v.z;r.activity='Walking from bus stop';line.completed++;aboard--;}else if(t.phase==='wait'&&t.board===v.leg&&aboard<24){t.phase='ride';r.activity='Riding '+line.name;line.boardings++;aboard++;}}
 v.dwell=Math.max(0,v.dwell-dt);if(v.dwell<=0)this.launch(entry);}}
 for(const r of people){const t=r.transit;if(!t)continue;const entry=this.entries.get(t.line);if((!this.world.tiles[t.to]?.level&&t.phase!=='return')||((!entry||entry.reason)&&!['return','lastWalk'].includes(t.phase))){t.phase='return';r.activity='Walking back · bus service unavailable';}
 if(t.phase==='ride'){t.x=entry.agent.active?entry.agent.x:entry.line.vehicle.x;t.z=entry.agent.active?entry.agent.z:entry.line.vehicle.z;}
 else if(t.phase==='walk'&&this.movePassenger(r,entry.stopPositions[t.board],dt)){t.phase='wait';r.activity='Waiting for '+entry.line.name;}
 else if(t.phase==='lastWalk'&&this.movePassenger(r,roadPoint(t.to),dt))this.finish(r,time);
 else if(t.phase==='return'&&this.movePassenger(r,roadPoint(t.from),dt)){r.location=t.from;r.activity='Home · bus service unavailable';r.nextAt=time+10;delete r.transit;this.passengers.delete(r.id);this.passengerRoutes.delete(r.id);}
 }
 }
 get summary(){this.syncPassengers();const people=[...this.passengers.values()];return {lines:this.entries.size,buses:[...this.entries.values()].filter(e=>!e.reason).length,waiting:people.filter(r=>r.transit?.phase==='wait').length,riding:people.filter(r=>r.transit?.phase==='ride').length,completed:(this.world.transit?.lines||[]).reduce((n,l)=>n+l.completed,0)};}
}
