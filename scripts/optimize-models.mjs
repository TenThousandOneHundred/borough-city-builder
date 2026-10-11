// Run with a node_modules directory containing @gltf-transform and meshoptimizer.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const [modules,input,output,ratioText='.035']=process.argv.slice(2),ratio=Number(ratioText);
const from=p=>import(pathToFileURL(path.join(modules,p)).href);
const {NodeIO}=await from('@gltf-transform/core/dist/index.js');
const {ALL_EXTENSIONS}=await from('@gltf-transform/extensions/dist/index.js');
const {compactPrimitive,prune}=await from('@gltf-transform/functions/dist/index.js');
const {MeshoptSimplifier}=await from('meshoptimizer/meshopt_simplifier.js');
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(input);
let before=0,after=0;
for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
 const index=primitive.getIndices(),position=primitive.getAttribute('POSITION');if(!index)continue;
 const indices=new Uint32Array(index.getArray());before+=indices.length/3;
 if(indices.length>120){const [reduced]=MeshoptSimplifier.simplify(indices,new Float32Array(position.getArray()),3,Math.max(36,Math.floor(indices.length*ratio/3)*3),.035,['Permissive']);
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(index.getBuffer()));compactPrimitive(primitive);after+=reduced.length/3;
 }else after+=indices.length/3;
}
await doc.transform(prune());await io.write(output,doc);console.log({before,after,output});
