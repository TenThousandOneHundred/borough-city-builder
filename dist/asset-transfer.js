// GitHub Pages serves these binary assets without transport compression.
// Decode a lossless gzip copy in the browser; older browsers retain the raw path.
export async function loadBinary(url,{fetcher=globalThis.fetch,Decompressor=globalThis.DecompressionStream,timeoutMs=45000}={}){
 const read=async(target,compressed)=>{
  const controller=new AbortController();let timer;
  const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),timeoutMs);};
  heartbeat();
  try{
   const response=await fetcher(target,{signal:controller.signal});
   if(!response.ok)throw new Error(`Asset request failed: ${response.status}`);
   // Bound inactivity, not total transfer time: a slow connection that keeps
   // delivering bytes must not lose its detailed models halfway through.
   const reader=response.body.getReader(),chunks=[];let length=0;
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);length+=value.byteLength;heartbeat();}
   clearTimeout(timer);
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   if(!compressed)return bytes.buffer;
   return await new Response(new Blob([bytes]).stream().pipeThrough(new Decompressor('gzip'))).arrayBuffer();
  }finally{clearTimeout(timer);}
 };
 if(Decompressor){
  const compressed=new URL(url);compressed.pathname+='.gz';
  try{return await read(compressed.href,true);}catch(error){
   // Missing/corrupt compressed copies must not remove a building catalogue.
   console.warn('Compressed asset fallback:',new URL(url).pathname,error.message);
  }
 }
 return read(String(url),false);
}

export function trackAssetGroups(groups,onProgress){
 const pending=new Set(Object.keys(groups)),total=pending.size;
 const report=()=>onProgress({completed:total-pending.size,total,pending:[...pending]});
 report();
 return Promise.all(Object.entries(groups).map(([name,promise])=>Promise.resolve(promise).finally(()=>{pending.delete(name);report();})));
}
