import * as THREE from './vendor/three.module.js';

// Give each connected pane one stable room seed. Shared vertices stay shared;
// balcony rails and skylights remain non-emissive regardless of material reuse.
export function addWindowRooms(geometry){
 const positions=geometry.attributes.position,index=geometry.index,normal=geometry.attributes.normal,count=positions.count,parent=new Int32Array(count);
 for(let i=0;i<count;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<index.count;i+=3){const a=find(index.getX(i));for(let j=1;j<3;j++){const b=find(index.getX(i+j));if(a!==b)parent[b]=a;}}
 const panes=new Map();
 for(let i=0;i<count;i++){const key=find(i);let p=panes.get(key);if(!p){p={min:new THREE.Vector3(Infinity,Infinity,Infinity),max:new THREE.Vector3(-Infinity,-Infinity,-Infinity),normalY:0};panes.set(key,p);}const point=new THREE.Vector3().fromBufferAttribute(positions,i);p.min.min(point);p.max.max(point);p.normalY=Math.max(p.normalY,Math.abs(normal.getY(i)));}
 const seeds=new Map();let eligible=0;
 for(const [key,p]of panes){const centre=p.min.clone().add(p.max).multiplyScalar(.5),size=p.max.clone().sub(p.min),room=p.normalY<.2&&size.y>=1.25&&Math.hypot(size.x,size.z)>=.45;
  let hash=2166136261;for(const n of [centre.x,centre.y,centre.z])hash=Math.imul(hash^Math.round(n*100),16777619);seeds.set(key,[(hash>>>0)%4093,room?1:0]);if(room)eligible++;
 }
 const data=new Float32Array(count*2);for(let i=0;i<count;i++)data.set(seeds.get(find(i)),i*2);geometry.setAttribute('windowRoom',new THREE.BufferAttribute(data,2));return {panes:panes.size,eligible,bytes:data.byteLength};
}

export function configureWindowLighting(material){
 if(material.userData.roomLighting)return;material.userData.roomLighting=true;material.userData.roomLightingState={value:0};
 material.onBeforeCompile=shader=>{
  shader.uniforms.roomNight=material.userData.roomLightingState;
  shader.vertexShader='uniform float roomNight;\nattribute vec2 windowRoom;\nvarying vec3 roomLight;\nvarying vec2 roomUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   roomLight=vec3(0.);roomUv=uv;
   if(roomNight>.5&&windowRoom.y>.5){
   vec3 roomAnchor=modelMatrix[3].xyz;
   #ifdef USE_INSTANCING
    roomAnchor=(modelMatrix*instanceMatrix[3]).xyz;
   #endif
   float roomSeed=windowRoom.x+dot(roomAnchor,vec3(11.71,3.19,7.37));
   float occupied=fract(sin(roomSeed*1.137)*4375.8545);
   float warmth=fract(sin(roomSeed*2.731)*1964.743);
   float brightness=fract(sin(roomSeed*3.919)*1237.137);
   vec3 roomColour=warmth>.90?vec3(.68,.82,1.):mix(vec3(1.,.55,.24),vec3(1.,.87,.64),warmth/.9);
   roomLight=roomColour*(.42+.58*brightness)*step(.62,occupied)*windowRoom.y;
   }
  `);
  shader.fragmentShader='varying vec3 roomLight;\nvarying vec2 roomUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec2 roomEdge=smoothstep(vec2(0.),vec2(.08),roomUv)*smoothstep(vec2(0.),vec2(.08),1.-roomUv);
   float roomShade=.83+.17*smoothstep(.1,.9,roomUv.y);
   totalEmissiveRadiance*=roomLight*mix(.55,1.,roomEdge.x*roomEdge.y)*roomShade;
  `);
 };
 material.customProgramCacheKey=()=> 'borough-window-rooms-57';
}
