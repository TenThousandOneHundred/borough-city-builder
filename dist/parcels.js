import './map-grid.js?v=167';
const G=globalThis.BoroughGrid;
import {roadParcels} from './road-parcels.js?v=167';
const cache=new WeakMap();
// Visual consolidation only: every zoning cell, resident and save remains intact.
// Never combine across a road, service, construction site or density boundary.
export function visualParcels(world){
 const signature=world.seed+'|'+JSON.stringify(world.roadPaths||[])+'|'+world.tiles.map(t=>[t.type,t.density,t.level,t.variant,t.building,t.construction,t.ground,t.zoneOwner,JSON.stringify(t.zoneSite),t.facilityOwner,t.facilitySite?.width,t.facilitySite?.depth,t.facilitySite?.rotation].join('/')).join(';'),cached=cache.get(world);if(cached?.signature===signature)return cached.result;
 const N=G.n;
 const eligible=t=>t&&t.zoneOwner===undefined&&t.level>0&&!t.construction&&(t.type==='office'||t.type==='commercial'&&t.density==='high'||t.type==='residential'&&t.density!=='low');
 const result=roadParcels(world,eligible);
 // Developed lots are simulation-owned sites, not transient visual merges.
 for(let i=0;i<world.tiles.length;i++){const t=world.tiles[i];if(!t.zoneSite)continue;const parcel={...t.zoneSite,key:'growable/'+i+'/'+JSON.stringify(t.zoneSite)+'/'+t.level+'/'+t.building};for(const j of parcel.members)result.set(j,parcel);}
 // Civic sites own their entire footprint; only the anchor renders a building.
 for(let i=0;i<world.tiles.length;i++){
  const t=world.tiles[i],site=t.facilitySite;if(!site||t.facilityOwner!==i)continue;
  const members=[];for(let y=0;y<site.depth;y++)for(let x=0;x<site.width;x++)members.push(i+y*N+x);
  const parcel={owner:i,width:site.width,depth:site.depth,rotation:site.rotation,facility:true,members,key:`facility/${i}/${t.building}/${site.width}/${site.depth}/${site.rotation}`};
  for(const j of members)result.set(j,parcel);
 }
 for(let i=0;i<world.tiles.length;i++){
  const t=world.tiles[i];if(result.has(i)||!eligible(t))continue;
  const x=i%N,y=Math.floor(i/N);
  for(const [width,depth]of [[3,2],[2,3],[2,2],[2,1],[1,2]]){
   if(x+width>N||y+depth>N)continue;const members=[];
   for(let dy=0;dy<depth;dy++)for(let dx=0;dx<width;dx++)members.push(i+dy*N+dx);
   if(!members.every(j=>{const a=world.tiles[j];return !result.has(j)&&eligible(a)&&a.type===t.type&&a.density===t.density}))continue;
   const key=members.map(j=>[j,world.tiles[j].level,world.tiles[j].variant,world.tiles[j].building].join('/')).join(';');
   const parcel={owner:i,width,depth,members,key};members.forEach(j=>result.set(j,parcel));break;
  }
 }
 cache.set(world,{signature,result});return result;
}

visualParcels=G.bind(visualParcels);
