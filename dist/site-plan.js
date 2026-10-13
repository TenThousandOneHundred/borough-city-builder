// Layout in the building's local coordinates. Features stay inside the owned
// rotated envelope and outside the complete model bounds, including balconies.
export function sitePlan(plan,footprint){
 const W=plan.lotWidth,D=plan.lotDepth,edge=.09,b=footprint,items=[];
 const rect=(kind,x0,z0,x1,z1,extra={})=>{const minimum=kind==='fence'?.015:.08;if(x1-x0<minimum||z1-z0<minimum)return;items.push({kind,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,...extra});};
 const left=-W/2+edge,right=W/2-edge,back=-D/2+edge,front=D/2-edge;
 const frontStart=b.maxZ+.08,rearEnd=b.minZ-.1;
 const rear=rearEnd-back,fore=front-frontStart,sideLeft=b.minX-left-.1,sideRight=right-b.maxX-.1;
 const urban=!plan.low&&plan.type!=='industrial',business=plan.type==='industrial'||plan.type==='commercial'&&plan.density==='low';
 // Every lot has a door-to-boundary connection. Front gardens leave it clear.
 rect('walk',-.18,frontStart,.18,front);
 if(plan.low){
  if(sideRight>.55)rect('drive',b.maxX+.1,Math.max(back,b.minZ),right,front);
  else if(sideLeft>.55)rect('drive',left,Math.max(back,b.minZ),b.minX-.1,front);
  if(rear>.5){rect('patio',Math.max(left,b.minX),Math.max(back,rearEnd-.48),Math.min(right,b.maxX),rearEnd);if(rear>1)rect('garden',left,back,right,rearEnd-.55);}
  if(fore>.24){rect('garden',left,frontStart,-.28,front);rect('garden',.28,frontStart,right,front);}
  // Rear and side fences stop before the front entrance and driveway.
  if(rear>.28){rect('fence',left,back,right,back+.03,{axis:'x'});rect('fence',left,back,left+.03,rearEnd,{axis:'z'});rect('fence',right-.03,back,right,rearEnd,{axis:'z'});}
 }else if(business){
  if(fore>1.18){rect('yard',left,frontStart,right,front);const depth=Math.min(.95,fore-.22),row=front-depth/2;for(let x=left+.34;x<right-.26;x+=.57){if(Math.abs(x)<.5)continue;items.push({kind:'parking',x,z:row,w:.5,d:depth});}}
  if(rear>.7)rect('yard',left,back,right,rearEnd);
  if(sideLeft>.3)rect('garden',left,back,b.minX-.1,frontStart-.1);
  if(sideRight>.3)rect('garden',b.maxX+.1,back,right,frontStart-.1);
 }else{
  for(const [x0,x1]of [[left,b.minX-.16],[b.maxX+.16,right]])if(x1-x0>.38){rect('garden',x0,back+.1,x1,front-.12);}
  if(rear>.7){rect('garden',Math.max(left,b.minX),back+.1,Math.min(right,b.maxX),rearEnd-.2);rect('walk',left,rearEnd-.17,right,rearEnd);}
  if(fore>.5){rect('plaza',left,frontStart,right,front);for(const sign of [-1,1]){const x=sign*Math.min(W*.28,W/2-.5);if(Math.abs(x)>.5)items.push({kind:'bench',x,z:front-.22,w:.65,d:.25});}}
 }
 // Small trees occupy the widest planted strips; canopies fit inside each bed.
 const beds=items.filter(i=>i.kind==='garden');for(const bed of beds){if(Math.min(bed.w,bed.d)<.48)continue;const alongX=bed.w>bed.d,long=Math.max(bed.w,bed.d),short=Math.min(bed.w,bed.d),count=Math.min(4,Math.max(1,Math.floor(long/1.7)));
  for(let n=0;n<count;n++){const offset=((n+.5)/count-.5)*long,span=Math.min(short-.12,long/count-.12);items.push({kind:'tree',x:bed.x+(alongX?offset:0),z:bed.z+(alongX?0:offset),w:span,d:span,height:Math.min(plan.low?1.35:1.9,span*1.7)});}
 }
 // Equipment is placed only where its complete footprint fits.
 if(urban&&fore>.45&&W>3)items.push({kind:'rack',x:Math.min(right-.4,.85),z:front-.22,w:.5,d:.2});
 if(business&&rear>.45)items.push({kind:'bin',x:left+.23,z:back+.23,w:.3,d:.3});
 return items;
}
