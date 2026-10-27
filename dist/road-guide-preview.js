import * as THREE from './vendor/three.module.js';

const MAX_STATIONS=384,BLUE='#78d8ff',RED='#ff8c78';
const toWorld=p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96});
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
 constructor(object){this.object=object;this.geometry=object.geometry;this.capacity=0;this.array=null;}
 write(values){
  if(values.length>this.capacity){
   this.capacity=3*2**Math.ceil(Math.log2(Math.max(1024,Math.ceil(values.length/3))));
   // Releasing the previous attribute's GPU allocation before growing avoids
   // leaving abandoned WebGL buffers behind when a short drag becomes long.
   if(this.array)this.geometry.dispose();
   this.array=new Float32Array(this.capacity);
   this.geometry.setAttribute('position',new THREE.BufferAttribute(this.array,3).setUsage(THREE.DynamicDrawUsage));
  }
  if(this.array){this.array.set(values);this.geometry.attributes.position.needsUpdate=true;}
  this.geometry.setDrawRange(0,values.length/3);this.object.visible=values.length>0;
 }
 dispose(){this.geometry.dispose();this.object.material.dispose();}
}

function material(color,opacity){return new THREE.MeshBasicMaterial({color,opacity,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});}
function lineMaterial(color,opacity){return new THREE.LineBasicMaterial({color,opacity,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});}
function pushPoint(array,p){array.push(p.x,p.y,p.z);}
function segment(array,a,b){pushPoint(array,a);pushPoint(array,b);}
function quad(array,a,b,c,d){pushPoint(array,a);pushPoint(array,b);pushPoint(array,c);pushPoint(array,c);pushPoint(array,b);pushPoint(array,d);}

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
  this.labels=[0,1].map((_,index)=>{
   const label=document.createElement('div');label.className='road-guide-badge';label.dataset.roadGuide=index?'snap':'measurement';
   label.style.cssText='position:absolute;display:none;padding:7px 10px;border-radius:4px;background:rgba(16,25,33,.94);color:#f3faff;border:1px solid rgba(130,216,249,.35);box-shadow:0 2px 8px #0005;font:600 12px/1.55 system-ui,sans-serif;white-space:pre-line;max-width:245px;transform:translate(-50%,-100%);text-align:center;font-variant-numeric:tabular-nums;';
   this.labelRoot.append(label);return label;
  });
  this.labels[0].title='Length follows the drawn centerline. Slope is an endpoint estimate; final road grading may differ.';
  document.body.append(this.labelRoot);
 }
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
  const color=valid?BLUE:RED;this.fill.object.material.color.set(color);this.outline.object.material.color.set(color);this.guides.object.material.color.set(color);
  this.fill.write(fill);this.outline.write(outline);this.dashes.write(dashes);this.guides.write(guides);this.group.visible=true;
  const first=points[0],chord=Math.hypot(last.x-first.x,last.z-first.z),slope=chord>1e-8?(this.height(last.x,last.z)-this.height(first.x,first.z))/chord*100:0;
  this.metrics={lengthMeters:length,endpointSlopePercent:slope,stations:points.length,drawObjects:this.batches.filter(b=>b.object.visible).length};
  const middle=center[Math.floor(center.length/2)],end=center.at(-1);this.labelPoints=[{...middle},{...end}];
  if(this.labels){
   const metres=length<100?length.toFixed(1):Math.round(length).toLocaleString();
   this.labels[0].textContent=details.anchorOnly?'':length<.01?'Choose an endpoint':`${metres} m  ·  ${valid&&Number.isFinite(details.cost)?'₡'+Math.round(details.cost).toLocaleString():details.reason||'Road preview'}\nEndpoint grade ~${slope>=0?'+':''}${slope.toFixed(1)}%`;
   this.labels[0].style.borderColor=valid?'rgba(130,216,249,.45)':'rgba(255,140,120,.7)';
   const snap=details.snap,angle=Number.isFinite(snap?.angleDegrees)?Math.round(snap.angleDegrees)+'°':'';
   this.labels[1].textContent=[snap?.label,angle].filter(Boolean).join(' · ')||(details.anchorOnly?'Choose start':'');this.labelSizes=null;this.labelRoot.hidden=false;this.updateLabels();
  }
 }
 updateLabels(){
  if(!this.labels||!this.group.visible||!this.view.camera)return;
  const rect=this.view.canvas?.getBoundingClientRect?.()||{left:0,top:0,width:globalThis.innerWidth||1280,height:globalThis.innerHeight||720};
  const panel=typeof document==='undefined'?null:document.getElementById('buildPanel'),panelRect=panel&&!panel.hidden?panel.getBoundingClientRect():null;
  const bounds={left:rect.left,right:rect.left+rect.width,top:rect.top+65,bottom:rect.top+rect.height-95},occupied=[];
  if(!this.labelSizes){this.labelSizes=this.labels.map(label=>{label.style.display='block';const box=label.getBoundingClientRect();return {width:box.width,height:box.height};});}
  for(let i=0;i<this.labels.length;i++){
   const label=this.labels[i],p=this.labelPoints[i];if(!p||!label.textContent){label.style.display='none';continue;}
   this.cameraPoint.set(p.x,p.y,p.z).applyMatrix4(this.view.camera.matrixWorldInverse);
   this.projected.set(p.x,p.y,p.z).project(this.view.camera);
   if(this.cameraPoint.z>=0||this.projected.z<-1||this.projected.z>1||Math.abs(this.projected.x)>1||Math.abs(this.projected.y)>1){label.style.display='none';continue;}
   const rawX=rect.left+(this.projected.x*.5+.5)*rect.width,rawY=rect.top+(-this.projected.y*.5+.5)*rect.height;
   const size=this.labelSizes[i],position=placeRoadGuideBadge({x:rawX,y:rawY-(i?25:45)},size,bounds,panelRect?[panelRect]:[],occupied);
   if(!position){label.style.display='none';continue;}
   occupied.push(badgeBox(position,size));label.style.display='block';label.style.left=position.x+'px';label.style.top=position.y+'px';
  }
 }
 clear(){this.group.visible=false;this.metrics=null;if(this.labelRoot)this.labelRoot.hidden=true;}
 dispose(){this.clear();this.group.removeFromParent();for(const batch of this.batches)batch.dispose();this.labelRoot?.remove();}
}
