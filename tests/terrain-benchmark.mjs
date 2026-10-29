import {terrainEdgeFixture} from './fixtures/terrain-edge-fixture.mjs';
import {createRoadEarthworks as before} from './fixtures/earthworks-before152.mjs';
import {createRoadEarthworks as fine} from './fixtures/earthworks-fine152.mjs';
import {createRoadEarthworks as after} from '../dist/road-earthworks.js';
for(const kind of ['grid','curved']){
 const f=terrainEdgeFixture(kind),caches={before:{},after:{},fine:{}};
 const variants=[['before',before],['fine',fine],['after',after]];for(let run=0;run<10;run++)for(const [name,create]of [...variants.slice(run%3),...variants.slice(0,run%3)]){
  let t=performance.now();const p=create({...f.options,regionCache:caches[name]}),build=performance.now()-t;p.beginApplication();t=performance.now();const r=p.applyToGeometry(f.geometry),apply=performance.now()-t;
  console.log(JSON.stringify({kind,run,name,build,apply,total:build+apply,cache:p.cacheStats}));p.dispose();r.replacement.dispose();r.walls?.dispose();
 }f.cleanup();
}
