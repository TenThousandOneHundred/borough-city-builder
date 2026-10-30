// Compact zoning UI. Painting, parcels and progression remain owned by app/engine.
export function createZoneShelf(panel, options){
 const families=document.getElementById('zoneFamilies');
 panel.querySelector('.panel-title').insertBefore(families,document.getElementById('closeBuild'));
 const familyIcons={residential:'residential_low',commercial:'commercial_low',industrial:'industrial',office:'office'};
 for(const b of families.children){
  const name=b.textContent;b.title=name;b.setAttribute('aria-label',name);
  b.innerHTML=`<img src="assets/ui/zones/${familyIcons[b.dataset.zoneFamily]}.png?v=168" alt=""><span>${name}</span>`;
 }
 const controls=document.getElementById('zoneControls'),toolbox=document.createElement('details');
 toolbox.id='zoneToolbox';toolbox.className='zone-toolbox';toolbox.hidden=true;
 const summary=document.createElement('summary');summary.textContent='Zoning options';toolbox.append(summary);
 controls.before(toolbox);toolbox.append(controls);
 const modes=document.createElement('div');modes.className='zone-mode-buttons';
 const modePaths={roadside:'M4 5v14m4-14v14M12 5h8v14h-8zM12 10h8m-8 4h8',rectangle:'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',brush:'m6 18 9-12 3 3L9 21H4v-5m11-10 2-3 4 4-3 2',fill:'m4 12 8-8 8 8-8 8-8-8Zm0 0h16'};
 const modeNames={roadside:'Along road',rectangle:'Rectangle',brush:'Brush',fill:'Fill block'};
 const caption=document.createElement('span');caption.textContent='Tool mode';modes.append(caption);
 for(const b of controls.querySelectorAll('[data-zone-mode]')){
  const mode=b.dataset.zoneMode;b.title=modeNames[mode];b.setAttribute('aria-label',modeNames[mode]);
  b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${modePaths[mode]}"/></svg>`;modes.append(b);
 }
 controls.prepend(modes);controls.insertBefore(document.getElementById('brushControls'),document.getElementById('zoneLotSummary'));
 const detail=document.createElement('div');detail.className='zone-selection';detail.hidden=true;detail.setAttribute('aria-live','polite');options.after(detail);
 const narrow=matchMedia('(max-width:1000px)');
 narrow.addEventListener('change',()=>{toolbox.open=!narrow.matches;});
 let buttons=[],hovered=null;
 const selected=()=>hovered||buttons.find(b=>b.classList.contains('active'))||buttons[0];
 const describe=b=>{
  if(!b){detail.textContent='Choose zoning';return;}
  const name=document.createElement('strong'),meta=document.createElement('span');
  name.textContent=b.dataset.zoneName;
  meta.textContent=b.getAttribute('aria-disabled')==='true'?b.querySelector('.unlock-note').textContent:b.dataset.zoneHint;
  detail.replaceChildren(name,meta);
 };
 options.addEventListener('pointerleave',()=>{hovered=null;describe(selected());});
 options.addEventListener('focusout',e=>{if(!options.contains(e.relatedTarget)){hovered=null;describe(selected());}});
 new MutationObserver(()=>describe(selected())).observe(options,{subtree:true,attributes:true,attributeFilter:['aria-disabled']});
 return {
  show(){
   panel.dataset.zoneShelf='';toolbox.hidden=false;toolbox.open=!narrow.matches;detail.hidden=false;hovered=null;
   buttons=[...options.querySelectorAll('[data-zone]')];
   for(const b of buttons){
    b.dataset.zoneName=b.querySelector('strong').textContent;b.dataset.zoneHint=b.querySelector('small').textContent;
    b.dataset.zoneSummary=b.dataset.zoneName+' · '+b.dataset.zoneHint;
    b.setAttribute('aria-label',b.dataset.zoneName);
    b.title=b.dataset.zoneSummary+(b.getAttribute('aria-disabled')==='true'?' · '+b.querySelector('.unlock-note').textContent:'');
    const icon=b.querySelector('.model-icon');
    icon.innerHTML=b.dataset.zone==='erase'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 14 10-10 8 8-8 8H9zM8 9l8 8M12 20h10"/></svg>':`<img src="assets/ui/zones/${b.dataset.zone}.png?v=168" alt="">`;
    b.addEventListener('pointerenter',()=>{hovered=b;describe(b);});b.addEventListener('focus',()=>{hovered=b;describe(b);});b.addEventListener('click',()=>describe(b));
   }
   describe(selected());
  },
  hide(){delete panel.dataset.zoneShelf;toolbox.hidden=true;detail.hidden=true;buttons=[];hovered=null;}
 };
}
