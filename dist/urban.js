import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Conventional city blocks complement the occasional sculpted landmark.
export function urbanBuilding(a,q,t,seed){
 const urban=t.type==='office'||t.type==='commercial'&&t.density==='high'||t.type==='residential'&&t.density!=='low';
 if(!urban)return false;
 if(t.type==='office'&&seed%7===0||t.type==='residential'&&t.density==='high'&&seed%9===0)return false;
 const v=t.variant,office=t.type==='office',family=(seed>>>5)%5,medium=t.density==='medium';
 const floors=medium?4+seed%3:family===0?5+seed%4:family===1?7+seed%5:11+seed%10,fh=.62,H=floors*fh;
 const wall=(style,f)=>a.facade(style,f,v,a.v.night),vol=(x,z,w,d,h,y,m)=>a.volume(q,x,z,w,d,h,y,m),box=(x,y,z,w,h,d,c)=>a.box(q,x,y,z,w,h,d,c);
 const masonry=wall(family===0||family===3?'brick':'stone',floors),glass=wall('glass',floors);
 const trim=family===3?'#5f6869':family===1?'#b0b2aa':'#cacbc0';
 const podiumH=1.25;
 // Ground-floor shopfronts and a continuous base fill the street frontage.
 vol(0,0,3.55,3.4,podiumH,0,wall(family===3?'brick':'stone',2));
 for(let j=0;j<6;j++){
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(.46,.7),wall('glass',1));pane.position.set(-1.45+j*.58,.49,1.708);q.add(pane);
  box(-1.71+j*.58,.49,1.73,.045,.88,.075,trim);
 }
 box(0,1.13,1.74,3.5,.085,.15,trim);
 const glassFront=(family===1||family===4)&&office;
 if(family===0||medium){
  // Perimeter apartments enclose a real open-air roof courtyard.
  const mh=H-podiumH;
  vol(-1.23,0,1.0,3.25,mh,podiumH,masonry);
  vol(1.23,0,1.0,3.25,mh,podiumH,masonry);
  vol(0,-1.16,1.52,.94,mh,podiumH,masonry);
  vol(0,1.17,1.52,.92,mh*.7,podiumH,wall('brick',Math.max(2,floors-2)));
  box(0,podiumH+.025,0,1.45,.025,1.36,'#778764');
  for(const z of [-.45,.45]){box(0,podiumH+.075,z,1.1,.055,.13,'#aeafa0');}
  roofPlant(a,q,-1.23,H,0,.85,2.8,seed);
  roofPlant(a,q,1.23,H,0,.85,2.8,seed+1);
 }else{
  const width=family===2?2.72:2.95,depth=family===4?2.25:2.65,x=family===4?-.25:0,z=-.23;
  vol(x,z,width,depth,H-podiumH,podiumH,glassFront?glass:masonry);
  // A second offset wing creates a composed silhouette instead of a single prism.
  if(family===4)vol(.93,.56,1.1,1.42,H*.48,podiumH,wall('stone',Math.round(floors*.48)));
  for(let f=2;f<floors;f++){
   const y=f*fh;
   if(!office&&family!==3){
    for(let j=0;j<4;j++){
     const bx=x-width*.36+j*width*.24;
     box(bx,y,depth/2+z+.1,width*.21,.035,.34,'#b1b4ad');
     box(bx,y+.18,depth/2+z+.265,width*.21,.025,.025,'#6f7c80');
     for(let k=0;k<3;k++)box(bx-width*.075+k*width*.075,y+.095,depth/2+z+.265,.012,.18,.015,'#849092');
    }
   }else if(f%2===0){box(x,y,depth/2+z+.022,width,.032,.065,trim);box(x,y,-depth/2+z-.022,width,.032,.065,trim);}
  }
  // Full-height piers and a modest crown, rather than oversized corner blocks.
  for(const side of [-1,1])box(x+side*(width/2-.05),H/2+podiumH/2,z+depth/2+.01,.065,H-podiumH,.065,trim);
  box(x,H+.06,z,width+.06,.12,depth+.06,trim);
  roofPlant(a,q,x,H+.12,z,width-.1,depth-.1,seed);
  // Accessible terraces, planters and pergola slats occupy the podium roof.
  box(0,podiumH+.06,1.45,2.8,.04,.25,'#808d70');
  for(let j=0;j<4;j++)box(-1.1+j*.72,podiumH+.16,1.48,.4,.18,.24,'#596b4b');
 }
 // Entry glazing is recessed behind a thin projecting canopy.
 box(.1,.64,1.73,.6,1.05,.025,'#344e59');box(.1,1.2,1.84,.92,.045,.42,'#8c9999');
 return true;
}

export function roofPlant(a,q,x,y,z,w,d,seed){
 const group=new THREE.Group();group.position.set(x,y,z);q.add(group);
 const box=(x,y,z,w,h,d,c)=>a.box(group,x,y,z,w,h,d,c);
 box(0,.012,0,w,.024,d,'#757b79');
 if(a.v.landscape?.assets['asphalt-color']){const material=a.urbanRoof ||= a.v.landscape.material('asphalt',.8,'#c0c3bc');const surface=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);surface.rotation.x=-Math.PI/2;surface.position.y=.025;group.add(surface);}
 for(const s of [-1,1]){box(s*w/2,.10,0,.04,.2,d,'#b4b9b1');box(0,.10,s*d/2,w,.2,.04,'#b4b9b1');}
 const units=Math.max(1,Math.floor(w*d/1.1));
 for(let k=0;k<units;k++){
  const px=((k%2)-.5)*w*.45,pz=(Math.floor(k/2)-(Math.ceil(units/2)-1)/2)*d*.6/Math.ceil(units/2);
  box(px,.13,pz,.42,.24,.38,'#a6aeaa');
  const fan=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.025,18),a.v.mat('#435453'));fan.position.set(px,.265,pz);group.add(fan);
  for(let j=0;j<5;j++)box(px-.15+j*.075,.255,pz,.015,.015,.3,'#bac0b6');
  // Duct runs and elbows visually connect equipment to the roof plant.
  box(px,.11,pz+.3,.12,.16,.25,'#9ca7a6');
 }
 box(w*.22,.19,-d*.26,.42,.35,.48,'#909a97');
 const duct=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,Math.max(.3,d*.55),16),a.v.mat('#acb5b3'));duct.rotation.x=Math.PI/2;duct.position.set(-w*.31,.13,0);group.add(duct);
 // Merge repeated rooftop parts by material to keep city draw calls bounded.
 const batches=new Map();group.updateMatrixWorld(true);
 for(const o of [...group.children])if(o.isMesh){const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());o.updateMatrix();geo.applyMatrix4(o.matrix);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);if(o.geometry!==a.v.unitBox)o.geometry.dispose();group.remove(o)}
 for(const [mat,geos]of batches){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
}
