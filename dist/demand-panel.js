const housingTypes=[
 ['low','Low-density housing','Detached homes','#87bc50'],
 ['medium','Medium-density housing','Row houses · Apartments · Mixed-use','#45a46d'],
 ['high','High-density housing','Residential towers · Low-rent apartments','#247b56']
];

export function demandIndicators(stats){
 return [
  ...housingTypes.map(([key,name,,color])=>({name,demand:stats.housing[key].demand,color})),
  {name:'Commercial',demand:stats.demand[1],color:'#63b6df'},
  {name:'Industrial & office',demand:stats.demand[2],color:'#d7b660'}
 ];
}

export function renderHousingDemand(container,stats){
 container.replaceChildren();
 for(const [key,name,description,color]of housingTypes){
  const h=stats.housing[key],card=document.createElement('section');card.className='housing-demand-card';card.style.setProperty('--demand-color',color);
  const heading=document.createElement('h3'),score=document.createElement('strong');heading.textContent=name;score.textContent=Math.round(h.demand)+'%';heading.append(score);
  const subtitle=document.createElement('p');subtitle.className='housing-types';subtitle.textContent=description;
  const bar=document.createElement('div');bar.className='housing-demand-track';bar.setAttribute('role','meter');bar.setAttribute('aria-label',name+' construction demand');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(Math.round(h.demand)));
  const fill=document.createElement('i');fill.style.width=h.demand+'%';bar.append(fill);
  const occupancy=document.createElement('p');occupancy.className='housing-occupancy';occupancy.textContent=h.occupied+' / '+h.capacity+' resident places occupied · '+h.available+' available'+(h.construction?' · '+h.construction+' under construction':'');
  const factors=document.createElement('ul');factors.className='demand-factors';
  for(const factor of h.factors){
   const item=document.createElement('li'),label=document.createElement('span'),value=document.createElement('b');label.textContent=factor.label;const rounded=Math.round(factor.value);value.textContent=(rounded>0?'+':'')+rounded;value.className=rounded<0?'negative':rounded>0?'positive':'neutral';item.append(label,value);factors.append(item);
  }
  const advice=document.createElement('p');advice.className='housing-demand-advice';
  advice.textContent=h.demand<15?(h.available?'Existing homes have room. Let them fill before zoning more of this density.':h.construction?'Homes are already being built. Let construction finish before expanding.':'Demand is low. More jobs, lower taxes or better city conditions can attract residents.'):h.available?'Existing homes can fill while suitable new lots develop.':'New housing is wanted. Zone connected land with enough electricity and water.';
  card.append(heading,subtitle,bar,occupancy,factors,advice);container.append(card);
 }
}
