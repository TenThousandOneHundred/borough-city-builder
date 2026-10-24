import E from '../dist/engine.js';

export function collisionFixtures(){
 const fixtures=[];
 function make(name,roads,{terrain='plains',seed=8,water=false}={}){
  const world=E.createWorld(name,terrain,seed);world.money=1e7;
  for(const [i,[points,type='street']]of roads.entries()){
   const built=E.buildRoadPath(world,points.map(([x,y])=>({x,y})),type);
   if(!built.ok)throw Error(name+': '+built.reason);
   const oldId=built.path.id;built.path.id='fixture-road-'+i;
   for(const tile of world.tiles)if(tile.pathIds)tile.pathIds=tile.pathIds.map(id=>id===oldId?built.path.id:id);
  }
  if(water)for(let y=5;y<42;y++)for(let x=5;x<43;x++)if((x*7+y*13)%31===0)world.tiles[y*48+x].ground='water';
  fixtures.push({name,world});
 }
 make('starter',[]);
 for(const type of Object.keys(E.ROADS))make('diagonal-'+type,[[[[19,24],[40,7]],type]]);
 make('wide-curves',[[[[3,8],[24,1],[44,8]],'boulevard'],[[[3,20],[24,8],[44,20]],'avenue'],[[[3,33],[24,21],[44,33]],'street'],[[[44,44],[24,34],[3,44]],'alley']]);
 make('crossings',[[[[5,6],[43,41]],'avenue'],[[[43,6],[5,41]],'highway'],[[[25,3],[25,44]],'boulevard']]);
 make('joined-curves',[[[[19,24],[28,24]]],[[[28,24],[33,24],[36,19]]],[[[42,14],[36,19]]]]);
 make('boundary-bins',[[[[0,1],[47,1]]],[[[0,46],[47,46]]],[[[1,0],[1,47]]],[[[46,0],[46,47]]],[[[8,8],[24,8],[40,40]]]]);
 make('water-obstacles',[[[[3,9],[24,2],[44,9]]],[[[3,22],[24,9],[44,22]]],[[[3,42],[24,29],[44,42]]]],{water:true});
 for(const terrain of ['river','islands'])for(const seed of [8,431])make(terrain+'-'+seed,[[[[4,12],[24,4],[43,12]]],[[[5,30],[22,13],[42,33]],'avenue']],{terrain,seed});
 return fixtures;
}
export const layoutVariants=[{}, {cellSize:1.6,rows:6,independent:true}, {cellSize:1.6,rows:2,independent:true}];
