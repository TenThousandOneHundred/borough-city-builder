import * as THREE from './vendor/three.module.js';
import {GardenProps} from './garden-props.js?v=139';
import {IndustrialProps} from './industrial-props.js?v=139';
import {sitePlan} from './site-plan.js?v=139';
// All props share geometry and materials across the city, allowing the existing
// building instancer to submit them in a bounded number of draw calls.
export class SiteDetails{
 constructor(view,grounds={}){this.view=view;this.box=new THREE.BoxGeometry(1,1,1);this.plane=new THREE.PlaneGeometry(1,1);this.plane.rotateX(-Math.PI/2);this.rack=new THREE.TorusGeometry(.09,.012,5,12,Math.PI);this.materials={};this.treePlane=new THREE.PlaneGeometry(1,1);
  for(const [name,color]of Object.entries({walk:'#acae9f',drive:'#737671',patio:'#a39984',garden:'#5e7150',yard:'#717773',plaza:'#adb0a4',wood:'#8c806b',metal:'#555f60',paint:'#c6c5b3',soil:'#555447'}))this.materials[name]=new THREE.MeshStandardMaterial({name:'site-'+name,color,roughness:name==='metal'?.68:.94});
  if(grounds.grass)this.materials.garden=grounds.grass;
  if(grounds.paving){this.materials.walk=grounds.paving;this.materials.plaza=grounds.paving;}
  if(grounds.asphalt){this.materials.drive=grounds.asphalt;this.materials.yard=grounds.asphalt;}
 }
 piece(root,kind,x,y,z,w,h,d,angle=0){const mesh=new THREE.Mesh(this.box,this.materials[kind]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=angle;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.sharedAsset=true;mesh.userData.siteDetail=true;root.add(mesh);return mesh;}
 surface(root,kind,x,z,w,d,y=.006){const mesh=new THREE.Mesh(this.plane,this.materials[kind]);mesh.position.set(x,y,z);mesh.scale.set(w,1,d);mesh.receiveShadow=true;mesh.userData.sharedAsset=true;mesh.userData.siteDetail=true;root.add(mesh);}
 buildGardens(sites=[],origin={x:0,y:0,z:0},scale=.2,setback=0){
  const root=new THREE.Group();root.userData.buildingGardens=true;
  for(const bed of sites){
   const alongX=bed.w>bed.d,long=Math.max(bed.w,bed.d),short=Math.min(bed.w,bed.d),count=Math.max(1,Math.floor(long/3.6));
   for(let i=0;i<count;i++){
    const offset=((i+.5)/count-.5)*long,span=Math.min(short,long/count)-.15;
    this.tree(root,{x:(bed.x+origin.x+(alongX?offset:0))*scale,y:(bed.y+origin.y)*scale,z:(bed.z+origin.z+(alongX?0:offset))*scale+setback,w:span*scale,d:span*scale,minimum:.15,detailDistance:18,height:Math.min(4.6,span*1.9)*scale});
   }
  }
  return root;
 }
 tree(root,{x,y,z,w,d,height,minimum=.4,detailDistance=30}){const source=this.view.vegetation?.broadPrototype;if(!source)return;this.treeBounds ||= new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());const h=Math.min(height,w/this.treeBounds.x,d/this.treeBounds.z);if(h<minimum)return;const tree=source.clone(true);tree.scale.multiplyScalar(h);tree.position.set(x,y,z);tree.traverse(o=>{if(o.isMesh){o.userData.sharedAsset=true;o.userData.siteDetail=true;o.userData.siteRange=[0,detailDistance];}});root.add(tree);const material=this.view.vegetation?.broadleaf?.[0]?.material;if(material)for(let k=0;k<3;k++){const mesh=new THREE.Mesh(this.treePlane,material);mesh.position.set(x,y+h*.5,z);mesh.scale.set(this.treeBounds.x*h,h,1);mesh.rotation.y=k*Math.PI/3;mesh.castShadow=true;mesh.userData.sharedAsset=true;mesh.userData.siteDetail=true;mesh.userData.siteRange=[detailDistance,Infinity];root.add(mesh);}else tree.traverse(o=>{delete o.userData.siteRange;}); }
 build(plan,footprint){const root=new THREE.Group(),items=sitePlan(plan,footprint);root.userData.sitePlan=items;
  for(const a of items){const {kind,x,z,w,d}=a;
   if(['walk','drive','patio','garden','yard','plaza'].includes(kind)){this.surface(root,kind,x,z,w,d,kind==='walk'?.018:kind==='garden'?.012:.006);if(kind==='garden'&&a.border!==false&&w>.3&&d>.3){for(const sign of [-1,1]){this.piece(root,'walk',x+sign*w/2,.015,z,.025,.04,d);this.piece(root,'walk',x,.015,z+sign*d/2,w,.04,.025);}}}
   else if(['security-fence','container','timber','pipes','pallets','dumpster','loading'].includes(kind)){
    this.industrialProps ||= new IndustrialProps(this.materials,this.view.industrialSurfaces);
    if(kind==='security-fence'){const along=a.axis==='x',length=along?w:d,count=Math.max(1,Math.ceil(length/.5)),span=length/count;for(let i=0;i<count;i++){const offset=-length/2+(i+.5)*span;this.industrialProps.place(root,{kind,x:x+(along?offset:0),z:z+(along?0:offset),w:along?span:w,d:along?d:span,height:.44,angle:along?0:Math.PI/2});}}
    else if(kind==='loading'){this.materials.loading ||= this.industrialProps.materials.yellow;for(const side of [-1,1])this.surface(root,'loading',x+side*(w/2-.025),z-d/2+a.markDepth/2,.018,a.markDepth,.024);}
    else this.industrialProps.place(root,a);
   }
   else if(kind==='curb')this.piece(root,'walk',x,.015,z,w,.06,d);
   else if(kind==='fence'){
    this.gardenProps ||= new GardenProps(this.materials);
    const along=a.axis==='x',length=along?w:d,count=Math.max(1,Math.ceil(length/.52)),panel=length/count;
    for(let i=0;i<count;i++){const offset=-length/2+(i+.5)*panel,hedge=a.style==='hedge';this.gardenProps.place(root,hedge?'hedge':a.style||'privacy',{x:x+(along?offset:0),z:z+(along?0:offset),w:panel,d:along?d:w,height:hedge?.32:a.style==='picket'?.18:.36,angle:along?0:Math.PI/2});}
   }
   else if(['shed','pergola','shrub'].includes(kind)){this.gardenProps ||= new GardenProps(this.materials);this.gardenProps.place(root,kind,a);}

   else if(kind==='bench'){for(let i=0;i<4;i++)this.piece(root,'wood',x,.105,z-.07+i*.047,w,.024,.032);for(const side of [-1,1]){this.piece(root,'metal',x+side*w*.35,.05,z,.028,.1,.17);this.piece(root,'metal',x+side*w*.35,.17,z-.11,.025,.23,.025);}for(let i=0;i<3;i++)this.piece(root,'wood',x,.17+i*.038,z-.115,w,.026,.023);}
   else if(kind==='parking'){this.surface(root,'paint',x-w/2,z,.018,d,.022);this.surface(root,'paint',x+w/2,z,.018,d,.022);this.surface(root,'paint',x,z-d/2,w,.018,.023);this.piece(root,'walk',x,.035,z-d/2+.09,w*.65,.065,.06);}
   else if(kind==='rack'){for(const side of [-1,1]){const mesh=new THREE.Mesh(this.rack,this.materials.metal);mesh.position.set(x+side*.14,.025,z);mesh.rotation.y=Math.PI/2;mesh.userData.sharedAsset=true;mesh.userData.siteDetail=true;mesh.castShadow=true;root.add(mesh);}}
   else if(kind==='bin'){this.piece(root,'metal',x,.13,z,w,.25,d);this.piece(root,'wood',x,.27,z,w+.025,.025,d+.025);}
   else if(kind==='tree')this.tree(root,{...a,y:.015});
  }
  return root;
 }
}
