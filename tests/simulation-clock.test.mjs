import {test} from 'node:test';import assert from 'node:assert/strict';import {SimulationClock} from '../dist/simulation-clock.js';import {Traffic} from '../dist/traffic.js';import {Residents} from '../dist/residents.js';import E from '../dist/engine.js';
function fixture(){const w=E.createWorld('Offscreen simulation','plains',321);for(const t of w.tiles){t.type=null;t.level=0;t.people=0;}for(let x=0;x<18;x++)Object.assign(w.tiles[24*48+x],{type:'road',level:1,roadType:'street'});for(const [x,type,people]of [[4,'residential',4],[9,'office',0],[14,'commercial',0]])Object.assign(w.tiles[23*48+x],{type,people,level:1});return w;}
function simulation(maxWorkMs=Infinity){const w=fixture(),traffic=new Traffic(w,E);traffic.residentsEnabled=true;for(let n=0;n<32;n++)traffic.addAgent();const residents=new Residents(w,traffic);let now=0,work=0;const clock=new SimulationClock(dt=>{traffic.update(dt);residents.update(dt);work+=3;},{now:()=>now,maxWorkMs,workNow:()=>work});clock.setRunning(true);return {w,traffic,residents,clock,pulse(t){now=t;clock.pulse();}};}
test('traffic and households advance identically with frequent or throttled timers and no rendering',()=>{const fast=simulation(),hidden=simulation();for(let t=50;t<=180000;t+=50)fast.pulse(t);for(let t=1000;t<=180000;t+=1000)hidden.pulse(t);assert.deepEqual(hidden.w.citizens,fast.w.citizens);assert.equal(hidden.traffic.completed,fast.traffic.completed);assert.ok(hidden.traffic.completed>0);assert.ok(hidden.w.citizens.residents.some(r=>r.workdays&&r.shopping));});
test('long timer suspension preserves elapsed time with bounded catch-up work',()=>{let now=0,count=0;const clock=new SimulationClock(()=>count++,{now:()=>now,maxSteps:20});clock.setRunning(true);now=10000;assert.equal(clock.pulse(),20);assert.ok(clock.pending>8);for(let i=0;i<9;i++)clock.pulse();assert.equal(count,200);assert.ok(clock.pending<1e-8);});
test('home and explicit pause do not advance, and resume does not charge paused time',()=>{let now=0,count=0;const clock=new SimulationClock(()=>count++,{now:()=>now});now=10000;clock.pulse();assert.equal(count,0);clock.setRunning(true);now+=1000;clock.pulse();assert.equal(count,20);clock.setRunning(false);now+=60000;clock.pulse();assert.equal(count,20);clock.setRunning(true);now+=1000;clock.pulse();assert.equal(count,40);});
test('speed changes preserve already elapsed time and reset removes previous-world debt',()=>{let now=0,count=0;const clock=new SimulationClock(()=>count++,{now:()=>now});clock.setRunning(true);now=1000;clock.setSpeed(4);assert.equal(count,20);now=2000;clock.pulse();assert.equal(count,100);now=62000;clock.pulse();assert.ok(clock.pending>100);clock.setRunning(false);clock.reset();assert.equal(clock.pending,0);});

test('work-limited catchup yields between fixed steps and eventually preserves the exact sequence',()=>{
 let now=0,work=0;const expected=[],actual=[];
 const baseline=new SimulationClock(dt=>expected.push(dt),{now:()=>now});
 const bounded=new SimulationClock(dt=>{actual.push(dt);work+=3;},{now:()=>now,maxWorkMs:8,workNow:()=>work});
 baseline.setRunning(true);bounded.setRunning(true);now=10000;
 baseline.pulse();baseline.pulse();assert.equal(expected.length,200);
 assert.equal(bounded.pulse(),3);assert.ok(bounded.pending>9.8);
 for(let attempts=0;bounded.pending>=.05-1e-9&&attempts<100;attempts++)assert.ok(bounded.pulse()<=3);
 assert.deepEqual(actual,expected);assert.equal(bounded.total,baseline.total);assert.equal(bounded.pending,baseline.pending);
});

test('yielded catchup preserves actual household routines and traffic without rendering',()=>{
 const baseline=simulation(),bounded=simulation(8);
 for(const sim of [baseline,bounded]){sim.pulse(180000);let batches=0;while(sim.clock.pending>=.05-1e-9){assert.ok(batches++<1200);sim.pulse(180000);}}
 assert.deepEqual(bounded.w.citizens,baseline.w.citizens);assert.deepEqual(bounded.traffic.agents,baseline.traffic.agents);
 assert.equal(bounded.traffic.completed,baseline.traffic.completed);assert.ok(bounded.w.citizens.residents.some(r=>r.workdays&&r.shopping));
 assert.equal(bounded.clock.total,baseline.clock.total);assert.equal(bounded.clock.pending,baseline.clock.pending);
});

test('work limits retain at least one step, the maxSteps cap, and unlimited default behavior',()=>{
 let now=0,work=0;const zero=new SimulationClock(()=>{work+=10;},{now:()=>now,maxWorkMs:0,workNow:()=>work});
 const capped=new SimulationClock(()=>{work++;},{now:()=>now,maxSteps:2,maxWorkMs:8,workNow:()=>work});
 const unlimited=new SimulationClock(()=>{}, {now:()=>now,workNow:()=>{throw new Error('Unlimited clock must not sample work time');}});
 for(const clock of [zero,capped,unlimited])clock.setRunning(true);now=1000;
 assert.equal(zero.pulse(),1);assert.ok(zero.pending>.9);assert.equal(capped.pulse(),2);assert.equal(unlimited.pulse(),20);
});

test('a dynamic work budget restores full catchup batches while hidden',()=>{
 let now=0,work=0,hidden=false,count=0;
 const clock=new SimulationClock(()=>{count++;work+=3;},{now:()=>now,maxWorkMs:()=>hidden?Infinity:8,workNow:()=>{assert.equal(hidden,false);return work;}});
 clock.setRunning(true);now=10000;assert.equal(clock.pulse(),3);hidden=true;
 assert.equal(clock.pulse(),100);assert.equal(clock.pulse(),97);assert.equal(count,200);assert.equal(clock.pending,0);
 hidden=false;now+=1000;assert.equal(clock.pulse(),3);
});

test('work-limited pause and speed changes retain earlier debt without charging paused time',()=>{
 let now=0,work=0,count=0;
 const clock=new SimulationClock(()=>{count++;work+=3;},{now:()=>now,maxWorkMs:8,workNow:()=>work});
 clock.setRunning(true);now=1000;clock.setSpeed(4);assert.equal(count,3);
 now=2000;clock.pulse();clock.setRunning(false);const debt=clock.pending,pausedCount=count;
 now=62000;assert.equal(clock.pulse(),0);assert.equal(count,pausedCount);assert.equal(clock.pending,debt);
 clock.setRunning(true);for(let i=0;clock.pending>=.05-1e-9&&i<100;i++)clock.pulse();
 assert.equal(count,100);assert.ok(Math.abs(clock.total-5)<1e-9);assert.ok(clock.pending<1e-9);
 now+=1000;clock.pulse();assert.ok(clock.pending>3);clock.reset();assert.equal(clock.pending,0);assert.equal(clock.total,0);assert.equal(clock.pulse(),0);
});
