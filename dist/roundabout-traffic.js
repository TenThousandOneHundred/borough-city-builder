const TAU=Math.PI*2,angle=(p,j)=>Math.atan2(p.z-j.z,p.x-j.x),wrap=n=>(n%TAU+TAU)%TAU;
// A driver yields at the entry to circulating traffic, not to the entire
// junction. Separated approaches can enter together; spacing on the ring uses
// arc length, which remains correct when the next car is around a bend.
export function roundaboutLimit(agent,gate,position,agents,spatial){
 const j=gate.junction,s=j.roundabout,remaining=Math.max(0,gate.entry-position-.3),speed=Math.min(2.4,Math.sqrt(s.ring*1.5));agent.turnSpeed=Math.min(agent.turnSpeed,speed);
 if(position<gate.entry-1)return remaining+1;
 // Keep checking the circulating gap along the approach. A permission granted
 // outside the circle is not a reservation lasting several seconds to the merge.
 const merge=gate.mergeDistance??gate.entry,admitted=position>=merge-.08;
 const nearby=spatial?.nearby?spatial.nearby(j,j.radius+2):agents;
 let blocked=false,clearance=Infinity;
 for(const b of nearby){if(b===agent||!b.active||b.dwell)continue;const radial=Math.hypot(b.x-j.x,b.z-j.z);if(radial>s.outer+.35||radial<s.island+.15)continue;
  if(!admitted&&Math.abs(radial-s.ring)<.12){const behind=wrap(angle(b,j)-gate.mergeAngle)*s.ring,ahead=wrap(gate.mergeAngle-angle(b,j))*s.ring,gap=((agent.length||.9)+(b.length||.9))*.5+.7;if(behind<gap+(b.speed||speed)*.75||ahead<gap)blocked=true;}
  else if(Math.abs(Math.hypot(agent.x-j.x,agent.z-j.z)-s.ring)<.12&&Math.abs(radial-s.ring)<.12){const ahead=wrap(angle(agent,j)-angle(b,j))*s.ring;if(ahead<Math.PI*s.ring)clearance=Math.min(clearance,Math.max(0,ahead-((agent.length||.9)+(b.length||.9))*.5-.6));}
 }
 if(!admitted&&blocked){agent.waitReason='Yield to circulating traffic';return Math.max(0,merge-position-((agent.length||.9)*.5+.55));}
 if(!admitted)agent.roundaboutEntry={id:j.id,points:agent.points};
 if(clearance<.2)agent.waitReason='Roundabout queue';return clearance;
}

// Tangent lane tests cannot determine priority where an approach merges into
// the ring. Circulating drivers use arc spacing and ignore incoming cars which
// must yield to them; outgoing cars still provide ordinary following clearance.
export function yieldsToCirculating(a,b){
 const j=a.circulatingJunction;if(!j)return false;const s=j.roundabout,radial=Math.hypot(b.x-j.x,b.z-j.z);
 return radial>s.ring+.12&&(b.x-j.x)*Math.sin(b.heading)+(b.z-j.z)*Math.cos(b.heading)<-.15;
}
