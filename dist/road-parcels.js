import './map-grid.js?v=160';
const G=globalThis.BoroughGrid;
import {lotPlan} from './building-plan.js?v=160';

// A rotated developed site may own a stair-stepped set of zoning cells. Its
// complete rectangular ground footprint must be covered by those cells.
export function rectangleCells(cx,cz,width,depth,angle){
 const c=Math.cos(angle),s=Math.sin(angle),hx=width/2,hz=depth/2,extentX=Math.abs(c)*hx+Math.abs(s)*hz,extentZ=Math.abs(s)*hx+Math.abs(c)*hz;
 if(cx-extentX< -G.half||cx+extentX>G.half||cz-extentZ< -G.half||cz+extentZ>G.half)return null;
 const result=[];
 for(let y=Math.max(0,Math.floor((cz-extentZ+G.half)/4));y<=Math.min(G.last,Math.floor((cz+extentZ+G.half)/4));y++)for(let x=Math.max(0,Math.floor((cx-extentX+G.half)/4));x<=Math.min(G.last,Math.floor((cx+extentX+G.half)/4));x++){
  const dx=(x+.5)*4-G.half-cx,dz=(y+.5)*4-G.half-cz;
  // Separating-axis test, including both rectangle axes and both grid axes.
  if(Math.abs(dx)>=extentX+2-1e-8||Math.abs(dz)>=extentZ+2-1e-8||Math.abs(dx*c-dz*s)>=hx+2*(Math.abs(c)+Math.abs(s))-1e-8||Math.abs(dx*s+dz*c)>=hz+2*(Math.abs(c)+Math.abs(s))-1e-8)continue;
  result.push(y*G.n+x);
 }
 return result;
}
export function roadParcels(world,eligible){
 const result=new Map();if(!world.roadPaths?.length)return result;
 const candidates=[];
 for(let i=0;i<world.tiles.length;i++){
  const t=world.tiles[i];if(!eligible(t))continue;const p=lotPlan(world,i);
  if(!p.frontage?.pathId||Math.abs(Math.sin(p.angle*2))<.12)continue;
  const distance=Math.hypot(p.cx-p.frontage.x,p.cz-p.frontage.z);if(distance>14)continue;
  candidates.push({i,p,distance});
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.i-b.i);
 for(const {i,p}of candidates){
  if(result.has(i))continue;const tile=world.tiles[i];
  for(const [width,depth]of [[12,8],[8,8],[12,4],[8,4],[4,8]]){
   const members=rectangleCells(p.cx,p.cz,width,depth,p.angle);
   if(!members||!members.every(j=>{const t=world.tiles[j];return !result.has(j)&&eligible(t)&&t.ground!=='water'&&t.type===tile.type&&t.density===tile.density;}))continue;
   const minX=Math.min(...members.map(j=>j%G.n)),maxX=Math.max(...members.map(j=>j%G.n)),minY=Math.min(...members.map(j=>Math.floor(j/G.n))),maxY=Math.max(...members.map(j=>Math.floor(j/G.n)));
   const owner=Math.min(...members),key='road:'+p.cx+':'+p.cz+':'+p.angle+':'+width+':'+depth+':'+members.map(j=>[j,world.tiles[j].level,world.tiles[j].variant,world.tiles[j].building].join('/')).join(';');
   const parcel={owner,members,key,width:maxX-minX+1,depth:maxY-minY+1,oriented:{cx:p.cx,cz:p.cz,angle:p.angle,width,depth,frontage:p.frontage}};
   for(const j of members)result.set(j,parcel);break;
  }
 }
 return result;
}

roadParcels=G.bind(roadParcels);
