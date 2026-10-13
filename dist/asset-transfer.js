// GitHub Pages serves these binary assets without transport compression.
// Decode a lossless gzip copy in the browser; older browsers retain the raw path.
export async function loadBinary(url,{fetcher=globalThis.fetch,Decompressor=globalThis.DecompressionStream,timeoutMs=45000}={}){
 const read=async(target,compressed)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetcher(target,{signal:controller.signal});
   if(!response.ok)throw new Error(`Asset request failed: ${response.status}`);
   if(!compressed)return await response.arrayBuffer();
   return await new Response(response.body.pipeThrough(new Decompressor('gzip'))).arrayBuffer();
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
