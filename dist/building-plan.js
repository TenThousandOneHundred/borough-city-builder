// Pure, deterministic lot planning. One world unit represents roughly five metres.
export function lotPlan(world,index,parcel){
 const tile=world.tiles[index],width=parcel?.width||1,depth=parcel?.depth||1;
 const cx=(index%48+.5)*4-96+(width-1)*2,cz=(Math.floor(index/48)+.5)*4-96+(depth-1)*2;
 let seed=(Math.imul(index+17,73856093)^Math.imul(world.seed,19349663))>>>0;
 const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const variation=next(),style=Math.floor(next()*6),tone=Math.floor(next()*5);
 let nearest=null,distance=Infinity;
 const gx=index%48,gy=Math.floor(index/48);
 for(let y=Math.max(0,gy-4);y<=Math.min(47,gy+depth+3);y++)for(let x=Math.max(0,gx-4);x<=Math.min(47,gx+width+3);x++){
  if(world.tiles[y*48+x].type!=='road')continue;const dx=(x+.5)*4-96-cx,dz=(y+.5)*4-96-cz,d=dx*dx+dz*dz;
  if(d<distance){distance=d;nearest={dx,dz};}
 }
 const angle=!nearest?0:Math.abs(nearest.dx)>Math.abs(nearest.dz)?(nearest.dx<0?-Math.PI/2:Math.PI/2):nearest.dz<0?Math.PI:0;
 const rotated=Math.abs(Math.sin(angle))>.5,lotWidth=(rotated?depth:width)*4,lotDepth=(rotated?width:depth)*4;
 const type=tile.type,density=tile.density||'high',low=type==='residential'&&density==='low';
 let floors;
 if(low)floors=style===0?1:2;
 else if(type==='commercial'&&density==='low')floors=style%3===0?2:1;
 else if(type==='industrial')floors=1;
 else if(density==='medium'||tile.building==='apartments')floors=3+style%4;
 else{const large=width*depth>1;floors=type==='office'?(large?10:6)+style*2:(large?7:4)+style;}
 return{index,type,density,low,style,tone,variation,floors,angle,cx,cz,lotWidth,lotDepth,seed:seed>>>0,level:tile.level};
}
