import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import E from '../dist/engine.js';
import {createRoadSnapIndex,resolveRoadSnap} from '../dist/road-placement.js';

// Execute the production input handlers with pointer coordinates supplied by a
// ground-picking stub. Quoting, snapping and committing use the real engine.
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function harness(mode='straight'){
 const world=E.createWorld('Road tool input','plains',8);world.money=1e7;
 for(const t of world.tiles)Object.assign(t,{type:null,ground:'land',tree:false});
 world.roadPaths=[];E.buildRoadPath(world,[{x:10,y:10},{x:25,y:10}]);
 const nodes=new Map(),events={},keyEvents={},previews=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',checked:true,addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){}});return nodes.get(id);};
 const view={getRoadPoint:(x,y)=>({x,y}),clearLine(){previews.length=0;},showRoadPreview(controls,type,ok,details){previews.push({controls:structuredClone(controls),ok,details});},hover(){}};
 const state={E,createRoadSnapIndex,resolveRoadSnap,$,view,session:{screen:'game',world},tool:'road',toolOptions:{roadType:'street'},roadMode:mode,curvePoints:[],gridPoints:[],gridWorld:null,roadGridSize:96,newRoadSides:'both',roadSnapIndex:null,roadStartSnap:null,roadLastSnap:null,rightRoadPress:null,lastRoadPointer:null,roadSnapping:{nodes:true,angles:true,lengths:false},drag:null,photo:false,painted:new Set(),busStops:[],facilityHover:null,finishTerrain(){},money:n=>'₡'+n,toast(){},update(){},isFacility:()=>false,document:{querySelector:()=>null},window:{addEventListener:(name,fn)=>keyEvents[name]=fn}};
 const context=vm.createContext(state);
 vm.runInContext(source.slice(source.indexOf('function cancelRoad(){'),source.indexOf('\nlet store,')),context);
 for(const name of ['pointerdown','pointermove','pointerup','pointercancel']){
  const line=source.split('\n').find(s=>s.startsWith("$('city').addEventListener('"+name+"'"));
  vm.runInContext(line,context);
 }
 vm.runInContext(source.split('\n').find(s=>s.startsWith("window.addEventListener('keydown'")),context);
 vm.runInContext(source.split('\n').find(s=>s.startsWith("window.addEventListener('keyup'")),context);
 const pointer=(name,x,y,extra={})=>events[name]({clientX:x,clientY:y,button:0,pointerId:1,altKey:false,...extra});
 return {state,world,view,previews,pointer,events,keyEvents};
}
const plain=x=>JSON.parse(JSON.stringify(x));

test('straight hover and pointer release commit the same resolved road controls',()=>{
 const h=harness(),saved=JSON.stringify(h.world);
 h.pointer('pointerdown',16.2,10.3);h.pointer('pointermove',16.35,18.2);
 const preview=plain(h.previews.at(-1).controls);
 assert.equal(JSON.stringify(h.world),saved,'hover does not modify world or money');
 assert.equal(preview[0].y,10);assert.ok(Math.abs(preview[1].x-16.2)<1e-8);
 h.pointer('pointerup',16.35,18.2);
 assert.deepEqual(plain(h.world.roadPaths.at(-1).controls),preview);
 assert.ok(h.world.roadPaths.at(-1).controls.every(p=>Object.keys(p).sort().join(',')==='x,y'));
 assert.equal(h.state.roadSnapIndex,null);assert.equal(h.previews.length,0);
});

test('all three curve clicks use the same controls as the final preview',()=>{
 const h=harness('curve');h.pointer('pointerdown',12,10.2);
 h.pointer('pointermove',12.2,18);h.pointer('pointerdown',12.2,18);
 h.pointer('pointermove',22,20);const preview=plain(h.previews.at(-1).controls);
 assert.equal(preview.length,3);h.pointer('pointerdown',22,20);
 assert.deepEqual(plain(h.world.roadPaths.at(-1).controls),preview);
 assert.equal(h.state.curvePoints.length,0);
});

test('right click steps back a curve but a right-button camera drag does not',()=>{
 const h=harness('curve');h.pointer('pointerdown',12,10);h.pointer('pointerdown',12,18);
 const saved=JSON.stringify(h.world);
 h.pointer('pointerdown',20,20,{button:2});h.pointer('pointerup',40,35,{button:2});
 assert.equal(h.state.curvePoints.length,2);
 h.pointer('pointerdown',20,20,{button:2});h.pointer('pointerup',20,20,{button:2});
 assert.equal(h.state.curvePoints.length,1);
 h.pointer('pointerdown',20,20,{button:2});h.pointer('pointerup',20,20,{button:2});
 assert.equal(h.state.curvePoints.length,0);assert.equal(h.previews.length,0);
 assert.equal(JSON.stringify(h.world),saved);
});

test('Alt bypasses network and angle snaps through preview and commit',()=>{
 const h=harness();h.pointer('pointerdown',16.2,10.3,{altKey:true});
 h.pointer('pointermove',16.35,18.2,{altKey:true});
 const preview=plain(h.previews.at(-1).controls);
 assert.deepEqual(preview,[{x:16.2,y:10.3},{x:16.35,y:18.2}]);
 h.pointer('pointerup',16.35,18.2,{altKey:true});assert.deepEqual(plain(h.world.roadPaths.at(-1).controls),preview);
});

test('cancelled input and Escape clear guides without building',()=>{
 const h=harness('curve'),saved=JSON.stringify(h.world);
 h.pointer('pointerdown',12,10);h.pointer('pointermove',12,18);h.events.pointercancel();
 assert.equal(h.state.curvePoints.length,0);assert.equal(h.previews.length,0);
 h.pointer('pointerdown',12,10);h.pointer('pointerdown',12,18);
 h.keyEvents.keydown({key:'Escape',target:{tagName:'CANVAS'}});
 assert.equal(h.state.curvePoints.length,0);assert.equal(h.previews.length,0);assert.equal(JSON.stringify(h.world),saved);
});

test('placement indexes change after a commit and on switching worlds',()=>{
 const h=harness();h.pointer('pointerdown',12,10);h.pointer('pointermove',12,18);
 const first=h.state.roadSnapIndex;h.pointer('pointerup',12,18);
 h.pointer('pointermove',12.1,18.1);assert.notEqual(h.state.roadSnapIndex,first);
 assert.deepEqual(plain(h.state.roadLastSnap.point),{x:12,y:18});
 const second=h.state.roadSnapIndex;h.state.session.world=structuredClone(h.world);
 h.pointer('pointermove',12,18);assert.notEqual(h.state.roadSnapIndex,second);
 assert.equal(h.state.roadSnapIndex.world,h.state.session.world);
});

test('changing Alt without moving refreshes the visible endpoint before release',()=>{
 const h=harness();h.pointer('pointerdown',16.2,10.3);h.pointer('pointermove',16.35,18.2);
 const snapped=plain(h.previews.at(-1).controls);
 h.keyEvents.keydown({key:'Alt',type:'keydown',target:{tagName:'CANVAS'}});
 assert.notDeepEqual(plain(h.previews.at(-1).controls),snapped);
 assert.equal(h.previews.at(-1).controls[1].x,16.35);
 h.keyEvents.keyup({key:'Alt',type:'keyup',target:{tagName:'CANVAS'}});
 assert.deepEqual(plain(h.previews.at(-1).controls),snapped);
 h.keyEvents.keydown({key:'Alt',type:'keydown',target:{tagName:'CANVAS'}});
 const free=plain(h.previews.at(-1).controls);h.pointer('pointerup',16.35,18.2,{altKey:true});
 assert.deepEqual(plain(h.world.roadPaths.at(-1).controls),free);
});
