(function(root){
'use strict';
// Saved high-water population makes earned unlocks permanent. The level is
// also the reward receipt, so saving/reloading cannot pay a grant twice.
const MILESTONES=[
 {name:'Founding Village',population:0,reward:0},
 {name:'Growing Village',population:100,reward:5000},
 {name:'Small Town',population:300,reward:8000},
 {name:'Busy Town',population:650,reward:12000},
 {name:'Regional Center',population:1200,reward:18000},
 {name:'City',population:2000,reward:25000},
 {name:'Great City',population:3500,reward:35000}
];
const ROADS={gravel:0,alley:0,street:0,oneway:1,avenue:2,green:3,boulevard:4,highway:4,ramp:4,highway2:4,motorway:4,highway4:5};
const ZONES={residential_low:0,commercial_low:0,industrial:0,residential_row:1,residential_medium:2,residential_mixed:3,residential_lowrent:3,office_low:3,commercial_high:4,residential_high:5,office:5,erase:0};
const BUILDINGS={cottage:0,townhouse:1,apartments:2,mixeduse:3,lowrent:3,tower:5,shops:0,market:0,hotel:4,warehouse:0,factory:0,localoffice:3,business:3,glass:5,wind:0,coal:0,solar:2,substation:4,watertower:0,pump:0,treatment:3,wellness:1,clinic:1,hospital:4,elementary:1,highschool:3,college:5,police:2,fire:2,headquarters:6,rescue:5,park:1,playground:1,plaza:2,court:2,bus:3,terminal:4,transit:6,transfer:1,recycle:2,recovery:5};
const DEFAULTS={power:'coal',water:'watertower',hospital:'clinic',school:'elementary',police:'police',fire:'fire',park:'park',bus:'bus',garbage:'recycle',residential:'cottage',commercial:'shops',industrial:'warehouse',office:'business'};
const levelAt=population=>MILESTONES.reduce((level,m,i)=>population>=m.population?i:level,0);
const active=w=>w?.progression?.mode==='milestones';
function initialize(w,mode='milestones',population=0){
 if(!['milestones','sandbox'].includes(mode))throw Error('Choose a valid progression mode');
 const peak=Math.max(0,Math.floor(Number.isFinite(population)?population:0));
 w.progression={version:1,mode,peak,level:levelAt(peak)};
 return w.progression;
}
function valid(p){return p===undefined||!!p&&p.version===1&&['milestones','sandbox'].includes(p.mode)&&Number.isSafeInteger(p.peak)&&p.peak>=0&&Number.isInteger(p.level)&&p.level===levelAt(p.peak);}
function advance(w,population){
 if(!active(w)||!Number.isFinite(population))return [];
 const p=w.progression;p.peak=Math.max(p.peak,Math.floor(population));
 const level=levelAt(p.peak),earned=MILESTONES.slice(p.level+1,level+1);
 p.level=level;w.money+=earned.reduce((sum,m)=>sum+m.reward,0);root.BoroughLand?.award(w);return earned;
}
function requirement(tool,options={}){
 if(options.zone)return ZONES[options.zone]??0;
 if(tool==='road')return ROADS[options.roadType||(options.roadWidth===2?'avenue':'street')]??0;
 if(options.building)return BUILDINGS[options.building]??0;
 if(options.transit||tool==='busline')return 3;
 if(['residential','commercial','office'].includes(tool)&&options.density==='high')return tool==='residential'?5:tool==='commercial'?4:5;
 return BUILDINGS[DEFAULTS[tool]]??0;
}
function access(w,tool,options={}){
 const level=requirement(tool,options),milestone=MILESTONES[level],ok=!active(w)||w.progression.level>=level;
 return {ok,level,milestone,reason:ok?'':'Unlocks at '+milestone.name+' · '+milestone.population.toLocaleString()+' residents'};
}
function status(w,population=0){
 const enabled=active(w),level=enabled?w.progression.level:levelAt(population),current=MILESTONES[level],next=MILESTONES[level+1];
 const peak=enabled?w.progression.peak:population;
 return {enabled,level,current,next,peak,progress:next?Math.max(0,Math.min(1,(peak-current.population)/(next.population-current.population))):1};
}
const api={MILESTONES,ROADS,ZONES,BUILDINGS,DEFAULTS,levelAt,active,initialize,valid,advance,requirement,access,status};
root.BoroughProgression=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
