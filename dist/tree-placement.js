// Keep temperate trees off cliff faces. Sample at the trunk's location rather
// than the zoning-cell centre, since each tree has its own scattered position.
export function supportsTree(world,x,z,height){
 const dx=height(world,x+.5,z)-height(world,x-.5,z),dz=height(world,x,z+.5)-height(world,x,z-.5);
 return Number.isFinite(dx)&&Number.isFinite(dz)&&Math.hypot(dx,dz)<=.7;
}
