import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {Roadworks} from '../dist/roadworks.js';
import {batchStatic} from '../dist/static-batch.js';
import {annotatePaintRibbon,fitPaintRibbon,createPaintMaterial,paintCoverage,PAINT_MAX_EXPANSION} from '../dist/road-paint.js';

const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function view(){const materials=new Map();return {materials,scene:new T.Scene(),unitBox:new T.BoxGeometry(),night:false,
 mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.78}));return materials.get(color);}};}
function physical(geometry){return {index:geometry.index?.array.slice(),attributes:Object.fromEntries(Object.entries(geometry.attributes).filter(([name])=>name!=='roadPaint').map(([name,a])=>[name,{itemSize:a.itemSize,array:a.array.slice()}]))};}
function release(roads){roads.clear();roads.lampMaterial.dispose();roads.walkMaterial.dispose();roads.lightPoolMaterial.dispose();roads.v.unitBox.dispose();for(const m of roads.v.materials.values())m.dispose();}

test('pixel-integrated paint preserves physical coverage for both nearby and subpixel widths',()=>{
 for(const [half,pixel]of [[1,.01],[.02,.1],[.014,.2],[.06,.02]]){
  const extent=half+pixel,step=extent/2000;let area=0;
  for(let x=-extent+step/2;x<extent;x+=step){const coverage=paintCoverage(x,half,pixel);assert.ok(coverage>=0&&coverage<=1);close(coverage,paintCoverage(-x,half,pixel));area+=coverage*step;}
  close(area,half*2,2e-6);assert.equal(paintCoverage(extent,half,pixel),0);
 }
 assert.equal(paintCoverage(0,1,.01),1);close(paintCoverage(1,1,.01),.5);close(paintCoverage(0,.02,.1),.4);
 assert.equal(paintCoverage(NaN,1,1),0);assert.equal(paintCoverage(0,0,1),0);assert.equal(paintCoverage(.2,1,0),1);
});

test('paint support metadata leaves physical geometry exact through bounded surface refinement',()=>{
 const roads=new Roadworks(view()),points=[{x:0,z:0},{x:1,z:.25},{x:2,z:.8},{x:3,z:1.3}],source=roads.v.mat('#ddd');roads.height=()=>0;
 roads.paintHeight=(_w,x,z)=>.1+.004*Math.sin(x*8)+z*.025;
 const baseline=roads.ribbon({},points,.04,.2,source),current=roads.ribbon({},points,.04,.2,source),before=physical(current.geometry);
 assert.equal(annotatePaintRibbon(current.geometry),true);assert.deepEqual(physical(current.geometry),before);
 roads.conformMarking({},baseline.geometry);roads.conformMarking({},current.geometry);
 assert.deepEqual(physical(current.geometry),physical(baseline.geometry));
 const attr=current.geometry.attributes.roadPaint,p=current.geometry.attributes.position;
 assert.equal(attr.count,p.count);assert.ok(attr.count>before.attributes.position.array.length/3,'fixture exercises actual conformance subdivisions');
 assert.ok([...attr.array].every(Number.isFinite));assert.ok(attr.count<=before.attributes.position.array.length/3*128);
 for(let i=0;i<attr.count;i++)assert.ok(Math.abs(attr.getW(i))<=1);
 assert.ok([...attr.array].some((value,i)=>i%4===3&&Math.abs(value)<1),'interior vertices retain interpolated signed coordinates');
 const physicalSphere=new T.Sphere();new T.Box3().setFromBufferAttribute(p).getBoundingSphere(physicalSphere);
 const raw=current.geometry.clone();raw.computeBoundingSphere();close(current.geometry.boundingSphere.radius,raw.boundingSphere.radius+PAINT_MAX_EXPANSION);raw.dispose();
 release(roads);
});

test('support half-vectors follow the final cross-slope without changing any edge',()=>{
 const roads=new Roadworks(view());roads.height=()=>0;
 const mesh=roads.ribbon({},[{x:0,z:0},{x:2,z:0}],.04,0,roads.v.mat('#ddd'));annotatePaintRibbon(mesh.geometry);
 const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getZ(i)*.2);
 const before=physical(mesh.geometry);fitPaintRibbon(mesh.geometry);assert.deepEqual(physical(mesh.geometry),before);
 const a=mesh.geometry.attributes.roadPaint;for(let i=0;i<a.count;i+=2){close(a.getY(i),.004);close(a.getY(i+1),.004);close(a.getZ(i),.02);assert.equal(a.getW(i),-1);assert.equal(a.getW(i+1),1);}
 release(roads);
});

test('static paint batches retain support data, shadows, culling margin, and cached material identity',()=>{
 const roads=new Roadworks(view());roads.height=()=>0;roads.paintHeight=()=>.1;const source=roads.v.mat('#ddd'),before=source.toJSON();let sourceDisposed=0,paintDisposed=0;source.addEventListener('dispose',()=>sourceDisposed++);
 for(let i=0;i<12;i++)roads.paint({},[{x:i,z:0},{x:i+.8,z:0}],.028,0,source);
 const material=roads.group.children[0].material;material.addEventListener('dispose',()=>paintDisposed++);
 assert.equal(roads.paintMaterials.size,1);assert.equal(new Set(roads.group.children.map(m=>m.material)).size,1);assert.notEqual(material,source);assert.deepEqual(source.toJSON(),before);
 assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);assert.equal(material.transparent,true);assert.equal(material.polygonOffset,false);
 batchStatic(roads.group,roads.v.unitBox);assert.equal(roads.group.children.length,1);
 const mesh=roads.group.children[0];assert.equal(mesh.material,material);assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.geometry.attributes.roadPaint.count,mesh.geometry.attributes.position.count);
 const raw=mesh.geometry.clone();raw.computeBoundingSphere();close(mesh.geometry.boundingSphere.radius,raw.boundingSphere.radius+PAINT_MAX_EXPANSION);raw.dispose();
 roads.clear();assert.equal(paintDisposed,1);assert.equal(sourceDisposed,0);assert.equal(roads.paintMaterials.size,0);roads.clear();assert.equal(paintDisposed,1);
 roads.paint({},[{x:0,z:0},{x:1,z:0}],.028,0,source);assert.notEqual(roads.group.children[0].material,material);release(roads);
});

test('paint shader retains shared appearance and updates one viewport uniform without material churn',()=>{
 const source=new T.MeshStandardMaterial({color:'#ece5d0',roughness:.6,opacity:.8}),before=source.toJSON(),material=createPaintMaterial(source);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader,{});
 const uniform=shader.uniforms.roadPaintResolution,value=uniform.value;
 const renderer={getCurrentViewport:v=>v.set(0,0,1600,900)};for(let i=0;i<50;i++)material.onBeforeRender(renderer);
 assert.equal(shader.uniforms.roadPaintResolution,uniform);assert.equal(uniform.value,value);assert.deepEqual(value.toArray(),[1600,900]);
 material.onBeforeRender({getCurrentViewport:v=>v.set(0,0,0,0)});assert.deepEqual(value.toArray(),[1,1]);
 assert.match(shader.vertexShader,/paintC\.w>0\.0001/);assert.match(shader.vertexShader,/min\(64\.0,1\.\+0\.50\/paintHalf\)/);assert.match(shader.vertexShader,/cross\(normal,roadPaint\.xyz\)/);
 assert.match(shader.fragmentShader,/fwidth\(vRoadPaint\.x\)/);assert.match(shader.fragmentShader,/diffuseColor\.a\*=paintCoverage/);
 assert.equal(material.color.getHex(),source.color.getHex());assert.equal(material.roughness,source.roughness);assert.equal(material.opacity,source.opacity);assert.deepEqual(source.toJSON(),before);
 material.dispose();source.dispose();
});

test('static batching rotates and scales paint support vectors without translating them',()=>{
 const roads=new Roadworks(view());roads.height=()=>0;roads.paintHeight=()=>.1;
 const mesh=roads.paint({},[{x:0,z:0},{x:2,z:0}],.04,0,roads.v.mat('#ddd'));mesh.position.set(11,3,-5);mesh.rotation.y=Math.PI/3;mesh.scale.set(2,1,.7);mesh.updateMatrixWorld(true);
 const a=mesh.geometry.attributes.roadPaint,index=mesh.geometry.index,linear=new T.Matrix3().setFromMatrix4(mesh.matrixWorld),expected=[];
 for(let i=0;i<(index?.count||a.count);i++){const k=index?index.getX(i):i,v=new T.Vector3(a.getX(k),a.getY(k),a.getZ(k)).applyMatrix3(linear);expected.push([v.x,v.y,v.z,a.getW(k)]);}
 batchStatic(roads.group,roads.v.unitBox);const result=roads.group.children[0].geometry.attributes.roadPaint;
 assert.equal(result.count,expected.length);for(let i=0;i<result.count;i++){close(result.getX(i),expected[i][0]);close(result.getY(i),expected[i][1]);close(result.getZ(i),expected[i][2]);assert.equal(result.getW(i),expected[i][3]);}
 assert.ok(expected.every(p=>Math.hypot(...p.slice(0,3))<.02),'translation does not enter a support direction');release(roads);
});
