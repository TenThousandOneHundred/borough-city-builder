import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import previous from './fixtures/zoning-layout-106.cjs';
import {collisionFixtures} from './zoning-collision-fixtures.mjs';

// The frozen implementation is the released Edition 106 source. Compare both
// versions in the same runtime: trigonometric rounding can differ across CPUs
// or Node versions, so a fingerprint made on another machine is not the oracle.
const baseline=JSON.parse(readFileSync(new URL('./fixtures/zoning-layout-106.json',import.meta.url)));
test('optimized collisions reproduce all 54 released layouts exactly without mutating worlds',t=>{
 const fixtures=new Map(collisionFixtures().map(f=>[f.name,f.world]));
 let platformDifferences=0;
 for(const reference of baseline.reports){
  const world=fixtures.get(reference.fixture),saved=JSON.stringify(world),cells=Z.layout(world,E.ROADS,reference.options),expected=previous.layout(world,E.ROADS,reference.options);
  assert.equal(cells.size,reference.cells,reference.fixture);
  assert.deepEqual([...cells],[...expected],reference.fixture+' '+JSON.stringify(reference.options));
  if(createHash('sha256').update(JSON.stringify([...expected])).digest('hex')!==reference.sha256)platformDifferences++;
  assert.equal(Z.layout(world,E.ROADS,reference.options),cells,'unchanged queries retain cached geometry');
  assert.equal(JSON.stringify(world),saved,'collision calculations never enter save data');
 }
 assert.equal(baseline.reports.length,54);
 if(platformDifferences)t.diagnostic(platformDifferences+' baseline fingerprints differ from the recording machine; optimized and released layouts match exactly in this runtime');
});
