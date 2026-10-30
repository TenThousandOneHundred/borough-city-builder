// Ground-plane movement follows the current view, independent of keyboard repeat.
const actions={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const editable=target=>!!target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
export class CameraMovement{
 constructor(camera,controls,{enabled=()=>true}={}){this.camera=camera;this.controls=controls;this.enabled=enabled;this.keys=new Set();this.fast=false;this.speed=0;}
 clear(){this.keys.clear();this.fast=false;this.speed=0;}
 keydown(e){
  if(!this.enabled()||editable(e.target)||e.isComposing||e.ctrlKey||e.metaKey||e.altKey){this.clear();return;}
  this.fast=!!e.shiftKey;
  if(actions[e.code]){e.preventDefault();this.keys.add(e.code);}
 }
 keyup(e){this.keys.delete(e.code);this.fast=!!e.shiftKey;if(!this.keys.size)this.speed=0;}
 held(action){for(const code of this.keys)if(actions[code]===action)return 1;return 0;}
 update(dt){
  if(!this.enabled()){this.clear();return;}
  let forward=this.held('forward')-this.held('back'),right=this.held('right')-this.held('left');const length=Math.hypot(forward,right);
  if(!length){this.speed=0;return;}
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);forward/=length;right/=length;
  const p=this.camera.position,t=this.controls.target;
  let fx=t.x-p.x,fz=t.z-p.z,flat=Math.hypot(fx,fz);
  if(flat<1e-8){
   // At the pole, use the camera's screen-right axis instead of a map heading.
   this.camera.updateMatrixWorld();const m=this.camera.matrixWorld.elements;fx=m[2];fz=-m[0];flat=Math.hypot(fx,fz);
  }
  if(flat<1e-8)return;fx/=flat;fz/=flat;
  const wanted=Math.max(8,Math.min(140,p.distanceTo(t)*.45))*(this.fast?2:1),tau=.09,gain=1-Math.exp(-dt/tau);
  const distance=wanted*dt+(this.speed-wanted)*tau*gain;this.speed+=(wanted-this.speed)*gain;
  const dx=(fx*forward-fz*right)*distance,dz=(fz*forward+fx*right)*distance;
  p.x+=dx;p.z+=dz;t.x+=dx;t.z+=dz;
 }
 bind(window,document){
  const down=e=>this.keydown(e),up=e=>this.keyup(e),clear=()=>this.clear(),focus=e=>{if(editable(e.target))this.clear();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',clear);document.addEventListener('focusin',focus);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('focusin',focus);this.clear();};
 }
}
