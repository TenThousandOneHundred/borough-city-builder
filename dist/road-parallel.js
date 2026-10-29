import './map-grid.js?v=155';
const G=globalThis.BoroughGrid;
// Parallel centerlines in tile coordinates. Width includes sidewalks; one tile
// is 20 displayed metres. Quadratic offsets are fitted, never translated.
import './road-curves.js?v=155';
const RoadCurves=globalThis.BoroughRoadCurves;
const EPS=1e-8,ERROR=.01,MAX_SEGMENTS=32,MAX_SAMPLES=768,MAX_WORK=4096;
const point=p=>({x:p.x,y:p.y});
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=p=>finite(p)&&p.x>=0&&p.y>=0&&p.x<=G.last&&p.y<=G.last;
const add=(a,b,s=1)=>({x:a.x+b.x*s,y:a.y+b.y*s});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const length=v=>Math.hypot(v.x,v.y);
const distance=(a,b)=>length(sub(a,b));
const normal=v=>{const n=length(v);return {x:-v.y/n,y:v.x/n};};
const clamp=(t,a,b)=>Math.max(a,Math.min(b,t));
function evaluate(c,t){const u=1-t;return c.length===2?add(c[0],sub(c[1],c[0]),t):{x:u*u*c[0].x+2*u*t*c[1].x+t*t*c[2].x,y:u*u*c[0].y+2*u*t*c[1].y+t*t*c[2].y};}
function derivative(c,t){return c.length===2?sub(c[1],c[0]):{x:2*((1-t)*(c[1].x-c[0].x)+t*(c[2].x-c[1].x)),y:2*((1-t)*(c[1].y-c[0].y)+t*(c[2].y-c[1].y))};}
function second(c){return c.length===2?{x:0,y:0}:{x:2*(c[2].x-2*c[1].x+c[0].x),y:2*(c[2].y-2*c[1].y+c[0].y)};}
function minimumSpeed(v,a,lo,hi){const aa=dot(a,a),t=aa?clamp(-dot(v,a)/aa,lo,hi):lo;return length(add(v,a,t));}

function sampled(chains){
 const pieces=chains.flat(),desired=pieces.map(c=>Math.max(2,Math.ceil(c.slice(1).reduce((n,p,i)=>n+distance(p,c[i]),0)*10))),budget=MAX_SAMPLES-chains.length;
 const total=desired.reduce((a,b)=>a+b,0),steps=desired.map(n=>Math.max(2,Math.floor(n*Math.min(1,budget/total))));
 while(steps.reduce((a,b)=>a+b,0)>budget){let best=0;for(let i=1;i<steps.length;i++)if(steps[i]>steps[best])best=i;steps[best]--;}
 let index=0;
 return chains.map(chain=>{
  const points=[];let chordError=0;
  for(const c of chain){const n=steps[index++];chordError=Math.max(chordError,length(second(c))/(8*n*n));for(let j=0;j<=n;j++){const p=evaluate(c,j/n);if(!points.length||distance(points.at(-1),p)>EPS)points.push(p);}}
  return {points,chordError};
 });
}
function pointSegment(p,a,b){const d=sub(b,a),dd=dot(d,d),t=dd?clamp(dot(sub(p,a),d)/dd,0,1):0;return distance(p,add(a,d,t));}
function segmentDistance(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),den=cross(u,v);
 if(Math.abs(den)>1e-12){const offset=sub(c,a),t=cross(offset,v)/den,s=cross(offset,u)/den;if(t>=0&&t<=1&&s>=0&&s<=1)return 0;}
 return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
function segmentBins(points,padding=0){
 const bins=new Map();for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],segment={a,b,i};
  for(let y=Math.floor((Math.min(a.y,b.y)-padding)/2);y<=Math.floor((Math.max(a.y,b.y)+padding)/2);y++)for(let x=Math.floor((Math.min(a.x,b.x)-padding)/2);x<=Math.floor((Math.max(a.x,b.x)+padding)/2);x++){
   const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(segment);
  }
 }return bins;
}
function nearby(bins,a,b){const found=new Set();for(let y=Math.floor(Math.min(a.y,b.y)/2);y<=Math.floor(Math.max(a.y,b.y)/2);y++)for(let x=Math.floor(Math.min(a.x,b.x)/2);x<=Math.floor(Math.max(a.x,b.x)/2);x++)for(const s of bins.get(x+','+y)||[])found.add(s);return found;}
function selfCrosses(points){const bins=segmentBins(points);for(let i=1;i<points.length;i++)for(const s of nearby(bins,points[i-1],points[i]))if(s.i<i-1&&segmentDistance(points[i-1],points[i],s.a,s.b)<EPS)return true;return false;}
function corridorsOverlap(primary,secondary,width){
 const clearance=width+primary.chordError+secondary.chordError-EPS,bins=segmentBins(primary.points,clearance);
 for(let i=1;i<secondary.points.length;i++)for(const s of nearby(bins,secondary.points[i-1],secondary.points[i]))if(segmentDistance(secondary.points[i-1],secondary.points[i],s.a,s.b)<clearance)return true;
 return false;
}

export function planParallelRoads(controls,{roadWidth=.8125,clearGap=.4,side=1,reverse=false,maxSegments=16}={}){
 const primary=Array.isArray(controls)&&controls.every(finite)?controls.map(point):[],base={ok:false,reason:'Choose a straight or curved road.',paths:[],primary,secondary:[],gap:clearGap,offset:roadWidth+clearGap,side,reverse,samples:{primary:[],secondary:[]},maxError:0};
 const fail=reason=>({...base,reason});
 if(![2,3].includes(primary.length)||!primary.every(inside))return fail('Keep both roads inside city limits.');
 if(!Number.isFinite(roadWidth)||roadWidth<=0||roadWidth>4||!Number.isFinite(clearGap)||clearGap<0||clearGap>8||![-1,1].includes(side)||typeof reverse!=='boolean'||!Number.isInteger(maxSegments)||maxSegments<1||maxSegments>MAX_SEGMENTS)return fail('Choose a valid parallel-road gap and side.');
 const v=derivative(primary,0),a=second(primary),speed=minimumSpeed(v,a,0,1),turn=cross(v,a),offset=side*base.offset;
 if(speed<EPS)return fail('This curve doubles back or has no direction. Use a gentler bend.');
 // A regular centerline alone is insufficient: the innermost sidewalk must
 // also remain outside the bend's curvature centre, or the ribbon folds.
 const curvature=turn/(speed*speed*speed),inner=turn>=0?Math.max(roadWidth/2,offset+roadWidth/2):Math.min(-roadWidth/2,offset-roadWidth/2);
 if(1-inner*curvature<=1e-5)return fail('This bend is too tight for two parallel roads and their gap.');
 const offsetAt=t=>add(evaluate(primary,t),normal(derivative(primary,t)),offset);
 const extrema=[0,1];for(const axis of ['x','y'])if(Math.abs(a[axis])>EPS){const t=-v[axis]/a[axis];if(t>0&&t<1)extrema.push(t);}
 if(extrema.some(t=>!inside(offsetAt(t))))return fail('The parallel road extends outside city limits.');
 const fitted=[];let work=0,failure='';
 function fit(lo,hi,depth=0){
  if(failure)return;
  if(++work>MAX_WORK){failure='This curve needs too many sections. Use a gentler bend.';return;}
  const p=offsetAt(lo),q=offsetAt(hi),t0=derivative(primary,lo),t1=derivative(primary,hi),den=cross(t0,t1),span=hi-lo,qa=evaluate(primary,lo),qb=evaluate(primary,hi),chord=sub(qb,qa),chordLength=length(chord);
  // Collinear quadratics may have nonuniform speed. Certify their geometric
  // line directly instead of subdividing only to match that parameter speed.
  const chordNormal=chordLength>EPS?normal(chord):null,linearBound=chordNormal&&dot(t0,chord)>0&&dot(t1,chord)>0?Math.abs(cross(chord,sub(evaluate(primary,(lo+hi)/2),qa)))/chordLength+2*Math.abs(offset)*Math.max(distance(normal(t0),chordNormal),distance(normal(t1),chordNormal)):Infinity;
  let c,bound=Infinity;
  if(linearBound<=1e-7){c=[p,q];bound=linearBound;}
  else if(Math.abs(den)>1e-14){const delta=sub(q,p),s=cross(delta,t1)/den,r=cross(t0,delta)/den;c=s>0&&r>0?[p,add(p,t0,s),q]:null;}
  if(c&&bound===Infinity){
   const smin=minimumSpeed(v,a,lo,hi),maxDot=Math.max(Math.abs(dot(t0,a)),Math.abs(dot(t1,a)));
   // For N(t), ||N''|| <= |cross(v,a)| sqrt(cross(v,a)^2+
   // 4 max(dot(v,a))^2) / min(||v||)^4. Linear interpolation of the
   // error on each 1/16 interval adds at most M*(1/16)^2/8.
   const normalSecond=Math.abs(turn)*Math.hypot(turn,2*maxDot)/(smin**4),difference=sub(second(c),{x:a.x*span*span,y:a.y*span*span});
   const secondBound=length(difference)+Math.abs(offset)*span*span*normalSecond;let measured=0;
   for(let n=0;n<=16;n++){work++;measured=Math.max(measured,distance(evaluate(c,n/16),offsetAt(lo+span*n/16)));}
   bound=measured+secondBound/2048;
  }
  if(c&&bound<=ERROR&&c.every(inside)){if(fitted.length>=maxSegments){failure='This curve needs too many sections. Use a gentler bend.';return;}fitted.push({controls:c.map(point),lo,hi,error:bound});return;}
  if(depth>=12||fitted.length>=maxSegments||work>MAX_WORK){failure='This curve needs too many sections. Use a gentler bend.';return;}
  const mid=(lo+hi)/2;fit(lo,mid,depth+1);fit(mid,hi,depth+1);
 }
 fit(0,1);
 if(failure||fitted.length>maxSegments)return fail(failure||'This curve needs too many sections. Use a gentler bend.');
 for(const piece of fitted){const v=derivative(piece.controls,0),a=second(piece.controls),s=minimumSpeed(v,a,0,1);if(s<EPS||roadWidth/2*Math.abs(cross(v,a))/(s*s*s)>=1-1e-5)return fail('A fitted road bend is too tight for its sidewalks.');}
 base.maxError=Math.max(...fitted.map(p=>p.error));
 // At zero clearance a fitted curve could overlap by its certified error.
 // Exact straight offsets remain valid when their outer edges just touch.
 if(clearGap+EPS<base.maxError)return fail('Leave a little more gap between these curved roads.');
 const originalSecondary=fitted.map(p=>p.controls),[primarySamples,secondarySamples]=sampled([[primary],originalSecondary]);
 if(selfCrosses(primarySamples.points)||selfCrosses(secondarySamples.points)||corridorsOverlap(primarySamples,secondarySamples,roadWidth))return fail('The two road corridors overlap around this bend.');
 const middle=fitted.find(p=>p.lo<=.5&&p.hi>=.5),t=(.5-middle.lo)/(middle.hi-middle.lo),p=evaluate(primary,.5),q=evaluate(middle.controls,t),n=normal(derivative(primary,.5)),m=normal(derivative(middle.controls,t));
 const secondary=reverse?originalSecondary.slice().reverse().map(c=>c.slice().reverse().map(point)):originalSecondary.map(c=>c.map(point));
 const joined=RoadCurves.joinPieces(secondary);if(!joined)return fail('The parallel road sections could not be joined.');
 return {...base,ok:true,reason:'',secondary,paths:[primary.map(point),joined],samples:{primary:primarySamples.points,secondary:reverse?secondarySamples.points.slice().reverse():secondarySamples.points},gapGuide:{a:add(p,n,side*roadWidth/2),b:add(q,m,-side*roadWidth/2)},segmentCount:secondary.length};
}

export function quoteParallelRoads(world,plan,type,E,{zoneSides}={}){
 if(!plan?.ok)return {ok:false,reason:plan?.reason||'Choose both parallel roads.',cost:0,costComplete:false,plan};
 return {...E.roadBatchQuote(world,plan.paths,type,{zoneSides}),plan};
}
export function buildParallelRoads(world,plan,type,E,{zoneSides}={}){
 if(!plan?.ok)return {ok:false,reason:plan?.reason||'Choose both parallel roads.',cost:0,costComplete:false,plan};
 return {...E.buildRoadBatch(world,plan.paths,type,{zoneSides}),plan};
}

quoteParallelRoads=G.bind(quoteParallelRoads);
buildParallelRoads=G.bind(buildParallelRoads);
