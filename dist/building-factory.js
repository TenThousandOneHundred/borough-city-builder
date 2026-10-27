import {ModelLibrary} from './model-library.js?v=137';
import {buildHouse} from './house-architecture.js?v=137';
import {buildUrban} from './city-architecture.js?v=137';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import * as THREE from './vendor/three.module.js';
import {MeshBuilder} from './mesh-builder.js?v=137';
import {BuildingMaterials} from './building-materials.js?v=137';
import {lotPlan} from './building-plan.js?v=137';
import {floorHeight} from './landscape.js?v=137';

export class BuildingFactory{
 constructor(view){this.view=view;this.library=view.renderer?new ModelLibrary(view):null;this.ready=this.library?.ready||Promise.resolve();this.materials=new BuildingMaterials(view);this.batchRoot=new THREE.Group();view.scene.add(this.batchRoot);}
 detailGeometryBounds(geometry){
  // Lot trees reuse a small set of detailed meshes. Scan their local vertices
  // once, then transform the exact same box for each independent instance.
  // Attribute replacement and GPU-buffer revisions invalidate the local box.
  this.detailBoundsCache ||= new WeakMap();
  const position=geometry.attributes.position,data=position.isInterleavedBufferAttribute?position.data:position,array=data.array,version=data.version;
  let cached=this.detailBoundsCache.get(geometry);
  if(!cached||cached.position!==position||cached.array!==array||cached.version!==version||cached.count!==position.count||cached.itemSize!==position.itemSize||cached.normalized!==position.normalized||cached.stride!==data.stride||cached.offset!==position.offset){
   cached={position,array,version,count:position.count,itemSize:position.itemSize,normalized:position.normalized,stride:data.stride,offset:position.offset,box:new THREE.Box3().setFromBufferAttribute(position)};this.detailBoundsCache.set(geometry,cached);
  }
  return cached.box;
 }
 collectBuilding(root){
  const immutable=root.userData.renderImmutable,pose=immutable?[...root.position.toArray(),...root.quaternion.toArray(),...root.scale.toArray(),root.userData.renderVersion||0].join(','):null;
  const cached=immutable&&this.renderCache.get(root);
  if(cached&&cached.pose===pose){this.cacheHits++;return cached;}
  this.cacheMisses++;root.updateMatrixWorld(true);
  const entry={pose,instances:[],statics:[],temporary:!immutable};
  const sphere=root.userData.asset?new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere()):null;
  if(sphere)sphere.lodDistance=root.userData.lodDistance;
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(root.userData.asset&&o.userData.sharedAsset){
    const detailBounds=o.userData.siteRange?this.detailGeometryBounds(o.geometry).clone().applyMatrix4(o.matrixWorld).getBoundingSphere(new THREE.Sphere()):null;
    entry.instances.push({key:o.geometry.uuid+':'+o.material.uuid,geometry:o.geometry,material:o.material,transform:{matrix:o.matrixWorld.clone(),sphere,detailBounds,renderRange:o.userData.siteRange,rangeOrigin:o.userData.siteRange?new THREE.Vector3().setFromMatrixPosition(o.matrixWorld):null}});
   }else entry.statics.push({material:o.material,geometry:o.geometry.clone().applyMatrix4(o.matrixWorld)});
  });
  if(immutable)this.renderCache.set(root,entry);
  return entry;
 }
 instanceMesh(previous,geometry,material,count){
  if(previous&&previous.geometry===geometry&&previous.material===material&&previous.instanceMatrix.count>=count)return previous;
  if(previous){this.batchRoot.remove(previous);previous.dispose();}
  const capacity=Math.max(4,2**Math.ceil(Math.log2(count))),mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData.sharedAsset=true;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;this.batchRoot.add(mesh);return mesh;
 }
 uploadRange(mesh,first,last){
  if(last<=first)return;
  const attribute=mesh.instanceMatrix;
  // Reflection and main-view rendering may not consume every batch each frame.
  // Preserve pending writes while bounding uploads to populated dirty slots.
  for(const range of attribute.updateRanges){first=Math.min(first,range.start);last=Math.max(last,range.start+range.count);}
  attribute.clearUpdateRanges();attribute.addUpdateRange(first,last-first);attribute.needsUpdate=true;
 }
 rebuild(buildings){
  this.renderCache ||= new WeakMap();this.batchByKey ||= new Map();this.staticByMaterial ||= new Map();this.cacheHits=0;this.cacheMisses=0;
  const entries=[];
  for(const root of buildings.values())if(root.userData.factory)entries.push(this.collectBuilding(root));
  // An unchanged immutable district needs no regrouping, shadow-slot scan or
  // instance-batch allocation. Camera visibility still updates independently.
  if(this.previousEntries?.length===entries.length&&entries.every((entry,i)=>entry===this.previousEntries[i])&&this.previousLods.every(([geometry,lod])=>geometry.userData.lod===lod)){
   this.updateVisibility();return;
  }
  const instances=new Map(),statics=new Map(),temporary=[];
  for(const entry of entries){
   for(const part of entry.instances){if(!instances.has(part.key))instances.set(part.key,{geometry:part.geometry,material:part.material,transforms:[]});instances.get(part.key).transforms.push(part.transform);}
   for(const part of entry.statics){if(!statics.has(part.material))statics.set(part.material,[]);statics.get(part.material).push(part.geometry);if(entry.temporary)temporary.push(part.geometry);}
  }
  // Keep GPU instance storage and slot identities for unaffected material batches.
  // Grow only the batches whose capacity is exceeded; removed batches release it.
  for(const [key,batch]of this.batchByKey)if(!instances.has(key)){for(const mesh of [batch.near,batch.far,batch.shadow])if(mesh){this.batchRoot.remove(mesh);mesh.dispose();}this.batchByKey.delete(key);}
  this.instanceBatches=[];
  for(const [key,{geometry,material,transforms}]of instances){
   const previous=this.batchByKey.get(key),near=this.instanceMesh(previous?.near,geometry,material,transforms.length),lod=geometry.userData.lod;
   let far=null;if(lod)far=this.instanceMesh(previous?.far,lod,material,transforms.length);else if(previous?.far){this.batchRoot.remove(previous.far);previous.far.dispose();}
   // Shadow geometry has stable world membership, independent of camera culling.
   // Zero visible instances keeps this mesh out of colour/reflection draws.
   // Three uploads its static instance buffer before calling onBeforeShadow.
   near.castShadow=false;if(far)far.castShadow=false;
   // Authored industrial silhouettes avoid noisy subpixel roof-rib shadows.
   const casters=transforms.filter(t=>!t.renderRange||t.renderRange[0]===0),shadow=this.instanceMesh(previous?.shadow,geometry.userData.shadowLod||geometry,material,casters.length);
   shadow.userData.shadowCaster=true;shadow.receiveShadow=false;shadow.count=0;
   let first=Infinity,last=0;const slots=previous?.shadow===shadow?previous.shadowSlots:[];
   casters.forEach((transform,i)=>{if(slots[i]!==transform){shadow.setMatrixAt(i,transform.matrix);slots[i]=transform;first=Math.min(first,i*16);last=(i+1)*16;}});
   this.uploadRange(shadow,first,last);shadow.userData.casterCount=casters.length;
   shadow.onBeforeShadow=()=>{shadow.count=shadow.userData.casterCount;};shadow.onAfterShadow=()=>{shadow.count=0;};
   const batch={near,far,shadow,shadowSlots:slots,transforms,nearSlots:near===previous?.near?previous.nearSlots:[],farSlots:far&&far===previous?.far?previous.farSlots:[]};
   this.batchByKey.set(key,batch);this.instanceBatches.push(batch);
   // Tests and static exporters without a camera receive the complete near set.
   if(!this.view.camera){transforms.forEach(({matrix},i)=>near.setMatrixAt(i,matrix));near.count=transforms.length;this.uploadRange(near,0,transforms.length*16);if(far)far.count=0;}
  }
  for(const [material,batch]of this.staticByMaterial)if(!statics.has(material)){this.batchRoot.remove(batch.mesh);batch.mesh.geometry.dispose();this.staticByMaterial.delete(material);}
  for(const [material,parts]of statics){
   const previous=this.staticByMaterial.get(material);
   if(previous&&previous.parts.length===parts.length&&parts.every((p,i)=>p===previous.parts[i]))continue;
   const geometry=mergeGeometries(parts,false);if(!geometry)continue;geometry.computeBoundingSphere();
   let mesh=previous?.mesh;if(mesh){mesh.geometry.dispose();mesh.geometry=geometry;}else{mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;this.batchRoot.add(mesh);}
   this.staticByMaterial.set(material,{mesh,parts});
  }
  temporary.forEach(g=>g.dispose());
  this.previousEntries=entries;this.previousLods=[...instances.values()].map(({geometry})=>[geometry,geometry.userData.lod]);
  this.visibilitySignature=null;this.updateVisibility();
 }

 updateVisibility(){if(!this.view.camera)return;const camera=this.view.camera;camera.updateMatrixWorld();const signature=camera.matrixWorld.elements.join(',')+camera.projectionMatrix.elements.join(',')+this.view.detailEnabled+':'+this.view.reflectionsEnabled;if(signature===this.visibilitySignature)return;this.visibilitySignature=signature;const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const threshold=this.view.detailEnabled===false?0:18;
  // All material parts of a building share one sphere. Classify it once, then
  // reuse that result for windows, roofs, walls and grounds.
  const visibility=new Map(),reflectionBounds=new THREE.Sphere();this.visibilityChecks=0;this.detailCulled=0;
  for(const batch of this.instanceBatches||[]){const {near,far,transforms}=batch;let nearCount=0,farCount=0,nearFirst=Infinity,nearLast=0,farFirst=Infinity,farLast=0;batch.nearSlots ||= [];batch.farSlots ||= [];
   for(const transform of transforms){const {sphere,matrix}=transform;let state=visibility.get(sphere);
    if(state===undefined){this.visibilityChecks++;let visible=frustum.intersectsSphere(sphere);
     // The reflected camera can see buildings above the main camera's view.
     // Reflect the conservative bounds across the same plane as the river.
     if(!visible&&this.view.reflectionsEnabled!==false&&this.view.detailEnabled!==false){reflectionBounds.copy(sphere);reflectionBounds.center.y=-.2-reflectionBounds.center.y;visible=frustum.intersectsSphere(reflectionBounds);}
     state=!visible?0:camera.position.distanceToSquared(sphere.center)>(this.view.detailEnabled===false?0:(sphere.lodDistance||threshold))**2?2:1;visibility.set(sphere,state);}
    if(!state)continue;if(transform.renderRange){const d=camera.position.distanceToSquared(transform.rangeOrigin),[min,max]=transform.renderRange;if(d<min*min||d>=max*max)continue;
     if(transform.detailBounds&&!frustum.intersectsSphere(transform.detailBounds)){
      // A plane at water y=-.1 reflects each point to y=-.2-y.
      // Keep geometry that can contribute to the reflected camera as well.
      reflectionBounds.copy(transform.detailBounds);reflectionBounds.center.y=-.2-reflectionBounds.center.y;
      if(this.view.reflectionsEnabled===false||this.view.detailEnabled===false||!frustum.intersectsSphere(reflectionBounds)){this.detailCulled++;continue;}
     }
    }const distant=far&&state===2,mesh=distant?far:near,slots=distant?batch.farSlots:batch.nearSlots,index=distant?farCount++:nearCount++;
    if(slots[index]!==transform){mesh.setMatrixAt(index,matrix);slots[index]=transform;if(distant){farFirst=Math.min(farFirst,index*16);farLast=(index+1)*16;}else{nearFirst=Math.min(nearFirst,index*16);nearLast=(index+1)*16;}}
   }
   near.count=nearCount;this.uploadRange(near,nearFirst,nearLast);
   if(far){far.count=farCount;this.uploadRange(far,farFirst,farLast);}
  }
 }
 accepts(tile){return ['residential','commercial','office','industrial'].includes(tile.type)||!!this.library?.acceptsCivic(tile);}
 create(world,index,parcel){
  const asset=this.library?.create(world,index,parcel);if(asset)return asset;
  const p=lotPlan(world,index,parcel),b=new MeshBuilder(),m=(name,t=p.tone)=>this.materials.get(name,t),fh=.64,night=this.view.night;
  const cladding=m(p.style%2===0?'masonry':'plaster'),concrete=m('concrete'),metal=m('metal'),glass=m('glass'),recess=m('recess'),roof=m('roof'),paving=m('paving');
  const W=p.lotWidth,D=p.lotDepth;
  const colorFor=(floor,col,side)=>{let n=(Math.imul(floor+19,73856093)^Math.imul(col+7,19349663)^p.seed^side*83492791)>>>0;n=(n^(n>>>13))>>>0;return[n/4294967296,n%7]};
  const block=(x,z,w,d,floors,y=0,style='masonry')=>{
   const height=floors*fh,wall=style==='glass'?metal:cladding;
   // Inner volume stays behind recessed windows. Outer walls are built from
   // actual piers and spandrels, so reveals cast shadows at every camera range.
   b.box(x,y+height/2,z,w-.11,height,d-.11,recess);
   for(let side=0;side<4;side++){
    const angle=side*Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle),width=side%2?d:w,depth=side%2?w:d;
    const turn=(xx,yy,zz)=>[x+xx*cos+zz*sin,yy,z-xx*sin+zz*cos];
    const bar=(xx,yy,zz,ww,hh,dd,mat)=>{const t=turn(xx,yy,zz);b.box(...t,side%2?dd:ww,hh,side%2?ww:dd,mat)};
    const bays=Math.max(2,Math.round(width/(style==='glass'?.52:.63))),bay=width/bays;
    for(let f=0;f<floors;f++){
     const bottom=y+f*fh,curtain=style==='glass',sill=curtain?.055:.19,top=curtain?.035:.075;
     bar(0,bottom+sill/2,depth/2,width,sill,.08,wall);
     bar(0,bottom+fh-top/2,depth/2,width,top,.08,wall);
     for(let c=0;c<bays;c++){
      const px=-width/2+(c+.5)*bay,ww=bay*(curtain?.94:.69),winH=fh-sill-top;
      bar(-width/2+c*bay,bottom+fh/2,depth/2,curtain?.025:bay-ww,fh,.09,wall);
      const [rnd,blind]=colorFor(f,c,side),pane=night&&rnd<.19?m('lit'):glass,tint=.83+rnd*.17;
      const zface=depth/2-.028;
      b.quad(turn(px-ww/2,bottom+sill,zface),turn(px+ww/2,bottom+sill,zface),turn(px+ww/2,bottom+sill+winH,zface),turn(px-ww/2,bottom+sill+winH,zface),pane,[tint,tint,tint]);
      if(!curtain){bar(px,bottom+sill-.01,depth/2+.025,ww+.075,.025,.095,concrete);bar(px,bottom+sill+winH/2,depth/2+.009,.014,winH,.019,metal);
       if(blind===0)bar(px,bottom+sill+winH*.81,depth/2-.018,ww,winH*.35,.01,m('plaster',(p.tone+2)%5));
      }
     }
     bar(width/2,bottom+fh/2,depth/2,curtain?.025:.07,fh,.09,wall);
    }
   }
   b.box(x,y+height-.03,z,w+.07,.06,d+.07,concrete);
   return y+height;
  };
  const plant=(x,y,z,w,d)=>{b.box(x,y+.08,z,w,.16,d,concrete);b.box(x,y+.2,z,w*.88,.17,d*.88,m('leaves'));};
  const roofwork=(x,y,z,w,d,green=false)=>{
   b.box(x,y+.015,z,w,.03,d,roof);
   for(const s of [-1,1]){b.box(x+s*w/2,y+.08,z,.045,.16,d,concrete);b.box(x,y+.08,z+s*d/2,w,.16,.045,concrete);}
   const count=Math.min(8,Math.max(1,Math.floor(w*d/3.5))),rows=Math.ceil(count/2);
   for(let i=0;i<count;i++){
    const px=x+(i%2-.5)*Math.min(1.2,w*.36),pz=z+(Math.floor(i/2)-(rows-1)/2)*Math.min(.65,d*.48/rows);
    b.box(px,y+.13,pz,.38,.22,.47,metal);b.cylinder(px,y+.25,pz,.125,.035,recess,16);
    for(let k=0;k<4;k++)b.box(px-.12+k*.08,y+.29,pz,.012,.012,.23,metal);
    b.box(px+.28,y+.1,pz,.24,.14,.11,metal);
   }
   b.box(x-w*.29,y+.2,z-d*.27,.45,.38,.52,concrete);
   if(green&&w>2){plant(x+w*.30,y,z+d*.27,.65,.38);plant(x-w*.3,y,z+d*.27,.65,.38);}
  };
  const gable=(x,z,w,d,y,rise)=>{
   const left=[x-w/2,y,z-d/2],right=[x+w/2,y,z-d/2],peak=[x,y+rise,z-d/2],back=[x,y+rise,z+d/2];
   b.quad(left,[x-w/2,y,z+d/2],back,peak,roof);b.quad(peak,back,[x+w/2,y,z+d/2],right,roof);
   b.quad(left,peak,right,left,cladding);b.quad([x+w/2,y,z+d/2],back,[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],cladding);
   for(const s of [-1,1])b.box(x+s*w/2,y,z,.045,.035,d+.06,metal);
  };
  const balcony=(x,z,width,y)=>{
   b.box(x,y,z,width,.035,.32,concrete);
   b.box(x,y+.2,z+.145,width,.018,.018,metal);
   for(let i=0;i<=Math.ceil(width/.18);i++)b.box(x-width/2+i*width/Math.ceil(width/.18),y+.1,z+.145,.013,.2,.013,metal);
  };
  // Lot paving, setback and landscaping use true parcel dimensions.
  const ground=p.low?m('lawn'):paving;
  b.box(0,-.02,0,W-.08,.04,D-.08,ground);
  if(p.low){
   buildHouse(b,p,m,block,gable,plant);
  }else if(p.type==='industrial'){
   const bw=W-.5,bd=D-.9,h=2*fh;block(0,-.2,bw,bd,2,0,'masonry');gable(0,-.2,bw+.1,bd+.15,h,.38);
   for(let j=0;j<3;j++){const x=(j-1)*bw*.28;b.box(x,.48,bd/2-.17,bw*.23,.92,.04,metal);for(let k=0;k<6;k++)b.box(x,.15+k*.13,bd/2-.14,bw*.22,.016,.015,concrete);}
   b.cylinder(-bw*.31,h,-bd*.27,.11,1.1,metal);plant(bw*.32,0,D*.37,.5,.32);
  }else if(p.type==='commercial'&&p.density==='low'){
   const bw=W-.38,bd=D*.64,z=-D*.12,h=block(0,z,bw,bd,p.floors,0,'glass');roofwork(0,h,z,bw,bd);
   for(let j=0;j<4;j++){const x=(j-1.5)*bw/4;b.box(x,.76,z+bd/2+.09,bw/4-.04,.09,.3,m('metal',p.style%5));}
   b.box(0,.92,z+bd/2+.05,bw*.65,.14,.1,m('wood'));plant(-W*.38,0,D*.34,.36,.45);
  }else{
   buildUrban(b,{...p,night},m,roofwork);
  }
  const root=b.finish();root.rotation.y=p.angle;
  let base=floorHeight(world,p.cx,p.cz);for(const dx of [-W/2+.1,W/2-.1])for(const dz of [-D/2+.1,D/2-.1]){const x=p.cx+dx*Math.cos(p.angle)+dz*Math.sin(p.angle),z=p.cz-dx*Math.sin(p.angle)+dz*Math.cos(p.angle);base=Math.max(base,floorHeight(world,x,z));}
  root.position.set(p.cx,base+.035,p.cz);root.userData.plan=p;root.userData.factory=true;return root;
 }
}
