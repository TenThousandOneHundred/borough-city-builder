// Shared lane centers and paint divisions, measured across the road surface.
// Positive offsets follow the existing right-hand travel convention.
export function laneLayout(spec){
 const lanes=Math.max(1,spec.lanes||2),half=spec.width/2,median=spec.median?.16:0,dividers=[],forward=[],reverse=[];
 if(spec.oneway){const width=spec.width/lanes;for(let i=0;i<lanes;i++)forward.push(half-(i+.5)*width);for(let i=1;i<lanes;i++)dividers.push({offset:-half+i*width,center:false});}
 else{const count=Math.max(1,Math.floor(lanes/2)),width=(half-median)/count;for(let i=0;i<count;i++){forward.push(median+(i+.5)*width);reverse.push(-median-(i+.5)*width);}if(!median)dividers.push({offset:0,center:true});for(let i=1;i<count;i++)for(const side of [-1,1])dividers.push({offset:side*(median+i*width),center:false});}
 return {forward,reverse,dividers};
}
export function laneOffset(spec,choice=0){const centers=laneLayout(spec).forward;return centers[((choice%centers.length)+centers.length)%centers.length];}

// Merge before a narrowing and spread out after a widening. Arc-length blending
// keeps a lane transition independent of the density of road samples.
export function transitionLaneOffsets(points,offsets){
 const changes=[];for(let i=1;i<offsets.length;i++)if(Math.abs(offsets[i]-offsets[i-1])>1e-6)changes.push(i);
 if(!changes.length)return offsets;
 const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
 const result=offsets.slice(),total=distances.at(-1);
 for(let c=0;c<changes.length;c++){
  const i=changes[c],at=distances[i],from=offsets[i-1],to=offsets[i],length=Math.max(8,Math.abs(to-from)*8),narrowing=Math.abs(to)<Math.abs(from);
  const lower=c?(distances[changes[c-1]]+at)/2:0,upper=c+1<changes.length?(distances[changes[c+1]]+at)/2:total;
  const start=narrowing?Math.max(lower,at-length):at,end=narrowing?at:Math.min(upper,at+length);
  if(end-start<1e-6)continue;
  let first=i;while(first>0&&distances[first-1]>=start)first--;
  for(let j=first;j<points.length&&distances[j]<=end;j++){
   const t=Math.max(0,Math.min(1,(distances[j]-start)/(end-start))),blend=t*t*(3-2*t);
   result[j]=from+(to-from)*blend;
  }
 }
 return result;
}
