import * as THREE from './vendor/three.module.js';

// One small, locally drawn face is shared by every sign. No image download,
// changing texture or per-frame geometry is needed.
export function stopSignMaterial(){
 let map;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  const octagon=r=>{c.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();};
  c.fillStyle='#eeeae0';octagon(64);c.fillStyle='#b52e27';octagon(58);
  c.fillStyle='#fff9ec';c.font='bold 34px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('STOP',64,66);
  map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 }
 return new THREE.MeshStandardMaterial({map:map||null,color:map?'#ffffff':'#b52e27',roughness:.75});
}

export function addStopSign(view,group,p,y,material){
 view.box(group,p.x,y+.31,p.z,.025,.62,.025,'#89928e');
 const face=new THREE.Mesh(new THREE.CircleGeometry(.11,8,Math.PI/8),material);
 face.position.set(p.x+p.tx*.018,y+.57,p.z+p.tz*.018);face.rotation.y=Math.atan2(p.tx,p.tz);face.castShadow=true;group.add(face);
 const back=new THREE.Mesh(new THREE.CircleGeometry(.11,8,Math.PI/8),view.mat('#89928e'));
 back.position.set(p.x+p.tx*.012,y+.57,p.z+p.tz*.012);back.rotation.y=face.rotation.y+Math.PI;group.add(back);
}
