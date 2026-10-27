import {test} from 'node:test';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {planRoadGrid,quoteRoadGrid,buildRoadGrid} from '../dist/road-grid.js';
import {Traffic} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';

function grid(type='street',rotated=false){
 const world=E.createWorld('Grid journeys','plains',246);world.money=1e8;
 const controls=rotated?[{x:19,y:24},{x:35,y:30},{x:29,y:45}]:[{x:19,y:24},{x:39,y:24},{x:39,y:40}];
 const plan=planRoadGrid(controls,{blockSize:4.8,roadWidth:E.ROADS[type].width/4});
 const result=buildRoadGrid(world,plan,type,E,{zoneSides:'both'});
 assert.equal(result.ok,true,result.reason);return {world,plan};
}

for(const type of ['street','oneway','highway'])for(const rotated of [false,true])test(`${rotated?'rotated':'axis-aligned'} ${type} grid has routes from and back to the outside connection`,()=>{
 const {world}=grid(type,rotated),traffic=new Traffic(world,E),portal=24*48;
 const entering=traffic.search(portal),leaving=traffic.search(portal,traffic.reverseGraph);
 for(const road of traffic.graph.keys()){
  assert.ok(entering.has(road),`Road tile ${road} is unreachable from outside`);
  assert.ok(leaving.has(road),`Road tile ${road} cannot return outside`);
 }
 assert.ok(traffic.graph.size>100,'Fixture contains a complete multi-block road network');
});

test('homes on a built grid support actual work and shopping round trips without a renderer',()=>{
 const {world}=grid(),home=25*48+21,work=39*48+33,shop=27*48+38;
 for(const [id,type,people]of [[home,'residential',4],[work,'office',0],[shop,'commercial',0]]){
  assert.equal(world.tiles[id].type,null,'Building fixture must not overwrite a road');
  Object.assign(world.tiles[id],{type,level:1,people});
 }
 const traffic=new Traffic(world,E);traffic.residentsEnabled=true;for(let n=0;n<32;n++)traffic.addAgent();
 const residents=new Residents(world,traffic);
 for(const [from,to]of [[home,work],[work,shop],[shop,home]])assert.ok(traffic.between(from,to),`Missing trip ${from} → ${to}`);
 let returned=false;
 for(let elapsed=0;elapsed<900&&!returned;elapsed+=.1){
  traffic.update(.1);residents.update(.1);
  returned=world.citizens.residents.some(r=>r.workdays>0&&r.shopping>0&&r.location===r.home&&!r.trip);
 }
 assert.ok(returned,'A resident must leave home, work, shop, and return home');
 assert.ok(traffic.completed>=3,'Trips must complete through traffic rather than teleporting');
 assert.ok(world.citizens.time>0);
});

test('one-sided grid zoning follows each authored street direction and preserves reused street policy',()=>{
 for(const type of ['street','oneway'])for(const zoneSides of ['left','right'])for(const direction of [-1,1]){
  const world=E.createWorld('Directed grid zoning','plains',246);world.money=1e8;
  const old=E.buildRoadPath(world,[{x:19,y:24},{x:27,y:24}],'alley',{zoneSides:zoneSides==='left'?'right':'left'}).path;
  const retained=structuredClone(old),plan=planRoadGrid([{x:19,y:24},{x:35,y:24},{x:35,y:24+direction*12}],{blockSize:4.8,roadWidth:E.ROADS[type].width/4});
  const before=JSON.stringify(world),quote=quoteRoadGrid(world,plan,type,E,{zoneSides});assert.ok(quote.ok,quote.reason);assert.ok(quote.existingRoads>0);assert.equal(JSON.stringify(world),before);
  const result=buildRoadGrid(world,plan,type,E,{zoneSides});assert.ok(result.ok,result.reason);assert.deepEqual(old,retained,'Reused road retains its original type, controls and opposite zoning policy');
  const roads=new Map(result.roads.map(path=>[path.id,path])),cells=[...E.fineZoningLayout(world).values()].filter(cell=>roads.has(cell.source));
  assert.ok(cells.length>0);const expected=zoneSides==='left'?-1:1;
  for(const path of roads.values()){assert.equal(path.type,type);assert.equal(path.zoneSides,zoneSides);}
  for(const cell of cells){
   const [a,b]=roads.get(cell.source).controls,dx=b.x-a.x,dz=b.y-a.y,x=(a.x+.5)*4-96,z=(a.y+.5)*4-96;
   assert.equal(cell.side,expected);assert.ok((dx*(cell.cz-z)-dz*(cell.cx-x))*expected>0,'Zoning is on the chosen side looking along this street, including reversed internal streets');
  }
 }
});
