import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const binary=fs.readFileSync(new URL('../dist/assets/buildings/modern.glb',import.meta.url));
const jsonLength=binary.readUInt32LE(12),doc=JSON.parse(binary.subarray(20,20+jsonLength)),binaryStart=28+jsonLength;
const sha=data=>createHash('sha256').update(data).digest('hex');
const viewBytes=v=>binary.subarray(binaryStart+(v.byteOffset||0),binaryStart+(v.byteOffset||0)+v.byteLength);
const industrial=doc.nodes.filter(n=>n.extras.category==='industrial');
const painted=node=>doc.meshes[node.mesh].primitives.find(p=>doc.materials[p.material].name==='modern-painted');
function modelDigest(node,allowPaintUv=false){
 const h=createHash('sha256');h.update(JSON.stringify(node));
 for(const p of doc.meshes[node.mesh].primitives){
  h.update(String(p.material));
  for(const [key,ai]of Object.entries({...p.attributes,indices:p.indices}).sort(([a],[b])=>a.localeCompare(b))){
   if(allowPaintUv&&doc.materials[p.material].name==='modern-painted'&&key==='TEXCOORD_0')continue;
   const a=doc.accessors[ai],v=doc.bufferViews[a.bufferView];
   h.update(key);h.update(JSON.stringify({...a,bufferView:undefined}));h.update(String(v.byteStride||0));h.update(viewBytes(v));
  }
 }
 return h.digest('hex');
}
function values(index){
 const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],width={VEC2:2,VEC3:3,VEC4:4}[a.type];
 const bytes=a.componentType===5126?4:1,read=a.componentType===5126?'readFloatLE':'readInt8',stride=v.byteStride||width*bytes;
 return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>binary[read](binaryStart+(v.byteOffset||0)+(a.byteOffset||0)+i*stride+j*bytes)));
}
function quads(name){
 const p=painted(industrial.find(n=>n.name===name)),positions=values(p.attributes.POSITION),normals=values(p.attributes.NORMAL),uvs=values(p.attributes.TEXCOORD_0);
 assert.equal(positions.length%4,0);assert.equal(positions.length,uvs.length);
 return Array.from({length:positions.length/4},(_,i)=>({p:positions.slice(i*4,i*4+4),n:normals.slice(i*4,i*4+4),uv:uvs.slice(i*4,i*4+4)}));
}
const near=(a,b,tolerance=1e-5)=>Math.abs(a-b)<=tolerance;
const span=(q,axis)=>Math.max(...q.p.map(p=>p[axis]))-Math.min(...q.p.map(p=>p[axis]));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);

test('industrial UV authoring preserves all released geometry, other UVs, materials, images and distant topology',()=>{
 // Compact immutable fingerprints of the Edition 127 assets. CI needs no
 // screenshot directory or copy of the 16 MB released GLB.
 const old=doc.nodes.filter(n=>n.extras.category!=='industrial');assert.equal(old.length,63);assert.equal(industrial.length,5);
 assert.equal(sha(JSON.stringify(old.map(n=>[n.name,modelDigest(n)]))),'572fea76c6940935e8e7490f6349f8401e83612cba98f3af649c512f0bd4a3cb');
 assert.deepEqual(Object.fromEntries(industrial.map(n=>[n.name,modelDigest(n,true)])),{
  'industrial-trade-depot':'bbbbebf656fe3504338a046ad3667ea67a72be4fe0fec6bdec5decf1deb65092',
  'industrial-light-workshop':'2203bb212cc57f18a3d7724c85f45d5aef2a0f2b0ff105a341866b3e48f430e7',
  'industrial-distribution-hall':'0d7ce4e5968939ff5575c7f64bc15eb2c58b28f7152b09b158b5bc8a6b919493',
  'industrial-sawtooth-works':'2ac23cd26d06d9109f7c86e29915f9de67e3adfe7aa3714da41ba744658954c4',
  'industrial-processing-yard':'10d2396e3107f1eaf168f7c6fadb0f36efc2934acba09f7fe2e503e3c4a43569',
 });
 const h=createHash('sha256');h.update(JSON.stringify({materials:doc.materials,textures:doc.textures,samplers:doc.samplers}));
 for(const image of doc.images){h.update(image.mimeType);h.update(viewBytes(doc.bufferViews[image.bufferView]));}
 assert.equal(h.digest('hex'),'a425d3ae6a02ef131bf54276bf48b6ac4249864783d48fb522114ff05cac01bb');
 assert.equal(sha(fs.readFileSync(new URL('../dist/assets/buildings/lod.bin',import.meta.url))),'0ee49ab0d6d16d3dbdf213275ab18dafa1203e1eb48daa839da96d256c45eba4');
 assert.equal(sha(fs.readFileSync(new URL('../dist/assets/buildings/lod.json',import.meta.url))),'63f643bb08867b9a73c70f81645995dd62647615e8e1b132b56c65e7c330257e');
});

test('one metre of industrial paint stays one texture repeat across wall panels and narrow corrugations',()=>{
 let panels=0,ribs=0;
 for(const node of industrial)for(const q of quads(node.name)){
  assert.ok(q.uv.flat().every(Number.isFinite),'every painted UV is finite');
  if(span(q,1)<.1||!q.n.every(n=>n.every((v,i)=>v===q.n[0][i])))continue;
  const n=q.n[0],front=n[0]===0&&n[1]===0&&Math.abs(n[2])===127,side=Math.abs(n[0])===127&&n[1]===0&&n[2]===0;
  if(!front&&!side)continue;
  for(let i=0;i<4;i++){
   assert.ok(near(q.uv[i][0],front?q.p[i][0]:-q.p[i][2]),node.name+' shared horizontal origin');
   assert.ok(near(q.uv[i][1],q.p[i][1]),node.name+' shared vertical origin');
  }
  const width=span(q,front?0:2);if(width>2)panels++;if(width>.02&&width<.06)ribs++;
 }
 assert.ok(panels>100,'broad wall panels are covered');assert.ok(ribs>500,'narrow corrugation faces share their wall coordinates');
});

test('pitched and sawtooth roofs use true plane distances and their raised seams share the same projection',()=>{
 let roofs=0;
 for(const node of industrial)for(const q of quads(node.name)){
  if(span(q,0)<5||span(q,2)<4||span(q,1)<.5||q.n[0][1]<100)continue;
  for(let i=0;i<4;i++)assert.ok(near(distance(q.uv[i],q.uv[(i+1)%4]),distance(q.p[i],q.p[(i+1)%4]),3e-5),node.name+' roof metres');
  roofs++;
 }
 assert.equal(roofs,12,'eight shed planes and four sawtooth planes');
 const qs=quads('industrial-trade-depot'),roof=qs.filter(q=>near(span(q,0),6.75)&&near(span(q,2),8.5)&&near(span(q,1),.8));
 assert.equal(roof.length,2);
 let seams=0;
 for(const q of qs){
  if(!near(span(q,0),6.75)||!near(span(q,2),.045)||Math.min(...q.p.map(p=>p[1]))<4.52)continue;
  const left=q.p.reduce((sum,p)=>sum+p[0],0)<0,r=roof.find(r=>(r.p.reduce((sum,p)=>sum+p[0],0)<0)===left);
  const e1=subtract(r.p[1],r.p[0]),e2=subtract(r.p[3],r.p[0]),du=subtract(r.uv[1],r.uv[0]),dv=subtract(r.uv[3],r.uv[0]);
  assert.ok(near(dot(e1,e2),0));
  for(let i=0;i<4;i++){
   const delta=subtract(q.p[i],r.p[0]),a=dot(delta,e1)/dot(e1,e1),b=dot(delta,e2)/dot(e2,e2);
   for(let j=0;j<2;j++)assert.ok(near(q.uv[i][j],r.uv[0][j]+a*du[j]+b*dv[j],2e-5),'roof strip stays in the underlying plane texture');
  }
  seams++;
 }
 assert.equal(seams,24);
});

test('vessels and vertical or horizontal pipes unwrap continuously in circumference and length metres',()=>{
 function check(name,origin,axis,radius,length,sides){
  const qs=quads(name).filter(q=>q.p.every(p=>{
   const d=subtract(p,origin),along=dot(d,axis),radial=d.map((v,i)=>v-along*axis[i]);
   return (near(along,0)||near(along,length))&&near(Math.hypot(...radial),radius);
  })&&near(span(q,axis.indexOf(1)),length));
  assert.equal(qs.length,sides,name+' complete cylinder');
  for(let i=0;i<sides;i++){
   const q=qs[i],lo=i*Math.PI*2*radius/sides,hi=(i+1)*Math.PI*2*radius/sides;
   assert.ok(near(q.uv[1][0],lo)&&near(q.uv[0][0],hi),'cylinder circumference is not reset on every facet');
   assert.ok(near(q.uv[3][0],hi)&&near(q.uv[2][0],lo));
   assert.ok(near(q.uv[2][1]-q.uv[1][1],length),'axial metres');
   if(i)assert.ok(near(qs[i-1].uv[0][0],q.uv[1][0]),'neighbouring facets meet');
  }
 }
 check('industrial-processing-yard',[9,.35,-9],[0,1,0],2.45,16,24);
 check('industrial-processing-yard',[9,.35,-1],[0,1,0],2.45,12,24);
 check('industrial-light-workshop',[-4.5,4.7,-3.8],[0,1,0],.25,3.5,12);
 check('industrial-light-workshop',[-4.5,8.2,-3.8],[1,0,0],.25,.9,12);
 const yard=quads('industrial-processing-yard'),cone=yard.filter(q=>q.p.every(p=>{
  const radius=Math.hypot(p[0]-9,p[2]+9);
  return (near(p[1],16.35)&&near(radius,2.45))||(near(p[1],17.33)&&near(radius,.12));
 })&&span(q,1)>.9);
 assert.equal(cone.length,24);
 for(let i=0;i<cone.length;i++){
  const q=cone[i];assert.ok(near(distance(q.uv[1],q.uv[2]),distance(q.p[1],q.p[2]),2e-5),'conical lid retains slant metres');
  for(const [a,b]of [[0,1],[2,3]]){
   const ratio=distance(q.uv[a],q.uv[b])/distance(q.p[a],q.p[b]);
   assert.ok(ratio>.999&&ratio<1.01,'lid circumference narrows with its physical radius');
  }
  if(i)for(const [a,b]of [[0,1],[3,2]])assert.ok(distance(cone[i-1].uv[a],q.uv[b])<1e-5,'conical facets share their seam');
 }
 const cap=yard.filter(q=>q.p.every(p=>near(p[1],17.33))&&span(q,0)<.3&&span(q,2)<.3);
 assert.equal(cap.length,24);
 for(const q of cap)for(let i=0;i<4;i++)assert.ok(near(q.uv[i][0],q.p[i][0])&&near(q.uv[i][1],q.p[i][2]),'end caps have planar metre coordinates');
});
