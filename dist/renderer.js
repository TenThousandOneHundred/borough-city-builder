import {fitGradedLots,lotGradingKey} from './lot-grading.js?v=160';
import {updateLandBoundary} from './land-boundary.js?v=160';
import './map-grid.js?v=160';
const G=globalThis.BoroughGrid;
import {constructionGrid} from './construction-grid.js?v=160';
import {prepareRoadRefresh} from './road-build-job.js?v=160';
import {RoadGuidePreview} from './road-guide-preview.js?v=160';
import {SIDEWALK_HEIGHT} from './road-profile.js?v=160';
import './building-entities.js?v=160';
const Buildings=globalThis.BoroughBuildings;
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {ZonePlaneBatch} from './zoning-render-batch.js?v=160';
import {trackAssetGroups} from './asset-transfer.js?v=160';
import {buildFootpaths} from './footpaths.js?v=160';
import {Transit,transitLeg,stopPosition} from './transit.js?v=160';
import {SimulationClock} from './simulation-clock.js?v=160';
import {Residents} from './residents.js?v=160';
import {Traffic,carCapacity} from './traffic.js?v=160';
import {Vehicles} from './vehicles.js?v=160';
import {BuildingFactory} from './building-factory.js?v=160';
import {StreetLife} from './street-life.js?v=160';
import {changedRoadCells,frontageTouches} from './road-frontage.js?v=160';
import {visualParcels} from './parcels.js?v=160';
import {Graphics} from './graphics.js?v=160';
import {Vegetation} from './vegetation.js?v=160';
import {RGBELoader} from './vendor/RGBELoader.js';
import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Landscape,groundHeight,floorHeight,wetness,terrainColor} from './landscape.js?v=160';
import {Architecture} from './architecture.js?v=160';
import {Roadworks} from './roadworks.js?v=160';
const N=48,T=4,HALF=96,zoneColors={residential:'#54b663',commercial:'#5bb1d8',industrial:'#cdb268',office:'#aa87c9'};
export class CityView{
constructor(canvas){this.assetsReady=false;this.loadingElement=document.getElementById('sceneLoading');this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#aebfca');this.scene.fog=new THREE.FogExp2('#b7c6cc',.00105);
this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.87;
this.camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.2,1800);this.camera.position.set(-65,65,90);this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(-8,1,0);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.maxPolarAngle=Math.PI*.48;this.controls.minPolarAngle=.13;this.controls.minDistance=12;this.controls.maxDistance=420;this.controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
this.ambient=new THREE.HemisphereLight('#cbdcf0','#606c78',.55);this.scene.add(this.ambient);this.sun=new THREE.DirectionalLight('#fff6e9',3.0);this.sun.position.set(-65,95,70);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-105,right:105,top:105,bottom:-105,near:1,far:340});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.012;this.sun.shadow.radius=2;this.scene.add(this.sun);
this.vehicles=new Vehicles();this.materials=new Map();this.unitBox=new THREE.BoxGeometry(1,1,1);this.tileGroup=new THREE.Group();this.carGroup=new THREE.Group();this.previewGroup=new THREE.Group();this.scene.add(this.tileGroup,this.carGroup,this.previewGroup);this.zoneGroup=new THREE.Group();this.scene.add(this.zoneGroup);this.zoning=false;this.buildings=new Map();this.cars=[];this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.point=new THREE.Vector3();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),.1);this.clock=new THREE.Clock();this.time=0;this.overlay='none';this.night=false;
this.cursor=new THREE.Mesh(new THREE.PlaneGeometry(T,T),new THREE.MeshBasicMaterial({color:'#63c9ff',transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide}));this.cursor.rotation.x=-Math.PI/2;this.cursor.visible=false;this.scene.add(this.cursor);this.grid=new THREE.Group();this.grid.visible=false;this.scene.add(this.grid);
this.vegetation=new Vegetation(this);this.landscape=new Landscape(this);this.architecture=new Architecture(this);this.models=new BuildingFactory(this);this.roadworks=new Roadworks(this);this.streetLife=new StreetLife(this);this.ready=trackAssetGroups({Terrain:this.landscape.ready,Trees:this.vegetation.ready,Buildings:this.models.ready,Lighting:this.loadEnvironment()},({completed,total,pending})=>{if(this.loadingElement)this.loadingElement.textContent=`Loading city details ${completed}/${total} · ${pending.join(', ')||'Preparing scene'}`;}).then(()=>this.refreshAssets());this.environment();this.graphics=new Graphics(this);this.simulationClock=new SimulationClock(dt=>{if(!this.world||!this.traffic)return;for(const a of this.traffic.agents){a.previousX=a.x;a.previousZ=a.z;}this.traffic.update(dt);this.transit?.update(dt);this.residents?.update(dt);},{maxWorkMs:()=>document.hidden?Infinity:8});this.simulationTimer=setInterval(()=>this.simulationClock.pulse(),16);this.resize();window.addEventListener('resize',()=>this.resize());this.frame=()=>{requestAnimationFrame(this.frame);if(document.hidden){this.clock.getDelta();return}const elapsed=this.clock.getDelta(),dt=Math.min(.05,elapsed);this.time+=dt;this.controls.update();this.landscape.update(this.time,this.night);this.vegetation.update();this.streetLife.update(dt);if(this.world&&this.running){this.roadworks.updateSignals(this.traffic);for(let car of this.cars)this.moveCar(car);}if(this.world)this.vehicles.updateFleet(this.cars,this.camera);if(this.menu&&!document.querySelector('dialog[open]')){this.camera.position.sub(this.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),dt*.006).add(this.controls.target);this.controls.update()}if(this.world&&this.time-(this.lodTime||0)>.7){this.lodTime=this.time;if(!this.lodCamera||this.camera.position.distanceTo(this.lodCamera)>4){this.lodCamera=this.camera.position.clone();this.refresh()}}if(this.time-(this.visibilityTime||0)>.15){this.visibilityTime=this.time;this.models.updateVisibility()}this.renderer.info.autoReset=false;this.renderer.info.reset();this.roadGuidePreview?.updateLabels();this.graphics.render();this.performanceFrames=(this.performanceFrames||0)+1;this.performanceElapsed=(this.performanceElapsed||0)+elapsed;if(this.performanceElapsed>=1){const stats=document.getElementById('performanceStats');if(stats)stats.textContent=Math.round(this.performanceFrames/this.performanceElapsed)+' FPS · '+Math.round(this.renderer.info.render.triangles/1000)+'k triangles · '+this.renderer.info.render.calls+' draws';const live=document.getElementById('gamePerformance');if(live&&stats){live.textContent=stats.textContent.split(' · ')[0];live.title=stats.textContent;}this.performanceFrames=0;this.performanceElapsed=0;}};this.frame()}
get running(){return !!this._running;}
set running(value){this.simulationClock?.setRunning(value);this._running=!!value;}
get simSpeed(){return this._simSpeed||1;}
set simSpeed(value){this.simulationClock?.setSpeed(value);this._simSpeed=value;}
async loadEnvironment(){try{const texture=await new RGBELoader().loadAsync(new URL('./assets/daylight.hdr',import.meta.url).href);texture.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(this.renderer),target=pmrem.fromEquirectangular(texture);this.environmentTarget?.dispose();this.environmentTarget=target;this.scene.environment=target.texture;this.scene.environmentIntensity=.38;this.skyTexture=texture;if(!this.night)this.scene.background=texture;this.scene.backgroundIntensity=.7;this.scene.backgroundBlurriness=.08;pmrem.dispose()}catch(e){console.warn('Daylight fallback:',e.message)}}
focusWorld(menu){const developed=Buildings.entries(this.world).filter(([,t])=>t.type&&t.type!=='road').map(([id])=>Buildings.point(this.world,id));let x=this.world.land?-G.half+40:-30,z=2;if(developed.length){x=developed.reduce((a,p)=>a+p.x,0)/developed.length;z=developed.reduce((a,p)=>a+p.z,0)/developed.length}const base=[1,2,3].includes(this.world.landformVersion)&&!menu?floorHeight(this.world,x,z):0;this.controls.target.set(x,base+1,z);if(menu){x=3;z=-5;this.controls.target.set(x,4,z);}this.camera.position.set(x-(menu?18:27),menu?15:base+23,z+(menu?21:35));this.controls.update()}
environment(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#7ea0ba');g.addColorStop(.45,'#c8d8dd');g.addColorStop(.51,'#d3d8ce');g.addColorStop(.62,'#a6aa8c');g.addColorStop(1,'#737e63');x.fillStyle=g;x.fillRect(0,0,512,256);const glow=x.createRadialGradient(155,55,1,155,55,55);glow.addColorStop(0,'#fff4d8');glow.addColorStop(.05,'#fff4d8b0');glow.addColorStop(1,'#f5eee000');x.fillStyle=glow;x.fillRect(80,0,150,120);const texture=new THREE.CanvasTexture(c);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(this.renderer);const target=pmrem.fromEquirectangular(texture);this.scene.environment=target.texture;this.environmentTarget=target;pmrem.dispose();texture.dispose();}
mat(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.78}));return this.materials.get(color)}
box(group,x,y,z,sx,sy,sz,color,shadow=true){const m=new THREE.Mesh(this.unitBox,this.mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=shadow;m.receiveShadow=true;group.add(m);return m}
disposeGroup(g){g.traverse(o=>{if(o.geometry&&o.geometry!==this.unitBox&&!o.userData.sharedAsset)o.geometry.dispose()});g.clear()}
setWorld(w,{menu=false,reset=true}={}){G.activate(w);this.roadRefreshJob=null;this.onRoadBuildStatus?.(false);this.clearRoadZoning();this.running=false;this.simulationClock?.reset();this.world=w;this.menu=menu;this.signatures=[];this.renderStates=[];this.fineRenderStates=new Map();this.fineRevision=null;this.disposeGroup(this.tileGroup);for(const g of this.buildings.values())if(g.userData.factory)this.disposeGroup(g);this.buildings.clear();for(const car of this.cars)this.disposeGroup(car.mesh);for(const mesh of this.vehicles.fleet||[])mesh.dispose();this.vehicles.fleet=[];this.disposeGroup(this.carGroup);this.cars=[];this.residents=null;this.transit=null;this.traffic=null;this.transitKey=null;this.walkRevision=null;if(this.transitGroup)this.disposeGroup(this.transitGroup);this.landscape.build(w,{deferDevelopment:true});this.gridPending=true;if(reset){this.focusWorld(menu)}this.refresh(true);updateLandBoundary(this)}
refreshAssets(){
 this.roadRefreshJob=null;this.onRoadBuildStatus?.(false);
 // Loading visual assets must not reset a running world's clock or its agents.
 this.assetsReady=true;if(this.loadingElement)this.loadingElement.hidden=true;
 this.architecture.cache.clear();this.models.materials.reset();
 if(!this.world)return;
 this.landscape.build(this.world,{deferDevelopment:true});this.roadworks.build(this.world);
 if(this.traffic)this.roadworks.syncSignals(this.traffic);
 this.refresh(true);
}
makeGrid(prepared=null){this.disposeGroup(this.grid);const geo=prepared||constructionGrid((x,z)=>this.renderFloor(this.world,x,z));this.grid.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#b6ced2',transparent:true,opacity:.16})))}
refreshInteractive(){
 if(this.roadRefreshJob)return this.roadRefreshJob.promise;
 if(!this.world||this.menu||this.assetsReady===false||this.roadEditRevision===undefined)return this.refresh();
 if(this.roadEditRevision!==(this.world.roadEditRevision||0)||changedRoadCells(this.world.tiles,this.frontageLayout).changed.length)return prepareRoadRefresh(this);
if(this.roadworks.lotWorldKey!==undefined&&this.roadworks.lotWorldKey!==lotGradingKey(this.world))return prepareRoadRefresh(this,{reason:'terrain'});
 return this.refresh();
}
refresh(force=false,prepared=null){if(!this.world)return;if(this.roadRefreshJob){this.roadRefreshJob.force ||= force;return;}const demographics=Buildings.entries(this.world).map(([id,t])=>[id,t.type,t.level,t.people,t.construction].join('/')).join(';');if(this.residents&&demographics!==this.residentDemographics){this.residents.reconcile();this.ensureCarCapacity();this.residentDemographics=demographics;}const roadChanges=changedRoadCells(this.world.tiles,this.frontageLayout);this.frontageLayout=roadChanges.keys;const parcels=visualParcels(this.world);const roadReplaced=this.roadEditRevision!==undefined&&this.roadEditRevision!==(this.world.roadEditRevision||0);this.roadEditRevision=this.world.roadEditRevision||0;let models=false,roads=roadReplaced||prepared?.roads===this.roadworks,trees=false,zones=false,occupancy=false,destinations=false;this.renderStates ||= [];
this.world.tiles.forEach((t,i)=>{const parcel=parcels.get(i),oldState=this.renderStates[i],isService=t.type&&t.type!=='road'&&!this.models.accepts(t)&&t.level>0;
const near=isService&&this.camera.position.distanceToSquared(new THREE.Vector3((i%G.n+.5)*4-G.half,0,(Math.floor(i/G.n)+.5)*4-G.half))<38*38;
const state={destination:!!(t.level>0&&!t.construction&&this.models.accepts(t)),road:t.type==='road'?[t.roadWidth,t.roadType,t.pathIds?.join(),t.ground].join(':'):'',trees:[t.type,t.zone,t.tree].join(':'),zone:[t.zone,t.type,t.construction].join(':'),occupied:!!t.construction||!!t.type&&t.type!=='road',visual:[parcel?.key,t.type,t.construction,t.level,t.density,t.building,t.variant,this.night,this.overlay,this.detailEnabled,near].join(':')};
destinations ||= oldState?.destination!==state.destination;roads ||= oldState?.road!==state.road;trees ||= oldState?.trees!==state.trees;zones ||= oldState?.zone!==state.zone;occupancy ||= oldState?.occupied!==state.occupied;
if(force||oldState?.visual!==state.visual||frontageTouches(roadChanges.changed,i,parcel)){const old=this.buildings.get(i);if(old){models=true;this.tileGroup.remove(old);this.disposeGroup(old);this.buildings.delete(i)}if(this.assetsReady!==false&&(!parcel||parcel.owner===i)&&(t.construction||t.type&&t.type!=='road'&&t.level>0)){models=true;const x=(i%G.n+.5)*4-G.half+(parcel?.facility?(parcel.width-1)*2:0),z=(Math.floor(i/G.n)+.5)*4-G.half+(parcel?.facility?(parcel.depth-1)*2:0),g=t.construction?this.architecture.construction(t,x,z,this.world):(this.models.accepts(t)?this.models.create(this.world,i,parcel):this.architecture.model(t,x,z,this.world));if(t.construction&&parcel?.oriented){const p=parcel.oriented;g.position.set(p.cx,floorHeight(this.world,p.cx,p.cz)+.08,p.cz);g.rotation.y=p.angle;g.scale.set(p.width/4,1,p.depth/4);}if(this.overlay==='zones'&&zoneColors[t.type])g.traverse(o=>{if(o.isMesh)o.material=this.mat(zoneColors[t.type])});if(!g.userData.factory)this.tileGroup.add(g);this.buildings.set(i,g)}}this.renderStates[i]=state;});
// Independent parcels retain stable identities even when they share terrain cells.
const fineRevision=this.world.development?.revision||0;if(this.fineRevision!==fineRevision){zones=true;this.fineRevision=fineRevision;}
this.fineRenderStates ||= new Map();const currentFine=new Set();let fineChanged=false;
for(const [id,p] of Object.entries(this.world.development?.parcels||{})){
 const t=p.occupant;if(!t)continue;currentFine.add(id);const parcel=Buildings.renderParcel(this.world,id),oldState=this.fineRenderStates.get(id);
 const state={grading:!!(t.level>0&&!t.construction),destination:!!(t.level>0&&!t.construction),geometry:parcel.key,visual:[parcel.key,t.type,t.construction,t.level,t.density,t.building,t.variant,this.night,this.overlay,this.detailEnabled].join(':')};
 destinations ||= oldState?.destination!==state.destination;occupancy ||= oldState?.grading!==state.grading;
 if(!oldState||oldState.geometry!==state.geometry){fineChanged=true;occupancy=true;zones=true;}
 // Saved frames already contain their frontage. Road access is rebuilt below.
 if(force||oldState?.visual!==state.visual){
  const old=this.buildings.get(id);if(old){this.tileGroup.remove(old);this.disposeGroup(old);this.buildings.delete(id);models=true;}
  if(this.assetsReady!==false&&(t.construction||t.level>0)){
   const f=p.frame,g=t.construction?this.architecture.construction(t,f.cx,f.cz,this.world):this.models.create(this.world,parcel.index,parcel);
   if(t.construction){g.position.set(f.cx,floorHeight(this.world,f.cx,f.cz)+.08,f.cz);g.rotation.y=f.angle;g.scale.set(f.width/4,1,f.depth/4);}
   if(this.overlay==='zones'&&zoneColors[t.type])g.traverse(o=>{if(o.isMesh)o.material=this.mat(zoneColors[t.type]);});
   if(!g.userData.factory)this.tileGroup.add(g);this.buildings.set(id,g);models=true;
  }
 }
 this.fineRenderStates.set(id,state);
}
for(const id of this.fineRenderStates.keys())if(!currentFine.has(id)){
 const old=this.buildings.get(id);if(old){this.tileGroup.remove(old);this.disposeGroup(old);this.buildings.delete(id);models=true;}
 this.fineRenderStates.delete(id);fineChanged=true;occupancy=true;destinations=true;zones=true;
}
if(fineChanged)trees=true;
if(roads&&prepared?.roads!==this.roadworks)this.roadworks.build(this.world);
// Growth can finish while road geometry is prepared in the background. Do not
// install a terrain cut made for an earlier set of occupied sites.
if(prepared?.lotGradingKey!==undefined&&prepared.lotGradingKey!==lotGradingKey(this.world)){
 this.roadworks.syncEarthworks(this.world);
 for(const {result}of prepared.terrain||[]){result.replacement?.dispose();result.walls?.dispose();}
 prepared.cover?.userData.dispose?.();prepared.grid?.dispose();prepared={...prepared,terrain:null,cover:null,grid:null};this.landscape.preparedTreePlan=null;
}
let earthworksChanged=false;if(roads||occupancy||force){if(!roads)this.roadworks.syncEarthworks?.(this.world);earthworksChanged=this.landscape.applyRoadEarthworks?.(this.world,this.roadworks.earthworks,{prepared:prepared?.terrain,preparedCover:prepared?.cover})||false;}
if(fitGradedLots(this))models=true;
if(models||force)this.models.rebuild(this.buildings);
if(earthworksChanged||this.gridPending||prepared?.grid){this.makeGrid(prepared?.grid);this.gridPending=false;}
if(fineChanged&&!earthworksChanged)this.landscape.refreshDevelopment(this.world);
this.landscape.ensureDevelopment?.(this.world);
if((models||roads||occupancy||force||earthworksChanged)&&!prepared?.accessMatches?.(this.buildings))this.roadworks.buildAccess(this.world,this.buildings);
const paths=this.walkRevision!==(this.world.walkRevision||0);this.walkRevision=this.world.walkRevision||0;if(paths||roads||earthworksChanged||force)this.drawFootpaths();
if(roads||occupancy||destinations)this.setupCars();else if(paths)this.transit?.rebuild();
if((trees||roadReplaced)&&!force&&!fineChanged&&!earthworksChanged)this.landscape.refreshTrees(this.world);else if((paths||roads)&&!force&&!fineChanged&&!earthworksChanged)this.landscape.refreshCover?.(this.world);
if(occupancy||roads||earthworksChanged||force)this.streetLife.build(this.world);
if(models||roads||trees||force)this.renderer.shadowMap.needsUpdate=true;
if(this.overlay!=='none'&&(models||roads||zones||earthworksChanged||force))this.updateOverlay();
if(zones||roads||earthworksChanged||force)this.updateZones();if(this.roadZoningTarget&&(zones||roads||earthworksChanged))this.showRoadZoning(this.roadZoningTarget);}

drawFootpaths(){if(!this.pathGroup){if(!(this.world.walkPaths?.length))return;this.pathGroup=new THREE.Group();this.scene.add(this.pathGroup);}this.disposeGroup(this.pathGroup);buildFootpaths(this.world,this.pathGroup,(w,x,z)=>this.renderFloor(w,x,z));}
renderFloor(w,x,z){return Math.max(.2,this.landscape?.renderHeight?.(w,x,z)??groundHeight(w,x,z));}
terrainChanged(bounds,finish=false){this.landscape.refreshTerrain(this.world,bounds,false);this.renderer.shadowMap.needsUpdate=true;if(finish){this.roadworks.build(this.world);this.landscape.applyRoadEarthworks?.(this.world,this.roadworks.earthworks);if(fitGradedLots(this))this.models.rebuild(this.buildings);this.roadworks.buildAccess(this.world,this.buildings);if(this.traffic)this.roadworks.syncSignals(this.traffic);this.makeGrid();this.updateZones();this.drawFootpaths();this.streetLife.build(this.world);updateLandBoundary(this);if(this.overlay!=='none')this.updateOverlay();}for(const car of this.cars)car.heightWorld=null;}
showRoundabout(q){this.clearLine();if(!q.shape)return;const s=q.shape;for(const radius of [s.outer,s.island||.75]){const points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,x=s.x+Math.cos(a)*radius,z=s.z+Math.sin(a)*radius;points.push(new THREE.Vector3(x,this.roadworks.height(this.world,x,z)+.25,z));}this.previewGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:q.ok?'#7edcea':'#eea370',depthTest:false,transparent:true,opacity:.95})));}}
showTerrainBrush(x,z,radius){this.clearLine();const points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;points.push(new THREE.Vector3(px,Math.max(.05,this.landscape?.renderHeight?.(this.world,px,pz)??groundHeight(this.world,px,pz))+.2,pz));}const geometry=new THREE.BufferGeometry().setFromPoints(points);this.previewGroup.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#7edcea',depthTest:false,transparent:true,opacity:.9})));}
setZoning(on){this.zoning=on;this.updateZones()}
zonePlane(x,y,color,opacity=.3,frame=null){const geo=new THREE.PlaneGeometry((frame?.width||4)-.18,(frame?.depth||4)-.18,2,2);geo.rotateX(-Math.PI/2);const a=geo.attributes.position;for(let j=0;j<a.count;j++){const c=Math.cos(frame?.angle||0),s=Math.sin(frame?.angle||0),xx=(frame?.cx??((x+.5)*4-G.half))+a.getX(j)*c+a.getZ(j)*s,zz=(frame?.cz??((y+.5)*4-G.half))-a.getX(j)*s+a.getZ(j)*c;a.setXYZ(j,xx,this.renderFloor(this.world,xx,zz)+.12,zz)}geo.computeVertexNormals();return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}))}
updateZones(){
 this.zoneGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});this.zoneGroup.clear();if(!this.world||this.menu||!this.zoning&&this.overlay!=='zones')return;
 const showLots=this.zoning||this.overlay==='zones',layout=CityEngine.zoningLayout(this.world),batch=new ZonePlaneBatch(this.world,(w,x,z)=>this.renderFloor(w,x,z));
 this.world.tiles.forEach((t,i)=>{const z=CityEngine.ZONES[t.zone];if(!z||t.type==='road'||t.ground==='water')return;
  if(t.zoneOwner!==undefined){if(t.zoneOwner===i&&showLots&&t.zoneSite)batch.add(0,0,z.color,.32,t.zoneSite.oriented);return;}
  if((t.type||layout.has(i))&&(!t.type||showLots))batch.add(i%G.n,Math.floor(i/G.n),z.color,this.zoning?.44:.28,layout.get(i));
 });
 const fine=CityEngine.fineZoningLayout(this.world);
 for(const [id,p]of fine){const cell=this.world.development?.cells[id],zone=CityEngine.ZONES[cell?.zone];if(cell?.owner)continue;
  if(zone)batch.add(0,0,zone.color,this.zoning?.44:.28,p);else if(this.zoning)batch.add(0,0,'#b1d3d7',.12,p);
 }
 // A developed building is one lot, not a checkerboard of tiny houses.
 // Use saved parcel geometry even if its original road has been removed.
 if(showLots)for(const p of Object.values(this.world.development?.parcels||{})){const zone=CityEngine.ZONES[p.zone];if(zone)batch.add(0,0,zone.color,.32,p.frame);}
 batch.finish(this.zoneGroup);
 this.zoneLotOutlines([...CityEngine.fineZonePlan(this.world),...Object.values(this.world.development?.parcels||{})].map(p=>p.frame));
}
zoneLotOutlines(frames,group=this.zoneGroup){
 if(!frames.length)return;
 const positions=[];
 for(const f of frames){
  const c=Math.cos(f.angle),s=Math.sin(f.angle),points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:f.cx+x*f.width/2*c+z*f.depth/2*s,z:f.cz-x*f.width/2*s+z*f.depth/2*c}));
  for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/1.6));for(let n=0;n<steps;n++)for(const t of [n/steps,(n+1)/steps]){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;positions.push(x,this.renderFloor(this.world,x,z)+.19,z);}}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 // One terrain-following line batch for every lot, independent of cell count.
 const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#e3efcd',transparent:true,opacity:.8,depthWrite:false}));lines.userData.zoningLots=frames.length;group.add(lines);
}
previewZones(cells,zone,proposal){this.clearLine();const unbuildable=new Set(proposal?.unbuildable||[]);const layout=CityEngine.fineZoningLayout(this.world),batch=new ZonePlaneBatch(this.world,(w,x,z)=>this.renderFloor(w,x,z));for(const id of cells){if(typeof id==='object'){const i=id.y*G.n+id.x,t=this.world.tiles[i],p=CityEngine.zoningLayout(this.world).get(i);if(t?.zone&&p)batch.add(id.x,id.y,CityEngine.ZONES[zone]?.color||'#f2d9b5',.65,p);continue;}const p=layout.get(id);if(!p)continue;const cell=this.world.development?.cells[id],parcel=this.world.development?.parcels[cell?.owner],allowed=!parcel?.occupant||!!parcel.occupant.construction;batch.add(0,0,allowed?(unbuildable.has(id)?'#e8b862':CityEngine.ZONES[zone]?.color||'#f2d9b5'):'#d76350',.65,p);}batch.finish(this.previewGroup);if(proposal)this.zoneLotOutlines(proposal.lots.map(p=>p.frame),this.previewGroup);}
batchZonePlanes(group){const batches=new Map();for(const mesh of [...group.children]){const key=mesh.material.color.getHex()+':'+mesh.material.opacity;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(mesh);}group.clear();for(const meshes of batches.values()){const geometry=mergeGeometries(meshes.map(m=>m.geometry),false),material=meshes[0].material;for(const mesh of meshes){mesh.geometry.dispose();if(mesh.material!==material)mesh.material.dispose();}group.add(new THREE.Mesh(geometry,material));}}
updateOverlay(){const ground=this.landscape.ground;if(!ground)return;
if(this.overlay==='none'){
 if(this.landscape.restoreGroundColors)this.landscape.restoreGroundColors();
 else{const {position,color}=ground.geometry.attributes,base=this.landscape.baseColors;if(base?.length===color.array.length)color.array.set(base);else for(let i=0;i<position.count;i++){const c=terrainColor(this.world,position.getX(i),position.getZ(i));color.setXYZ(i,c.r,c.g,c.b);}color.needsUpdate=true;}
 ground.material.color.set('#ffffff');return;
}
const w=this.world,stats=CityEngine.analyze(w),colorAt=(x,z)=>{const tx=Math.max(0,Math.min(G.last,Math.floor((x+G.half)/4))),ty=Math.max(0,Math.min(G.last,Math.floor((z+G.half)/4))),t=w.tiles[ty*G.n+tx];if(this.overlay==='none')return terrainColor(w,x,z);const c=new THREE.Color('#bcbfc1');if(this.overlay==='zones'&&(t.zone||zoneColors[t.type]))c.set(CityEngine.ZONES[t.zone]?.color||zoneColors[t.type]);if(this.overlay==='traffic'&&t.type==='road')c.set(stats.traffic>65?'#df7358':'#79bf85');if(this.overlay==='utilities'&&t.type)c.set(['power','water'].includes(t.type)?'#49c1ed':'#98afbc');if(this.overlay==='pollution'&&t.type==='industrial')c.set('#d2ac63');return c;};if(this.landscape.applyGroundOverlay)this.landscape.applyGroundOverlay(colorAt);else{const colors=ground.geometry.attributes.color,pos=ground.geometry.attributes.position;for(let i=0;i<pos.count;i++){const c=colorAt(pos.getX(i),pos.getZ(i));colors.setXYZ(i,c.r,c.g,c.b);}colors.needsUpdate=true;}ground.material.color.set(this.overlay==='none'?'#ffffff':'#dce0df')}
ensureCarCapacity(){if(!this.traffic)return;const target=this.menu?32:carCapacity(this.world);let count=this.cars.filter(c=>c.agent.kind!=='bus').length,changed=false;while(count<target){const mesh=this.carModel(this.cars.length),agent=this.traffic.addAgent();mesh.scale.setScalar(0);this.cars.push({mesh,agent});count++;changed=true;}if(changed)this.vehicles.rebuildFleet(this.cars,this.carGroup);}
setupCars(){if(!this.traffic)this.traffic=new Traffic(this.world,CityEngine);else this.traffic.rebuild(this.world);this.roadworks.syncSignals(this.traffic);this.ensureCarCapacity();for(const car of this.cars)this.moveCar(car);if(!this.menu){if(!this.transit)this.transit=new Transit(this.world,this.traffic);else this.transit.rebuild();let fleetChanged=false;for(const entry of this.transit.entries.values())if(!this.cars.some(c=>c.agent===entry.agent)){this.cars.push({mesh:this.vehicles.createBus(),agent:entry.agent});fleetChanged=true;}if(fleetChanged)this.vehicles.rebuildFleet(this.cars,this.carGroup);this.drawTransitStops();this.traffic.residentsEnabled=true;if(!this.residents)this.residents=new Residents(this.world,this.traffic,this.transit);else this.residents.reconcile();}for(const car of this.cars)this.moveCar(car);this.vehicles.updateFleet(this.cars,this.camera);}
drawTransitStops(){const lines=this.world.transit?.lines||[],key=lines.map(l=>l.id+':'+l.stops.join(',')).join(';');if(this.roadworks.crossingKey!==key){this.roadworks.build(this.world);const groundChanged=this.landscape.applyRoadEarthworks?.(this.world,this.roadworks.earthworks);this.roadworks.buildAccess(this.world,this.buildings);this.roadworks.syncSignals(this.traffic);if(groundChanged){this.makeGrid();this.drawFootpaths();this.updateZones();if(this.roadZoningTarget)this.showRoadZoning(this.roadZoningTarget);if(this.overlay!=='none')this.updateOverlay();this.streetLife.build(this.world);}this.renderer.shadowMap.needsUpdate=true;}if(key===this.transitKey&&this.transitGraph===this.traffic.graph)return;this.transitGraph=this.traffic.graph;this.transitKey=key;if(!this.transitGroup){this.transitGroup=new THREE.Group();this.scene.add(this.transitGroup);}this.disposeGroup(this.transitGroup);
 for(const line of lines)for(const [index,stop]of line.stops.entries()){const entry=this.transit?.entries?.get(line.id),p=entry?.stopPositions?.[index]||stopPosition(this.traffic,stop),pin=entry?.plan?.attachments?.[index]?.point,center=pin?{x:(pin.x+.5)*4-G.half,z:(pin.y+.5)*4-G.half}:this.traffic.positions.get(stop)||{x:(stop%G.n+.5)*4-G.half,z:(Math.floor(stop/G.n)+.5)*4-G.half},length=Math.hypot(p.x-center.x,p.z-center.z)||1,x=p.x+(p.x-center.x)/length*.55,z=p.z+(p.z-center.z)/length*.55,y=this.roadworks.surfaceHeight?.(x,z)??this.roadworks.height(this.world,x,z)+SIDEWALK_HEIGHT;this.box(this.transitGroup,x,y+.7,z,.045,1.4,.045,'#bdc8c5');this.box(this.transitGroup,x,y+1.25,z,.32,.32,.07,'#4bacd2');this.box(this.transitGroup,x,y-.0175+.001,z,.65,.035,.5,'#dfc994');}
 this.renderer.shadowMap.needsUpdate=true;
}
previewBusLine(stops){this.clearLine();for(const stop of stops){const x=(stop%G.n+.5)*4-G.half,z=(Math.floor(stop/G.n)+.5)*4-G.half,ring=new THREE.Mesh(new THREE.RingGeometry(.5,.7,24),new THREE.MeshBasicMaterial({color:'#63d9f1',side:THREE.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,this.roadworks.height(this.world,x,z)+.25,z);this.previewGroup.add(ring);const catchment=[];for(let k=0;k<=64;k++){const a=k/64*Math.PI*2,xx=x+Math.cos(a)*16,zz=z+Math.sin(a)*16;catchment.push(new THREE.Vector3(xx,this.renderFloor(this.world,xx,zz)+.16,zz));}this.previewGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(catchment),new THREE.LineBasicMaterial({color:'#63d9f1',transparent:true,opacity:.55})));}for(let i=1;i<stops.length;i++){const route=transitLeg(this.traffic,stops[i-1],stops[i]);if(route){const points=route.points.map(p=>new THREE.Vector3(p.x,this.roadworks.height(this.world,p.x,p.z)+.3,p.z)),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#63d9f1',depthTest:false}));this.previewGroup.add(line);}}}
carModel(i){return this.vehicles.create(i)}
moveCar(car){const a=car.agent;if(!a?.active){car.mesh.scale.setScalar(0);return}car.mesh.scale.setScalar(1);const alpha=this.running?(this.simulationClock?.interpolation??1):1,x=Number.isFinite(a.previousX)?a.previousX+(a.x-a.previousX)*alpha:a.x,z=Number.isFinite(a.previousZ)?a.previousZ+(a.z-a.previousZ)*alpha:a.z;if(car.heightWorld!==this.world||car.heightX!==x||car.heightZ!==z||car.heightRevision!==this.roadworks.heightRevision){car.heightRevision=this.roadworks.heightRevision;car.roadHeight=this.roadworks.drivingHeight(this.world,x,z);car.heightWorld=this.world;car.heightX=x;car.heightZ=z;}car.mesh.position.set(x,car.roadHeight,z);car.mesh.rotation.y=a.heading;}
focusOutside(){const p=this.traffic?.portals[0];if(!p)return;this.controls.target.set(p.x,1,p.z);this.camera.position.set(p.x+18,22,p.z+25);this.controls.update();}

setOverlay(v){if(this.overlay===v)return;this.overlay=v;this.refresh(true);if(v==='none')this.updateOverlay()}
setNight(v){if(this.night===v)return;this.night=v;this.models.library?.setNight(v);this.scene.background=v?new THREE.Color('#162739'):(this.skyTexture||new THREE.Color('#aebfca'));this.scene.environmentIntensity=v?.12:.38;this.scene.fog.color.set(v?'#283d50':'#b7c6cc');this.sun.intensity=v?.18:3.0;this.ambient.intensity=v?.4:.55;this.renderer.toneMappingExposure=v?.75:.87;this.refresh(true);this.roadworks.night(v)}
getRoadPoint(x,y){if(!this.getTile(x,y))return null;return {x:Math.max(0,Math.min(G.last,(this.point.x+G.half)/4-.5)),y:Math.max(0,Math.min(G.last,(this.point.z+G.half)/4-.5))};}
clearRoadZoning(){
 if(this.roadZoningGroup){for(const o of this.roadZoningGroup.children){o.geometry.dispose();o.material.dispose();}this.roadZoningGroup.clear();}
 this.roadZoningTarget=null;
}
showRoadZoning(target){
 this.clearRoadZoning();if(!target||!this.world||this.menu)return;
 this.roadZoningTarget=target;if(!this.roadZoningGroup){this.roadZoningGroup=new THREE.Group();this.scene.add(this.roadZoningGroup);}
 const group=this.roadZoningGroup,batch=new ZonePlaneBatch(this.world,(w,x,z)=>this.renderFloor(w,x,z)),tiles=new Set(target.tiles);
 for(const [id,p]of CityEngine.fineZoningLayout(this.world))if(!this.world.development?.cells[id]?.owner&&(target.kind==='path'?p.source===target.source:p.source.startsWith('legacy-')&&tiles.has(p.roadIndex)))batch.add(0,0,'#76d7c0',.36,p);
 batch.finish(group);
 const points=CityEngine.sampleRoad(target.controls).map(p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half}));
 const vector=p=>new THREE.Vector3(p.x,this.roadworks.height(this.world,p.x,p.z)+.38,p.z),positions=[];
 for(let i=1;i<points.length;i++)positions.push(vector(points[i-1]),vector(points[i]));
 const mid=Math.floor(points.length/2),tip=points[mid],before=points[Math.max(0,mid-2)],dx=tip.x-before.x,dz=tip.z-before.z,length=Math.hypot(dx,dz)||1,tx=dx/length,tz=dz/length;
 for(const side of [-1,1])positions.push(vector({x:tip.x-tx*2-tz*.9*side,z:tip.z-tz*2+tx*.9*side}),vector(tip));
 const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(positions),new THREE.LineBasicMaterial({color:'#67d8ff',depthTest:false,transparent:true,opacity:.95}));line.renderOrder=3;group.add(line);
}
showRoadReplacement(plan){
 this.clearLine();this.clearRoadZoning();if(!plan.target)return;
 this.showRoadZoning(plan.target);this.roadZoningTarget=null;const group=this.roadZoningGroup;
 for(const child of [...group.children])if(child.isMesh){group.remove(child);child.geometry.dispose();child.material.dispose();}
 const spec=CityEngine.ROADS[plan.type],points=plan.points.map(p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half})),material=new THREE.MeshBasicMaterial({color:plan.conflicts.length?'#e8b862':'#71d2ec',transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false});
 const mesh=this.roadworks.ribbon(this.world,points,spec.width+(spec.sidewalk?.8:0),0,material,.3);this.roadworks.group.remove(mesh);group.add(mesh);
 const batch=new ZonePlaneBatch(this.world,(w,x,z)=>this.renderFloor(w,x,z));for(const conflict of plan.conflicts)batch.add(0,0,'#ef755c',.55,conflict.frame);batch.finish(group);
}
showParallelRoadPreview(plan,type,valid,details={}){this.clearLine();this.roadGuidePreview ||= new RoadGuidePreview(this);this.roadGuidePreview.showParallel(plan,type,valid,details);}
showRoadGridPreview(plan,type,valid,details={}){this.clearLine();this.roadGuidePreview ||= new RoadGuidePreview(this);this.roadGuidePreview.showGrid(plan,type,valid,details);}
showRoadPreview(controls,type,valid,details={}){this.clearLine();this.roadGuidePreview ||= new RoadGuidePreview(this);this.roadGuidePreview.update(controls,type,valid,details);}
getZoneTile(x,y){if(!this.getTile(x,y))return null;const p=BoroughZoning.hit(CityEngine.fineZoningLayout(this.world),this.point.x,this.point.z);if(p)return {id:p.id,x:p.index%G.n,y:Math.floor(p.index/G.n)};const old=BoroughZoning.hit(CityEngine.zoningLayout(this.world),this.point.x,this.point.z);return old&&this.world.tiles[old.index].zone?{legacy:true,x:old.index%G.n,y:Math.floor(old.index/G.n)}:null}
getZoneDragTile(x,y,start){
 if(!this.getTile(x,y))return null;
 const closest=CityEngine.fineZoneDragPoint(this.world,start,this.point.x,this.point.z);
 return closest?{id:closest.id,x:closest.index%G.n,y:Math.floor(closest.index/G.n)}:null;
}

getBuildingTile(x,y){const tile=this.getTile(x,y);if(!tile)return null;const parcel=Buildings.at(this.world,this.point.x,this.point.z)[0];return parcel?{...tile,entityId:parcel.id}:tile}
getTile(clientX,clientY){const r=this.canvas.getBoundingClientRect();this.ndc.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);const targets=[...(this.landscape.renderGroundTargets?.()||[this.landscape.ground]),...(this.roadworks.earthworkSurfaces||[]),...(this.roadworks.earthworkStructures||[]),this.roadworks.lotPickSurface,this.landscape.water].filter(Boolean),hit=this.ray.intersectObjects(targets,false)[0];if(hit)this.point.copy(hit.point);else if(!this.ray.ray.intersectPlane(this.plane,this.point))return null;const x=Math.floor((this.point.x+G.half)/4),y=Math.floor((this.point.z+G.half)/4);return x>=0&&y>=0&&x<G.n&&y<G.n?{x,y}:null}
showFacilityPreview(q,remove=false){
 const key=[remove,q.ok,q.owner,q.site?.width,q.site?.depth,q.site?.rotation,this.world.elevationRevision].join('/');
 this.cursor.visible=false;if(this.facilityPreviewKey===key)return;this.clearLine();this.facilityPreviewKey=key;
 if(!q.cells?.length)return;
 const color=remove?'#ff7959':q.ok?'#71d2ec':'#f08065';
 for(const i of q.cells)this.previewGroup.add(this.zonePlane(i%G.n,Math.floor(i/G.n),color,.48));
 if(remove)return;
 const x=(q.owner%G.n+q.site.width/2)*4-G.half,z=(Math.floor(q.owner/G.n)+q.site.depth/2)*4-G.half,a=q.site.rotation*Math.PI/2;
 const along=q.site.rotation%2?q.site.width:q.site.depth,d=along*2;
 const points=[[0,0],[0,d],[.65,d-.9],[0,d],[-.65,d-.9]].map(([u,v])=>{const px=x+u*Math.cos(a)+v*Math.sin(a),pz=z-u*Math.sin(a)+v*Math.cos(a);return new THREE.Vector3(px,this.renderFloor(this.world,px,pz)+.4,pz)});
 this.previewGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false})));
}
hover(tile,remove=false){if(tile?.entityId){this.clearLine();this.cursor.visible=false;const p=Buildings.parcel(this.world,tile.entityId);if(p)this.previewGroup.add(this.zonePlane(0,0,remove?'#ff7959':'#62cbff',.3,p.frame));this.facilityPreviewKey='fine/'+tile.entityId;return;}if(tile?.id&&this.zoning){this.clearLine();this.cursor.visible=false;const p=CityEngine.fineZoningLayout(this.world).get(tile.id);if(p)this.previewGroup.add(this.zonePlane(0,0,'#62cbff',.4,p));this.facilityPreviewKey='fine-cell/'+tile.id;return;}if(remove&&tile){const i=tile.y*G.n+tile.x,owner=CityEngine.facilityOwner(this.world,i),site=this.world.tiles[owner].facilitySite,lot=this.world.tiles[owner].zoneSite;if(lot){this.clearLine();this.cursor.visible=false;this.previewGroup.add(this.zonePlane(0,0,'#ff7959',.48,lot.oriented));this.facilityPreviewKey='lot/'+owner;return;}if(site){this.showFacilityPreview({ok:true,owner,site,cells:CityEngine.facilityCells(this.world,i)},true);return;}}if(this.facilityPreviewKey)this.clearLine();this.cursor.visible=!!tile;if(tile){const frame=this.zoning?CityEngine.zoningLayout(this.world).get(tile.y*G.n+tile.x):null;let x=frame?.cx??((tile.x+.5)*4-G.half),z=frame?.cz??((tile.y+.5)*4-G.half);this.cursor.rotation.z=frame?.angle||0;this.cursor.material.color.set(remove?'#ff7959':'#62cbff');this.cursor.position.set(x,this.renderFloor(this.world,x,z)+.3,z)}}
showLine(a,b){this.clearLine();if(!a||!b)return;for(let t of CityEngine.lineTiles(a,b)){let p=new THREE.Mesh(new THREE.PlaneGeometry(3.65,3.65),new THREE.MeshBasicMaterial({color:'#65cfff',transparent:true,opacity:.5,side:THREE.DoubleSide}));p.rotation.x=-Math.PI/2;let x=(t.x+.5)*4-G.half,z=(t.y+.5)*4-G.half;p.position.set(x,this.roadworks.height(this.world,x,z)+.25,z);this.previewGroup.add(p)}}
clearLine(){this.roadGuidePreview?.clear();this.facilityPreviewKey=null;this.previewGroup.children.forEach(o=>{o.geometry.dispose();o.material.dispose()});this.previewGroup.clear()}
setBuild(v){this.grid.visible=v&&!this.zoning;this.controls.touches.ONE=v?null:THREE.TOUCH.ROTATE}
pan(dx,dz){this.controls.target.x+=dx;this.controls.target.z+=dz;this.camera.position.x+=dx;this.camera.position.z+=dz}
center(){this.focusWorld(false)}
zoom(f){this.camera.position.sub(this.controls.target).multiplyScalar(f).add(this.controls.target)}
resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight,false);this.graphics?.resize()}
}


CityView=G.bindClass(CityView);
