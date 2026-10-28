import {urbanBuilding} from './urban.js?v=143';
import {sculptedBuilding} from './skyline.js?v=143';
import * as THREE from './vendor/three.module.js';
// District buildings use separate wings, roof forms and recessed outdoor spaces.
// Geometry is deterministic so a saved neighborhood never changes on reload.
export function districtBuilding(a,q,t,seed){
 if(urbanBuilding(a,q,t,seed))return true;
 if(sculptedBuilding(a,q,t,seed))return true;
 const v=t.variant,night=a.v.night,kind=t.type,n=seed%11,low=t.density==='low',medium=t.density==='medium'||t.building==='apartments';
 const box=(x,y,z,w,h,d,c)=>a.box(q,x,y,z,w,h,d,c),wall=(style,f)=>a.facade(style,f,v,night),vol=(x,z,w,d,h,y,m)=>a.volume(q,x,z,w,d,h,y,m);
 const glass=wall('glass',1),trim=['#b5ad99','#888d86','#b8b8aa','#988b79'][v];
 function shrub(x,z,r=.23){const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,7),a.v.mat(['#485d38','#677345','#536548'][n%3]));m.scale.set(1,.7,.8);m.position.set(x,.17,z);m.castShadow=true;q.add(m)}
 function balcony(x,y,z,width){box(x,y,z,width,.045,.38,'#999e96');box(x,y+.23,z+.18,width,.018,.018,'#677470');for(let i=0;i<5;i++)box(x-width/2+i*width/4,y+.12,z+.18,.014,.23,.014,'#6f7c79');box(x-width/2+.06,y+.13,z,.11,.2,.2,'#898878')}
 if(kind==='residential'&&low){
  const floors=n%3===0?1:2,h=floors*.68,ww=1.7+(n%4)*.14,dd=1.65+(n%3)*.15;
  vol(-.25,-.28,ww,dd,h,0,wall(n%3===0?'stone':'brick',floors));
  if(n%2)a.hipRoof(q,-.25,-.28,ww+.25,dd+.25,h,n);else a.roofGable(q,-.25,-.28,ww+.24,dd+.25,h,a.roofFor(n));
  // An attached wing breaks the silhouette without filling the whole lot.
  vol(.85,-.15,.8,1.5,.67,0,wall('stone',1));a.roofGable(q,.85,-.15,.95,1.67,.67,a.roofFor(n));box(.85,.33,.63,.58,.55,.02,'#7d827a');
  box(-.25,.07,1.1,1.2,.12,.58,'#a79e8b');box(-.25,.76,1.04,1.22,.07,.64,trim);for(const x of [-.75,.25])box(x,.43,1.25,.04,.8,.04,trim);
  box(-.25,.37,.72,.33,.68,.035,'#40544f');box(-.25,.47,.75,.2,.25,.025,'#668084');
  if(floors===2&&n%2===0){vol(-.25,.02,.7,.7,.5,h+.12,wall('stone',1));a.roofGable(q,-.25,.02,.85,.85,h+.62,a.roofFor(n))}
  box(-.83,h+.3,-.67,.18,.55,.22,'#837360');
  for(const z of [-dd/2-.3,dd/2-.2])box(-.25,h-.025,z,ww+.24,.04,.055,'#8d948c');box(-ww/2-.25,h/2,.58,.035,h,.035,'#8d948c');
  for(let j=0;j<7;j++)shrub(-1.5+j*.45,1.65,.19+(j%2)*.04);
  if(n%3===1){const panel=new THREE.Mesh(new THREE.BoxGeometry(.85,.025,.65),glass);panel.rotation.z=-.5;panel.position.set(.17,h+.25,-.25);q.add(panel)}
  return true;
 }
 if(kind==='residential'){
  const floors=medium?3+n%3:7+t.level+n%5,h=floors*.57,fac=wall(n%2?'brick':'stone',floors);
  if(medium){
   vol(-.65,-.2,1.4,2.45,h,0,fac);vol(.73,-.83,1.32,1.18,h*.76,0,wall('brick',Math.ceil(floors*.76)));
   for(let f=1;f<floors;f++){balcony(-.66,f*.57,.98,1.18);box(-1.39,f*.57,0,.04,.045,2.4,trim)}
   a.roofDetails(q,h,1.35,2.3,v);for(let j=0;j<3;j++)shrub(.5+j*.3,.8,.2);
  }else{
   // A neighborhood mixes point towers, slabs, brick apartments and terraces.
   // Each family has different proportions, materials and a complete roofline.
   const family=seed%6,F=family===2?5+n%3:family===4?6+n%4:9+n%9,H=F*.49;
   const facade=wall(family===2?'brick':family===3?'glass':'stone',F);
   const W=family===1?2.75:family===2?2.9:1.85+n%3*.18,D=family===1?1.25:family===2?2.25:1.8;
   if(family===4){
    for(let tier=0;tier<3;tier++){const levelFloors=3,yy=tier*1.47,ww=2.85-tier*.47,dd=2.5-tier*.43;
     vol(-tier*.13,-tier*.14,ww,dd,1.47,yy,wall(tier%2?'brick':'stone',levelFloors));
     for(let j=0;j<3;j++)shrub(-.9+j*.65,1.1-tier*.2,.14);
     box(-tier*.13,yy+1.5,dd/2-tier*.14,ww,.045,.08,trim);
    }a.roofDetails(q,4.41,1.85,1.65,v);
   }else{
    vol(0,-.2,W,D,H,0,facade);
    const balconyFaces=family===0||family===1||family===5;
    if(balconyFaces){for(let floor=1;floor<F;floor++){
     const yy=floor*.49,across=family===1?3:2;
     for(let j=0;j<across;j++){
      const xx=(j-(across-1)/2)*(W/across);
      balcony(xx,yy,D/2-.03,W/across*.82);
     }
     // Contrasting side walls and slab edges define real recessed balconies.
     for(const side of [-1,1])box(side*(W/2+.015),yy,D/2-.02,.055,.49,.4,family===5?'#566167':'#c1c3ba');
    }}
    if(family===3){for(let j=0;j<6;j++)box(-W/2+j*W/5,H/2,D/2-.18,.026,H,.04,'#84908f');
     for(let floor=1;floor<F;floor++)box(0,floor*.49,D/2-.18,W,.04,.04,'#5c6c70');}
    if(family===2){for(let floor=1;floor<F;floor++)box(0,floor*.49,D/2-.18,W,.035,.06,'#a6a69b');
     for(const xx of [-W/2,W/2])box(xx,H/2,D/2-.17,.12,H,.075,'#b7b6aa');}
    a.roofDetails(q,H,W,D,v);
    vol(-.2,-.45,W*.46,D*.5,.42,H,wall('stone',1));
    box(0,.28,D/2-.15,.52,.54,.035,'#30474c');
    box(0,.68,D/2+.03,.86,.06,.48,'#a7afaa');
    for(let j=0;j<3;j++)shrub(-.8+j*.8,1.55,.17);
   }

  }
  return true;
 }
 if(kind==='commercial'){
  const floors=low?1+n%2:4+n%5,h=floors*.67,ww=2.55,dd=1.8;
  vol(0,-.37,ww,dd,h,0,wall(n%2?'brick':'stone',floors));
  if(low&&n%3===0)a.roofGable(q,0,-.37,ww+.15,dd+.15,h,a.roofFor(n));else{a.roofDetails(q,h,ww,dd,v);if(!low)vol(-.32,-.55,1.9,1.25,1.2,h,wall('glass',2))}
  const storefront=wall('glass',1);for(let j=0;j<3;j++){const x=-.86+j*.86;const m=new THREE.Mesh(new THREE.PlaneGeometry(.74,.61),storefront);m.position.set(x,.38,.54);q.add(m);box(x,.74,.64,.8,.09,.48,['#6c796b','#846959','#536e7d'][n%3]);box(x,.08,.67,.8,.08,.4,'#b3ad9a')}
  if(n%2===0){for(let j=0;j<2;j++){a.cylinder(q,-.7+j*1.4,.34,1.28,.23,.05,'#9a8d70');a.cylinder(q,-.7+j*1.4,.16,1.28,.025,.32,'#626c69');for(let k=0;k<2;k++)box(-.7+j*1.4+(k-.5)*.65,.18,1.28,.2,.04,.23,'#8b846d')}}else a.parking(q);
  for(const x of [-1.6,1.6])shrub(x,.85,.23);
  return true;
 }
 if(kind==='office'){
  const floors=5+t.level+n%8,h=floors*.58;
  vol(0,0,2.9,2.55,.7,0,wall('stone',1));
  if(n%3===0){
   // Elliptical glass facade with physical mullion bands.
   const mat=wall('glass',floors),tower=new THREE.Mesh(new THREE.CylinderGeometry(.98,1.12,h,64),mat);tower.scale.z=.76;tower.position.set(-.15,h/2+.7,-.12);tower.castShadow=true;tower.receiveShadow=true;q.add(tower);
   for(let f=1;f<=floors;f++){const r=1.12-(f/floors)*.14;const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.018,4,64),a.v.mat('#657b82'));ring.rotation.x=Math.PI/2;ring.scale.y=.76;ring.position.set(-.15,.7+f*.58,-.12);q.add(ring)}
  }else{
   const angle=n%2?.12:-.1,wing=new THREE.Group();q.add(wing);wing.rotation.y=angle;
   a.volume(wing,-.35,-.2,1.65,1.9,h, .7,wall('glass',floors));a.volume(wing,.65,.2,.85,1.5,h*.62,.7,wall('glass',Math.ceil(floors*.62)));
   for(let j=0;j<4;j++)a.box(wing,-1.19+j*.55,h/2+.7,.76,.027,h,.045,'#647781');
   a.roofDetails(wing,h+.7,1.6,1.85,v);
  }
  for(let j=0;j<4;j++)shrub(-1.15+j*.75,1.35,.2);
  return true;
 }
 return false;
}
