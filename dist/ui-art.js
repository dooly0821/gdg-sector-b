import {updateShiftNotices} from './shift-ui.js';
export const sectorName=s=>!s?'B 메인 창고':s.z>=54?(s.x< -15?'C-02 폐기물 처리동':'D-04 격리실험동'):s.z>=22?(s.x< -15?'D-03 반품동':'D-02 이송동'):s.x< -15?'C-01 분류동':'B 메인 창고';
export const clock=t=>{const n=Math.max(0,Math.floor(t||0));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');};
export function telemetry(s,hidden=false){
 const radius=s.noise&&s.elapsed-s.noise.time<.55?Math.max(0,s.noise.radius||0):0;
 const nearby=(s.haunt??[]).filter(a=>a.state!=='disappear'&&Math.hypot(a.x-s.x,a.z-s.z)<12);
 const chasing=nearby.some(a=>a.pursuit&&(!a.targetId||!s.id||a.targetId===s.id));
 return {noise:Math.min(1,radius/7),noiseLabel:radius>=5?'높음':radius>=2?'보통':radius>0?'낮음':'조용함',danger:hidden?(nearby.length?'수색 주의':'은신 중'):chasing?'추격 위험':nearby.length?'근접 주의':'감지 없음',alert:chasing&&!hidden};
}
export function progressBar(n,total=30){return '<div class="gdg-progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+total+'" aria-valuenow="'+n+'"><i style="width:'+Math.min(100,Math.max(0,n/total*100))+'%"></i></div>';}
export function decorateManual(body){
 const root=body.querySelector('.survival-manual');if(!root)return;
 const grid=document.createElement('div');grid.className='manual-grid';let section=null;
 for(const node of [...root.children]){
  if(node.tagName==='H3'){section=document.createElement('section');section.className='gdg-section manual-section';grid.append(section);section.append(node);}
  else if(section)section.append(node);else node.classList.add('manual-intro');
 }
 root.append(grid);
}
let lastMap=-Infinity,lastMapWorld=null;
export function updateHud(s,hidden,count,total,plan,now,hints=true,markers=null,mapWorld=null){
 const $=id=>document.getElementById(id),t=telemetry(s,hidden),play=$('play');
 play.classList.toggle('locker-ui',hidden);play.classList.toggle('threat-ui',t.alert);play.classList.toggle('hints-off',!hints);
 $('hud-sector').textContent=sectorName(s);$('hud-noise-fill').style.width=Math.round(t.noise*100)+'%';$('hud-noise-label').textContent=t.noiseLabel;
 $('hud-danger').textContent=t.danger;$('hud-progress').style.width=Math.round(count/total*100)+'%';$('hud-clock').textContent=clock(s.elapsed);
 $('hud-movement').textContent=hidden?'사물함 내부':s.onRail&&s.grounded?'난간 균형':(s.bodyHeight??1.7)<1.2?'앉기':!s.grounded?'공중':Math.hypot(s.vx||0,s.vz||0)>4.5?'달리기':'이동 가능';
 $('hud-locker').hidden=!hidden;updateShiftNotices(s,$('shift-event-notice'));
 const blackout=s.shiftEvents?.active?.kind==='blackout';play.classList.toggle('blackout-map',blackout);play.classList.toggle('map-expanded',!!s.mapExpanded);
 if(now-lastMap>80||now<lastMap||lastMapWorld!==mapWorld){lastMap=now;const host=$('hud-minimap-content');if(host&&!hidden&&(hints||blackout||s.mapExpanded)){
  if(lastMapWorld!==mapWorld||!host.querySelector('.gdg-map-markers')){host.innerHTML=plan();lastMapWorld=mapWorld;}
  const layer=host.querySelector('.gdg-map-markers');if(layer&&markers){const next=markers();if(layer.__last!==next){layer.innerHTML=next;layer.__last=next;}}
 }}
}
