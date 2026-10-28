import './roundabout-state.js?v=143';
import {roadGeometry} from './road-junction-plan.js?v=143';
import {roundaboutQuote} from './roundabout-geometry.js?v=143';
const R=globalThis.BoroughRoundabouts;
export function roundaboutPanel(engine,world,id,{height,onPreview,onApply,onError}){
 const section=document.createElement('section');section.className='intersection-control';
 const h=document.createElement('h4');h.textContent='Roundabout';
 const label=document.createElement('label');label.textContent='Island size';label.htmlFor='roundaboutSize';const select=document.createElement('select');select.id='roundaboutSize';
 for(const [value,name]of [...Object.entries(R.SIZES).map(([key,s])=>[key,s.name+' · ₡'+s.cost.toLocaleString()]),['none','Remove roundabout · ₡50']]){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}select.value=world.roundabouts?.[id]?.size||'small';
 const note=document.createElement('p');note.id='roundaboutQuote';note.className='small muted';note.setAttribute('role','status');
 const action=document.createElement('button');action.id='applyRoundabout';
 const help=document.createElement('p');help.className='small muted';help.textContent='Circulating traffic has priority. Keep the site clear of buildings and paths. Remove the circle before editing its connecting streets.';
 const quote=()=>roundaboutQuote(world,engine,roadGeometry(world,engine).junctions,id,select.value,height);
 const refresh=()=>{const q=quote();action.disabled=!q.ok;action.textContent=select.value==='none'?'Restore normal intersection':world.roundabouts?.[id]?'Change roundabout':'Build roundabout';note.textContent=q.ok?'₡'+q.cost.toLocaleString()+' · '+(select.value==='none'?'Restores the previous traffic controls.':Math.round(q.shape.outer*10)+' m road diameter · one circulating lane'):q.reason;onPreview?.(q);};
 select.onchange=refresh;action.onclick=()=>{const q=quote();if(!q.ok){onError?.(q.reason);refresh();return;}const result=R.apply(world,roadGeometry(world,engine).junctions,id,select.value,engine);if(!result.ok){onError?.(result.reason);refresh();return;}onApply?.(result);refresh();};
 section.append(h,label,select,note,action,help);refresh();return section;
}
