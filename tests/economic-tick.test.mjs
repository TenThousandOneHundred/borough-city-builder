import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import E from '../dist/engine.js';
import {economicFixture,editEconomy} from './economic-fixture.mjs';
import {economicOracle} from './economic-oracle.mjs';

// Whole-world, returned-statistics and RNG-order hashes captured from the
// committed Edition 134 engine. CI needs no historical checkout or prototype.
const oracle=JSON.parse(fs.readFileSync(new URL('./fixtures/economic-tick-134.json',import.meta.url),'utf8'));
const enginePath=fileURLToPath(new URL('../dist/engine.js',import.meta.url));
for(const [name,expected]of Object.entries(oracle.fixtures))test('economic tick preserves Edition 134 state and random sequence: '+name,()=>{
 const w=economicFixture(E,name);w.landformVersion=2;const input=JSON.stringify(w);
 const actual=economicOracle(enginePath,w,oracle.ticks,name==='mixed_edits'?editEconomy:undefined);
 assert.deepEqual(actual,expected);
 assert.equal(JSON.stringify(w),input,'reference fixture remains unchanged');
 if(name==='mixed_edits'){
  assert.ok(actual.coverage.disconnectedTicks>0);
  assert.ok(actual.coverage.legacyCompletions>0);
  assert.ok(actual.coverage.fineCompletions>0);
 }
});
