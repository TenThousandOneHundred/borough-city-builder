import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {RoadGuidePreview,placeRoadGuideBadge} from '../dist/road-guide-preview.js';
globalThis.CityEngine=E;

function fixture(){
 const world=E.createWorld('Road guide inspection','plains',134),index=Object.freeze({triangleCount:212,heightRevision:17});
 const view={scene:new T.Scene(),world,roadworks:{surfaces:index,heightRevision:17,height:(_w,x,z)=>3+x*.02+z*.01,ribbon:()=>{throw Error('A preview must not construct permanent pavement');}}};
 const guide=new RoadGuidePreview(view);return {world,index,view,guide};
}
function activeVertices(batch){return Array.from(batch.geometry.attributes.position?.array.subarray(0,batch.geometry.drawRange.count*3)||[]);}

test('road guide outlines the selected width and uses real metres without altering permanent surfaces',()=>{
 const {world,index,view,guide}=fixture(),saved=JSON.stringify(world);
 guide.update([{x:10,y:20},{x:20,y:20}],'avenue',true,{cost:500});
 assert.ok(Math.abs(guide.metrics.lengthMeters-200)<1e-9);assert.ok(Math.abs(guide.metrics.endpointSlopePercent-2)<1e-10);
 assert.equal(guide.group.children.length,4);assert.ok(guide.metrics.drawObjects<=4);
 const points=activeVertices(guide.fill),xs=[],zs=[];
 for(let i=0;i<points.length;i+=3){xs.push(points[i]);zs.push(points[i+2]);}
 assert.equal(Math.min(...xs),-54);assert.equal(Math.max(...xs),-14);
 assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-(E.ROADS.avenue.width+.8))<1e-5);
 assert.equal(view.roadworks.surfaces,index);assert.equal(view.roadworks.heightRevision,17);
 assert.equal(JSON.stringify(world),saved);assert.ok(!guide.fill.object.userData.roadSurface);
 assert.ok(activeVertices(guide.dashes).length>0,'centerline dashes are visible');
 guide.dispose();
});

test('curved guides follow the authored bend and bound long previews without NaNs',()=>{
 const {guide}=fixture(),controls=[{x:0,y:0},{x:47,y:47},{x:47,y:0}];
 guide.update(controls,'street',true,{cost:1500,snap:{guides:[{a:{x:0,y:0},b:{x:47,y:47}}]}});
 assert.ok(guide.metrics.stations<=384);assert.ok(guide.metrics.lengthMeters>940,'length follows arc instead of endpoint chord');
 const points=activeVertices(guide.fill),zs=[];for(let i=2;i<points.length;i+=3)zs.push(points[i]);
 assert.ok(Math.max(...zs)>-1,'preview reaches the actual quadratic bend');
 assert.ok(Math.max(...zs)<2,'preview does not incorrectly pass through the control handle');
 for(const batch of guide.batches){const values=activeVertices(batch);assert.ok(values.every(Number.isFinite));assert.equal(batch.geometry.attributes.position.count%1,0);}
 assert.ok(activeVertices(guide.guides).length>0);guide.dispose();
});

test('pointer updates reuse geometry and materials and clearing never disposes live reusable buffers',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}],geometry=guide.batches.map(b=>b.geometry),materials=guide.batches.map(b=>b.object.material);
 guide.update(controls,'street',true);const attributes=guide.batches.map(b=>b.geometry.attributes.position);let disposals=0;
 for(const batch of guide.batches)batch.geometry.addEventListener('dispose',()=>disposals++);
 for(let i=0;i<80;i++)guide.update([{x:10,y:20},{x:20,y:20+i/800}],'street',i%2===0);
 guide.batches.forEach((batch,i)=>{assert.equal(batch.geometry,geometry[i]);assert.equal(batch.object.material,materials[i]);assert.equal(batch.geometry.attributes.position,attributes[i]);});
 const before=disposals;guide.clear();assert.equal(guide.group.visible,false);assert.equal(guide.metrics,null);assert.equal(disposals,before);
 guide.update(controls,'street',true);assert.equal(guide.group.visible,true);assert.equal(disposals,before);
 guide.dispose();assert.equal(disposals,before+4);assert.equal(guide.group.parent,null);
});

test('zero-length and invalid previews are finite and preserve the controls',()=>{
 const {guide,world}=fixture(),controls=[{x:24,y:24},{x:24,y:24}],saved=JSON.stringify({world,controls});
 guide.update(controls,'path',false,{reason:'Choose an endpoint'});
 assert.equal(guide.metrics.lengthMeters,0);assert.equal(guide.metrics.endpointSlopePercent,0);
 for(const batch of guide.batches)assert.ok(activeVertices(batch).every(Number.isFinite));
 assert.equal(JSON.stringify({world,controls}),saved);
 guide.update([{x:NaN,y:0},{x:1,y:1}],'street',false);assert.equal(guide.group.visible,false);guide.dispose();
});

test('a growth allocation releases previous GPU buffers while preserving four draw objects',()=>{
 const {guide}=fixture();guide.update([{x:10,y:20},{x:10.1,y:20}],'street',true);
 const first=guide.fill.geometry.attributes.position;let released=0;
 guide.fill.geometry.addEventListener('dispose',()=>released++);
 guide.update([{x:0,y:0},{x:47,y:47},{x:47,y:0}],'highway',true);
 assert.notEqual(guide.fill.geometry.attributes.position,first);assert.equal(released,1);
 assert.equal(guide.group.children.length,4);const next=guide.fill.geometry.attributes.position;
 guide.update([{x:47,y:0},{x:0,y:47},{x:0,y:0}],'highway',true);
 assert.equal(guide.fill.geometry.attributes.position,next);assert.equal(released,1);guide.dispose();
});

test('pre-start hover draws only its control ring and optional snapping guides',()=>{
 const {guide}=fixture(),p={x:20,y:20};
 guide.update([p,p],'highway',true,{anchorOnly:true,snap:{label:'Road center',guides:[{a:{x:18,y:20},b:{x:22,y:20}}]}});
 assert.equal(guide.fill.geometry.drawRange.count,0);assert.equal(guide.dashes.geometry.drawRange.count,0);
 assert.ok(guide.outline.geometry.drawRange.count>0);assert.ok(guide.guides.geometry.drawRange.count>0);
 const points=activeVertices(guide.outline);for(let i=0;i<points.length;i+=3)assert.ok(Math.hypot(points[i]+14,points[i+2]+14)<.481);
 guide.dispose();
});

test('guide footprint includes sidewalks but does not add them to highways or footpaths',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}];
 for(const type of ['street','avenue','boulevard','gravel','highway','path']){
  guide.update(controls,type,true);const points=activeVertices(guide.fill),zs=[];for(let i=2;i<points.length;i+=3)zs.push(points[i]);
  const spec=E.ROADS[type],expected=type==='path'?.65:spec.width+(spec.sidewalk?.8:0);
  assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-expected)<1e-5,type);
 }guide.dispose();
});

test('nearby badges separate and a secondary badge hides when the map has no free room',()=>{
 const bounds={left:0,right:1280,top:65,bottom:625},primary={left:490,right:710,top:220,bottom:275};
 const size={width:150,height:35},placed=placeRoadGuideBadge({x:610,y:280},size,bounds,[],[primary]);
 assert.ok(placed);assert.ok(placed.x-size.width/2>=primary.right+8||placed.x+size.width/2<=primary.left-8||placed.y<=primary.top-8||placed.y-size.height>=primary.bottom+8);
 const noRoom=placeRoadGuideBadge({x:200,y:150},{width:150,height:45},{left:0,right:400,top:65,bottom:180},[],[{left:8,right:392,top:73,bottom:172}]);
 assert.equal(noRoom,null);
 const panel={left:300,right:980,top:400,bottom:625},above=placeRoadGuideBadge({x:640,y:520},{width:230,height:52},bounds,[panel]);
 assert.ok(above);assert.ok(above.y<=panel.top-8||above.x-115>=panel.right+8||above.x+115<=panel.left-8);
});

test('active previews have broad alignment rings and legible road-width-scaled center dashes',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}],width=E.ROADS.street.width+.8;
 guide.update(controls,'street',true,{referenceTangent:{x:0,y:1}});
 const dashes=activeVertices(guide.dashes).slice(0,-guide.metrics.arrows.length*27),zs=[];for(let i=2;i<dashes.length;i+=3)zs.push(dashes[i]);
 assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-width*.1)<1e-5);
 const alignment=activeVertices(guide.guides),radii=[];for(let i=0;i<alignment.length;i+=3)radii.push(Math.hypot(alignment[i]+54,alignment[i+2]+14));
 assert.ok(Math.max(...radii)>width*2.49);assert.ok(Math.max(...radii)<width*2.51);
 assert.ok(radii.some(r=>Math.abs(r-width*1.8)<1e-5),'an angle arc uses the supplied reference direction');
 assert.ok(alignment.every(Number.isFinite));assert.equal(guide.group.children.length,4);assert.equal(guide.metrics.drawObjects,4);
 guide.update([controls[0],controls[0]],'street',true,{anchorOnly:true});assert.equal(guide.guides.geometry.drawRange.count,0);guide.dispose();
});

function gridPlan({x=8,y=8,width=24,depth=16,columns=3,rows=2,angle=0}={}){
 const u={x:Math.cos(angle),y:Math.sin(angle)},v={x:-u.y,y:u.x},point=(across,along)=>({x:x+u.x*across+v.x*along,y:y+u.y*across+v.y*along});
 const corners=[point(0,0),point(width,0),point(width,depth),point(0,depth)],paths=corners.map((corner,i)=>[corner,corners[(i+1)%4]]);
 for(let i=1;i<columns;i++)paths.push([point(width*i/columns,0),point(width*i/columns,depth)]);
 for(let i=1;i<rows;i++)paths.push([point(0,depth*i/rows),point(width,depth*i/rows)]);
 return {paths,corners,width,depth,columns,rows,stage:3};
}
function covers(vertices,x,z){
 for(let i=0;i<vertices.length;i+=9){
  const ax=vertices[i],az=vertices[i+2],bx=vertices[i+3],bz=vertices[i+5],cx=vertices[i+6],cz=vertices[i+8];
  const ab=(bx-ax)*(z-az)-(bz-az)*(x-ax),bc=(cx-bx)*(z-bz)-(cz-bz)*(x-bx),ca=(ax-cx)*(z-cz)-(az-cz)*(x-cx);
  if(ab>=-1e-5&&bc>=-1e-5&&ca>=-1e-5||ab<=1e-5&&bc<=1e-5&&ca<=1e-5)return true;
 }return false;
}

test('grid preview draws every road at the selected sidewalk width without painting blocks or mutating the plan/world',()=>{
 const {guide,world,view,index}=fixture(),plan=gridPlan(),saved=JSON.stringify({world,plan});
 for(const path of plan.paths){for(const point of path)Object.freeze(point);Object.freeze(path);}Object.freeze(plan.paths);Object.freeze(plan);
 guide.showGrid(plan,'street',true,{cost:1800});
 assert.equal(guide.metrics.mode,'grid');assert.equal(guide.metrics.roadCount,7);
 assert.equal(guide.metrics.widthMeters,480);assert.equal(guide.metrics.depthMeters,320);
 assert.equal(guide.metrics.lengthMeters,(24*3+16*4)*20);
 assert.equal(guide.metrics.drawObjects,4);assert.equal(guide.group.children.length,4);
 const fill=activeVertices(guide.fill),half=(E.ROADS.street.width+.8)/2;
 for(const path of plan.paths){
  const a=path[0],b=path[1],x=((a.x+b.x)/2+.5)*4-96,z=((a.y+b.y)/2+.5)*4-96,dx=b.x-a.x,dz=b.y-a.y,n=Math.hypot(dx,dz);
  assert.ok(covers(fill,x,z),'every perimeter and internal road is present');
  assert.ok(covers(fill,x-dz/n*half*.99,z+dx/n*half*.99),'road includes its sidewalk allowance');
 }
 assert.equal(covers(fill,(12+.5)*4-96,(12+.5)*4-96),false,'the inside of a block remains unpainted');
 for(let i=0;i<fill.length;i+=3)assert.ok(Math.abs(fill[i+1]-(3+fill[i]*.02+fill[i+2]*.01+.23))<1e-5,'preview follows its surface-height provider');
 assert.equal(JSON.stringify({world,plan}),saved);assert.equal(view.roadworks.surfaces,index);assert.equal(view.roadworks.heightRevision,17);
 guide.dispose();
});

test('rotated maximum grids stay finite and bounded with one shared set of GPU objects',()=>{
 const {guide}=fixture(),plan=gridPlan({x:24,y:2,width:31,depth:31,columns:8,rows:8,angle:Math.PI/4});
 guide.showGrid(plan,'highway',false,{reason:'Outside city boundary'});
 assert.equal(guide.metrics.roadCount,18);assert.ok(guide.metrics.stations<=768);assert.equal(guide.group.children.length,4);
 const fill=activeVertices(guide.fill);
 for(const [a,b]of plan.paths)assert.ok(covers(fill,((a.x+b.x)/2+.5)*4-96,((a.y+b.y)/2+.5)*4-96));
 for(const batch of guide.batches){assert.ok(activeVertices(batch).every(Number.isFinite));assert.ok(batch.geometry.drawRange.count<=batch.geometry.attributes.position.count);}
 assert.equal(guide.outline.object.material.color.getHexString(),'ff8c78');
 assert.ok(guide.fill.geometry.drawRange.count<=12*(768-18)+512,'station cap with inner road ribbons and a bounded set of corner triangles');
 guide.dispose();
});

test('grid, edge, ordinary-road and hidden previews reuse resources without stale geometry or material leaks',()=>{
 const {guide}=fixture(),plan=gridPlan({width:32,depth:32,columns:8,rows:8}),geometry=guide.batches.map(b=>b.geometry),materials=guide.batches.map(b=>b.object.material);
 guide.showGrid(plan,'street',true,{cost:8000});const arrays=guide.batches.map(b=>b.geometry.attributes.position);let materialsDisposed=0;
 for(const material of materials)material.addEventListener('dispose',()=>materialsDisposed++);
 for(let i=0;i<40;i++)guide.showGrid(gridPlan({width:31,depth:31,columns:8,rows:8,angle:i*.002}),'street',i%2===0);
 guide.batches.forEach((b,i)=>{assert.equal(b.geometry,geometry[i]);assert.equal(b.object.material,materials[i]);assert.equal(b.geometry.attributes.position,arrays[i]);});
 guide.clear();assert.equal(guide.group.visible,false);guide.showGrid(plan,'street',true);assert.equal(guide.group.visible,true);
 const edge={paths:[[{x:8,y:8},{x:16,y:8}]],corners:[{x:8,y:8},{x:16,y:8},{x:16,y:8},{x:8,y:8}],stage:2};
 guide.showGrid(edge,'street',true);assert.equal(guide.metrics.stage,'edge');assert.ok(Math.abs(guide.metrics.lengthMeters-160)<1e-9);assert.equal(guide.metrics.roadCount,1);
 guide.update([{x:8,y:8},{x:16,y:8}],'street',true);assert.equal(guide.metrics.mode,undefined);assert.ok(Math.abs(guide.metrics.lengthMeters-160)<1e-9);
 guide.showGrid({...plan,paths:Array.from({length:19},()=>plan.paths[0])},'street',false);assert.equal(guide.group.visible,false);
 guide.showGrid({paths:[[{x:NaN,y:1},{x:2,y:2}]]},'street',false);assert.equal(guide.group.visible,false);
 assert.equal(materialsDisposed,0);guide.dispose();assert.equal(materialsDisposed,4);
});

test('grid labels show actual dimensions and cost and avoid the build panel, then reset for a straight road',()=>{
 const previousDocument=globalThis.document,panel={left:300,right:980,top:490,bottom:625};
 const element=()=>({style:{},dataset:{},children:[],textContent:'',append(child){this.children.push(child);},remove(){},getBoundingClientRect(){return {width:Math.min(245,Math.max(75,...this.textContent.split('\n').map(line=>line.length*7))),height:this.textContent.split('\n').length*18+14};}});
 globalThis.document={createElement:element,body:element(),getElementById:()=>({hidden:false,getBoundingClientRect:()=>panel})};
 let guide;
 try{
  const fixtureData=fixture();guide=fixtureData.guide;const view=fixtureData.view;
  view.camera=new T.PerspectiveCamera(43,1280/720,.2,1800);view.camera.position.set(0,120,150);view.camera.lookAt(0,0,0);view.camera.updateMatrixWorld();
  view.canvas={getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})};
  guide.showGrid(gridPlan(),'street',true,{cost:1888});
  assert.equal(guide.labels[0].textContent,'₡1,888\n3 × 2 · 6 blocks');assert.equal(guide.labels[1].textContent,'↔ 480 m');assert.equal(guide.labels[2].textContent,'↔ 320 m');
  assert.equal(guide.labels[3].textContent,'∟ 90°');assert.equal(guide.labels[4].textContent,'∟ 90°');assert.equal(guide.labels[2].title,'Grid depth');
  assert.deepEqual(guide.labelPoints.slice(1).map(p=>[p.x,p.z]),[[-14,-62],[34,-30],[-62,-62],[34,-62]],'dimensions and angles follow the first edge then the depth drawing edge');
  const visible=[];
  for(const label of guide.labels){if(label.style.display==='none')continue;const {width,height}=label.getBoundingClientRect(),x=parseFloat(label.style.left),y=parseFloat(label.style.top),box={left:x-width/2,right:x+width/2,top:y-height,bottom:y};
   assert.ok(box.left>=8&&box.right<=1272&&box.top>=73&&box.bottom<=617);
   assert.ok(box.right<=panel.left-8||box.left>=panel.right+8||box.bottom<=panel.top-8||box.top>=panel.bottom+8);
   for(const other of visible)assert.ok(box.right<=other.left-8||box.left>=other.right+8||box.bottom<=other.top-8||box.top>=other.bottom+8);
   visible.push(box);
  }assert.ok(visible.length>=3,'room permits the primary cost and both dimensions');
  guide.clear();assert.equal(guide.labelRoot.hidden,true);
  guide.update([{x:8,y:8},{x:16,y:8}],'street',true,{cost:200});assert.equal(guide.labelRoot.hidden,false);
  assert.ok(guide.labels.slice(3).every(label=>!label.textContent&&label.style.display==='none'));
  assert.equal(guide.labels[0].textContent,'₡200');assert.equal(guide.labels[1].textContent,'↔ 160 m');assert.match(guide.labels[2].textContent,/^◿ [+-][\d.]+%$/);
 }finally{guide?.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('grid outside corners have rounded fill without extending into open block interiors',()=>{
 const {guide}=fixture(),plan=gridPlan({width:24,depth:16,angle:.43}),half=(E.ROADS.street.width+.8)/2,u={x:Math.cos(.43),z:Math.sin(.43)},v={x:-u.z,z:u.x};
 guide.showGrid(plan,'street',true);const fill=activeVertices(guide.fill),outline=activeVertices(guide.outline);
 for(const [index,signU,signV]of [[0,-1,-1],[1,1,-1],[2,1,1],[3,-1,1]]){
  const c=plan.corners[index],x=(c.x+.5)*4-96,z=(c.y+.5)*4-96,point=r=>({x:x+(u.x*signU+v.x*signV)*r,z:z+(u.z*signU+v.z*signV)*r});
  const filled=point(half*.5),outside=point(half*.8),interior=point(-half*1.15);
  assert.ok(covers(fill,filled.x,filled.z),'previously missing outer quadrant is filled');
  assert.equal(covers(fill,outside.x,outside.z),false,'quarter arc stays inside the road radius instead of becoming a square cap');
  assert.equal(covers(fill,interior.x,interior.z),false,'corner fill does not spill into a block');
  const arc=point(half/Math.sqrt(2));let found=false;
  for(let i=0;i<outline.length;i+=3)if(Math.hypot(outline[i]-arc.x,outline[i+2]-arc.z)<1e-5)found=true;
  assert.ok(found,'outer quarter has a matching outline');
 }guide.dispose();
});

test('grid internal roads gain narrow markings while ordinary straight and curve buffers remain exact',()=>{
 const {guide}=fixture(),plan=gridPlan(),width=E.ROADS.street.width+.8;
 const original=[{x:10,y:20},{x:20,y:24},{x:30,y:20}];guide.update(original,'street',true);
 const before=guide.batches.map(activeVertices);guide.showGrid(plan,'street',true);
 const dashes=activeVertices(guide.dashes),internal=plan.paths.slice(4),half=width/2;
 for(const [a,b]of internal){
  const dx=b.x-a.x,dz=b.y-a.y,n=Math.hypot(dx,dz),distance=half+.12+.4,x=(a.x+.5)*4-96+dx/n*distance,z=(a.y+.5)*4-96+dz/n*distance;
  assert.ok(covers(dashes,x,z),'every internal street has a centerline dash');
  assert.equal(covers(dashes,x-dz/n*width*.04,z+dx/n*width*.04),false,'internal markings are narrower than the outer construction dashes');
 }
 guide.update(original,'street',true);guide.batches.forEach((batch,i)=>assert.deepEqual(activeVertices(batch),before[i]));
 const straight=[{x:10,y:20},{x:30,y:20}];guide.update(straight,'avenue',true);const straightBefore=guide.batches.map(activeVertices);
 guide.showGrid(plan,'avenue',true);guide.update(straight,'avenue',true);guide.batches.forEach((batch,i)=>assert.deepEqual(activeVertices(batch),straightBefore[i]));
 assert.equal(guide.group.children.length,4);guide.dispose();
});

test('only the first edge and depth drawing edge have broad construction dashes',()=>{
 const {guide}=fixture(),plan=gridPlan(),width=E.ROADS.street.width+.8;guide.showGrid(plan,'street',true);
 const dashes=activeVertices(guide.dashes);
 for(let i=0;i<4;i++){
  const [a,b]=plan.paths[i],dx=b.x-a.x,dz=b.y-a.y,n=Math.hypot(dx,dz),distance=i<2?3.7:width/2+.12+.4,x=(a.x+.5)*4-96+dx/n*distance,z=(a.y+.5)*4-96+dz/n*distance;
  assert.ok(covers(dashes,x,z),'every perimeter road retains a centerline');
  assert.equal(covers(dashes,x-dz/n*width*.04,z+dx/n*width*.04),i<2,'quiet opposite edges stay thinner than the two drawing axes');
 }guide.dispose();
});

test('badge updates batch layout writes, reuse unchanged sizes, and invalidate text, mode, viewport and fonts',()=>{
 const previousDocument=globalThis.document,trace=[],fontEvents=new Map();let reads=0,textWrites=0,viewportWidth=1280,guide;
 const element=()=>{
  let text='';const node={dataset:{},children:[],append(child){this.children.push(child);},remove(){},getBoundingClientRect(){
   if(this.className==='road-guide-badge'){reads++;trace.push('read');}
   return {width:Math.min(245,Math.max(75,...text.split('\n').map(line=>line.length*7))),height:text.split('\n').length*18+14};
  }};
  node.style=new Proxy({}, {set(target,key,value){if(node.className==='road-guide-badge'&&key==='display'&&value==='block')trace.push('show');target[key]=value;return true;}});
  Object.defineProperty(node,'textContent',{get:()=>text,set(value){if(node.className==='road-guide-badge')textWrites++;text=value;}});return node;
 };
 globalThis.document={createElement:element,body:element(),getElementById:()=>null,fonts:{addEventListener:(name,fn)=>fontEvents.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(fontEvents.get(name),fn);fontEvents.delete(name);}}};
 try{
  const data=fixture();guide=data.guide;data.view.camera=new T.PerspectiveCamera(43,1280/720,.2,1800);data.view.camera.position.set(0,120,150);data.view.camera.lookAt(0,0,0);data.view.camera.updateMatrixWorld();
  data.view.canvas={getBoundingClientRect:()=>({left:0,top:0,width:viewportWidth,height:720})};
  const plan=gridPlan();guide.showGrid(plan,'street',true,{cost:1888});
  assert.equal(reads,5);assert.ok(trace.lastIndexOf('show')<trace.indexOf('read'),'all initial visibility writes precede measurement reads');
  let priorReads=reads,priorWrites=textWrites;guide.showGrid(plan,'street',true,{cost:1888});guide.updateLabels();
  assert.equal(reads,priorReads,'unchanged pointer/frame updates reuse measured dimensions');assert.equal(textWrites,priorWrites,'unchanged labels do not rewrite text');
  viewportWidth=1400;guide.updateLabels();assert.equal(reads,priorReads+5);priorReads=reads;
  guide.labels[0].style.font='700 15px/1.5 system-ui';guide.updateLabels();assert.equal(reads,priorReads+5);priorReads=reads;
  fontEvents.get('loadingdone')();guide.updateLabels();assert.equal(reads,priorReads+5);priorReads=reads;
  guide.showGrid(plan,'street',false,{cost:1888,reason:'Not enough funds for the whole grid.'});
  assert.equal(guide.labels[0].textContent,'₡1,888\nNot enough funds for the whole grid.\n3 × 2 · 6 blocks');assert.equal(reads,priorReads+5);priorReads=reads;
  guide.showGrid(plan,'street',false,{reason:'Road blocked by an existing lot'});assert.equal(guide.labels[0].textContent,'Road blocked by an existing lot');assert.equal(reads,priorReads+5);priorReads=reads;
  guide.update([{x:8,y:8},{x:16,y:8}],'street',true,{cost:200});assert.equal(reads,priorReads+3,'only price, length and grade badges are measured');priorReads=reads;
  const edge={paths:[[{x:8,y:8},{x:16,y:8}]],corners:[{x:8,y:8},{x:16,y:8}],stage:2};guide.showGrid(edge,'street',true);
  assert.equal(reads,priorReads+2,'edge mode measures price and width without an intermediate ordinary-road badge');priorReads=reads;
  guide.showGrid(edge,'street',true);assert.equal(reads,priorReads,'unchanged edge previews reuse badge size');
  guide.dispose();guide=null;assert.equal(fontEvents.size,0,'font invalidation listeners are removed on disposal');
 }finally{guide?.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('ghost road colors and inner ribbon stay pooled and ordinary road colors reset to their exact appearance',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:24},{x:30,y:20}],plan=gridPlan({width:32,depth:32,columns:8,rows:8});
 guide.update(controls,'street',true);const ordinaryMaterial=guide.fill.object.material.toJSON(),ordinaryPositions=activeVertices(guide.fill),ordinaryColors=Array.from(guide.fill.colorArray.subarray(0,guide.fill.geometry.drawRange.count*4)),materials=guide.batches.map(b=>b.object.material);
 guide.showGrid(plan,'street',true,{cost:9000});
 const geometry=guide.fill.geometry,color=geometry.attributes.color,position=geometry.attributes.position,active=color.array.subarray(0,geometry.drawRange.count*4);
 assert.equal(color.itemSize,4);assert.equal(color.count,position.count);assert.ok(active.every(Number.isFinite));
 assert.ok(Array.from(active).every((value,i)=>i%4!==3||value>=0&&value<=1));
 const alpha=new Set();for(let i=3;i<active.length;i+=4)alpha.add(active[i].toFixed(2));assert.deepEqual([...alpha].sort(),['0.36','0.56']);
 assert.equal(guide.fill.object.material.vertexColors,true);assert.equal(guide.fill.object.material.color.getHexString(),'ffffff');assert.equal(guide.fill.object.material.opacity,1);
 let colorDisposals=0;geometry.addEventListener('dispose',()=>colorDisposals++);
 for(let i=0;i<10;i++)guide.showGrid(gridPlan({width:31,depth:31,columns:8,rows:8,angle:i*.002}),'street',i%2===0);
 assert.equal(geometry.attributes.color,color);assert.equal(geometry.attributes.position,position);assert.equal(colorDisposals,0);
 guide.update(controls,'street',true);assert.equal(geometry.attributes.color,color);assert.deepEqual(Array.from(color.array.subarray(0,geometry.drawRange.count*4)),ordinaryColors,'switching from a grid restores the original road tint and opacity');
 assert.deepEqual(guide.fill.object.material.toJSON(),ordinaryMaterial);assert.deepEqual(activeVertices(guide.fill),ordinaryPositions);
 guide.batches.forEach((batch,i)=>assert.equal(batch.object.material,materials[i]));assert.equal(guide.group.children.length,4);guide.dispose();
});

test('ghost inner road surface preserves the cyan sidewalk band and interpolates its height',()=>{
 const {guide,view}=fixture(),height=view.roadworks.height,probes=[];view.roadworks.height=(...args)=>{probes.push([args[1],args[2]]);return height(...args);};
 const plan=gridPlan();guide.showGrid(plan,'street',true);const position=guide.fill.geometry.attributes.position,color=guide.fill.geometry.attributes.color,vertices=guide.fill.geometry.drawRange.count;
 const asphalt=[],outer=[];for(let i=0;i<vertices;i++){const target=color.getW(i)>.45?asphalt:outer;target.push(position.getX(i),position.getY(i),position.getZ(i));}
 const a=plan.paths[0][0],x=(a.x+.5)*4-96+10,z=(a.y+.5)*4-96,asphaltHalf=E.ROADS.street.width/2,fullHalf=(E.ROADS.street.width+.8)/2;
 assert.ok(covers(asphalt,x,z));assert.equal(covers(asphalt,x,z+(asphaltHalf+fullHalf)/2),false);assert.ok(covers(outer,x,z+(asphaltHalf+fullHalf)/2),'full road width retains its cyan sidewalk band');
 let found=false;for(let i=0;i<asphalt.length;i+=3)if(Math.hypot(asphalt[i]-x,asphalt[i+2]-(z+asphaltHalf))<1e-5){found=true;assert.ok(Math.abs(asphalt[i+1]-(3+x*.02+(z+asphaltHalf)*.01+.23))<1e-5);}
 assert.ok(found,'inner road keeps the sampled cross-section height');
 assert.equal(probes.some(([px,pz])=>Math.hypot(px-x,pz-(z+asphaltHalf))<1e-6),false,'the inner road vertex did not trigger another terrain query');
 guide.showGrid(plan,'highway',true);assert.equal(guide.group.children.length,4);guide.dispose();
});

test('single-road preview includes the carriageway and sidewalk bands without extra height samples per lane',()=>{
 const {guide,view}=fixture(),controls=[{x:10,y:20},{x:30,y:20}],oldHeight=view.roadworks.height;let calls=0;
 view.roadworks.height=(...args)=>{calls++;return oldHeight(...args)};
 guide.update(controls,'street',true,{cost:1000});const first=calls;
 const colors=guide.fill.geometry.attributes.color,position=guide.fill.geometry.attributes.position,alphas=new Set();
 for(let i=0;i<guide.fill.geometry.drawRange.count;i++){alphas.add(colors.getW(i).toFixed(2));assert.ok(Math.abs(position.getY(i)-(3+position.getX(i)*.02+position.getZ(i)*.01+.23))<1e-5);}
 assert.deepEqual([...alphas].sort(),['0.36','0.56']);
 calls=0;guide.update(controls,'boulevard',true);assert.equal(calls,first,'lane dividers and arrows interpolate the already sampled ribbon');
 assert.equal(guide.metrics.arrows.length,6);assert.equal(guide.group.children.length,4);
 guide.dispose();
});

test('preview lane arrows follow authored one-way direction and oppose on a two-way carriageway',()=>{
 const {guide}=fixture();
 for(const [dx,dy]of [[1,0],[0,1],[-1,0],[.6,-.8]]){
  const controls=[{x:24,y:24},{x:24+dx*10,y:24+dy*10}];
  guide.update(controls,'motorway',true);assert.equal(guide.metrics.arrows.length,3);
  for(const a of guide.metrics.arrows)assert.ok((a.to.x-a.from.x)*dx+(a.to.z-a.from.z)*dy>0);
  guide.update(controls,'avenue',true);const directions=guide.metrics.arrows.map(a=>Math.sign((a.to.x-a.from.x)*dx+(a.to.z-a.from.z)*dy));assert.equal(directions.filter(x=>x>0).length,2);assert.equal(directions.filter(x=>x<0).length,2);
 }
 guide.update([{x:20,y:20},{x:40,y:20}],'path',true);assert.equal(guide.metrics.arrows.length,0);
 guide.update([{x:20,y:20},{x:20,y:20}],'street',true,{anchorOnly:true});assert.equal(guide.metrics.arrows.length,0);assert.equal(guide.dashes.geometry.drawRange.count,0);guide.dispose();
});

test('road badges separate price, true curved length, endpoint grade, angle and placement errors',()=>{
 const previous=globalThis.document,element=()=>({style:{},dataset:{},children:[],textContent:'',append(child){this.children.push(child)},remove(){}});
 globalThis.document={createElement:element,body:element()};let guide;
 try{
  guide=fixture().guide;
  const c=[{x:10,y:20},{x:20,y:20}];guide.update(c,'street',true,{cost:500,referenceTangent:{x:0,y:1}});
  assert.deepEqual(guide.labels.map(l=>l.textContent),['₡500','↔ 200 m','◿ +2.0%','∟ 90°','']);assert.equal(guide.labels[0].dataset.roadGuide,'cost');assert.equal(guide.labels[2].dataset.roadGuide,'grade');
  assert.deepEqual([guide.labelPoints[0].x,guide.labelPoints[1].x,guide.labelPoints[3].x],[-14,-34,-54]);
  assert.match(guide.labels[2].title,/estimate/i);
  guide.update(c,'street',false,{cost:500,reason:'Outside owned land',snap:{label:'Road connection'}});assert.equal(guide.labels[0].textContent,'Outside owned land');assert.equal(guide.labels[0].style.color,'#ffb3a2');assert.equal(guide.labels[3].textContent,'');assert.equal(guide.labels[4].textContent,'Road connection');
  guide.update([{x:10,y:20},{x:20,y:10},{x:30,y:20}],'street',true,{cost:900});assert.ok(guide.metrics.lengthMeters>400);assert.equal(guide.labels[1].textContent,`↔ ${Math.round(guide.metrics.lengthMeters).toLocaleString()} m`);
  guide.update([c[0],c[0]],'street',true,{anchorOnly:true});assert.deepEqual(guide.labels.map(l=>l.textContent),['','','','','Choose start']);
  guide.clear();assert.equal(guide.labelRoot.hidden,true);
 }finally{guide?.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('colliding badges move beside their own anchor instead of jumping to an unrelated endpoint',()=>{
 const point={x:780,y:316},size={width:60,height:23},bounds={left:0,right:1280,top:65,bottom:625};
 const cost={left:1015,right:1059,top:480,bottom:503},length={left:752,right:815,top:263,bottom:286};
 const result=placeRoadGuideBadge(point,size,bounds,[],[cost,length]);assert.ok(result);assert.ok(Math.hypot(result.x-point.x,result.y-point.y)<70,'the nearest free local position is preferred over a far-away cost badge');
});
