import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import previous from './fixtures/zoning-layout-106.cjs';
import {collisionFixtures} from './zoning-collision-fixtures.mjs';

// The frozen implementation is the released Edition 106 source. Compare both
// versions in the same runtime: trigonometric rounding can differ across CPUs
// or Node versions, so a fingerprint made on another machine is not the oracle.
// Keep the original release/count oracle intact. Apply only the intentional
// legacy-neighbor fix to a second copy; its exhaustive collision algorithm
// remains an independent oracle for the optimized spatial index.
const source=readFileSync(new URL('./fixtures/zoning-layout-106.cjs',import.meta.url),'utf8');
const context={module:{exports:{}}};
runInNewContext(source.replace(/w\.tiles\[(i(?:[+-](?:1|48)))\]\.type==='road'/g,"(w.tiles[$1].type==='road'&&(!w.tiles[$1].pathIds?.length||w.tiles[$1].legacyRoad))"),context);
const corrected=context.module.exports;
const baseline=JSON.parse(readFileSync(new URL('./fixtures/zoning-layout-106.json',import.meta.url)));
test('optimized collisions match the exhaustive oracle on all 54 layouts with corrected legacy neighbors',t=>{
 const fixtures=new Map(collisionFixtures().map(f=>[f.name,f.world]));
 let platformDifferences=0;
 for(const reference of baseline.reports){
  const world=fixtures.get(reference.fixture),saved=JSON.stringify(world),cells=Z.layout(world,E.ROADS,reference.options),released=previous.layout(world,E.ROADS,reference.options),expected=corrected.layout(world,E.ROADS,reference.options);
  assert.equal(released.size,reference.cells,reference.fixture);
  assert.equal(JSON.stringify([...cells]),JSON.stringify([...expected]),reference.fixture+' '+JSON.stringify(reference.options));
  if(createHash('sha256').update(JSON.stringify([...released])).digest('hex')!==reference.sha256)platformDifferences++;
  assert.equal(Z.layout(world,E.ROADS,reference.options),cells,'unchanged queries retain cached geometry');
  assert.equal(JSON.stringify(world),saved,'collision calculations never enter save data');
 }
 assert.equal(baseline.reports.length,54);
 if(platformDifferences)t.diagnostic(platformDifferences+' baseline fingerprints differ from the recording machine; optimized and corrected exhaustive layouts match exactly in this runtime');
});
