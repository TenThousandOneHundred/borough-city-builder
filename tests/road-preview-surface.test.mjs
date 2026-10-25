import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {CityView} from '../dist/renderer.js';
import {Roadworks} from '../dist/roadworks.js';
globalThis.CityEngine=E;

function fixture(){
 const world=E.createWorld('Replacement preview surface','plains',8);
 for(const tile of world.tiles)Object.assign(tile,{type:null,ground:'land',level:0});
 world.money=1e7;E.buildRoadPath(world,[{x:18,y:22},{x:24,y:17},{x:30,y:24}],'street');
 const view=Object.create(CityView.prototype);
 Object.assign(view,{world,scene:new T.Scene(),unitBox:new T.BoxGeometry(),materials:new Map(),night:false,previewGroup:new T.Group(),menu:false,
  landscape:{assets:{},material:()=>new T.MeshStandardMaterial()}});
 view.running=false;view.scene.add(view.previewGroup);
 const roads=new Roadworks(view);view.roadworks=roads;roads.outside=()=>{};
 roads.height=(_world,x,z)=>2+.01*x+.02*z;roads.build(world);
 const path=world.roadPaths[0],target={kind:'path',source:path.id,tiles:path.tiles,controls:path.controls};
 const points=E.sampleRoad(path.controls),probes=points.filter((_,i)=>i>0&&i<points.length-1&&i%5===0).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}));
 return {view,roads,world,target,points,probes};
}

test('replacement previews never become driving pavement or leave phantom heights after clearing',()=>{
 const {view,roads,world,target,points,probes}=fixture(),index=roads.surfaces,triangles=index.triangleCount,revision=roads.heightRevision,saved=JSON.stringify(world);
 assert.ok(probes.length>3);const baseline=probes.map(p=>roads.surfaceHeight(p.x,p.z,'asphalt'));assert.ok(baseline.every(Number.isFinite));
 const vehicles=['car','bus'].map(kind=>({mesh:new T.Group(),agent:{active:true,kind,heading:.7}}));
 const assertUnchanged=()=>{
  assert.equal(roads.surfaces,index);assert.equal(index.triangleCount,triangles,'preview triangles are absent from the road surface index');
  assert.equal(roads.heightRevision,revision,'hovering does not invalidate permanent road geometry');
  probes.forEach((p,i)=>{
   assert.equal(roads.surfaceHeight(p.x,p.z,'asphalt'),baseline[i]);
   for(const vehicle of vehicles){
    Object.assign(vehicle.agent,p);vehicle.heightWorld=null;
    view.moveCar(vehicle);
    assert.equal(vehicle.mesh.position.y,baseline[i],'moving cars and buses stay on real asphalt');
   }
  });
  assert.equal(JSON.stringify(world),saved,'preview never edits road or simulation state');
 };
 assertUnchanged();
 for(const type of ['avenue','highway','street']){
  view.showRoadReplacement({target,type,points,conflicts:[]});
  const preview=view.roadZoningGroup.children.find(m=>m.isMesh&&m.material.transparent);
  assert.ok(preview,'replacement geometry remains visible');
  assert.equal(preview.userData.roadSurface,undefined,'overlay is explicitly separate from permanent pavement');
  assert.ok(!roads.group.children.includes(preview));
  assertUnchanged();
  let disposed=false;preview.geometry.addEventListener('dispose',()=>disposed=true);
  view.clearRoadZoning();view.clearLine();
  assert.equal(disposed,true);assert.equal(view.roadZoningGroup.children.length,0);
  assertUnchanged();
 }
});
