import * as THREE from './vendor/three.module.js';
// Heights come from the rendered terrain, including sculpting and the far-mesh
// datum. Two bytes retain sub-centimetre precision without float-texture support.
export function writeWaterHeights(geometry,data){
 const positions=geometry.attributes.position;
 if(!data||data.length!==positions.count*4)data=new Uint8Array(positions.count*4);
 for(let i=0;i<positions.count;i++){
  const encoded=Math.max(0,Math.min(65535,Math.round((positions.getY(i)+64)*256))),j=i*4;
  data[j]=encoded>>>8;data[j+1]=encoded&255;data[j+2]=0;data[j+3]=255;
 }
 return data;
}
export function waterHeightTexture(geometry){
 const size=Math.round(Math.sqrt(geometry.attributes.position.count));
 if(size*size!==geometry.attributes.position.count)throw Error('Water depth requires square terrain samples');
 const texture=new THREE.DataTexture(writeWaterHeights(geometry),size,size,THREE.RGBAFormat);
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return texture;
}
