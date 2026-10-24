import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Complete garden props are built once. Every property instances these buffers;
// neither the number of fences nor the number of sheds creates new materials.
export class GardenProps{
 constructor(materials){
  this.materials={...materials};this.models=new Map();
  this.materials.foliage=new THREE.MeshStandardMaterial({name:'garden-leaves',color:'#49613b',roughness:1,vertexColors:true});
  this.materials.foliage.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 gardenPoint;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 gp=vec4(transformed,1.);
    #ifdef USE_INSTANCING
    gp=instanceMatrix*gp;
    #endif
    gardenPoint=(modelMatrix*gp).xyz;`);
   shader.fragmentShader='varying vec3 gardenPoint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 cells=floor(gardenPoint*105.);float leaf=fract(sin(dot(cells,vec3(17.13,41.57,29.39)))*43758.5453);
    float coarse=sin(gardenPoint.x*33.+sin(gardenPoint.z*21.))*sin(gardenPoint.y*37.+gardenPoint.z*17.);
    leaf=mix(leaf,.5,smoothstep(.4,1.4,length(fwidth(gardenPoint*105.))));
    diffuseColor.rgb*=.8+leaf*.32+coarse*.12;`);
  };
  this.materials.foliage.customProgramCacheKey=()=> 'garden-foliage-116';
  this.materials.fence=this.materials.wood.clone();this.materials.fence.name='weathered-garden-fence';this.materials.fence.color.set('#969b8e');

 }
 model(kind){
  if(this.models.has(kind))return this.models.get(kind);
  const parts=new Map(),add=(g,material)=>{if(!parts.has(material))parts.set(material,[]);parts.get(material).push(g);};
  const box=(material,x,y,z,w,h,d)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),material);
  const face=(material,points)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));add(g,material);};
  if(kind==='privacy'||kind==='picket'){
   const count=kind==='privacy'?14:10;
   for(let i=0;i<count;i++){const x=(i+.5)/count-.5;box('fence',x,.45,0,1/count*(kind==='privacy'?.96:.68),.88,.5);if(kind==='picket')box('fence',x,.915,0,1/count*.48,.05,.42);}
   for(const x of [-.48,.48])box('fence',x,.5,0,.04,1,1);
   for(const y of [.24,.68])box('fence',0,y,-.27,1,.09,.35);
  }else if(kind==='shed'){
   box('wood',0,.32,0,.94,.64,.94);
   // Weatherboard reveals, door stiles and roof planes retain a small but
   // legible three-dimensional silhouette instead of a solid coloured cube.
   for(let y=.08;y<.64;y+=.08){box('wood',0,y,.477,.94,.018,.018);for(const x of [-.477,.477])box('wood',x,y,0,.018,.018,.94);}
   box('metal',-.12,.285,.482,.36,.55,.012);
   for(const x of [-.31,.07])box('wood',x,.3,.499,.025,.6,.03);
   box('wood',-.12,.6,.499,.4,.03,.03);box('metal',.012,.3,.524,.016,.025,.025);
   box('metal',.3,.43,.482,.2,.18,.014);
   for(const x of [.19,.41])box('walk',x,.43,.496,.018,.21,.028);
   for(const y of [.33,.53])box('walk',.3,y,.496,.24,.02,.028);
   face('yard',[[-.5,.65,.51],[0,.88,.51],[0,.88,-.51],[-.5,.65,-.51]]);
   face('yard',[[0,.88,.51],[.5,.65,.51],[.5,.65,-.51],[0,.88,-.51]]);
   face('wood',[[-.47,.64,.47],[.47,.64,.47],[0,.86,.47],[0,.86,.47]]);
   face('wood',[[.47,.64,-.47],[-.47,.64,-.47],[0,.86,-.47],[0,.86,-.47]]);
  }else if(kind==='pergola'){
   for(const x of [-.46,.46])for(const z of [-.46,.46])box('wood',x,.42,z,.045,.84,.045);
   for(const x of [-.46,.46])box('wood',x,.84,0,.06,.08,1);
   for(let i=0;i<8;i++)box('wood',0,.9,-.48+i*.96/7,1,.08,.035);
   box('wood',0,.3,0,.52,.04,.35);
   for(const x of [-.19,.19])box('metal',x,.15,0,.025,.3,.25);
   for(const z of [-.3,.3]){box('wood',0,.19,z,.58,.035,.13);for(const x of [-.22,.22])box('metal',x,.09,z,.025,.18,.1);}
  }else if(kind==='shrub'||kind==='hedge'){
   let g;
   if(kind==='hedge'){
    // A continuous, clipped hedge has rounded shoulders and closed ends. Its
    // panels meet without the gaps produced by a row of miniature trees.
    const ring=[[-.5,.1],[-.5,.68],[-.38,.9],[0,1],[.38,.9],[.5,.68],[.5,.1],[0,0]],p=[],indices=[];
    for(let i=0;i<=8;i++)for(let j=0;j<8;j++){const [z,y]=ring[j],ruff=i===0||i===8?0:Math.sin(i*17.3+j*29.1)*.028;p.push(i/8-.5,Math.max(0,Math.min(1,y+ruff)),Math.max(-.5,Math.min(.5,z+ruff)));}
    for(let i=0;i<8;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+(j+1)%8,d=(i+1)*8+j;indices.push(a,b,c,a,c,d);}
    for(let j=1;j<7;j++){indices.push(0,j+1,j,64,64+j,65+j);}
    g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(Array(p.length/3*2).fill(0),2));
   }else{
    g=new THREE.SphereGeometry(.5,12,8).translate(0,.5,0);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i),jitter=1+Math.sin(p.getX(i)*53+p.getZ(i)*79+y*31)*.045;p.setXYZ(i,Math.max(-.5,Math.min(.5,p.getX(i)*jitter)),y,Math.max(-.5,Math.min(.5,p.getZ(i)*jitter)));}g.computeVertexNormals();
   }
   const p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const shade=.65+p.getY(i)*.28+Math.sin(p.getX(i)*77+p.getZ(i)*53)*.045;colors.push(shade*.92,shade,shade*.85);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));add(g,'foliage');

  }
  const root=new THREE.Group();for(const [name,list]of parts){const geometry=mergeGeometries(list,false);list.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,this.materials[name]);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={sharedAsset:true,siteDetail:true,gardenProp:kind};root.add(mesh);}this.models.set(kind,root);return root;
 }
 place(root,kind,{x,z,w,d,height,angle=0}){const model=this.model(kind).clone(true);model.position.set(x,.02,z);model.scale.set(w,height,d);model.rotation.y=angle;root.add(model);return model;}
}
