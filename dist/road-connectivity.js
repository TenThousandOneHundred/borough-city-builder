// Shared geometric road topology. A tile may contain several separate streets;
// source identity is retained until a real intersection permits a transfer.
(function(root){
'use strict';
const cache=new WeakMap(),EPS=1e-7,BIN=2;
const neighbors=i=>[i%48?i-1:-1,i%48<47?i+1:-1,i>=48?i-48:-1,i<2256?i+48:-1].filter(i=>i>=0);
const point=i=>({x:i%48,y:Math.floor(i/48)}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function project(p,a,b){const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return {x:a.x+x*t,y:a.y+y*t,t};}
function signature(world){return JSON.stringify([world.roadPaths||[],world.tiles.map(t=>t.type==='road'?[t.roadType,t.roadWidth,t.legacyRoad,t.pathIds]:null)]);}
function build(world,engine){
 const stamp=signature(world),old=cache.get(world);if(old&&old.stamp===stamp&&old.specs===engine.ROADS&&old.sample===engine.sampleRoad)return old.value;
 const records=new Map(),states=new Map(),byTile=new Map(),forward=new Map(),reverse=new Map(),undirected=new Map(),contacts=new Map(),segments=[],bins=new Map();
 const addState=(record,tile,position=record.mapping.get(tile))=>{position=Math.max(0,Math.min(record.points.length-1,Number(position.toFixed(8))));const key=JSON.stringify([record.key,position]);let state=states.get(key);
  if(!state){const n=Math.floor(position),a=record.points[n],b=record.points[Math.min(n+1,record.points.length-1)],t=position-n;state={key,tile,tiles:new Set(),position,point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},record};states.set(key,state);record.nodes.set(position,key);forward.set(key,new Set());reverse.set(key,new Set());undirected.set(key,new Set());}
  state.tiles.add(tile);if(!byTile.has(tile))byTile.set(tile,[]);if(!byTile.get(tile).includes(key))byTile.get(tile).push(key);if(!record.states.has(tile))record.states.set(tile,key);return key;
 };
 const link=(a,b,p=null)=>{if(!a||!b||a===b)return;forward.get(a).add(b);reverse.get(b).add(a);undirected.get(a).add(b);undirected.get(b).add(a);if(p){if(!contacts.has(a))contacts.set(a,new Map());contacts.get(a).set(b,{x:p.x,y:p.y});}};
 const transfer=(a,b,p)=>{link(a,b,p);link(b,a,p);};
 const addSegment=(record,a,b,index=0)=>{if(distance(a,b)<EPS)return;const s={id:segments.length,record,a,b,index};segments.push(s);record.segments.push(s);
  for(let y=Math.floor(Math.min(a.y,b.y)/BIN);y<=Math.floor(Math.max(a.y,b.y)/BIN);y++)for(let x=Math.floor(Math.min(a.x,b.x)/BIN);x<=Math.floor(Math.max(a.x,b.x)/BIN);x++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(s);}
 };
 for(const path of world.roadPaths||[]){
  const record={key:JSON.stringify(['path',path.id]),pathId:path.id,spec:engine.ROADS[path.type]||engine.ROADS.street,points:engine.sampleRoad(path.controls),mapping:new Map(),states:new Map(),nodes:new Map(),segments:[]};records.set(record.key,record);
  for(const tile of path.tiles){if(world.tiles[tile]?.type!=='road'||!world.tiles[tile].pathIds?.includes(path.id))continue;let best=0,error=Infinity;const p=point(tile);
   record.points.forEach((q,n)=>{const d=(p.x-q.x)**2+(p.y-q.y)**2;if(d<error){error=d;best=n;}});record.mapping.set(tile,best);addState(record,tile);
  }
  for(let n=1;n<record.points.length;n++)addSegment(record,record.points[n-1],record.points[n],n-1);
 }
 for(let tile=0;tile<world.tiles.length;tile++){
  const t=world.tiles[tile];if(t.type!=='road'||t.pathIds?.length&&!t.legacyRoad&&byTile.has(tile))continue;
  const p=point(tile),spec={...(engine.ROADS[t.roadType]||engine.ROADS.street),width:t.roadWidth===2?3.15:2.45,oneway:!t.pathIds?.length&&!!engine.ROADS[t.roadType]?.oneway},record={key:JSON.stringify(['legacy',tile]),pathId:null,spec,points:[p],mapping:new Map([[tile,0]]),states:new Map(),nodes:new Map(),segments:[],legacy:true};records.set(record.key,record);addState(record,tile);
  const dirs=neighbors(tile).filter(i=>world.tiles[i].type==='road').map(i=>({x:i%48-p.x,y:Math.floor(i/48)-p.y}));
  if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].y*dirs[1].y===0){const a={x:p.x+dirs[0].x*.5,y:p.y+dirs[0].y*.5},b={x:p.x+dirs[1].x*.5,y:p.y+dirs[1].y*.5};let previous=a;
   for(let n=1;n<=12;n++){const t=n/12,u=1-t,q={x:u*u*a.x+2*u*t*p.x+t*t*b.x,y:u*u*a.y+2*u*t*p.y+t*t*b.y};addSegment(record,previous,q);previous=q;}
  }else if(dirs.length<=2){const d=dirs.find(d=>d.x)||dirs[0]||{x:1,y:0};addSegment(record,{x:p.x-d.x*.5,y:p.y-d.y*.5},{x:p.x+d.x*.5,y:p.y+d.y*.5});}
  else for(const d of dirs)addSegment(record,p,{x:p.x+d.x*.5,y:p.y+d.y*.5});
 }
 function nearest(record,p){if(!record.states.size)return null;if(record.legacy)return record.states.values().next().value;let position=0,error=Infinity;for(const s of record.segments){const q=project(p,s.a,s.b),d=distance(q,p);if(d<error){error=d;position=s.index+q.t;}}if(error>1.1)return null;
  let tile,best=Infinity;for(const i of record.states.keys()){const d=distance(point(i),p);if(d<best){best=d;tile=i;}}return best<=1.3?addState(record,tile,position):null;
 }
 for(const record of records.values())if(!record.legacy){nearest(record,record.points[0]);nearest(record,record.points.at(-1));}
 function join(a,b,p){if(a===b||a.legacy&&b.legacy)return;transfer(nearest(a,p),nearest(b,p),p);}
 const checked=new Set();
 for(const list of bins.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];if(a.record===b.record||a.record.legacy&&b.record.legacy)continue;const key=Math.min(a.id,b.id)+'/'+Math.max(a.id,b.id);if(checked.has(key))continue;checked.add(key);
  const u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},o={x:b.a.x-a.a.x,y:b.a.y-a.a.y},den=cross(u,v);
  if(Math.abs(den)>EPS){const t=cross(o,v)/den,s=cross(o,u)/den;if(t>=-EPS&&t<=1+EPS&&s>=-EPS&&s<=1+EPS)join(a.record,b.record,{x:a.a.x+u.x*t,y:a.a.y+u.y*t});}
  else if(Math.abs(cross(o,u))<EPS)for(const p of [a.a,a.b,b.a,b.b])if(distance(p,project(p,a.a,a.b))<EPS&&distance(p,project(p,b.a,b.b))<EPS)join(a.record,b.record,p);
 }
 // Explicit legacy tile-center endpoints remain junctions even when the
 // legacy quarter-turn rendering rounds its centerline away from that center.
 for(const record of records.values())if(!record.legacy)for(const p of [record.points[0],record.points.at(-1)])for(const key of byTile.get(Math.round(p.y)*48+Math.round(p.x))||[]){const target=states.get(key).record;if(target.legacy&&distance(p,target.points[0])<EPS)join(record,target,p);}
 // Match the renderer's forward-only endpoint extension inside existing pavement.
 for(const record of records.values())if(!record.legacy&&record.points.length>1)for(const end of [0,record.points.length-1]){
  const p=record.points[end],q=record.points[end?end-1:1],length=distance(p,q),dir={x:(p.x-q.x)/length,y:(p.y-q.y)/length};let best=Infinity,hit=null;
  const nearby=new Set();for(let y=Math.floor((p.y-1)/BIN);y<=Math.floor((p.y+1)/BIN);y++)for(let x=Math.floor((p.x-1)/BIN);x<=Math.floor((p.x+1)/BIN);x++)for(const s of bins.get(x+','+y)||[])nearby.add(s);
  for(const s of nearby){if(s.record===record)continue;const v={x:s.b.x-s.a.x,y:s.b.y-s.a.y},span=distance(s.a,s.b),den=cross(dir,v);if(Math.abs(den)<span*.15)continue;const o={x:s.a.x-p.x,y:s.a.y-p.y},d=cross(o,v)/den,t=cross(o,dir)/den;
   if(d<=EPS||d>1||d>=best||t< -EPS||t>1+EPS||d*Math.abs(den)/span>s.record.spec.width/8+.01)continue;best=d;hit={record:s.record,p:{x:p.x+dir.x*d,y:p.y+dir.y*d}};
  }if(hit)join(record,hit.record,hit.p);
 }
 for(const record of records.values()){
  if(record.legacy){for(const [tile,key]of record.states)for(const next of neighbors(tile)){const target=(byTile.get(next)||[]).find(k=>states.get(k).record.legacy);if(!target)continue;undirected.get(key).add(target);undirected.get(target).add(key);if(!record.spec.oneway||next>tile)link(key,target);}continue;}
  const nodes=[...record.nodes].sort((a,b)=>a[0]-b[0]);for(let n=1;n<nodes.length;n++){
   const [from,a]=nodes[n-1],[to,b]=nodes[n];let intact=true;for(let k=Math.ceil(from);k<=Math.floor(to);k++){const p=record.points[k],tile=Math.round(p.y)*48+Math.round(p.x);if(!record.states.has(tile)){intact=false;break;}}if(!intact)continue;
   link(a,b);if(!record.spec.oneway)link(b,a);else{undirected.get(a).add(b);undirected.get(b).add(a);}
  }
 }
 for(const record of records.values()){record.ordered=[...record.nodes].sort((a,b)=>a[0]-b[0]);record.geometryKey=JSON.stringify(record.points);}
 const graph=new Map([...byTile.keys()].map(tile=>[tile,[]])),reverseGraph=new Map([...byTile.keys()].map(tile=>[tile,[]]));
 for(const [key,edges]of forward)for(const tile of states.get(key).tiles)for(const next of edges)for(const other of states.get(next).tiles){if(!graph.get(tile).includes(other))graph.get(tile).push(other);if(!reverseGraph.get(other).includes(tile))reverseGraph.get(other).push(tile);}
 const selected=(tile,pathId)=> (byTile.get(tile)||[]).filter(key=>pathId===undefined||states.get(key).record.pathId===pathId);
 Object.defineProperty(graph,'hasSource',{value:(tile,pathId)=>selected(tile,pathId).length>0});
 function access(tile,pathId,p){return [...new Set(selected(tile,pathId).map(key=>states.get(key).record))].map(record=>{
  if(record.legacy)return {record,position:0,point:record.points[0],tile};let position=0,location=record.points[0],error=Infinity;for(const s of record.segments){const q=project(p,s.a,s.b),d=distance(p,q);if(d<error){error=d;position=s.index+q.t;location={x:q.x,y:q.y};}}return {record,position,point:location,tile};
 });}
 function interval(record,from,to,backwards=false,physical=false){if(record.legacy)return true;if(!physical&&record.spec.oneway&&(backwards?to>from+EPS:to<from-EPS))return false;
  const nodes=record.ordered,low=Math.min(from,to),high=Math.max(from,to);for(let n=1;n<nodes.length;n++){const [a,ak]=nodes[n-1],[b,bk]=nodes[n];if(b>low+EPS&&a<high-EPS&&!undirected.get(ak).has(bk))return false;}return true;
 }
 function anchors(a,backwards,physical=false){const nodes=a.record.ordered,exact=nodes.find(([p])=>Math.abs(p-a.position)<EPS);if(exact)return [exact[1]];const before=nodes.findLast(([p])=>p<a.position),after=nodes.find(([p])=>p>a.position);return [before,after].filter(node=>node&&interval(a.record,a.position,node[0],backwards,physical)).map(node=>node[1]);}

 function search(start,{pathId,point:originPoint,backwards=false,physical=false}={}){
  const links=physical?undirected:backwards?reverse:forward,parents=new Map(),origins=new Map(),accesses=originPoint?access(start,pathId,originPoint):[],queue=originPoint?[]:selected(start,pathId),ends=new Map(),result=new Map();
  for(const origin of accesses)for(const key of anchors(origin,backwards,physical))if(!origins.has(key)){queue.push(key);origins.set(key,origin);}for(const key of queue)parents.set(key,null);
  for(let n=0;n<queue.length;n++){const key=queue[n];for(const tile of states.get(key).tiles){if(!ends.has(tile))ends.set(tile,[]);ends.get(tile).push(key);if(!result.has(tile))result.set(tile,parents.get(key)===null?null:states.get(parents.get(key)).tile);}for(const next of links.get(key))if(!parents.has(next)){parents.set(next,key);queue.push(next);}}
  Object.defineProperties(result,{nodeParents:{value:parents},nodeEnds:{value:ends},startTile:{value:start},network:{value:api},origins:{value:origins},accesses:{value:accesses},backwards:{value:backwards},physical:{value:physical}});return result;
 }
 function finishTrace(nodes,tree,end){nodes=nodes.filter((node,i)=>!i||node.record!==nodes[i-1].record||distance(node.point,nodes[i-1].point)>EPS);const cells=nodes.map(n=>n.tile),sources=nodes.map(n=>n.record.key),positions=nodes.map(n=>n.point),joins=nodes.slice(0,-1).map((node,i)=>contacts.get(node.key)?.get(nodes[i+1].key)||contacts.get(nodes[i+1].key)?.get(node.key)||null);cells[0]=tree.startTile;cells[cells.length-1]=end;
  Object.defineProperties(cells,{sources:{value:sources},positions:{value:positions},joins:{value:joins},network:{value:api}});return cells;
 }
 function trace(tree,end,pathId,endPoint){
  let key,target;const targets=endPoint?access(end,pathId,endPoint):[];
  for(const to of targets){const from=tree.accesses?.find(from=>from.record===to.record&&interval(from.record,from.position,to.position,tree.backwards,tree.physical));if(from){const middle=from.record.ordered.filter(([p])=>p>Math.min(from.position,to.position)+EPS&&p<Math.max(from.position,to.position)-EPS).sort((a,b)=>(to.position>=from.position?1:-1)*(a[0]-b[0])).map(([,key])=>states.get(key));return finishTrace([from,...middle,to],tree,end);}}
  if(endPoint){for(const to of targets){key=anchors(to,!tree.backwards,tree.physical).find(key=>tree.nodeParents.has(key));if(key!==undefined){target=to;break;}}}else key=(tree.nodeEnds?.get(end)||[]).find(key=>pathId===undefined||states.get(key).record.pathId===pathId);
  if(key===undefined)return null;const keys=[];for(let at=key;at!==null;at=tree.nodeParents.get(at))keys.push(at);keys.reverse();const nodes=keys.map(key=>states.get(key)),origin=tree.origins?.get(keys[0]);if(origin)nodes.unshift(origin);if(target)nodes.push(target);return finishTrace(nodes,tree,end);
 }
 function validTrace(cells){if(!cells.sources)return cells.every((i,k)=>graph.has(i)&&(k===cells.length-1||graph.get(i).includes(cells[k+1])));if(cells.network===api)return true;
  for(let k=0;k<cells.length;k++){const record=records.get(cells.sources[k]),old=cells.network?.records.get(cells.sources[k]);if(!record||!record.mapping.has(cells[k])||record.geometryKey!==old?.geometryKey||!!record.spec.oneway!==!!old?.spec.oneway)return false;
   if(k&&cells.sources[k]===cells.sources[k-1]){const a=access(cells[k-1],record.pathId,cells.positions[k-1]).find(a=>a.record===record),b=access(cells[k],record.pathId,cells.positions[k]).find(a=>a.record===record);if(!a||!b||!interval(record,a.position,b.position))return false;}
  }return true;
 }
 function reverseTrace(cells){const result=[...cells].reverse();if(cells.sources)Object.defineProperties(result,{sources:{value:[...cells.sources].reverse()},positions:{value:[...cells.positions].reverse()},joins:{value:[...cells.joins].reverse()},network:{value:api}});return result;}
 function nearestSource(tile,p){let source,best=Infinity;for(const key of byTile.get(tile)||[]){const record=states.get(key).record;let error=Infinity;for(const s of record.segments)error=Math.min(error,distance(p,project(p,s.a,s.b)));if(error<best-EPS){best=error;source=record.pathId;}}return source;}
 let outside;
 function connected(){if(outside)return outside;const reached=new Set(),queue=[];for(const [tile,keys]of byTile)if(tile%48===0||tile%48===47||tile<48||tile>=2256)for(const key of keys){reached.add(key);queue.push(key);}for(let n=0;n<queue.length;n++)for(const next of undirected.get(queue[n]))if(!reached.has(next)){reached.add(next);queue.push(next);}
  const tiles=new Set([...reached].flatMap(key=>[...states.get(key).tiles])),raster=new Set(),ordered=[];world.tiles.forEach((t,i)=>{if(t.type==='road'&&(i%48===0||i%48===47||i<48||i>=2256)){raster.add(i);ordered.push(i);}});for(let n=0;n<ordered.length;n++)for(const i of neighbors(ordered[n]))if(world.tiles[i].type==='road'&&!raster.has(i)){raster.add(i);ordered.push(i);}
  // Preserve existing economic-stat iteration order for unchanged networks.
  outside=new Set([...ordered.filter(i=>tiles.has(i)),...[...tiles].filter(i=>!raster.has(i))]);Object.defineProperty(outside,'hasSource',{value:(tile,pathId)=>selected(tile,pathId).some(key=>reached.has(key))});return outside;
 }
 const attachment=(tile,pathId=nearestSource(tile,point(tile)),p=point(tile))=>access(tile,pathId,p)[0]||null;
 const api={records,states,byTile,graph,reverseGraph,search,trace,reverseTrace,nearestSource,connected,validTrace,attachment};cache.set(world,{stamp,specs:engine.ROADS,sample:engine.sampleRoad,value:api});return api;
}
const api={build,connectedRoads:(world,engine)=>build(world,engine).connected()};root.BoroughRoadConnectivity=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
