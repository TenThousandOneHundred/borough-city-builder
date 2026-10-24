// Compare detached and row-house grounds planning and shared prop batches. Excludes building meshes,
// vegetation geometry and browser frame time. Usage: node ... [baseline git ref]
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import * as THREE from '../dist/vendor/three.module.js';
import {sitePlan} from '../dist/site-plan.js';
import {SiteDetails} from '../dist/site-details.js';
import {BuildingFactory} from '../dist/building-factory.js';

const baseline=process.argv[2]||'f7c413e',base=new URL('../dist/',import.meta.url).href;
const read=file=>execFileSync(process.env.GIT_BIN||'git',['show',baseline+':dist/'+file],{encoding:'utf8'});
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const oldPlanUrl=moduleUrl(read('site-plan.js'));
const {sitePlan:oldPlan}=await import(oldPlanUrl);
const {SiteDetails:OldDetails}=await import(moduleUrl(read('site-details.js')
 .replace(/from '\.\/site-plan\.js[^']*'/,"from '"+oldPlanUrl+"'")
 .replaceAll("from './","from '"+base)));
const fixtures=[];
for(const width of [3.16,4.76,6.36,7.96,9.56])for(const depth of [4.76,6.36,7.96,9.56])for(const row of [false,true]){
 const buildingWidth=row?width-.4:Math.min(width-.4,2.4),buildingDepth=2.4,setback=(depth-buildingDepth)/2-.4;
 fixtures.push([{lotWidth:width,lotDepth:depth,type:'residential',low:true,density:'low',variation:.7,seed:fixtures.length+19,entranceXs:row?[-width*.25,width*.25]:[.4],...(row?{rowDividers:[0]}:{})},
 {minX:-buildingWidth/2,maxX:buildingWidth/2,minZ:setback-buildingDepth/2,maxZ:setback+buildingDepth/2}]);
}

const report={baseline,lots:fixtures.length,scope:'CPU planning and hardscape geometry only; not FPS'};
for(const [label,plan,Details]of [['before',oldPlan,OldDetails],['after',sitePlan,SiteDetails]]){
 const samples=[];for(let repeat=0;repeat<41;repeat++){
  const start=performance.now();for(const [p,b]of fixtures)plan(p,b);
  if(repeat>5)samples.push((performance.now()-start)/fixtures.length);
 }
 const details=new Details({}),factory=new BuildingFactory({scene:new THREE.Scene()}),buildings=new Map();
 let triangles=0,trees=0,instances=0,parkingBays=0;
 for(const [i,[p,b]]of fixtures.entries()){
  const root=details.build(p,b);root.position.x=i*12;root.rotation.y=i*.1;
  trees+=root.userData.sitePlan.filter(a=>a.kind==='tree').length;
  parkingBays+=root.userData.sitePlan.filter(a=>a.kind==='parking').length;
  root.userData={...root.userData,factory:true,asset:true,renderImmutable:true};
  root.traverse(o=>{if(o.isMesh){triangles+=o.geometry.index.count/3;instances++;}});
  buildings.set(i,root);
 }
 factory.rebuild(buildings);
 report[label]={planningMedianMsPerLot:samples.sort((a,b)=>a-b)[Math.floor(samples.length/2)],hardscapeTriangles:triangles,
  hardscapeInstances:instances,materialGeometryDraws:factory.batchRoot.children.filter(m=>m.count>0).length,plannedTrees:trees,parkingBays};
}
console.log(JSON.stringify(report,null,2));
