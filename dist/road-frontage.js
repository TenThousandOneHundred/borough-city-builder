// Legacy buildings search this local rectangle for their nearest road. Keep
// invalidation in step with lotPlan; a distant road cannot change their facade.
export function changedRoadCells(tiles, previous=[]){
 const keys=new Array(tiles.length),changed=[];
 for(let i=0;i<tiles.length;i++){
  const t=tiles[i],key=t.type==='road'?[t.roadType,t.pathIds?.join(),t.roadWidth,t.ground,!!t.legacyRoad].join(':'):'';
  keys[i]=key;if((previous[i]||'')!==key)changed.push({x:i%48,y:Math.floor(i/48)});
 }
 return {keys,changed};
}
export function frontageTouches(changed,index,parcel){
 const x=index%48,y=Math.floor(index/48),width=parcel?.width||1,depth=parcel?.depth||1;
 return changed.some(p=>p.x>=x-4&&p.x<=x+width+3&&p.y>=y-4&&p.y<=y+depth+3);
}
