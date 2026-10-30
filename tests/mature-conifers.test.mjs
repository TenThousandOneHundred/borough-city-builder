import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync,gunzipSync} from 'node:zlib';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {Vegetation} from '../dist/vegetation.js';
import {elevationTreeMaterial,elevationTreeDepthMaterial} from '../dist/tree-impostor.js';
const asset=name=>new URL('../dist/assets/trees/'+name,import.meta.url);
let models;
async function load(){if(!models){const b=fs.readFileSync(asset('mature-conifers.glb'));models=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}return models;}
function pixels(b){
 assert.equal(b.readUInt32BE(16),3072);assert.equal(b.readUInt32BE(20),1536);assert.equal(b[24],8);assert.equal(b[25],6);assert.equal(b[28],0);
 let offset=8;const data=[];while(offset<b.length){const n=b.readUInt32BE(offset);if(b.toString('ascii',offset+4,offset+8)==='IDAT')data.push(b.subarray(offset+8,offset+8+n));offset+=n+12;}
 const raw=inflateSync(Buffer.concat(data)),stride=12288,rows=Buffer.alloc(stride*1536),paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<1536;y++)for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?rows[i-4]:0,b=y?rows[i-stride]:0,c=y&&x>=4?rows[i-stride-4]:0,p=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][raw[y*(stride+1)]];assert.notEqual(p,undefined);rows[i]=(raw[y*(stride+1)+x+1]+p)&255;}
 return rows;
}
test('Blender-authored mature conifers contain finite bark and needle geometry inside a bounded close-detail budget',async()=>{
 const scene=await load();let total=0;
 for(const name of ['MatureSpruce','MaturePine']){const root=scene.getObjectByName(name);assert.ok(root);assert.equal(root.userData.authoring_tool,'Blender');root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());assert.ok(size.y>20&&size.y<25);assert.ok(size.x/size.y>.25&&size.x/size.y<.7);
  let count=0,parts=0;root.traverse(o=>{if(!o.isMesh)return;parts++;assert.ok(o.material.vertexColors);assert.equal(o.material.side,THREE.DoubleSide);assert.equal(o.material.map,null);assert.equal(o.material.metalness,0);
   const g=o.geometry;for(const name of ['position','normal','color']){const a=g.attributes[name];assert.ok(a);assert.ok(a.array.every(Number.isFinite));}assert.equal(g.attributes.normal.count,g.attributes.position.count);assert.equal(g.attributes.color.count,g.attributes.position.count);assert.ok(g.index.array.every(i=>i<g.attributes.position.count));count+=g.index.count/3;
  });assert.equal(parts,2);assert.ok(count>15000&&count<55000);total+=count;
 }
 assert.ok(total<85000);assert.ok(fs.statSync(new URL('../source-assets/trees/mature-conifers.blend',import.meta.url)).size>1000000);
 const raw=fs.readFileSync(asset('mature-conifers.glb'));assert.deepEqual(gunzipSync(fs.readFileSync(asset('mature-conifers.glb.gz'))),raw);assert.ok(raw.length<9000000);
});
for(const species of ['spruce','pine'])test(`${species} atlas contains 32 unclipped opaque canopy views including overhead coverage`,()=>{
 const bytes=fs.readFileSync(asset('mature-'+species+'-atlas.png'));assert.ok(bytes.length<3000000);const p=pixels(bytes),counts=[];
 for(let row=0;row<4;row++)for(let col=0;col<8;col++){let count=0,edge=0;for(let y=0;y<384;y++)for(let x=0;x<384;x++){const alpha=p[((row*384+y)*3072+col*384+x)*4+3];if(alpha>8)assert.ok(x>=96&&x<288,'cropped side margins are transparent');if(alpha>76){count++;if(x<2||y<2||x>381||y>381)edge++;}}assert.ok(count>5000&&count<120000,`${row},${col}: ${count}`);assert.equal(edge,0,'no clipped branches');counts.push(count);}
 assert.ok(new Set(counts).size>16,'views are distinct, not duplicated side cards');
});
test('view atlas uses tree rotation for both daylight and sun-facing shadow variants',()=>{
 const map=new THREE.Texture(),day=elevationTreeMaterial(map,{azimuths:8,panelSize:384}),shadow=elevationTreeDepthMaterial(map,{azimuths:8,panelSize:384}),legacy=elevationTreeMaterial(map);
 assert.notEqual(day.customProgramCacheKey(),shadow.customProgramCacheKey());assert.notEqual(day.customProgramCacheKey(),legacy.customProgramCacheKey());
 for(const m of [day,shadow]){const shader={vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <map_fragment>'};m.onBeforeCompile(shader);assert.match(shader.vertexShader,/attribute float treeRotation/);assert.match(shader.vertexShader,/atan\(treeDelta.x,treeDelta.z\)-treeRotation/);assert.match(shader.fragmentShader,/right=mod\(left\+1.,8\.0\)/);assert.match(shader.fragmentShader,/al.rgb\*al.a/);assert.equal(m.map,map);assert.equal(m.alphaTest,.3);}
});
test('near models and atlas instances share saved positions and yaw while keeping the ten-tree limit',async()=>{
 const source=await load(),camera=new THREE.PerspectiveCamera(),vegetation=Object.create(Vegetation.prototype),prototypes=['MatureSpruce','MaturePine'].map(name=>source.getObjectByName(name));
 camera.position.set(0,5,8);Object.assign(vegetation,{v:{camera,night:false,renderer:{shadowMap:{needsUpdate:false}}},broadleaf:[],prototypes,impostors:prototypes.map(()=>({material:elevationTreeMaterial(new THREE.Texture(),{azimuths:8,panelSize:384})}))});
 const positions=Array.from({length:40},(_,i)=>[(i%8)*3,Math.floor(i/8)*3,6,i%4,false,'pine']),saved=JSON.stringify(positions);vegetation.populate(new THREE.Group(),positions,()=>2);
 assert.equal(vegetation.population.near.size,10);const meshes=vegetation.instances,attrs=meshes.map(m=>m.instanceMatrix);
 for(const record of vegetation.population.records){assert.equal(record.source,prototypes[record.i%2]);assert.ok(Math.abs(record.mesh.geometry.attributes.treeRotation.getX(record.slot)-record.i*2.399)<.00001);const near=vegetation.population.near.get(record.i);if(near){assert.equal(near.rotation.y,record.i*2.399);assert.equal(near.position.y,2);}}
 camera.position.set(0,180,200);vegetation.update();assert.equal(vegetation.population.near.size,0);for(const [i,mesh]of meshes.entries()){assert.equal(mesh.instanceMatrix,attrs[i]);assert.equal(mesh.customDepthMaterial.userData.azimuthViews,8);assert.equal(mesh.geometry.attributes.treeRotation.count,mesh.count);assert.equal(mesh.geometry.parameters.width,.6);for(let i=0;i<mesh.geometry.attributes.uv.count;i++)assert.ok([.25,.75].includes(mesh.geometry.attributes.uv.getX(i)));}
 vegetation.update();assert.equal(vegetation.lastMatrixWrites,0);assert.equal(JSON.stringify(positions),saved);
});
