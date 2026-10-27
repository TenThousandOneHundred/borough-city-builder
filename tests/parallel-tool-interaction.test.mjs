import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import E from '../dist/engine.js';
import {createRoadSnapIndex,resolveRoadSnap} from '../dist/road-placement.js';
import {planParallelRoads,quoteParallelRoads,buildParallelRoads} from '../dist/road-parallel.js';

const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function harness(mode='straight',type='oneway'){
 const world=E.createWorld('Parallel pointer test','plains',19);world.money=1e6;
 for(const t of world.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0,tree:false});world.roadPaths=[];
 const nodes=new Map(),events={},keys={},previews=[],messages=[];let updates=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',checked:true,hidden:false,disabled:false,addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){}});return nodes.get(id)};
 const view={getRoadPoint:(x,y)=>({x,y}),clearLine(){previews.length=0},showRoadPreview(controls,type,ok,details){previews.push({controls,ok,details})},showParallelRoadPreview(plan,type,ok,details){previews.push({plan:plain(plan),ok,details})},hover(){}};
 const state={E,planParallelRoads,quoteParallelRoads,buildParallelRoads,createRoadSnapIndex,resolveRoadSnap,$,view,session:{screen:'game',world},tool:'road',toolOptions:{roadType:type},roadMode:mode,roadParallel:true,roadParallelGap:8,roadParallelSide:1,roadParallelReverse:true,curvePoints:[],gridPoints:[],gridWorld:null,roadGridSize:96,newRoadSides:'both',roadSnapIndex:null,roadStartSnap:null,roadLastSnap:null,rightRoadPress:null,lastRoadPointer:null,roadSnapping:{nodes:true,angles:true,lengths:false},drag:null,photo:false,painted:new Set(),busStops:[],finishTerrain(){},money:n=>'₡'+n,toast:message=>messages.push(message),update(){updates++},isFacility:()=>false,document:{querySelector:()=>null},window:{addEventListener:(name,fn)=>keys[name]=fn}};
 const context=vm.createContext(state);vm.runInContext(source.slice(source.indexOf('function cancelRoad(){'),source.indexOf('\nlet store,')),context);
 for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])vm.runInContext(source.split('\n').find(s=>s.startsWith("$('city').addEventListener('"+name+"'")),context);
 vm.runInContext(source.split('\n').find(s=>s.startsWith("window.addEventListener('keydown'")),context);vm.runInContext(source.split('\n').find(s=>s.startsWith("window.addEventListener('keyup'")),context);
 const pointer=(name,x,y,extra={})=>events[name]({clientX:x,clientY:y,button:0,pointerId:1,altKey:false,...extra});
 return {world,state,nodes,$,previews,messages,pointer,keys,updates:()=>updates};
}

test('straight paired preview and release build exactly the same roads with one scene refresh',()=>{
 const h=harness(),before=JSON.stringify(h.world);h.pointer('pointerdown',10,10);h.pointer('pointermove',22,10);
 const preview=h.previews.at(-1);assert.ok(preview.ok,preview.details.reason);assert.equal(JSON.stringify(h.world),before);
 h.pointer('pointerup',22,10);assert.deepEqual(plain(h.world.roadPaths.map(p=>p.controls)),preview.plan.paths);assert.equal(h.updates(),1);assert.equal(h.previews.length,0);
 assert.ok(h.world.roadPaths[1].controls[0].x>h.world.roadPaths[1].controls.at(-1).x,'secondary travels in the opposite direction');assert.ok(E.valid(h.world));
});

test('curved three-click pair uses the same fitted controls for preview and construction',()=>{
 const h=harness('curve');h.pointer('pointerdown',10,10);h.pointer('pointerdown',18,10);h.pointer('pointermove',24,19,{altKey:true});
 const preview=h.previews.at(-1);assert.ok(preview.ok,preview.details.reason);assert.ok(preview.plan.secondary.length>=1);
 h.pointer('pointerdown',24,19,{altKey:true});assert.deepEqual(plain(h.world.roadPaths.map(p=>p.controls)),preview.plan.paths);assert.equal(h.updates(),1);assert.equal(h.state.curvePoints.length,0);
});

test('gap, side and direction controls refresh a stationary draft without touching the city',()=>{
 const h=harness(),before=JSON.stringify(h.world);h.pointer('pointerdown',10,10);h.pointer('pointermove',22,10);
 h.$('roadParallelGap').onchange({target:{value:'24'}});assert.equal(h.previews.at(-1).plan.gap,1.2);
 h.$('roadParallelSide').onchange({target:{value:'-1'}});assert.ok(h.previews.at(-1).plan.secondary[0][0].y<10);
 h.$('roadParallelReverse').onchange({target:{checked:false}});assert.ok(h.previews.at(-1).plan.secondary[0][0].x<h.previews.at(-1).plan.secondary.at(-1).at(-1).x);
 assert.equal(JSON.stringify(h.world),before);assert.equal(h.updates(),0);
});

test('disabled parallel toggle returns the same draft to one ordinary road',()=>{
 const h=harness();h.pointer('pointerdown',10,10);h.pointer('pointermove',22,10);h.$('roadParallel').onchange({target:{checked:false}});
 assert.equal(h.previews.at(-1).plan,undefined);h.pointer('pointerup',22,10);assert.equal(h.world.roadPaths.length,1);assert.equal(h.updates(),1);
});

test('insufficient funds for the pair leaves the world untouched and skips rebuilding',()=>{
 const h=harness();h.world.money=1;const before=JSON.stringify(h.world);h.pointer('pointerdown',10,10);h.pointer('pointermove',22,10);
 const preview=h.previews.at(-1);assert.equal(preview.ok,false);assert.ok(preview.details.cost>1);h.pointer('pointerup',22,10);assert.equal(JSON.stringify(h.world),before);assert.equal(h.updates(),0);
});

test('Escape cancels both road ghosts without building',()=>{
 const h=harness('curve'),before=JSON.stringify(h.world);h.pointer('pointerdown',10,10);h.pointer('pointermove',18,14);
 h.keys.keydown({key:'Escape',target:{tagName:'CANVAS'},preventDefault(){}});assert.equal(h.state.curvePoints.length,0);assert.equal(h.previews.length,0);assert.equal(JSON.stringify(h.world),before);
});
