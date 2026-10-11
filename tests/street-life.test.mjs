import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import * as THREE from '../dist/vendor/three.module.js';
import {StreetLife} from '../dist/street-life.js';
const require=createRequire(import.meta.url);globalThis.CityEngine=require('../dist/engine.js');
test('decorative pedestrians stay frozen while the city is paused or on home',()=>{
 const world={tiles:Array.from({length:2304},()=>({type:null,ground:'land'}))};
 for(const i of [491,492,493])world.tiles[i].type='road';world.tiles[444].type='commercial';
 const before=JSON.stringify(world),view={scene:new THREE.Scene(),world,running:false,roadworks:{height:()=>0}};
 const life=new StreetLife(view);life.build(world);assert.equal(life.people.length,1);
 const paused=Array.from(life.parts[0].instanceMatrix.array);life.update(5);assert.deepEqual(Array.from(life.parts[0].instanceMatrix.array),paused);
 view.running=true;life.update(5);assert.notDeepEqual(Array.from(life.parts[0].instanceMatrix.array),paused);assert.equal(JSON.stringify(world),before);
});
