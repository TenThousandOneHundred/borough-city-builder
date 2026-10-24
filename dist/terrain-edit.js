import './building-entities.js?v=104';
const Buildings=globalThis.BoroughBuildings;
// Save-owned elevation offsets on a two-world-unit grid. Rendering and simulation
// read the same surface; old saves with no elevation edits retain their terrain.
export const ELEVATION_SIZE=97,ELEVATION_STEP=2,ELEVATION_HALF=96;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
export function terrainOffset(world,x,z){
 const values=world.elevation;if(!values||x<=-96||z<=-96||x>=96||z>=96)return 0;
 const gx=(x+96)/2,gz=(z+96)/2,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*97+ix;
 return (values[i]*(1-u)+values[i+1]*u)*(1-v)+(values[i+97]*(1-u)+values[i+98]*u)*v;
}
function protection(world,x,z){
 let weight=ease(clamp((96-Math.max(Math.abs(x),Math.abs(z)))/4,0,1));
 const gx=Math.floor((x+96)/4),gz=Math.floor((z+96)/4);
 for(let y=Math.max(0,gz-3);y<=Math.min(47,gz+3);y++)for(let xx=Math.max(0,gx-3);xx<=Math.min(47,gx+3);xx++){
  const tile=world.tiles[y*48+xx];if(!tile.type&&!tile.construction&&tile.zoneOwner===undefined)continue;
  const distance=Math.max(Math.abs(x-((xx+.5)*4-96)),Math.abs(z-((y+.5)*4-96)));
  weight=Math.min(weight,ease(clamp((distance-4.25)/4,0,1)));
 }
 for(const p of Buildings.near(world,x,z,7)){const f=p.frame,dx=x-f.cx,dz=z-f.cz,c=Math.cos(f.angle),s=Math.sin(f.angle),distance=Math.max(Math.abs(dx*c-dz*s)-f.width/2,Math.abs(dx*s+dz*c)-f.depth/2);weight=Math.min(weight,ease(clamp((distance-2.25)/4,0,1)));}
 return weight;
}
export function sculptTerrain(world,{x,z,mode,radius=12,strength=.6,target=2},height){
 if(!['raise','lower','level','smooth'].includes(mode)||![x,z,radius,strength,target].every(Number.isFinite)||radius<2||radius>24||strength<=0||strength>4||Math.abs(x)>96||Math.abs(z)>96)return {ok:false,reason:'Invalid terrain brush'};
 const old=world.elevation||new Array(97*97).fill(0),changes=[],grounds=[];
 const bounds={minX:Math.max(-94,x-radius),maxX:Math.min(94,x+radius),minZ:Math.max(-94,z-radius),maxZ:Math.min(94,z+radius)};
 // Gather every change before writing, so smoothing is independent of traversal order.
 for(let iz=Math.max(1,Math.ceil((bounds.minZ+96)/2));iz<=Math.min(95,Math.floor((bounds.maxZ+96)/2));iz++)for(let ix=Math.max(1,Math.ceil((bounds.minX+96)/2));ix<=Math.min(95,Math.floor((bounds.maxX+96)/2));ix++){
  const px=ix*2-96,pz=iz*2-96,d=Math.hypot(px-x,pz-z)/radius;if(d>=1)continue;
  const weight=ease(1-d)*protection(world,px,pz);if(weight<=0)continue;
  const i=iz*97+ix,current=height(world,px,pz);let delta=mode==='lower'?-strength:strength;
  if(mode==='level')delta=clamp(target-current,-strength,strength);
  if(mode==='smooth'){const mean=(height(world,px-2,pz)+height(world,px+2,pz)+height(world,px,pz-2)+height(world,px,pz+2))/4;delta=clamp((mean-current)*.65,-strength,strength);}
  const next=Math.round(clamp(old[i]+delta*weight,-20,80)*10000)/10000;
  if(Math.abs(next-old[i])>.00009)changes.push({i,before:old[i],after:next});
 }
 if(!changes.length)return {ok:false,reason:'No terrain changed. Keep the brush clear of roads and buildings.'};
 const cost=Math.max(1,Math.ceil(changes.reduce((n,c)=>n+Math.abs(c.after-c.before)*3.2,0)));
 if(world.money<cost)return {ok:false,reason:'Not enough funds for earthworks'};
 world.elevation=old;for(const c of changes)old[c.i]=c.after;
 for(let y=Math.max(0,Math.floor((bounds.minZ+94)/4));y<=Math.min(47,Math.ceil((bounds.maxZ+98)/4));y++)for(let xx=Math.max(0,Math.floor((bounds.minX+94)/4));xx<=Math.min(47,Math.ceil((bounds.maxX+98)/4));xx++){
  const i=y*48+xx,t=world.tiles[i];if(t.type||t.construction||t.zoneOwner!==undefined)continue;
  const ground=height(world,(xx+.5)*4-96,(y+.5)*4-96)<.12?'water':'land';
  if(t.ground!==ground){grounds.push({i,before:t.ground,after:ground});t.ground=ground;}
 }
 world.money-=cost;world.elevationRevision=(world.elevationRevision||0)+1;
 return {ok:true,changed:changes.length,cost,bounds,undo:{changes,grounds,cost}};
}
export function undoTerrain(world,stroke){
 if(!stroke?.changes.length||!world.elevation)return {ok:false,reason:'No terrain stroke to undo'};
 if(stroke.changes.some(c=>protection(world,(c.i%97)*2-96,Math.floor(c.i/97)*2-96)===0&&Math.abs(world.elevation[c.i]-c.before)>.00009))return {ok:false,reason:'New roads or buildings protect this terrain. Remove them before undoing.'};
 for(const c of stroke.changes)world.elevation[c.i]=c.before;
 for(const g of stroke.grounds)if(!world.tiles[g.i].type)world.tiles[g.i].ground=g.before;
 world.money+=stroke.cost;world.elevationRevision=(world.elevationRevision||0)+1;
 return {ok:true};
}
