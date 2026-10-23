import * as THREE from './vendor/three.module.js';
// A periodic wave spectrum is baked once, not evaluated for every water pixel.
// RG stores surface gradients; B stores height for small patches of shore wash.
let pixels;
export function waterRippleTexture(){
 const size=128;
 if(!pixels){
  pixels=new Uint8Array(size*size*4);
  const waves=[[1,2,.45,.8],[3,1,.24,1.7],[-2,5,.2,.3],[7,3,.12,2.8],[-5,9,.08,4.3],[13,-4,.06,5.4],[11,17,.045,2.1],[-19,7,.03,3.7]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   let dx=0,dy=0,height=0;
   for(const [kx,ky,amplitude,phase] of waves){const a=((x+.5)*kx+(y+.5)*ky)/size*Math.PI*2+phase,s=Math.sin(a)*amplitude;dx-=kx*s;dy-=ky*s;height+=Math.cos(a)*amplitude;}
   const i=(y*size+x)*4,byte=v=>Math.round(Math.max(0,Math.min(1,v))*255);
   pixels[i]=byte(.5+dx*.07);pixels[i+1]=byte(.5+dy*.07);pixels[i+2]=byte(.5+height*.3);pixels[i+3]=255;
  }
 }
 // Independent texture ownership lets closing a world release its GPU resource.
 const texture=new THREE.DataTexture(pixels.slice(),size,size,THREE.RGBAFormat);
 texture.name='Water ripple spectrum';texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=2;texture.needsUpdate=true;return texture;
}
