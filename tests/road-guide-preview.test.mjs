import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {RoadGuidePreview,placeRoadGuideBadge} from '../dist/road-guide-preview.js';
globalThis.CityEngine=E;

function fixture(){
 const world=E.createWorld('Road guide inspection','plains',134),index=Object.freeze({triangleCount:212,heightRevision:17});
 const view={scene:new T.Scene(),world,roadworks:{surfaces:index,heightRevision:17,height:(_w,x,z)=>3+x*.02+z*.01,ribbon:()=>{throw Error('A preview must not construct permanent pavement');}}};
 const guide=new RoadGuidePreview(view);return {world,index,view,guide};
}
function activeVertices(batch){return Array.from(batch.geometry.attributes.position?.array.subarray(0,batch.geometry.drawRange.count*3)||[]);}

test('road guide outlines the selected width and uses real metres without altering permanent surfaces',()=>{
 const {world,index,view,guide}=fixture(),saved=JSON.stringify(world);
 guide.update([{x:10,y:20},{x:20,y:20}],'avenue',true,{cost:500});
 assert.ok(Math.abs(guide.metrics.lengthMeters-200)<1e-9);assert.ok(Math.abs(guide.metrics.endpointSlopePercent-2)<1e-10);
 assert.equal(guide.group.children.length,4);assert.ok(guide.metrics.drawObjects<=4);
 const points=activeVertices(guide.fill),xs=[],zs=[];
 for(let i=0;i<points.length;i+=3){xs.push(points[i]);zs.push(points[i+2]);}
 assert.equal(Math.min(...xs),-54);assert.equal(Math.max(...xs),-14);
 assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-(E.ROADS.avenue.width+.8))<1e-5);
 assert.equal(view.roadworks.surfaces,index);assert.equal(view.roadworks.heightRevision,17);
 assert.equal(JSON.stringify(world),saved);assert.ok(!guide.fill.object.userData.roadSurface);
 assert.ok(activeVertices(guide.dashes).length>0,'centerline dashes are visible');
 guide.dispose();
});

test('curved guides follow the authored bend and bound long previews without NaNs',()=>{
 const {guide}=fixture(),controls=[{x:0,y:0},{x:47,y:47},{x:47,y:0}];
 guide.update(controls,'street',true,{cost:1500,snap:{guides:[{a:{x:0,y:0},b:{x:47,y:47}}]}});
 assert.ok(guide.metrics.stations<=384);assert.ok(guide.metrics.lengthMeters>940,'length follows arc instead of endpoint chord');
 const points=activeVertices(guide.fill),zs=[];for(let i=2;i<points.length;i+=3)zs.push(points[i]);
 assert.ok(Math.max(...zs)>-1,'preview reaches the actual quadratic bend');
 assert.ok(Math.max(...zs)<2,'preview does not incorrectly pass through the control handle');
 for(const batch of guide.batches){const values=activeVertices(batch);assert.ok(values.every(Number.isFinite));assert.equal(batch.geometry.attributes.position.count%1,0);}
 assert.ok(activeVertices(guide.guides).length>0);guide.dispose();
});

test('pointer updates reuse geometry and materials and clearing never disposes live reusable buffers',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}],geometry=guide.batches.map(b=>b.geometry),materials=guide.batches.map(b=>b.object.material);
 guide.update(controls,'street',true);const attributes=guide.batches.map(b=>b.geometry.attributes.position);let disposals=0;
 for(const batch of guide.batches)batch.geometry.addEventListener('dispose',()=>disposals++);
 for(let i=0;i<80;i++)guide.update([{x:10,y:20},{x:20,y:20+i/800}],'street',i%2===0);
 guide.batches.forEach((batch,i)=>{assert.equal(batch.geometry,geometry[i]);assert.equal(batch.object.material,materials[i]);assert.equal(batch.geometry.attributes.position,attributes[i]);});
 const before=disposals;guide.clear();assert.equal(guide.group.visible,false);assert.equal(guide.metrics,null);assert.equal(disposals,before);
 guide.update(controls,'street',true);assert.equal(guide.group.visible,true);assert.equal(disposals,before);
 guide.dispose();assert.equal(disposals,before+4);assert.equal(guide.group.parent,null);
});

test('zero-length and invalid previews are finite and preserve the controls',()=>{
 const {guide,world}=fixture(),controls=[{x:24,y:24},{x:24,y:24}],saved=JSON.stringify({world,controls});
 guide.update(controls,'path',false,{reason:'Choose an endpoint'});
 assert.equal(guide.metrics.lengthMeters,0);assert.equal(guide.metrics.endpointSlopePercent,0);
 for(const batch of guide.batches)assert.ok(activeVertices(batch).every(Number.isFinite));
 assert.equal(JSON.stringify({world,controls}),saved);
 guide.update([{x:NaN,y:0},{x:1,y:1}],'street',false);assert.equal(guide.group.visible,false);guide.dispose();
});

test('a growth allocation releases previous GPU buffers while preserving four draw objects',()=>{
 const {guide}=fixture();guide.update([{x:10,y:20},{x:10.1,y:20}],'street',true);
 const first=guide.fill.geometry.attributes.position;let released=0;
 guide.fill.geometry.addEventListener('dispose',()=>released++);
 guide.update([{x:0,y:0},{x:47,y:47},{x:47,y:0}],'highway',true);
 assert.notEqual(guide.fill.geometry.attributes.position,first);assert.equal(released,1);
 assert.equal(guide.group.children.length,4);const next=guide.fill.geometry.attributes.position;
 guide.update([{x:47,y:0},{x:0,y:47},{x:0,y:0}],'highway',true);
 assert.equal(guide.fill.geometry.attributes.position,next);assert.equal(released,1);guide.dispose();
});

test('pre-start hover draws only its control ring and optional snapping guides',()=>{
 const {guide}=fixture(),p={x:20,y:20};
 guide.update([p,p],'highway',true,{anchorOnly:true,snap:{label:'Road center',guides:[{a:{x:18,y:20},b:{x:22,y:20}}]}});
 assert.equal(guide.fill.geometry.drawRange.count,0);assert.equal(guide.dashes.geometry.drawRange.count,0);
 assert.ok(guide.outline.geometry.drawRange.count>0);assert.ok(guide.guides.geometry.drawRange.count>0);
 const points=activeVertices(guide.outline);for(let i=0;i<points.length;i+=3)assert.ok(Math.hypot(points[i]+14,points[i+2]+14)<.481);
 guide.dispose();
});

test('guide footprint includes sidewalks but does not add them to highways or footpaths',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}];
 for(const type of ['street','avenue','boulevard','gravel','highway','path']){
  guide.update(controls,type,true);const points=activeVertices(guide.fill),zs=[];for(let i=2;i<points.length;i+=3)zs.push(points[i]);
  const spec=E.ROADS[type],expected=type==='path'?.65:spec.width+(spec.sidewalk?.8:0);
  assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-expected)<1e-5,type);
 }guide.dispose();
});

test('nearby badges separate and a secondary badge hides when the map has no free room',()=>{
 const bounds={left:0,right:1280,top:65,bottom:625},primary={left:490,right:710,top:220,bottom:275};
 const size={width:150,height:35},placed=placeRoadGuideBadge({x:610,y:280},size,bounds,[],[primary]);
 assert.ok(placed);assert.ok(placed.x-size.width/2>=primary.right+8||placed.x+size.width/2<=primary.left-8||placed.y<=primary.top-8||placed.y-size.height>=primary.bottom+8);
 const noRoom=placeRoadGuideBadge({x:200,y:150},{width:150,height:45},{left:0,right:400,top:65,bottom:180},[],[{left:8,right:392,top:73,bottom:172}]);
 assert.equal(noRoom,null);
 const panel={left:300,right:980,top:400,bottom:625},above=placeRoadGuideBadge({x:640,y:520},{width:230,height:52},bounds,[panel]);
 assert.ok(above);assert.ok(above.y<=panel.top-8||above.x-115>=panel.right+8||above.x+115<=panel.left-8);
});

test('active previews have broad alignment rings and legible road-width-scaled center dashes',()=>{
 const {guide}=fixture(),controls=[{x:10,y:20},{x:20,y:20}],width=E.ROADS.street.width+.8;
 guide.update(controls,'street',true,{referenceTangent:{x:0,y:1}});
 const dashes=activeVertices(guide.dashes),zs=[];for(let i=2;i<dashes.length;i+=3)zs.push(dashes[i]);
 assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-width*.1)<1e-5);
 const alignment=activeVertices(guide.guides),radii=[];for(let i=0;i<alignment.length;i+=3)radii.push(Math.hypot(alignment[i]+54,alignment[i+2]+14));
 assert.ok(Math.max(...radii)>width*2.49);assert.ok(Math.max(...radii)<width*2.51);
 assert.ok(radii.some(r=>Math.abs(r-width*1.8)<1e-5),'an angle arc uses the supplied reference direction');
 assert.ok(alignment.every(Number.isFinite));assert.equal(guide.group.children.length,4);assert.equal(guide.metrics.drawObjects,4);
 guide.update([controls[0],controls[0]],'street',true,{anchorOnly:true});assert.equal(guide.guides.geometry.drawRange.count,0);guide.dispose();
});
