import './map-grid.js?v=166';
const G=globalThis.BoroughGrid;
// Three controls define an orthogonal grid in tile coordinates (20 m/tile).
// The third control contributes only depth along the first edge's normal.
const EPS=1e-7, LIMIT=47, BIN=4, HARD_BLOCK_LIMIT=32;
const point=p=>({x:p.x,y:p.y});
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=p=>finite(p)&&p.x>=-EPS&&p.y>=-EPS&&p.x<=G.last+EPS&&p.y<=G.last+EPS;
const bounded=p=>({x:Math.max(0,Math.min(G.last,p.x)),y:Math.max(0,Math.min(G.last,p.y))});
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const interpolate=(a,u,t)=>({x:a.x+u.x*t,y:a.y+u.y*t});

export function planRoadGrid(controls,{blockSize=4.8,roadWidth=2.45/4,maxBlocks=8}={}){
 const stage=Array.isArray(controls)?controls.length:0,base={ok:false,reason:'Choose the first corner.',paths:[],corners:[],width:0,depth:0,columns:0,rows:0,stage};
 const fail=reason=>({...base,reason});
 if(!Array.isArray(controls)||stage>3||controls.some(p=>!inside(p)))return fail('Keep every grid corner inside city limits.');
 if(!Number.isFinite(blockSize)||blockSize<=0||!Number.isFinite(roadWidth)||roadWidth<=0||!Number.isInteger(maxBlocks)||maxBlocks<1||maxBlocks>HARD_BLOCK_LIMIT)return fail('Choose a valid grid block size.');
 if(!stage)return base;
 const a=bounded(controls[0]);base.corners=[a];if(stage===1)return fail('Choose the end of the first edge.');
 const b=bounded(controls[1]),width=distance(a,b),minimum=roadWidth+1.6;
 base.width=width;base.corners=[a,b];if(width>EPS)base.paths=[[point(a),point(b)]];
 if(width<minimum-EPS)return fail('Make the grid wider so its blocks have room between streets.');
 const divisions=length=>Math.max(1,Math.min(Math.round(length/blockSize),Math.floor((length+EPS)/minimum)));
 const columns=divisions(width);base.columns=columns;
 if(columns>maxBlocks)return fail('Use at most '+maxBlocks+' blocks along each grid edge.');
 const u={x:(b.x-a.x)/width,y:(b.y-a.y)/width},normal={x:-u.y,y:u.x};
 if(stage===2)return {...base,ok:true,reason:'Choose the grid depth.',paths:[[point(a),point(b)]]};
 const signed=(controls[2].x-b.x)*normal.x+(controls[2].y-b.y)*normal.y,depth=Math.abs(signed),v={x:normal.x*Math.sign(signed),y:normal.y*Math.sign(signed)};
 const c=interpolate(a,v,depth),d=interpolate(b,v,depth);base.depth=depth;base.corners=[a,b,d,c];
 if(!inside(c)||!inside(d))return fail('The opposite grid corner is outside city limits.');
 if(depth<minimum-EPS)return fail('Make the grid deeper so its blocks have room between streets.');
 const rows=divisions(depth);base.rows=rows;
 if(rows>maxBlocks)return fail('Use at most '+maxBlocks+' blocks along each grid edge.');
 base.corners=base.corners.map(bounded);
 const [aa,bb,dd,cc]=base.corners;
 // A directed perimeter is a complete loop, including for one-way roads.
 const paths=[[aa,bb],[bb,dd],[dd,cc],[cc,aa]].map(line=>line.map(point));
 for(let row=1;row<rows;row++){
  const p=interpolate(a,v,depth*row/rows),q=interpolate(b,v,depth*row/rows);
  paths.push((row%2?[p,q]:[q,p]).map(bounded));
 }
 for(let column=1;column<columns;column++){
  const p=interpolate(a,u,width*column/columns),q=interpolate(c,u,width*column/columns);
  paths.push((column%2?[q,p]:[p,q]).map(bounded));
 }
 return {...base,ok:true,reason:'',paths};
}

// Retain real centerlines, never infer a street from authored raster tiles.
// The signature observes direct legacy edits too; the cache is not save data.
const geometryCache=new WeakMap();
function geometry(world,E){
 let signature=(world.roadEditRevision||0)+';';
 for(const p of world.roadPaths||[])signature+=JSON.stringify([p.id,p.type,p.controls])+';';
 for(const t of world.tiles)signature+=t.type==='road'?(t.pathIds?.length&&!t.legacyRoad?'a':JSON.stringify([t.roadType||'street',t.roadWidth])):'-';
 const cached=geometryCache.get(world);if(cached&&cached.signature===signature&&cached.specs===E.ROADS)return cached;
 const bins=new Map();let widest=0;
 function add(a,b,type,authored=true,legacyWidth){
  if(distance(a,b)<EPS)return;
  const spec=E.ROADS[type]||E.ROADS.street,width=legacyWidth??spec.width/4;widest=Math.max(widest,width);
  // Legacy one-way traffic follows increasing tile indices (east/south).
  if(!authored&&spec.oneway&&b.y*G.n+b.x<a.y*G.n+a.x)[a,b]=[b,a];
  const segment={a:point(a),b:point(b),width,oneway:!!spec.oneway,authored};
  for(let y=Math.floor(Math.min(a.y,b.y)/BIN);y<=Math.floor(Math.max(a.y,b.y)/BIN);y++)for(let x=Math.floor(Math.min(a.x,b.x)/BIN);x<=Math.floor(Math.max(a.x,b.x)/BIN);x++){
   const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(segment);
  }
 }
 for(const p of world.roadPaths||[]){
  const samples=p.controls.length===2?p.controls:E.sampleRoad(p.controls);
  for(let n=1;n<samples.length;n++)add(samples[n-1],samples[n],p.type);
 }
 for(let i=0;i<world.tiles.length;i++){
  const tile=world.tiles[i];if(tile.type!=='road'||tile.pathIds?.length&&!tile.legacyRoad)continue;
  const x=i%G.n,y=Math.floor(i/G.n),dirs=[],legacyWidth=!tile.roadType&&tile.roadWidth===2?3.15/4:undefined;
  for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(x+dx>=0&&x+dx<G.n&&y+dy>=0&&y+dy<G.n&&world.tiles[(y+dy)*G.n+x+dx].type==='road')dirs.push({x:dx,y:dy});
  if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].y*dirs[1].y===0){
   const a={x:x+dirs[0].x*.5,y:y+dirs[0].y*.5},b={x:x+dirs[1].x*.5,y:y+dirs[1].y*.5};let previous=a;
   for(let n=1;n<=12;n++){const t=n/12,s=1-t,p={x:s*s*a.x+2*s*t*x+t*t*b.x,y:s*s*a.y+2*s*t*y+t*t*b.y};add(previous,p,tile.roadType,false,legacyWidth);previous=p;}
  }else if(dirs.length<=2){
   const d=dirs.find(d=>d.x)||dirs[0]||{x:1,y:0};add({x:x-d.x*.5,y:y-d.y*.5},{x:x+d.x*.5,y:y+d.y*.5},tile.roadType,false,legacyWidth);
  }else for(const d of dirs)add({x,y},{x:x+d.x*.5,y:y+d.y*.5},tile.roadType,false,legacyWidth);
 }
 const result={signature,specs:E.ROADS,bins,widest};geometryCache.set(world,result);return result;
}
function nearby(index,a,b,width){
 const padding=(width+index.widest)/2+.2,result=new Set();
 for(let y=Math.floor((Math.min(a.y,b.y)-padding)/BIN);y<=Math.floor((Math.max(a.y,b.y)+padding)/BIN);y++)for(let x=Math.floor((Math.min(a.x,b.x)-padding)/BIN);x<=Math.floor((Math.max(a.x,b.x)+padding)/BIN);x++)for(const segment of index.bins.get(x+','+y)||[])result.add(segment);
 return result;
}
function merge(intervals){
 const out=[];for(const [lo,hi]of intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){const last=out.at(-1);if(last&&lo<=last[1]+EPS)last[1]=Math.max(last[1],hi);else out.push([lo,hi]);}return out;
}
function uncovered(line,index,spec){
 const [a,b]=line,length=distance(a,b),u={x:(b.x-a.x)/length,y:(b.y-a.y)/length},covered=[],offset=[];
 for(const segment of nearby(index,a,b,spec.width/4)){
  const p=segment.a,q=segment.b,pa=(p.x-a.x)*u.x+(p.y-a.y)*u.y,pb=(q.x-a.x)*u.x+(q.y-a.y)*u.y,lo=Math.max(0,Math.min(pa,pb)),hi=Math.min(length,Math.max(pa,pb));
  if(hi-lo<=EPS)continue;
  const da=(p.y-a.y)*u.x-(p.x-a.x)*u.y,db=(q.y-a.y)*u.x-(q.x-a.x)*u.y;
  if(Math.abs(da)<EPS&&Math.abs(db)<EPS){
   if(segment.oneway&&pb<pa)return {reason:'An existing one-way street runs against this grid edge.'};
   covered.push([lo,hi]);
  }else if(Math.abs(pb-pa)/distance(p,q)>.985&&Math.max(Math.abs(da),Math.abs(db))<(spec.width/4+segment.width)/2+.15)offset.push([lo,hi]);
 }
 if(merge(offset).some(([lo,hi])=>hi-lo>.5))return {reason:'A grid edge is too close and parallel to an existing street. Align their centerlines or move it clear.'};
 const retained=merge(covered),paths=[];let cursor=0;
 for(const [lo,hi]of retained){if(lo-cursor>EPS)paths.push([interpolate(a,u,cursor),interpolate(a,u,lo)]);cursor=Math.max(cursor,hi);}
 if(length-cursor>EPS)paths.push([interpolate(a,u,cursor),point(b)]);
 return {paths,retained:retained.length>0};
}
function scratchWorld(world,commit=false){
 const scratch={...world,tiles:commit?world.tiles.map(t=>({...t,...(t.pathIds?{pathIds:[...t.pathIds]}:{})})):world.tiles.slice(),roadPaths:[...(world.roadPaths||[])]};
 if(commit&&world.development)scratch.development={...world.development,parcels:Object.fromEntries(Object.entries(world.development.parcels).map(([id,p])=>[id,{...p,frame:{...p.frame,frontage:{...p.frame.frontage}}}]))};
 return scratch;
}
function previewApply(scratch,quote,type,index,copied,E){
 const id='grid-preview-'+index,path={id,type,controls:quote.controls,tiles:quote.tiles};
 for(const i of quote.tiles){
  if(!copied.has(i)){scratch.tiles[i]={...scratch.tiles[i],pathIds:[...(scratch.tiles[i].pathIds||[])]};copied.add(i);}
  const t=scratch.tiles[i];if(!t.pathIds.length)t.legacyRoad=t.type==='road';t.pathIds.push(id);t.type='road';delete t.zone;t.tree=false;t.level=1;t.roadType=type;t.roadWidth=E.ROADS[type].lanes>=4?2:1;
 }
 scratch.roadPaths.push(path);
}

export function quoteRoadGrid(world,plan,type,E,{zoneSides}={}){
 const base={ok:false,reason:'Choose all three grid corners.',cost:0,costComplete:false,newRoads:0,existingRoads:0,paths:[],quotes:[],plan},fail=reason=>({...base,reason});
 if(!plan?.ok||plan.stage!==3)return fail(plan?.reason||base.reason);
 if(!E?.ROADS?.[type])return fail('Choose a road type.');
 if(zoneSides!==undefined&&!['both','left','right','none'].includes(zoneSides))return fail('Choose which side can develop.');
 if(!Array.isArray(plan.paths)||plan.paths.length<4||plan.paths.length>2*HARD_BLOCK_LIMIT+2||plan.paths.some(p=>!Array.isArray(p)||p.length!==2||p.some(q=>!inside(q))||distance(p[0],p[1])<EPS))return fail('Choose a valid road grid.');
 const index=geometry(world,E),scratch=scratchWorld(world),copied=new Set();scratch.money=Number.MAX_SAFE_INTEGER;
 for(const line of plan.paths){
  const remainder=uncovered(line,index,E.ROADS[type]);if(remainder.reason)return fail(remainder.reason);
  if(remainder.retained)base.existingRoads++;
  for(const controls of remainder.paths){
   const q=E.roadQuote(scratch,controls,type);if(!q.ok)return fail(q.reason);
   const quote={controls:controls.map(point),points:q.points,tiles:q.tiles,cost:q.cost};
   base.quotes.push(quote);base.paths.push(quote.controls);base.cost+=q.cost;
   previewApply(scratch,quote,type,base.quotes.length,copied,E);
  }
 }
 base.newRoads=base.quotes.length;base.costComplete=true;
 if(!base.newRoads)return fail('This grid already follows existing streets.');
 if((world.roadPaths?.length||0)+base.newRoads>5000)return fail('This city has reached its road limit.');
 if(!Number.isFinite(world.money)||world.money<base.cost)return fail('Not enough funds for the whole grid.');
 return {...base,ok:true,reason:''};
}

export function buildRoadGrid(world,plan,type,E,options={}){
 const quote=quoteRoadGrid(world,plan,type,E,options);if(!quote.ok)return quote;
 // Engine placement operates on isolated road tiles and frontage frames.
 // Citizens, trips, existing roads and occupants never need a deep copy.
 const scratch=scratchWorld(world,true),roads=[],ids=new Set((world.roadPaths||[]).map(p=>p.id));
 for(const entry of quote.quotes){
  const result=E.buildRoadPath(scratch,entry.controls,type,options);
  if(!result.ok||result.cost!==entry.cost)return {...quote,ok:false,reason:result.reason||'The road grid changed. Preview it again.'};
  if(!result.path?.id||ids.has(result.path.id))return {...quote,ok:false,reason:'Could not assign unique street IDs. Try again.'};
  ids.add(result.path.id);roads.push(result.path);
 }
 // Keep references to existing tiles/lots intact for live simulation agents.
 const changed=new Set(roads.flatMap(p=>p.tiles));for(const i of changed){const target=world.tiles[i],next=scratch.tiles[i];for(const key of Object.keys(target))if(!(key in next))delete target[key];Object.assign(target,next);}
 world.roadPaths ||= [];world.roadPaths.push(...roads);world.money=scratch.money;
 if(world.development){
  for(const [id,p]of Object.entries(scratch.development.parcels)){const old=world.development.parcels[id].frame.frontage,next=p.frame.frontage;if(old.x!==next.x||old.z!==next.z||old.roadIndex!==next.roadIndex||old.pathId!==next.pathId)world.development.parcels[id].frame.frontage=next;}
  world.development.revision=scratch.development.revision;
 }
 return {...quote,roads};
}

geometry=G.bind(geometry);
scratchWorld=G.bind(scratchWorld);
quoteRoadGrid=G.bind(quoteRoadGrid);
buildRoadGrid=G.bind(buildRoadGrid);
