import {LandSelection} from './land-selection.js?v=159';

export function createLandPanel({document,engine,world,view,save,changed,toast}){
 const $=id=>document.getElementById(id),L=engine.Land,panel=$('landPanel'),controls=$('landTileControls'),selection=new LandSelection(view),selected=new Set();let hover=null,press=null,buttons=[];
 const name=(w,id)=>String.fromCharCode(65+id%L.columns(w))+(Math.floor(id/L.columns(w))+1);
 function positionButtons(){if(!selection.active)return;for(const [id,b] of buttons.entries()){const p=selection.screen(id);b.style.left=p.x+'px';b.style.top=p.y+'px';b.hidden=!p.visible;}}
 function render(population){
  if(!selection.active)return;const w=world();if(w!==selection.world){close();return;}
  const owned=w.land?.owned||selection.cells.map(c=>c.id),balance=w.land?.merits||0,q=L.quoteMany(w,[...selected]);
  $('landMerits').textContent=balance+' merits';$('landOwned').textContent=owned.length+' / '+L.columns(w)**2;
  $('landSelected').textContent=selected.size+' selected';$('landArea').textContent=selected.size?selection.cells.filter(c=>selected.has(c.id)).reduce((n,c)=>n+c.buildable,0).toFixed(3)+' km²':'—';
  $('landCost').textContent=selected.size*L.COST+' merits';$('buyLand').disabled=!q.ok;
  const next=engine.Progression.status(w,population??engine.analyze(w).population).next;
  $('landReason').textContent=!w.land?'This city owns all its original land.':!engine.Progression.active(w)?'Sandbox: every tile is already owned.':selected.size?(q.ok?'Road access is needed before development.':q.reason):'Select tiles on the landscape. Right-click to deselect.';
  $('landEarn').textContent=w.land&&engine.Progression.active(w)&&next?'Next: '+next.population.toLocaleString()+' residents · +'+L.REWARDS[w.progression.level+1]+' merits':'';
  $('landMerits').title=$('landEarn').textContent;if(selected.size&&!q.ok&&next&&balance<selected.size*L.COST)$('landReason').textContent=$('landEarn').textContent;
  for(const [id,b] of buttons.entries()){const has=owned.includes(id);b.setAttribute('aria-label','Land tile '+name(w,id)+(has?' · Owned':' · 2 merits'));b.setAttribute('aria-pressed',String(selected.has(id)));b.classList.toggle('owned',has);}
  selection.update(selected,hover);positionButtons();
 }
 function toggle(id,remove=false){if(id===null)return;const w=world();if(!w.land||w.land.owned.includes(id)){if(!remove)toast('Land tile '+name(w,id)+' is already owned.');return;}if(remove||selected.has(id))selected.delete(id);else selected.add(id);render();}
 function close(){if(!selection.active)return;selection.close();selected.clear();hover=null;press=null;panel.hidden=true;controls.hidden=true;controls.replaceChildren();buttons=[];document.body.classList.remove('land-mode');$('landButton').setAttribute('aria-pressed','false');}
 function open(){
  if(selection.active){close();return;}selection.open();selected.clear();hover=null;press=null;buttons=[];controls.replaceChildren();
  for(const cell of selection.cells){const b=document.createElement('button');b.type='button';b.className='land-tile-control';b.textContent=name(world(),cell.id);b.onclick=()=>toggle(cell.id);b.onfocus=()=>{hover=cell.id;selection.update(selected,hover);};b.onblur=()=>{hover=null;selection.update(selected);};b.onkeydown=e=>{const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-selection.cols,ArrowDown:selection.cols}[e.key];if(step){e.preventDefault();const next=cell.id+step;if(next>=0&&next<buttons.length)buttons[next].focus({preventScroll:true});}};buttons.push(b);controls.append(b);}
  panel.hidden=false;controls.hidden=false;document.body.classList.add('land-mode');$('landButton').setAttribute('aria-pressed','true');render();$('closeLand').focus({preventScroll:true});
 }
 $('closeLand').onclick=()=>{close();$('landButton').focus({preventScroll:true});};
 $('buyLand').onclick=()=>{const w=world(),ids=[...selected],before=structuredClone(w.land),result=L.buyMany(w,ids);if(!result.ok){toast(result.reason);return;}if(!save()){w.land=before;render();return;}selected.clear();changed();render();toast(ids.length+' land '+(ids.length===1?'tile':'tiles')+' purchased and saved.');};
 view.canvas.addEventListener('pointerdown',e=>{if(!selection.active||![0,2].includes(e.button))return;press={x:e.clientX,y:e.clientY,id:e.pointerId,button:e.button};},true);
 view.canvas.addEventListener('pointermove',e=>{if(!selection.active||e.buttons)return;const id=selection.pick(e.clientX,e.clientY);if(id!==hover){hover=id;selection.update(selected,hover);}},true);
 view.canvas.addEventListener('pointerup',e=>{if(!selection.active||!press||press.id!==e.pointerId)return;const p=press;press=null;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<5)toggle(selection.pick(e.clientX,e.clientY),p.button===2);},true);
 view.canvas.addEventListener('pointercancel',()=>{press=null;},true);
 view.canvas.addEventListener('pointerleave',()=>{press=null;if(selection.active){hover=null;selection.update(selected);}},true);
 view.controls.addEventListener('change',positionButtons);document.defaultView.addEventListener('resize',()=>{if(selection.active){selection.focus();positionButtons();}});
 // Changing tools restores the normal city camera before that tool opens.
 document.addEventListener('click',e=>{if(!selection.active)return;const button=e.target.closest('button');if(!button||button.closest('#landPanel,#landTileControls')||['landButton','zoomIn','zoomOut','save','pause','speed1','speed2','speed4'].includes(button.id))return;close();},true);
 return {open,close,render,get active(){return selection.active;}};
}
