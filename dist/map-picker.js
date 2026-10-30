import {MAPS} from './map-catalog.js?v=165';
import {MAP_STATS} from './map-preview-stats.js?v=165';

export function createMapPicker(document){
 const $=id=>document.getElementById(id),choices=$('mapChoices');
 const key=map=>map.id+({'72':'-large','96':'-extra-large'}[$('newMapSize').value]||'');
 const preview=map=>new URL('./assets/maps/'+key(map)+'.webp?v=165',import.meta.url).href;
 function describeLand(){
  const count=(Number($('newMapSize').value)/24)**2,sandbox=$('newProgression').value==='sandbox';
  $('newLandHelp').textContent=sandbox?`All ${count} districts are yours in Sandbox.`:`Start with 1 of ${count} districts. Earn merits at population milestones, then open Land to buy tiles for 2 merits each. The first 100 residents earn your first expansion.`;
 }
 function select(map){
  describeLand();
  for(const card of choices.querySelectorAll('.map-card'))card.classList.toggle('selected',card.querySelector('input').value===map.id);
  $('selectedMapPreview').src=preview(map);$('selectedMapPreview').alt=map.name+' terrain preview';
  $('selectedMapName').textContent=map.name;$('selectedMapRegion').textContent=map.region;
  $('selectedMapDescription').textContent=map.description;$('selectedMapDifficulty').textContent=map.difficulty+' start';
  $('selectedMapLand').textContent=MAP_STATS[key(map)].land+'%';$('selectedMapRelief').textContent=map.relief;
 }
 for(const [index,map]of MAPS.entries()){
  const card=document.createElement('label');card.className='map-card';
  const input=document.createElement('input');input.type='radio';input.name='terrain';input.value=map.id;input.checked=index===0;input.setAttribute('aria-label',map.name);input.onchange=()=>select(map);
  const image=document.createElement('img');image.src=preview(map);image.alt='';image.width=428;image.height=214;image.decoding='async';
  const caption=document.createElement('span');caption.className='map-caption';
  const title=document.createElement('strong');title.textContent=map.name;
  const detail=document.createElement('small');detail.textContent=map.region+' · '+map.difficulty;
  caption.append(title,detail);card.append(input,image,caption);choices.append(card);
 }
 $('newMapSize').onchange=()=>{for(const card of choices.querySelectorAll('.map-card'))card.querySelector('img').src=preview(MAPS.find(m=>m.id===card.querySelector('input').value));select(MAPS.find(m=>m.id===choices.querySelector('input:checked').value));};
 $('newProgression').addEventListener('change',describeLand);
 select(MAPS[0]);
 return {selected:()=>MAPS.find(map=>choices.querySelector('input:checked')?.value===map.id)||MAPS[0]};
}
