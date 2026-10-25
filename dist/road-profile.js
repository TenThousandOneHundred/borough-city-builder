// Render dimensions only. One world unit is five metres; road footprints,
// driving lanes and pedestrian routes keep their existing horizontal geometry.
export const ASPHALT_HEIGHT=.08;
export const JUNCTION_HEIGHT=.082;
export const SIDEWALK_HEIGHT=.115;
export const KERB_WIDTH=.04;
export const PAINT_CLEARANCE=.002;
export const MARKING_HEIGHT=JUNCTION_HEIGHT+PAINT_CLEARANCE;

// Keep a small bevel on a 20 cm kerb. At crossings its front drops to asphalt;
// the outer footway retains its level and provides the back of the ramp.
export function kerbProfile(edge,sidewalk,drop=0,side=1,base=ASPHALT_HEIGHT){
 const top=base+SIDEWALK_HEIGHT-ASPHALT_HEIGHT,lower=top-(top-base-.007)*drop;
 const profile=[[edge,base],[edge+.008,lower-.003],[edge+KERB_WIDTH,lower],[edge+sidewalk,top],[edge+sidewalk,base-.015]].map(([x,y])=>[x*side,y]);
 return side<0?profile.reverse():profile;
}
export function kerbCap(edge,drop=0,side=1,base=ASPHALT_HEIGHT){
 const top=base+SIDEWALK_HEIGHT-ASPHALT_HEIGHT-(SIDEWALK_HEIGHT-ASPHALT_HEIGHT-.007)*drop;
 // Match the underlying bevel instead of floating a flat ribbon above it.
 const inset=.001,bevel=.008,depth=.003,lift=.0004,span=KERB_WIDTH-bevel;
 const profile=[[edge+bevel+inset,top-depth*(1-inset/span)+lift],[edge+KERB_WIDTH-inset,top-depth*inset/span+lift]].map(([x,y])=>[x*side,y]);
 return side<0?profile.reverse():profile;
}
