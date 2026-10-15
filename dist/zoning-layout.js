(function(root){
'use strict';
const cache=new WeakMap(),SIZE=48,CELL=4;
const indexAt=(x,z)=>{const a=Math.floor((x+96)/4),b=Math.floor((z+96)/4);return a<0||b<0||a>=48||b>=48?-1:b*48+a;};
function corners(p,width=CELL,depth=CELL){const c=Math.cos(p.angle),s=Math.sin(p.angle);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:p.cx+x*width/2*c+z*depth/2*s,z:p.cz-x*width/2*s+z*depth/2*c}));}
function overlaps(a,b){const ac=Math.cos(a.angle),as=Math.sin(a.angle),bc=Math.cos(b.angle),bs=Math.sin(b.angle),dx=b.cx-a.cx,dz=b.cz-a.cz;for(const [x,z]of [[ac,-as],[as,ac],[bc,-bs],[bs,bc]]){const ar=Math.abs(x*ac-z*as)*(a.width||4)/2+Math.abs(x*as+z*ac)*(a.depth||4)/2,br=Math.abs(x*bc-z*bs)*(b.width||4)/2+Math.abs(x*bs+z*bc)*(b.depth||4)/2;if(Math.abs(dx*x+dz*z)>=ar+br-.02)return false;}return true;}
function layout(w,roads){
 const signature=JSON.stringify(w.roadPaths||[])+'|'+w.tiles.map(t=>t.ground+'/'+(t.type==='road'?[t.roadType,t.roadWidth,t.legacyRoad,(t.pathIds||[]).join(',')].join(':'):'')).join(';');
 const old=cache.get(w);if(old?.signature===signature)return old.cells;
 const candidates=[],sources=[],roadBins=new Map();
 function roadRectangle(a,b,width){const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<1e-8)return;const p={cx:(a.x+b.x)/2,cz:(a.z+b.z)/2,angle:Math.atan2(-dz,dx),width:length+.05,depth:width+.8},points=corners(p,p.width,p.depth),minX=Math.floor(Math.min(...points.map(v=>v.x))/8),maxX=Math.floor(Math.max(...points.map(v=>v.x))/8),minZ=Math.floor(Math.min(...points.map(v=>v.z))/8),maxZ=Math.floor(Math.max(...points.map(v=>v.z))/8);for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const key=x+','+z;if(!roadBins.has(key))roadBins.set(key,[]);roadBins.get(key).push(p);}}
 function crossesRoad(p){const x=Math.floor(p.cx/8),z=Math.floor(p.cz/8),seen=new Set();for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const road of roadBins.get((x+dx)+','+(z+dz))||[]){if(seen.has(road))continue;seen.add(road);if(overlaps(p,road))return true;}return false;}

 for(const path of w.roadPaths||[]){const [a,b,c]=path.controls,points=[],steps=Math.max(2,Math.ceil(path.controls.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-path.controls[i].x,p.y-path.controls[i].y),0)*8));let length=0;
  for(let j=0;j<=steps;j++){const t=j/steps,u=1-t,p={x:((c?u*u*a.x+2*u*t*b.x+t*t*c.x:a.x+(b.x-a.x)*t)+.5)*4-96,z:((c?u*u*a.y+2*u*t*b.y+t*t*c.y:a.y+(b.y-a.y)*t)+.5)*4-96};if(j)length+=Math.hypot(p.x-points[j-1].x,p.z-points[j-1].z);p.distance=length;points.push(p);}
  for(let k=1;k<points.length;k++)roadRectangle(points[k-1],points[k],roads[path.type]?.width||2.45);if(path.type==='highway')continue;
  const columns=Math.floor(length/4);for(let col=0;col<columns;col++){const d=(col+.5)*4;let k=1;while(k<points.length-1&&points[k].distance<d)k++;const a=points[k-1],b=points[k],f=(d-a.distance)/(b.distance-a.distance||1),vx=b.x-a.x,vz=b.z-a.z,l=Math.hypot(vx,vz)||1;sources.push({x:a.x+vx*f,z:a.z+vz*f,tx:vx/l,tz:vz/l,col,source:path.id,roadIndex:path.tiles[Math.min(path.tiles.length-1,Math.floor(col/Math.max(1,columns)*path.tiles.length))],offset:Math.max(2,(roads[path.type]?.width||2.45)/2+.45)});}
 }
 for(let i=0;i<w.tiles.length;i++){const t=w.tiles[i];if(t.type!=='road'||t.pathIds?.length&&!t.legacyRoad)continue;const x=i%48,y=Math.floor(i/48),horizontal=(x>0&&w.tiles[i-1].type==='road')||(x<47&&w.tiles[i+1].type==='road'),vertical=(y>0&&w.tiles[i-48].type==='road')||(y<47&&w.tiles[i+48].type==='road');const cx=(x+.5)*4-96,cz=(y+.5)*4-96,roadWidth=roads[t.roadType]?.width||(t.roadWidth===2?3.15:2.45);if(horizontal||!vertical)roadRectangle({x:cx-2,z:cz},{x:cx+2,z:cz},roadWidth);if(vertical)roadRectangle({x:cx,z:cz-2},{x:cx,z:cz+2},roadWidth);if(horizontal&&vertical||t.roadType==='highway')continue;
  sources.push({x:(x+.5)*4-96,z:(y+.5)*4-96,tx:vertical?0:1,tz:vertical?1:0,col:vertical?y:x,source:vertical?'legacy-v-'+x:'legacy-h-'+y,roadIndex:i,offset:Math.max(2,roadWidth/2+.45)});
 }
 for(const a of sources)for(const side of [-1,1])for(let row=0;row<4;row++){const nx=-a.tz*side,nz=a.tx*side,d=a.offset+2+row*4,cx=a.x+nx*d,cz=a.z+nz*d,index=indexAt(cx,cz);if(index<0||w.tiles[index].type==='road'||w.tiles[index].ground==='water')continue;const p={index,cx,cz,angle:Math.atan2(-nx,-nz),source:a.source,side,col:a.col,row,roadIndex:a.roadIndex,frontage:{x:a.x,z:a.z,roadIndex:a.roadIndex,...(!a.source.startsWith('legacy-')?{pathId:a.source}:{})}};if(corners(p).some(v=>{const j=indexAt(v.x*.999999,v.z*.999999);return j<0||w.tiles[j].ground==='water';}))continue;if(crossesRoad(p))continue;candidates.push(p);}
 candidates.sort((a,b)=>a.row-b.row||a.source.localeCompare(b.source)||a.side-b.side||a.col-b.col);
 const cells=new Map(),bins=new Map();for(const p of candidates){if(cells.has(p.index))continue;const x=Math.floor(p.cx/8),z=Math.floor(p.cz/8);let collision=false;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const q of bins.get((x+dx)+','+(z+dz))||[])if(overlaps(p,q))collision=true;if(collision)continue;cells.set(p.index,p);const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}
 cache.set(w,{signature,cells});return cells;
}
function hit(cells,x,z){for(const p of cells.values()){const dx=x-p.cx,dz=z-p.cz,c=Math.cos(p.angle),s=Math.sin(p.angle);if(Math.abs(dx*c-dz*s)<=2&&Math.abs(dx*s+dz*c)<=2)return p;}return null;}
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
