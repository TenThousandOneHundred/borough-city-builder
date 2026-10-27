// Simulation time is independent of render frequency, visibility and camera position.
// Delayed callbacks retain their time debt and drain it in bounded batches.
export class SimulationClock {
 constructor(step,{now=()=>performance.now(),fixedStep=.05,maxSteps=100,maxWorkMs=Infinity,workNow=()=>performance.now()}={}){this.step=step;this.now=now;this.fixedStep=fixedStep;this.maxSteps=maxSteps;this.maxWorkMs=maxWorkMs;this.workNow=workNow;this.running=false;this.speed=1;this.pending=0;this.last=now();this.total=0;}
 pulse(time=this.now()){
  const elapsed=Math.max(0,(time-this.last)/1000);this.last=time;
  if(!this.running)return 0;
  this.pending+=elapsed*this.speed;let count=0;
  const budget=typeof this.maxWorkMs==='function'?this.maxWorkMs():this.maxWorkMs,limited=Number.isFinite(budget),start=limited?this.workNow():0;
  // Yield only between complete fixed steps; unprocessed time stays pending.
  while(this.pending+1e-9>=this.fixedStep&&count<this.maxSteps){this.pending=Math.max(0,this.pending-this.fixedStep);this.step(this.fixedStep);this.total+=this.fixedStep;count++;if(limited&&this.workNow()-start>=budget)break;}
  return count;
 }
 setRunning(value){value=!!value;if(value===this.running)return;this.pulse();this.running=value;this.last=this.now();}
 setSpeed(value){if(value===this.speed)return;this.pulse();this.speed=value;}
 reset(){this.pending=0;this.last=this.now();this.total=0;}
 get interpolation(){return Math.min(1,(this.pending+(this.running?Math.max(0,this.now()-this.last)/1000*this.speed:0))/this.fixedStep);}
}
