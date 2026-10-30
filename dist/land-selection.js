import * as THREE from './vendor/three.module.js';
import './map-grid.js?v=166';
import {groundHeight} from './landscape.js?v=166';

// Only built while purchasing land. One terrain-conforming color mesh, one
// faint grid, and one selected-edge mesh; camera moves never resample terrain.
export class LandSelection {
 constructor(view){this.view=view;this.group=new THREE.Group();this.group.name='Land selection';this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.projected=new THREE.Vector3();this.active=false;}
 open(){
  this.close();const v=this.view,w=v.world,L=globalThis.BoroughLand,n=globalThis.BoroughGrid.size(w),size=L.DISTRICT*4,half=n*2,cols=L.columns(w),steps=L.DISTRICT;
  this.world=w;this.cols=cols;this.size=size;this.half=half;this.cells=[];const vertices=[],colors=[],indices=[],grid=[],edgeVertices=[],edgeColors=[];
  const height=(x,z)=>Math.max(.2,v.renderHeight?v.renderHeight(w,x,z):groundHeight(w,x,z))+.45;
  for(let id=0;id<cols*cols;id++){
   const x0=id%cols*size-half,z0=Math.floor(id/cols)*size-half,start=vertices.length/3,edgeStart=edgeVertices.length/3;
   for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++){const xx=x0+x*4,zz=z0+z*4;vertices.push(xx,height(xx,zz),zz);colors.push(0,0,0,0);}
   for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){const i=start+z*(steps+1)+x;indices.push(i,i+steps+1,i+1,i+1,i+steps+1,i+steps+2);}
   const corners=[[x0,z0],[x0+size,z0],[x0+size,z0+size],[x0,z0+size]];
   for(let side=0;side<4;side++){
    const a=corners[side],b=corners[(side+1)%4],dx=(b[0]-a[0])/size,dz=(b[1]-a[1])/size;
    for(let k=0;k<steps;k++){
     const p=[];for(const [t,offset] of [[k*4,-.35],[k*4,.35],[(k+1)*4,-.35],[(k+1)*4,.35]]){const x=a[0]+dx*t-dz*offset,z=a[1]+dz*t+dx*offset;p.push([x,height(x,z)+.03,z]);}
     for(const j of [0,1,2,2,1,3]){edgeVertices.push(...p[j]);edgeColors.push(0,0,0,0);}
    }
   }
   let land=0;for(let z=0;z<steps;z++)for(let x=0;x<steps;x++)if(w.tiles[(Math.floor(id/cols)*steps+z)*n+id%cols*steps+x].ground==='land')land++;
   this.cells.push({id,start,count:(steps+1)**2,edgeStart,edgeCount:edgeVertices.length/3-edgeStart,center:new THREE.Vector3(x0+size/2,height(x0+size/2,z0+size/2),z0+size/2),buildable:land*.0004});
  }
  for(let line=0;line<=cols;line++)for(let k=0;k<n;k++)for(const vertical of [false,true])for(const t of [k*4,(k+1)*4]){const x=vertical?line*size-half:t-half,z=vertical?t-half:line*size-half;grid.push(x,height(x,z),z);}
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeBoundingSphere();
  this.fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,toneMapped:false,fog:false,depthWrite:false,side:THREE.DoubleSide}));this.fill.renderOrder=3;this.group.add(this.fill);
  const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(grid,3)),new THREE.LineBasicMaterial({color:'#c2d6cf',toneMapped:false,fog:false,opacity:.30,transparent:true,depthTest:false,depthWrite:false}));lines.renderOrder=4;this.group.add(lines);
  this.edges=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edgeVertices,3)).setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,4)),new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,toneMapped:false,fog:false,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));this.edges.renderOrder=5;this.group.add(this.edges);
  this.saved={position:v.camera.position.clone(),target:v.controls.target.clone(),maxDistance:v.controls.maxDistance,fogDensity:v.scene.fog?.density};
  this.styleKey=null;this.active=true;v.landMode=true;v.scene.add(this.group);this.focus();this.update(new Set());
 }
 focus(){const v=this.view,span=this.half*2,fov=v.camera.fov*Math.PI/180,distance=span/(2*Math.tan(fov/2)*Math.min(1,v.camera.aspect))*1.12;v.controls.maxDistance=Math.max(this.saved.maxDistance,distance*1.8);if(Number.isFinite(this.saved.fogDensity))v.scene.fog.density=this.saved.fogDensity*Math.min(1,420/distance);this.setCamera(new THREE.Vector3(0,distance*.85,span*.12+distance*.527),new THREE.Vector3(0,0,span*.12));}
 setCamera(position,target){const c=this.view.controls,damping=c.enableDamping;c.enableDamping=false;c.update();this.view.camera.position.copy(position);c.target.copy(target);c.update();c.enableDamping=damping;this.view.camera.updateMatrixWorld();}
 update(selected,hover=null){
  if(!this.active)return;const owned=this.world.land?.owned||this.cells.map(c=>c.id),key=owned.join(',')+'|'+[...selected].join(',')+'|'+hover;if(key===this.styleKey)return;this.styleKey=key;const color=this.fill.geometry.attributes.color,edges=this.edges.geometry.attributes.color;
  for(const cell of this.cells){const chosen=selected.has(cell.id),over=hover===cell.id,has=owned.includes(cell.id),rgba=chosen?[.04,.40,.46,.16]:has?[0,0,0,0]:[.015,.03,.035,over?.12:.24],edge=chosen?[.08,.70,.82,.95]:over?[.8,.93,.93,.6]:[0,0,0,0];for(let i=cell.start;i<cell.start+cell.count;i++)color.setXYZW(i,...rgba);for(let i=cell.edgeStart;i<cell.edgeStart+cell.edgeCount;i++)edges.setXYZW(i,...edge);}
  color.needsUpdate=true;edges.needsUpdate=true;
 }
 pick(clientX,clientY){if(!this.active)return null;const r=this.view.canvas.getBoundingClientRect();this.ndc.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.view.camera);const hit=this.ray.intersectObject(this.fill,false)[0];return hit?Math.floor(hit.faceIndex/(globalThis.BoroughLand.DISTRICT**2*2)):null;}
 screen(id){const cell=this.cells[id];if(!cell)return null;const r=this.view.canvas.getBoundingClientRect(),p=this.projected.copy(cell.center).project(this.view.camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1};}
 close(){if(!this.active)return;this.active=false;this.view.landMode=false;this.group.removeFromParent();this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.group.clear();this.view.controls.maxDistance=this.saved.maxDistance;if(Number.isFinite(this.saved.fogDensity))this.view.scene.fog.density=this.saved.fogDensity;this.setCamera(this.saved.position,this.saved.target);this.cells=[];this.fill=null;this.edges=null;}
}
