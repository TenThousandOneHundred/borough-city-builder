import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import E from '../dist/engine.js';
import {createRoadSnapIndex,resolveRoadSnap} from '../dist/road-placement.js';
import {planRoadGrid,quoteRoadGrid,buildRoadGrid} from '../dist/road-grid.js';

// Only picking and DOM surfaces are stubbed. These are the production input,
// snapping, quoting and commit functions, including tool/world/menu changes.
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(type='street'){
 const world=E.createWorld('Grid input','plains',8);world.money=1e7;
 for(const tile of world.tiles)Object.assign(tile,{type:null,ground:'land',tree:false,level:0,people:0});
 world.roadPaths=[];E.buildRoadPath(world,[{x:10,y:10},{x:25,y:10}]);
 const nodes=new Map(),events={},keyEvents={},previews=[],messages=[];let updates=0;
 const classList={add(){},remove(){},toggle(){}};
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{id,textContent:'',value:id==='roadGridSize'?'96':'',checked:true,hidden:false,disabled:false,open:false,classList,
   setAttribute(){},addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){},showModal(){this.open=true;},close(){this.open=false;},focus(){}});
  return nodes.get(id);
 };
 const modes=['straight','curve','grid','replace','roundabout'].map(mode=>({dataset:{roadMode:mode},disabled:false,classList}));
 const document={body:{classList},querySelector(selector){
  if(selector==='dialog[open]')return [...nodes.values()].find(node=>node.open)||null;
  return modes.find(mode=>selector===`[data-road-mode=${mode.dataset.roadMode}]`)||null;
 },querySelectorAll:selector=>selector==='[data-road-mode]'?modes:[]};
 const view={getRoadPoint:(x,y)=>({x,y}),clearLine(){previews.length=0;},
  showRoadPreview(controls,type,ok,details){previews.push({controls:plain(controls),type,ok,details:plain(details)});},
  showRoadGridPreview(plan,type,ok,details){previews.push({plan:plain(plan),type,ok,details:plain(details)});},
  hover(){},clearRoadZoning(){},setBuild(){},setZoning(){},setOverlay(){},setNight(){},setWorld(){},cursor:{visible:true},grid:{visible:true}};
 const session={screen:'game',world,paused:false,start(){this.world=E.createWorld('Other world','plains',9);}};
 const state={E,P:E.Progression,visibleProgression:null,planRoadGrid,quoteRoadGrid,buildRoadGrid,createRoadSnapIndex,resolveRoadSnap,$,view,session,document,
  tool:'road',toolOptions:{roadType:type},roadMode:'grid',curvePoints:[],gridPoints:[],gridWorld:null,roadGridSize:96,roadParallel:false,roadParallelGap:8,roadParallelSide:1,roadParallelReverse:true,newRoadSides:'both',newRoadSelect:$('newRoadSides'),
  roadSnapIndex:null,roadStartSnap:null,roadLastSnap:null,rightRoadPress:null,lastRoadPointer:null,roadSnapping:{nodes:true,angles:true,lengths:false},
  drag:null,photo:false,painted:new Set(),busStops:[],facilityHover:null,finishTerrain(){},money:n=>'₡'+n,toast:(...args)=>messages.push(args),update(){updates++;},
  isFacility:()=>false,save:()=>true,closeDialogs(){for(const node of nodes.values())node.open=false;},timestamp:()=>'',
  window:{addEventListener:(name,fn)=>keyEvents[name]=fn}};
 const context=vm.createContext(state);
 vm.runInContext(source.slice(source.indexOf('function cancelRoad(){'),source.indexOf('\nlet store,')),context);
 const load=prefix=>{const line=source.split('\n').find(line=>line.startsWith(prefix));assert.ok(line,`Production handler ${prefix} must exist`);vm.runInContext(line,context);};
 for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])load(`$('city').addEventListener('${name}'`);
 for(const name of ['keydown','keyup'])load(`window.addEventListener('${name}'`);
 for(const name of ['syncCategorySelection','selectTool','start','pauseMenu'])load(`function ${name}(`);
 load("document.querySelectorAll('[data-road-mode]')");load("$('photo').onclick");
 const pointer=(name,x,y,extra={})=>events[name]({clientX:x,clientY:y,button:0,pointerId:1,altKey:false,...extra});
 const key=(name,key)=>keyEvents[name]({key,type:name,target:{tagName:'CANVAS'},preventDefault(){}});
 const click=(x,y,extra={})=>{pointer('pointerdown',x,y,extra);pointer('pointerup',x,y,extra);};
 return {world,state,nodes,$,view,previews,messages,events,pointer,key,click,modes,get updates(){return updates;}};
}
const lastGrid=h=>h.previews.findLast(preview=>preview.plan);
function draft(h,{start=[12,10],edge=[32,10],depth=[37,25]}={}){h.click(...start);h.pointer('pointermove',...edge);h.click(...edge);h.pointer('pointermove',...depth);return lastGrid(h);}
function orthogonal(plan){
 const [a,...other]=plan.corners,[b,c]=other.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y)),ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y;
 assert.ok(Math.abs(ux*vx+uy*vy)<1e-7,'Opposite corner remains perpendicular to the first edge');
}

test('grid clicks preview without mutation and commit the same complete network only on click three',()=>{
 const h=harness(),saved=JSON.stringify(h.world),money=h.world.money,count=h.world.roadPaths.length,existing=plain(h.world.roadPaths);
 h.click(12,10.2);h.pointer('pointermove',32,10.1);assert.equal(h.state.gridPoints.length,1);assert.equal(lastGrid(h).plan.stage,2);
 h.click(32,10.1);h.pointer('pointermove',37,25);const preview=lastGrid(h);
 assert.equal(h.state.gridPoints.length,2);assert.equal(preview.plan.stage,3);assert.equal(preview.ok,true);assert.equal(JSON.stringify(h.world),saved);
 const quote=quoteRoadGrid(h.world,preview.plan,'street',E,{zoneSides:'both'});assert.ok(quote.existingRoads>0,'Grid must reuse its existing connected edge');
 h.click(37,25);assert.deepEqual(plain(h.world.roadPaths.slice(count).map(path=>path.controls)),quote.paths);assert.deepEqual(plain(h.world.roadPaths.slice(0,count)),existing);
 assert.equal(money-h.world.money,preview.details.cost);assert.equal(h.updates,1);assert.equal(h.state.gridPoints.length,0);assert.equal(h.state.gridWorld,null);assert.equal(h.previews.length,0);
 for(const path of h.world.roadPaths.slice(count))for(const point of path.controls)assert.deepEqual(Object.keys(point).sort(),['x','y']);
});

test('start and width can join existing road anchors, while depth is projected rather than node snapped',()=>{
 const h=harness();h.click(12,10.2);h.pointer('pointermove',25.1,10.15);h.click(25.1,10.15);
 assert.deepEqual(plain(h.state.gridPoints),[{x:12,y:10},{x:25,y:10}]);
 h.pointer('pointermove',18,25);const preview=lastGrid(h);orthogonal(preview.plan);
 assert.equal(h.state.roadLastSnap.kind,'grid');assert.equal(h.state.roadLastSnap.point.x,25);
});

test('negative depth and a free angled first edge keep a rectangular grid',()=>{
 const h=harness();h.click(15,22,{altKey:true});h.click(31,29,{altKey:true});h.pointer('pointermove',35,14,{altKey:true});
 const preview=lastGrid(h);assert.equal(preview.ok,true);orthogonal(preview.plan);
 const [a,b]=h.state.gridPoints,p=h.state.roadLastSnap.point;assert.ok((b.x-a.x)*(p.y-b.y)-(b.y-a.y)*(p.x-b.x)<0);
 const before=h.world.roadPaths.length;h.click(35,14,{altKey:true});assert.ok(h.world.roadPaths.length>before);
});

test('Alt refreshes depth increments without a pointer move or changing the fixed first edge',()=>{
 const h=harness();h.state.roadSnapping.lengths=true;draft(h,{depth:[36,25.13]});const edge=plain(h.state.gridPoints),snapped=lastGrid(h).plan;
 h.key('keydown','Alt');const free=lastGrid(h).plan;assert.notDeepEqual(free.corners,snapped.corners);assert.deepEqual(plain(h.state.gridPoints),edge);orthogonal(free);
 h.key('keyup','Alt');assert.deepEqual(lastGrid(h).plan.corners,snapped.corners);
});

test('block size changes rebuild the preview without moving the outside rectangle or spending money',()=>{
 const h=harness();const before=h.world.money;draft(h);const initial=lastGrid(h).plan;
 h.$('roadGridSize').onchange({target:{value:'160'}});const resized=lastGrid(h).plan;
 assert.deepEqual(resized.corners,initial.corners);assert.ok(resized.paths.length<initial.paths.length);assert.equal(h.world.money,before);assert.equal(h.state.roadGridSize,160);
});

test('a right-button camera drag preserves the grid; right clicks step back its two anchors',()=>{
 const h=harness();draft(h);const before=JSON.stringify(h.world);
 h.pointer('pointerdown',20,20,{button:2});h.pointer('pointerup',40,35,{button:2});assert.equal(h.state.gridPoints.length,2);
 h.click(20,20,{button:2});assert.equal(h.state.gridPoints.length,1);h.click(20,20,{button:2});assert.equal(h.state.gridPoints.length,0);assert.equal(h.previews.length,0);
 assert.equal(JSON.stringify(h.world),before);
});

test('blocked or unaffordable grids stay atomic and keep both anchors for correction',()=>{
 for(const reason of ['building','funds']){
  const h=harness();if(reason==='building')Object.assign(h.world.tiles[25*48+32],{type:'school',level:1});else h.world.money=1;
  const saved=JSON.stringify(h.world);draft(h);assert.equal(lastGrid(h).ok,false);h.click(37,25);
  assert.equal(JSON.stringify(h.world),saved);assert.equal(h.state.gridPoints.length,2);assert.equal(h.updates,0);assert.ok(h.messages.some(message=>message[1]===true));
 }
});

test('Escape and pointer cancellation remove the complete draft without building',()=>{
 for(const cancel of [h=>h.key('keydown','Escape'),h=>h.events.pointercancel()]){
  const h=harness(),saved=JSON.stringify(h.world);draft(h);cancel(h);
  assert.equal(h.state.gridPoints.length,0);assert.equal(h.state.gridWorld,null);assert.equal(h.previews.length,0);assert.equal(JSON.stringify(h.world),saved);
 }
});

test('tool, world, menu and photo changes cancel stale grid anchors',()=>{
 for(const action of [h=>h.state.selectTool('inspect'),h=>h.state.start('other'),h=>h.state.pauseMenu(),h=>h.$('photo').onclick()]){
  const h=harness(),saved=JSON.stringify(h.world);draft(h);action(h);
  assert.equal(h.state.gridPoints.length,0);assert.equal(h.state.gridWorld,null);assert.equal(h.previews.length,0);assert.equal(JSON.stringify(h.world),saved);
 }
});

test('grid remains available for one-way and highway roads, and switches off for paths',()=>{
 const h=harness();for(const roadType of ['oneway','highway']){h.state.selectTool('road',{roadType});assert.equal(h.state.roadMode,'grid');assert.equal(h.modes.find(mode=>mode.dataset.roadMode==='grid').disabled,false);}
 draft(h);h.state.selectTool('path',{path:true});assert.equal(h.state.roadMode,'straight');assert.equal(h.state.gridPoints.length,0);assert.equal(h.$('roadGridControls').hidden,true);
 h.modes.find(mode=>mode.dataset.roadMode==='grid').onclick();assert.equal(h.state.roadMode,'straight');
});
