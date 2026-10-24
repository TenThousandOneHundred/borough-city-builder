// Reproject only after a road replacement. Keep the existing vehicle identity
// and trip instead of restarting it from an outside connection or depot.
export function moveToRoute(agent,points){
 if(!points||points.length<2)return false;let best=null;
 for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;if(length<1e-10)continue;const f=Math.max(0,Math.min(1,((agent.x-a.x)*dx+(agent.z-a.z)*dz)/length)),x=a.x+dx*f,z=a.z+dz*f,d=(x-agent.x)**2+(z-agent.z)**2;if(!best||d<best.d)best={d,x,z,segment:i,distance:f*Math.sqrt(length),heading:Math.atan2(dx,dz)};}
 if(!best)return false;agent.points=points;Object.assign(agent,{x:best.x,z:best.z,segment:best.segment,distance:best.distance,heading:best.heading,previousX:undefined,previousZ:undefined,stopTime:0,stopJunction:null});return true;
}
