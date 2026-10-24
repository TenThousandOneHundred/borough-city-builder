// Reusable shortest-path workspace. Euclidean sidewalk graphs may opt into
// an admissible destination bound; arbitrary weighted graphs retain Dijkstra.
// Keep the existing heap's tie order so residents choose the same paths.
export class WalkingSearch {
 constructor(){this.generation=0;this.capacity=0;this.heapIds=[];this.heapCosts=[];}
 prepare(size){
  if(size>this.capacity){
   this.capacity=Math.max(16,2**Math.ceil(Math.log2(size)));
   this.costs=new Float64Array(this.capacity);this.parents=new Int32Array(this.capacity);
   this.seen=new Uint32Array(this.capacity);this.goals=new Uint32Array(this.capacity);this.goalCosts=new Float64Array(this.capacity);this.estimates=new Float64Array(this.capacity);this.estimated=new Uint32Array(this.capacity);
  }
  this.generation=(this.generation+1)>>>0;
  if(!this.generation){this.seen?.fill(0);this.goals?.fill(0);this.estimated?.fill(0);this.generation=1;}
  this.heapSize=0;
 }
 push(id,cost){
  let i=this.heapSize++;
  while(i){const p=(i-1)>>1;if(this.heapCosts[p]<=cost)break;this.heapIds[i]=this.heapIds[p];this.heapCosts[i]=this.heapCosts[p];i=p;}
  this.heapIds[i]=id;this.heapCosts[i]=cost;
 }
 pop(){
  this.poppedId=this.heapIds[0];this.poppedCost=this.heapCosts[0];
  const size=--this.heapSize,id=this.heapIds[size],cost=this.heapCosts[size];
  if(!size)return;
  let i=0;while(i*2+1<size){let j=i*2+1;if(j+1<size&&this.heapCosts[j+1]<this.heapCosts[j])j++;if(this.heapCosts[j]>=cost)break;this.heapIds[i]=this.heapIds[j];this.heapCosts[i]=this.heapCosts[j];i=j;}
  this.heapIds[i]=id;this.heapCosts[i]=cost;
 }
 find(nodes,starts,ends,from,to,geometric=false){
  this.prepare(nodes.length);if(!starts.length||!ends.length)return null;
  const stamp=this.generation,{costs,parents,seen,goals,goalCosts,estimates,estimated}=this;
  const estimate=id=>{if(!geometric)return 0;if(estimated[id]!==stamp){estimated[id]=stamp;estimates[id]=Math.hypot(nodes[id].x-to.x,nodes[id].z-to.z);}return estimates[id];};
  for(const n of ends){goals[n.id]=stamp;goalCosts[n.id]=Math.hypot(n.x-to.x,n.z-to.z);}
  for(const n of starts){const cost=Math.hypot(n.x-from.x,n.z-from.z);seen[n.id]=stamp;costs[n.id]=cost;parents[n.id]=-1;this.push(n.id,cost+estimate(n.id));}
  let best=Infinity,end=-1;
  while(this.heapSize){
   this.pop();const id=this.poppedId,priority=this.poppedCost,cost=costs[id];
   // The minimum queued cost bounds every remaining route, even stale entries.
   if(priority>=best)break;
   if(priority!==cost+estimate(id))continue;
   if(goals[id]===stamp&&cost+goalCosts[id]<best){best=cost+goalCosts[id];end=id;}
   for(const [next,length]of nodes[id].links){const d=cost+length;if(seen[next]!==stamp||d<costs[next]){seen[next]=stamp;costs[next]=d;parents[next]=id;this.push(next,d+estimate(next));}}
  }
  if(end<0)return null;
  const ids=[];for(let id=end;id!==-1;id=parents[id])ids.push(id);ids.reverse();
  return {ids,length:best};
 }
}
