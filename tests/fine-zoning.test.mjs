import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),E=require('../dist/engine.js'),Z=require('../dist/zoning-layout.js'),F=require('../dist/fine-zoning-state.js');
function fixture(){const w=E.createWorld('Fine zoning','plains',8);w.money=1e6;return w;}
function paintAll(w){const layout=F.grid(w,E.ROADS),state=F.create();F.paint(state,layout,[...layout.keys()],'residential_low');return {layout,state};}
test('lot reservation only looks up its own cells and observes missing or repainted neighbors',()=>{
 const {state,layout}=paintAll(fixture()),start=[...layout.values()].find(p=>p.row===0&&F.reserve(structuredClone(state),layout,p.id,2,3));
 assert.ok(start);let reads=0;const originalGet=layout.get.bind(layout);layout.get=id=>{reads++;return originalGet(id);};
 layout.values=()=>{throw Error('Reservation must not scan the city grid');};
 const p=F.reserve(state,layout,start.id,2,3);assert.ok(p);assert.equal(reads,7);assert.equal(p.cells.length,6);assert.ok(F.valid(state));
 F.release(state,p.id);const neighbor=p.cells[1],cell=originalGet(neighbor);layout.delete(neighbor);assert.equal(F.reserve(state,layout,start.id,2,3),null);
 layout.set(neighbor,cell);state.cells[neighbor].zone='commercial_low';assert.equal(F.reserve(state,layout,start.id,2,3),null);
 state.cells[neighbor].zone='residential_low';assert.ok(F.reserve(state,layout,start.id,2,3));assert.ok(F.valid(state));
});
test('8-metre cells have independent stable IDs and several cells can share a terrain tile',()=>{const w=fixture(),legacy=E.zoningLayout(w),layout=F.grid(w,E.ROADS),counts=new Map();assert.ok(layout.size>legacy.size);for(const [id,p]of layout){assert.equal(id,p.id);assert.equal(p.width,1.6);assert.equal(p.depth,1.6);assert.equal(Z.hit(layout,p.cx,p.cz),p);counts.set(p.index,(counts.get(p.index)||0)+1);}assert.ok([...counts.values()].some(n=>n>=3));assert.equal(E.zoningLayout(w),legacy);assert.equal(F.grid(w,E.ROADS),layout);assert.deepEqual([...F.grid(structuredClone(w),E.ROADS).keys()],[...layout.keys()]);});
test('independent fine cells follow curved roads and avoid every other cell',()=>{const w=fixture();E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);const cells=[...F.grid(w,E.ROADS).values()];assert.ok(cells.some(p=>p.source===w.roadPaths[0].id));for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++)assert.equal(Z.overlaps(cells[i],cells[j]),false);});
test('two independent saved parcels can occupy different parts of one terrain tile',()=>{const w=fixture(),before=JSON.stringify(w),{state,layout}=paintAll(w);for(const p of layout.values())if(p.row===0)F.reserve(state,layout,p.id,1,2);assert.ok(Object.keys(state.parcels).length>10);assert.ok([...F.terrainOccupancy(state).values()].some(ids=>ids.size>1));assert.ok(F.valid(state));const copy=JSON.parse(JSON.stringify(state));assert.ok(F.valid(copy));assert.deepEqual(copy,state);assert.equal(JSON.stringify(w),before);const parcel=Object.values(copy.parcels)[0],other=JSON.stringify(copy.parcels[Object.keys(copy.parcels)[1]]);assert.equal(F.paint(copy,layout,parcel.cells,null).changed,0);assert.ok(F.release(copy,parcel.id));assert.equal(F.paint(copy,layout,parcel.cells,null).changed,parcel.cells.length);assert.equal(JSON.stringify(copy.parcels[Object.keys(copy.parcels)[0]]),other);assert.ok(F.valid(copy));});
test('fine parcel geometry and ownership reject invalid sizes, orphan owners and overlap',()=>{const w=fixture(),{state,layout}=paintAll(w);for(const p of layout.values())if(p.row===0)F.reserve(state,layout,p.id,2,3);assert.ok(F.valid(state));const ids=Object.keys(state.parcels);assert.ok(ids.length>2);for(const mutate of [s=>s.parcels[ids[0]].frame.width+=1,s=>s.parcels[ids[0]].cells.push('unknown'),s=>s.parcels[ids[0]].cells=4,s=>s.cells[Object.keys(s.cells)[0]].owner='missing',s=>s.parcels[ids[1]].frame=structuredClone(s.parcels[ids[0]].frame),s=>s.nextParcel=1]){const copy=structuredClone(state);mutate(copy);assert.equal(F.valid(copy),false);}assert.equal(F.reserve(state,layout,[...layout.keys()][0],7,2),null);});
test('reserved lot geometry remains independently saveable after its road is removed',()=>{const w=fixture();E.buildRoadPath(w,[{x:19,y:24},{x:36,y:10}]);const {state,layout}=paintAll(w);const first=[...layout.values()].find(p=>p.source===w.roadPaths[0].id&&p.row===0&&F.reserve(state,layout,p.id,1,2));assert.ok(first);const saved=JSON.stringify(state.parcels);E.removeRoadPath(w,w.roadPaths[0].id);F.grid(w,E.ROADS);assert.equal(JSON.stringify(state.parcels),saved);assert.ok(F.valid(state));});
test('short coherent blocks allow multi-cell lots on both sides of a curved street',()=>{const w=fixture();w.tiles.forEach(t=>Object.assign(t,{type:null,level:0,ground:'land'}));E.buildRoadPath(w,[{x:10,y:25},{x:26,y:8},{x:40,y:26}]);const {state,layout}=paintAll(w),sides=new Set();for(const p of layout.values())if(p.row===0&&F.reserve(state,layout,p.id,2,3))sides.add(p.side);assert.deepEqual([...sides].sort(),[-1,1]);for(const p of layout.values())for(const road of w.roadPaths){const points=E.sampleRoad(road.controls);for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],dx=(b.x-a.x)*4,dz=(b.y-a.y)*4;assert.equal(Z.overlaps(p,{cx:(a.x+b.x+1)*2-96,cz:(a.y+b.y+1)*2-96,angle:Math.atan2(-dz,dx),width:Math.hypot(dx,dz),depth:E.ROADS[road.type].width+.6}),false);}}});
test('fine save validation rejects malformed maps without throwing',()=>{for(const value of [null,1,'cells',[],false]){const state=F.create();state.cells=value;assert.equal(F.valid(state),false);state.cells={};state.parcels=value;assert.equal(F.valid(state),false);}});

test('player rectangle, brush and fill use independent roadside cell IDs',()=>{
 const w=E.createWorld('Fine tools','plains',8),layout=E.fineZoningLayout(w),first=[...layout.values()].find(p=>p.row===0&&p.cx>-75&&p.cx<-60),end=[...layout.values()].find(p=>p.source===first.source&&p.side===first.side&&p.col===first.col+2&&p.row===2);assert.ok(end);
 const tiles=JSON.stringify(w.tiles),rectangle=E.fineZoneRectangle(w,first,end),brush=E.fineZoneBrush(w,first,3);assert.equal(rectangle.length,9);assert.deepEqual(new Set(brush),new Set(rectangle));assert.equal(E.fineZoneCells(w,rectangle,'residential_medium').changed,9);assert.equal(JSON.stringify(w.tiles),tiles);assert.deepEqual(new Set(E.fineZoneFill(w,first)),new Set(rectangle));
 const stroke=E.fineZoneStroke(w,first,end,1);assert.ok(stroke.length>=3);assert.equal(new Set(stroke).size,stroke.length);assert.ok(stroke.every(id=>typeof id==='string'&&layout.has(id)));assert.ok(E.valid(w));assert.equal(E.fineZoneCells(w,rectangle,'erase').changed,9);
});

test('player zoning tools can erase legacy zoning without creating new coarse cells or changing fine lots',()=>{
 const w=fixture(),old={x:5,y:23,legacy:true};assert.ok(E.zoneCells(w,[old,{x:6,y:23}],'residential_low').ok);const grid=E.fineZoningLayout(w),p=[...grid.values()].find(p=>p.row===0&&p.cx>-50&&p.cx<-40);assert.ok(p);assert.ok(E.playerZoneCells(w,[p.id],'commercial_low').ok);const state=JSON.stringify(w.development),selection=E.playerZoneBrush(w,old,4);assert.ok(selection.length);assert.ok(selection.every(p=>w.tiles[p.y*48+p.x].zone));assert.ok(E.playerZoneFill(w,old).length>=2);assert.ok(E.playerZoneStroke(w,old,{x:6,y:23,legacy:true},1).length>=2);assert.ok(E.playerZoneRectangle(w,old,{x:6,y:23,legacy:true}).length>=2);assert.ok(E.playerZoneCells(w,selection,'erase').ok);assert.equal(w.tiles[23*48+5].zone,undefined);assert.equal(w.tiles[23*48+6].zone,undefined);assert.equal(JSON.stringify(w.development),state);assert.equal(E.playerZoneCells(w,[{x:7,y:23}],'residential_low').changed,0);assert.ok(E.valid(w));
});

test('curves, crossings and service footprints leave no paintable cells behind missing frontage',()=>{
 const w=fixture();E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);E.buildRoadPath(w,[{x:30,y:8},{x:30,y:31}],'avenue');
 for(const layout of [F.grid(w,E.ROADS),E.fineZoningLayout(w)]){assert.ok(layout.size>100);for(const p of layout.values())for(let row=0;row<p.row;row++)assert.ok(layout.has(JSON.stringify([p.source,p.side,p.col,row])),`${p.id} has continuous road frontage`);}
 const candidate=[...E.fineZoningLayout(w).values()].find(p=>p.row===0&&p.index%48>3);assert.ok(candidate);w.tiles[candidate.index].type='park';
 const layout=E.fineZoningLayout(w);assert.ok(!layout.has(candidate.id));for(const p of layout.values())if(p.row>0)assert.ok(layout.has(JSON.stringify([p.source,p.side,p.col,p.row-1])));
});

test('developed fine lots render once at parcel size and retain their overlay after road removal',async(t)=>{
 const previous=globalThis.CityEngine;globalThis.CityEngine=E;t.after(()=>{if(previous===undefined)delete globalThis.CityEngine;else globalThis.CityEngine=previous;});
 const {CityView}=await import('../dist/renderer.js'),w=fixture();E.buildRoadPath(w,[{x:19,y:24},{x:36,y:10}]);const {layout,state}=paintAll(w);w.development=state;
 const start=[...layout.values()].find(p=>p.source===w.roadPaths[0].id&&p.row===0&&F.reserve(structuredClone(state),layout,p.id,2,3));assert.ok(start);
 const parcel=F.reserve(state,layout,start.id,2,3);parcel.occupant={type:'residential',building:'cottage',density:'low',level:1,people:4};
 const THREE=await import('../dist/vendor/three.module.js'),view=Object.create(CityView.prototype);Object.assign(view,{world:w,menu:false,zoning:true,overlay:'none',zoneGroup:new THREE.Group()});
 // Inspect the actual rendered vertices instead of intercepting temporary
 // cell meshes: the optimized renderer writes directly into final batches.
 const occurrences=frame=>{const plane=view.zonePlane(0,0,'#fff',.3,frame),expected=plane.geometry.attributes.position.array;let count=0;for(const mesh of view.zoneGroup.children){if(!mesh.isMesh)continue;const positions=mesh.geometry.attributes.position.array;for(let i=0;i<positions.length;i+=27)if(expected.every((value,j)=>value===positions[i+j]))count++;}plane.geometry.dispose();plane.material.dispose();return count;};
 view.updateZones();assert.equal(occurrences(parcel.frame),1);assert.ok(parcel.cells.every(id=>occurrences(layout.get(id))===0));
 E.removeRoadPath(w,w.roadPaths[0].id);view.updateZones();assert.equal(occurrences(parcel.frame),1);
 view.zoning=false;view.updateZones();assert.equal(view.zoneGroup.children.length,0,'normal city view hides both vacant cells and developed lot overlays');view.overlay='zones';view.updateZones();assert.ok(view.zoneGroup.children.length>1,'information view restores zoning');assert.equal(occurrences(parcel.frame),1);assert.ok(F.valid(state));
});

test('available zoning cache preserves cells and invalidates every blocking input while ignoring population',()=>{
 const w=fixture();E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);
 const parity=()=>{const before=JSON.stringify(w),actual=E.fineZoningLayout(w);assert.deepEqual([...actual],[...E.fineZoningLayout(structuredClone(w))]);assert.equal(JSON.stringify(w),before);return actual;};
 let cached=parity();w.day++;w.money++;w.tiles[0].people++;assert.equal(parity(),cached,'population and finances keep the geometry cache');
 const p=[...cached.values()].find(p=>p.row===0&&w.tiles[p.index].type===null);assert.ok(p);
 for(const [key,value]of [['zone','commercial_low'],['construction',1],['type','park'],['facilityOwner',0],['zoneOwner',0]]){const previous=w.tiles[p.index][key];w.tiles[p.index][key]=value;const blocked=parity();assert.notEqual(blocked,cached);assert.equal(blocked.has(p.id),false);if(previous===undefined)delete w.tiles[p.index][key];else w.tiles[p.index][key]=previous;cached=parity();assert.ok(cached.has(p.id));}
 w.development=F.create();cached=parity();F.paint(w.development,cached,[...cached.keys()],'residential_low');assert.notEqual(parity(),cached);cached=parity();
 const start=[...cached.values()].find(q=>q.row===0&&F.reserve(structuredClone(w.development),cached,q.id,2,3));assert.ok(start);const parcel=F.reserve(w.development,cached,start.id,2,3);parcel.occupant={type:'residential',building:'cottage',density:'low',level:1,people:4};assert.notEqual(parity(),cached);cached=parity();parcel.occupant.people++;assert.equal(parity(),cached);
 F.release(w.development,parcel.id);assert.notEqual(parity(),cached);cached=parity();w.development=structuredClone(w.development);assert.notEqual(parity(),cached);
 const road=w.roadPaths[0];cached=parity();E.removeRoadPath(w,road.id);assert.notEqual(parity(),cached);assert.ok([...parity().values()].every(q=>q.source!==road.id));
 cached=parity();const bank=[...cached.values()][0];w.tiles[bank.index].ground='water';assert.notEqual(parity(),cached);assert.equal(parity().has(bank.id),false);
});

 test('dragging a zone along a curved street selects its road coordinates rather than a world rectangle',()=>{
 const w=fixture();const built=E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);assert.ok(built.ok);
 const grid=E.fineZoningLayout(w),side=[...grid.values()].filter(p=>p.source===built.path.id&&p.side===1);
 const a=side.find(p=>p.row===0),b=side.filter(p=>p.row===3&&p.col>a.col+12).at(-1);assert.ok(a&&b);
 const selected=E.playerZoneRectangle(w,a,b),expected=side.filter(p=>p.col>=a.col&&p.col<=b.col&&p.row<=3);
 assert.deepEqual(new Set(selected),new Set(expected.map(p=>p.id)));assert.ok(new Set(expected.map(p=>p.angle.toFixed(2))).size>2);
 });


test('brush strokes follow a curved road in both directions without cutting across its inside',()=>{
 const w=fixture(),built=E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);assert.ok(built.ok);
 const layout=E.fineZoningLayout(w);
 for(const side of [-1,1]){
  const cells=[...layout.values()].filter(p=>p.source===built.path.id&&p.side===side&&p.row===0),a=cells[0],b=cells.at(-1);
  assert.ok(b.col-a.col>25);
  for(const size of [1,2,4]){
   const forward=E.fineZoneStroke(w,a,b,size),reverse=E.fineZoneStroke(w,b,a,size),expected=new Set();
   for(const p of cells)for(const id of E.fineZoneBrush(w,p,size))expected.add(id);
   assert.deepEqual(new Set(forward),expected);assert.deepEqual(new Set(reverse),expected);
   assert.ok(forward.every(id=>layout.get(id).side===side));
  }
 }
});

test('lot proposals are read only and planning caches invalidate after zoning, roads and reservation',()=>{
 const w=fixture(),layout=E.fineZoningLayout(w);E.fineZoneCells(w,[...layout.keys()],'residential_low');
 const saved=JSON.stringify(w),plans=E.fineZonePlan(w);assert.ok(plans.length>10);assert.equal(JSON.stringify(w),saved);assert.equal(E.fineZonePlan(w),plans);
 const p=plans[0],proposal=F.proposal(w.development,layout,p.startId,p.width,p.depth);assert.deepEqual(proposal.cells,p.cells);assert.equal(JSON.stringify(w),saved);
 w.day++;w.money++;assert.equal(E.fineZonePlan(w),plans);
 const parcel=F.reserve(w.development,layout,p.startId,p.width,p.depth);assert.ok(parcel);const after=E.fineZonePlan(w);assert.notEqual(after,plans);assert.ok(after.every(q=>q.cells.every(id=>!parcel.cells.includes(id))));
 assert.ok(E.fineZoneCells(w,[after[0].startId],'erase').ok);const erased=E.fineZonePlan(w);assert.notEqual(erased,after);
 E.buildRoadPath(w,[{x:19,y:24},{x:34,y:12},{x:42,y:25}]);assert.notEqual(E.fineZonePlan(w),erased);
 assert.deepEqual(E.fineZonePlan(JSON.parse(JSON.stringify(w))),E.fineZonePlan(w));assert.ok(E.valid(w));
});

test('all building lot outlines share one terrain-following draw batch',async()=>{
 const THREE=await import('../dist/vendor/three.module.js'),{CityView}=await import('../dist/renderer.js'),w=fixture(),group=new THREE.Group();
 const frames=Array.from({length:80},(_,i)=>({cx:(i%10)*5-60,cz:Math.floor(i/10)*5-45,width:3.16,depth:4.76,angle:.15}));
 const view=Object.assign(Object.create(CityView.prototype),{world:w,zoneGroup:group});view.zoneLotOutlines(frames);
 assert.equal(group.children.length,1);const lines=group.children[0];assert.ok(lines.isLineSegments);assert.equal(lines.userData.zoningLots,80);assert.ok([...lines.geometry.attributes.position.array].every(Number.isFinite));
 const positions=lines.geometry.attributes.position;for(let i=0;i<positions.count;i++)assert.ok(Math.abs(positions.getY(i)-view.renderFloor(w,positions.getX(i),positions.getZ(i))-.19)<2e-5,'lot boundaries rest on the rendered terrain');
 assert.ok(positions.count<=80*32,'line detail is bounded by lot perimeter');lines.geometry.dispose();lines.material.dispose();
});
