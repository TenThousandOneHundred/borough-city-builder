(function(root){
'use strict';
const RoadTypes=typeof module!=='undefined'?require('./road-types.js'):root.BoroughRoadTypes;
const RoadCurves=typeof module!=='undefined'?require('./road-curves.js'):root.BoroughRoadCurves;
const Roundabouts=typeof module!=='undefined'?require('./roundabout-state.js'):root.BoroughRoundabouts;
const cache=new WeakMap(),SIZE=48,CELL=4;
function sameTiles(tiles,previous){
 if(tiles.length!==previous.grounds.length)return false;
 for(let i=0;i<tiles.length;i++){
  const t=tiles[i],road=previous.roads[i];if(t.ground!==previous.grounds[i]||(t.type==='road')!==!!road)return false;
  if(!road)continue;
  if(t.roadType!==road.type||t.roadWidth!==road.width||t.legacyRoad!==road.legacy||t.zoneSides!==road.zoneSides||(t.pathIds?.length||0)!==road.paths.length)return false;
  for(let j=0;j<road.paths.length;j++)if(t.pathIds[j]!==road.paths[j])return false;
 }return true;
}
function tileSnapshot(tiles){return {grounds:tiles.map(t=>t.ground),roads:tiles.map(t=>t.type==='road'?{type:t.roadType,width:t.roadWidth,legacy:t.legacyRoad,zoneSides:t.zoneSides,paths:t.pathIds?.slice()||[]}:null)};}
const indexAt=(x,z)=>{const a=Math.floor((x+96)/4),b=Math.floor((z+96)/4);return a<0||b<0||a>=48||b>=48?-1:b*48+a;};
function corners(p,width=p.width||CELL,depth=p.depth||CELL){const c=Math.cos(p.angle),s=Math.sin(p.angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:p.cx+x*width/2*c+z*depth/2*s,z:p.cz-x*width/2*s+z*depth/2*c}));}
function overlaps(a,b){const ac=Math.cos(a.angle),as=Math.sin(a.angle),bc=Math.cos(b.angle),bs=Math.sin(b.angle),dx=b.cx-a.cx,dz=b.cz-a.cz;for(const [x,z]of [[ac,-as],[as,ac],[bc,-bs],[bs,bc]]){const ar=Math.abs(x*ac-z*as)*(a.width||4)/2+Math.abs(x*as+z*ac)*(a.depth||4)/2,br=Math.abs(x*bc-z*bs)*(b.width||4)/2+Math.abs(x*bs+z*bc)*(b.depth||4)/2;if(Math.abs(dx*x+dz*z)>=ar+br-.02)return false;}return true;}
// Private collision records live only during a layout rebuild. Keep calculated
// axes and extents out of the returned cells and persistent parcel data.
function collisionRect(p){const c=Math.cos(p.angle),s=Math.sin(p.angle),w=(p.width||4)/2,d=(p.depth||4)/2;return {cx:p.cx,cz:p.cz,c,s,w,d,n:c*c+s*s,ex:Math.abs(c)*w+Math.abs(s)*d,ez:Math.abs(s)*w+Math.abs(c)*d,cell:p,visit:0};}
function rectOverlaps(a,b){
 const dx=b.cx-a.cx,dz=b.cz-a.cz;
 // Conservative world-space rejection before the four exact local axes.
 if(Math.abs(dx)>a.ex+b.ex+1e-9||Math.abs(dz)>a.ez+b.ez+1e-9)return false;
 const dot=Math.abs(a.c*b.c+a.s*b.s),cross=Math.abs(a.c*b.s-a.s*b.c);
 return Math.abs(dx*a.c-dz*a.s)<a.n*a.w+(dot*b.w+cross*b.d)-.02&&
        Math.abs(dx*a.s+dz*a.c)<a.n*a.d+(cross*b.w+dot*b.d)-.02&&
        Math.abs(dx*b.c-dz*b.s)<dot*a.w+cross*a.d+b.n*b.w-.02&&
        Math.abs(dx*b.s+dz*b.c)<cross*a.w+dot*a.d+b.n*b.d-.02;
}
function layout(w,roads,options={}){
 const cellSize=options.cellSize??4,rows=options.rows??4,independent=options.independent===true;if(![1.6,4].includes(cellSize)||!Number.isInteger(rows)||rows<1||rows>6)throw Error('Unsupported zoning grid dimensions');const variant=cellSize+':'+rows+':'+independent;
 const paths=JSON.stringify([w.roadPaths||[],w.roundabouts||{}]),variants=cache.get(w)||new Map(),old=variants.get(variant);
 // Hover and brush queries still detect in-place road/terrain edits, but an
 // unchanged map no longer allocates thousands of temporary strings.
 if(old?.paths===paths&&sameTiles(w.tiles,old.tiles))return old.cells;
 const candidates=[],sources=[],roadBins=new Map();let roadVisit=0;
 function roadRectangle(a,b,width){const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<1e-8)return;const p={cx:(a.x+b.x)/2,cz:(a.z+b.z)/2,angle:Math.atan2(-dz,dx),width:length+.05,depth:width+.8},rectangle=collisionRect(p),points=corners(p,p.width,p.depth),minX=Math.floor(Math.min(...points.map(v=>v.x))/8),maxX=Math.floor(Math.max(...points.map(v=>v.x))/8),minZ=Math.floor(Math.min(...points.map(v=>v.z))/8),maxZ=Math.floor(Math.max(...points.map(v=>v.z))/8);for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const key=x+','+z;if(!roadBins.has(key))roadBins.set(key,[]);roadBins.get(key).push(rectangle);}}
 function crossesRoad(p){
  const visit=++roadVisit,minX=Math.floor((p.cx-p.ex-1e-9)/8),maxX=Math.floor((p.cx+p.ex+1e-9)/8),minZ=Math.floor((p.cz-p.ez-1e-9)/8),maxZ=Math.floor((p.cz+p.ez+1e-9)/8);
  // Road ribbons already occupy every bin touched by their bounds. Query only
  // bins touched by this cell; a stamp avoids allocating a Set per candidate.
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)for(const road of roadBins.get(x+','+z)||[]){if(road.visit===visit)continue;road.visit=visit;if(rectOverlaps(p,road))return true;}return false;
 }

 for(const path of w.roadPaths||[]){const curved=path.controls.length>2,points=[];let length=0;
  for(const q of RoadCurves.sample(path.controls,8)){const p={x:(q.x+.5)*4-96,z:(q.y+.5)*4-96};if(points.length)length+=Math.hypot(p.x-points.at(-1).x,p.z-points.at(-1).z);p.distance=length;points.push(p);}
  for(let k=1;k<points.length;k++)roadRectangle(points[k-1],points[k],roads[path.type]?.width||2.45);if(RoadTypes.isLimitedAccess(path.type))continue;
  const columns=Math.floor(length/cellSize),blockOffsets=new Map();for(let col=0;col<columns;col++){const section=independent?Math.floor(col/6)*6:col,count=independent?Math.min(6,columns-section):1,d=(section+count/2)*cellSize;let k=1;while(k<points.length-1&&points[k].distance<d)k++;const a=points[k-1],b=points[k],f=(d-a.distance)/(b.distance-a.distance||1),vx=b.x-a.x,vz=b.z-a.z,l=Math.hypot(vx,vz)||1,along=(col-section+.5-count/2)*cellSize;
   // Fine cells share a tangent within short blocks. Rotating every inner-curve
   // cell independently makes successive rows overlap in a checkerboard.
   // A straight tangent block can cut into curved pavement. Fit its
   // front edge to the road ribbon across the whole block, once per section.
   // Otherwise one rejected front cell also removes its whole column.
   const offset=Math.max(independent?0:2,(roads[path.type]?.width||2.45)/2+.45);
   if(independent&&curved&&!blockOffsets.has(section)){
    const px=a.x+vx*f,pz=a.z+vz*f,tx=vx/l,tz=vz/l,half=count*cellSize/2,clearance=[offset,offset];
    for(let j=Math.max(0,k-1);j>=0&&points[j].distance>=d-half-offset-2;j--){const q=points[j],u=(q.x-px)*tx+(q.z-pz)*tz;if(Math.abs(u)<=half+.1){const n=-(q.x-px)*tz+(q.z-pz)*tx;clearance[0]=Math.max(clearance[0],offset-n);clearance[1]=Math.max(clearance[1],offset+n);}}
    for(let j=k;j<points.length&&points[j].distance<=d+half+offset+2;j++){const q=points[j],u=(q.x-px)*tx+(q.z-pz)*tz;if(Math.abs(u)<=half+.1){const n=-(q.x-px)*tz+(q.z-pz)*tx;clearance[0]=Math.max(clearance[0],offset-n);clearance[1]=Math.max(clearance[1],offset+n);}}
    blockOffsets.set(section,clearance);
   }
   sources.push({zoneSides:path.zoneSides,x:a.x+vx*f+vx/l*along,z:a.z+vz*f+vz/l*along,tx:vx/l,tz:vz/l,col,source:path.id,roadIndex:path.tiles[Math.min(path.tiles.length-1,Math.floor(col/Math.max(1,columns)*path.tiles.length))],offset,sideOffsets:blockOffsets.get(section)});}
 }
 for(let i=0;i<w.tiles.length;i++){const t=w.tiles[i];if(t.type!=='road'||t.pathIds?.length&&!t.legacyRoad)continue;const x=i%48,y=Math.floor(i/48),horizontal=(x>0&&w.tiles[i-1].type==='road')||(x<47&&w.tiles[i+1].type==='road'),vertical=(y>0&&w.tiles[i-48].type==='road')||(y<47&&w.tiles[i+48].type==='road');const cx=(x+.5)*4-96,cz=(y+.5)*4-96,roadWidth=roads[t.roadType]?.width||(t.roadWidth===2?3.15:2.45);if(horizontal||!vertical)roadRectangle({x:cx-2,z:cz},{x:cx+2,z:cz},roadWidth);if(vertical)roadRectangle({x:cx,z:cz-2},{x:cx,z:cz+2},roadWidth);if(horizontal&&vertical||RoadTypes.isLimitedAccess(t.roadType))continue;
  const source={zoneSides:t.zoneSides,x:cx,z:cz,tx:vertical?0:1,tz:vertical?1:0,col:vertical?y:x,source:vertical?'legacy-v-'+x:'legacy-h-'+y,roadIndex:i,offset:Math.max(independent?0:2,roadWidth/2+.45)};
  if(!independent)sources.push(source);else{const along=vertical?cz:cx;for(let col=Math.ceil((along-2)/cellSize-.5);(col+.5)*cellSize<along+2-1e-8;col++)sources.push({...source,col,...(vertical?{z:(col+.5)*cellSize}:{x:(col+.5)*cellSize})});}
 }
 for(const a of sources)for(const side of [-1,1])for(let row=0;row<rows;row++){if(a.zoneSides==='none'||a.zoneSides==='left'&&side===1||a.zoneSides==='right'&&side===-1)continue;const nx=-a.tz*side,nz=a.tx*side,d=(a.sideOffsets?.[side===-1?0:1]??a.offset)+cellSize/2+row*cellSize,cx=a.x+nx*d,cz=a.z+nz*d,index=indexAt(cx,cz);if(index<0||!independent&&w.tiles[index].type==='road'||w.tiles[index].ground==='water')continue;const p={index,...(independent?{id:JSON.stringify([a.source,side,a.col,row]),width:cellSize,depth:cellSize}:{}),cx,cz,angle:Math.atan2(-nx,-nz),source:a.source,side,col:a.col,row,roadIndex:a.roadIndex,frontage:{x:a.x,z:a.z,roadIndex:a.roadIndex,...(!a.source.startsWith('legacy-')?{pathId:a.source}:{})}};if(corners(p).some(v=>{const j=indexAt(v.x*.999999,v.z*.999999);return j<0||w.tiles[j].ground==='water';}))continue;const rectangle=collisionRect(p);if(crossesRoad(rectangle)||Roundabouts.blocked(w,p,.55))continue;candidates.push(rectangle);}
 candidates.sort((a,b)=>a.cell.row-b.cell.row||a.cell.source.localeCompare(b.cell.source)||a.cell.side-b.cell.side||a.cell.col-b.cell.col);
 const cells=new Map(),bins=new Map();for(const rectangle of candidates){const p=rectangle.cell,cellKey=independent?p.id:p.index;if(cells.has(cellKey))continue;
 // Only retain an unbroken column from the sidewalk. A rejected frontage
 // cell must not leave floating buildable cells behind a crossing or curve.
 if(independent&&p.row>0&&!cells.has(JSON.stringify([p.source,p.side,p.col,p.row-1])))continue;const x=Math.floor(p.cx/8),z=Math.floor(p.cz/8);let collision=false;nearby:for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const q of bins.get((x+dx)+','+(z+dz))||[])if(rectOverlaps(rectangle,q)){collision=true;break nearby;}if(collision)continue;cells.set(cellKey,p);const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(rectangle);}
 variants.set(variant,{paths,tiles:tileSnapshot(w.tiles),cells});cache.set(w,variants);return cells;
}
function hit(cells,x,z){for(const p of cells.values()){const dx=x-p.cx,dz=z-p.cz,c=Math.cos(p.angle),s=Math.sin(p.angle);if(Math.abs(dx*c-dz*s)<=(p.width||4)/2&&Math.abs(dx*s+dz*c)<=(p.depth||4)/2)return p;}return null;}
function selection(cells,a,b){const pa=cells.get(a.y*48+a.x),pb=cells.get(b.y*48+b.x);if(pa&&pb&&pa.source===pb.source&&pa.side===pb.side)return [...cells.values()].filter(p=>p.source===pa.source&&p.side===pa.side&&p.col>=Math.min(pa.col,pb.col)&&p.col<=Math.max(pa.col,pb.col)&&p.row>=Math.min(pa.row,pb.row)&&p.row<=Math.max(pa.row,pb.row)).map(p=>({x:p.index%48,y:Math.floor(p.index/48)}));return [...cells.values()].filter(p=>p.index%48>=Math.min(a.x,b.x)&&p.index%48<=Math.max(a.x,b.x)&&Math.floor(p.index/48)>=Math.min(a.y,b.y)&&Math.floor(p.index/48)<=Math.max(a.y,b.y)).map(p=>({x:p.index%48,y:Math.floor(p.index/48)}));}
function lot(w,cells,index,shapes){const start=cells.get(index);if(!start||start.row!==0)return null;const byCoordinate=new Map([...cells.values()].filter(p=>p.source===start.source&&p.side===start.side).map(p=>[p.col+','+p.row,p]));
 for(const [width,depth]of shapes){const chosen=[];for(let y=0;y<depth;y++)for(let x=0;x<width;x++){const p=byCoordinate.get((start.col+x)+','+(start.row+y));if(p)chosen.push(p);}if(chosen.length!==width*depth)continue;if(!chosen.every(p=>{const t=w.tiles[p.index];return !t.type&&!t.construction&&t.zoneOwner===undefined&&t.zone===w.tiles[index].zone&&Math.abs(Math.sin(p.angle-start.angle))<.09;}))continue;
  const cx=chosen.reduce((n,p)=>n+p.cx,0)/chosen.length,cz=chosen.reduce((n,p)=>n+p.cz,0)/chosen.length,p={cx,cz,angle:start.angle,width:width*4-.12,depth:depth*4-.12};
  // Curves may leave wedges. Do not let a rectangular building consume them.
  if(corners(p).some(v=>!chosen.some(q=>{const dx=v.x-q.cx,dz=v.z-q.cz,c=Math.cos(q.angle),s=Math.sin(q.angle);return Math.abs(dx*c-dz*s)<=2.08&&Math.abs(dx*s+dz*c)<=2.08;})))continue;
  return {owner:index,members:chosen.map(q=>q.index),width,depth,oriented:{cx,cz,angle:start.angle,width:p.width,depth:p.depth,frontage:start.frontage}};
 }return null;
}
const api={layout,corners,overlaps,hit,selection,lot};if(typeof module!=='undefined')module.exports=api;else root.BoroughZoning=api;
})(globalThis);
