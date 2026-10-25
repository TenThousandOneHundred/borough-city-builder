import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Original shared props. Complete buffers are reused by every industrial lot.
export class IndustrialProps{
 constructor(materials){this.models=new Map();this.materials={...materials};for(const [name,color]of Object.entries({container:'#526f78',timber:'#6e5236',cutwood:'#b69865',steel:'#a1a8a4',dark:'#333b3b',dumpster:'#5d6c52',yellow:'#bfa654'}))this.materials[name]=new T.MeshStandardMaterial({name:'industrial-'+name,color,metalness:name==='steel'?.45:.05,roughness:name==='steel'?.56:.87});
  const size=256,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const d=Math.min((x+y)%16,16-(x+y)%16,((x-y)%16+16)%16,16-((x-y)%16+16)%16),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=160;data[i+3]=Math.round(Math.max(0,1-d/.85)*255);}
  const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  this.materials.mesh=new T.MeshStandardMaterial({name:'industrial-chain-link',map:texture,alphaTest:.02,transparent:true,depthWrite:false,side:T.DoubleSide,metalness:.4,roughness:.6});
 }
 model(kind){if(this.models.has(kind))return this.models.get(kind);const parts=new Map();let detail=false;
  const add=(g,material)=>{if(!parts.has(material))parts.set(material,[]);parts.get(material).push({g,detail});};
  const box=(mat,x,y,z,w,h,d)=>add(new T.BoxGeometry(w,h,d).translate(x,y,z),mat);
  const cylinder=(mat,x,y,z,r,length,axis='x',segments=10,open=false)=>{const g=new T.CylinderGeometry(r,r,length,segments,1,open);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);if(kind==='security-fence')g.scale(1,1,axis==='y'?25:22);if(axis==='x'&&kind==='timber')g.scale(1,1.099,.699);if(axis==='x'&&kind==='pipes')g.scale(1,.740,.474);if(kind==='pipes'&&mat==='dark'){for(let i=0;i<g.index.count;i+=3){const a=g.index.array[i+1];g.index.array[i+1]=g.index.array[i+2];g.index.array[i+2]=a;}for(let i=0;i<g.attributes.normal.array.length;i++)g.attributes.normal.array[i]*=-1;}g.translate(x,y,z);add(g,mat);};
  if(kind==='security-fence'){
   for(const x of [-.485,.485])cylinder('steel',x,.5,0,.015,1,'y',8);
   for(const y of [.08,.94])cylinder('steel',0,y,0,.011,.97,'x',8);
   const plane=new T.PlaneGeometry(.96,.87).translate(0,.51,0);add(plane,'mesh');
  }else if(kind==='container'){
   box('container',0,.49,0,.98,.95,.98);for(const x of [-.48,.48])for(const z of [-.48,.48])box('steel',x,.5,z,.028,1,.03);
   for(const y of [.025,.96])for(const z of [-.49,.49])box('container',0,y,z,1,.05,.02);
   // Corrugated sides, end doors, locking bars and corner castings.
   detail=true;for(let i=0;i<28;i++)for(const z of [-.495,.495])box('container',-.46+i*.92/27,.5,z,.018,.86,.01);for(let i=0;i<10;i++)box('container',0,.98,-.44+i*.88/9,.94,.02,.025);detail=false;
   for(const x of [-.49,.49]){box('dark',x,.49,0,.012,.86,.018);for(const z of [-.34,-.13,.13,.34])cylinder('steel',x,.49,z,.009,.82,'y',6);}
  }else if(kind==='timber'){
   for(let layer=0;layer<3;layer++)for(let i=0;i<5-layer;i++){const z=(i-(4-layer)/2)*.18,y=.23+layer*.25,r=.13;cylinder('timber',0,y,z,r,.97,'x',10,true);for(const x of [-.486,.486]){const cap=new T.CircleGeometry(r,10);cap.rotateY(x>0?Math.PI/2:-Math.PI/2);cap.scale(1,1.099,.699);cap.translate(x,y,z);add(cap,'cutwood');}}
   for(const x of [-.32,.32])box('wood',x,.045,0,.12,.09,.95);
  }else if(kind==='pipes'){
   for(let layer=0;layer<2;layer++)for(let i=0;i<4-layer;i++){const z=(i-(3-layer)/2)*.23,y=.24+layer*.38,r=.19;cylinder('steel',0,y,z,r,.98,'x',12,true);cylinder('dark',0,y,z,r*.82,.98,'x',12,true);for(const x of [-.49,.49]){const ring=new T.RingGeometry(r*.82,r,12);ring.rotateY(x>0?Math.PI/2:-Math.PI/2);ring.scale(1,.740,.474);ring.translate(x,y,z);add(ring,'steel');}}
   for(const x of [-.3,.3])box('wood',x,.055,0,.12,.11,.98);
  }else if(kind==='pallets'){
   for(const x of [-.25,.25])for(const z of [-.25,.25]){for(const dx of [-.16,.16])box('wood',x+dx,.06,z,.07,.12,.45);for(let i=0;i<4;i++)box('wood',x,.14,z-.18+i*.12,.46,.05,.08);box('cutwood',x,.55,z,.42,.74,.40);for(const dx of [-.13,.13])box('dark',x+dx,.55,z,.018,.76,.41);}
  }else if(kind==='dumpster'){
   box('dumpster',0,.47,0,.94,.75,.90);for(const x of [-.48,.48])box('steel',x,.55,0,.025,.65,.98);box('dark',0,.88,0,1,.07,.98);for(const x of [-.25,.25])box('dark',x,.08,0,.08,.16,.86);
   for(let i=0;i<5;i++)for(const z of [-.46,.46])box('dumpster',-.4+i*.2,.46,z,.025,.62,.03);for(const x of [-.37,.37])box('steel',x,.74,.49,.08,.035,.018);
  }
  const root=new T.Group();for(const [name,list]of parts){const geometry=mergeGeometries(list.map(p=>p.g),false),indices=[];let offset=0;for(const {g,detail}of list){if(!detail)for(const i of g.index.array)indices.push(i+offset);offset+=g.attributes.position.count;g.dispose();}const low=new T.BufferGeometry();for(const [key,a]of Object.entries(geometry.attributes))low.setAttribute(key,a);low.setIndex(indices);low.computeBoundingSphere();geometry.userData.lod=low;geometry.userData.shadowLod=low;const mesh=new T.Mesh(geometry,this.materials[name]);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={sharedAsset:true,siteDetail:true,industrialProp:kind};if(name==='mesh'){mesh.userData.siteRange=[0,24];const empty=new T.BufferGeometry();for(const [key,a]of Object.entries(geometry.attributes))empty.setAttribute(key,a);empty.setIndex([]);geometry.userData.shadowLod=empty;}root.add(mesh);}this.models.set(kind,root);return root;
 }
 place(root,a){const model=this.model(a.kind).clone(true),turned=Math.abs(a.angle||0)>.1;model.position.set(a.x,.02,a.z);model.rotation.y=a.angle||0;model.scale.set(turned?a.d:a.w,a.height||.44,turned?a.w:a.d);root.add(model);return model;}
}
