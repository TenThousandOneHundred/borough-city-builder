import {yieldsToCirculating} from './roundabout-traffic.js?v=141';
// Bound the leader search by the distance that can affect this step. Longer
// gaps cannot reduce cruising speed or displacement. A driver just starting
// may still report a distant queue, so retain the original full-corridor query
// when that diagnostic can survive the step and no nearer leader was found.
export function followingClearance(a,forward,heading,clearance,cruise,dt,agents,spatial){
 const horizon=Math.max(cruise*cruise/6,dt*cruise),reach=Math.min(clearance,horizon)+((a.length||.9)+(spatial?.maxLength||.9))*.5+.75+1e-6;
 const bounded=!!spatial?.leaders&&Number.isFinite(reach);
 let candidates=bounded?spatial.leaders(a,forward,reach):spatial?.corridor?spatial.corridor(a,forward):agents,found=false,retry=bounded;
 while(true){
  for(const b of candidates){if(b===a||!b.active||b.dwell||yieldsToCirculating(a,b))continue;const dx=b.x-a.x,dz=b.z-a.z,ahead=dx*forward.x+dz*forward.z,lateral=Math.abs(dx*forward.z-dz*forward.x);
   if(ahead>0&&lateral<.65&&Math.cos(b.heading-heading)>.3&&ahead-((a.length||.9)+(b.length||.9))*.5-.75<clearance){clearance=Math.max(0,ahead-((a.length||.9)+(b.length||.9))*.5-.75);a.waitReason='Vehicle queue';found=true;}
  }
  if(!retry||found||clearance<=horizon||dt*Math.min(cruise,a.turnSpeed??Infinity,(a.speed||0)+dt*3)>.02)break;
  candidates=spatial.corridor(a,forward);retry=false;
 }
 return clearance;
}
