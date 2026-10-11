// Seeded ridged terrain with domain warping and conservative thermal erosion.
// The editable city valley is kept at its existing elevation by the caller.
const cache=new Map(),N=257,EXTENT=550,STEP=EXTENT*2/(N-1);
export function terrainNoise(x,y,seed){const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(seed,31);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;},a=Math.floor(x),b=Math.floor(y);let u=x-a,v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
export function terrainField(seed){
 if(cache.has(seed))return cache.get(seed);const heights=new Float32Array(N*N);
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const px=x*STEP-EXTENT,pz=z*STEP-EXTENT,warpX=terrainNoise(px*.003,pz*.003,seed+81)*120,warpZ=terrainNoise(px*.003,pz*.003,seed+97)*120;
  let amplitude=65,frequency=.0038,height=0,weight=1;
  for(let octave=0;octave<5;octave++){let ridge=1-Math.abs(terrainNoise((px+warpX)*frequency,(pz+warpZ)*frequency,seed+octave*11)*2-1);ridge*=ridge;const signal=ridge*weight;height+=signal*amplitude;weight=Math.min(1,signal*1.7);frequency*=2.13;amplitude*=.48;}
  heights[z*N+x]=height;
 }
 // Move excess material to the steepest lower neighbor without creating mass.
 const delta=new Float32Array(heights.length),talus=STEP*.62;
 for(let pass=0;pass<26;pass++){delta.fill(0);for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){const i=z*N+x;let lowest=i;for(const offset of [-N,-1,1,N])if(heights[i+offset]<heights[lowest])lowest=i+offset;const drop=heights[i]-heights[lowest];if(drop>talus){const move=(drop-talus)*.2;delta[i]-=move;delta[lowest]+=move;}}for(let i=0;i<heights.length;i++)heights[i]+=delta[i];}
 const result={heights,size:N,step:STEP,sample(x,z){const gx=Math.max(0,Math.min(N-1.001,(x+EXTENT)/STEP)),gz=Math.max(0,Math.min(N-1.001,(z+EXTENT)/STEP)),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*N+ix;return(heights[i]*(1-u)+heights[i+1]*u)*(1-v)+(heights[i+N]*(1-u)+heights[i+N+1]*u)*v;}};
 cache.set(seed,result);if(cache.size>4)cache.delete(cache.keys().next().value);return result;
}
