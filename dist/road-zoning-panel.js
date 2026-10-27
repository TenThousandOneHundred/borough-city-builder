export const roadSideOptions=[['both','Both sides'],['left','Left side only'],['right','Right side only'],['none','No zoning']];

// Selection happens only on a click/change, never during camera rendering.
export function roadZoningPanel(engine,world,index,onSelect,onChange,onReplace){
 const section=document.createElement('section');section.className='intersection-control road-zoning-control';
 const title=document.createElement('h4');title.textContent='Roadside zoning';section.append(title);
 const targets=engine.roadZoningTargets(world,index);
 if(!targets.length){const note=document.createElement('p');note.className='small muted';note.textContent='Select a straight section beside this intersection to change its zoning.';section.append(note);return section;}
 const roadLabel=document.createElement('label');roadLabel.textContent='Road section';roadLabel.htmlFor='zoningRoadTarget';
 const road=document.createElement('select');road.id='zoningRoadTarget';
 targets.forEach((target,i)=>{const option=document.createElement('option');option.value=target.id;option.textContent=target.label+(targets.length>1?' '+(i+1):'');road.append(option);});
 const sideLabel=document.createElement('label');sideLabel.textContent='Available sides';sideLabel.htmlFor='zoningRoadSides';
 const sides=document.createElement('select');sides.id='zoningRoadSides';
 for(const [value,label]of [...roadSideOptions,['mixed','Different settings along section']]){const option=document.createElement('option');option.value=value;option.textContent=label;option.disabled=value==='mixed';sides.append(option);}
 const note=document.createElement('p');note.className='small muted';note.setAttribute('role','status');
 const select=()=>{const target=engine.roadZoningTargets(world,index).find(t=>t.id===road.value);sides.disabled=!target||engine.ROADS[target.type]?.limitedAccess;sides.value=engine.ROADS[target?.type]?.limitedAccess?'none':target?.zoneSides||'both';note.textContent=!target?'This road has changed. Select it again.':engine.ROADS[target.type]?.limitedAccess?'Highways do not have roadside zoning.':'The arrow points from start to end. Left and right follow that direction. Existing buildings and construction keep their lots; unused paint returns when you re-enable a side.';onSelect(target);};
 road.onchange=select;sides.onchange=()=>{const result=engine.setRoadZoning(world,road.value,sides.value);if(!result.ok){note.textContent=result.reason;return;}onChange(result);select();};
 section.append(roadLabel,road,sideLabel,sides,note);road.value=targets[0].id;select();if(onReplace){const button=document.createElement('button');button.textContent='Replace road type…';button.type='button';button.onclick=()=>onReplace(road.value);section.append(button);}return section;
}
