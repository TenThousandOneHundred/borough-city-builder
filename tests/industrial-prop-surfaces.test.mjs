import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../dist/vendor/three.module.js';
import {IndustrialProps} from '../dist/industrial-props.js';
import {industrialSitePlan} from '../dist/industrial-site-plan.js';
import {BuildingFactory} from '../dist/building-factory.js';

const wood=()=>new T.MeshStandardMaterial({name:'site-wood',color:'#8c806b',roughness:.94});
function planned(kind){
 const form=kind==='timber'?'industrial-sawtooth-works':'industrial-distribution-hall';
 const p={type:'industrial',lotWidth:9.56,lotDepth:9.56,industrialForm:form,entranceXs:[2.77],loadingBays:[{x:-1.72,width:.76}],seed:123};
 const a=industrialSitePlan(p,{minX:-3.824,maxX:3.824,minZ:-4.4,maxZ:-1.8}).find(a=>a.kind===kind);assert.ok(a,kind+' fits at its full planned size');
 return {kind,w:a.angle?a.d:a.w,d:a.angle?a.w:a.d,height:a.height};
}
function placed(props,kind,angle){
 const a=planned(kind),root=new T.Group();props.place(root,{...a,x:13,z:-7,angle,w:angle?a.d:a.w,d:angle?a.w:a.d});root.updateMatrixWorld(true);
 return root.children[0].children.find(m=>m.material.name==='industrial-'+kind);
}
function projectedTriangles(mesh,axis,sign){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,out=[];
 for(let i=0;i<g.index.count;i+=3){
  const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(!ids.every(j=>n.getComponent(j,axis)*sign>.99))continue;
  const points=ids.map(j=>{const v=new T.Vector3().fromBufferAttribute(p,j);return axis===2?new T.Vector3(v.x,v.y,0):new T.Vector3(v.x,v.z,0);});
  const triangle=new T.Triangle(...points);out.push({triangle,area:triangle.getArea(),uv:ids.map(j=>new T.Vector2().fromBufferAttribute(uv,j))});
 }
 return out;
}

test('painted panels and corrugations share metre-scale texture coordinates at actual straight and rotated lot dimensions',()=>{
 const props=new IndustrialProps({wood:wood()});
 for(const kind of ['container','dumpster']){
  for(const angle of [0,Math.PI/2]){
   const mesh=placed(props,kind,angle),g=mesh.geometry,p=g.attributes.position,uv=g.attributes.uv;
   for(let i=0;i<g.index.count;i+=3)for(let edge=0;edge<3;edge++){
    const a=g.index.getX(i+edge),b=g.index.getX(i+(edge+1)%3),pa=new T.Vector3().fromBufferAttribute(p,a).applyMatrix4(mesh.matrixWorld),pb=new T.Vector3().fromBufferAttribute(p,b).applyMatrix4(mesh.matrixWorld);
    const ua=new T.Vector2().fromBufferAttribute(uv,a),ub=new T.Vector2().fromBufferAttribute(uv,b);
    assert.ok(Math.abs(pa.distanceTo(pb)*5-ua.distanceTo(ub))<.00001,kind+' UV edge equals its physical length in metres');
   }
  }
  const mesh=props.model(kind).children.find(m=>m.material.name==='industrial-'+kind);
  for(const [axis,sign]of (kind==='container'?[[2,1],[2,-1],[1,1]]:[[2,1],[2,-1]])){
   const faces=projectedTriangles(mesh,axis,sign),largest=Math.max(...faces.map(f=>f.area)),base=faces.filter(f=>f.area>largest*.99);let samples=0;
   for(const face of faces.filter(f=>f.area<largest*.99)){
    const point=face.triangle.getMidpoint(new T.Vector3()),under=base.find(f=>f.triangle.containsPoint(point));if(!under)continue;
    const bary=under.triangle.getBarycoord(point,new T.Vector3()),expected=new T.Vector2().addScaledVector(under.uv[0],bary.x).addScaledVector(under.uv[1],bary.y).addScaledVector(under.uv[2],bary.z);
    const actual=face.uv.reduce((v,u)=>v.add(u),new T.Vector2()).multiplyScalar(1/3);
    assert.ok(expected.distanceTo(actual)<.00001,kind+' raised rib continues the panel finish at the same surface position');samples++;
   }
   assert.ok(samples>=8,kind+' checks multiple raised ribs against their underlying panel');
  }
 }
 const container=props.model('container').children.find(m=>m.material.name==='industrial-container').geometry;
 assert.equal(container.userData.lod.attributes.uv,container.attributes.uv,'distant panels reuse the same metric texture coordinates');
});

test('bark grain runs along every complete log with axial metres and a physical circumferential wrap',()=>{
 const props=new IndustrialProps({wood:wood()});
 for(const angle of [0,Math.PI/2]){
  const mesh=placed(props,'timber',angle),p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
  assert.equal(p.count,12*22,'all twelve full logs keep both ten-segment rings and their seam vertices');
  for(let start=0;start<p.count;start+=22){
   const ring=Array.from({length:10},(_,i)=>new T.Vector3().fromBufferAttribute(p,start+i).applyMatrix4(mesh.matrixWorld));
   const center=ring.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(.1),meanRadius=ring.reduce((sum,v)=>sum+v.distanceTo(center)*5,0)/ring.length;
   assert.ok(Math.abs(Math.abs(uv.getX(start+10)-uv.getX(start))-2*Math.PI*meanRadius)<.00001,'U wraps the physical log circumference once per metre');
   for(let i=0;i<11;i++){
    const a=start+i,b=a+11,pa=new T.Vector3().fromBufferAttribute(p,a).applyMatrix4(mesh.matrixWorld),pb=new T.Vector3().fromBufferAttribute(p,b).applyMatrix4(mesh.matrixWorld);
    assert.ok(Math.abs(uv.getX(a)-uv.getX(b))<1e-7,'one bark column follows the axis rather than wrapping across it');
    assert.ok(Math.abs(Math.abs(uv.getY(a)-uv.getY(b))-pa.distanceTo(pb)*5)<.00001,'vertical grain uses actual axial metres');
    assert.ok(Math.abs(uv.getY(a)-uv.getY(start))<1e-7,'each cross-section shares one grain position');
   }
  }
 }
});

test('shared photographic maps reach only the intended finishes without recoloring materials or duplicating prop assets',()=>{
 const pack=()=>Object.fromEntries(['map','normalMap','roughnessMap'].map(name=>[name,new T.DataTexture(new Uint8Array([128,128,128,255]),1,1)])),textures={paint:pack(),bark:pack()};
 const props=new IndustrialProps({wood:wood()},textures),fallback=new IndustrialProps({wood:wood()});
 for(const [kind,group]of [['container','paint'],['dumpster','paint'],['timber','bark']]){
  const m=props.materials[kind],original=fallback.materials[kind];for(const slot of ['map','normalMap','roughnessMap'])assert.equal(m[slot],textures[group][slot]);
  assert.deepEqual(m.color.toArray(),original.color.toArray());assert.equal(m.roughness,original.roughness);assert.equal(m.metalness,original.metalness);
  const root=new T.Group(),a=planned(kind);props.place(root,{...a,x:0,z:0});props.place(root,{...a,x:4,z:0});
  assert.equal(root.children[0].children.length,root.children[1].children.length);
  root.children[0].children.forEach((mesh,i)=>{assert.equal(mesh.geometry,root.children[1].children[i].geometry);assert.equal(mesh.material,root.children[1].children[i].material);});
 }
 for(const kind of ['steel','cutwood','dark']){assert.equal(props.materials[kind].map,null);assert.equal(props.materials[kind].normalMap,null);}
 for(const kind of ['container','dumpster','timber']){assert.equal(fallback.materials[kind].map,null);assert.equal(fallback.materials[kind].normalMap,null);}
 assert.doesNotThrow(()=>new IndustrialProps({wood:wood()},{paint:{},bark:{}}));
});

test('filtered endgrain belongs only to shared timber caps and preserves pallet finish, cap buffers and all seventeen prop groups',()=>{
 const props=new IndustrialProps({wood:wood()}),caps=props.model('timber').children.find(m=>m.material.name==='industrial-cutwood'),pallets=props.model('pallets').children.find(m=>m.material.name==='industrial-cutwood');
 assert.equal(caps.material,props.timberEndgrain);assert.equal(pallets.material,props.materials.cutwood);assert.notEqual(caps.material,pallets.material);
 assert.equal(caps.material.name,pallets.material.name);assert.deepEqual(caps.material.color.toArray(),pallets.material.color.toArray());
 for(const key of ['roughness','metalness','alphaTest','transparent','side','depthWrite'])assert.equal(caps.material[key],pallets.material[key]);
 assert.equal(caps.material.map,null);assert.equal(caps.material.normalMap,null);assert.equal(caps.material.roughnessMap,null,'no endgrain image or sampling dependency');
 assert.ok(Object.hasOwn(caps.material.defines,'USE_UV'));assert.equal(pallets.material.defines?.USE_UV,undefined);
 const original={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader},capShader={...original},palletShader={...original};
 caps.material.onBeforeCompile(capShader);pallets.material.onBeforeCompile(palletShader);assert.deepEqual(palletShader,original,'pallet shaders remain unchanged');
 assert.match(capShader.vertexShader,/vBoroughEndgrainSeed/);assert.match(capShader.fragmentShader,/boroughEndgrainCrack/);assert.match(capShader.fragmentShader,/fwidth\(endPhase\)/);assert.match(capShader.fragmentShader,/fwidth\(across\)/);
 assert.notEqual(caps.material.customProgramCacheKey(),pallets.material.customProgramCacheKey());
 const released=JSON.parse(fs.readFileSync(new URL('./fixtures/industrial-props-126.json',import.meta.url))),hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
 for(const [kind,mesh]of [['timber',caps],['pallets',pallets]]){
  const expected=released.models[kind].find(m=>m.material==='industrial-cutwood').near;
  for(const [name,a]of Object.entries(mesh.geometry.attributes))assert.equal(hash(a.array),expected.attributes[name].hash,kind+' '+name+' remains byte-identical');
  assert.equal(hash(mesh.geometry.index.array),expected.index);
 }
 const root=new T.Group();for(const [i,kind]of Object.keys(released.models).entries())props.place(root,{kind,x:i*2,z:0,w:1,d:1,height:1});
 root.userData={factory:true,asset:true,renderImmutable:true};const factory=new BuildingFactory({scene:new T.Scene(),landscape:{assets:{}}});factory.rebuild(new Map([[1,root]]));
 assert.equal(factory.instanceBatches.length,17);assert.equal(factory.instanceBatches.filter(b=>b.far).length,1);
 const second=new T.Group();props.place(second,{...planned('timber'),x:4,z:0});assert.equal(second.children[0].children.find(m=>m.material.name==='industrial-cutwood').material,caps.material,'every timber instance reuses the one endgrain material');
});
