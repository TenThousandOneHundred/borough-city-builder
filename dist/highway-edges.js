import {atDistance} from './street-geometry.js';
// Cut roadside detail wherever a ramp and another highway share pavement.
// This is a build-time spatial lookup; traffic retains its authored sources.
export function highwayEdges(roads){
 if(!roads.some(r=>r.spec.mergeEdges))return {blocked:()=>false,sections:(_id,stations)=>[stations]};
 const bins=new Map(),byId=new Map(roads.map(r=>[r.id,r]));
 for(const road of roads){if(!road.spec.limitedAccess)continue;const s=road.stations;for(let i=1;i<s.length;i++){
  const a=s[i-1],b=s[i],wa=road.widthAt?.(a)??road.spec.width,wb=road.widthAt?.(b)??road.spec.width,pad=Math.max(wa,wb)/2,segment={road,a,b,wa,wb};
  for(let x=Math.floor((Math.min(a.x,b.x)-pad)/8);x<=Math.floor((Math.max(a.x,b.x)+pad)/8);x++)for(let z=Math.floor((Math.min(a.z,b.z)-pad)/8);z<=Math.floor((Math.max(a.z,b.z)+pad)/8);z++){const key=x+','+z;let list=bins.get(key);if(!list)bins.set(key,list=[]);list.push(segment);}
 }}
 const blocked=(id,p,offset,widerOnly=false)=>{const own=byId.get(id),x=p.x+p.nx*offset,z=p.z+p.nz*offset;
  for(const s of bins.get(Math.floor(x/8)+','+Math.floor(z/8))||[]){if(s.road.id===id||(!own?.spec.mergeEdges&&!s.road.spec.mergeEdges))continue;
   const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,l=dx*dx+dz*dz;if(l<1e-12)continue;const t=((x-s.a.x)*dx+(z-s.a.z)*dz)/l;if(t<0||t>1)continue;
   const width=s.wa+(s.wb-s.wa)*t;if(widerOnly&&width<=(own.widthAt?.(p)??own.spec.width)+.01)continue;if(Math.hypot(x-s.a.x-dx*t,z-s.a.z-dz*t)<width/2+.015)return true;
  }return false;
 };
 return {blocked,sections(id,stations,offset,widerOnly=false){
  if(stations.length<2)return [];const start=stations[0].distance,end=stations.at(-1).distance,ds=new Set(stations.map(p=>p.distance));for(let d=start+.25;d<end;d+=.25)ds.add(d);
  const samples=[...ds].sort((a,b)=>a-b).map(d=>atDistance(stations,d)),result=[];let run=[];
  const hidden=p=>blocked(id,p,offset(p),widerOnly);if(!samples.some(hidden))return [stations];const emit=()=>{if(run.length>1)result.push(run);run=[];};
  for(let i=0;i<samples.length;i++){const p=samples[i],b=hidden(p);if(i){const a=samples[i-1],was=hidden(a);if(was!==b){let lo=a.distance,hi=p.distance;for(let n=0;n<16;n++){const mid=(lo+hi)/2,q=atDistance(stations,mid);if(hidden(q)===was)lo=mid;else hi=mid;}const edge=atDistance(stations,was?hi:lo);if(was)run.push(edge);else{run.push(edge);emit();}}}if(!b)run.push(p);}emit();return result;
 }};
}
