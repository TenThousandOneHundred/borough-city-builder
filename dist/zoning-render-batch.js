import './map-grid.js?v=166';
const G=globalThis.BoroughGrid;
import * as THREE from './vendor/three.module.js';

// Write terrain-following cells straight into their final colour batches.
// Preserve PlaneGeometry(…, …, 2, 2)'s topology and Float32 local coordinates.
const CELL_INDICES=[0,3,1,3,4,1,1,4,2,4,5,2,3,6,4,6,7,4,4,7,5,7,8,5];
export class ZonePlaneBatch{
 constructor(world,height){this.world=world;this.height=height;this.batches=new Map();this.colors=new Map();}
 add(x,y,color,opacity=.3,frame=null){
  let value=this.colors.get(color);if(!value){value=new THREE.Color(color);this.colors.set(color,value);}
  const key=value.getHex()+':'+opacity;let batch=this.batches.get(key);
  if(!batch){batch={color:value,opacity,cells:[]};this.batches.set(key,batch);}
  batch.cells.push({cx:frame?.cx??((x+.5)*4-G.half),cz:frame?.cz??((y+.5)*4-G.half),width:(frame?.width||4)-.18,depth:(frame?.depth||4)-.18,angle:frame?.angle||0});
 }
 finish(group){
  for(const {color,opacity,cells}of this.batches.values()){
   const count=cells.length*9,positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),indices=count>65535?new Uint32Array(cells.length*24):new Uint16Array(cells.length*24);
   for(let cell=0;cell<cells.length;cell++){
    const f=cells[cell],c=Math.cos(f.angle),s=Math.sin(f.angle),base=cell*9;
    for(let row=0;row<3;row++)for(let column=0;column<3;column++){
     const localX=Math.fround(column*f.width/2-f.width/2),localZ=Math.fround(row*f.depth/2-f.depth/2),x=f.cx+localX*c+localZ*s,z=f.cz-localX*s+localZ*c,index=base+row*3+column;
     positions[index*3]=x;positions[index*3+1]=this.height(this.world,x,z)+.12;positions[index*3+2]=z;
     uvs[index*2]=column/2;uvs[index*2+1]=1-row/2;
    }
    for(let i=0;i<24;i++)indices[cell*24+i]=base+CELL_INDICES[i];
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
   group.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide})));
  }
 }
}


ZonePlaneBatch=G.bindClass(ZonePlaneBatch);
