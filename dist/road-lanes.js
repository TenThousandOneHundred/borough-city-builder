// Shared lane centers and paint divisions, measured across the road surface.
// Positive offsets follow the existing right-hand travel convention.
export function laneLayout(spec){
 const lanes=Math.max(1,spec.lanes||2),half=spec.width/2,median=spec.median?.16:0,dividers=[],forward=[],reverse=[];
 if(spec.oneway){const width=spec.width/lanes;for(let i=0;i<lanes;i++)forward.push(half-(i+.5)*width);for(let i=1;i<lanes;i++)dividers.push({offset:-half+i*width,center:false});}
 else{const count=Math.max(1,Math.floor(lanes/2)),width=(half-median)/count;for(let i=0;i<count;i++){forward.push(median+(i+.5)*width);reverse.push(-median-(i+.5)*width);}if(!median)dividers.push({offset:0,center:true});for(let i=1;i<count;i++)for(const side of [-1,1])dividers.push({offset:side*(median+i*width),center:false});}
 return {forward,reverse,dividers};
}
export function laneOffset(spec,choice=0){const centers=laneLayout(spec).forward;return centers[((choice%centers.length)+centers.length)%centers.length];}
