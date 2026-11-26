// Static artwork from supplied GDG UI. All gameplay state stays live.
import {difficultyLabel} from './difficulty.js';
export const ART='assets/interface/shift-art/';
export const CARGO_UI=Object.freeze({
 noisy:{label:'소음 화물',color:'#ebc54b',detail:'운반 시 2.5초마다 소음 발생'},
 heavy:{label:'중량 화물',color:'#528dff',detail:'지상 이동 속도 15% 감소'},
 urgent:{label:'긴급 화물',color:'#ff3939',detail:'첫 집화 후 70초 초과 시 소음 발생'},
 cursed:{label:'격리 화물',color:'#ae52e9',detail:'4초마다 강력한 이상 신호 발생'}
});
const art=(name,cls='')=>'<img class="'+cls+'" src="'+ART+name+'.webp" alt="" decoding="async">';
export const cargoColor=type=>Object.hasOwn(CARGO_UI,type)?CARGO_UI[type].color:'#f4ca63';
export function cargoGuide(){
 return '<p>희미하게 빛나는 화물은 종류마다 위험이 다릅니다. 일반 화물과 동일하게 출고대에 배송하세요.</p><div class="cargo-guide-grid">'+Object.entries(CARGO_UI).map(([id,v])=>'<article class="cargo-guide-card" style="--cargo-color:'+v.color+'">'+art('cargo-'+id)+'<h3>'+v.label+'</h3><p>'+v.detail+'</p></article>').join('')+'</div><p class="shift-tip">긴급 화물도 제한 시간 초과 후 배송 가능합니다.</p>';
}
export function anomalyGuide(){
 return '<p>창고 환경이 불안정합니다. 주변을 주의하세요.</p><div class="anomaly-guide-grid"><article>'+art('blackout')+'<div><h3>랜덤 정전</h3><p>조명이 꺼지고 시야가 제한됩니다. 비상등, 손전등과 전체 지도(M)를 이용하세요.</p></div></article><article>'+art('interference')+'<div><h3>전파 간섭</h3><p>전등이 불규칙하게 약해집니다. 통로와 은신처를 확인하세요.</p></div></article></div><p class="shift-tip">Q 손전등 · M 전체 지도 · E 은신 사물함</p>';
}
const fmt=t=>{const n=Math.max(0,Math.floor(Number(t)||0));return Math.floor(n/60)+'분 '+String(n%60).padStart(2,'0')+'초';};
export function resultStats(s,alive=1){
 const states=s?.states??[],cargo=s?.cargo??[];
 return {done:states.filter(v=>v==='DELIVERED').length,total:states.length||30,special:states.filter((v,i)=>v==='DELIVERED'&&cargo[i]?.special).length,elapsed:fmt(s?.elapsed),alive,level:difficultyLabel(s?.difficulty?.level??s?.difficultyLevel)};
}
export function resultMarkup(s,won,alive=1){
 const v=resultStats(s,alive),rows=[['box','배송 완료 상자',v.done+' / '+v.total+'개'],['special','특수 화물',v.special+'개'],['time','근무 시간',v.elapsed],['alive','생존 작업자',v.alive+'명'],['level','난이도',v.level]];
 return '<p>'+(won?'이번 야간 근무가 종료되었습니다.':'근무 중 작업자 신호가 소실되었습니다.')+'</p><div class="shift-result-grid"><div class="shift-result-rows">'+rows.map(([id,label,value])=>'<div class="shift-result-row">'+art('result-'+id)+'<span>'+label+'</span><b>'+value+'</b></div>').join('')+'</div><div class="shift-result-stamp">'+(won?art('result-stamp'):'<strong class="failed-stamp">근무 실패</strong>')+'</div></div>';
}
export function teamGoals(count){
 return '<div class="team-goals"><b>팀 목표</b>'+[[2,40],[3,50],[4,70]].map(([n,q])=>'<span class="'+(n===count?'current':'')+'">'+n+'인 <strong>'+q+'개</strong>'+'</span>').join('')+'</div>';
}
export function mapLegendArt(){
 return '<aside class="facility-legend"><h3>범례</h3>'+[['player','플레이어','흰색 화살표 · 팀원은 색상별 구분'],['box','화물','노란 사각형 · 미배송 상자'],['hide','은신함','벽면의 철제 사물함'],['dock','출고대 02','하늘색 사각형 · 배송 목표 지점'],['special','특수 화물','마름모 · 유형별 색상 표시']].map(([id,label,detail])=>'<div class="legend-item">'+art('map-'+id)+'<div><b>'+label+'</b><small>'+detail+'</small></div></div>').join('')+'<div class="legend-colors">'+Object.values(CARGO_UI).map(v=>'<span style="--cargo-color:'+v.color+'"><i></i>'+v.label+'</span>').join('')+'</div><p>△ 높은 위치 · ┄ 가속 통로 · 청회색 엄폐 지점</p></aside>';
}
export function updateShiftNotices(s,host){
 if(!host)return;
 const active=s.shiftEvents?.active,remaining=active?Math.max(0,Math.ceil(active.until-s.elapsed)):0;
 const cargoBrief=s.elapsed<6&&s.cargo?.some(p=>p.special),key=active&&remaining?'event:'+active.kind+':'+remaining:cargoBrief?'cargo':'';
 if(host.dataset.noticeKey===key)return;
 host.dataset.noticeKey=key;host.hidden=!key;if(!key){host.innerHTML='';return;}
 if(active&&remaining){const blackout=active.kind==='blackout';host.innerHTML=art(blackout?'blackout':'interference')+'<div><small>GDG / EVENT WARNING</small><strong>'+(blackout?'정전 · 비상등 작동':'전파 간섭 · 조명 불안정')+'</strong><span>'+(blackout?'M 전체 지도 · Q 손전등':'주변 통로 및 은신처 확인')+' · '+remaining+'초</span></div>';}
 else{host.innerHTML=art('cargo-noisy')+'<div><small>GDG / SPECIAL CARGO</small><strong>특수 화물 '+s.cargo.filter(p=>p.special).length+'개 배치</strong><span>노랑 소음 · 파랑 중량 · 빨강 긴급 · 보라 격리</span></div>';}
}
