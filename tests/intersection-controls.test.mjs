import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {Traffic} from '../dist/traffic.js';
import {junctionPolicy,setJunctionPolicy} from '../dist/junctions.js';
import {Roadworks} from '../dist/roadworks.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
import * as THREE from '../dist/vendor/three.module.js';
globalThis.CityEngine=E;
function city(){const w=E.createWorld('Independent intersection controls','plains',8);w.money=1e6;for(const x of [6,12])for(let y=20;y<=28;y++)E.place(w,x,y,'road');return w;}
function car(t,j){const points=[{x:j.x-.48,z:j.z-12},{x:j.x-.48,z:j.z+12}];return Object.assign(t.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x:points[0].x,z:points[0].z,heading:0});}
function step(t,seconds){for(let i=0;i<seconds*20;i++)t.update(.05);}
function view(){const materials=new Map(),v={scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(1,1,1),night:false,mat(c){if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c}));return materials.get(c);},disposeGroup(g){g.traverse(o=>{if(o.geometry&&o.geometry!==v.unitBox)o.geometry.dispose();});g.clear();},box(g,x,y,z,w,h,d,color){const mesh=new THREE.Mesh(v.unitBox,v.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);g.add(mesh);return mesh;}};return v;}

test('one crossing stops traffic while another keeps its signal phase, without any renderer',()=>{
 const w=city(),t=new Traffic(w,E);t.trips=[];assert.equal(t.junctions.items.length,2);const [a,b]=t.junctions.items;
 setJunctionPolicy(w,a.id,'stop');setJunctionPolicy(w,b.id,'signals');const stop=car(t,a),signal=car(t,b);let stopped=false,red=false;
 for(let i=0;i<120;i++){t.update(.05);stopped ||= stop.waitReason==='Stop sign';red ||= signal.waitReason==='Red signal';}
 assert.ok(stopped&&red);assert.ok(stop.z>a.z+a.radius||!stop.active,'stop-controlled driver clears on a red phase of the other crossing');assert.ok(signal.z<b.z-b.radius,'signal-controlled driver stays behind the crossing');
 step(t,18);assert.equal(t.completed,2);assert.equal(junctionPolicy(w,a.id),'stop');assert.equal(junctionPolicy(w,b.id),'signals');
});

test('changing controls retains routes, cars and the current crossing reservation',()=>{
 const w=city(),t=new Traffic(w,E);t.trips=[];const j=t.junctions.items[0];setJunctionPolicy(w,j.id,'stop');const a=car(t,j),points=a.points,route=t.junctions.route(points);
 for(let i=0;i<200&&j.owner!==a;i++)t.update(.05);assert.equal(j.owner,a);
 assert.ok(setJunctionPolicy(w,j.id,'signals'));assert.equal(a.points,points);assert.equal(t.junctions.route(points),route);assert.equal(j.owner,a);step(t,12);assert.equal(t.completed,1);
 const before=JSON.stringify(t.agents);t.update(0);assert.equal(JSON.stringify(t.agents),before);
});

test('settings survive verified save, road rebuild and reload while old saves keep their city default',()=>{
 const w=city(),t=new Traffic(w,E),[a,b]=t.junctions.items;w.trafficPolicy='stop';assert.equal(junctionPolicy(w,b.id),'stop');setJunctionPolicy(w,a.id,'signals');
 const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},store=new E.WorldStore(storage);store.save(w);
 const copy=new E.WorldStore(storage).get(w.id),reloaded=new Traffic(copy,E);assert.deepEqual(reloaded.junctions.items.map(j=>j.id),t.junctions.items.map(j=>j.id));assert.equal(junctionPolicy(copy,a.id),'signals');assert.equal(junctionPolicy(copy,b.id),'stop');
 const ids=t.junctions.items.map(j=>j.id);E.place(w,17,23,'road');t.rebuild(w);for(const id of ids)assert.ok(t.junctions.items.some(j=>j.id===id));assert.equal(junctionPolicy(w,a.id),'signals');
 setJunctionPolicy(w,a.id,'default');assert.equal(w.junctionControls,undefined);assert.equal(junctionPolicy(w,a.id),'stop');assert.ok(E.valid(w));
 for(const controls of [null,[],{'junction/0/0':'green'},{'not-a-junction':'stop'},'stop'])assert.equal(E.valid({...w,junctionControls:controls}),false);
 assert.equal(setJunctionPolicy(w,'__proto__','stop'),false);assert.equal(setJunctionPolicy(w,a.id,'free'),false);
});

test('stop signs replace signal heads only at the chosen junction and reuse static batches',()=>{
 const w=city(),t=new Traffic(w,E),[a,b]=t.junctions.items,v=view(),roads=new Roadworks(v);roads.world=w;roads.junctionPlan=roadGeometry(w,E);roads.syncSignals(t);
 assert.deepEqual(roads.controlStats,{signals:8,stops:0});assert.equal(roads.signalBulbs.count,24);
 setJunctionPolicy(w,a.id,'stop');roads.updateSignals(t);assert.deepEqual(roads.controlStats,{signals:4,stops:4});assert.equal(roads.signalBulbs.count,12);assert.ok(roads.signalEntries.every(e=>e.controller===b.id));
 const geometry=roads.signalGroup.children.map(m=>m.geometry),stopMaterial=roads.stopMaterial;for(let i=0;i<100;i++){t.time=i/10;roads.updateSignals(t);}assert.deepEqual(roads.signalGroup.children.map(m=>m.geometry),geometry,'normal frames never rebuild signs');
 setJunctionPolicy(w,b.id,'stop');roads.updateSignals(t);assert.equal(roads.signalBulbs,null);assert.deepEqual(roads.controlStats,{signals:0,stops:8});assert.equal(roads.stopMaterial,stopMaterial);
 setJunctionPolicy(w,a.id,'default');roads.updateSignals(t);assert.deepEqual(roads.controlStats,{signals:4,stops:4});assert.equal(roads.signalBulbs.count,12);
});
