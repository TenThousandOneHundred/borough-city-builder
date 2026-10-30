import './map-grid.js?v=156';
const G=globalThis.BoroughGrid;
import * as THREE from './vendor/three.module.js';

const MAX_STATIONS=384,MAX_GRID_PATHS=18,MAX_GRID_STATIONS=768,BLUE='#78d8ff',RED='#ff8c78';
const GRID_COLORS={blue:new THREE.Color(BLUE),red:new THREE.Color(RED),asphalt:new THREE.Color('#42515e'),blocked:new THREE.Color('#744f49'),gravel:new THREE.Color('#655e50')};
const LABEL_SIZE_STYLES=['font','letterSpacing','padding','borderWidth','maxWidth','width','whiteSpace'];
const toWorld=p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half});
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const overlap=(a,b,gap=8)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
const badgeBox=(p,size)=>({left:p.x-size.width/2,right:p.x+size.width/2,top:p.y-size.height,bottom:p.y});

// Prefer the projected point, then move a secondary badge beside or above the
// primary one. If the map has no free space, keeping one readable badge wins.
export function placeRoadGuideBadge(anchor,size,bounds,blocked=[],occupied=[]){
 const minX=bounds.left+size.width/2+8,maxX=bounds.right-size.width/2-8,minY=bounds.top+size.height+8,maxY=bounds.bottom-8;
 if(minX>maxX||minY>maxY)return null;
 const clamp=p=>({x:Math.max(minX,Math.min(maxX,p.x)),y:Math.max(minY,Math.min(maxY,p.y))});
 const candidates=[clamp(anchor)];
 for(const box of [...occupied,...blocked]){
  candidates.push(clamp({x:box.right+size.width/2+10,y:anchor.y}),clamp({x:box.left-size.width/2-10,y:anchor.y}),clamp({x:anchor.x,y:box.top-10}),clamp({x:anchor.x,y:box.bottom+size.height+10}));
 }
 return candidates.find(p=>![...blocked,...occupied].some(box=>overlap(badgeBox(p,size),box)))||null;
}

// These are disposable drawing aids, never pavement, road controls or save data.
// Four persistent draw objects are updated only when the pointer changes.
class BufferBatch{
 constructor(object){this.object=object;this.geometry=object.geometry;this.capacity=0;this.array=null;this.colorArray=null;}
 write(values,colors=null){
  let grew=false;
  if(values.length>this.capacity){
   this.capacity=3*2**Math.ceil(Math.log2(Math.max(1024,Math.ceil(values.length/3))));
   // Releasing the previous attribute's GPU allocation before growing avoids
   // leaving abandoned WebGL buffers behind when a short drag becomes long.
   if(this.array)this.geometry.dispose();
   this.array=new Float32Array(this.capacity);
   this.geometry.setAttribute('position',new THREE.BufferAttribute(this.array,3).setUsage(THREE.DynamicDrawUsage));
   grew=true;
  }
  if(this.array){this.array.set(values);this.geometry.attributes.position.needsUpdate=true;}
  if(colors||this.colorArray){
   if(!this.colorArray||grew){this.colorArray=new Float32Array(this.capacity/3*4).fill(1);this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colorArray,4).setUsage(THREE.DynamicDrawUsage));}
   // An ordinary road never inherits a grid tint or opacity. The same pooled
   // attribute remains allocated and harmlessly white while vertex colors are off.
   if(colors)this.colorArray.set(colors);else this.colorArray.fill(1);
   this.geometry.attributes.color.needsUpdate=true;
  }
  this.geometry.setDrawRange(0,values.length/3);this.object.visible=values.length>0;
 }
 dispose(){this.geometry.dispose();this.object.material.dispose();}
}

function material(color,opacity){return new THREE.MeshBasicMaterial({color,opacity,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});}
function lineMaterial(color,opacity){return new THREE.LineBasicMaterial({color,opacity,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});}
function pushPoint(array,p){array.push(p.x,p.y,p.z);}
function segment(array,a,b){pushPoint(array,a);pushPoint(array,b);}
function quad(array,a,b,c,d){pushPoint(array,a);pushPoint(array,b);pushPoint(array,c);pushPoint(array,c);pushPoint(array,b);pushPoint(array,d);}
function colorVertices(array,color,alpha,count){for(let i=0;i<count;i++)array.push(color.r,color.g,color.b,alpha);}
function between(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};}
const metres=value=>value<100?value.toFixed(1):Math.round(value).toLocaleString();

export class RoadGuidePreview{
 constructor(view){
  this.view=view;this.group=new THREE.Group();this.group.name='road-placement-guide';this.group.visible=false;
  this.fill=new BufferBatch(new THREE.Mesh(new THREE.BufferGeometry(),material(BLUE,.22)));
  this.outline=new BufferBatch(new THREE.LineSegments(new THREE.BufferGeometry(),lineMaterial(BLUE,.96)));
  this.dashes=new BufferBatch(new THREE.Mesh(new THREE.BufferGeometry(),material('#effbff',.85)));
  this.guides=new BufferBatch(new THREE.LineSegments(new THREE.BufferGeometry(),lineMaterial(BLUE,.48)));
  this.batches=[this.fill,this.outline,this.dashes,this.guides];
  for(const batch of this.batches){batch.object.frustumCulled=false;batch.object.renderOrder=1000;this.group.add(batch.object);}
  view.scene.add(this.group);this.projected=new THREE.Vector3();this.cameraPoint=new THREE.Vector3();this.labelPoints=[];this.metrics=null;
  this.createLabels();
 }
 createLabels(){
  if(typeof document==='undefined')return;
  this.labelRoot=document.createElement('div');this.labelRoot.className='road-guide-labels';this.labelRoot.hidden=true;
  this.labelRoot.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:35;overflow:hidden;';
  this.labels=[0,1,2,3,4].map((_,index)=>{
   const label=document.createElement('div');label.className='road-guide-badge';label.dataset.roadGuide=['measurement','snap','grid-depth','grid-angle','grid-angle'][index];
   label.style.cssText='position:absolute;display:none;padding:7px 10px;border-radius:4px;background:rgba(16,25,33,.94);color:#f3faff;border:1px solid rgba(130,216,249,.35);box-shadow:0 2px 8px #0005;font:600 12px/1.55 system-ui,sans-serif;white-space:pre-line;max-width:245px;transform:translate(-50%,-100%);text-align:center;font-variant-numeric:tabular-nums;';
   this.labelRoot.append(label);return label;
  });
  this.labels[0].title='Length follows the drawn centerline. Slope is an endpoint estimate; final road grading may differ.';
  document.body.append(this.labelRoot);
  this.labelFonts=document.fonts;this.invalidateLabelSizes=()=>{this.labelSizes=null;};
  this.labelFonts?.addEventListener?.('loadingdone',this.invalidateLabelSizes);
  this.labelFonts?.addEventListener?.('loadingerror',this.invalidateLabelSizes);
 }
 labelText(index,text){const label=this.labels?.[index];if(label&&label.textContent!==text){label.textContent=text;this.labelSizes=null;}}
 fillAppearance(grid,color){const material=this.fill.object.material;if(material.vertexColors!==grid){material.vertexColors=grid;material.needsUpdate=true;}material.color.set(grid?'#ffffff':color);material.opacity=grid?1:.22;}
 height(x,z){
  const view=this.view,h=view.roadworks?.height?.(view.world,x,z)??view.renderFloor?.(view.world,x,z)??0;
  return Number.isFinite(h)?h:0;
 }
 surface(x,z,lift=.23){return {x,y:this.height(x,z)+lift,z};}
 update(controls,type,valid,details={}){
  if(!Array.isArray(controls)||controls.length<2||controls.some(p=>!finitePoint(p))){this.clear();return;}
  const engine=globalThis.CityEngine,raw=details.points||engine.sampleRoad(controls),samples=raw.filter(finitePoint);
  if(!samples.length){this.clear();return;}
  const points=[],stride=Math.max(1,Math.ceil((samples.length-1)/(MAX_STATIONS-1)));
  for(let i=0;i<samples.length;i+=stride)points.push(toWorld(samples[i]));
  const last=toWorld(samples.at(-1));if(!points.length||Math.hypot(points.at(-1).x-last.x,points.at(-1).z-last.z)>1e-8)points.push(last);
  let length=0;for(let i=1;i<samples.length;i++)length+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y)*20;
  const spec=engine.ROADS[type],width=type==='path'?.65:(spec?.width??2.45)+(spec?.sidewalk?.8:0),half=width/2;
  const fill=[],outline=[],dashes=[],guides=[],left=[],right=[],center=[];
  for(let i=0;i<points.length;i++){
   const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
   let dx=after.x-before.x,dz=after.z-before.z,n=Math.hypot(dx,dz);if(n<1e-9){dx=1;dz=0;n=1;}
   const nx=-dz/n,nz=dx/n;
   left.push(this.surface(p.x+nx*half,p.z+nz*half));right.push(this.surface(p.x-nx*half,p.z-nz*half));center.push(this.surface(p.x,p.z,.25));
  }
  let walked=0;
  for(let i=1;!details.anchorOnly&&length>.01&&i<points.length;i++){
   quad(fill,left[i-1],right[i-1],left[i],right[i]);segment(outline,left[i-1],left[i]);segment(outline,right[i-1],right[i]);
   const a=center[i-1],b=center[i],dx=b.x-a.x,dz=b.z-a.z,span=Math.hypot(dx,dz);
   if(span>1e-8){
    const dashLength=.9,period=1.65,dashHalf=Math.max(.035,width*.05),nx=-dz/span*dashHalf,nz=dx/span*dashHalf;
    for(let mark=Math.floor(walked/period)*period;mark<walked+span;mark+=period){
     const from=Math.max(0,mark-walked),to=Math.min(span,mark+dashLength-walked);if(to<=from)continue;
     const t=from/span,u=to/span,at={x:a.x+dx*t,y:a.y+(b.y-a.y)*t,z:a.z+dz*t},bt={x:a.x+dx*u,y:a.y+(b.y-a.y)*u,z:a.z+dz*u};
     quad(dashes,{x:at.x+nx,y:at.y,z:at.z+nz},{x:at.x-nx,y:at.y,z:at.z-nz},{x:bt.x+nx,y:bt.y,z:bt.z+nz},{x:bt.x-nx,y:bt.y,z:bt.z-nz});
    }
   }walked+=span;
  }
  if(!details.anchorOnly&&length>.01&&points.length>1){segment(outline,left[0],right[0]);segment(outline,left.at(-1),right.at(-1));}
  const ring=(p,radius,array=outline,steps=40)=>{let previous;for(let i=0;i<=steps;i++){const angle=i/steps*Math.PI*2,q=this.surface(p.x+Math.cos(angle)*radius,p.z+Math.sin(angle)*radius,.27);if(previous)segment(array,previous,q);previous=q;}};
  ring(points[0],details.anchorOnly?.48:Math.max(.48,half+.18));if(!details.anchorOnly&&length>.01)ring(last,Math.max(.48,half+.18));
  if(!details.anchorOnly&&length>.01){
   const start=points[0],radius=width*2.5,tangent=points.find(p=>Math.hypot(p.x-start.x,p.z-start.z)>1e-7);
   ring(start,radius,guides,80);
   if(tangent){const dx=tangent.x-start.x,dz=tangent.z-start.z,n=Math.hypot(dx,dz);segment(guides,this.surface(start.x-dx/n*radius,start.z-dz/n*radius,.27),this.surface(start.x+dx/n*radius,start.z+dz/n*radius,.27));}
   // An angle needs an actual reference direction. A circular alignment guide
   // remains useful even when no prior road supplies one.
   const reference=details.referenceTangent;
   if(finitePoint(reference)&&Math.hypot(reference.x,reference.y)>1e-7&&tangent){
    const from=Math.atan2(reference.y,reference.x),to=Math.atan2(tangent.z-start.z,tangent.x-start.x),angle=Math.atan2(Math.sin(to-from),Math.cos(to-from)),arcRadius=width*1.8;
    segment(guides,this.surface(start.x,start.z,.27),this.surface(start.x+Math.cos(from)*radius,start.z+Math.sin(from)*radius,.27));
    const steps=Math.max(2,Math.ceil(Math.abs(angle)*16));let previous;
    for(let i=0;i<=steps;i++){const a=from+angle*i/steps,p=this.surface(start.x+Math.cos(a)*arcRadius,start.z+Math.sin(a)*arcRadius,.27);if(previous)segment(guides,previous,p);previous=p;}
   }
  }
  if(!details.anchorOnly&&controls.length===3){const bend=toWorld(controls[1]);ring(bend,.35);segment(guides,this.surface(points[0].x,points[0].z,.27),this.surface(bend.x,bend.z,.27));segment(guides,this.surface(bend.x,bend.z,.27),this.surface(last.x,last.z,.27));}
  for(const guide of (details.snap?.guides||[]).slice(0,8)){
   if(!finitePoint(guide.a)||!finitePoint(guide.b))continue;const a=toWorld(guide.a),b=toWorld(guide.b),distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.min(128,Math.ceil(distance/2)));
   let previous;for(let i=0;i<=steps;i++){const t=i/steps,p=this.surface(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.25);if(previous)segment(guides,previous,p);previous=p;}
  }
  const color=valid?BLUE:RED;this.fillAppearance(false,color);this.outline.object.material.color.set(color);this.guides.object.material.color.set(color);
  this.fill.write(fill);this.outline.write(outline);this.dashes.write(dashes);this.guides.write(guides);this.group.visible=true;
  const first=points[0],chord=Math.hypot(last.x-first.x,last.z-first.z),slope=chord>1e-8?(this.height(last.x,last.z)-this.height(first.x,first.z))/chord*100:0;
  this.metrics={lengthMeters:length,endpointSlopePercent:slope,stations:points.length,drawObjects:this.batches.filter(b=>b.object.visible).length};
  const middle=center[Math.floor(center.length/2)],end=center.at(-1);this.labelPoints=[{...middle},{...end}];
  if(this.labels){
   this.labelMode=details.gridEdge?'grid-edge':details.anchorOnly?'anchor':'road';
   for(let i=2;i<this.labels.length;i++)this.labelText(i,'');
   this.labels[0].title=details.gridEdge?'Set the first edge, then choose the depth of the street grid.':'Length follows the drawn centerline. Slope is an endpoint estimate; final road grading may differ.';
   const measured=metres(length);
   this.labelText(0,details.gridEdge?`${measured} m · Grid width\n${valid?'Click to choose the grid depth':details.reason||'Choose a valid first edge'}`:details.anchorOnly?'':length<.01?'Choose an endpoint':`${measured} m  ·  ${valid&&Number.isFinite(details.cost)?'₡'+Math.round(details.cost).toLocaleString():details.reason||'Road preview'}\nEndpoint grade ~${slope>=0?'+':''}${slope.toFixed(1)}%`);
   this.labels[0].style.borderColor=valid?'rgba(130,216,249,.45)':'rgba(255,140,120,.7)';
   const snap=details.snap,angle=Number.isFinite(snap?.angleDegrees)?Math.round(snap.angleDegrees)+'°':'';
   this.labelText(1,[snap?.label,angle].filter(Boolean).join(' · ')||(details.anchorOnly?'Choose start':''));this.labelRoot.hidden=false;this.updateLabels();
  }
 }
 showParallel(plan,type,valid,details={}){
  const raw=[plan?.samples?.primary,plan?.samples?.secondary];
  if(raw.some(points=>!Array.isArray(points)||points.length<2||points.some(p=>!finitePoint(p)))){this.clear();return;}
  const spec=globalThis.CityEngine.ROADS[type],width=(spec?.width??2.45)+(spec?.sidewalk?.8:0),half=width/2,innerRatio=Math.min((spec?.width??width)/2,half-.07)/half;
  const fill=[],colors=[],outline=[],dashes=[],guides=[],outerColor=valid?GRID_COLORS.blue:GRID_COLORS.red,asphaltColor=valid?(type==='gravel'?GRID_COLORS.gravel:GRID_COLORS.asphalt):GRID_COLORS.blocked;
  const totalSamples=raw[0].length+raw[1].length;
  const corridors=raw.map(samples=>{
   const budget=totalSamples<=MAX_GRID_STATIONS?samples.length:Math.max(2,Math.floor((MAX_GRID_STATIONS-4)*samples.length/totalSamples)+2),points=[],stride=Math.max(1,Math.ceil((samples.length-1)/(budget-1)));let lengthMeters=0;
   for(let i=1;i<samples.length;i++)lengthMeters+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y)*20;
   for(let i=0;i<samples.length;i+=stride)points.push(toWorld(samples[i]));
   const end=toWorld(samples.at(-1));if(Math.hypot(points.at(-1).x-end.x,points.at(-1).z-end.z)>1e-8)points.push(end);
   const left=[],right=[],center=[],distances=[0];
   for(let i=0;i<points.length;i++){
    const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dz=after.z-before.z,n=Math.hypot(dx,dz),nx=n>1e-9?-dz/n:0,nz=n>1e-9?dx/n:1;
    left.push(this.surface(p.x+nx*half,p.z+nz*half));right.push(this.surface(p.x-nx*half,p.z-nz*half));const middle=between(left[i],right[i],.5);middle.y+=.02;center.push(middle);
    if(i)distances.push(distances.at(-1)+Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z));
   }
   return {points,left,right,center,distances,lengthMeters,length:distances.at(-1)};
  });
  // Sampling the two road edges once supplies the carriageway, center markings
  // and arrows. Distinct roads still sample their own terrain; no height cache
  // or assumption of a flat median is involved.
  const at=(road,distance)=>{
   let i=1;while(i<road.distances.length-1&&road.distances[i]<distance)i++;
   const before=road.center[Math.max(0,i-1)],after=road.center[Math.min(i,road.center.length-1)],span=Math.hypot(after.x-before.x,after.z-before.z),t=span>1e-9?Math.max(0,Math.min(1,(distance-road.distances[Math.max(0,i-1)])/span)):0;
   const p=between(before,after,t),l=between(road.left[Math.max(0,i-1)],road.left[Math.min(i,road.left.length-1)],t),r=between(road.right[Math.max(0,i-1)],road.right[Math.min(i,road.right.length-1)],t),tangent=span>1e-9?{x:(after.x-before.x)/span,z:(after.z-before.z)/span}:{x:1,z:0};
   return {p,tangent,along:span>1e-9?(after.y-before.y)/span:0,across:(l.y-r.y)/width};
  };
  const shifted=(station,along,cross)=>({x:station.p.x+station.tangent.x*along-station.tangent.z*cross,y:station.p.y+station.along*along+station.across*cross,z:station.p.z+station.tangent.z*along+station.tangent.x*cross});
  const ring=(p,radius,array=outline,steps=40)=>{let previous;for(let i=0;i<=steps;i++){const angle=i/steps*Math.PI*2,q=this.surface(p.x+Math.cos(angle)*radius,p.z+Math.sin(angle)*radius,.27);if(previous)segment(array,previous,q);previous=q;}};
  const arrows=[];
  for(const road of corridors){
   for(let i=1;i<road.points.length;i++){
    if(road.distances[i]-road.distances[i-1]<1e-8)continue;
    const l=road.left[i-1],r=road.right[i-1],ll=road.left[i],rr=road.right[i];
    quad(fill,l,r,ll,rr);colorVertices(colors,outerColor,.22,6);
    quad(fill,between(l,r,(1-innerRatio)/2),between(l,r,(1+innerRatio)/2),between(ll,rr,(1-innerRatio)/2),between(ll,rr,(1+innerRatio)/2));colorVertices(colors,asphaltColor,.42,6);
    segment(outline,l,ll);segment(outline,r,rr);
   }
   if(road.length>1e-8){
    segment(outline,road.left[0],road.right[0]);segment(outline,road.left.at(-1),road.right.at(-1));
    const period=Math.max(2.4,road.length/256);
    for(let mark=.3;mark<road.length-.3;mark+=period){const a=at(road,mark),b=at(road,Math.min(road.length-.3,mark+1.1)),h=width*.016;quad(dashes,shifted(a,0,h),shifted(a,0,-h),shifted(b,0,h),shifted(b,0,-h));}
    const station=at(road,road.length*.58),size=Math.min(width*1.7,road.length*.32),head=size*.45,tip=shifted(station,size*.5,0),tail=shifted(station,-size*.5,0);
    quad(dashes,shifted(station,-size*.5,width*.07),shifted(station,-size*.5,-width*.07),shifted(station,size*.5-head,width*.07),shifted(station,size*.5-head,-width*.07));
    pushPoint(dashes,tip);pushPoint(dashes,shifted(station,size*.5-head,width*.28));pushPoint(dashes,shifted(station,size*.5-head,-width*.28));arrows.push({from:tail,to:tip});
   }
   ring(road.points[0],half+.18);if(road.length>1e-8)ring(road.points.at(-1),half+.18);
  }
  const primary=corridors[0],start=primary.points[0],end=primary.points.at(-1),radius=width*2.5;
  if(primary.length>1e-8){
   ring(start,radius,guides,80);const station=at(primary,0);segment(guides,shifted(station,-radius,0),shifted(station,radius,0));
   const reference=details.referenceTangent;
   if(finitePoint(reference)&&Math.hypot(reference.x,reference.y)>1e-7){const n=Math.hypot(reference.x,reference.y);segment(guides,this.surface(start.x,start.z,.27),this.surface(start.x+reference.x/n*radius,start.z+reference.y/n*radius,.27));}
  }
  if(plan.primary?.length===3&&finitePoint(plan.primary[1])){const bend=toWorld(plan.primary[1]);ring(bend,.35);segment(guides,this.surface(start.x,start.z,.27),this.surface(bend.x,bend.z,.27));segment(guides,this.surface(bend.x,bend.z,.27),this.surface(end.x,end.z,.27));}
  let gapMiddle=between(at(primary,primary.length/2).p,at(corridors[1],corridors[1].length/2).p,.5);
  const gap=plan.gapGuide||plan.gapSegment;
  if(finitePoint(gap?.a)&&finitePoint(gap?.b)){
   const aa=toWorld(gap.a),bb=toWorld(gap.b),a=this.surface(aa.x,aa.z,.32),b=this.surface(bb.x,bb.z,.32),span=Math.hypot(b.x-a.x,b.z-a.z);gapMiddle=between(a,b,.5);segment(guides,a,b);
   if(span>1e-8){const dx=(b.x-a.x)/span,dz=(b.z-a.z)/span,size=Math.min(width*.24,span*.22),h=size*.45;for(const [tip,sign]of [[a,1],[b,-1]]){const base={x:tip.x+dx*size*sign,y:tip.y+(b.y-a.y)/span*size*sign,z:tip.z+dz*size*sign};pushPoint(dashes,tip);pushPoint(dashes,{x:base.x-dz*h,y:base.y,z:base.z+dx*h});pushPoint(dashes,{x:base.x+dz*h,y:base.y,z:base.z-dx*h});}}
  }
  for(const guide of (details.snap?.guides||[]).slice(0,8)){
   if(!finitePoint(guide.a)||!finitePoint(guide.b))continue;const a=toWorld(guide.a),b=toWorld(guide.b),steps=Math.max(1,Math.min(128,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2)));let previous;
   for(let i=0;i<=steps;i++){const t=i/steps,p=this.surface(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.25);if(previous)segment(guides,previous,p);previous=p;}
  }
  const color=valid?BLUE:RED;this.fillAppearance(true,color);this.outline.object.material.color.set(color);this.guides.object.material.color.set(color);
  this.fill.write(fill,colors);this.outline.write(outline);this.dashes.write(dashes);this.guides.write(guides);this.group.visible=true;
  const gapMeters=Number.isFinite(plan.gap)?plan.gap*20:null;this.metrics={mode:'parallel',roadCount:2,stations:corridors.reduce((n,r)=>n+r.points.length,0),lengthMeters:corridors.reduce((n,r)=>n+r.lengthMeters,0),primaryLengthMeters:primary.lengthMeters,secondaryLengthMeters:corridors[1].lengthMeters,gapMeters,arrows,drawObjects:this.batches.filter(batch=>batch.object.visible).length};
  this.labelPoints=[at(primary,primary.length).p,gapMiddle,at(primary,primary.length*.36).p,at(corridors[1],corridors[1].length*.36).p,at(primary,primary.length).p];
  if(this.labels){
   this.labelMode='parallel';this.labels[0].title='Combined construction cost for both roads. Arrows follow each authored road direction.';
   this.labelText(0,Number.isFinite(details.cost)?['₡'+Math.round(details.cost).toLocaleString(),!valid&&details.reason,'2 parallel roads'].filter(Boolean).join('\n'):details.reason||'2 parallel roads');this.labels[0].style.borderColor=valid?'rgba(130,216,249,.45)':'rgba(255,140,120,.7)';
   this.labelText(1,gapMeters===null?'':`↔ ${metres(gapMeters)} m clear gap`);this.labelText(2,`Road 1 · ${metres(primary.lengthMeters)} m`);this.labelText(3,`Road 2 · ${metres(corridors[1].lengthMeters)} m`);
   this.labelText(4,[details.snap?.label,Number.isFinite(details.snap?.angleDegrees)?Math.round(details.snap.angleDegrees)+'°':''].filter(Boolean).join(' · '));this.labelRoot.hidden=false;this.updateLabels();
  }
 }
 showGrid(plan,type,valid,details={}){
  const paths=plan?.paths,corners=plan?.corners;
  if(!Array.isArray(paths)||!paths.length||paths.length>MAX_GRID_PATHS||paths.some(path=>!Array.isArray(path)||path.length!==2||path.some(p=>!finitePoint(p)))){this.clear();return;}
  // The engine owns staging. A first-edge plan has no depth; recognizing its
  // geometry also keeps the guide independent of the UI's stage numbering.
  const full=Array.isArray(corners)&&corners.length===4&&corners.every(finitePoint)&&Math.hypot(corners[3].x-corners[0].x,corners[3].y-corners[0].y)>1e-7;
  if(!full){
   this.update(paths[0],type,valid,{...details,gridEdge:true});
   if(this.metrics){this.metrics.mode='grid';this.metrics.roadCount=1;this.metrics.stage='edge';}
   return;
  }
  const engine=globalThis.CityEngine,spec=engine.ROADS[type],width=type==='path'?.65:(spec?.width??2.45)+(spec?.sidewalk?.8:0),half=width/2;
  const fill=[],fillColors=[],outline=[],dashes=[],guides=[],worldCorners=corners.map(toWorld),perPath=Math.floor(MAX_GRID_STATIONS/paths.length);
  const outerColor=valid?GRID_COLORS.blue:GRID_COLORS.red,asphaltColor=valid?(type==='gravel'?GRID_COLORS.gravel:GRID_COLORS.asphalt):GRID_COLORS.blocked,asphaltHalf=Math.min((spec?.width??width)/2,half-.07),asphaltRatio=asphaltHalf/half;
  const a=worldCorners[0],b=worldCorners[1],d=worldCorners[3],widthWorld=Math.hypot(b.x-a.x,b.z-a.z),depthWorld=Math.hypot(d.x-a.x,d.z-a.z);
  if(widthWorld<1e-7){this.clear();return;}
  const ux=(b.x-a.x)/widthWorld,uz=(b.z-a.z)/widthWorld,vx=(d.x-a.x)/depthWorld,vz=(d.z-a.z)/depthWorld;
  const perimeter=(p,q)=>{const near=(x,y)=>Math.hypot(x.x-y.x,x.z-y.z)<1e-5;return worldCorners.findIndex((c,i)=>near(c,p)&&near(worldCorners[(i+1)%4],q)||near(c,q)&&near(worldCorners[(i+1)%4],p));};
  let stationCount=0,totalLength=0;
  for(const path of paths){
   const start=toWorld(path[0]),end=toWorld(path[1]),dx=end.x-start.x,dz=end.z-start.z,span=Math.hypot(dx,dz);if(span<1e-7)continue;
   const steps=Math.max(1,Math.min(perPath-1,Math.ceil(span/2))),nx=-dz/span,nz=dx/span,perimeterIndex=perimeter(start,end),drawingAxis=perimeterIndex===0||perimeterIndex===1,edge=perimeterIndex>=0?outline:guides;
   let beforeLeft,beforeRight,beforeInnerLeft,beforeInnerRight;
   for(let i=0;i<=steps;i++){
    const t=i/steps,x=start.x+dx*t,z=start.z+dz*t,left=this.surface(x+nx*half,z+nz*half),right=this.surface(x-nx*half,z-nz*half);
    const innerLeft=between(left,right,(1-asphaltRatio)/2),innerRight=between(left,right,(1+asphaltRatio)/2);
    if(beforeLeft){
     quad(fill,beforeLeft,beforeRight,left,right);colorVertices(fillColors,outerColor,.22,6);
     // Darken the carriageway while retaining the cyan sidewalk/edge band.
     // The inner section lies on the already sampled ribbon: no extra height work.
     quad(fill,beforeInnerLeft,beforeInnerRight,innerLeft,innerRight);colorVertices(fillColors,asphaltColor,.42,6);
     segment(edge,beforeLeft,left);segment(edge,beforeRight,right);
    }
    beforeLeft=left;beforeRight=right;beforeInnerLeft=innerLeft;beforeInnerRight=innerRight;
   }
   stationCount+=steps+1;totalLength+=span*5;
   {
    // Keep the construction axes prominent while giving the interior streets
    // quieter lane markings instead of leaving featureless blue bands.
    const dashHalf=width*(drawingAxis?.05:.016),dashLength=drawingAxis?.9:1.1,period=Math.max(drawingAxis?1.65:2.4,span/256),inset=drawingAxis?0:half+.12;
    for(let mark=inset;mark<span-inset;mark+=period){
     const to=Math.min(span-inset,mark+dashLength),x=start.x+dx*mark/span,z=start.z+dz*mark/span,ex=start.x+dx*to/span,ez=start.z+dz*to/span;
     quad(dashes,this.surface(x+nx*dashHalf,z+nz*dashHalf,.25),this.surface(x-nx*dashHalf,z-nz*dashHalf,.25),this.surface(ex+nx*dashHalf,ez+nz*dashHalf,.25),this.surface(ex-nx*dashHalf,ez-nz*dashHalf,.25));
    }
   }
  }
  const ring=(p,radius,array=outline,steps=40)=>{let previous;for(let i=0;i<=steps;i++){const angle=i/steps*Math.PI*2,q=this.surface(p.x+Math.cos(angle)*radius,p.z+Math.sin(angle)*radius,.27);if(previous)segment(array,previous,q);previous=q;}};
  for(const corner of worldCorners)ring(corner,half+.18);
  // The outer halo follows the real rectangular footprint, with rounded
  // corners so it reads as an alignment aid rather than another road.
  const orthogonal=Math.abs(ux*vx+uz*vz)<1e-5;
  if(orthogonal){
   const radius=width*2.5,point=(u,v)=>this.surface(a.x+ux*u+vx*v,a.z+uz*u+vz*v,.27),rounded=[];
   for(const [u,v,from]of [[0,0,Math.PI],[widthWorld,0,Math.PI*1.5],[widthWorld,depthWorld,0],[0,depthWorld,Math.PI*.5]]){
    // Straight ribbons meet at their centerline ends. Fill only the missing
    // outer quarter, avoiding any extra surface inside the open city block.
    const center=this.surface(a.x+ux*u+vx*v,a.z+uz*u+vz*v);let previous;
    for(let i=0;i<=16;i++){
     const angle=from+i/16*Math.PI/2,xx=u+Math.cos(angle)*half,zz=v+Math.sin(angle)*half,q=this.surface(a.x+ux*xx+vx*zz,a.z+uz*xx+vz*zz);
     if(previous){
      pushPoint(fill,center);pushPoint(fill,previous);pushPoint(fill,q);colorVertices(fillColors,outerColor,.22,3);
      pushPoint(fill,center);pushPoint(fill,between(center,previous,asphaltRatio));pushPoint(fill,between(center,q,asphaltRatio));colorVertices(fillColors,asphaltColor,.42,3);segment(outline,previous,q);
     }previous=q;
    }
    for(let i=0;i<=20;i++){const angle=from+i/20*Math.PI/2;rounded.push(point(u+Math.cos(angle)*radius,v+Math.sin(angle)*radius));}
   }
   for(let i=0;i<rounded.length;i++)segment(guides,rounded[i],rounded[(i+1)%rounded.length]);
   // Right-angle brackets are grounded in the two perpendicular grid axes.
   const r=width*.95,stroke=(p,q)=>{const dx=q.x-p.x,dz=q.z-p.z,n=Math.hypot(dx,dz),nx=-dz/n*.07,nz=dx/n*.07;quad(dashes,{x:p.x+nx,y:p.y,z:p.z+nz},{x:p.x-nx,y:p.y,z:p.z-nz},{x:q.x+nx,y:q.y,z:q.z+nz},{x:q.x-nx,y:q.y,z:q.z-nz});};
   for(const [u,v,sign]of [[0,0,1],[widthWorld,0,-1]]){stroke(point(u+sign*r,v),point(u+sign*r,v+r));stroke(point(u+sign*r,v+r),point(u,v+r));}
  }else ring(a,width*2.5,guides,80);
  for(const guide of (details.snap?.guides||[]).slice(0,8)){
   if(!finitePoint(guide.a)||!finitePoint(guide.b))continue;const from=toWorld(guide.a),to=toWorld(guide.b),steps=Math.max(1,Math.min(128,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/2)));let previous;
   for(let i=0;i<=steps;i++){const t=i/steps,p=this.surface(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,.25);if(previous)segment(guides,previous,p);previous=p;}
  }
  const color=valid?BLUE:RED;this.fillAppearance(true,color);this.outline.object.material.color.set(color);this.guides.object.material.color.set(color);
  this.fill.write(fill,fillColors);this.outline.write(outline);this.dashes.write(dashes);this.guides.write(guides);this.group.visible=true;
  this.metrics={mode:'grid',stage:'grid',roadCount:paths.length,stations:stationCount,widthMeters:widthWorld*5,depthMeters:depthWorld*5,lengthMeters:totalLength,drawObjects:this.batches.filter(batch=>batch.object.visible).length};
  const middle=(p,q)=>this.surface((p.x+q.x)/2,(p.z+q.z)/2,.3);this.labelPoints=[this.surface(worldCorners[2].x,worldCorners[2].z,.3),middle(a,b),middle(b,worldCorners[2]),this.surface(a.x,a.z,.3),this.surface(b.x,b.z,.3)];
  if(this.labels){
   this.labelMode='grid';
   const columns=Math.max(0,Math.min(8,Math.floor(plan.columns||0))),rows=Math.max(0,Math.min(8,Math.floor(plan.rows||0))),blocks=columns*rows;
   this.labels[0].title='Total construction cost for the complete street grid. Road grading is calculated when built.';
   this.labelText(0,Number.isFinite(details.cost)?['₡'+Math.round(details.cost).toLocaleString(),!valid&&details.reason,`${columns} × ${rows} · ${blocks} ${blocks===1?'block':'blocks'}`].filter(Boolean).join('\n'):details.reason||'Grid preview');
   this.labels[0].style.borderColor=valid?'rgba(130,216,249,.45)':'rgba(255,140,120,.7)';
   this.labelText(1,`↔ ${metres(widthWorld*5)} m`);this.labelText(2,`↔ ${metres(depthWorld*5)} m`);
   this.labelText(3,orthogonal?'∟ 90°':'');this.labelText(4,orthogonal?'∟ 90°':'');
   this.labelRoot.hidden=false;this.updateLabels();
  }
 }
 updateLabels(){
  if(!this.labels||!this.group.visible||!this.view.camera)return;
  const rect=this.view.canvas?.getBoundingClientRect?.()||{left:0,top:0,width:globalThis.innerWidth||1280,height:globalThis.innerHeight||720};
  const panel=typeof document==='undefined'?null:document.getElementById('buildPanel'),panelRect=panel&&!panel.hidden?panel.getBoundingClientRect():null;
  const bounds={left:rect.left,right:rect.left+rect.width,top:rect.top+65,bottom:rect.top+rect.height-95},occupied=[];
  const sizeKey=[this.labelMode,rect.width,rect.height,globalThis.devicePixelRatio||1,...this.labels.map(label=>label.textContent+'\u001f'+LABEL_SIZE_STYLES.map(key=>label.style[key]).join('\u001f'))].join('\u001e');
  if(sizeKey!==this.labelSizeKey){this.labelSizeKey=sizeKey;this.labelSizes=null;}
  const display=(label,value)=>{if(label.style.display!==value)label.style.display=value;};
  if(!this.labelSizes){
   // All visibility writes precede every size read. Interleaving the two
   // forces a fresh browser layout for each badge during a pointer update.
   for(const label of this.labels)display(label,label.textContent?'block':'none');
   this.labelSizes=this.labels.map(label=>{if(!label.textContent)return null;const box=label.getBoundingClientRect();return {width:box.width,height:box.height};});
  }
  for(let i=0;i<this.labels.length;i++){
   const label=this.labels[i],p=this.labelPoints[i];if(!p||!label.textContent){display(label,'none');continue;}
   this.cameraPoint.set(p.x,p.y,p.z).applyMatrix4(this.view.camera.matrixWorldInverse);
   this.projected.set(p.x,p.y,p.z).project(this.view.camera);
   if(this.cameraPoint.z>=0||this.projected.z<-1||this.projected.z>1||Math.abs(this.projected.x)>1||Math.abs(this.projected.y)>1){display(label,'none');continue;}
   const rawX=rect.left+(this.projected.x*.5+.5)*rect.width,rawY=rect.top+(-this.projected.y*.5+.5)*rect.height;
   const size=this.labelSizes[i],position=placeRoadGuideBadge({x:rawX,y:rawY-(i?25:45)},size,bounds,panelRect?[panelRect]:[],occupied);
   if(!position){display(label,'none');continue;}
   occupied.push(badgeBox(position,size));display(label,'block');const left=position.x+'px',top=position.y+'px';if(label.style.left!==left)label.style.left=left;if(label.style.top!==top)label.style.top=top;
  }
 }
 clear(){this.group.visible=false;this.metrics=null;if(this.labelRoot)this.labelRoot.hidden=true;}
 dispose(){this.clear();this.group.removeFromParent();for(const batch of this.batches)batch.dispose();this.labelFonts?.removeEventListener?.('loadingdone',this.invalidateLabelSizes);this.labelFonts?.removeEventListener?.('loadingerror',this.invalidateLabelSizes);this.labelRoot?.remove();}
}

placeRoadGuideBadge=G.bind(placeRoadGuideBadge);
material=G.bind(material);
lineMaterial=G.bind(lineMaterial);
pushPoint=G.bind(pushPoint);
segment=G.bind(segment);
quad=G.bind(quad);
colorVertices=G.bind(colorVertices);
between=G.bind(between);
BufferBatch=G.bindClass(BufferBatch);
RoadGuidePreview=G.bindClass(RoadGuidePreview);
