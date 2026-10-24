import {test} from 'node:test';
import assert from 'node:assert/strict';
import {followingClearance} from '../dist/traffic-following.js';
import {TrafficSpatial} from '../dist/traffic-spatial.js';
const random=()=>{let seed=91287;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);};
// Edition 118's original unbounded following rule, including the diagnostic
// that can remain on a stationary driver even when its leader is far away.
function original(a,forward,heading,clearance,agents){for(const b of agents){if(b===a||!b.active||b.dwell)continue;const dx=b.x-a.x,dz=b.z-a.z,ahead=dx*forward.x+dz*forward.z,lateral=Math.abs(dx*forward.z-dz*forward.x);if(ahead>0&&lateral<.65&&Math.cos(b.heading-heading)>.3&&ahead-((a.length||.9)+(b.length||.9))*.5-.75<clearance){clearance=Math.max(0,ahead-((a.length||.9)+(b.length||.9))*.5-.75);a.waitReason='Vehicle queue';}}return clearance;}
function movement(a,clearance,cruise,dt){const target=Math.min(cruise,a.turnSpeed??Infinity,Math.sqrt(Math.max(0,clearance)*6)),speed=Math.min(target,(a.speed||0)+dt*3),move=Math.min(dt*speed,clearance);return {speed,move,waitReason:move>.02?'':a.waitReason};}
function compare(a,agents,{clearance=Infinity,cruise=5,dt=.05}={}){const f={x:Math.sin(a.heading),z:Math.cos(a.heading)},before={...a},after={...a},others=agents.filter(b=>b!==a),spatial=new TrafficSpatial();spatial.reset([after,...others]);const old=original(before,f,a.heading,clearance,others),now=followingClearance(after,f,a.heading,clearance,cruise,dt,[after,...others],spatial);assert.deepEqual(movement(after,now,cruise,dt),movement(before,old,cruise,dt));return {before,after,spatial,old,now};}

test('bounded index retains every possible nearby leader across arbitrary headings and sequential moves',()=>{
 const rng=random(),agents=Array.from({length:512},(_,i)=>({active:i%17!==0,x:rng()*180-90,z:rng()*180-90,length:i%11===0?2.6:.9})),index=new TrafficSpatial();index.reset(agents);assert.equal(index.maxLength,2.6);
 for(let n=0;n<1500;n++){const a=agents[n%512],angle=n%5===0?Math.PI*(n%8)/4:rng()*Math.PI*2,f={x:Math.sin(angle),z:Math.cos(angle)},reach=rng()*18+.1,candidates=new Set(index.leaders(a,f,reach));
  for(const b of agents){const dx=b.x-a.x,dz=b.z-a.z,ahead=dx*f.x+dz*f.z;if(b.active&&ahead>=0&&ahead<=reach&&Math.abs(dx*f.z-dz*f.x)<.65)assert.ok(candidates.has(b));}
  if(a.active){a.x+=(rng()-.5)*10;a.z+=(rng()-.5)*10;index.move(a);}
 }
 agents[1].length=8;index.reset(agents);assert.equal(index.maxLength,8);agents[1].active=false;index.reset(agents);assert.equal(index.maxLength,2.6);
});
test('long avenues query nearby cars instead of copying every distant vehicle',()=>{
 const agents=Array.from({length:512},(_,i)=>({active:true,x:0,z:i*3})),index=new TrafficSpatial();index.reset(agents);assert.equal(index.corridor(agents[0],{x:0,z:1}).length,512);const nearby=index.leaders(agents[0],{x:0,z:1},8);assert.ok(nearby.length<8);assert.ok(nearby.includes(agents[1]));
});
test('random traffic retains exact next-step speeds, movements and wait reasons',()=>{
 const rng=random();for(let n=0;n<1600;n++){const a={active:true,x:rng()*200-100,z:rng()*200-100,heading:rng()*Math.PI*2-Math.PI,speed:n%5===0?0:rng()*9,length:n%7===0?2.6:.9,turnSpeed:n%4===0?1.6:Infinity,waitReason:n%2?'Red signal':''},agents=[a];
  for(let i=0;i<128;i++){const ahead=(rng()-.1)*100,lateral=(rng()-.5)*5,f={x:Math.sin(a.heading),z:Math.cos(a.heading)};agents.push({active:i%17!==0,x:a.x+f.x*ahead-f.z*lateral,z:a.z+f.z*ahead+f.x*lateral,heading:i%3?a.heading:rng()*Math.PI*2-Math.PI,dwell:i%23===0?4:0,hold:i%29===0,length:i%11===0?3.2:.9});}
  compare(a,agents,{clearance:[Infinity,0,.1,3,7,30][n%6],cruise:[3,5,8][n%3],dt:[.001,.005,.02,.05,.07,2][n%6]});
 }
});
test('starting and tiny steps preserve distant queue diagnostics without limiting a moving car',()=>{
 const a={active:true,x:0,z:0,heading:0,speed:0,waitReason:'',length:.9},leader={active:true,x:0,z:150,heading:0,length:2.6};
 for(const [speed,dt]of [[0,.05],[4,.001],[0,.02],[8,.001]]){const r=compare({...a,speed},[leader],{dt});assert.equal(r.after.waitReason,'Vehicle queue');assert.equal(r.now,r.old);}
 const moving=compare({...a,speed:5},[leader]);assert.equal(moving.now,Infinity);assert.equal(movement(moving.after,moving.now,5,.05).waitReason,'');
});
test('held buses, overlaps, junction stops, dwell and exact lateral boundaries retain the old rule',()=>{
 const a={active:true,x:0,z:0,heading:0,speed:4,waitReason:'Red signal',length:2.6};
 for(const lateral of [.65-1e-10,.65,.65+1e-10,-.65+1e-10])for(const z of [.01,1,3.35,8,13,150])for(const clearance of [0,.1,Infinity])for(const dwell of [0,4])compare(a,[{active:true,hold:true,x:lateral,z,heading:0,length:3.2,dwell}],{clearance,cruise:8});
});
test('braking and displacement horizons preserve threshold cases for every road speed',()=>{
 const a={active:true,x:0,z:0,heading:0,speed:8,waitReason:'',length:.9};
 for(const cruise of [3,5,8])for(const dt of [.001,.05,2])for(const length of [.9,2.1,8])for(const epsilon of [-1e-8,0,1e-8]){const horizon=Math.max(cruise*cruise/6,dt*cruise),leader={active:true,x:0,z:horizon+(a.length+length)*.5+.75+epsilon,heading:0,length};compare(a,[leader],{cruise,dt});}
});
test('full-scan adapters and infinite custom lengths keep the unbounded fallback',()=>{
 const a={active:true,x:0,z:0,heading:0,speed:4,length:.9,waitReason:''},b={active:true,x:0,z:100,heading:0,length:Infinity};assert.equal(compare(a,[b]).now,0);
 const f={x:0,z:1},before={...a},after={...a},agents=[b];assert.equal(followingClearance(after,f,0,Infinity,5,.05,agents,{corridor:()=>agents}),original(before,f,0,Infinity,agents));assert.equal(after.waitReason,before.waitReason);
});
