import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../dist/vendor/three.module.js';
import {Roadworks} from '../dist/roadworks.js';

const names=['flat-ribbon','plain-unindexed','split-first','split-middle','split-final','support-without-uv','uv-without-support','threshold-below','threshold-above','split-budget','repeat-conformance','degenerate'];
function fixture(name){
 const ribbon=['flat-ribbon','repeat-conformance'].includes(name),plain=name==='plain-unindexed',budget=name==='split-budget',degenerate=name==='degenerate';
 const points=ribbon?[0,1,2,3].flatMap(x=>[[x,0,-.02],[x,0,.02]]):budget?[[0,0,0],[1,0,0],[0,0,1]]:degenerate?Array.from({length:3},()=>[-0,0,0]):[0,3,6].flatMap(x=>[[x,0,0],[x,0,1],[x+1,0,0]]);
 const g=new THREE.BufferGeometry();g.name='released-paint/'+name;g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
 const indexed=!['plain-unindexed','split-final','support-without-uv','split-budget','degenerate'].includes(name),indices=ribbon?[0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6]:points.map((_,i)=>i);
 if(indexed)g.setIndex(indices);
 const hasUV=!['plain-unindexed','support-without-uv','split-budget'].includes(name),hasPaint=!['plain-unindexed','uv-without-support','split-budget'].includes(name);
 if(hasUV){const values=points.flatMap(([x,,z],i)=>[x/7+z/9,(i%3)/7]);g.setAttribute('uv',name==='split-middle'?new THREE.BufferAttribute(new Float64Array(values),2):new THREE.Float32BufferAttribute(values,2));}
 if(hasPaint){const values=points.flatMap((_,i)=>[0,0,.02,ribbon?(i%2?1:-1):(i%3===1?1:-1)]);g.setAttribute('roadPaint',new THREE.Float32BufferAttribute(values,4));}
 g.computeVertexNormals();g.addGroup(0,indices.length,2);g.setDrawRange(0,indices.length);g.userData={roadPaintPairs:ribbon,fixture:name};g.computeBoundingBox();
 const selected=name==='split-first'?0:name==='split-final'?6:3,coefficient=name==='threshold-below'?.003199:name==='threshold-above'?.003201:.016;
 const height=budget?((x,z)=>Math.sin(x*83)*Math.cos(z*71)*.1):name==='repeat-conformance'?((x,z)=>.1+.005*Math.sin(x*8)+z*.025):ribbon||plain||degenerate?((x,z)=>.4+x*.03+z*.02):((x,z)=>{const u=x-selected;return (name.startsWith('threshold')?0:.4+x*.03+z*.02)+(u>=0&&u<=1?coefficient*u*(1-u):0);});
 return {g,height,passes:name==='repeat-conformance'?2:1};
}
function geometryHash(g){
 const hash=createHash('sha256'),add=value=>hash.update(JSON.stringify(value)+'\n');
 for(const [name,a]of Object.entries(g.attributes)){add([name,a.itemSize,a.normalized,a.name,a.usage,a.gpuType,a.version,a.array.constructor.name]);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
 if(g.index){const a=g.index;add(['index',a.itemSize,a.normalized,a.usage,a.version,a.array.constructor.name]);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
 add([g.groups,g.drawRange,g.name,g.userData,g.boundingBox,g.boundingSphere]);return hash.digest('hex');
}
function runFixture(K,name){
 const {g,height,passes}=fixture(name),roads=new K({scene:new THREE.Scene(),night:false}),world={id:'unchanged-marking-world',value:[1,2,3]},saved=JSON.stringify(world),probes=[],input=geometryHash(g),attributes={...g.attributes},index=g.index;
 roads.paintHeight=(_w,x,z)=>{probes.push(x,z);return height(x,z);};roads.markingStats={before:7,after:9};let disposed=0;g.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<passes;i++)roads.conformMarking(world,g);
 const bytes=new Float64Array(probes),result={input,output:geometryHash(g),probes:createHash('sha256').update(Buffer.from(bytes.buffer)).digest('hex'),calls:probes.length/2,stats:roads.markingStats,indexRetained:g.index===index,attributesRetained:Object.fromEntries(Object.entries(attributes).map(([name,a])=>[name,g.attributes[name]===a])),vertices:g.attributes.position.count};
 assert.equal(JSON.stringify(world),saved);assert.equal(disposed,0,'conformance retains the geometry owner');
 g.dispose();roads.clear();roads.lampMaterial.dispose();roads.walkMaterial.dispose();roads.lightPoolMaterial.dispose();roads.group.removeFromParent();roads.signalGroup.removeFromParent();return result;
}

// Recorded from committed Edition138 b5978cd00db33a6ab1bcea73075046a715b8422d.
// The fixed release oracle includes every attribute/index byte and order,
// metadata, bounds, retained buffers, split statistics, and height-probe order.
// CI is self-contained and never imports untracked historical source files.
const EDITION138={
 "flat-ribbon":{"input":"f47d4f43c8dbe399c14330be8556753bbe7e53398a2f0c10281e1849446abf12","output":"f7f31fe8702dca3eb72d5a84e86ebb8ae8c27236338d5264216110ffeadc5a9f","probes":"ba4fe91fc6adde4873fa2185bf49010096e9596eecfa6f7cc82963afc3243346","calls":32,"stats":{"before":13,"after":15},"indexRetained":true,"attributesRetained":{"position":true,"uv":true,"roadPaint":true,"normal":true},"vertices":8},
 "plain-unindexed":{"input":"29e9b22fc0c4564cdb8d345d402ab11185b151f7257f1a5eb62cbea5cad78fc6","output":"2751646b982010d2c20a43fe7b57ebaabeb3b1af9687231d154477a4f8ab2fe0","probes":"8ad57a11a2b1139edc471fee32f286b946032abae1013d160adef7cd3ba4a797","calls":21,"stats":{"before":10,"after":12},"indexRetained":true,"attributesRetained":{"position":true,"normal":true},"vertices":9},
 "split-first":{"input":"4380208764ecfda6e81f06083b55b9d6759379e20a8bbb4d6f6ebbb6949ee6d2","output":"ab1bb8157f0679d0edfe97e003519a5f54fd8c0879341e4bbc0d5b6f0782228a","probes":"8804bafa6a5a88e1c6509445d826d62a3a3cf208e10baa688fc3304d1aff6afc","calls":101,"stats":{"before":10,"after":27},"indexRetained":false,"attributesRetained":{"position":false,"uv":false,"roadPaint":false,"normal":false},"vertices":54},
 "split-middle":{"input":"4201f66c984d9b21038f46a871bb2795c623074c005cddf8a8f551a69e39ee68","output":"7c32e207d6f7fca55c1f382e0e17993969cb2098187cee6f6be29085a99c423f","probes":"4f32ff1eda7b6fa286e439c80f87185e88a0d45b9c5d53149766704c4bbbd9fc","calls":101,"stats":{"before":10,"after":27},"indexRetained":false,"attributesRetained":{"position":false,"uv":false,"roadPaint":false,"normal":false},"vertices":54},
 "split-final":{"input":"4ffca63bc1af4d61a0e4437b30d7982312f311255f8a71a6add3b4cdc7cc2dab","output":"ebfd9b30691e69eddde49b4231879da08ee53160a40799c1587442c65f3e6a83","probes":"5c5054847b16e3b97d87f802c656be64cac2c3f12bf65f78a87f2004f23a082d","calls":101,"stats":{"before":10,"after":27},"indexRetained":true,"attributesRetained":{"position":false,"uv":false,"roadPaint":false,"normal":false},"vertices":54},
 "support-without-uv":{"input":"e4eeea1041e9e1470f38f0e52f869815c9d17e47f5735c1028937a3b8b444b6a","output":"1cfa04a87214a29962b2f484274503272e2373021959f938bed3e83a8056d75b","probes":"4f32ff1eda7b6fa286e439c80f87185e88a0d45b9c5d53149766704c4bbbd9fc","calls":101,"stats":{"before":10,"after":27},"indexRetained":true,"attributesRetained":{"position":false,"roadPaint":false,"normal":false},"vertices":54},
 "uv-without-support":{"input":"e35e0a86752d42a3da297180f02b9117a5a61f39db1919259b1fc77bbb28b557","output":"e9093334fb8712953b3049461995adbbd1601175cd00c66c54c5472e2c2d63ee","probes":"4f32ff1eda7b6fa286e439c80f87185e88a0d45b9c5d53149766704c4bbbd9fc","calls":101,"stats":{"before":10,"after":27},"indexRetained":false,"attributesRetained":{"position":false,"uv":false,"normal":false},"vertices":54},
 "threshold-below":{"input":"e0f5493bcdace3b0f23e6cee7dab6011ee07d8ea8a58fff31060afa58d8bfae0","output":"3c7c2c0899615f09c70ebefbf842937723a48cad442fff946832e0fcd9e97421","probes":"8ad57a11a2b1139edc471fee32f286b946032abae1013d160adef7cd3ba4a797","calls":21,"stats":{"before":10,"after":12},"indexRetained":true,"attributesRetained":{"position":true,"uv":true,"roadPaint":true,"normal":true},"vertices":9},
 "threshold-above":{"input":"3da8bfce2837484d8b418daf33121e9705c398e3e116a9d96f5cc2eff377de0e","output":"6307c415b7a0926408449abdace80b2a0c237768a89feca007271fab1959fc75","probes":"3d40e8eaa91502f8a9909a21687b6e2f982cabc7561858199316a562d6bb7276","calls":37,"stats":{"before":10,"after":15},"indexRetained":false,"attributesRetained":{"position":false,"uv":false,"roadPaint":false,"normal":false},"vertices":18},
 "split-budget":{"input":"4db262d90bbe0a11df2ec7e5183730f1a413499704bd13342875fe292cd725b6","output":"51713e436b9a62b44fb7da28f479b8d9d1efd8e4421ad7657b0610ec9f854f37","probes":"91c869730c58f2406653e7f44b0d32924330aceb24620e62b2ad554b9258602c","calls":87,"stats":{"before":8,"after":73},"indexRetained":true,"attributesRetained":{"position":false,"normal":false},"vertices":192},
 "repeat-conformance":{"input":"bbe42150b2369cf914f0b30f83d198cb73296f01d10c69268c074acb0ae3c0c9","output":"246666ed22ff1e819c6d49b2e3c380e8de24e8a0e057d5650350162ab866bdde","probes":"b44f01f8609c836e8ec915e97c1813fdb7b4d7479f747d1717609bdea23da2f7","calls":4144,"stats":{"before":349,"after":681},"indexRetained":false,"attributesRetained":{"position":false,"uv":false,"roadPaint":false,"normal":false},"vertices":1008},
 "degenerate":{"input":"074487d6330b4bebff6710dddd7fd9ea08857807bddfb6bd36ea5d444fdfb750","output":"9f2f56b2677cf79c59494909a879b36603354e7be34687cad8694f378d8adcf9","probes":"488008be4582ec215222dca43ec998d35573d6e8bb710469cf99cd9bbdc593c9","calls":7,"stats":{"before":8,"after":10},"indexRetained":true,"attributesRetained":{"position":true,"uv":true,"roadPaint":true,"normal":true},"vertices":3}
};
for(const name of names)test('paint conformance retains Edition138 bytes and height probes: '+name,()=>{
 assert.deepEqual(runFixture(Roadworks,name),EDITION138[name]);
});
