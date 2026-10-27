import assert from 'node:assert/strict';

function normalize(E,w,name){
 w.id='economy135-'+name;w.name='Economy benchmark '+name;w.money=1e8;
 for(const [i,p]of (w.roadPaths||[]).entries()){const old=p.id;p.id='economy135-road-'+i;for(const t of w.tiles)if(t.pathIds)t.pathIds=t.pathIds.map(id=>id===old?p.id:id);}
 assert.ok(E.valid(w),name+' initial world must validate');return w;
}
export function economicFixture(E,name){
 const w=E.createWorld(name,'plains',name==='starter_curve'?8:321);w.money=1e8;
 if(name==='starter_curve'){
  assert.ok(E.buildRoadPath(w,[{x:19,y:24},{x:23,y:14},{x:36,y:19}],'street').ok);return normalize(E,w,name);
 }
 if(name==='populated_grid'){
  for(const t of w.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});
  for(let y=6;y<=36;y+=6)for(let x=0;x<48;x++)Object.assign(w.tiles[y*48+x],{type:'road',roadType:'street',level:1});
  for(let x=6;x<46;x+=6)for(let y=6;y<=36;y++)Object.assign(w.tiles[y*48+x],{type:'road',roadType:'street',level:1});
  for(let y=7;y<=37;y+=6)for(let x=2;x<46;x++){
   if(w.tiles[y*48+x].type)continue;const type=x%3?'residential':x%2?'commercial':'office';
   Object.assign(w.tiles[y*48+x],{type,level:3,people:type==='residential'?24:0,density:'medium'});
  }
  for(let i=0;i<8;i++)Object.assign(w.tiles[5*48+2+i*5],{type:i%2?'water':'power',building:i%2?'treatment':'substation',level:1,people:0});
  const cells=[...E.zoningLayout(w).values()].filter(p=>!w.tiles[p.index].type).filter((_,i)=>i%2===0).map(p=>({x:p.index%48,y:Math.floor(p.index/48)}));
  E.zoneCells(w,cells,'residential_medium');return normalize(E,w,name);
 }
 if(name==='fine_growth'||name==='mixed_edits'){
  assert.ok(E.buildRoadPath(w,[{x:19,y:24},{x:44,y:24}],'street').ok);
  assert.ok(E.buildRoadPath(w,[{x:24,y:24},{x:24,y:10},{x:38,y:12}],'street').ok);
  for(const [x,type,building]of [[6,'power','substation'],[9,'water','treatment']])Object.assign(w.tiles[23*48+x],{type,building,level:1,people:0,tree:false});
  // Road IDs must be stable before cell IDs and frontage plans are generated.
  normalize(E,w,name);
  if(name==='mixed_edits')assert.ok(E.zoneCells(w,E.rectangleCells({x:2,y:21},{x:14,y:23}),'residential_medium').ok);
  const cells=[...E.fineZoningLayout(w).values()].filter(p=>p.row<3&&(name!=='mixed_edits'||p.cx>-16));
  E.fineZoneCells(w,cells.filter(p=>p.side===-1).map(p=>p.id),'residential_medium');
  E.fineZoneCells(w,cells.filter(p=>p.side===1).map(p=>p.id),'commercial_low');
  return normalize(E,w,name);
 }
 throw Error('Unknown fixture '+name);
}

// Mutations occur between ticks, exercising road/layout invalidation without
// random path IDs or a reference build as a CI dependency.
export function editEconomy(E,w,tick){
 const i=24*48,p=w.roadPaths[0];
 if(tick===12)w.tiles[i].type=null;
 if(tick===28)w.tiles[i].type='road';
 if(tick===40)w.tiles[i+8].type=null;
 if(tick===45)w.tiles[i+8].type='road';
 if(tick===60||tick===68)assert.ok(E.setRoadZoning(w,JSON.stringify(['path',p.id]),tick===60?'none':'both').ok);
 if(tick===78||tick===82)w.tiles[20*48+3].ground=tick===78?'water':'land';
 const power=w.tiles[23*48+6];
 if(tick===96){power.type=null;delete power.building;}
 if(tick===103){power.type='power';power.building='substation';}
}
