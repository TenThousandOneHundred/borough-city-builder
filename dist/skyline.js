import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Contour-built architecture: one continuous facade around each floor plate.
// Curves are sampled independently of the zoning grid.
export function contour(kind,width,depth){
 const points=[],count=48;
 for(let i=0;i<count;i++){
  const angle=i/count*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
  let x,z;
  if(kind==='lens'){x=c*width/2;z=s*depth/2*(.78+.22*c);}
  else if(kind==='ellipse'){x=c*width/2;z=s*depth/2;}
  else{const power=kind==='soft'?4:7;x=Math.sign(c)*Math.pow(Math.abs(c),2/power)*width/2;z=Math.sign(s)*Math.pow(Math.abs(s),2/power)*depth/2;}
  points.push(new THREE.Vector2(x,z));
 }
 return points;
}
export function sculptedBuilding(a,group,t,seed){
 const office=t.type==='office',housing=t.type==='residential'&&t.density==='high';
 if(!office&&!housing)return false;
 // Preserve a mix of traditional masonry with contemporary architecture.
 if(housing&&seed%4===0)return false;
 const family=(seed>>>3)%4,variant=(seed>>>7)%5;
 const floors=office?10+seed%14:8+seed%12,fh=.46,height=floors*fh;
 const W=family===1?2.85:family===2?2.5:2.3,D=family===1?1.75:2.45;
 const kind=['soft','lens','chamfer','ellipse'][family],outline=contour(kind,W,D);
 const mats=a.sculptedMats ||= {};
 const get=(key,params)=>mats[key] ||= new THREE.MeshPhysicalMaterial(params);
 const cladding=get('stone'+variant,{color:['#c0c4bd','#a4a8a4','#d0d0c6','#7b8585','#b2a48e'][variant],roughness:.72,metalness:.05});
 const band=get('band'+variant,{color:['#d1d4cd','#b9beb7','#d9d9ce','#9ea9a8','#bdb8a9'][variant],roughness:.55,metalness:.12});
 const glass=Array.from({length:4},(_,j)=>get('glass'+variant+'-'+j,{color:new THREE.Color(['#537681','#425d6b','#758a8d','#466a77','#738286'][variant]).multiplyScalar(.94+j*.025),roughness:.18+j*.02,metalness:.58,clearcoat:.7,clearcoatRoughness:.18,envMapIntensity:1.4}));
 const railing=get('railing',{color:'#8aafb3',roughness:.2,metalness:.35,transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide});
 const lit=get('lit',{color:'#b1a080',emissive:'#efc486',emissiveIntensity:.45,roughness:.4});
 const batches=new Map();
 const add=(geo,mat)=>{if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo)};
 function transform(y,expand=0){
  const normalized=y/height;
  const taper=office?1-.18*normalized:1;
  const setback=family===2?(normalized>.78?.79:normalized>.48?.9:1):1;
  return outline.map(p=>new THREE.Vector2(p.x*taper*setback+Math.sign(p.x)*expand,p.y*taper*setback+Math.sign(p.y)*expand));
 }
 function wall(bottom,top,y0,y1,material,skip=1){
  for(let j=0;j<(bottom.length===2?1:bottom.length);j+=skip){const k=(j+skip)%bottom.length,b=bottom[j],c=bottom[k],d=top[k],e=top[j];
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([b.x,y0,b.y,d.x,y1,d.y,c.x,y0,c.y,b.x,y0,b.y,e.x,y1,e.y,d.x,y1,d.y],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));geo.computeVertexNormals();add(geo,material);
  }
 }
 function plate(points,y,thickness,mat){const shape=new THREE.Shape(points);const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});geo.rotateX(Math.PI/2);geo.translate(0,y,0); // local shape Y becomes world Z
  if(!geo.getAttribute('uv'))geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));add(geo,mat);
 }
 // Transparent lobby and canopy anchor the tower to the street.
 const base=.65,ground=transform(0,-.09);
 wall(ground,ground,0,base,glass[2]);plate(transform(0,.14),base,.065,band);
 for(let f=0;f<floors;f++){
  const y=base+f*fh,bottom=transform(f*fh),top=transform((f+1)*fh);
  for(let j=0;j<outline.length;j++){
   const k=(j+1)%outline.length;let room=Math.imul(j+1,374761393)^Math.imul(f+1,668265263)^seed;room=Math.imul(room^(room>>>13),1274126177);const occupied=((room^(room>>>16))>>>0)/4294967296<.18,mat=a.v.night&&occupied?lit:glass[(j*7+f*11+variant)%4];
   wall([bottom[j],bottom[k]],[top[j],top[k]],y+.055,y+fh-.055,mat);
  }
  wall(bottom,top,y,y+.055,office?cladding:band);
  // Balcony slabs follow the contour, with continuous glass balustrades.
  if(!office){const outer=transform(f*fh,.16);plate(outer,y+.045,.055,band);wall(outer,outer,y+.065,y+.24,railing);}
  else if(f%3===0)plate(top,y+fh,.035,cladding);
 }
 // Narrow facade ribs and roof parapet, built in batches for dense cities.
 for(let j=0;j<outline.length;j+=(office?2:6))for(let f=0;f<floors;f++){
  const bottom=transform(f*fh),top=transform((f+1)*fh),p=bottom[j],q=top[j];
  const dir=new THREE.Vector3(q.x-p.x,fh,q.y-p.y),geo=new THREE.BoxGeometry(.015,dir.length(),.02);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()));geo.translate((p.x+q.x)/2,base+(f+.5)*fh,(p.y+q.y)/2);add(geo,band);
 }

 const roof=transform(height);plate(roof,height+base,.06,cladding);wall(roof,roof,height+base,height+base+.15,band);
 for(const [material,geos]of batches){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}}
 a.box(group,-.25,height+base+.17,-.25,.55,.24,.58,'#75817e');
 a.box(group,.45,height+base+.13,.1,.3,.17,.4,'#939d95');
 a.box(group,0,.68,D/2+.14,.9,.065,.55,'#aab2aa');
 for(const x of [-.39,.39])a.box(group,x,.32,D/2+.32,.025,.64,.025,'#9da8a5');
 return true;
}
