// Versioned independent roadside cells and multi-cell parcel ownership.
(function(root){
'use strict';
const Z=typeof module!=='undefined'?require('./zoning-layout.js'):root.BoroughZoning;
const CELL=1.6,MAX_SIDE=6;
const zones=new Set(['residential_low','residential_row','residential_medium','residential_mixed','residential_lowrent','residential_high','commercial_low','commercial_high','industrial','office_low','office']);
function create(){return {version:2,cellSize:CELL,revision:0,nextParcel:1,cells:{},parcels:{}};}
function grid(world,roads){return Z.layout(world,roads,{cellSize:CELL,rows:6,independent:true});}
function paint(state,layout,ids,zone){
 if(zone!==null&&!zones.has(zone))return {changed:0,blocked:ids.length};
 let changed=0,blocked=0;
 for(const id of new Set(ids)){
  if(!layout.has(id)||state.cells[id]?.owner){blocked++;continue;}
  if((state.cells[id]?.zone??null)===zone)continue;
  if(zone===null)delete state.cells[id];else state.cells[id]={zone};changed++;
 }
 if(changed)state.revision=(state.revision||0)+1;return {changed,blocked};
}
function inside(p,x,z){const dx=x-p.cx,dz=z-p.cz,c=Math.cos(p.angle),s=Math.sin(p.angle);return Math.abs(dx*c-dz*s)<=CELL/2+.025&&Math.abs(dx*s+dz*c)<=CELL/2+.025;}
function proposal(state,layout,startId,width,depth){
 const start=layout.get(startId),zone=state.cells[startId]?.zone;
 if(!start||start.row!==0||!zone||![width,depth].every(n=>Number.isInteger(n)&&n>0&&n<=MAX_SIDE)||width*depth<2)return null;
 // Cell IDs already encode the road, side and grid coordinates. A lot needs
 // at most 36 lookups, even when the city contains thousands of zoning cells.
 const chosen=[];
 for(let row=0;row<depth;row++)for(let col=0;col<width;col++){
  const p=layout.get(JSON.stringify([start.source,start.side,start.col+col,start.row+row]));
  if(!p||state.cells[p.id]?.owner||state.cells[p.id]?.zone!==zone||Math.abs(Math.sin(p.angle-start.angle))>.09)return null;
  chosen.push(p);
 }
 const frame={cx:chosen.reduce((n,p)=>n+p.cx,0)/chosen.length,cz:chosen.reduce((n,p)=>n+p.cz,0)/chosen.length,angle:start.angle||0,width:width*CELL-.04,depth:depth*CELL-.04,frontage:{...start.frontage}};
 const fronts=chosen.filter(p=>p.row===0);frame.frontage={...fronts[Math.floor(fronts.length/2)].frontage,x:fronts.reduce((n,p)=>n+p.frontage.x,0)/fronts.length,z:fronts.reduce((n,p)=>n+p.frontage.z,0)/fronts.length};
 if(Z.corners(frame).some(p=>!chosen.some(c=>inside(c,p.x,p.z))))return null;
 // Reject any rectangular envelope overlapping a previously reserved parcel,
 // including a parcel whose road was removed since it was first developed.
 if(Object.values(state.parcels).some(p=>Z.overlaps(frame,p.frame)))return null;
 return {zone,width,depth,cells:chosen.map(p=>p.id),frame};
}
function reserve(state,layout,startId,width,depth){
 const candidate=proposal(state,layout,startId,width,depth);if(!candidate)return null;
 const id='parcel-'+state.nextParcel++,parcel={id,...candidate};
 state.revision=(state.revision||0)+1;state.parcels[id]=parcel;for(const cell of parcel.cells)state.cells[cell].owner=id;return parcel;
}
function release(state,id){const parcel=state.parcels[id];if(!parcel)return false;for(const cell of parcel.cells)if(state.cells[cell]?.owner===id)delete state.cells[cell].owner;delete state.parcels[id];state.revision=(state.revision||0)+1;return true;}
function terrainOccupancy(state){
 const result=new Map();
 for(const parcel of Object.values(state.parcels)){
  const points=Z.corners(parcel.frame),loX=Math.max(0,Math.floor((Math.min(...points.map(p=>p.x))+96)/4)),hiX=Math.min(47,Math.floor((Math.max(...points.map(p=>p.x))+96)/4)),loZ=Math.max(0,Math.floor((Math.min(...points.map(p=>p.z))+96)/4)),hiZ=Math.min(47,Math.floor((Math.max(...points.map(p=>p.z))+96)/4));
  for(let z=loZ;z<=hiZ;z++)for(let x=loX;x<=hiX;x++)if(Z.overlaps(parcel.frame,{cx:(x+.5)*4-96,cz:(z+.5)*4-96,angle:0,width:4,depth:4})){
   const index=z*48+x;if(!result.has(index))result.set(index,new Set());result.get(index).add(parcel.id);
  }
 }
 return result;
}
function valid(state){
 if(!state||state.version!==2||state.cellSize!==CELL||(state.revision!==undefined&&(!Number.isSafeInteger(state.revision)||state.revision<0))||!Number.isSafeInteger(state.nextParcel)||state.nextParcel<1||!state.cells||typeof state.cells!=='object'||Array.isArray(state.cells)||!state.parcels||typeof state.parcels!=='object'||Array.isArray(state.parcels))return false;
 if(Object.keys(state.cells).length>50000||Object.keys(state.parcels).length>10000)return false;
 for(const [id,cell]of Object.entries(state.cells)){
  let key;try{key=JSON.parse(id);}catch{return false;}
  if(!Array.isArray(key)||key.length!==4||typeof key[0]!=='string'||key[0].length>160||![-1,1].includes(key[1])||!Number.isInteger(key[2])||Math.abs(key[2])>10000||!Number.isInteger(key[3])||key[3]<0||key[3]>=6||!cell||!zones.has(cell.zone))return false;
  if(cell.owner!==undefined&&(!Object.hasOwn(state.parcels,cell.owner)||!Array.isArray(state.parcels[cell.owner]?.cells)||!state.parcels[cell.owner].cells.includes(id)))return false;
 }
 const parcels=Object.values(state.parcels);
 for(const [id,p]of Object.entries(state.parcels)){
  if(!p||p.id!==id||!/^parcel-[1-9]\d*$/.test(id)||Number(id.slice(7))>=state.nextParcel||!zones.has(p.zone)||![p.width,p.depth].every(n=>Number.isInteger(n)&&n>0&&n<=MAX_SIDE)||!Array.isArray(p.cells)||p.cells.length!==p.width*p.depth||p.cells.length<2||new Set(p.cells).size!==p.cells.length)return false;
  if(!p.cells.every(cell=>state.cells[cell]?.owner===id&&state.cells[cell].zone===p.zone))return false;
  const f=p.frame;
  if(!f||!['cx','cz','angle','width','depth'].every(k=>Number.isFinite(f[k]))||Math.abs(f.cx)>96||Math.abs(f.cz)>96||Math.abs(f.width-(p.width*CELL-.04))>1e-8||Math.abs(f.depth-(p.depth*CELL-.04))>1e-8||Z.corners(f).some(v=>Math.abs(v.x)>96.001||Math.abs(v.z)>96.001))return false;
  if(!f.frontage||![f.frontage.x,f.frontage.z].every(Number.isFinite)||Math.abs(f.frontage.x)>100||Math.abs(f.frontage.z)>100||!Number.isInteger(f.frontage.roadIndex)||f.frontage.roadIndex<0||f.frontage.roadIndex>=2304)return false;
 }
 const bins=new Map();
 for(const parcel of parcels){
  const points=Z.corners(parcel.frame),minX=Math.floor(Math.min(...points.map(p=>p.x))/8),maxX=Math.floor(Math.max(...points.map(p=>p.x))/8),minZ=Math.floor(Math.min(...points.map(p=>p.z))/8),maxZ=Math.floor(Math.max(...points.map(p=>p.z))/8),seen=new Set();
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)for(const other of bins.get(x+','+z)||[]){if(seen.has(other))continue;seen.add(other);if(Z.overlaps(parcel.frame,other.frame))return false;}
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(parcel);}
 }
 return true;
}
const api={create,grid,paint,proposal,reserve,release,terrainOccupancy,valid};if(typeof module!=='undefined')module.exports=api;else root.BoroughFineZones=api;
})(globalThis);
