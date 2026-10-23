// Paired cold-route CPU measurements; no rendering or FPS claims.
// GIT_BIN=/path/to/git node scripts/benchmark-walking-search.mjs [baseline-ref]
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import E from '../dist/engine.js';
import {Traffic} from '../dist/traffic.js';
import {Walking} from '../dist/walking.js';
import {walkingDistrict} from '../tests/walking-search-fixture.mjs';
const baseline=process.argv[2]||'19cf122',base=new URL('../dist/',import.meta.url).href;
const source=execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/walking.js'],{encoding:'utf8'}).replaceAll("from './","from '"+base).replaceAll("import './","import '"+base);
const {Walking:Before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {world,pairs}=walkingDistrict(),saved=JSON.stringify(world),traffic=new Traffic(world,E),before=new Before(world,traffic),after=new Walking(world,traffic),times={before:[],after:[]};
function run(walker){walker.cache.clear();const start=performance.now(),routes=pairs.map(([a,b])=>walker.route(a,b));return {routes,ms:performance.now()-start};}
for(let round=0;round<15;round++){
 const results={};for(const [name,walker]of round%2?[['after',after],['before',before]]:[['before',before],['after',after]])results[name]=run(walker);
 assert.deepEqual(results.after.routes,results.before.routes);
 if(round>3)for(const name of ['before','after'])times[name].push(results[name].ms);
}
assert.equal(JSON.stringify(world),saved);
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
console.log(JSON.stringify({baseline,nodes:after.nodes.length,queriesPerBatch:pairs.length,beforeMedianMs:median(times.before),afterMedianMs:median(times.after),identicalPathsAndLengths:true,worldUnchanged:true,scope:'120 uncached pedestrian routes; CPU operation timing, not FPS'},null,2));
