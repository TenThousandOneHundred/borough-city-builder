// Layout in the building's local coordinates. Features stay inside the owned
// rotated envelope and outside the complete model bounds, including balconies.
export function sitePlan(plan,footprint){
 const W=plan.lotWidth,D=plan.lotDepth,edge=.09,b=footprint,items=[];
 const rect=(kind,x0,z0,x1,z1,extra={})=>{const minimum=['fence','curb'].includes(kind)?.015:.08;if(x1-x0<minimum||z1-z0<minimum)return;items.push({kind,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,...extra});};
 const left=-W/2+edge,right=W/2-edge,back=-D/2+edge,front=D/2-edge;
 const frontStart=b.maxZ+.08,rearEnd=b.minZ-.1;
 const rear=rearEnd-back,fore=front-frontStart,sideLeft=b.minX-left-.1,sideRight=right-b.maxX-.1;
 const urban=!plan.low&&plan.type!=='industrial',business=plan.type==='industrial'||plan.type==='commercial'&&plan.density==='low';
 // Every lot has a door-to-boundary connection. Front gardens leave it clear.
 const entrances=plan.entranceXs?.length?plan.entranceXs:[0];
 for(const entry of entrances){const x=Math.max(left+.18,Math.min(right-.18,entry));rect('walk',x-.18,frontStart,x+.18,front);}
 if(plan.low){
  if(sideRight>.55)rect('drive',b.maxX+.1,Math.max(back,b.minZ),right,front);
  else if(sideLeft>.55)rect('drive',left,Math.max(back,b.minZ),b.minX-.1,front);
  if(rear>.5){rect('patio',Math.max(left,b.minX),Math.max(back,rearEnd-.48),Math.min(right,b.maxX),rearEnd);if(rear>1)rect('garden',left,back,right,rearEnd-.55);}
  if(fore>.24){
   // Subtract all entrance walks and the driveway before planting front beds.
   const reserved=items.filter(a=>['walk','drive'].includes(a.kind)).map(a=>[Math.max(left,a.x-a.w/2-.1),Math.min(right,a.x+a.w/2+.1)]).sort((a,b)=>a[0]-b[0]);
   let edge=left;for(const [a,b]of reserved){rect('garden',edge,frontStart,a,front);edge=Math.max(edge,b);}rect('garden',edge,frontStart,right,front);
  }
  // Rear and side fences stop before the front entrance and driveway.
  if(rear>.28){for(let i=1;i<(plan.rowEntrances?.length||0);i++){const x=(plan.rowEntrances[i-1]+plan.rowEntrances[i])/2;rect('fence',x-.015,back,x+.015,rearEnd,{axis:'z'});}rect('fence',left,back,right,back+.03,{axis:'x'});rect('fence',left,back,left+.03,rearEnd,{axis:'z'});rect('fence',right-.03,back,right,rearEnd,{axis:'z'});}
 }else if(business){
  // Parking bays need a full 6 m manoeuvring aisle behind their 5 m depth.
  // Shallow setbacks remain loading/entrance space instead of fake stalls.
  if(fore>1.18){
   rect('yard',left,frontStart,right,front);
   if(fore>=2.56){
    const z0=frontStart+.36;rect('walk',Math.max(left,b.minX),frontStart,Math.min(right,b.maxX),z0-.08);
    parkingCourt(left+.06,z0,right-.06,z0+2.2,true);
   }
  }
  if(rear>.7)rect('yard',left,back,right,rearEnd);
  if(sideLeft>.3)rect('garden',left,back,b.minX-.1,frontStart-.1,{border:false});
  if(sideRight>.3)rect('garden',b.maxX+.1,back,right,frontStart-.1,{border:false});
 }else{
  const driveSide=plan.type==='office'&&plan.density==='low'&&rear>=2.55
   ?sideRight>=.78&&(sideLeft<.78||(plan.variation||0)>=.5)?1:sideLeft>=.78?-1:0:0;
  // A small office can use a rear court only when a real-width side drive
  // connects it to the street. Narrow parcels keep shared gardens instead.
  if(driveSide){
   const x=driveSide>0?right-.36:left+.36,z0=rearEnd-2.55;
   parkingCourt(left+.05,z0,right-.05,rearEnd-.35);
   rect('drive',x-.36,z0+1,x+.36,front);
  }
  // One side passage joins the street, rear entrance and shared sitting area.
  const pedestrianSide=driveSide===1?-1:driveSide===-1?1:sideLeft>=sideRight?-1:1;
  for(const side of [-1,1]){
   const gap=side<0?sideLeft:sideRight;if(gap<.38||side!==pedestrianSide)continue;
   const x=side<0?b.minX-.28:b.maxX+.28;
   rect('walk',x-.16,Math.max(back+.12,rearEnd-.32),x+.16,front);
  }
  if(rear>.7){
   rect('walk',Math.max(left,b.minX-.44),rearEnd-.32,Math.min(right,b.maxX+.44),rearEnd);
   if(!driveSide){
    const courtWidth=Math.min(2.4,W-.5),courtDepth=Math.min(1.1,rear-.32),courtZ=rearEnd-Math.min(rear*.52,2.1);
    rect('plaza',-courtWidth/2,courtZ-courtDepth/2,courtWidth/2,courtZ+courtDepth/2);
    rect('walk',-.16,courtZ,.16,rearEnd);
    if(courtWidth>1.1&&courtDepth>.6)furniture({kind:'bench',x:-courtWidth/2+.43,z:courtZ-courtDepth/2+.2,w:.65,d:.25});
   }
  }
  if(fore>.5){
   rect('plaza',left,frontStart,right,Math.min(front,frontStart+.75));
   for(const sign of [-1,1]){
    const x=sign*Math.min(W*.28,W/2-.5);
    if(Math.abs(x)>.5)furniture({kind:'bench',x,z:Math.min(front-.22,frontStart+.5),w:.65,d:.25});
   }
  }
  // Fill the remaining ground with broad lawns, cut around the actual paths
  // and parking. Lawn edges have no repeated concrete planter rims.
  for(const area of [[left,back,b.minX-.1,front],[b.maxX+.1,back,right,front],
   [Math.max(left,b.minX-.1),back,Math.min(right,b.maxX+.1),rearEnd-.04],
   [Math.max(left,b.minX-.1),frontStart,Math.min(right,b.maxX+.1),front]])plantFree(area);
 }
 function furniture(item){
  if(items.some(a=>['walk','drive','parking','garden'].includes(a.kind)&&Math.abs(a.x-item.x)<(a.w+item.w)/2+.04&&Math.abs(a.z-item.z)<(a.d+item.d)/2+.04))return;
  items.push(item);
 }
 function parkingCourt(x0,z0,x1,z1,clearEntrance=false){
  if(!clearEntrance)rect('yard',x0,z0,x1,z1);
  const count=Math.floor((x1-x0-.16)/.54),start=(x0+x1)/2-(count-1)*.54/2;
  for(let i=0;i<count;i++){const x=start+i*.54;if(clearEntrance&&entrances.some(entry=>Math.abs(x-entry)<.5))continue;items.push({kind:'parking',x,z:z0+.5,w:.5,d:1,aisleDepth:1.2});}
  rect('curb',x0,z0-.035,x1,z0+.015);
  for(const x of [x0,x1])rect('curb',x-.025,z0,x+.025,z0+1);
 }
 function plantFree(area){
  let regions=[area];const obstacles=items.filter(a=>['walk','drive','plaza','yard','bench','curb'].includes(a.kind));
  for(const a of obstacles){const next=[];for(const [x0,z0,x1,z1]of regions){
   const l=Math.max(x0,a.x-a.w/2-.04),r=Math.min(x1,a.x+a.w/2+.04),backCut=Math.max(z0,a.z-a.d/2-.04),frontCut=Math.min(z1,a.z+a.d/2+.04);
   if(l>=r||backCut>=frontCut){next.push([x0,z0,x1,z1]);continue;}
   next.push([x0,z0,l,z1],[r,z0,x1,z1],[l,z0,r,backCut],[l,frontCut,r,z1]);
  }regions=next.filter(([x0,z0,x1,z1])=>x1-x0>=.16&&z1-z0>=.16);}
  for(const [x0,z0,x1,z1]of regions)rect('garden',x0,z0,x1,z1,{border:false});
 }
 // Small trees occupy the widest planted strips; canopies fit inside each bed.
 const beds=items.filter(i=>i.kind==='garden');if(!plan.low)beds.sort((a,b)=>b.w*b.d-a.w*a.d);let treesLeft=plan.low?Infinity:6;for(const bed of beds){if(Math.min(bed.w,bed.d)<.48)continue;const alongX=bed.w>bed.d,long=Math.max(bed.w,bed.d),short=Math.min(bed.w,bed.d),count=Math.min(treesLeft,4,Math.max(1,Math.floor(long/(plan.low?1.7:2.2))));treesLeft-=count;
  for(let n=0;n<count;n++){const offset=((n+.5)/count-.5)*long,span=Math.min(short-.12,long/count-.12);items.push({kind:'tree',x:bed.x+(alongX?offset:0),z:bed.z+(alongX?0:offset),w:span,d:span,height:Math.min(plan.low?1.35:1.9,span*1.7)});}
 }
 // Equipment is placed only where its complete footprint fits.
 if(urban&&fore>.45&&W>3)furniture({kind:'rack',x:Math.min(right-.4,.85),z:Math.min(front-.22,frontStart+.5),w:.5,d:.2});
 if(business&&rear>.45)items.push({kind:'bin',x:left+.23,z:back+.23,w:.3,d:.3});
 return items;
}
