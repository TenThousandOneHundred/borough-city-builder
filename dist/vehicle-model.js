import * as THREE from './vendor/three.module.js';
import {MeshBuilder} from './mesh-builder.js?v=158';
import {mergeVertices} from './vendor/BufferGeometryUtils.js';
// One world unit represents five metres: these shapes fit the existing road lanes.
export const VEHICLE_FORMS={
 sedan:{half:.465,width:.187,waist:.19,roof:.305,rear:-.29,rearRoof:-.16,frontRoof:.105,front:.275,wheels:[-.285,.285],radius:.066},
 suv:{half:.49,width:.199,waist:.215,roof:.365,rear:-.405,rearRoof:-.31,frontRoof:.105,front:.29,wheels:[-.30,.30],radius:.075},
 van:{half:.55,width:.205,waist:.22,roof:.435,rear:-.528,rearRoof:-.510,frontRoof:.18,front:.385,wheels:[-.345,.345],radius:.073}
};
const triangle=(builder,a,b,c,material,color=[1,1,1])=>{const data=builder.batch(material),u=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)),v=new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)),n=u.cross(v).normalize();if(n.lengthSq()<.5)return;for(const p of [a,b,c]){data.p.push(...p);data.n.push(n.x,n.y,n.z);data.uv.push(p[0],p[2]);data.c.push(...color);}};
export function buildVehicle(kind,materials){
 const s=VEHICLE_FORMS[kind],b=new MeshBuilder(),{body,glass,rubber,alloy,lamps}=materials,van=kind==='van';
 const light=c=>new THREE.Color(c).toArray();
 const widthAt=z=>{const edge=s.half-Math.abs(z);return s.width*(edge<.025?.80+edge/.025*.16:edge<.065?.96+(edge-.025)/.04*.04:1);};
 const waistAt=z=>s.waist-(z>s.front?(z-s.front)/(s.half-s.front)*.033:z<s.rear?(s.rear-z)/(s.half+s.rear)*.018:0);
 const arch=s.radius+.012,axle=s.radius+.006;
 const lowAt=z=>{let y=kind==='sedan'?.043:.052;for(const wheel of s.wheels){const dz=Math.abs(z-wheel);if(dz<arch)y=Math.max(y,axle+Math.sqrt(arch*arch-dz*dz));}return y;};
 const main=[-s.half,-s.half+.025,-s.half+.065,s.rear,s.front,0,s.half-.065,s.half-.025,s.half].sort((a,b)=>a-b),stations=[...main];
 for(const wheel of s.wheels)for(let i=0;i<=4;i++)stations.push(wheel+Math.cos(i/4*Math.PI)*arch);
 const zs=[...new Set(stations)].sort((a,b)=>a-b),top=z=>{const w=widthAt(z),h=waistAt(z);return [[-w,h-.014,z],[-w*.90,h,z],[w*.90,h,z],[w,h-.014,z]];};
 // The wheel cuts subdivide only the side skins and underside, not the hood.
 for(let i=1;i<main.length;i++){const a=top(main[i-1]),c=top(main[i]);for(let k=0;k<3;k++)b.quad(a[k],c[k],c[k+1],a[k+1],body);}
 for(let i=1;i<zs.length;i++){
  const z0=zs[i-1],z1=zs[i],w0=widthAt(z0),w1=widthAt(z1),lo0=lowAt(z0),lo1=lowAt(z1),hi0=waistAt(z0)-.014,hi1=waistAt(z1)-.014;
  b.quad([-w0,lo0,z0],[w0,lo0,z0],[w1,lo1,z1],[-w1,lo1,z1],body);
  b.quad([w0,lo0,z0],[w0,hi0,z0],[w1,hi1,z1],[w1,lo1,z1],body);
  b.quad([-w0,lo0,z0],[-w1,lo1,z1],[-w1,hi1,z1],[-w0,hi0,z0],body);
 }
 for(const [z,sign]of [[-s.half,-1],[s.half,1]]){const w=widthAt(z),r=[[-w,lowAt(z),z],[w,lowAt(z),z],...top(z).reverse()],center=[0,(lowAt(z)+waistAt(z))/2,z];for(let k=0;k<r.length;k++)triangle(b,center,...(sign>0?[r[k],r[(k+1)%r.length]]:[r[(k+1)%r.length],r[k]]),body);}
 const roofWidth=s.width*(van?.92:.80),beltWidth=s.width*.92;
 // A shallow crowned roof has its own silhouette instead of a rectangular box.
 const roofRing=z=>Array.from({length:7},(_,i)=>{const t=i/6*2-1;return [roofWidth*t,s.roof-.014*t*t,z];});
 const rr=roofRing(s.rearRoof),rf=roofRing(s.frontRoof);
 for(let i=1;i<rr.length;i++)b.quad(rr[i-1],rf[i-1],rf[i],rr[i],body);
 for(const [points,front]of [[rr,false],[rf,true]])for(let i=1;i<points.length;i++){
  const a=[points[i-1][0],s.roof-.014,points[i-1][2]],c=[points[i][0],s.roof-.014,points[i][2]],d=points[i],e=points[i-1];
  if(front){triangle(b,a,c,d,body);triangle(b,a,d,e,body);}else{triangle(b,a,d,c,body);triangle(b,a,e,d,body);}
 }

 // Sloped windshield and rear glass, with physical painted surrounds.
 const window=(outer,mat=glass)=>{
  const center=outer.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/4),[0,0,0]);
  const inner=outer.map(p=>p.map((v,i)=>center[i]+(v-center[i])*.89));
  for(let i=0;i<4;i++)b.quad(outer[i],outer[(i+1)%4],inner[(i+1)%4],inner[i],body);
  b.quad(...inner,mat);
 };
 window([[-beltWidth,waistAt(s.front),s.front],[beltWidth,waistAt(s.front),s.front],[roofWidth,s.roof-.014,s.frontRoof],[-roofWidth,s.roof-.014,s.frontRoof]]);
 if(van){b.quad([beltWidth,s.waist,s.rear],[-beltWidth,s.waist,s.rear],[-roofWidth,s.roof-.014,s.rearRoof],[roofWidth,s.roof-.014,s.rearRoof],body);}
 else window([[beltWidth,waistAt(s.rear),s.rear],[-beltWidth,waistAt(s.rear),s.rear],[-roofWidth,s.roof-.014,s.rearRoof],[roofWidth,s.roof-.014,s.rearRoof]]);
 const middle=van?.06:-.035;
 for(const side of [-1,1]){
  const outer=[[side*beltWidth,waistAt(s.rear),s.rear],[side*beltWidth,waistAt(s.front),s.front],[side*roofWidth,s.roof-.014,s.frontRoof],[side*roofWidth,s.roof-.014,s.rearRoof]];
  const oriented=p=>side>0?[...p].reverse():p;
  // Door glass is split by a real B-pillar. The van retains a solid cargo side.
  if(van){
   b.quad(...oriented([outer[0],[side*beltWidth,s.waist,middle],[side*roofWidth,s.roof-.014,middle],outer[3]]),body);
   window(oriented([[side*beltWidth,s.waist,middle],outer[1],outer[2],[side*roofWidth,s.roof-.014,middle]]));
  }else{
   const top=[side*roofWidth,s.roof-.014,middle],bottom=[side*beltWidth,s.waist,middle];
   window(oriented([outer[0],bottom,top,outer[3]]));window(oriented([bottom,outer[1],outer[2],top]));
  }
  // Mirrors, sill trim, inset handles, bumper strips and a thin door seam.
  b.box(side*(s.width+.017),s.waist+.025,s.frontRoof+.065,.055,.024,.043,body);
  const panel=(y,z,h,d,mat)=>{const x=side*(s.width+.002),p=[[x,y-h/2,z-d/2],[x,y+h/2,z-d/2],[x,y+h/2,z+d/2],[x,y-h/2,z+d/2]];b.quad(...(side>0?p:p.reverse()),mat);};
  panel(.082,0,.012,.38,rubber);
  for(const z of van?[.055]:[-.18,.11])panel(s.waist-.025,z,.008,.039,alloy);
  panel((s.waist+.09)/2,middle,s.waist-.09,.003,rubber);
 }
 if(van){
  // Cargo doors follow the near-vertical tail; the side door has recessed seams.
  const lower=s.rear-.002,upper=s.rearRoof-.002,h=s.roof-.014;
  b.quad([-.0015,s.waist,lower],[-.0015,h,upper],[.0015,h,upper],[.0015,s.waist,lower],rubber);
  b.quad([-.0015,.105,-s.half-.004],[-.0015,s.waist-.012,-s.half-.004],[.0015,s.waist-.012,-s.half-.004],[.0015,.105,-s.half-.004],rubber);
  for(const side of [-1,1]){const x=side*.024,y=s.waist+.034,z=lower+(upper-lower)*(y-s.waist)/(h-s.waist)-.001;b.quad([x-.006,y-.003,z],[x-.006,y+.003,z],[x+.006,y+.003,z],[x+.006,y-.003,z],alloy);}
  const x=roofWidth+.001,z0=s.rearRoof+.05,z1=.025,y0=s.waist+.014,y1=h-.017;
  for(const z of [z0,z1])b.quad([x,y0,z],[x,y1,z],[x,y1,z+.002],[x,y0,z+.002],rubber);
  for(const y of [y0,y1])b.quad([x,y,z0],[x,y+.002,z0],[x,y+.002,z1],[x,y,z1],rubber);
 }
 // Thin swept lenses sit below the hood rather than protruding white boxes.
 for(const side of [-1,1]){
  const z=s.half+.003,y=waistAt(s.half)-.025,x0=s.width*.28,x1=s.width*.78;
  const points=[[side*x0,y-.010,z],[side*x1,y-.006,z-.001],[side*x1,y+.011,z-.001],[side*(x0+.006),y+.009,z]];
  b.quad(...(side>0?points:[...points].reverse()),lamps,light('#697980'));
  const led=[[side*(x0+.008),y-.006,z+.001],[side*(x1-.006),y-.003,z],[side*(x1-.006),y+.001,z],[side*(x0+.008),y-.002,z+.001]];
  b.quad(...(side>0?led:led.reverse()),lamps,light('#e7e8d6'));
  const rear=-s.half-.003,ry=waistAt(-s.half)-.024;
  const tail=[[side*x0,ry-.009,rear],[side*x1,ry-.009,rear],[side*x1,ry+.010,rear],[side*x0,ry+.010,rear]];
  b.quad(...(side<0?tail:tail.reverse()),lamps,light('#a22217'));
 }
 b.box(0,.097,s.half+.003,s.width*.98,.043,.012,rubber);
 for(let j=0;j<3;j++){const y=.087+j*.009,z=s.half+.010;b.quad([-.075,y,z],[.075,y,z],[.075,y+.0025,z],[-.075,y+.0025,z],alloy);}
 b.box(0,.087,s.half+.012,.076,.020,.005,lamps,light('#dddccf'));
 b.box(0,.102,-s.half-.010,.078,.020,.005,lamps,light('#dddccf'));
 for(const side of [-1,1])for(const z of s.wheels){
  const outer=side*(s.width+.014),inner=side*(s.width-.033),radius=s.radius,n=12;
  const point=(x,r,a)=>[x,axle+Math.cos(a)*r,z+Math.sin(a)*r];
  for(let j=0;j<n;j++){
   const a=j/n*Math.PI*2,c=(j+1)/n*Math.PI*2;
   const q=(p0,p1,p2,p3,mat)=>side>0?b.quad(p0,p1,p2,p3,mat):b.quad(p3,p2,p1,p0,mat);
   q(point(inner,radius*.91,a),point(inner,radius*.91,c),point(outer-side*.009,radius,c),point(outer-side*.009,radius,a),rubber);
   q(point(outer-side*.009,radius,a),point(outer-side*.009,radius,c),point(outer,radius*.87,c),point(outer,radius*.87,a),rubber);
   q(point(outer,radius*.87,a),point(outer,radius*.87,c),point(outer,radius*.55,c),point(outer,radius*.55,a),rubber);
   const center=[outer+side*.001,axle,z],p=point(outer+side*.001,radius*.55,a),r=point(outer+side*.001,radius*.55,c);triangle(b,center,...(side>0?[p,r]:[r,p]),alloy);
  }
  for(let j=0;j<5;j++){const a=j/5*Math.PI*2,width=.12,x=outer+side*.002,p=point(x,radius*.14,a-width),q=point(x,radius*.53,a-width),r=point(x,radius*.53,a+width),t=point(x,radius*.14,a+width);if(side>0)b.quad(p,q,r,t,lamps,light('#d6d8d6'));else b.quad(t,r,q,p,lamps,light('#d6d8d6'));}
 }
 const root=b.finish();root.userData.vehicleKind=kind;
 for(const mesh of root.children){
  if(mesh.material===body||mesh.material===rubber){const old=mesh.geometry;old.deleteAttribute('normal');old.deleteAttribute('uv');const geometry=mergeVertices(old,1e-6);geometry.computeVertexNormals();geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));geometry.computeBoundingSphere();mesh.geometry=geometry;old.dispose();}
  mesh.userData.sharedAsset=true;mesh.userData.vehiclePaint=mesh.material===body;mesh.name=mesh.material.name;
 }
 return root;
}
