let taskChannel;
function nextTask(){
 // A chain of message tasks can occupy several frame intervals even when each
 // slice is short. Give visible cities a render opportunity between slices.
 // Hidden worlds use tasks so offscreen simulation/construction keeps running.
 if(typeof requestAnimationFrame==='function'&&globalThis.document?.visibilityState==='visible')return new Promise(resolve=>{
  let frame;const finish=()=>{clearTimeout(timer);cancelAnimationFrame(frame);resolve();};
  // A tab can become hidden after requesting its next frame.
  const timer=setTimeout(finish,50);frame=requestAnimationFrame(finish);
 });
 if(globalThis.scheduler?.yield)return globalThis.scheduler.yield();
 // Timers become clamped after repeated yields. A message task lets input and
 // rendering run without adding four milliseconds to every construction slice.
 if(typeof window!=='undefined'&&typeof MessageChannel!=='undefined'){
  if(!taskChannel){const channel=new MessageChannel(),waiting=[];channel.port1.onmessage=()=>waiting.shift()?.();taskChannel={channel,waiting};}
  return new Promise(resolve=>{taskChannel.waiting.push(resolve);taskChannel.channel.port2.postMessage(null);});
 }
 return new Promise(resolve=>setTimeout(resolve,0));
}
// The synchronous path and interactive path execute the same geometry steps.
export function finishBuild(steps){let next;do{next=steps.next();}while(!next.done);return next.value;}
export async function scheduleBuild(steps,{budgetMs=8,now=()=>performance.now(),yieldTask=nextTask,cancelled=()=>false,onSlice=()=>{}}={}){
 try{
  while(true){
   if(cancelled())throw new DOMException('Road preparation cancelled','AbortError');
   const start=now();let next;
   do{next=steps.next();if(next.done){onSlice(now()-start);return next.value;}}while(now()-start<budgetMs);
   onSlice(now()-start);await yieldTask();
  }
 }finally{steps.return?.();}
}
