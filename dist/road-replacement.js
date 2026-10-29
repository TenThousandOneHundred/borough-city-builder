(function(root){
'use strict';
const G=typeof module!=='undefined'?require('./map-grid.js'):root.BoroughGrid;
const Roundabouts=typeof module!=='undefined'?require('./roundabout-state.js'):root.BoroughRoundabouts;
const Z=typeof module!=='undefined'?require('./zoning-layout.js'):root.BoroughZoning;
const B=typeof module!=='undefined'?require('./building-entities.js'):root.BoroughBuildings;
const F=typeof module!=='undefined'?require('./fine-zoning-state.js'):root.BoroughFineZones;
const keyFor=id=>JSON.stringify(['path',id]);
function target(world,key,engine){
 let parsed;try{parsed=JSON.parse(key);}catch{return null;}if(!Array.isArray(parsed)||parsed.length!==2)return null;
 if(parsed[0]==='path'){const p=world.roadPaths?.find(p=>p.id===parsed[1]);return p?{id:key,kind:'path',source:p.id,type:p.type,controls:p.controls,tiles:p.tiles,zoneSides:p.zoneSides||'both'}:null;}
 if(parsed[0]!=='legacy'||!Number.isInteger(parsed[1]))return null;const t=engine.roadZoningTargets(world,parsed[1]).find(t=>t.kind==='legacy');if(!t)return null;
 // Preserve different side policies: replace only the contiguous part sharing
 // this tile's policy. Old tile streets become a proper sampled road segment.
 const mode=world.tiles[parsed[1]].zoneSides||'both',anchor=t.tiles.indexOf(parsed[1]);let lo=anchor,hi=anchor;
 while(lo>0&&(world.tiles[t.tiles[lo-1]].zoneSides||'both')===mode)lo--;
 while(hi<t.tiles.length-1&&(world.tiles[t.tiles[hi+1]].zoneSides||'both')===mode)hi++;
 const tiles=t.tiles.slice(lo,hi+1),vertical=t.controls[0].x===t.controls[1].x,step=vertical?G.n:1,point=i=>({x:i%G.n,y:Math.floor(i/G.n)}),a=point(tiles[0]),b=point(tiles.at(-1)),axis=vertical?'y':'x';
 // Reach the neighboring intersection center; free ends reach the cell edge.
 for(const [p,i,sign]of [[a,tiles[0],-1],[b,tiles.at(-1),1]]){const n=i+sign*step,inside=n>=0&&n<G.count&&(vertical||Math.floor(n/G.n)===Math.floor(i/G.n));p[axis]=Math.max(0,Math.min(G.last,p[axis]+sign*(inside&&world.tiles[n].type==='road'?1:.45)));}
 return {...t,controls:[a,b],tiles,zoneSides:mode};
}
function footprint(controls,spec,engine){
 const points=engine.sampleRoad(controls),set=new Set();let last;
 for(const p of points){const tile={x:Math.round(p.x),y:Math.round(p.y)};for(const q of last?engine.lineTiles(last,tile):[tile])set.add(q.y*G.n+q.x);last=tile;const radius=(spec.width+.6)/8;
  for(let y=Math.max(0,Math.floor(p.y-radius));y<=Math.min(G.last,Math.ceil(p.y+radius));y++)for(let x=Math.max(0,Math.floor(p.x-radius));x<=Math.min(G.last,Math.ceil(p.x+radius));x++)if(Math.hypot(x-p.x,y-p.y)<radius)set.add(y*G.n+x);
 }return {points,tiles:[...set]};
}
function quote(world,key,type,engine,{demolish=false}={}){
 const road=target(world,key,engine),spec=engine.ROADS[type];if(!road||!spec)return {ok:false,reason:'Select an existing road and its replacement type.',conflicts:[]};
 const {points,tiles}=footprint(road.controls,spec,engine);if(world.land&&points.some(p=>!root.BoroughLand.ownsPoint(world,(p.x+.5)*4-G.half,(p.y+.5)*4-G.half,(spec.width+(spec.sidewalk?.8:0))/2)))return {ok:false,reason:'Buy this land before widening the road.',conflicts:[]};const rectangles=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=(b.x-a.x)*4,dz=(b.y-a.y)*4,length=Math.hypot(dx,dz);if(length>1e-8)rectangles.push({cx:(a.x+b.x+1)*2-G.half,cz:(a.y+b.y+1)*2-G.half,angle:Math.atan2(-dz,dx),width:length+.03,depth:spec.width+(spec.sidewalk?.8:0)});}
 const conflicts=[],intersects=f=>rectangles.some(r=>Z.overlaps(r,f)),affected=new Set(tiles);
 for(const [id,t]of B.entries(world)){
  if(!t.construction&&(!t.type||['road','path'].includes(t.type)))continue;
  let frame;if(typeof id==='string')frame=B.parcel(world,id).frame;
  else if(t.zoneSite)frame=t.zoneSite.oriented;
  else{const width=(t.facilitySite?.width||1)*4,depth=(t.facilitySite?.depth||1)*4;frame={cx:(id%G.n+.5)*4-G.half+(width-4)/2,cz:(Math.floor(id/G.n)+.5)*4-G.half+(depth-4)/2,width,depth,angle:0};}
  if(intersects(frame)||typeof id==='number'&&(t.zoneSite?.members||engine.facilityCells(world,id)).some(i=>affected.has(i)))conflicts.push({id,frame,people:t.people||0,name:engine.BUILDINGS[t.building]?.name||engine.TOOLS[t.type]?.name||'Construction site'});
 }
 const length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0),bridge=tiles.filter(i=>world.tiles[i].ground==='water').length/Math.max(1,tiles.length),rate=Math.max(10,spec.cost*.25+Math.max(0,spec.cost-engine.ROADS[road.type].cost)),roadCost=Math.ceil(length*rate*(1+3*bridge)),cost=roadCost+conflicts.length*10;
 const roundabout=Roundabouts.hits(world,points),unchanged=road.type===type,walkway=tiles.some(i=>world.tiles[i].type==='path'),reason=roundabout?'Remove the roundabout before replacing this connecting road.':unchanged?'This section already uses that road type.':walkway?'Remove the pedestrian path crossing this section first.':conflicts.length&&!demolish?'Replacement needs space occupied by '+conflicts.length+' building lot'+(conflicts.length===1?'':'s')+'.':world.money<cost?'Not enough funds for this replacement.':'';
 return {ok:!reason,reason,target:road,type,controls:road.controls,points,tiles,conflicts,roadCost,cost,residentsAffected:conflicts.reduce((n,c)=>n+c.people,0)};
}
function replace(world,key,type,engine,options={}){
 const plan=quote(world,key,type,engine,options);if(!plan.ok)return plan;const old=plan.target,oldTiles=new Set(old.tiles),newTiles=new Set(plan.tiles),legacy=old.kind==='legacy',state=world.development;
 const paint=legacy&&state?[...F.grid(world,engine.ROADS).values()].filter(p=>p.source.startsWith('legacy-')&&oldTiles.has(p.roadIndex)&&state.cells[p.id]&&!state.cells[p.id].owner).map(p=>({frame:p,zone:state.cells[p.id].zone})):[];
 // Quote and application are synchronous. All failure conditions are checked
 // before any funds, occupancy or road ownership are changed.
 for(const conflict of plan.conflicts){const id=conflict.id;if(typeof id==='string')engine.demolishFineParcel(world,id);else engine.place(world,id%G.n,Math.floor(id/G.n),'bulldoze');}
 world.money-=plan.roadCost;
 const id=legacy?(globalThis.crypto?.randomUUID?.()||'r'+Date.now()+Math.random()):old.source;
 const path=legacy?{id,type,controls:old.controls.map(p=>({...p})),tiles:plan.tiles}:world.roadPaths.find(p=>p.id===id);
 if(legacy){world.roadPaths ||= [];if(old.zoneSides!=='both')path.zoneSides=old.zoneSides;world.roadPaths.push(path);}else{path.type=type;path.tiles=plan.tiles;}
 for(const i of new Set([...old.tiles,...plan.tiles])){
  const t=world.tiles[i];if(newTiles.has(i)){const wasRoad=t.type==='road';if(!t.pathIds?.length)t.legacyRoad=wasRoad&&!(legacy&&oldTiles.has(i));if(legacy&&oldTiles.has(i)){t.legacyRoad=false;delete t.zoneSides;}t.pathIds ||= [];if(!t.pathIds.includes(id))t.pathIds.push(id);t.type='road';t.level=1;t.people=0;t.tree=false;delete t.zone;delete t.building;delete t.construction;}
  else t.pathIds=(t.pathIds||[]).filter(p=>p!==id);
  if(t.pathIds?.length){const last=world.roadPaths.find(p=>p.id===t.pathIds.at(-1));t.roadType=last.type;t.roadWidth=engine.ROADS[last.type].lanes>=4?2:1;}
  else if(!t.legacyRoad){t.type=t.walkPathIds?.length?'path':null;t.level=t.type?1:0;delete t.roadType;delete t.roadWidth;delete t.pathIds;delete t.legacyRoad;}
 }
 // Existing legacy parcels keep their saved frontage and identity. New paint
 // follows the sampled road; occupied old cells still exclude their real lots.
 if(legacy&&state){
  if(paint.length){for(const p of paint)delete state.cells[p.frame.id];const layout=engine.fineZoningLayout(world);for(const p of layout.values())if(p.source===id&&!state.cells[p.id]?.owner){const match=paint.find(old=>{const f=old.frame,dx=p.cx-f.cx,dz=p.cz-f.cz,c=Math.cos(f.angle),s=Math.sin(f.angle);return Math.abs(dx*c-dz*s)<=f.width/2+.001&&Math.abs(dx*s+dz*c)<=f.depth/2+.001;});if(match)state.cells[p.id]={zone:match.zone};}}
  state.revision++;
 }
 world.roadEditRevision=(world.roadEditRevision||0)+1;
 return {ok:true,cost:plan.cost,path,legacy,removed:plan.conflicts.map(c=>c.id),targetId:keyFor(id)};
}
target=G.bind(target);
quote=G.bind(quote);
replace=G.bind(replace);

const api={target,footprint,quote,replace};if(typeof module!=='undefined')module.exports=api;else root.BoroughRoadReplacement=api;
})(globalThis);
