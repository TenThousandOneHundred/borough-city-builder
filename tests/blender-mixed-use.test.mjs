import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {ModelLibrary} from '../dist/model-library.js';
import E from '../dist/engine.js';
import B from '../dist/building-entities.js';
const names=['brick-balcony-mixed-use','sage-balcony-mixed-use'];let loading;
function library(){return loading||=(async()=>{const loader=new GLTFLoader();loader.register(()=>({name:'images',loadTexture:()=>Promise.resolve(new T.Texture())}));const lib=Object.create(ModelLibrary.prototype);Object.assign(lib,{models:[],materials:new Set(),lotGeometry:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),view:{renderer:{capabilities:{getMaxAnisotropy:()=>1}},landscape:{material:()=>new T.MeshStandardMaterial()}}});for(const file of ['urban','industry','modern','mixed-use']){const b=fs.readFileSync(new URL('../dist/assets/buildings/'+file+'.glb',import.meta.url));lib.ingest((await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'')).scene)}return lib})()}

test('Blender mixed-use models retain metre-scale geometry and bounded authored distance detail',async()=>{
 const lib=await library();assert.equal(lib.models.length,93);
 for(const name of names){const a=lib.models.find(a=>a.name===name);assert.equal(a.category,'commercial');assert.equal(a.building,'mixeduse');assert.ok(a.floors>=8&&a.floors<=9);assert.ok(a.size.y>27&&a.size.y<31);assert.ok(a.root.children.length<=11);
 let near=0,far=0;for(const mesh of a.root.children){const g=mesh.geometry,lod=g.userData.lod;assert.ok(lod);near+=g.index.count/3;far+=lod.index.count/3;for(const [key,attr]of Object.entries(g.attributes)){assert.ok(Array.from(attr.array).every(Number.isFinite));assert.equal(lod.attributes[key],attr,'distance model reuses vertex attributes');}assert.ok(Array.from(lod.index.array).every(i=>i<g.attributes.position.count));if(mesh.material.userData.glass&&mesh.material.name.startsWith('modern-'))assert.deepEqual(lod.index.array,new Uint32Array(g.index.array),'every apartment pane survives at a distance');}
 assert.ok(near<15000);assert.ok(far<9000&&far<near*.65);assert.equal(a.streetFronts.filter(f=>f.kind==='shop').length,2);assert.equal(a.streetFronts.filter(f=>f.kind==='entrance').length,1);
 }
});

test('recessed apartment openings, open balconies and shop interiors remain visible in both distance tiers',async()=>{
 const lib=await library();
 for(const name of names){const a=lib.models.find(a=>a.name===name),root=a.root.clone(true),width=name===names[0]?24:18,front=name===names[0]?9.5:8,bays=Math.max(2,Math.round((width/2-3.4)/3)),windowX=-width/2+(width/2-3.4)/bays/2;
 root.updateMatrixWorld(true);const ray=(x,y)=>new T.Raycaster(new T.Vector3(x+a.origin.x,y+a.origin.y,40+a.origin.z),new T.Vector3(0,0,-1)).intersectObject(root,true);
 const check=()=>{
  const side=new T.Raycaster(new T.Vector3(40+a.origin.x,1.8+a.origin.y,front-1.0+a.origin.z),new T.Vector3(-1,0,0)).intersectObject(root,true);assert.equal(side[0].object.material.name,'mixed-shop-glass','corner retail has outward-facing glazing');assert.ok(side.some(hit=>hit.object.material.name==='mixed-shop-interior'));
  if(name===names[0]){assert.equal(ray(1.85,1.8)[0].object.material.name,'mixed-stone','narrow retail openings retain stone piers');assert.equal(ray(3.0416667,1.8)[0].object.material.name,'mixed-shop-glass','narrow retail opening remains glazed');}
  assert.equal(ray(-2.5,9.55)[0].object.material.name,'mixed-stone','balcony recess uses the gray facade from the reference');
  const window=ray(windowX+.2,5.35)[0];assert.ok(window.object.material.name.startsWith('modern-glass'));assert.ok(Math.abs(window.point.z-a.origin.z-(front-.16))<.002);const frame=ray(windowX+.62,5.35)[0];assert.equal(frame.object.material.name,'mixed-window-frames');assert.ok(frame.point.z>window.point.z);const balcony=ray(-1.85,7.45)[0];assert.ok(balcony.object.material.name.startsWith('modern-glass'),'open railing reveals recessed balcony door');assert.ok(Math.abs(balcony.point.z-a.origin.z-(front-1.21))<.002);const shop=ray(-(width/2+1.25)/2+.3,1.8);assert.equal(shop[0].object.material.name,'mixed-shop-glass');assert.ok(shop[0].object.material.transparent&&shop[0].object.material.opacity<.5);assert.ok(shop.some(hit=>hit.object.material.name==='mixed-shop-interior'),'room behind transparent shop glazing');const door=ray(.3,1.4)[0];assert.equal(door.object.material.name,'modern-glass');};
 check();for(const mesh of root.children)mesh.geometry=mesh.geometry.userData.lod;check();
 }
});

test('ordinary mixed-use zoning grows both Blender forms with stable model selection after saving',async()=>{
 const lib=await library(),w=E.createWorld('Mixed-use growth','plains',8);w.money=1e6;E.place(w,1,23,'power');E.place(w,2,23,'water');
 const cells=[...E.fineZoningLayout(w).values()].filter(p=>p.cx>-74&&p.cx<-10&&p.side===-1&&p.row<4);assert.ok(E.fineZoneCells(w,cells.map(p=>p.id),'residential_mixed').ok);for(let i=0;i<100;i++)E.tick(w);
 const completed=Object.values(w.development.parcels).filter(p=>p.occupant&&!p.occupant.construction),seen=new Set(),saved=JSON.parse(JSON.stringify(w));assert.ok(completed.length>=4);assert.ok(E.valid(saved));
 for(const p of completed){const parcel=B.renderParcel(w,p.id),root=lib.create(w,parcel.index,parcel),copy=B.renderParcel(saved,p.id),again=lib.create(saved,copy.index,copy);seen.add(root.userData.model);assert.equal(root.userData.model,again.userData.model);assert.equal(p.occupant.building,'mixeduse');assert.ok(p.occupant.people>0);assert.ok(root.userData.plan.entranceXs.length);assert.equal(root.children[0].scale.x,root.children[0].scale.y);const local=root.children[0].clone(true);local.updateMatrixWorld(true);const box=new T.Box3().setFromObject(local);assert.ok(box.min.x>=-parcel.oriented.width/2-.001&&box.max.x<=parcel.oriented.width/2+.001);assert.ok(box.min.z>=-parcel.oriented.depth/2-.001&&box.max.z<=parcel.oriented.depth/2+.001);}
 for(const name of names)assert.ok(seen.has(name),name+' selected through actual grown lots');
 for(const p of completed){const parcel=B.renderParcel(w,p.id);parcel.definition={type:'commercial',density:'high',building:'mall',level:1};const root=lib.create(w,parcel.index,parcel);assert.ok(!names.includes(root.userData.model),'apartment-over-shop assets do not become commercial-only malls');}
});

test('Blender apartment windows share stable per-pane lighting attributes across distance changes',async()=>{
 const lib=await library();lib.setNight(true);for(const a of lib.models.filter(a=>names.includes(a.name)))for(const m of a.root.children.filter(m=>m.material.name.startsWith('modern-glass'))){assert.ok(m.material.userData.roomLighting);assert.equal(m.material.userData.roomLightingState.value,1);assert.ok(m.geometry.attributes.windowRoom);assert.equal(m.geometry.userData.lod.attributes.windowRoom,m.geometry.attributes.windowRoom);}lib.setNight(false);
});
