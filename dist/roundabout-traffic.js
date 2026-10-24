const TAU=Math.PI*2,angle=(p,j)=>Math.atan2(p.z-j.z,p.x-j.x),wrap=n=>(n%TAU+TAU)%TAU;
// A driver yields at the entry to circulating traffic, not to the entire
// junction. Separated approaches can enter together; spacing on the ring uses
// arc length, which remains correct when the next car is around a bend.
export function roundaboutLimit(agent,gate,position,agents,spatial){
 const j=gate.junction,s=j.roundabout,remaining=Math.max(0,gate.entry-position-.3),speed=Math.min(2.4,Math.sqrt(s.ring*1.5));agent.turnSpeed=Math.min(agent.turnSpeed,speed);
 if(position<gate.entry-1)return remaining+1;
 const admitted=agent.roundaboutEntry?.id===j.id&&agent.roundaboutEntry.points===agent.points||position>gate.entry+.2;
 const nearby=spatial?.nearby?spatial.nearby(j,j.radius+2):agents;
 let blocked=false,clearance=Infinity;
 for(const b of nearby){if(b===agent||!b.active||b.dwell)continue;const radial=Math.hypot(b.x-j.x,b.z-j.z);if(radial>s.outer+.35||radial<s.island+.15)continue;
  if(!admitted){const behind=wrap(angle(b,j)-gate.mergeAngle)*s.ring,ahead=wrap(gate.mergeAngle-angle(b,j))*s.ring,gap=((agent.length||.9)+(b.length||.9))*.5+.7;if(behind<gap+(b.speed||speed)*.75||ahead<gap)blocked=true;}
  else if(Math.abs(Math.hypot(agent.x-j.x,agent.z-j.z)-s.ring)<.5&&Math.abs(radial-s.ring)<.5){const ahead=wrap(angle(agent,j)-angle(b,j))*s.ring;if(ahead<Math.PI*s.ring)clearance=Math.min(clearance,Math.max(0,ahead-((agent.length||.9)+(b.length||.9))*.5-.6));}
 }
 if(!admitted&&blocked){agent.waitReason='Yield to circulating traffic';return remaining;}
 if(!admitted)agent.roundaboutEntry={id:j.id,points:agent.points};
 if(clearance<.2)agent.waitReason='Roundabout queue';return clearance;
}
