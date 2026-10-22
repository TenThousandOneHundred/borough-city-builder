// CPU timings for lot planning and brush selection, not an FPS measurement.
// Usage: node scripts/benchmark-roadside-zoning.mjs /path/to/previous-engine.cjs
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import E from '../dist/engine.js';
const require=createRequire(new URL('../dist/engine.js',import.meta.url));
const module={exports:{}};
new Function('require','module','exports',readFileSync(process.argv[2],'utf8'))(require,module,module.exports);
const Previous=module.exports;
function fixture(){
 const w=E.createWorld('Roadside benchmark','plains',8);w.money=1e7;
 for(const y of [6,14,32,40])E.buildRoadPath(w,[{x:3,y},{x:43,y}]);
 E.buildRoadPath(w,[{x:20,y:23},{x:32,y:18},{x:42,y:25}]);
 const renamed=new Map(w.roadPaths.map((p,i)=>[p.id,'roadside-benchmark-'+i]));for(const p of w.roadPaths)p.id=renamed.get(p.id);for(const t of w.tiles)if(t.pathIds)t.pathIds=t.pathIds.map(id=>renamed.get(id)||id);
 E.fineZoneCells(w,[...E.fineZoningLayout(w).keys()],'residential_low');return w;
}
const base=fixture(),rigs=[Previous,E].map(engine=>({engine,world:structuredClone(base),replan:[],cached:[]}));
const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];
for(let run=0;run<8;run++)for(const r of run%2?[...rigs].reverse():rigs){
 r.world.development.revision++;const start=performance.now();r.plans=r.engine.fineZonePlan(r.world);const ms=performance.now()-start;
 const cachedStart=performance.now();for(let i=0;i<100;i++)r.engine.fineZonePlan(r.world);const cached=(performance.now()-cachedStart)/100;
 if(run){r.replan.push(ms);r.cached.push(cached);}
}
const layout=E.fineZoningLayout(base),cells=[...layout.values()],a=cells.find(p=>p.source.startsWith('legacy')&&p.row===0),b=cells.filter(p=>p.source===a.source&&p.side===a.side&&p.row===0).at(-1),start=performance.now();
for(let i=0;i<300;i++)E.fineZoneStrip(base,a,b,6);
const stripMs=(performance.now()-start)/300,report=r=>({lots:r.plans.length,coveredCells:new Set(r.plans.flatMap(p=>p.cells)).size,replanMedianCpuMs:median(r.replan),cachedMedianCpuMs:median(r.cached)});
console.log(JSON.stringify({cells:layout.size,measuredRuns:7,before:report(rigs[0]),after:report(rigs[1]),stripCpuMs:stripMs,scope:'Local planning and selection CPU work; not browser FPS'},null,2));
