import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CityView} from '../dist/renderer.js';
const tile=p=>({x:(p.x+96)/4-.5,y:(p.z+96)/4-.5});

test('bus stop signs follow the pinned line curb and its own road center on shared tiles',()=>{
 const line={id:7,stops:[3,4]},entry={stopPositions:[{x:10,z:5},{x:20,z:7}],plan:{attachments:[{point:tile({x:10,z:3})},{point:tile({x:18,z:7})}]}},boxes=[];
 const v={world:{transit:{lines:[line]}},transit:{entries:new Map([[7,entry]])},scene:new T.Scene(),renderer:{shadowMap:{}},
  traffic:{graph:new Map(),positions:new Map([[3,{x:-8,z:2}],[4,{x:40,z:7}]])},roadworks:{crossingKey:'7:3,4',surfaceHeight:()=>6},
  disposeGroup:g=>g.clear(),box:(_g,x,y,z,sx,sy,sz,color)=>boxes.push({x,y,z,sx,sy,sz,color})};
 CityView.prototype.drawTransitStops.call(v);assert.equal(boxes.length,6);
 assert.deepEqual(boxes[0],{x:10,y:6.7,z:5.55,sx:.045,sy:1.4,sz:.045,color:'#bdc8c5'});
 assert.deepEqual(boxes[3],{x:20.55,y:6.7,z:7,sx:.045,sy:1.4,sz:.045,color:'#bdc8c5'});
 assert.equal(v.renderer.shadowMap.needsUpdate,true);
 CityView.prototype.drawTransitStops.call(v);assert.equal(boxes.length,6,'unchanged routes keep the existing stop meshes');
 entry.stopPositions[0]={x:11,z:5};entry.plan.attachments[0].point=tile({x:11,z:3});v.traffic.graph=new Map();
 CityView.prototype.drawTransitStops.call(v);assert.equal(boxes.length,12);assert.equal(boxes[6].x,11,'a rebuilt network uses updated pinned geometry');
});

test('a disconnected line with retained curb positions and no plan attachment still renders safely',()=>{
 const boxes=[],v={world:{transit:{lines:[{id:1,stops:[3]}]}},transit:{entries:new Map([[1,{stopPositions:[{x:5,z:7}],plan:{ok:false}}]])},scene:new T.Scene(),renderer:{shadowMap:{}},
  traffic:{graph:new Map(),positions:new Map([[3,{x:5,z:5}]])},roadworks:{crossingKey:'1:3',surfaceHeight:()=>2},disposeGroup:g=>g.clear(),box:(_g,...args)=>boxes.push(args)};
 CityView.prototype.drawTransitStops.call(v);assert.equal(boxes.length,3);assert.equal(boxes[0][0],5);assert.equal(boxes[0][2],7.55);assert.ok(boxes.every(b=>b.slice(0,6).every(Number.isFinite)));
});
