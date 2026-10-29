import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoadEarthworks} from '../dist/road-earthworks.js';
import {terrainEdgeFixture,terrainFingerprint} from './fixtures/terrain-edge-fixture.mjs';
// Frozen from Edition 151 (6d288ae), including every geometry byte, terrain
// index, accumulated statistic, and 1,089 height/containment query pairs.
const released={grid:'5d60651fef5a04bdb8cf47848250b33310c0a08151cecbfa01b6c61cf2d5cee4',curved:'8cd04e2ba3beea22c00d27df5f1007c9bfba2c65ce7e01a2778454028b7a6dea'};
for(const [kind,expected]of Object.entries(released))test('terrain edge search retains released '+kind+' geometry and queries',()=>{
 const f=terrainEdgeFixture(kind),saved=JSON.stringify(f.options.world),source=f.geometry.attributes.position.array.slice(),p=createRoadEarthworks(f.options);let result;
 try{p.beginApplication();result=p.applyToGeometry(f.geometry);assert.equal(terrainFingerprint(p,result),expected);assert.deepEqual(f.geometry.attributes.position.array,source);assert.equal(JSON.stringify(f.options.world),saved);}
 finally{p.dispose();result?.replacement.dispose();result?.walls?.dispose();f.cleanup();}
});
