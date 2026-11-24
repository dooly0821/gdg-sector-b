import {vaultPose} from './hand-motion.js';
import {updateHaunt,hauntLayers} from './haunt.js';
import {createScene,CONFIG,PARCELS,DOCK,newShift,step,forward,nextTarget,handlingTarget,canUse,parcelPositions,deliveryCount} from './mission.js';
import {PHYSICS} from "./movement.js";
import {rigs,beginHandling,advanceHandling,choreography,toggleFlashlight,updateViewmodel} from './handling.js';
import {Renderer} from './renderer.js';
const $=s=>document.querySelector(s),canvas=$('#world'),keys=new Set(),icon=i=>'<svg aria-hidden="true"><use href="#i-'+i+'"/></svg>';
let mode='menu',pane='',session=null,renderer,worlds,setupPromise,raf,last=0,drag=false,grabbing=false,lookReady=0,radioUntil=0,jump=false,accumulator=0;
const defaults={quality:'BALANCED',scale:1,sensitivity:1,motion:false,audio:true};
let settings={...defaults};try{Object.assign(settings,JSON.parse(localStorage.getItem('gdg.settings')||'{}'));}catch{}
if(!['HIGH','BALANCED','PERFORMANCE'].includes(settings.quality))settings.quality='BALANCED';
function persist(){try{localStorage.setItem('gdg.settings',JSON.stringify(settings));}catch{}document.querySelectorAll('.audio').forEach(b=>{b.innerHTML=icon(settings.audio?'sound':'mute');b.setAttribute('aria-pressed',String(settings.audio));});}
persist();
let sound,master,hum;
function audioOn(){try{if(!sound){sound=new AudioContext();master=sound.createGain();master.gain.value=0;master.connect(sound.destination);hum=sound.createOscillator();hum.frequency.value=56;hum.type='sine';hum.connect(master);hum.start();}sound.resume().catch(()=>{});master.gain.setTargetAtTime(settings.audio&&mode==='game'?.026:0,sound.currentTime,.4);}catch{}}
function beep(hz,time=.12,type='sine',gain=.1){if(!sound||!settings.audio)return;let o=sound.createOscillator(),g=sound.createGain(),now=sound.currentTime;o.type=type;o.frequency.setValueAtTime(hz,now);o.frequency.exponentialRampToValueAtTime(hz*.68,now+time);g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(.0001,now+time);o.connect(g);g.connect(sound.destination);o.start();o.stop(now+time+.02);}
function say(line,duration=5){$('#radio').innerHTML='<strong>관제실</strong>'+line;radioUntil=performance.now()+duration*1000;}
const rows=[['W A S D','이동'],['MOUSE','시점 회전'],['SHIFT','달리기'],['SPACE / WHEEL','점프 · 연속 점프 · 방향 입력 중 장애물 넘기'],['Q','손전등 들기 / 내리기'],['E','상자 들기 · 다시 눌러 내려놓기'],['ESC','일시 정지']];
const links='<div class="panel-actions"><a class="doc" href="unity-migration.html" target="_blank" rel="noopener">Unity 이식 가이드 ↗</a></div>';
function action(name,label,primary=false){return '<button class="'+(primary?'primary':'secondary')+'" data-action="'+name+'">'+label+'</button>';}
function plan(){
 const X=x=>105+x*4,Y=z=>100+z*4;
 const rect=(x,z,w,d,fill)=>'<rect class="rack" x="'+X(x)+'" y="'+Y(z)+'" width="'+(w*4)+'" height="'+(d*4)+'" style="fill:'+fill+'"/>';
 let shapes=rect(-43,-9,28,30,'#303031')+rect(-15,-22,30,44,'#232820')+rect(-15.7,12,1.4,4,'#bd9852')+'<text x="-57" y="117">C-01 야간 분류</text>';for(let r of [[-4.8,-16,4,9],[-4.8,-3.7,4,7.7],[-13,-16,3,9],[-13,-3.7,3,12.7],[3,-17,4,3],[6.5,-10,1.3,14],[11,-20,3.9,27],[11.65,7,1.7,8],[-5.9,8.45,2.7,1.5]])shapes+=rect(...r,'#51584b');
 const lines=PARCELS.map((p,i)=>{const pos=session?.parked?.[i]??p.pos;return '<circle cx="'+X(pos[0])+'" cy="'+Y(pos[2])+'" r="2.4" fill="'+(session?.states[i]==='DELIVERED'?'#646a59':'#f3bd51')+'"/>';}).join('');
 return '<svg class="map-drawing" viewBox="-75 0 397 201" aria-label="Sector B 시설 평면도"><defs><pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" stroke="#494e44" fill="none" stroke-width=".32"/></pattern></defs><rect width="322" height="201" fill="url(#grid)"/>'+shapes+lines+'<rect x="'+(X(DOCK[0])-4)+'" y="'+(Y(DOCK[2])-2)+'" width="8" height="4" fill="#9bc8cf"/><circle cx="'+X(session?.x??1.7)+'" cy="'+Y(session?.z??15)+'" r="2.7" fill="#f1f1e2"/><g stroke="#838777" stroke-width=".6" fill="none"><path d="M135 22h38l8-8h23M112 71h62l8-8h23M135 100h40l9-11h21M156 121h19l10-9h20M114 160h64l9-9h17"/></g><g><text x="209" y="17">02번 출고대</text><text x="209" y="66">보관 통로</text><text x="209" y="92">분류 컨베이어</text><text x="209" y="115">상층 캣워크</text><text x="209" y="155">직원 입고대</text></g></svg><div class="map-key"><span><b>●</b> 화물</span><span style="color:#9bc8cf">■ 출고대</span><span>● 작업자</span></div>';
}
function panel(name,body,title,eyebrow='GDG / 근무 안내'){
 pane=name;$('#eyebrow').textContent=eyebrow;$('#paneTitle').textContent=title;$('#paneBody').innerHTML=body;$('#modal').hidden=false;$('#close').focus();
}
function openPane(name){
 if(mode==='game'){pauseShift(false);}
 if(name==='quit')panel(name,'<p>현재 근무를 종료할까요? 진행 중인 배송은 초기화됩니다.</p><div class="panel-actions">'+action('quit','근무 종료',true)+action('brief','계속하기')+'</div>','게임 종료','GDG / 야간 근무');
 if(name==='manual')panel(name,'<p>GDG 상자 다섯 개를 한 개씩 02번 출고대로 운반하세요. 상자에 가까이 다가가 조준선에 노란 테두리가 생기면 E로 집습니다. E를 다시 눌러 앞의 빈 바닥이나 받침대에 내려놓거나 출고대에서 배송하세요. 서쪽 입구는 C-01 야간 분류 구역으로 이어집니다.</p>'+rows.map(([k,l])=>'<div class="row"><span>'+l+'</span><kbd>'+k+'</kbd></div>').join('')+'<p>상층 캣워크는 동쪽 계단으로 올라갑니다. 마우스가 고정되지 않으면 왼쪽 버튼을 누른 채 드래그하거나 방향키로 시점을 돌릴 수 있습니다.</p>'+ '<div class="panel-actions">'+action('map','구역 지도')+'</div>'+links,'조작 방법','WORK 모드 / 근무자 매뉴얼');
 if(name==='map')panel(name,plan()+'<p>직원 입고대에서 중앙 통로를 따라 북쪽으로 가면 출고대가 나옵니다. 동쪽 계단은 상층 화물로 연결됩니다.</p>','구역 지도','SECTOR B / 시설 평면도');
 if(name==='settings')panel(name,'<small>그래픽 품질</small><div class="presets">'+['HIGH','BALANCED','PERFORMANCE'].map(q=>'<button class="preset '+(q===settings.quality?'active':'')+'" data-quality="'+q+'">'+q+'</button>').join('')+'</div><label class="row">렌더 해상도 <output id="scaleVal">'+Math.round(settings.scale*100)+'%</output><input id="scale" type="range" min=".55" max="1" step=".05" value="'+settings.scale+'"></label><label class="row">마우스 감도 <output id="sensVal">'+settings.sensitivity.toFixed(1)+'×</output><input id="sens" type="range" min=".4" max="1.8" step=".1" value="'+settings.sensitivity+'"></label><div class="row">걸을 때 시점 흔들림<button class="toggle '+(settings.motion?'on':'')+'" data-toggle="motion">'+(settings.motion?'ON':'OFF')+'</button></div><div class="row">창고 소리<button class="toggle '+(settings.audio?'on':'')+'" data-toggle="audio">'+(settings.audio?'ON':'OFF')+'</button></div>','설정','SECTOR B / 환경 설정');
 if(name==='pause')panel(name,'<div class="row"><span>배송 완료</span><b>'+deliveryCount(session)+' / 5</b></div><div class="panel-actions">'+action('resume','근무 재개',true)+action('map','구역 지도')+action('settings','설정')+action('manual','조작 방법')+action('brief','메인 메뉴')+'</div>','일시 정지','GDG / 대기 중');
}
function closePane(){if(mode==='paused'&&pane!=='pause'&&pane!=='complete'){openPane('pause');return;}if(mode==='paused'&&pane==='pause'){resume();return;}if(pane==='complete'){toMenu();return;}$('#modal').hidden=true;pane='';$('#start').focus();}
function toMenu(){
 cancelAnimationFrame(raf);mode='menu';keys.clear();jump=false;drag=false;pane='';
 for(const id of ['#modal','#play','#loading','#ended'])$(id).hidden=true;
 $('#briefing').hidden=false;
 const continuing=!!session&&deliveryCount(session)<PARCELS.length;
 $('#start .resume-label').hidden=!continuing;
 $('#start').setAttribute('aria-label',continuing?'이어서 근무':'게임 시작');
 $('#start').focus();audioOn();
}
function clockOut(){
 cancelAnimationFrame(raf);keys.clear();jump=false;drag=false;session=null;finishAt=null;mode='ended';pane='';
 $('#modal').hidden=true;$('#briefing').hidden=true;$('#play').hidden=true;$('#ended').hidden=false;
 $('#ended button').focus();if(document.pointerLockElement===canvas)document.exitPointerLock();audioOn();
}
function pauseShift(show=true){if(mode!=='game')return;mode='paused';keys.clear();jump=false;drag=false;cancelAnimationFrame(raf);if(document.pointerLockElement===canvas)document.exitPointerLock();audioOn();if(show)openPane('pause');}
async function lock(){if(grabbing||document.pointerLockElement===canvas)return;grabbing=true;try{await canvas.requestPointerLock();}catch{}finally{grabbing=false;}}
function resume(){if(!renderer)return;mode='game';pane='';$('#modal').hidden=true;$('#briefing').hidden=true;$('#play').hidden=false;canvas.focus();lock();audioOn();last=performance.now();accumulator=0;cancelAnimationFrame(raf);frame(last);}
const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function reportProgress(value,label){
 const percent=Math.round(value*100);
 $('#progress').setAttribute('aria-valuenow',percent);
 $('#progress').style.setProperty('--pct',percent+'%');
 $('#load-detail').textContent=label+'  ·  '+percent+'%';
}
async function load(){
 if(!setupPromise)setupPromise=(async()=>{
  worlds=createScene();reportProgress(.12,'창고 배치 완료');await painted();
  try{renderer=new Renderer(canvas);}
  catch(error){
   if(!error.message.startsWith('WebGL 2 is unavailable'))throw error;
   const {SoftwareRenderer}=await import('./software.js');renderer=new SoftwareRenderer(canvas);
  }
  await renderer.prepare(rigs(worlds),(value,label)=>reportProgress(.12+.78*value,label));
  renderer.setQuality(settings.quality);
 })();
 await setupPromise;
}
$('#start').onclick=async()=>{
 if(mode!=='menu')return;
 const b=$('#start');b.disabled=true;mode='loading';$('#briefing').hidden=true;$('#loading').hidden=false;
 try{
  audioOn();reportProgress(0,'구역 준비 중');await painted();await load();
  if(!session||deliveryCount(session)===PARCELS.length){session=newShift();finishAt=null;receiptUntil=0;}
  reportProgress(.96,'첫 화면 준비 중');$('#play').hidden=false;
  const eye=[session.x,session.y+CONFIG.eye,session.z],facing=forward(session);
  const pose=choreography(session,eye,false,false,false,session.elapsed);
  renderer.render(eye,facing,parcelPositions(session,pose.hidden),pose,settings.scale);
  reportProgress(1,'출근 준비 완료');await painted();
  $('#loading').hidden=true;resume();say('GDG 표식이 있는 상자를 02번 출고대로 운반하세요.',4);
 }catch(error){
  setupPromise=null;renderer=null;toMenu();
  panel('error','<p id="errorText"></p><div class="panel-actions">'+action('retry','다시 시도',true)+'</div>','구역 진입 실패');
  $('#errorText').textContent='창고를 준비하지 못했습니다. '+error.message;
 }finally{b.disabled=false;}
};
function complete(){pauseShift(false);beep(630,.3);panel('complete','<div class="row"><span>출고 내역</span><b>5 / 5건 배송 완료</b></div><div class="row"><span>근무 시간</span><b>'+Math.floor(session.elapsed/60)+'분 '+Math.floor(session.elapsed%60)+'초</b></div><p>화물 다섯 개의 배송을 마쳤습니다. 여섯 번째 서명은 야간 관리자가 처리합니다.</p><div class="panel-actions">'+action('brief','근무 마치기',true)+action('resume','창고 둘러보기')+'</div>','전체 배송 완료','출고 02 / 근무 확인서');}
let receiptUntil=0;
function use(target=handlingTarget(session,worlds[0].blocks)){
 if(session.handAction||session.pendingUse||!canUse(session,target,worlds[0].blocks))return;
 if(session.flashlight||session.flashAmount>0){session.restoreTorch=session.flashlight||session.restoreTorch;session.flashlight=false;if(session.flashAmount>0){session.pendingUse=target;return;}}
 if(beginHandling(session,target,worlds[0].blocks))beep(235,.07,'sine',.035);
}
function onHandling(result,now,id){
 if(session.restoreTorch){session.flashlight=true;session.restoreTorch=false;}
 if(result==='cancelled'){say('작업이 중단됐습니다. 상자나 출고대를 향해 다시 시도하세요.',2);return;}
 if(result==='dropped'){beep(195,.11);say(id+' 임시 적치 완료. 다시 집어 배송할 수 있습니다.',2);return;}
 if(result==='picked'){beep(295,.13);say(id+' 집화 완료. 02번 출고대로 운반하세요.',3);return;}
 if(result==='delivered'){
  const n=deliveryCount(session);beep(620,.18);$('#receipt').hidden=false;
  $('#receipt').textContent='✓ 배송 완료  ·  '+n+' / '+PARCELS.length;receiptUntil=now+1750;
  say(['','첫 배송 확인. 상자 안에서 나는 노크는 무시하세요.','두 번째 배송 확인. 스캐너가 두 번 울려도 한 건입니다.','세 번째 배송 확인. 야간 관리자가 안부를 전합니다.','네 번째 배송 확인. 마지막 상자의 서명이 남았습니다.','오늘 야간 근무의 배송이 모두 끝났습니다.'][n],3);
  if(n===PARCELS.length){$('#delivered').textContent=n+' / '+n;finishAt=session.elapsed+1.25;}
 }
}
let finishAt=null;
const areaNames={'Employee intake':'직원 입고대','Storage cross aisle':'보관 통로','Conveyor sorting':'컨베이어 분류대','Upper catwalk':'상층 캣워크','Loading aisle':'하역 통로','Outbound dispatch':'02번 출고대'};
function targetCorners(pos,dock){
 const w=dock?1.25:CONFIG.parcelWidth/2,h=dock?.12:CONFIG.parcelWidth*.88,d=dock?.82:CONFIG.parcelWidth*.41;
 const points=[];for(const x of [-w,w])for(const y of [0,h])for(const z of [-d,d]){
  const pt=renderer.project([pos[0]+x,pos[1]+y,pos[2]+z]);if(!pt)return null;points.push(pt);
 }
 const xx=points.map(p=>(p[0]+1)*50),yy=points.map(p=>(1-p[1])*50);
 return [Math.min(...xx),Math.min(...yy),Math.max(...xx)-Math.min(...xx),Math.max(...yy)-Math.min(...yy)];
}
function frame(now){if(mode!=='game')return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;const s=session;
 if(keys.has('ArrowLeft'))s.yaw+=dt*1.65;if(keys.has('ArrowRight'))s.yaw-=dt*1.65;if(keys.has('ArrowUp'))s.pitch=Math.min(CONFIG.pitchLimit,s.pitch+dt);if(keys.has('ArrowDown'))s.pitch=Math.max(-CONFIG.pitchLimit,s.pitch-dt);
 const was=s.steps;const tick=1/PHYSICS.hz;accumulator+=dt;while(accumulator>=tick){step(s,keys,worlds[0].blocks,tick,jump);jump=false;accumulator-=tick;}updateViewmodel(s,dt);
 if(s.pendingUse&&s.flashAmount===0){const target=s.pendingUse;s.pendingUse=null;use(target);if(!s.handAction&&s.restoreTorch){s.flashlight=true;s.restoreTorch=false;}}
 if(s.grounded&&Math.floor(s.steps/1.12)>Math.floor(was/1.12))beep(95,.08,'sine',.04);
 const moving=s.steps>was+.002;const bob=settings.motion&&moving&&s.grounded?Math.sin(s.steps*5.5)*.014:0;
 const active=s.handAction;
 if(active){const result=advanceHandling(s,worlds[0].blocks,dt);if(result)onHandling(result,now,active.target.id);}
 const facing=forward(s);
 const threat=updateHaunt(s,worlds[0].blocks,facing,dt);
 if(threat){say(threat+' 출현. 비상 차단으로 서쪽 통로로 복귀했습니다.',3);beep(110,.52,'triangle',.12);}
 const useTarget=handlingTarget(s,worlds[0].blocks),available=canUse(s,useTarget,worlds[0].blocks);
 const target=s.carried<0&&available?useTarget:nextTarget(s);
 const {reach,brace}=vaultPose(s.vault);
 const eye=[s.x,s.y+CONFIG.eye+bob-.065*brace-(s.landKick??0)*.8,s.z];
 const view=brace?forward({...s,pitch:s.pitch-.125*reach}):facing;
 const pose=choreography(s,eye,available,moving,keys.has('ShiftLeft')||keys.has('ShiftRight'),s.elapsed);
 pose.actors=hauntLayers(s);pose.clock=s.elapsed;
 renderer.render(eye,view,parcelPositions(s,pose.hidden),pose,settings.scale);
 const mark=$('#waypoint'),p=$('#prompt'),brackets=$('#target-brackets');
 let msg='';brackets.hidden=true;mark.hidden=true;
 if(target&&!s.handAction){
  const distance=Math.hypot(s.x-target.pos[0],s.y-target.pos[1],s.z-target.pos[2]);const pt=target.pos.slice();pt[1]+=target.dock?1.05:.83;
  const clip=renderer.project(pt),label=target.dock?'출고 02':target.id;
  if(clip&&Math.abs(clip[0])<.92&&Math.abs(clip[1])<.84){mark.hidden=false;mark.style.left=(clip[0]+1)*50+'%';mark.style.top=(1-clip[1])*50+'%';mark.textContent='◆ '+label+' · '+Math.round(distance)+' m';}
  else msg=label+' / '+areaNames[target.area]+' · '+Math.round(distance)+' m';
  if(available){
   msg='<kbd>E</kbd> '+(useTarget.dock?'배송하기':useTarget.drop?'상자 내려놓기':'상자 들기');
   const box=targetCorners(useTarget.pos,useTarget.dock);
   if(box){brackets.hidden=false;['left','top','width','height'].forEach((k,i)=>brackets.style[k]=box[i]+'%');}
  }
 }
 if(s.handAction)msg=s.handAction.placing?'상자 내려놓는 중':'상자 드는 중';
 if(!msg&&!document.pointerLockElement&&!drag)msg='드래그로 시점 회전 · WASD 이동';
 $('#torch-status').textContent='Q · 손전등 '+(s.flashlight?'ON':'OFF');p.innerHTML=msg;$('#delivered').textContent=deliveryCount(s)+' / '+PARCELS.length;
 $('#carry-status span').textContent=s.handAction?(s.handAction.placing?'내려놓는 중':'드는 중'):s.carried>=0?(s.flashlight?'한 손 운반 중':'운반 중'):'빈손';
 $('#taskLine').textContent=target?(target.dock?PARCELS[s.carried].id+' → 02번 출고대':target.id+' · '+areaNames[target.area]):'전체 배송 완료';
 const directions=['N','NE','E','SE','S','SW','W','NW'];const bearing=((Math.round(-s.yaw*180/Math.PI)%360)+360)%360;
 $('#heading').textContent=directions[Math.round(bearing/45)%8]+'  '+String(bearing).padStart(3,'0')+'°';
 if(now>radioUntil)$('#radio').textContent='';if(now>receiptUntil)$('#receipt').hidden=true;
 if(finishAt!==null&&s.elapsed>=finishAt){finishAt=null;complete();return;}
 raf=requestAnimationFrame(frame);
}
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(mode==='game'){pauseShift();}else if(!$('#modal').hidden){closePane();}return;}
 if(mode!=='game')return;if(['Space','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','ShiftLeft','ShiftRight','ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
 if(e.code==='KeyQ'&&!e.repeat){if(toggleFlashlight(session)){session.pendingUse=false;session.restoreTorch=false;beep(180,.055,'triangle',.025);}else say('상자를 집거나 내려놓는 동안에는 장비 전환을 할 수 없습니다.',2);return;}if(e.code==='KeyE'&&!e.repeat){use();return;}if(e.code==='Space'&&!e.repeat)jump=true;keys.add(e.code);
});document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('wheel',e=>{if(mode==='game'){e.preventDefault();jump=true;}},{passive:false});
function pointer(e){if(mode!=='game'||(!document.pointerLockElement&&!drag)||performance.now()<lookReady||Math.abs(e.movementX)>220||Math.abs(e.movementY)>220)return;session.yaw-=e.movementX*CONFIG.sensitivity*settings.sensitivity;session.pitch=Math.max(-CONFIG.pitchLimit,Math.min(CONFIG.pitchLimit,session.pitch-e.movementY*CONFIG.sensitivity*settings.sensitivity));}
document.addEventListener('mousemove',pointer);canvas.addEventListener('mousedown',()=>{if(mode==='game'){drag=true;lock();}});document.addEventListener('mouseup',()=>drag=false);
document.addEventListener('pointerlockchange',()=>{lookReady=performance.now()+200;if(!document.pointerLockElement&&mode==='game')pauseShift();});window.addEventListener('blur',()=>pauseShift());document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseShift();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseShift(false);panel('error','<p>그래픽 연결이 끊어졌습니다. 새로 열어 창고에 다시 접속하세요.</p><div class="panel-actions">'+action('reload','다시 열기',true)+'</div>','그래픽 연결 중단');});
$('#close').onclick=closePane;$('#pause').onclick=()=>pauseShift();
document.addEventListener('keydown',e=>{
 if(e.key!=='Tab'||$('#modal').hidden)return;
 const controls=[...$('#modal').querySelectorAll('button,a[href],input')].filter(el=>!el.disabled);
 if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}
 else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}
});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.pane)openPane(b.dataset.pane);if(b.classList.contains('audio')){settings.audio=!settings.audio;persist();audioOn();if(settings.audio)beep(325,.1);}
 if(b.dataset.quality){settings.quality=b.dataset.quality;renderer?.setQuality(settings.quality);persist();openPane('settings');}
 if(b.dataset.toggle){const k=b.dataset.toggle;settings[k]=!settings[k];persist();audioOn();openPane('settings');}
 const a=b.dataset.action;if(a==='quit')clockOut();else if(a==='retry'){toMenu();$('#start').click();}else if(a==='reload')location.reload();else if(a==='resume')resume();else if(a==='brief')toMenu();else if(a)openPane(a);
});
$('#modal').addEventListener('input',e=>{if(e.target.id==='scale'){settings.scale=Number(e.target.value);$('#scaleVal').textContent=Math.round(settings.scale*100)+'%';}else if(e.target.id==='sens'){settings.sensitivity=Number(e.target.value);$('#sensVal').textContent=settings.sensitivity.toFixed(1)+'×';}persist();});
