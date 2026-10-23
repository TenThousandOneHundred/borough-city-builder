import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {visualParcels} from '../dist/parcels.js';
import {lotPlan} from '../dist/building-plan.js';
const require=createRequire(import.meta.url),E=require('../dist/engine.js'),Z=require('../dist/zoning-layout.js');
function world(seed=8){const w=E.createWorld('Roadside lots','plains',seed);w.money=1e6;return w;}
function grow(w,n=100){for(let j=0;j<n;j++)E.tick(w);}
function utilities(w){E.place(w,1,23,'power');E.place(w,2,23,'water');}
test('straight zoning cells share the road tangent and select along the same road side',()=>{
 const w=world();E.buildRoadPath(w,[{x:12,y:24},{x:30,y:9}]);const cells=E.zoningLayout(w),path=[...cells.values()].filter(p=>p.source===w.roadPaths[0].id);assert.ok(path.length>30);
 for(const p of path){assert.ok(Math.abs(Math.cos(p.angle)*18-Math.sin(p.angle)*-15)>23,'cell frontage follows diagonal tangent');assert.equal(Z.hit(cells,p.cx,p.cz),p);}
 const a=path.find(p=>p.row===0),b=path.find(p=>p.side===a.side&&p.col===a.col+2&&p.row===1);assert.ok(b);const selection=E.zoneRectangle(w,{x:a.index%48,y:Math.floor(a.index/48)},{x:b.index%48,y:Math.floor(b.index/48)});assert.ok(selection.length>=4);for(const q of selection){const p=cells.get(q.y*48+q.x);assert.equal(p.source,a.source);assert.equal(p.side,a.side);}
});
test('curved zoning follows changing road tangents without overlapping cells',()=>{
 const w=world();E.buildRoadPath(w,[{x:12,y:24},{x:25,y:5},{x:39,y:24}]);const cells=[...E.zoningLayout(w).values()].filter(p=>p.source===w.roadPaths[0].id);assert.ok(cells.length>40);assert.ok(new Set(cells.map(p=>p.angle.toFixed(2))).size>10);
 for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++)assert.equal(Z.overlaps(cells[i],cells[j]),false);
 const old=E.zoningLayout(w);w.tiles[0].people=2;assert.equal(E.zoningLayout(w),old,'resident changes reuse the road layout');E.removeRoadPath(w,w.roadPaths[0].id);assert.notEqual(E.zoningLayout(w),old);
});
test('a single cell remains vacant; grouped cells construct and save one house with one population',()=>{
 const w=world();utilities(w);E.zoneCells(w,[{x:5,y:23}],'residential_low');grow(w,50);assert.equal(w.tiles[23*48+5].type,null);assert.equal(w.tiles[23*48+5].construction,undefined);
 E.zoneCells(w,[{x:5,y:22},{x:6,y:23},{x:6,y:22}],'residential_low');grow(w);const homes=w.tiles.flatMap((t,i)=>t.zoneSite?[i]:[]);assert.ok(homes.length>0);const owner=homes[0],t=w.tiles[owner];assert.equal(t.building,'cottage');assert.ok(t.zoneSite.members.length>=2);assert.ok(E.valid(w));
 for(const i of t.zoneSite.members)if(i!==owner){assert.equal(w.tiles[i].people,0);assert.equal(w.tiles[i].level,0);assert.equal(w.tiles[i].zoneOwner,owner);}
 const copy=JSON.parse(JSON.stringify(w));assert.ok(E.valid(copy));const p=visualParcels(copy).get(owner);assert.deepEqual(p.members,t.zoneSite.members);assert.ok(Math.abs(lotPlan(copy,owner,p).angle-t.zoneSite.oriented.angle)<1e-9);
 const member=t.zoneSite.members.find(i=>i!==owner),before=w.money;assert.ok(E.place(w,member%48,Math.floor(member/48),'bulldoze').ok);assert.equal(w.money,before-10);for(const i of p.members){assert.equal(w.tiles[i].type,null);assert.equal(w.tiles[i].zoneOwner,undefined);}assert.ok(E.valid(w));
});
test('row houses and apartments develop as distinct saved housing types',()=>{
 for(const [zone,building]of [['residential_row','townhouse'],['residential_medium','apartments'],['residential_high','tower']]){const w=world();utilities(w);E.zoneCells(w,E.rectangleCells({x:6,y:21},{x:10,y:23}),zone);grow(w);const sites=w.tiles.filter(t=>t.zoneSite&&t.type);assert.ok(sites.length);assert.ok(sites.every(t=>t.building===building));assert.ok(sites.every(t=>t.zoneSite.members.length>=(zone==='residential_row'?2:4)));assert.ok(E.valid(w));}
});
test('a reserved lot cannot be cut by a road, footpath or service; dezone cancels the entire construction',()=>{
 const w=world();utilities(w);E.zoneCells(w,E.rectangleCells({x:6,y:21},{x:9,y:23}),'residential_high');let site;for(let j=0;j<100&&!site;j++){E.tick(w);site=w.tiles.find(t=>t.construction&&t.zoneSite)?.zoneSite;}assert.ok(site);const member=site.members.find(i=>i!==site.owner),x=member%48,y=Math.floor(member/48);
 assert.equal(E.place(w,x,y,'park').ok,false);assert.equal(E.facilityQuote(w,x,y,'hospital',{building:'clinic'}).ok,false);assert.equal(E.roadQuote(w,[{x,y},{x:x+1,y}]).ok,false);assert.equal(E.walkQuote(w,[{x,y},{x:x+1,y}]).ok,false);
 E.zoneCells(w,[{x,y}],'erase');for(const i of site.members){assert.equal(w.tiles[i].zoneOwner,undefined);assert.equal(w.tiles[i].construction,undefined);}assert.ok(E.valid(w));
});
test('corrupt or orphaned lot ownership is rejected on import',()=>{const w=world();w.tiles[20].zoneOwner=20;assert.equal(E.valid(w),false);delete w.tiles[20].zoneOwner;utilities(w);E.zoneCells(w,E.rectangleCells({x:6,y:21},{x:9,y:23}),'residential_high');grow(w);const t=w.tiles.find(t=>t.zoneSite);assert.ok(t);t.zoneSite.members.push(3000);assert.equal(E.valid(w),false);});

test('separately developed curved-road lots never overlap and each keeps its road-facing boundary',()=>{const w=world();utilities(w);E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);for(const [i,p]of E.zoningLayout(w))if(p.source===w.roadPaths[0].id)E.zoneCells(w,[{x:i%48,y:Math.floor(i/48)}],'residential_low');grow(w);const sites=w.tiles.filter(t=>t.zoneSite).map(t=>t.zoneSite);assert.ok(sites.length>5);for(let i=0;i<sites.length;i++){assert.ok(sites[i].oriented.frontage.pathId);for(let j=0;j<i;j++)assert.equal(Z.overlaps(sites[i].oriented,sites[j].oriented),false);}assert.ok(E.valid(w));});

test('zoning overlay batches hundreds of cells while retaining their geometry and colors',async()=>{const THREE=await import('../dist/vendor/three.module.js'),{CityView}=await import('../dist/renderer.js'),group=new THREE.Group();let vertices=0;for(let i=0;i<300;i++){const geometry=new THREE.PlaneGeometry(3.82,3.82,2,2);geometry.translate(i%30*4,Math.floor(i/30)*4,0);vertices+=geometry.attributes.position.count;group.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:i%2?'#74bb54':'#39a875',opacity:.44,transparent:true})));}CityView.prototype.batchZonePlanes.call({},group);assert.equal(group.children.length,2);assert.equal(group.children.reduce((n,m)=>n+m.geometry.attributes.position.count,0),vertices);assert.equal(new Set(group.children.map(m=>m.material.color.getHex())).size,2);});

test('zoning cell footprints stay clear of crossing streets, not only their center tiles',()=>{const w=world();E.buildRoadPath(w,[{x:19,y:24},{x:36,y:9}],'street');E.buildRoadPath(w,[{x:25,y:8},{x:25,y:34}],'boulevard');const cells=E.zoningLayout(w);let violations=0;for(const p of cells.values())for(const path of w.roadPaths){const points=E.sampleRoad(path.controls);for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],dx=(b.x-a.x)*4,dz=(b.y-a.y)*4,road={cx:(a.x+b.x+1)*2-96,cz:(a.y+b.y+1)*2-96,angle:Math.atan2(-dz,dx),width:Math.hypot(dx,dz),depth:E.ROADS[path.type].width+.6};if(Z.overlaps(p,road)){violations++;break;}}}assert.equal(violations,0,'no cell edge crosses the road surface or sidewalk');});

test('crossing highways block zoning footprints without creating their own frontage',()=>{const w=world();E.buildRoadPath(w,[{x:19,y:24},{x:36,y:9}],'street');E.buildRoadPath(w,[{x:25,y:8},{x:25,y:34}],'highway');const highway=w.roadPaths[1],cells=[...E.zoningLayout(w).values()],road={cx:6,cz:-10,angle:-Math.PI/2,width:104,depth:E.ROADS.highway.width+.6};assert.ok(cells.length>50);for(const p of cells){assert.notEqual(p.source,highway.id);assert.equal(Z.overlaps(p,road),false);}});

test('allocation-free layout checks detect every road and ground edit, including in-place path changes',()=>{
 const base=world();E.buildRoadPath(base,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);
 const changes=[
  w=>{w.tiles[22*48+8].ground='water';},
  w=>{w.tiles[24*48+8].type=null;},
  w=>{w.tiles[24*48+8].roadType='highway';},
  w=>{delete w.tiles[24*48+8].roadType;w.tiles[24*48+8].roadWidth=2;},
  w=>{w.tiles[24*48+8].legacyRoad=false;},
  w=>{w.tiles[24*48+8].pathIds=['new-path'];},
  w=>{const t=w.tiles.find(t=>t.pathIds?.length);t.pathIds.push('another-path');},
  w=>{const t=w.tiles.find(t=>t.pathIds?.length);t.pathIds[0]='changed-path';},
  w=>{w.roadPaths[0].controls[1].y+=2;},
  w=>{w.roadPaths[0].type='avenue';},
  w=>{w.roadPaths[0].tiles.reverse();}
 ];
 for(const change of changes)for(const options of [{},{cellSize:1.6,rows:6,independent:true}]){
  const w=structuredClone(base),first=Z.layout(w,E.ROADS,options);assert.equal(Z.layout(w,E.ROADS,options),first);change(w);const actual=Z.layout(w,E.ROADS,options);assert.notEqual(actual,first);assert.deepEqual(actual,Z.layout(structuredClone(w),E.ROADS,options));
 }
 const w=structuredClone(base),first=Z.layout(w,E.ROADS);w.money-=123;w.tiles[0].people=5;w.tiles[0].type='residential';w.tiles=w.tiles.map(t=>({...t}));assert.equal(Z.layout(w,E.ROADS),first,'population, non-road occupancy and equivalent tile copies do not change road geometry');
});
