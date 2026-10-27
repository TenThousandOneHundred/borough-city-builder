// Construction coordinates are tile coordinates: one tile is 20 metres.
// The index is a snapshot of network geometry. Recreate it after road edits.
const EPS=1e-10, BIN=2, STEP=.4, TURN=Math.PI/4, ANGLE_WINDOW=Math.PI/24;
const point=p=>({x:p.x,y:p.y});
const finite=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function unit(x,y){const d=Math.hypot(x,y);return d>EPS?{x:x/d,y:y/d}:null;}
function canonical(v){return v&&(v.x<-EPS||(Math.abs(v.x)<=EPS&&v.y<0))?{x:-v.x,y:-v.y}:v;}
function inside(p,max){return p.x>=-EPS&&p.y>=-EPS&&p.x<=max+EPS&&p.y<=max+EPS;}
function bounded(p,max){return {x:clamp(p.x,0,max),y:clamp(p.y,0,max)};}
function compare(a,b){
 return a.rank-b.rank||a.p.x-b.p.x||a.p.y-b.p.y||(a.tangent?.x||0)-(b.tangent?.x||0)||(a.tangent?.y||0)-(b.tangent?.y||0)||(a.key<b.key?-1:a.key>b.key?1:0);
}
function binKey(x,y){return x+','+y;}
function put(map,item,a,b=a){
 for(let y=Math.floor(Math.min(a.y,b.y)/BIN);y<=Math.floor(Math.max(a.y,b.y)/BIN);y++)for(let x=Math.floor(Math.min(a.x,b.x)/BIN);x<=Math.floor(Math.max(a.x,b.x)/BIN);x++){
  const key=binKey(x,y);let bucket=map.get(key);if(!bucket)map.set(key,bucket=[]);bucket.push(item);
 }
}
function clipped(a,b,max){
 let lo=0,hi=1;
 for(const axis of ['x','y']){
  const delta=b[axis]-a[axis];
  if(Math.abs(delta)<EPS){if(a[axis]<0||a[axis]>max)return null;continue;}
  const t0=(0-a[axis])/delta,t1=(max-a[axis])/delta;
  lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
  if(lo>hi)return null;
 }
 return [{x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo},{x:a.x+(b.x-a.x)*hi,y:a.y+(b.y-a.y)*hi}];
}

export function createRoadSnapIndex(world,engine){
 const size=engine.SIZE||48,max=size-1,index={world,max,nodes:[],segments:[],nodeBins:new Map(),segmentBins:new Map()};
 function node(p,tangent,rank,key,label){if(finite(p)&&inside(p,max))index.nodes.push({p:point(p),tangent,rank,key,label});}
 function segment(a,b,rank,key,label){
  if(!finite(a)||!finite(b))return;const ends=clipped(a,b,max);if(!ends)return;[a,b]=ends;
  const tangent=canonical(unit(b.x-a.x,b.y-a.y));if(!tangent)return;
  index.segments.push({a,b,p:a,tangent,rank,key,label,length2:distance2(a,b)});
 }
 for(const [paths,rank,label]of [[world.roadPaths||[],0,'Road'],[world.walkPaths||[],1,'Path']])for(const path of paths){
  const controls=path.controls;if(!Array.isArray(controls)||controls.length<2||!controls.every(finite))continue;
  const samples=engine.sampleRoad(controls),key=String(path.id||'')+'/'+controls.map(p=>p.x+','+p.y).join('/');
  const start=controls[0],end=controls.at(-1),after=controls.slice(1).find(p=>distance2(p,start)>EPS),before=controls.slice(0,-1).reverse().find(p=>distance2(p,end)>EPS);
  node(start,after?unit(start.x-after.x,start.y-after.y):null,rank,key+'/start',label+' endpoint');
  node(end,before?unit(end.x-before.x,end.y-before.y):null,rank,key+'/end',label+' endpoint');
  for(let i=1;i<samples.length;i++)segment(samples[i-1],samples[i],rank,key+'/'+i,label+' centerline');
 }
 // Match the rendered legacy strips, including the rounded corner within an
 // elbow tile. Authored road raster tiles never become phantom snap targets.
 for(let i=0;i<(world.tiles?.length||0);i++){
  const tile=world.tiles[i];if(tile.type!=='road'||tile.pathIds?.length&&!tile.legacyRoad)continue;
  const x=i%size,y=Math.floor(i/size),p={x,y},dirs=[];
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size&&world.tiles[(y+dy)*size+x+dx]?.type==='road')dirs.push({x:dx,y:dy});
  const key='legacy/'+i;
  if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].y*dirs[1].y===0){
   const a={x:x+dirs[0].x*.5,y:y+dirs[0].y*.5},b={x:x+dirs[1].x*.5,y:y+dirs[1].y*.5};let prior=a;
   for(let n=1;n<=12;n++){const t=n/12,u=1-t,q={x:u*u*a.x+2*u*t*x+t*t*b.x,y:u*u*a.y+2*u*t*y+t*t*b.y};segment(prior,q,2,key+'/'+n,'Road centerline');prior=q;}
  }else if(dirs.length<=2){
   const d=dirs.find(d=>d.x)||dirs[0]||{x:1,y:0},tangent=canonical(unit(d.x,d.y));
   segment({x:x-tangent.x*.5,y:y-tangent.y*.5},{x:x+tangent.x*.5,y:y+tangent.y*.5},2,key,'Road centerline');
   node(p,tangent,2,key,'Road node');
  }else{
   node(p,null,2,key,'Intersection');
   for(const d of dirs)segment(p,{x:x+d.x*.5,y:y+d.y*.5},2,key+'/'+d.x+','+d.y,'Road centerline');
  }
 }
 index.nodes.sort(compare);index.segments.sort(compare);
 for(const n of index.nodes)put(index.nodeBins,n,n.p);
 for(const s of index.segments)put(index.segmentBins,s,s.a,s.b);
 return index;
}

function nearby(bins,p,r){
 const result=[],seen=new Set();
 for(let y=Math.floor((p.y-r)/BIN);y<=Math.floor((p.y+r)/BIN);y++)for(let x=Math.floor((p.x-r)/BIN);x<=Math.floor((p.x+r)/BIN);x++)for(const item of bins.get(binKey(x,y))||[])if(!seen.has(item)){seen.add(item);result.push(item);}
 return result;
}
function nearest(index,p,tolerance){
 let best=null,bestDistance=tolerance*tolerance+EPS;
 for(const n of nearby(index.nodeBins,p,tolerance)){
  const d=distance2(p,n.p);if(d<bestDistance-EPS||(Math.abs(d-bestDistance)<=EPS&&(!best||compare(n,best)<0))){best=n;bestDistance=d;}
 }
 if(best)return {point:point(best.p),kind:'endpoint',label:best.label,tangent:best.tangent&&point(best.tangent),guides:best.tangent?[{a:bounded({x:best.p.x-best.tangent.x*1.5,y:best.p.y-best.tangent.y*1.5},index.max),b:bounded({x:best.p.x+best.tangent.x*1.5,y:best.p.y+best.tangent.y*1.5},index.max)}]:[]};
 let chosen=null;bestDistance=tolerance*tolerance+EPS;
 for(const s of nearby(index.segmentBins,p,tolerance)){
  const t=clamp(((p.x-s.a.x)*(s.b.x-s.a.x)+(p.y-s.a.y)*(s.b.y-s.a.y))/s.length2,0,1),q={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t},d=distance2(p,q);
  if(d<bestDistance-EPS||(Math.abs(d-bestDistance)<=EPS&&(!best||compare(s,best)<0))){best=s;chosen=q;bestDistance=d;}
 }
 return best?{point:chosen,kind:'centerline',label:best.label,tangent:point(best.tangent),guides:[{a:point(best.a),b:point(best.b)}]}:null;
}
function angleAt(anchor,p,reference){
 const a=unit(p.x-anchor.x,p.y-anchor.y);if(!a)return undefined;
 return Math.acos(clamp(a.x*reference.x+a.y*reference.y,-1,1))*180/Math.PI;
}

export function resolveRoadSnap(index,raw,{anchor,referenceTangent,nodes=true,angles=true,lengths=false,free=false,tolerance=.6}={}){
 if(!finite(raw))return {point:null,kind:'invalid',label:'Outside city limits',guides:[],tangent:null};
 const max=index.max,p=bounded(raw,max),reference=finite(referenceTangent)?unit(referenceTangent.x,referenceTangent.y)||{x:1,y:0}:{x:1,y:0},hasAnchor=finite(anchor),radius=Number.isFinite(tolerance)?clamp(tolerance,0,8):.6;
 let result={point:p,kind:'free',label:'Free placement',guides:[],tangent:null};
 if(!free){
  const network=nodes?nearest(index,p,radius):null;
  if(network)result=network;
  else if(hasAnchor){
   let dx=p.x-anchor.x,dy=p.y-anchor.y,length=Math.hypot(dx,dy),direction=unit(dx,dy),angleSnapped=false,lengthSnapped=false;
   if(direction&&angles){
    const base=Math.atan2(reference.y,reference.x),a=Math.atan2(dy,dx),target=base+Math.round((a-base)/TURN)*TURN,error=Math.abs(Math.atan2(Math.sin(a-target),Math.cos(a-target))),axis={x:Math.cos(target),y:Math.sin(target)},along=dx*axis.x+dy*axis.y,q={x:anchor.x+axis.x*along,y:anchor.y+axis.y*along};
    if(error<=ANGLE_WINDOW&&distance2(p,q)<=radius*radius+EPS&&inside(q,max)){result.point=bounded(q,max);direction=axis;length=along;angleSnapped=true;}
   }
   if(direction&&lengths){
    const step=Math.round(length/STEP)*STEP,q={x:anchor.x+direction.x*step,y:anchor.y+direction.y*step};
    if(step>EPS&&Math.abs(step-length)<=radius+EPS&&inside(q,max)){result.point=bounded(q,max);lengthSnapped=true;}
   }
   if(angleSnapped||lengthSnapped){result.kind=angleSnapped?(lengthSnapped?'angle-length':'angle'):'length';result.label=angleSnapped?(lengthSnapped?'Angle · 8 m steps':'Angle alignment'):'8 m steps';result.guides=[{a:point(anchor),b:point(result.point)}];result.tangent=direction&&point(direction);}
  }
 }
 if(hasAnchor){const degrees=angleAt(anchor,result.point,reference);if(degrees!==undefined)result.angleDegrees=degrees;}
 return result;
}

// Optional height callback receives tile x/y and returns render-world elevation
// (one render unit = five metres). Supply it only for an explicitly known grade.
export function measureRoad(points,height){
 let lengthTiles=0;for(let i=1;i<points.length;i++)lengthTiles+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 const result={lengthTiles,lengthMeters:lengthTiles*20};
 if(height&&points.length>1){const first=points[0],last=points.at(-1),rise=height(last.x,last.y)-height(first.x,first.y);if(Number.isFinite(rise)){result.riseMeters=rise*5;result.gradePercent=lengthTiles>EPS?rise/(lengthTiles*4)*100:0;}}
 return result;
}
