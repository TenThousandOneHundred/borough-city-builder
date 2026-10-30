// Compact, original vector previews for the road picker; no scene/model work.
function thumbnail(road){
 const half=7+road.lanes*2.1,p=(x,z)=>`${(36+x*.68+z*.72).toFixed(1)},${(24+x*.36-z*.4).toFixed(1)}`;
 const quad=(a,b,color)=>`<polygon points="${p(a,-21)} ${p(b,-21)} ${p(b,21)} ${p(a,21)}" fill="${color}"/>`;
 let content=quad(-half-2,half+2,road.sidewalk?'#c3c8c7':'#626b65')+quad(-half,half,road.cost===20?'#a3926f':'#747e85');
 if(road.median)content+=quad(-1.2,1.2,'#83996e');
 for(let lane=1;lane<road.lanes;lane++){
  const x=-half+2*half*lane/road.lanes;if(road.median&&Math.abs(x)<1.3)continue;
  content+=`<polyline points="${p(x,-19)} ${p(x,19)}" fill="none" stroke="#edf0e8" stroke-width=".7" stroke-dasharray="3 3"/>`;
 }
 if(road.oneway)content+=`<path d="M${p(0,-7)} L${p(0,7)} M${p(-3,3)} L${p(0,7)} L${p(3,3)}" fill="none" stroke="#fff" stroke-width="1.4"/>`;
 if(road.green)for(const z of [-13,0,13])for(const x of [-half-1,half+1])content+=`<ellipse cx="${36+x*.68+z*.72}" cy="${21+x*.36-z*.4}" rx="2.6" ry="3.3" fill="#8fbd64" stroke="#477456" stroke-width=".6"/>`;
 return `<svg viewBox="0 0 72 48" aria-hidden="true">${content}</svg>`;
}
export function createRoadShelf(panel,options,roads){
 const families=[['small','Small roads'],['medium','Medium roads'],['large','Large roads'],['highways','Highways']];
 const nav=document.createElement('div');nav.className='road-families';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Road sizes');nav.hidden=true;
 panel.querySelector('.panel-title').insertBefore(nav,panel.querySelector('#closeBuild'));
 const detail=document.createElement('div');detail.className='road-selection';detail.hidden=true;detail.setAttribute('aria-live','polite');options.after(detail);
 const toolbox=panel.querySelector('.road-toolbox'),narrow=window.matchMedia('(max-width:1000px)');
 narrow.addEventListener('change',()=>{toolbox.open=panel.hasAttribute('data-road-shelf')?!narrow.matches:true;});
 let buttons=[],family='small',hovered=null;
 const showDetail=button=>{if(!button){detail.textContent='Choose a road';return;}const name=document.createElement('strong'),meta=document.createElement('span');name.textContent=button.dataset.roadName;meta.textContent=button.getAttribute('aria-disabled')==='true'?button.querySelector('.unlock-note').textContent:button.dataset.roadMeta;detail.replaceChildren(name,meta);};
 const current=()=>hovered||buttons.find(b=>!b.hidden&&b.classList.contains('active'))||buttons.find(b=>!b.hidden);
 const select=value=>{family=value;hovered=null;for(const b of buttons)b.hidden=b.dataset.roadFamily!==family;for(const b of nav.children){const selected=b.dataset.family===family;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}showDetail(current());};
 for(const [id,name]of families){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.family=id;b.setAttribute('role','tab');b.onclick=()=>select(id);nav.append(b);}
 nav.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const i=families.findIndex(([id])=>id===family),n=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowLeft'?3:1))%4;select(families[n][0]);nav.children[n].focus();};
 options.addEventListener('pointerleave',()=>{hovered=null;showDetail(current());});
 new MutationObserver(()=>showDetail(current())).observe(options,{subtree:true,attributes:true,attributeFilter:['aria-disabled']});
 return {
  show(){
   panel.dataset.roadShelf='';toolbox.open=!narrow.matches;nav.hidden=false;detail.hidden=false;buttons=[...options.querySelectorAll('[data-road-type]')];
   for(const b of buttons){const road=roads[b.dataset.roadType];b.dataset.roadFamily=road.limitedAccess?'highways':road.lanes>=6?'large':road.lanes>=4?'medium':'small';b.dataset.roadName=road.name;b.dataset.roadMeta=`₡${road.cost} · ${road.lanes} lanes · ${road.speed} km/h`;b.dataset.roadSummary=road.name+' · '+b.dataset.roadMeta;b.setAttribute('aria-label',road.name);b.title=b.dataset.roadSummary+(b.getAttribute('aria-disabled')==='true'?' · '+b.querySelector('.unlock-note').textContent:'');b.querySelector('.model-icon').innerHTML=thumbnail(road);
    b.addEventListener('pointerenter',()=>{hovered=b;showDetail(b);});b.addEventListener('focus',()=>{hovered=b;showDetail(b);});b.addEventListener('click',()=>showDetail(b));
   }
   const active=buttons.find(b=>b.classList.contains('active'));select(active?.dataset.roadFamily||family);
  },
  hide(){toolbox.open=true;delete panel.dataset.roadShelf;nav.hidden=true;detail.hidden=true;buttons=[];hovered=null;}
 };
}
