import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {CameraMovement} from '../dist/camera-movement.js';

function setup(yaw=0,pitch=.6,distance=50){
 const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(5,3,7)};
 camera.position.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance).add(controls.target);camera.lookAt(controls.target);
 let enabled=true;const movement=new CameraMovement(camera,controls,{enabled:()=>enabled});
 return {camera,controls,movement,enable:value=>enabled=value};
}
function key(code,extra={}){return {code,shiftKey:false,target:{closest:()=>null},preventDefault(){this.prevented=true;},...extra};}
const run=(m,seconds=1,rate=60)=>{for(let i=0;i<seconds*rate;i++)m.update(1/rate);};
for(const code of ['KeyW','KeyA','KeyS','KeyD'])test(`${code} follows all camera headings and preserves altitude, tilt and zoom`,()=>{
 for(let n=0;n<8;n++)for(const pitch of [.04,.6,1.5]){
  const {camera,controls,movement}=setup(n*Math.PI/4,pitch),start=camera.position.clone(),target=controls.target.clone(),offset=start.clone().sub(target);
  movement.keydown(key(code));run(movement);
  const delta=camera.position.clone().sub(start),forward=target.clone().sub(start).setY(0).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x);
  const expected=(code==='KeyW'?forward:code==='KeyS'?forward.negate():code==='KeyD'?right:right.negate());
  assert.ok(delta.clone().normalize().dot(expected)>1-1e-10);assert.ok(delta.length()>20&&delta.length()<24);
  assert.equal(camera.position.y,start.y);assert.equal(controls.target.y,target.y);assert.ok(camera.position.clone().sub(controls.target).distanceTo(offset)<1e-10);
 }
});
test('holding movement is frame-rate independent, diagonal-normalized and unaffected by repeat events',()=>{
 const distances=[];
 for(const rate of [30,60,144])for(const diagonal of [false,true]){
  const {camera,movement}=setup(),start=camera.position.clone();movement.keydown(key('KeyW'));if(diagonal)movement.keydown(key('KeyD'));
  for(let n=0;n<20;n++)movement.keydown(key('KeyW',{repeat:true}));assert.ok(camera.position.equals(start));run(movement,1,rate);distances.push(camera.position.distanceTo(start));
 }
 assert.ok(Math.max(...distances)-Math.min(...distances)<1e-9);
});
test('movement immediately follows rotation while a key is held, including an overhead camera',()=>{
 const {camera,controls,movement}=setup();movement.keydown(key('KeyW'));run(movement);
 camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).add(controls.target);camera.lookAt(controls.target);
 let start=camera.position.clone();movement.update(1/60);let delta=camera.position.clone().sub(start);assert.ok(delta.x<0);assert.ok(Math.abs(delta.z)<1e-10);
 camera.position.copy(controls.target).add(new THREE.Vector3(0,50,0));camera.quaternion.setFromEuler(new THREE.Euler(-Math.PI/2,0,Math.PI/3));camera.updateMatrixWorld();
 const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),expected=new THREE.Vector3(right.z,0,-right.x).normalize();start=camera.position.clone();movement.update(1/60);delta=camera.position.clone().sub(start).normalize();assert.ok(delta.dot(expected)>1-1e-10);
});
test('close movement is precise, zoomed-out movement is faster, Shift doubles speed, release stops immediately',()=>{
 const distances=[];
 for(const [distance,fast]of [[12,false],[100,false],[100,true]]){
  const {camera,movement}=setup(0,.6,distance),start=camera.position.clone();movement.keydown(key('KeyW',{shiftKey:fast}));run(movement);distances.push(camera.position.distanceTo(start));
  movement.keyup(key('KeyW'));const stop=camera.position.clone();run(movement);assert.ok(camera.position.equals(stop));
 }
 assert.ok(distances[1]>distances[0]*4);assert.ok(Math.abs(distances[2]/distances[1]-2)<1e-10);
});
test('opposing and duplicate bindings cancel correctly without doubled movement or stuck keys',()=>{
 const {camera,movement}=setup(),start=camera.position.clone();movement.keydown(key('KeyW'));movement.keydown(key('ArrowUp'));movement.keydown(key('KeyS'));run(movement);assert.ok(camera.position.equals(start));
 movement.keyup(key('KeyS'));movement.keyup(key('KeyW'));run(movement);assert.ok(camera.position.distanceTo(start)>20);
 movement.keyup(key('ArrowUp'));const stop=camera.position.clone();run(movement);assert.ok(camera.position.equals(stop));
});
test('home, dialogs, typing, composition and system shortcuts cannot move the camera',()=>{
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{target:{closest:()=>({})}}]){
  const {camera,movement}=setup(),start=camera.position.clone();movement.keydown(key('KeyW'));const event=key('KeyS',extra);movement.keydown(event);run(movement);assert.ok(camera.position.equals(start));assert.equal(event.prevented,undefined);
 }
 const {camera,movement,enable}=setup(),start=camera.position.clone();movement.keydown(key('KeyW'));enable(false);run(movement);enable(true);run(movement);assert.ok(camera.position.equals(start));assert.equal(movement.keys.size,0);
});
test('blur, hidden tabs and text focus clear held input; long frames cannot teleport the camera',()=>{
 const window=new EventTarget(),document=new EventTarget(),{camera,movement}=setup();const unbind=movement.bind(window,document);
 const dispatch=(target,type,props={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;};
 for(const [target,event]of [[window,'blur'],[document,'visibilitychange'],[document,'focusin']]){
  const e=dispatch(window,'keydown',{code:'KeyW'});assert.equal(e.defaultPrevented,true);
  if(event==='focusin'){const focus=new Event(event);Object.defineProperty(focus,'target',{value:{closest:()=>({})}});document.dispatchEvent(focus);}else dispatch(target,event);
  const start=camera.position.clone();run(movement);assert.ok(camera.position.equals(start));
 }
 movement.keydown(key('KeyW'));const start=camera.position.clone();movement.update(Infinity);movement.update(NaN);movement.update(-1);assert.ok(camera.position.equals(start));movement.update(30);assert.ok(camera.position.distanceTo(start)<2);
 unbind();dispatch(window,'keydown',{code:'KeyW'});assert.equal(movement.keys.size,0);
});
