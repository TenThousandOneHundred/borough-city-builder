import * as THREE from './vendor/three.module.js';
import {groundHeight} from './landscape.js?v=158';
export function updateLandBoundary(view){
 if(view.landBoundary){view.landBoundary.geometry.dispose();view.landBoundary.material.dispose();view.landBoundary.removeFromParent();view.landBoundary=null;}
 const w=view.world,L=globalThis.BoroughLand;if(!w?.land||view.menu||w.land.owned.length===L.columns(w)**2)return;
 const n=globalThis.BoroughGrid.size(w),half=n*2,cols=L.columns(w),points=[],size=L.DISTRICT*4;
 for(const id of w.land.owned){const col=id%cols,row=Math.floor(id/cols),x=col*size-half,z=row*size-half;
  for(const [dx,dz,a,b]of [[-1,0,[x,z],[x,z+size]],[1,0,[x+size,z],[x+size,z+size]],[0,-1,[x,z],[x+size,z]],[0,1,[x,z+size],[x+size,z+size]]]){
   if(col+dx>=0&&col+dx<cols&&row+dz>=0&&row+dz<cols&&w.land.owned.includes((row+dz)*cols+col+dx))continue;
   for(let k=0;k<size;k+=4)for(const t of [k/size,(k+2.5)/size]){const xx=a[0]+(b[0]-a[0])*t,zz=a[1]+(b[1]-a[1])*t;points.push(xx,Math.max(.2,groundHeight(w,xx,zz))+.3,zz);}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#b0e3e8',transparent:true,opacity:.85,depthWrite:false}));line.frustumCulled=false;view.landBoundary=line;view.scene.add(line);
}
