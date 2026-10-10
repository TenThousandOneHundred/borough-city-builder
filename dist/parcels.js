// Visual consolidation only: every zoning cell, resident and save remains intact.
// Never combine across a road, service, construction site or density boundary.
export function visualParcels(world){
 const result=new Map(),N=48;
 const eligible=t=>t&&t.level>0&&!t.construction&&(t.type==='office'||t.type==='commercial'&&t.density==='high'||t.type==='residential'&&t.density!=='low');
 for(let i=0;i<world.tiles.length;i++){
  const t=world.tiles[i];if(result.has(i)||!eligible(t))continue;
  const x=i%N,y=Math.floor(i/N);
  for(const [width,depth]of [[2,2],[2,1],[1,2]]){
   if(x+width>N||y+depth>N)continue;const members=[];
   for(let dy=0;dy<depth;dy++)for(let dx=0;dx<width;dx++)members.push(i+dy*N+dx);
   if(!members.every(j=>{const a=world.tiles[j];return !result.has(j)&&eligible(a)&&a.type===t.type&&a.density===t.density}))continue;
   const key=members.map(j=>[j,world.tiles[j].level,world.tiles[j].variant,world.tiles[j].building].join('/')).join(';');
   const parcel={owner:i,width,depth,members,key};members.forEach(j=>result.set(j,parcel));break;
  }
 }
 return result;
}
