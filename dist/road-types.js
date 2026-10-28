(function(root){
'use strict';
const ROADS={"gravel":{"name":"Gravel road","cost":20,"width":2,"lanes":2,"capacity":0.65,"speed":30,"sidewalk":false},"alley":{"name":"Narrow alley","cost":30,"width":1.7,"lanes":2,"capacity":0.7,"speed":20,"sidewalk":true},"street":{"name":"Two-lane street","cost":50,"width":2.45,"lanes":2,"capacity":1,"speed":40,"sidewalk":true},"oneway":{"name":"One-way street","cost":55,"width":2.45,"lanes":2,"capacity":1.4,"speed":50,"sidewalk":true,"oneway":true},"avenue":{"name":"Four-lane avenue","cost":100,"width":3.2,"lanes":4,"capacity":2,"speed":50,"sidewalk":true},"green":{"name":"Tree-lined avenue","cost":125,"width":3.4,"lanes":4,"capacity":2,"speed":50,"sidewalk":true,"green":true},"boulevard":{"name":"Six-lane boulevard","cost":160,"width":4.5,"lanes":6,"capacity":3,"speed":60,"sidewalk":true,"median":true},"highway":{"name":"Divided highway","cost":200,"width":4.8,"shoulder":0.3,"lanes":6,"capacity":4,"speed":100,"sidewalk":false,"median":true,"limitedAccess":true},"ramp":{"mergeEdges":true,"name":"One-lane highway ramp","cost":60,"width":1.35,"shoulder":0.3,"lanes":1,"capacity":0.95,"speed":100,"sidewalk":false,"oneway":true,"limitedAccess":true},"highway2":{"mergeEdges":true,"name":"Two-lane one-way highway","cost":90,"width":2.1,"shoulder":0.3,"lanes":2,"capacity":1.9,"speed":100,"sidewalk":false,"oneway":true,"limitedAccess":true},"motorway":{"name":"Three-lane one-way highway","cost":120,"width":3.15,"shoulder":0.45,"lanes":3,"capacity":2.8,"speed":100,"sidewalk":false,"oneway":true,"limitedAccess":true},"highway4":{"mergeEdges":true,"name":"Four-lane one-way highway","cost":150,"width":3.9,"shoulder":0.45,"lanes":4,"capacity":3.7,"speed":100,"sidewalk":false,"oneway":true,"limitedAccess":true}};
const isLimitedAccess=type=>!!ROADS[type]?.limitedAccess;
// Raster occupancy from an authored road is not a legacy road arm. Keep the
// original tile network separate, then join it at actual sampled centerlines.
const legacyTile=t=>t?.type==='road'&&(!t.pathIds?.length||t.legacyRoad);
function legacyNeighbors(world,i){return [i%48?i-1:-1,i%48<47?i+1:-1,i>=48?i-48:-1,i<2256?i+48:-1].filter(n=>n>=0&&legacyTile(world.tiles[n]));}
const legacyCache=new WeakMap();
function legacyShapes(world,sample){
 const key=JSON.stringify([world.roadPaths||[],world.tiles.map((t,i)=>t.type==='road'?[i,t.roadWidth,t.legacyRoad,t.pathIds]:null).filter(Boolean)]),cached=legacyCache.get(world);
 if(cached?.key===key&&cached.sample===sample)return cached.shapes;
 const shapes=new Map();
 for(let i=0;i<world.tiles.length;i++){
  if(!legacyTile(world.tiles[i]))continue;
  const x=i%48,y=Math.floor(i/48),neighbors=legacyNeighbors(world,i),dirs=neighbors.map(n=>({x:n%48-x,y:Math.floor(n/48)-y}));let points=[],arms=[];
  if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].y*dirs[1].y===0){
   for(let k=0;k<=12;k++){const t=k/12,u=1-t;points.push({x:x+.5*(u*u*dirs[0].x+t*t*dirs[1].x),y:y+.5*(u*u*dirs[0].y+t*t*dirs[1].y)});}
  }else if(dirs.length<=2){
   const d=dirs.find(p=>p.x!==0)||dirs[0]||{x:1,y:0};points=[{x:x-d.x*.5,y:y-d.y*.5},{x:x+d.x*.5,y:y+d.y*.5}];
  }else arms=dirs.map(d=>[{x,y},{x:x+d.x*.5,y:y+d.y*.5}]);
  shapes.set(i,{neighbors,dirs,points,arms,width:world.tiles[i].roadWidth===2?3.15:2.45});
 }
 if(![...shapes.values()].some(shape=>shape.dirs.length===1)||(world.roadPaths||[]).length===0){legacyCache.set(world,{key,sample,shapes});return shapes;}
 const paths=world.roadPaths.map(path=>({points:sample(path.controls),width:(ROADS[path.type]||ROADS.street).width}));
 // Match the existing forward-only join inside pavement before trimming caps.
 // This includes branches ending beside the centerline, without turning a
 // nearby parallel road or an unrelated raster cell into a connection.
 const bins=new Map(),add=(road,points,target=bins,padding=1)=>{
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(Math.hypot(b.x-a.x,b.y-a.y)<1e-9)continue;
   for(let x=Math.floor((Math.min(a.x,b.x)-padding)/2);x<=Math.floor((Math.max(a.x,b.x)+padding)/2);x++)for(let y=Math.floor((Math.min(a.y,b.y)-padding)/2);y<=Math.floor((Math.max(a.y,b.y)+padding)/2);y++){
    const key=x+','+y;if(!target.has(key))target.set(key,[]);target.get(key).push({road,a,b});
   }
  }
 };
 for(const path of paths)add(path,path.points);
 for(const shape of shapes.values())for(const points of shape.arms.length?shape.arms:[shape.points])add(shape,points);
 for(const path of paths){if(path.points.length<2)continue;const resolved=path.points.slice();
  for(const end of [0,path.points.length-1]){
   const p=path.points[end],q=path.points[end?end-1:1],length=Math.hypot(p.x-q.x,p.y-q.y);if(length<1e-9)continue;
   const dx=(p.x-q.x)/length,dy=(p.y-q.y)/length;let best=Infinity;
   for(const {road,a,b}of bins.get(Math.floor(p.x/2)+','+Math.floor(p.y/2))||[]){
    if(road===path)continue;const vx=b.x-a.x,vy=b.y-a.y,span=Math.hypot(vx,vy),den=dx*vy-dy*vx;if(Math.abs(den)<span*.15)continue;
    const ox=a.x-p.x,oy=a.y-p.y,d=(ox*vy-oy*vx)/den,t=(ox*dy-oy*dx)/den;
    if(d<=1e-7||d>1||d>=best||t< -1e-6||t>1+1e-6||d*Math.abs(den)/span>road.width/8+.01)continue;
    best=d;resolved[end]={x:p.x+dx*d,y:p.y+dy*d};
   }
  }
  path.resolved=resolved;
 }
 const contacts=new Map();for(const path of paths)add(path,path.resolved||path.points,contacts,.5);
 for(const [i,shape]of shapes){
  if(shape.dirs.length!==1)continue;const x=i%48,y=Math.floor(i/48),out={x:-shape.dirs[0].x,y:-shape.dirs[0].y};let stop=null;
  // A connected dead-end cap stops at the actual contact. Its overhang must
  // not masquerade as a third arm with a crossing and traffic lights.
  // Keep enough cap to reach every contact: a grid may reuse its outer half
  // while a perpendicular one-way street connects at the tile center.
  for(const {a,b}of contacts.get(Math.floor(x/2)+','+Math.floor(y/2))||[]){
   const vx=b.x-a.x,vy=b.y-a.y,ox=a.x-x,oy=a.y-y,den=out.x*vy-out.y*vx;let distance;
   if(Math.abs(den)>1e-9){distance=(ox*vy-oy*vx)/den;const t=(ox*out.y-oy*out.x)/den;if(t< -1e-7||t>1+1e-7)continue;}
   else{if(Math.abs(ox*out.y-oy*out.x)>1e-7)continue;const aa=ox*out.x+oy*out.y,bb=(b.x-x)*out.x+(b.y-y)*out.y;if(Math.max(aa,bb)<-1e-7)continue;distance=Math.max(0,Math.min(aa,bb));}
   if(distance>=-1e-7&&distance<=.5+1e-7)stop=Math.max(stop??0,Math.min(.5,distance));
  }
  shape.points[0]={x:x+out.x*(stop??.5),y:y+out.y*(stop??.5)};
 }
 legacyCache.set(world,{key,sample,shapes});return shapes;
}
const api={ROADS,isLimitedAccess,legacyTile,legacyNeighbors,legacyShapes};root.BoroughRoadTypes=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
