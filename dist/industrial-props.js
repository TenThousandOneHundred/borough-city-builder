import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {configureIndustrialPaint,configureIndustrialBark} from './industrial-surfaces.js?v=146';

// Props retain their authored dimensions when placed or turned in a yard.
// Project every metal part in the same metre coordinates so ribs and panels
// sample one continuous finish instead of stretching a whole image per rib.
const paintedMetres={container:[6.1,2.6,2.5],dumpster:[3.25,1.5,1.8]};
function paintUVs(geometry,metres){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,[w,h,d]=metres;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)*w,y=p.getY(i)*h,z=p.getZ(i)*d;
  if(Math.abs(n.getY(i))>.9)uv.setXY(i,x,n.getY(i)>0?-z:z);
  else if(Math.abs(n.getX(i))>.9)uv.setXY(i,n.getX(i)>0?-z:z,y);
  else uv.setXY(i,n.getZ(i)>0?x:-x,y);
 }
}
function timberEndgrain(material){
 const end=material.clone();end.defines={...end.defines,USE_UV:''};
 end.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vBoroughEndgrainSeed;').replace('#include <begin_vertex>',`#include <begin_vertex>
   vec2 logCenter=vec2(position.y-(uv.y-.5)*.26*1.099,position.z+normal.x*(uv.x-.5)*.26*.699);
   vBoroughEndgrainSeed=fract(sin(dot(floor(logCenter*100.+.5),vec2(17.,29.)))*43758.5453);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying float vBoroughEndgrainSeed;
   float boroughEndgrainCrack(vec2 p,vec2 direction,float start){
    float along=dot(p,direction);
    float across=abs(dot(p,vec2(-direction.y,direction.x))+.004*sin(along*23.+start));
    float width=.005,aa=max(fwidth(across),.0001);
    return (1.-smoothstep(width-aa,width+aa,across))*min(1.,width/aa)*smoothstep(start,start+.1,along);
   }
  `).replace('#include <map_fragment>',`#include <map_fragment>
   vec2 endPoint=(vUv-.5)*2.;
   float endSeed=vBoroughEndgrainSeed;
   endPoint+=.035*vec2(sin(endSeed*17.),cos(endSeed*11.));
   float endRadius=length(endPoint),endAngle=atan(endPoint.y,endPoint.x+.000001);
   float endPhase=(endRadius*(1.+.018*sin(endAngle*3.)+.01*sin(endAngle*7.))+.006*sin(endAngle*9.+endRadius*11.)*smoothstep(.03,.2,endRadius))*(8.+5.*endSeed);
   float endAA=max(fwidth(endPhase),.001);
   float endRings=(1.-smoothstep(.065-endAA,.115+endAA,abs(fract(endPhase+.5)-.5)))*(1.-smoothstep(.35,1.1,endAA));
   float endRotation=endSeed*6.2831853;
   vec2 crackPoint=mat2(cos(endRotation),-sin(endRotation),sin(endRotation),cos(endRotation))*endPoint;
   float endCracks=max(boroughEndgrainCrack(crackPoint,vec2(.936,.352),.38),max(boroughEndgrainCrack(crackPoint,vec2(-.789,.614),.63),boroughEndgrainCrack(crackPoint,vec2(-.247,-.969),.76)));
   diffuseColor.rgb*=clamp(1.015-.18*endRings-.045*endRadius-.32*endCracks,.6,1.06);
  `);
 };
 end.customProgramCacheKey=()=> 'borough-timber-endgrain-128';return end;
}
// Original shared props. Complete buffers are reused by every industrial lot.
export class IndustrialProps{
 constructor(materials,textures={}){this.models=new Map();this.materials={...materials};for(const [name,color]of Object.entries({container:'#526f78',timber:'#6e5236',cutwood:'#b69865',steel:'#a1a8a4',dark:'#333b3b',dumpster:'#5d6c52',yellow:'#bfa654'}))this.materials[name]=new T.MeshStandardMaterial({name:'industrial-'+name,color,metalness:name==='steel'?.45:.05,roughness:name==='steel'?.56:.87});
  configureIndustrialPaint(this.materials.container,textures);configureIndustrialPaint(this.materials.dumpster,textures);configureIndustrialBark(this.materials.timber,textures);
  this.timberEndgrain=timberEndgrain(this.materials.cutwood);
  const size=256,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const d=Math.min((x+y)%16,16-(x+y)%16,((x-y)%16+16)%16,16-((x-y)%16+16)%16),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=160;data[i+3]=Math.round(Math.max(0,1-d/.85)*255);}
  const texture=new T.DataTexture(data,size,size);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  this.materials.mesh=new T.MeshStandardMaterial({name:'industrial-chain-link',map:texture,alphaTest:.02,transparent:true,depthWrite:false,side:T.DoubleSide,metalness:.4,roughness:.6});
 }
 model(kind){if(this.models.has(kind))return this.models.get(kind);const parts=new Map();let detail=false;
  const add=(g,material)=>{if(!parts.has(material))parts.set(material,[]);parts.get(material).push({g,detail});};
  const box=(mat,x,y,z,w,h,d)=>{const g=new T.BoxGeometry(w,h,d).translate(x,y,z);if(paintedMetres[kind]&&mat===kind)paintUVs(g,paintedMetres[kind]);add(g,mat);};
  const cylinder=(mat,x,y,z,r,length,axis='x',segments=10,open=false)=>{const g=new T.CylinderGeometry(r,r,length,segments,1,open);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);if(kind==='security-fence')g.scale(1,1,axis==='y'?25:22);if(axis==='x'&&kind==='timber'){
   g.scale(1,1.099,.699);
   // The bark photograph's vertical grain follows the log axis. Circumference
   // uses the mean of the two physical radii of the round placed cross-section.
   if(mat==='timber'){const uv=g.attributes.uv,circumference=Math.PI*r*(1.099*.35+.699*.55)*5,axial=length*1.3*5;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*circumference,uv.getY(i)*axial);}
  }if(axis==='x'&&kind==='pipes')g.scale(1,.740,.474);if(kind==='pipes'&&mat==='dark'){for(let i=0;i<g.index.count;i+=3){const a=g.index.array[i+1];g.index.array[i+1]=g.index.array[i+2];g.index.array[i+2]=a;}for(let i=0;i<g.attributes.normal.array.length;i++)g.attributes.normal.array[i]*=-1;}g.translate(x,y,z);add(g,mat);};
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
  const root=new T.Group();
  for(const [name,list]of parts){
   const geometry=mergeGeometries(list.map(p=>p.g),false);let low=geometry;
   // Most props have exactly the same close and distant triangles. One batch
   // can render both distance bands without duplicate index or instance buffers.
   if(list.some(p=>p.detail)){
    const indices=[];let offset=0;for(const {g,detail}of list){if(!detail)for(const i of g.index.array)indices.push(i+offset);offset+=g.attributes.position.count;}
    low=new T.BufferGeometry();for(const [key,a]of Object.entries(geometry.attributes))low.setAttribute(key,a);low.setIndex(indices);low.computeBoundingSphere();geometry.userData.lod=low;
   }
   list.forEach(({g})=>g.dispose());if(low!==geometry)geometry.userData.shadowLod=low;
   const mesh=new T.Mesh(geometry,kind==='timber'&&name==='cutwood'?this.timberEndgrain:this.materials[name]);mesh.castShadow=mesh.receiveShadow=true;
   mesh.userData={sharedAsset:true,siteDetail:true,industrialProp:kind};
   if(name==='mesh'){mesh.userData.siteRange=[0,24];const empty=new T.BufferGeometry();for(const [key,a]of Object.entries(geometry.attributes))empty.setAttribute(key,a);empty.setIndex([]);geometry.userData.shadowLod=empty;}
   root.add(mesh);
  }
  this.models.set(kind,root);return root;
 }

 place(root,a){const model=this.model(a.kind).clone(true),turned=Math.abs(a.angle||0)>.1;model.position.set(a.x,.02,a.z);model.rotation.y=a.angle||0;model.scale.set(turned?a.d:a.w,a.height||.44,turned?a.w:a.d);root.add(model);return model;}
}
