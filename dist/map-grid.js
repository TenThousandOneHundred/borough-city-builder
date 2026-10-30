// Coordinate context for legacy grid helpers. Every world-taking entry point
// restores its caller's dimensions; yielded geometry jobs retain their scope.
(function(root){
'use strict';
if(root.BoroughGrid){if(typeof module!=='undefined')module.exports=root.BoroughGrid;return;}
const sizes=new Map();let current;
function dimensions(n=48){if(!sizes.has(n))sizes.set(n,{n,last:n-1,half:n*2,span:n*4,count:n*n,edgeRow:n*(n-1),elevationN:n*2+1,elevationCount:(n*2+1)**2,sampleN:n*4+3,halfPlus1:n*2+1,halfPlus2:n*2+2,halfPlus4:n*2+4,halfMinus1:n*2-1,halfMinus2:n*2-2,halfMinus6:n*2-6,halfTolerance:n*2+.001});return sizes.get(n);}
current=dimensions();
const isWorld=w=>w&&typeof w==='object'&&(Array.isArray(w.tiles)||Object.hasOwn(w,'mapSize'));
function size(w){return [72,96].includes(w?.mapSize)?w.mapSize:48;}
function scope(n,fn){const before=current;current=dimensions(n);try{return fn();}finally{current=before;}}
function iterator(it,n){return {next:v=>scope(n,()=>it.next(v)),return:v=>scope(n,()=>it.return?.(v)||{done:true,value:v}),throw:v=>scope(n,()=>it.throw(v)),[Symbol.iterator](){return this;}};}
function bind(fn){return function(...args){const world=args.find(isWorld)||this?.world||this?.view?.world||this?.v?.world||this?.traffic?.world;const n=world?size(world):current.n;
 const result=scope(n,()=>fn.apply(this,args));return result&&typeof result.next==='function'?iterator(result,n):result;
};}
function bindClass(Type){for(const key of Object.getOwnPropertyNames(Type.prototype)){if(key==='constructor'||key==='setWorld')continue;const d=Object.getOwnPropertyDescriptor(Type.prototype,key);if(typeof d.value==='function')Object.defineProperty(Type.prototype,key,{...d,value:bind(d.value)});}return new Proxy(Type,{construct(Target,args,newTarget){const world=args.find(isWorld);return scope(world?size(world):current.n,()=>Reflect.construct(Target,args,newTarget));}});}
const api={size,dimensions,scope,bind,bindClass,activate:w=>{current=dimensions(size(w));}};
for(const key of Object.keys(current))Object.defineProperty(api,key,{enumerable:true,get:()=>current[key]});
root.BoroughGrid=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
