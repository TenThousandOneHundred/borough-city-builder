import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createRoadEarthworks} from '../dist/road-earthworks.js';
import polygonClipping from '../dist/vendor/polygon-clipping.umd.min.js';

function terrain(height=()=>0,size=20,segments=20){
 const g=new T.PlaneGeometry(size,size,segments,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position,c=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));c.push(.5+x*.01,.5+z*.01,.4);}
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
function rectangle(x0,x1,z0,z1,height,kind='asphalt',bottom=null){
 const y=(x,z)=>typeof height==='function'?height(x,z):height;
 const a=[x0,y(x0,z0),z0],b=[x0,y(x0,z1),z1],c=[x1,y(x1,z1),z1],d=[x1,y(x1,z0),z0],p=[a,b,c,a,c,d];
 if(bottom!==null)for(const [v,w]of [[a,b],[b,c],[c,d],[d,a]])p.push(v,[v[0],bottom,v[2]],[w[0],bottom,w[2]],v,[w[0],bottom,w[2]],w);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.flat(),3));const mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.userData.roadSurface=kind;return mesh;
}
function plan({ground=()=>0,roads=[rectangle(-5,5,-1,1,.5)],...options}={}){
 const world={seed:8,elevationRevision:0},p=createRoadEarthworks({world,surfaces:roads,groundHeight:(_w,x,z)=>ground(x,z),...options});return {p,world,roads,ground};
}
const close=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function area(g,index=g.index?.array){const p=g.attributes.position;let total=0;for(let i=0;i<(index?.length??p.count);i+=3){const [a,b,c]=[0,1,2].map(k=>index?index[i+k]:i+k);total+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;}return total;}
function attributeCopies(g){return Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,v.array.slice()]));}
function assertFinite(g){for(const a of Object.values(g.attributes))assert.ok(a.array.every(Number.isFinite));}

test('cut terrain is genuinely removed while outside fragments retain the original plane and attributes',()=>{
 const ground=(x,z)=>2+x*.04+z*.03,{p,world}=plan({ground,roads:[rectangle(-5,5,-1,1,1.5)]}),g=terrain(ground),before=attributeCopies(g),oldIndex=g.index,oldIndices=g.index.array.slice(),saved=JSON.stringify(world);
 p.beginApplication();const result=p.applyToGeometry(g);assert.ok(result.indices.length<oldIndices.length);assert.ok(result.replacement.attributes.position.count>0);
 assert.equal(g.index,oldIndex);assert.deepEqual(g.index.array,oldIndices);for(const [k,v]of Object.entries(before))assert.deepEqual(g.attributes[k].array,v,'natural-grid attributes are immutable');
 close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),2e-4);
 close(p.sample(0,0),1.48);assert.ok(p.sample(0,1.3)<ground(0,1.3));assert.equal(p.sample(8,8),null);assert.equal(p.contains(8,8),false);
 const pos=result.replacement.attributes.position,uv=result.replacement.attributes.uv,color=result.replacement.attributes.color;
 let untouched=0;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);close(uv.getX(i),(x+10)/20);close(uv.getY(i),(10-z)/20);close(color.getX(i),.5+x*.01);close(color.getY(i),.5+z*.01);if(!p.contains(x,z)){close(pos.getY(i),ground(x,z));untouched++;}}
 assert.ok(untouched>0,'clipped boundary cells retain natural outside fragments');assertFinite(result.replacement);assert.equal(JSON.stringify(world),saved);
});

test('mild fill supports the actual footway bottom and blends to untouched terrain',()=>{
 const roads=[rectangle(-5,5,-1,1,.3),rectangle(-5,5,1,1.4,.335,'sidewalk',.285)],{p}=plan({roads}),g=terrain();
 p.beginApplication();const result=p.applyToGeometry(g);close(p.sample(0,1.4),.285);assert.ok(p.sample(0,1.6)>0);assert.ok(p.sample(0,1.6)<.285);assert.equal(result.walls,null);
 const pos=result.replacement.attributes.position;let grounded=0;for(let i=0;i<pos.count;i++)if(Math.abs(pos.getY(i))<1e-6)grounded++;
 assert.ok(grounded>10,'outer shoulder vertices meet the exact original terrain plane');close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),2e-4);
});

test('tall fills and cuts produce solid retaining walls with continuous physical UVs and correct exposed normals',()=>{
 for(const cut of [false,true]){
  const ground=()=>cut?4:0,{p}=plan({ground,roads:[rectangle(-5,5,-1,1,2)]}),g=terrain(ground);p.beginApplication();const result=p.applyToGeometry(g),wall=result.walls;
  assert.ok(wall);assertFinite(wall);const pos=wall.attributes.position,uv=wall.attributes.uv,normal=wall.attributes.normal;assert.equal(pos.count,uv.count);assert.ok(Math.max(...uv.array)>10,'wall UV phase continues along a boundary chain');
  let front=0,cap=0;for(let i=0;i<pos.count;i++){
   if(Math.abs(normal.getY(i))<.1)close(uv.getY(i),pos.getY(i));
   if(Math.abs(normal.getY(i))>.9)cap++;
   if(Math.abs(pos.getZ(i)-1.12)<1e-5&&Math.abs(normal.getZ(i))>.9){close(normal.getZ(i),cut?-1:1);front++;}
   assert.ok(pos.getY(i)>=Math.min(1.98,ground())-1e-6&&pos.getY(i)<=Math.max(1.98,ground())+1e-6);
  }
  assert.ok(front>0);assert.ok(cap>0,'retaining walls include solid caps');
  for(let i=0;i<pos.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pos,i),b=new T.Vector3().fromBufferAttribute(pos,i+1),c=new T.Vector3().fromBufferAttribute(pos,i+2),size=b.sub(a).cross(c.sub(a)).length();if(size<1e-8)continue;const u=uv.getX(i+1)-uv.getX(i),v=uv.getY(i+1)-uv.getY(i),s=uv.getX(i+2)-uv.getX(i),t=uv.getY(i+2)-uv.getY(i);assert.ok(Math.abs(u*t-v*s)>1e-9,'every visible wall face has two-dimensional UVs for normal mapping');}
 }
});

test('actual upward concrete cover hides only covered dry shoulders and survives source disposal',()=>{
 const road=rectangle(-5,5,-1,1,2),concrete=rectangle(-5,5,-1.06,1.06,1.99),downward=rectangle(-5,5,-1.1,1.1,1.8);const a=downward.geometry.attributes.position.array;for(let i=0;i<a.length;i+=9)for(let k=0;k<3;k++)[a[i+3+k],a[i+6+k]]=[a[i+6+k],a[i+3+k]];
 const {p}=plan({roads:[road],structuralSurfaces:[concrete,downward]}),g=terrain();p.beginApplication();const result=p.applyToGeometry(g),pos=result.replacement.attributes.position;
 assert.equal(p.stats.fallback,false);close(result.removedCoreArea,21.2,3e-4);close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),3e-4);
 for(let i=0;i<pos.count;i+=3){const x=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,z=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;assert.ok(!(x>-4.999&&x<4.999&&Math.abs(z)<1.059),'soil cannot intersect the actual concrete cover');}
 close(p.sample(0,1.04),1.97);close(p.sample(0,1.09),1.98);assert.ok(result.walls,'uncovered support remains complete outside concrete');assert.equal(p.sample(6,0),null,'concrete cannot create a corridor outside the existing construction');
 concrete.geometry.dispose();concrete.geometry.attributes.position.array.fill(999);const rebuilt=p.rebuild();rebuilt.beginApplication();const again=rebuilt.applyToGeometry(g);close(again.removedCoreArea,result.removedCoreArea);assert.deepEqual(again.replacement.attributes.position.array,result.replacement.attributes.position.array);
 const wet=plan({roads:[road],structuralSurfaces:[rectangle(-8,8,-4,4,2)],bridgePlan:{spans:[{wetStart:4,wetEnd:6,points:[{x:-5,z:0,width:2,distance:0},{x:5,z:0,width:2,distance:10}]}]},wetness:(_w,x)=>Math.abs(x)<1?.5:0}).p;wet.beginApplication();wet.applyToGeometry(g);assert.equal(wet.sample(0,0),null);assert.equal(wet.contains(0,0),false,'concrete cover cannot create a wet-span dam');
});

test('bridge wet intervals and protected occupied parcels remain untouched and cannot become filled dams',()=>{
 const ground=()=>0,roads=[rectangle(-5,5,-1,1,2)],bridgePlan={spans:[{wetStart:4,wetEnd:6,points:[{x:-5,z:0,width:2,distance:0},{x:5,z:0,width:2,distance:10}]}]},wetness=(_w,x)=>Math.abs(x)<1?.5:0;
 const protectedParcels=[{id:'occupied',polygon:[{x:2,z:-2},{x:3,z:-2},{x:3,z:2},{x:2,z:2}]}],{p}=plan({ground,roads,bridgePlan,wetness,protectedParcels}),g=terrain();p.beginApplication();const result=p.applyToGeometry(g);
 assert.equal(p.sample(0,0),null);assert.equal(p.contains(0,0),false);assert.equal(p.excluded(0,0),false);assert.equal(p.sample(2.5,0),null);assert.equal(p.contains(2.5,0),false);close(p.sample(-3,0),1.98);close(p.sample(4,0),1.98);
 const pos=result.replacement.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);if(Math.abs(x)<.999||x>2.001&&x<2.999)close(y,0);}
 close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),3e-4);
});

test('near/far application respects original terrain holes and walls reappear after a fresh application cycle',()=>{
 const {p}=plan({roads:[rectangle(-5,5,-1,1,2)]}),near=terrain(),far=terrain();
 const original=far.index.array,fp=far.attributes.position,indices=[];for(let i=0;i<original.length;i+=3){const ids=[original[i],original[i+1],original[i+2]];if(ids.reduce((s,n)=>s+fp.getX(n)/3,0)>0)indices.push(...ids);}far.setIndex(indices);
 p.beginApplication();const first=p.applyToGeometry(near),second=p.applyToGeometry(far);assert.ok(first.walls);assert.equal(second.walls,null,'overlapping active ground cannot emit duplicate retaining faces');
 close(area(far,second.indices)+area(second.replacement)+second.removedCoreArea,area(far),2e-4);const pos=second.replacement.attributes.position;for(let i=0;i<pos.count;i++)assert.ok(pos.getX(i)>=-1e-6,'a masked far-terrain hole stays empty');
 p.beginApplication();const again=p.applyToGeometry(near);assert.ok(again.walls);assert.deepEqual(again.walls.attributes.position.array,first.walls.attributes.position.array);assert.deepEqual(again.replacement.attributes.position.array,first.replacement.attributes.position.array);
});

test('surface snapshots survive source disposal, protection rebuilds are independent and disposing a plan does not dispose output',()=>{
 const {p,roads}=plan(),g=terrain();p.beginApplication();const result=p.applyToGeometry(g),copy=result.replacement.attributes.position.array.slice();for(const road of roads){road.geometry.dispose();road.geometry.attributes.position.array.fill(999);}
 const next=p.rebuild({protectedParcels:[{polygon:[{x:-1,z:-2},{x:1,z:-2},{x:1,z:2},{x:-1,z:2}]}]});next.beginApplication();const modified=next.applyToGeometry(g);assert.equal(next.sample(0,0),null);close(p.sample(0,0),.48);close(next.sample(3,0),.48);
 let disposed=false;result.replacement.addEventListener('dispose',()=>disposed=true);p.dispose();assert.equal(disposed,false);assert.deepEqual(result.replacement.attributes.position.array,copy);assert.equal(p.sample(0,0),null);assertFinite(modified.replacement);
});

test('partly covered junction edges retain both outside shoulders without walling across the entering road',()=>{
 const roads=[rectangle(-5,5,-1,1,2),rectangle(-1,1,1,5,2)],{p}=plan({roads}),g=terrain();p.beginApplication();const result=p.applyToGeometry(g);
 close(p.sample(-4,1.06),1.98);close(p.sample(4,1.06),1.98);close(p.sample(0,2),1.98);
 const pos=result.walls.attributes.position;
 for(let i=0;i<pos.count;i+=3){let x=0,z=0;for(let k=0;k<3;k++){x+=pos.getX(i+k)/3;z+=pos.getZ(i+k)/3;}assert.ok(!(Math.abs(x)<.9&&z>.99&&z<1.3),'no retaining face spans the junction entrance; the six-centimetre corner-wall back remains sealed below pavement');}
 close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),3e-4);
});

test('intersecting shoulders on a coarse terrain grid have conforming 3D edges, not just matching endpoint heights',()=>{
 const roads=[rectangle(-4,4,-.6,.6,.25),rectangle(-.6,.6,-4,4,.25)],{p}=plan({roads}),g=terrain(()=>0,12,4);p.beginApplication();const result=p.applyToGeometry(g);assert.equal(result.walls,null);
 const pos=result.replacement.attributes.position,unique=new Map();for(let i=0;i<pos.count;i++){const v=[pos.getX(i),pos.getY(i),pos.getZ(i)];unique.set(v[0]+','+v[2],v);}
 let checks=0;for(let i=0;i<pos.count;i+=3)for(let edge=0;edge<3;edge++){
  const ia=i+edge,ib=i+(edge+1)%3,ax=pos.getX(ia),az=pos.getZ(ia),dx=pos.getX(ib)-ax,dz=pos.getZ(ib)-az,len2=dx*dx+dz*dz;if(len2<1e-12)continue;
  for(const [x,y,z]of unique.values()){const t=((x-ax)*dx+(z-az)*dz)/len2;if(t<1e-5||t>1-1e-5||Math.abs(dx*(z-az)-dz*(x-ax))>1e-6*Math.sqrt(len2))continue;
   close(y,pos.getY(ia)+(pos.getY(ib)-pos.getY(ia))*t,2e-5);checks++;
  }
 }
 const edges=new Map(),k=v=>Math.round(v[0]*1e6)+','+Math.round(v[2]*1e6);
 for(let i=0;i<pos.count;i+=3)for(let edge=0;edge<3;edge++){const a=i+edge,b=i+(edge+1)%3,va=[pos.getX(a),pos.getY(a),pos.getZ(a)],vb=[pos.getX(b),pos.getY(b),pos.getZ(b)],ka=k(va),kb=k(vb),id=ka<kb?ka+'|'+kb:kb+'|'+ka;if(!edges.has(id))edges.set(id,[]);edges.get(id).push([va,vb]);}
 let joined=0;for(const faces of edges.values()){assert.ok(faces.length<=2,'union terrain has no overlapping faces');if(faces.length===2){joined++;const first=new Map(faces[0].map(v=>[k(v),v[1]]));for(const v of faces[1])close(v[1],first.get(k(v)),2e-5);}else for(const v of faces[0])assert.ok(Math.abs(v[1])<2e-5||Math.abs(v[1]-.23)<2e-5,'unpaired terrain edge must meet native ground or the actual road foundation');}
 assert.ok(joined>20,'all interior seams are explicit shared edges; zero remaining T-junctions is valid');close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),2e-4);
});

test('buried road tessellation does not multiply terrain subdivisions',()=>{
 const detailed=new T.PlaneGeometry(10,2,100,8);detailed.rotateX(-Math.PI/2);detailed.translate(0,.25,0);const road=new T.Mesh(detailed,new T.MeshBasicMaterial());road.userData.roadSurface='asphalt';
 const {p}=plan({roads:[road]}),g=terrain();p.beginApplication();const result=p.applyToGeometry(g);
 assert.ok(p.stats.sourceTriangles>=1600);assert.ok(p.stats.patches<100,'road micro-triangles are replaced by the union perimeter');
 assert.ok(result.replacement.attributes.position.count/3<1200,'terrain retains its own resolution beneath opaque pavement');close(p.sample(0,0),.23);close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),2e-4);
});

test('covered core terrain is removed, while exposed ground and exact road-foundation queries remain complete',()=>{
 const g=terrain(),road=rectangle(-5,5,-1,1,(x,z)=>1+Math.abs(x)*.1+z*.02),{p}=plan({roads:[road]});p.beginApplication();const result=p.applyToGeometry(g),pos=result.replacement.attributes.position;
 close(result.removedCoreArea,20,2e-4);close(area(g,result.indices)+area(result.replacement)+result.removedCoreArea,area(g),3e-4);
 for(let i=0;i<pos.count;i+=3){const x=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,z=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;assert.ok(!(x>-4.999&&x<4.999&&z>-.999&&z<.999),'no terrain triangle can protrude through opaque road interiors');}
 // This deliberately queries the source's exact planar foundation, not an
 // interpolated coarse hidden terrain approximation beneath the road.
 close(p.sample(0,0),1.48);close(p.sample(0,1.06),1.5,2e-5);assert.ok(result.walls);
});

test('an unexpected topology failure retains all natural terrain, warns once and can recover on rebuild',()=>{
 const world={seed:52},roads=[rectangle(-5,5,-1,1,1)],g=terrain(),before=attributeCopies(g),saved=JSON.stringify(world),originalUnion=polygonClipping.union,originalWarn=console.warn,warnings=[];let failed;
 try{console.warn=(...args)=>warnings.push(args);polygonClipping.union=()=>{throw new Error('synthetic topology failure');};
  failed=createRoadEarthworks({world,surfaces:roads,groundHeight:()=>0});const second=createRoadEarthworks({world,surfaces:roads,groundHeight:()=>0});assert.equal(failed.stats.fallback,true);assert.equal(second.stats.fallback,true);assert.equal(warnings.length,1);
  failed.beginApplication();const result=failed.applyToGeometry(g);assert.deepEqual(result.indices,Uint32Array.from(g.index.array));assert.equal(result.replacement.attributes.position.count,0);assert.equal(result.walls,null);assert.equal(result.removedCoreArea,0);assert.equal(failed.sample(0,0),null);assert.equal(failed.contains(0,0),false);
  for(const [name,copy]of Object.entries(before))assert.deepEqual(g.attributes[name].array,copy);assert.equal(JSON.stringify(world),saved);
 }finally{polygonClipping.union=originalUnion;console.warn=originalWarn;}
 const recovered=failed.rebuild();assert.equal(recovered.stats.fallback,false);recovered.beginApplication();const result=recovered.applyToGeometry(g);assert.ok(result.removedCoreArea>0);close(recovered.sample(0,0),.98);assert.equal(warnings.length,1);
});

test('protected-parcel relevance uses the whole polygon and the unconstrained road envelope',()=>{
 const {p}=plan({roads:[rectangle(-1,1,-.5,.5,2)]}),poly=points=>points.map(([x,z])=>({x,z}));
 assert.equal(p.mayAffectProtectedParcel(poly([[20,20],[21,20],[21,21],[20,21]])),false);
 assert.equal(p.mayAffectProtectedParcel(poly([[-8,-8],[8,8],[8.1,8],[-7.9,-8]])),true,'a thin rotated parcel crosses the road while all corners are far away');
 assert.equal(p.mayAffectProtectedParcel(poly([[-10,-4],[4,10],[4.1,10],[-9.9,-4]])),false,'an overlapping bounding box alone is insufficient when the entire diagonal parcel is outside the influence radius');
 const parcel=poly([[-.3,1.2],[.3,1.2],[.3,1.4],[-.3,1.4]]),narrowed=p.rebuild({protectedParcels:[{polygon:parcel}]});assert.equal(narrowed.contains(0,1.3),false);assert.equal(narrowed.mayAffectProtectedParcel(parcel),true,'removal remains relevant beyond the currently narrowed retaining cap');
 assert.equal(p.mayAffectProtectedParcel(poly([[-9,-9],[9,-9],[9,9],[-9,9]])),true,'a parcel surrounding the road is relevant even without any edge crossing');
 const widest=plan({roads:[rectangle(-2,2,-1,1,.32)]}).p;
 assert.equal(widest.mayAffectProtectedParcel(poly([[-.2,2.15],[.2,2.15],[.2,2.2],[-.2,2.2]])),true,'the maximum1.15-world soil reach remains relevant');
 assert.equal(widest.mayAffectProtectedParcel(poly([[-.2,2.212],[.2,2.212],[.2,2.3],[-.2,2.3]])),false,'beyond maximum soil reach plus wall thickness, occupancy cannot alter support');
});
