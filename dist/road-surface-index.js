const CELL_SIZE=4,MAX_TRIANGLE_CELLS=4096;

// World-space road triangles are copied before their source meshes are batched
// and disposed. Queries use cached scalar records, without raycasts or vectors.
export class RoadSurfaceIndex{
 constructor(){this.rows=new Map();this.oversized=[];this.triangleCount=0;this.lastCandidateCount=0;}
 clear(){this.rows.clear();this.oversized.length=0;this.triangleCount=0;this.lastCandidateCount=0;}
 add(geometry,kind){
  const position=geometry?.attributes?.position,index=geometry?.index;
  if(!position||position.itemSize<3||!Number.isFinite(position.count))return;
  const vertices=Math.floor(position.count),count=Math.floor(index?index.count:vertices);
  if(!Number.isFinite(count))return;
  for(let i=0;i+2<count;i+=3){
   const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
   if(!Number.isInteger(ia)||!Number.isInteger(ib)||!Number.isInteger(ic)||ia<0||ib<0||ic<0||ia>=vertices||ib>=vertices||ic>=vertices)continue;
   const ax=position.getX(ia),ay=position.getY(ia),az=position.getZ(ia),bx=position.getX(ib),by=position.getY(ib),bz=position.getZ(ib),cx=position.getX(ic),cy=position.getY(ic),cz=position.getZ(ic);
   if(!Number.isFinite(ax)||!Number.isFinite(ay)||!Number.isFinite(az)||!Number.isFinite(bx)||!Number.isFinite(by)||!Number.isFinite(bz)||!Number.isFinite(cx)||!Number.isFinite(cy)||!Number.isFinite(cz))continue;
   const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,den=ux*vz-uz*vx;
   const normalLength=Math.hypot(uy*vz-uz*vy,den,ux*vy-uy*vx),area=Math.abs(den);
   if(!Number.isFinite(normalLength)||area<=1e-12||area<=normalLength*1e-10)continue;
   // At least 0.05 mm in game metres, growing with Float32 coordinate spacing.
   // Each barycentric tolerance is an actual perpendicular edge distance.
   const epsilon=Math.max(1e-5,Math.max(Math.abs(ax),Math.abs(az),Math.abs(bx),Math.abs(bz),Math.abs(cx),Math.abs(cz))*2**-22);
   const t={kind,ax,ay,az,uy,vy,bx:vz/den,bz:-vx/den,cx:-uz/den,cz:ux/den,
    ea:epsilon*Math.hypot(cx-bx,cz-bz)/area,eb:epsilon*Math.hypot(vx,vz)/area,ec:epsilon*Math.hypot(ux,uz)/area,
    minX:Math.min(ax,bx,cx)-epsilon,maxX:Math.max(ax,bx,cx)+epsilon,minZ:Math.min(az,bz,cz)-epsilon,maxZ:Math.max(az,bz,cz)+epsilon};
   const x0=Math.floor(t.minX/CELL_SIZE),x1=Math.floor(t.maxX/CELL_SIZE),z0=Math.floor(t.minZ/CELL_SIZE),z1=Math.floor(t.maxZ/CELL_SIZE);
   this.triangleCount++;
   // A malformed or unusually broad mesh must not allocate millions of cells.
   if((x1-x0+1)*(z1-z0+1)>MAX_TRIANGLE_CELLS){this.oversized.push(t);continue;}
   for(let x=x0;x<=x1;x++){
    let row=this.rows.get(x);if(!row){row=new Map();this.rows.set(x,row);}
    for(let z=z0;z<=z1;z++){let bucket=row.get(z);if(!bucket){bucket=[];row.set(z,bucket);}bucket.push(t);}
   }
  }
 }
 sample(x,z,kind){
  this.lastCandidateCount=0;if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const bucket=this.rows.get(Math.floor(x/CELL_SIZE))?.get(Math.floor(z/CELL_SIZE));let highest=-Infinity;
  for(let pass=0;pass<2;pass++){
   const candidates=pass?this.oversized:bucket;if(!candidates)continue;
   for(let i=0;i<candidates.length;i++){
    const t=candidates[i];this.lastCandidateCount++;
    if(kind!=null&&t.kind!==kind||x<t.minX||x>t.maxX||z<t.minZ||z>t.maxZ)continue;
    const dx=x-t.ax,dz=z-t.az,b=dx*t.bx+dz*t.bz,c=dx*t.cx+dz*t.cz;
    if(b < -t.eb||c < -t.ec||1-b-c < -t.ea)continue;
    const height=t.ay+b*t.uy+c*t.vy;if(Number.isFinite(height)&&height>highest)highest=height;
   }
  }
  return highest===-Infinity?null:highest;
 }
}
