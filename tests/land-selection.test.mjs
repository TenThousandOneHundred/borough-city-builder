import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import * as THREE from '../dist/vendor/three.module.js';
import {LandSelection} from '../dist/land-selection.js';
const L=E.Land;
function world(size=72){return E.createWorld('Land view','river',427,{mapSize:size,progression:'milestones',expansion:true});}
function view(w){const camera=new THREE.PerspectiveCamera(43,1280/720,.2,1800);camera.position.set(-50,40,70);let samples=0;const controls={target:new THREE.Vector3(-20,1,2),maxDistance:420,enableDamping:true,update(){camera.lookAt(this.target);camera.updateMatrixWorld();}};controls.update();return {world:w,camera,controls,scene:new THREE.Scene(),canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})},renderHeight(w,x,z){samples++;return 2+Math.sin(x/30)+Math.cos(z/40);},get samples(){return samples;}};}

test('multiple and disconnected tile purchases are atomic and retain their saved merit receipt',()=>{
 const w=world();E.Progression.advance(w,300);assert.equal(w.land.merits,4);const before=JSON.stringify(w);
 for(const ids of [[],[0,0],[0,9],[0,3],[0,1,2],[NaN]]){assert.equal(L.buyMany(w,ids).ok,false);assert.equal(JSON.stringify(w),before);}
 assert.deepEqual(L.quoteMany(w,[2,8]),{ok:true,cost:4});assert.equal(JSON.stringify(w),before);
 assert.ok(L.buyMany(w,[2,8]).ok);assert.deepEqual(w.land.owned,[2,3,8]);assert.equal(w.land.merits,0);assert.ok(E.valid(w));
 const db=new E.WorldStore({getItem(){return this.value||null;},setItem(k,v){this.value=v;}});db.save(w);const restored=new E.WorldStore(db.storage).get(w.id);assert.deepEqual(restored.land,w.land);E.Progression.advance(restored,300);assert.equal(restored.land.merits,0);
 assert.ok(E.buildRoadPath(restored,[{x:65,y:60},{x:71,y:60}],'street').ok,'a purchased remote edge tile can hold its outside road');
 assert.equal(E.buildRoadPath(restored,[{x:60,y:45},{x:60,y:55}],'street').ok,false,'an unowned gap remains protected');
});
for(const size of [48,72,96])test(`in-world selection picks every ${size}-cell map tile and restores the camera`,()=>{
 const v=view(world(size)),s=new LandSelection(v),camera=v.camera.position.clone(),target=v.controls.target.clone();s.open();v.scene.updateMatrixWorld(true);
 assert.equal(s.cells.length,(size/24)**2);assert.equal(s.group.children.length,3,'only three new draws while the view is open');assert.equal(v.landMode,true);
 assert.equal(s.fill.geometry.index.count,size*size*6);assert.equal(s.fill.geometry.attributes.color.itemSize,4);
 for(const c of s.cells){const p=s.screen(c.id);assert.ok(p.visible);assert.equal(s.pick(p.x,p.y),c.id);assert.ok(c.buildable>=0&&c.buildable<=.2304+1e-10);}
 assert.equal(s.pick(-2000,-2000),null);
 const positions=s.fill.geometry.attributes.position.array.slice(),samples=v.samples;const center=s.cells.at(-1);s.update(new Set([center.id]),center.id);assert.equal(v.samples,samples,'selection and hover never resample terrain');assert.deepEqual(s.fill.geometry.attributes.position.array,positions);
 const colors=s.fill.geometry.attributes.color;assert.ok(colors.getW(center.start)>0);assert.equal(colors.getW(s.cells[L.start(v.world)].start),0,'owned land is not dimmed');
 let disposed=0;s.group.traverse(o=>{o.geometry?.addEventListener('dispose',()=>disposed++);o.material?.addEventListener('dispose',()=>disposed++);});s.close();assert.equal(disposed,6);assert.equal(v.scene.children.length,0);assert.equal(v.landMode,false);assert.deepEqual(v.camera.position,camera);assert.deepEqual(v.controls.target,target);assert.equal(v.controls.maxDistance,420);assert.equal(v.controls.enableDamping,true);s.close();assert.equal(disposed,6);
});
test('narrow viewports fit the landscape without changing normal camera limits',()=>{
 const v=view(world());v.scene.fog=new THREE.FogExp2('#b7c6cc',.00105);v.camera.aspect=390/844;v.camera.updateProjectionMatrix();v.canvas.getBoundingClientRect=()=>({left:0,top:0,width:390,height:844});const s=new LandSelection(v);s.open();v.scene.updateMatrixWorld(true);assert.ok(v.controls.maxDistance>420);assert.ok(v.scene.fog.density<.00105);
 for(const c of s.cells){const p=s.screen(c.id);assert.ok(p.visible);assert.equal(s.pick(p.x,p.y),c.id);}
 s.close();assert.equal(v.controls.maxDistance,420);assert.equal(v.scene.fog.density,.00105);
});

test('purchase panel rolls back a failed save and keeps the same selection for retry',async()=>{
 const {createLandPanel}=await import('../dist/land-panel.js');
 const element=()=>({hidden:false,style:{},children:[],classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v;},append(x){this.children.push(x);},replaceChildren(){this.children=[];},focus(){}});
 const ids=['landPanel','landTileControls','landMerits','landOwned','landSelected','landArea','landCost','buyLand','landReason','landEarn','closeLand','landButton'],nodes=Object.fromEntries(ids.map(id=>[id,element()]));
 const document={getElementById:id=>nodes[id],createElement:element,body:element(),defaultView:{addEventListener(){}},addEventListener(){}};
 const w=world(),v=view(w);v.canvas.addEventListener=()=>{};v.controls.addEventListener=()=>{};E.Progression.advance(w,300);let saved=false,changes=0;
 const p=createLandPanel({document,engine:E,world:()=>w,view:v,save:()=>saved,changed:()=>changes++,toast(){}});p.open();
 nodes.landTileControls.children[2].onclick();nodes.landTileControls.children[8].onclick();assert.equal(nodes.landCost.textContent,'4 merits');assert.equal(nodes.buyLand.disabled,false);
 const before=structuredClone(w.land);nodes.buyLand.onclick();assert.deepEqual(w.land,before);assert.equal(changes,0);assert.equal(nodes.landSelected.textContent,'2 selected');
 saved=true;nodes.buyLand.onclick();assert.deepEqual(w.land.owned,[2,3,8]);assert.equal(w.land.merits,0);assert.equal(changes,1);assert.equal(nodes.landSelected.textContent,'0 selected');assert.equal(nodes.buyLand.disabled,true);assert.ok(E.valid(w));p.close();assert.equal(v.landMode,false);assert.equal(nodes.landPanel.hidden,true);assert.equal(nodes.landTileControls.children.length,0);
});
