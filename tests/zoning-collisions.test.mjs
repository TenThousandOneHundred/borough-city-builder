import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import E from '../dist/engine.js';
import Z from '../dist/zoning-layout.js';
import {collisionFixtures} from './zoning-collision-fixtures.mjs';

// Captured from the released Edition 106 implementation before optimization.
// Hash every field and insertion order, not just cell counts or coordinates.
const baseline=JSON.parse(readFileSync(new URL('./fixtures/zoning-layout-106.json',import.meta.url)));
test('optimized collisions reproduce all 54 released layouts exactly without mutating worlds',()=>{
 const fixtures=new Map(collisionFixtures().map(f=>[f.name,f.world]));
 for(const reference of baseline.reports){
  const world=fixtures.get(reference.fixture),saved=JSON.stringify(world),cells=Z.layout(world,E.ROADS,reference.options);
  assert.equal(cells.size,reference.cells,reference.fixture);
  assert.equal(createHash('sha256').update(JSON.stringify([...cells])).digest('hex'),reference.sha256,reference.fixture+' '+JSON.stringify(reference.options));
  assert.equal(Z.layout(world,E.ROADS,reference.options),cells,'unchanged queries retain cached geometry');
  assert.equal(JSON.stringify(world),saved,'collision calculations never enter save data');
 }
 assert.equal(baseline.reports.length,54);
});
