import {groundHeight} from './landscape.js?v=155';
import './map-grid.js?v=155';
const G=globalThis.BoroughGrid;

export function createLandPanel({document,engine,world,save,changed,toast}){
 const $=id=>document.getElementById(id),L=engine.Land,dialog=$('landDialog');let selected=null;
 const name=(w,id)=>String.fromCharCode(65+id%L.columns(w))+(Math.floor(id/L.columns(w))+1);
 function render(){
  const w=world();if(!w)return;const n=G.size(w),cols=L.columns(w),owned=w.land?.owned||Array.from({length:cols*cols},(_,i)=>i),merits=w.land?.merits||0;
  $('landMerits').textContent=merits+' merits';$('landOwned').textContent=owned.length+' / '+cols*cols+' districts owned';
  const next=engine.Progression.status(w,engine.analyze(w).population).next;
  $('landEarn').textContent=!w.land?'This saved city keeps all of its original land. Choose Large when starting a new city for more space.':!engine.Progression.active(w)?'Sandbox: all districts are already available.':next?'Reach '+next.population.toLocaleString()+' residents to earn '+L.REWARDS[w.progression.level+1]+' merits.':'All milestone merits earned. Spend your remaining merits to expand.';
  const grid=$('landDistricts');grid.replaceChildren();grid.style.gridTemplateColumns='repeat('+cols+',1fr)';
  if(selected===null||selected>=cols*cols)selected=Array.from({length:cols*cols},(_,i)=>i).find(i=>!owned.includes(i)&&L.adjacent(w,i))??L.start(w);
  for(let id=0;id<cols*cols;id++){
   const has=owned.includes(id),adjacent=w.land&&!has&&L.adjacent(w,id),button=document.createElement('button');button.type='button';button.className='land-district'+(has?' owned':adjacent?' adjacent':'')+(id===selected?' selected':'');button.setAttribute('aria-label','District '+name(w,id)+' · '+(has?'Owned':adjacent?'2 merits':'Buy adjacent land first'));button.setAttribute('aria-pressed',String(id===selected));
   const title=document.createElement('strong'),status=document.createElement('span');title.textContent=name(w,id);status.textContent=has?'Owned':adjacent?'2 merits':'Locked';button.append(title,status);button.onclick=()=>{selected=id;render();};grid.append(button);
  }
  $('landSelected').textContent='District '+name(w,selected);const q=L.quote(w,selected);
  $('landReason').textContent=owned.includes(selected)?'You can build here. Each district is 480 × 480 m.':q.ok?'Adds 480 × 480 m of land. Roads and services still need to be connected.':q.reason;
  $('buyLand').disabled=!q.ok;$('buyLand').textContent='Buy district · '+L.COST+' merits';
  const canvas=$('landMap'),ctx=canvas.getContext('2d'),resolution=144,h=n*2;
  // A modest static overview is drawn only when opening or changing selection.
  const key=w.id+':'+(w.elevationRevision||0);
  if(canvas.dataset.terrainKey!==key){canvas.width=canvas.height=resolution;const image=ctx.createImageData(resolution,resolution);
   for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){const xx=(x+.5)/resolution*h*2-h,zz=(z+.5)/resolution*h*2-h,height=groundHeight(w,xx,zz),shade=Math.max(.6,Math.min(1.2,1+(height-groundHeight(w,xx+1,zz+1))*.2)),color=height<.18?[42,94,116]:height>12?[126,133,109]:[105,134,91],i=(z*resolution+x)*4;for(let k=0;k<3;k++)image.data[i+k]=color[k]*shade;image.data[i+3]=255;}
   ctx.putImageData(image,0,0);ctx.fillStyle='#bcc5bf';for(let i=0;i<w.tiles.length;i++)if(w.tiles[i].type==='road')ctx.fillRect(i%n/n*resolution,Math.floor(i/n)/n*resolution,resolution/n,resolution/n);canvas.dataset.terrainKey=key;
  }
 }
 $('buyLand').onclick=()=>{const w=world(),before=structuredClone(w.land),result=L.buy(w,selected);if(!result.ok){toast(result.reason);return;}if(!save()){w.land=before;render();return;}changed();render();toast('District '+name(w,selected)+' purchased. You can build there now.');};
 return {open(){selected=null;delete $('landMap').dataset.terrainKey;render();dialog.showModal();},render};
}
