const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const line=(x,y,xx,yy)=>[{x,y},{x:xx,y:yy}];
const paths=[line(10,10,20,10),line(10,12,15,12),line(15,12,15.2,12),line(15.2,12,20,12)];
function world(){const w=E.createWorld('Parallel batch','plains',19);w.money=1e6;for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});return w;}

test('atomic road batch keeps zero-new-tile curve pieces and charges the union once',()=>{
 const w=world();w.tiles[10*48+13].ground='water';const before=JSON.stringify(w),q=E.roadBatchQuote(w,paths,'oneway',{zoneSides:'right'});
 assert.ok(q.ok,q.reason);assert.equal(q.costComplete,true);assert.equal(q.quotes[2].cost,0);assert.equal(JSON.stringify(w),before);
 const tiles=new Set(q.quotes.flatMap(q=>q.tiles)),expected=[...tiles].reduce((n,i)=>n+E.ROADS.oneway.cost*(w.tiles[i].ground==='water'?4:1),0);
 assert.equal(q.cost,expected);const refs=w.tiles.slice(),funds=w.money,result=E.buildRoadBatch(w,paths,'oneway',{zoneSides:'right'});
 assert.ok(result.ok,result.reason);assert.equal(result.roads.length,4);assert.equal(w.money,funds-expected);
 assert.deepEqual(result.roads.map(p=>p.controls),paths);assert.ok(result.roads.every(p=>p.zoneSides==='right'));assert.ok(w.tiles.every((t,i)=>t===refs[i]));assert.ok(E.valid(w));
 const data=new Map(),store=new E.WorldStore({getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)});store.save(w,123);assert.deepEqual(new E.WorldStore(store.storage).get(w.id),w);
});

test('blocked final street and insufficient complete funding cannot partially build',()=>{
 for(const blocked of [true,false]){const w=world();if(blocked)Object.assign(w.tiles[12*48+19],{type:'hospital',building:'clinic',level:1});else w.money=E.roadBatchQuote(w,paths).cost-1;
  const before=JSON.stringify(w),q=E.buildRoadBatch(w,paths);assert.equal(q.ok,false);assert.equal(q.costComplete,!blocked);assert.equal(JSON.stringify(w),before);
 }
});

test('duplicate paths, degenerate geometry and road limits are rejected without mutation',()=>{
 const w=world();for(const p of [[],[paths[0]],[paths[0],paths[0]],[paths[0],[...paths[0]].reverse()],[paths[0],line(4,4,4,4)],[paths[0],null],[paths[0],line(-1,2,4,2)]]){const before=JSON.stringify(w);assert.equal(E.buildRoadBatch(w,p).ok,false);assert.equal(JSON.stringify(w),before)}
 assert.ok(E.buildRoadPath(w,paths[0]).ok);const before=JSON.stringify(w);assert.equal(E.buildRoadBatch(w,paths).ok,false);assert.equal(JSON.stringify(w),before);
 const many=world();many.roadPaths=Array.from({length:4998},(_,i)=>({id:'old'+i,type:'street',controls:line(1,1,2,1),tiles:[]}));assert.match(E.roadBatchQuote(many,paths).reason,/road limit/);
});

test('ordinary road placement still rejects a fully covered segment',()=>{
 const w=world();assert.ok(E.buildRoadPath(w,paths[0]).ok);const before=JSON.stringify(w);assert.equal(E.roadQuote(w,line(12,10,12.2,10)).ok,false);assert.equal(E.buildRoadPath(w,line(12,10,12.2,10)).ok,false);assert.equal(JSON.stringify(w),before);
});

test('batch construction retains resident, trip and existing path references',()=>{
 const w=world(),old=E.buildRoadPath(w,line(1,1,5,1)).path,resident={id:1,trip:{from:48,to:50}},citizens={residents:[resident]};w.citizens=citizens;
 const q=E.buildRoadBatch(w,paths);assert.ok(q.ok,q.reason);assert.equal(w.citizens,citizens);assert.equal(w.citizens.residents[0],resident);assert.equal(w.roadPaths[0],old);
});

test('a duplicate generated road ID rolls back the entire batch',()=>{
 const w=world(),before=JSON.stringify(w),descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=> 'duplicate'}});assert.equal(E.buildRoadBatch(w,paths).ok,false);assert.equal(JSON.stringify(w),before)}
 finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto}
});
