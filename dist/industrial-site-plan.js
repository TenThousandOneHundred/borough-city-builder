// Industrial grounds use the authored loading doors and saved parcel frame.
// All sizes are world units (one unit = five metres). No city state is changed.
export function industrialSitePlan(plan,b){
 const W=plan.lotWidth,D=plan.lotDepth,left=-W/2+.09,right=W/2-.09,back=-D/2+.09,front=D/2-.09,items=[];
 const rect=(kind,x0,z0,x1,z1,extra={})=>{if(x1-x0<.015||z1-z0<.015)return null;const a={kind,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,...extra};items.push(a);return a;};
 const foreStart=b.maxZ+.05,entrances=(plan.entranceXs?.length?plan.entranceXs:[0]).map(x=>Math.max(left+.18,Math.min(right-.18,x)));
 for(const x of entrances)rect('walk',x-.18,foreStart,x+.18,front);
 const raw=plan.loadingBays?.length?plan.loadingBays:[{x:0,width:Math.min(1,W*.4)}],bays=raw.map(a=>({x:Math.max(left+.25,Math.min(right-.25,a.x)),width:Math.min(a.width+.32,right-left-.1)}));
 const centre=Math.max(left+.64,Math.min(right-.64,bays.reduce((s,a)=>s+a.x,0)/bays.length)),gateWidth=Math.min(1.4,W-.35);
 if(front>foreStart){
  rect('yard',left,foreStart,right,front);
  rect('drive',centre-gateWidth/2,foreStart,centre+gateWidth/2,front);
  for(const bay of bays){const a=rect('loading',Math.max(left+.04,bay.x-bay.width/2),foreStart,Math.min(right-.04,bay.x+bay.width/2),front-.08,{doorX:bay.x});if(a)a.markDepth=Math.min(.75,a.d);}
  // Truck manoeuvring space joins all loading approaches at the street gate.
  if(front-foreStart>1.3)rect('turning',left+.04,front-1.25,right-.04,front-.04);
 }
 if(b.minZ-back>.1)rect('yard',left,back,right,b.minZ-.06);
 const fence=(axis,a,z0,z1)=>axis==='x'?rect('security-fence',z0,a-.01,z1,a+.01,{axis}):rect('security-fence',a-.01,z0,a+.01,z1,{axis});
 // Property boundaries stop at building walls and open around every gate.
 if(back+.03<b.minZ)fence('x',back+.02,left+.02,right-.02);
 if(left+.03<b.minX)fence('z',left+.02,back+.02,front-.02);
 if(right-.03>b.maxX)fence('z',right-.02,back+.02,front-.02);
 const openings=items.filter(a=>['walk','drive'].includes(a.kind)&&a.z+a.d/2>=front-.001).map(a=>[Math.max(left,a.x-a.w/2-.05),Math.min(right,a.x+a.w/2+.05)]).sort((a,b)=>a[0]-b[0]);
 if(front-foreStart>.15){let cursor=left+.02;for(const [a,c]of openings){if(a-cursor>.12)fence('x',front-.02,cursor,a);cursor=Math.max(cursor,c);}if(right-.02-cursor>.12)fence('x',front-.02,cursor,right-.02);}
 // Split free ground around paths and truck clearances before placing props.
 const obstacles=items.filter(a=>['walk','drive','loading','turning'].includes(a.kind));
 function free(rectangles){let regions=rectangles.filter(r=>r[2]-r[0]>.15&&r[3]-r[1]>.15);for(const a of obstacles){const next=[];for(const [x0,z0,x1,z1]of regions){const l=Math.max(x0,a.x-a.w/2-.07),r=Math.min(x1,a.x+a.w/2+.07),lo=Math.max(z0,a.z-a.d/2-.07),hi=Math.min(z1,a.z+a.d/2+.07);if(l>=r||lo>=hi){next.push([x0,z0,x1,z1]);continue;}next.push([x0,z0,l,z1],[r,z0,x1,z1],[l,z0,r,lo],[l,hi,r,z1]);}regions=next.filter(r=>r[2]-r[0]>.15&&r[3]-r[1]>.15);}return regions.sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]));}
 let regions=free([[left+.08,foreStart+.1,right-.08,front-1.34],[left+.08,back+.08,b.minX-.14,foreStart-.12],[b.maxX+.14,back+.08,right-.08,foreStart-.12],[Math.max(left+.08,b.minX),back+.08,Math.min(right-.08,b.maxX),b.minZ-.14]]);
 // At most four staff spaces, only where the whole 5m bay and 6m aisle fit.
 const parkingRegion=regions.find(r=>r[2]-r[0]>=1.15&&r[3]-r[1]>=2.25&&r[1]>=foreStart);
 if(parkingRegion){const [x0,z0,x1]=parkingRegion,count=Math.min(4,Math.floor((x1-x0)/.54));for(let i=0;i<count;i++)items.push({kind:'parking',x:x0+.27+i*.54,z:z0+.5,w:.5,d:1,aisleDepth:1.2});parkingRegion[1]+=2.25;}
 const style=plan.industrialForm||'',primary=style.includes('sawtooth')?'timber':style.includes('processing')?'pipes':style.includes('distribution')?'container':'pallets',sizes={container:[1.22,.5,.52],timber:[1.3,.55,.35],pipes:[1.2,.5,.32],pallets:[.48,.48,.32],dumpster:[.65,.36,.3]};
 let count=0;for(const region of regions){let [x0,z0,x1,z1]=region;while(count<6&&z1-z0>.45){let kind=count===0?'dumpster':primary,[w,d,height]=sizes[kind],angle=0;if(x1-x0<w+.08&&x1-x0>d+.08&&z1-z0>w+.08){[w,d]=[d,w];angle=Math.PI/2;}if(x1-x0<w+.08||z1-z0<d+.08){kind='pallets';[w,d,height]=sizes[kind];angle=0;}if(x1-x0<w+.08||z1-z0<d+.08)break;items.push({kind,x:x0+w/2+.04,z:z0+d/2+.04,w,d,height,angle});z0+=d+.18;count++;}if(count>=6)break;}
 return items;
}
