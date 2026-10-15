// Keep the exact nearest-tree ordering without allocating a candidate for every
// tree or sorting the population. Scratch storage is retained across camera moves.
export class TreeSelection {
 constructor(limit=10){this.limit=limit;this.records=[];this.distances=new Float64Array(limit);}
 select(records,camera,near,detail=true){
  const selected=this.records,distances=this.distances,limit=this.limit;selected.length=0;
  if(!detail)return selected;
  for(const r of records){
   if(!r.source)continue;
   const d=(r.x-camera.x)**2+(r.y+r.h*.5-camera.y)**2+(r.z-camera.z)**2;
   if(d>=1024||!(d<(near.has(r.i)?1024:784)))continue;
   let slot=selected.length;
   while(slot>0&&(d<distances[slot-1]||d===distances[slot-1]&&r.i<selected[slot-1].i))slot--;
   if(slot>=limit)continue;
   const end=Math.min(selected.length,limit-1);
   for(let j=end;j>slot;j--){selected[j]=selected[j-1];distances[j]=distances[j-1];}
   selected[slot]=r;distances[slot]=d;
  }
  return selected;
 }
}
