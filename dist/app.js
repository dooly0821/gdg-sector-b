import {powerTarget,toggleZone,emitSignal,signalReady,zonePowers,zonePower,pruneSignals} from './facility-actions.js';
import {expandedLayout} from './map-layout.js';
import {cargoGuide,anomalyGuide,resultMarkup,teamGoals,mapLegendArt} from './shift-ui.js';
import {DIFFICULTIES,normalizeDifficulty,difficultyLabel,missionTotal,cargoQuota} from './difficulty.js';
import {mapMarkup,mapMarkers} from './facility-map.js';
import {tickShiftEvents,eventLighting,specialLabel} from './shift-events.js';
import {sectorName,clock,telemetry,progressBar,decorateManual,updateHud} from './ui-art.js';
import {normalizeNickname,escapeNickname} from './nickname.js';
import {PUBLIC_SERVERS,serverName} from './public-servers.js';
import {CoopClient,peerLayers,applyCoopSnapshot,interpolateCoopHaunt,advanceCoopPrediction} from './multiplayer.js';
import {REVIVE_SECONDS,findReviveTarget} from './revive.js';
import {spectatorTarget,spectatorCamera,rescueLayers} from './spectator.js';
import {remoteAt} from './net-smoothing.js';
import {drawTraversalDebug} from './traversal-debug.js';
import {equipmentClearance,nearbyBlocks} from './contact.js';
import {posePoint,renderPosition,shiftPrevious,mouseDelta,blockGameplayShortcut,frameBudget} from './frame-pacing.js';
import {updateHaunt,hauntLayers,SPAWN_BALANCE} from './haunt.js';
import {HIDING_POINTS,REFUGES} from './annex.js';
import {DENSE_PROPS} from './density.js';
import {DRESSING,DRESSING_HIDE} from './dressing.js';
import {LOCKERS,lockerDoorBlocks,lockerLayers,lockerTarget,useLocker,closedLocker,lockerPrompt} from './lockers.js';
import {createScene,CONFIG,PARCELS,DOCK,newShift,step,forward,nextTarget,handlingTarget,dropTarget,canUse,parcelPositions,parcelBlocks,deliveryCount,shiftParcel,MISSION_TOTAL} from './mission.js';
import {PHYSICS} from "./movement.js";
import {LOCKER_DOOR_GROUP,TEAM_WORKER_GROUP,workerLegLayers,rigs,beginHandling,advanceHandling,choreography,toggleFlashlight,updateViewmodel} from './handling.js';
import {Renderer} from './renderer.js';
const $=s=>document.querySelector(s),canvas=$('#world'),keys=new Set(),icon=i=>'<svg aria-hidden="true"><use href="#i-'+i+'"/></svg>';
let coop=null,soloSession=null,coopStarting=false,coopEnding=false,coopEventSeq=0,coopError='',coopBusy=false;
let spectateId=null,spectateCamera=null;
let coopListTimer=null,coopListGeneration=0,coopListBusy=false,coopNickname='',selectedServer=null,visibleServers=[];
try{coopNickname=localStorage.getItem('gdg.nickname')??'';}catch{}
let mode='menu',pane='',session=null,renderer,worlds,setupPromise,raf,last=0,drag=false,grabbing=false,lookReady=0,radioUntil=0,jump=false,accumulator=0;
const defaults={difficulty:'normal',quality:'BALANCED',scale:1,sensitivity:1,motion:false,audio:true,brightness:1,volume:1,invert:false,hints:true};
let settings={...defaults};try{Object.assign(settings,JSON.parse(localStorage.getItem('gdg.settings')||'{}'));}catch{}
settings.difficulty=normalizeDifficulty(settings.difficulty);
if(!['HIGH','BALANCED','PERFORMANCE'].includes(settings.quality))settings.quality='BALANCED';
function persist(){document.documentElement.style.setProperty('--world-brightness',Math.max(.65,Math.min(1.45,Number(settings.brightness)||1)));try{localStorage.setItem('gdg.settings',JSON.stringify(settings));}catch{}document.querySelectorAll('.audio').forEach(b=>{b.innerHTML=icon(settings.audio?'sound':'mute');b.setAttribute('aria-pressed',String(settings.audio));});}
persist();
let sound,master,hum;
function audioOn(){try{if(!sound){sound=new AudioContext();master=sound.createGain();master.gain.value=0;master.connect(sound.destination);hum=sound.createOscillator();hum.frequency.value=56;hum.type='sine';hum.connect(master);hum.start();}sound.resume().catch(()=>{});master.gain.setTargetAtTime(settings.audio&&mode==='game'?.026*(settings.volume??1):0,sound.currentTime,.4);}catch{}}
function beep(hz,time=.12,type='sine',gain=.1){if(!sound||!settings.audio||settings.volume<=0)return;let o=sound.createOscillator(),g=sound.createGain(),now=sound.currentTime;o.type=type;o.frequency.setValueAtTime(hz,now);o.frequency.exponentialRampToValueAtTime(hz*.68,now+time);g.gain.setValueAtTime(Math.max(.0001,gain*(settings.volume??1)),now);g.gain.exponentialRampToValueAtTime(.0001,now+time);o.connect(g);g.connect(sound.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start();o.stop(now+time+.02);}
function say(line,duration=5){$('#radio').innerHTML='<strong>관제실</strong>'+line;radioUntil=performance.now()+duration*1000;}
const rows=[['W A S D','이동'],['MOUSE','시점 회전'],['SHIFT','달리기'],['C (누르고 유지)','앉기 / 은신'],['V','달리기 / 공중 슬라이딩 · 종료 후 0.4초 재사용 대기'],['F','손전등 유인 신호 · 12초 재사용 대기'],['C + W A S D','앉은 채 이동 / 낮은 은신처 진입'],['W + SPACE','난간 · 선반 · 상자 위 자유 점프'],['SHIFT + W + SPACE','달리면서 난간 점프'],['W + C + SPACE','전진 버니합 · 도약할 때만 가속'],['A / D','공중 방향 조절 · 추가 가속 없음'],['SPACE / WHEEL','기본 점프 (약 1.2m) · 연속 점프'],['C + SPACE','앉기 점프 (약 1m) · 버니합 가속 시 최대 1.35m'],['Q','손전등 들기 / 내리기'],['E','상자 들기 · 내려놓기 / 쓰러진 팀원 근처 2.5초 유지해 구조'],['M','전체 지도 확대 / 축소'],['ESC','일시 정지']];
const links='<a class="doc" href="characters.html" target="_blank" rel="noopener">캐릭터 검수실 ↗</a><div class="panel-actions"><a class="doc" href="unity-migration.html" target="_blank" rel="noopener">Unity 이식 가이드 ↗</a></div>';
function action(name,label,primary=false){return '<button class="'+(primary?'primary':'secondary')+'" data-action="'+name+'">'+label+'</button>';}
const emptyMapBlocks=[],sceneCache=new Map();let renderLayout=null;
function sceneFor(level){const k=expandedLayout(level)?'hard':'normal';if(!sceneCache.has(k))sceneCache.set(k,createScene(k));return sceneCache.get(k);}
function plan(){const scene=sceneFor(session?.difficultyLevel??settings.difficulty);return mapMarkup(scene[0].blocks,session,coop?.snapshot?.players??[],coop?.snapshot?.you);}
function mapMarkersNow(){return mapMarkers(session,coop?.snapshot?.players??[],coop?.snapshot?.you);}
function coopInput(){const s=session??{};return {keys:mode==='game'&&!s.failed?[...keys]:[],yaw:s.yaw??0,pitch:s.pitch??0};}
function stopServerList(){clearTimeout(coopListTimer);coopListGeneration++;coopListBusy=false;}
function coopSlots(count,players=null,you=null,host=null){
 const n=Math.max(0,Math.min(4,Number(count)||0));
 return '<div class="coop-roster">'+Array.from({length:4},(_,i)=>{
  const p=players?.[i],occupied=i<n;
  const label=p?escapeNickname(p.name)+(p.id===you?' (나)':''):occupied?'접속 작업자 '+(i+1):'빈 자리';
  const state=p?(p.failed?'사망':p.hidden?'은신':p.id===host?'방장':'대기 중'):occupied?'접속 중':'대기';
  const tone=p?.failed?'red':p?.hidden?'muted':occupied?'green':'muted';
  return '<div class="coop-person '+(occupied?'occupied':'empty')+' '+(p&&p.id===you?'me':'')+'"><span class="worker-mark" aria-hidden="true"></span><span class="worker-name">'+label+'</span><span class="coop-state '+tone+'">'+state+'</span></div>';
 }).join('')+'</div>';
}
function drawServerList(servers){
 const node=$('#coop-servers');if(!node)return;
 visibleServers=servers; if(!servers.some(s=>s.id===selectedServer&&s.joinable))selectedServer=servers.find(s=>s.joinable)?.id??null;
 node.innerHTML=servers.map(s=>{
  const id=PUBLIC_SERVERS.find(p=>p.id===s.id);if(!id)return '';
  const count=Math.max(0,Math.min(4,Number(s.count)||0));
  const full=count>=4, label=full?'가득 참':s.phase==='empty'?'입장 가능':s.phase==='lobby'?'대기 중':s.phase==='loading'?'근무 준비 중':s.phase==='playing'?'플레이 중':'근무 종료 중';
  const tone=full?'red':s.joinable?'green':'amber', index=PUBLIC_SERVERS.indexOf(id)+1;
  return '<button class="public-server '+(selectedServer===id.id?'selected':'')+'" data-action="coop-select-'+id.id+'" aria-pressed="'+(selectedServer===id.id)+'" '+(s.joinable&&!coopBusy?'':'disabled')+'><span class="server-thumb server-thumb-'+index+'" aria-hidden="true"></span><span class="server-title">'+id.name+'<small>공개 배송 · 공동 근무</small></span><span class="server-count">'+count+' / 4<span class="server-slots">'+Array.from({length:4},(_,i)=>'<i class="'+(i<count?'occupied':'')+'"></i>').join('')+'</span></span><span class="coop-state '+tone+'">'+label+'</span></button>';
 }).join('');
 const detail=$('#server-preview');if(detail){const s=servers.find(s=>s.id===selectedServer);detail.innerHTML=s?'<h3><span class="coop-heading-icon" aria-hidden="true">♟</span>현재 팀 정보</h3><div class="server-summary"><strong>'+escapeNickname(s.name)+'</strong><b>'+s.count+' / 4</b></div>'+coopSlots(s.count)+'<p class="coop-team-tip">⚠ 참가하면 실제 팀원의 닉네임을 확인할 수 있습니다.</p>':'<h3>현재 팀 정보</h3><p>입장 가능한 서버가 없습니다.</p>'+coopSlots(0);}
 for(const id of ['#server-join','#server-quick']){const b=$(id);if(b)b.disabled=!servers.some(s=>s.joinable)||coopBusy;}
}
async function refreshServers(){
 if(pane!=='coop'||coop||coopBusy||coopListBusy)return;
 clearTimeout(coopListTimer);const generation=coopListGeneration;coopListBusy=true;
 try{
  const data=await new CoopClient().request('list');
  if(generation!==coopListGeneration||pane!=='coop'||coop)return;
  drawServerList(data.servers??[]);if($('#coop-notice'))$('#coop-notice').textContent='닉네임을 입력하고 서버를 선택하세요. 최소 2명부터 시작합니다.';
 }catch(e){if(generation===coopListGeneration&&pane==='coop'&&!coop)coopMessage(e);}
 finally{if(generation===coopListGeneration){coopListBusy=false;if(pane==='coop'&&!coop&&!coopBusy)coopListTimer=setTimeout(refreshServers,5000);}}
}
function difficultyChoices(level,mode,locked=false){
 return '<div class="difficulty-options">'+Object.entries(DIFFICULTIES).map(([id,p])=>'<button class="difficulty-choice '+(id===level?'selected':'')+'" data-level="'+id+'" data-action="'+mode+'-difficulty-'+id+'" aria-pressed="'+(id===level)+'" '+(locked?'disabled':'')+'><b>'+p.label+'</b><small>'+p.description+'</small></button>').join('')+'</div>';
}
function soloDifficulty(){
 const continuing=session&&!session.failed&&deliveryCount(session)<missionTotal(session);
 panel('difficulty','<p>싱글 배송 목표 30개 · 근무 난이도를 선택하세요.</p>'+difficultyChoices(settings.difficulty,'solo')+'<div class="shift-guide-links">'+action('cargo','특수 화물 안내')+action('anomalies','이상 현상 안내')+'</div><div class="panel-actions">'+action('solo-confirm','새 근무 시작',true)+(continuing?action('solo-continue','이전 근무 이어서'):'')+action('back','뒤로')+'</div>','근무 난이도','GDG / SOLO SHIFT');
}
function coopLobby(){
 stopServerList();
 const snap=coop?.snapshot,note='<p id="coop-notice" role="status"></p>';
 if(!snap){
  panel('coop','<p class="coop-intro">닉네임을 입력하고 공개 서버에 참가하세요</p><label class="coop-label nickname-label" for="coop-nickname"><span class="nickname-title">닉네임</span><input id="coop-nickname" autocomplete="nickname" maxlength="24" placeholder="닉네임 입력 (2~12자)" value="'+escapeNickname(coopNickname)+'"><small>한글·영문·숫자, 공백, _ 및 - 사용 가능</small></label><div class="server-grid"><section class="gdg-section coop-server-section"><div class="coop-server-head"><h3><span class="coop-heading-icon" aria-hidden="true">▤</span>공개 서버 목록</h3>'+action('coop-refresh','↻ 새로고침')+'</div><div id="coop-servers" class="public-server-list"><p>서버 목록 연결 중…</p></div></section><section id="server-preview" class="gdg-section"><h3>현재 서버 정보</h3><p>서버 선택 대기 중</p></section></div>'+note+'<div class="panel-actions"><button id="server-quick" class="primary" data-action="coop-quick" disabled>빠른 참가</button><button id="server-join" class="secondary" data-action="coop-join-selected" disabled>서버 참가</button>'+action('back','뒤로')+'</div>','멀티플레이','GDG / ONLINE SHIFT');
  refreshServers();
 }else{
  const isHost=snap.host===snap.you,roster='<section class="gdg-section coop-lobby-roster"><h3>현재 팀 정보</h3>'+coopSlots(snap.players.length,snap.players,snap.you,snap.host)+'</section>';
  panel('coop','<div class="coop-code">'+serverName(snap.room)+'</div><p>접속 작업자 '+snap.players.length+' / 4</p>'+roster+teamGoals(snap.players.length)+'<section class="gdg-section shift-lobby-difficulty"><h3>근무 난이도 · 화물 '+(snap.quota??cargoQuota(snap.players.length))+'개</h3>'+difficultyChoices(isHost?coop.chosenDifficulty??snap.difficulty?.level??'normal':snap.difficulty?.level??'normal','coop',!isHost)+'<small>'+(isHost?'방장이 난이도를 선택합니다.':'방장이 난이도를 선택 중입니다.')+'</small></section>'+note+'<div class="panel-actions">'+(isHost?'<button class="primary" data-action="coop-start" '+(snap.players.length<2?'disabled':'')+'>협동 근무 시작</button>':'')+action('coop-leave','서버 목록으로')+'</div>','협동 대기실','GDG / ONLINE SHIFT');
 }
 if($('#coop-notice'))$('#coop-notice').textContent=coopError||(snap?'방장만 시작 가능 · 최소 2명':'공개 서버 상태를 확인합니다.');
}
function coopMessage(e){coopError=e.message||String(e);if(pane==='coop'&&$('#coop-notice'))$('#coop-notice').textContent=coopError;else if(mode==='game')say(coopError,3);}
async function coopConnect(id){
 if(coopBusy||coop?.running||!PUBLIC_SERVERS.some(s=>s.id===id))return;
 const field=$('#coop-nickname'),nickname=normalizeNickname(field?.value??coopNickname);
 if(!nickname){coopMessage(new Error('닉네임을 2~12자로 입력하세요.'));field?.focus();return;}
 coopNickname=nickname;try{localStorage.setItem('gdg.nickname',nickname);}catch{}
 stopServerList();coopBusy=true;coopError='';
 for(const b of document.querySelectorAll('.public-server'))b.disabled=true;
 if($('#coop-notice'))$('#coop-notice').textContent=serverName(id)+'에 참가하는 중…';
 const client=new CoopClient(snap=>{if(coop===client)onCoopState(snap);},coopMessage,coopInput);coop=client;
 try{await client.connect('enter',id,nickname);if(coop!==client){client.leave();return;}if(pane==='coop')coopLobby();}
 catch(e){if(coop===client){coop=null;coopMessage(e);}}
 finally{coopBusy=false;if(pane==='coop'&&!coop)refreshServers();}
}
function disconnectCoop(){clearSpectator();stopServerList();if(!coop)return;const client=coop;coop=null;client.leave();if(coopStarting)session=soloSession;soloSession=null;coopStarting=false;coopEnding=false;coopEventSeq=0;coopError='';const badge=$('#coop-team');if(badge)badge.hidden=true;}
function teamResult(snap){
 clearSpectator();
 if(coopEnding&&pane==='coopresult')return;coopEnding=true;if(mode==='game')pauseShift(false);
 const won=snap.phase==='complete',done=snap.states.filter(x=>x==='DELIVERED').length;
 panel('coopresult',resultMarkup(snap,won,snap.players.filter(p=>!p.failed).length)+'<div class="panel-actions">'+action('coop-leave','메인으로',true)+'</div>',won?'팀 근무 완료':'팀 근무 실패','GDG / COOPERATIVE RESULT');
}
function returnCoopLobby(){
 clearSpectator();cancelAnimationFrame(raf);mode='menu';releaseGameInput();if(document.pointerLockElement===canvas)document.exitPointerLock();session=soloSession;soloSession=null;coopStarting=false;coopEnding=false;coopEventSeq=0;finishAt=null;$('#loading').hidden=true;$('#play').hidden=true;$('#briefing').hidden=false;$('#coop-team').hidden=true;coopError='팀원 이탈로 근무 준비가 취소되었습니다. 다시 시작하세요.';coopLobby();
}
function onCoopState(snap){
 const wasDown=!!session?.failed;
 if(snap.phase==='lobby'){if(coopStarting){if(mode!=='loading')returnCoopLobby();return;}if(mode==='menu'&&pane==='coop'){const key=JSON.stringify([snap.host,snap.you,snap.players.map(p=>[p.id,p.name,p.ready,p.failed]),snap.quota,snap.difficulty?.level,coop?.chosenDifficulty]);if(coop.lobbyKey!==key){coop.lobbyKey=key;coopLobby();}}return;}
 if(!coopStarting&&mode==='menu'&&['loading','playing'].includes(snap.phase)){
  coopStarting=true;coopEnding=false;coopEventSeq=0;soloSession=session;session=newShift();applyCoopSnapshot(session,snap,true);$('#modal').hidden=true;$('#start').click();
 }else if(coopStarting&&session){const old=posePoint(session),wasHidden=session.coopHidden;applyCoopSnapshot(session,snap);if(wasDown!==!!session.failed||wasHidden!==session.coopHidden||Math.hypot(...posePoint(session).map((v,i)=>v-old[i]))>.45)session.renderPrevious=null;if(pane==='map'&&$('#live-map')){const markers=$('#live-map .gdg-map-markers');if(markers)markers.innerHTML=mapMarkersNow();else $('#live-map').innerHTML=plan();textIfChanged($('#facility-progress'),'배송 '+deliveryCount(session)+' / '+missionTotal(session)+' · '+sectorName(session));}}
 if(!coopStarting||!session)return;
 const me=snap.players.find(p=>p.id===snap.you),team=$('#coop-team');
 if(team){team.hidden=false;textIfChanged(team,'CO-OP '+serverName(snap.room)+' · '+difficultyLabel(snap.difficulty?.level)+' · 생존 '+snap.players.filter(p=>!p.failed).length+'/'+snap.players.length+' · 개체 '+snap.haunt.length+'/'+snap.difficulty.maxActive+'\n'+snap.players.map(p=>p.name+(p.id===snap.you?' (나)':'')+(p.failed?' · 구조 대기':p.hidden?' · 은신':' · 생존')).join('\n'));}
 for(const event of snap.events??[]){if(event.seq<=coopEventSeq)continue;coopEventSeq=event.seq;
  if(event.type==='haunt'){(session.hauntSounds??=[]).push(event);}
  else if(event.type==='revive'){beep(520,.22,'sine',.1);say(event.player===snap.you?'부활 완료 · 3초 보호':'팀원 구조 완료',3);}
  else if(event.type==='anomaly'){beep(event.phase==='start'?58:180,.35,'triangle',.12);say(event.message,4);}
  else if(event.type==='notice'&&(!event.player||event.player===snap.you))say(event.message,3);
  else if(event.type==='power'){beep(180,.12,'triangle',.06);say(event.message,3);}
  else if(event.type==='signal'&&event.player===snap.you){beep(240,.3,'triangle',.07);say('유인 신호 전송 · 12초 대기',2.5);}
  else if(event.type==='door'&&event.player===snap.you)beep(112,.19,'triangle',.08);
  else if(event.type==='cargo'&&event.player===snap.you){beep(event.result==='delivered'?620:235,.12);say(event.id+' · '+(event.result==='delivered'?'팀 배송 완료':event.result==='picked'?'집화 완료':'임시 적치 완료'),2.5);}
 }
 if(['complete','failed'].includes(snap.phase)&&['game','paused'].includes(mode)){teamResult(snap);return;}
 if(wasDown&&!me?.failed){clearSpectator();if(mode==='paused')resume();else if(mode==='game'){canvas.focus();lock();}say('부활 완료 · 3초 보호',3);}
 if(me?.failed&&!wasDown&&['game','paused'].includes(mode)){keys.clear();jump=false;coop?.inputChanged();beginSpectator();}
}
function panel(name,body,title,eyebrow='GDG / 근무 안내'){
 pane=name;const modal=$('#modal'),nav=$('#paneNav');modal.dataset.pane=name;modal.dataset.context=mode==='menu'?'menu':'game';$('#eyebrow').textContent=eyebrow;$('#paneTitle').textContent=title;$('#paneBody').innerHTML=body;
 const menuNav=mode==='menu'&&['manual','settings','quit','coop'].includes(name)&&!(name==='coop'&&coop?.snapshot),pauseNav=name==='pause';
 modal.dataset.layout=menuNav?'menu':pauseNav?'pause':'single';modal.dataset.shiftArt=String(['difficulty','cargo','anomalies','map','complete','coopresult'].includes(name)||(name==='coop'&&!!coop?.snapshot));
 nav.hidden=!(menuNav||pauseNav);
 if(!nav.hidden){
 const buttons=menuNav?[['solo-start','싱글 모드',''],['coop','멀티 모드',''],['manual','조작 방법','manual'],['settings','설정','settings'],['quit','종료','quit']]:[['resume','계속하기',''],['manual','조작 방법','manual'],['settings','설정','settings'],['map','구역 지도',''],['brief','메인 메뉴',''],['quit','게임 종료','quit']];
 nav.innerHTML='<img src="assets/interface/wordmark.webp" alt="GDG">'+(pauseNav?'<div class="nav-pause-label">일시 정지 Ⅱ</div>':'<img class="pane-tagline" src="assets/interface/tagline.webp" alt="배송 임무를 수행하세요">')+buttons.map(([id,label,art])=>'<button class="pane-nav-button '+(id===name||id==='resume'?'chosen':'')+' '+(['solo-start','coop','resume'].includes(id)?'yellow':'')+'" '+(id==='quit'?'data-pane="quit"':'data-action="'+id+'"')+' aria-label="'+label+'">'+(art?'<img src="assets/interface/'+art+'.webp" alt="">':label)+'</button>').join('');
 }
 if(name==='manual')decorateManual($('#paneBody'));
 modal.hidden=false;const scroller=modal.querySelector('.panel');if(scroller)scroller.scrollTop=0;nav.scrollTop=0;$('#close').focus({preventScroll:true});
}
function openPane(name){
 if(mode==='game'){pauseShift(false);}
 if(pane==='coop'&&name!=='coop'&&!coopStarting)disconnectCoop();
 if(name==='coop'){coopLobby();return;}
 if(name==='cargo'){panel(name,cargoGuide()+'<div class="panel-actions">'+action('back','확인',true)+'</div>','특수 화물 발생','GDG / SPECIAL CARGO');return;}
 if(name==='anomalies'){panel(name,anomalyGuide()+'<div class="panel-actions">'+action('back','계속',true)+'</div>','이상현상 감지','GDG / EVENT WARNING');return;}
 if(name==='quit')panel(name,'<div class="quit-center"><div class="warning-symbol">!</div><h3>정말 게임을 종료하시겠습니까?</h3><p>현재 근무가 종료됩니다. 협동 중에는 서버에서 퇴장합니다.</p><div class="panel-actions">'+action('brief','메인 메뉴로')+action('quit','게임 종료',true)+action('back','취소')+'</div></div>','게임 종료','GDG / 야간 근무');
 if(name==='manual')panel(name,
 '<div class="survival-manual"><p>GDG 상자(싱글 30개, 2인 40개, 3인 50개, 4인 70개)를 한 개씩 가까운 출고대로 운반하세요. 가까이 다가가 노란 조준 표시가 생기면 E로 집고, 출고대에서 E로 배송합니다.</p>'+
 '<h3>01 / 기본 조작</h3>'+rows.map(([k,l])=>'<div class="row"><span>'+l+'</span><kbd>'+k+'</kbd></div>').join('')+
 '<h3>02 / 특수 화물 및 이상 현상</h3><p>소음 화물은 주기적으로 소리를 내고, 중량 화물은 이동 속도가 감소합니다. 긴급 화물은 첫 집화 후 70초를 넘기면 소음이 발생하며, 격리 화물은 강한 이상 신호를 냅니다. 정전 시 비상등과 손전등을 이용하세요. 모든 화물은 지연되어도 배송할 수 있습니다.</p>'+
 '<h3>03 / 은신 방법</h3><article class="creature-guide"><h4>철제 사물함 <small>LOCKER / 12곳</small></h4><p>상자를 내려놓고 사물함 정면에서 E를 눌러 문을 엽니다. 너무 가까우면 뒤로 물러나 다시 E를 누르세요. 문이 완전히 열리면 W로 내부 중앙까지 들어간 뒤 E로 문을 닫습니다.</p><p>문이 닫히면 자동으로 문 쪽을 바라봅니다. 실제 가로 통풍구 사이로 귀신을 관찰할 수 있으며 마우스로 시점을 움직일 수 있습니다. Q로 손전등을 끄고 기다리세요. 귀신은 문 앞을 약 4.5~6.5초 조사하고 다른 통로로 떠납니다. 소등하지 않으면 더 오래 머물 수 있습니다. 충분히 멀어진 것을 확인하고 E로 문을 열어 W로 나가세요. 너무 빨리 열면 다시 추격당할 수 있습니다.</p></article><p><b>C를 누른 채 W A S D로 이동</b>하여 빈 선반 아래, 상자 뒤 또는 SERVICE / LOW CLEARANCE 표시가 붙은 낮은 은신처 안으로 들어가세요. C를 놓으면 머리 위 공간이 충분할 때 일어납니다. 낮은 은신처는 별도의 상호작용 키 없이 들어갑니다.</p>'+
 '<p>구조물이 귀신과 나 사이의 시야를 가리게 하고, Q로 손전등을 끄세요. 움직임을 멈추면 발소리를 줄일 수 있습니다. 달리기, 점프 착지, 상자 집기·내려놓기는 소음을 발생시킵니다. 앉아 있다고 무적이 되는 것은 아닙니다.</p>'+
 '<h3>03 / 추격 및 피신</h3><p>귀신은 마지막으로 본 위치와 소리를 기억합니다. 은신처 입구를 확인하고 떠나는 척 다시 돌아올 수도 있습니다. 발소리가 멀어졌다고 바로 뛰어나오지 마세요. 추격을 끊으려면 시야를 차단한 채 거리를 충분히 벌리거나 지정된 높은 피신 지점으로 이동하세요.</p>'+
 '<p>각 구역의 SERVICE PLATFORM은 실제 계단을 W로 걸어 올라갑니다. 아래쪽 공간이나 LOW ACCESS 선반은 C로 들어가 숨을 수 있습니다. 일반 적재물은 W + SPACE로 넘어가세요. 상층 피신 지점도 적재귀에게는 안전하지 않을 수 있습니다.</p><p>발판을 향해 W + SPACE로 직접 점프하세요. 자동 넘기 모션 없이 공중에서도 이동 방향을 제어할 수 있습니다. B-12 상층 선반과 C-02 폐기물 처리동, D-04 격리실험동의 ESCAPE DECK은 지정 피신 지점입니다. 해당 발판 중앙에 착지하면 일반 지상 추격을 끊을 수 있지만, 적재귀는 C-02와 D-04 발판의 계단을 따라 올라올 수 있습니다. 모든 높은 물체가 안전한 것은 아닙니다.</p>'+
 '<p>새 귀신은 '+SPAWN_BALANCE.minDistance+'~'+SPAWN_BALANCE.maxDistance+'m 거리의 가려진 위치에서 등장하며 '+SPAWN_BALANCE.grace+'초 동안 추격과 공격을 시작하지 않습니다. 관제실 경고와 방향성 위협음을 듣고 도주 경로를 확보하세요. 기존 귀신에게 붙잡히면 즉시 근무 실패입니다.</p>'+
 '<h3>04 / 개체별 생존 공략</h3>'+
 '<article class="creature-guide"><h4>녹령 <small>빛 회피형</small></h4><p>평상시 시야를 끊고 조용히 이동하세요. 발견되면 Q로 손전등을 켜 몸을 직접 비추면 물러납니다. 빛을 떼면 다시 추격하므로 그 사이 우회로 또는 높은 피신 지점으로 이동하세요. 빛만 켜 놓는 것은 방어가 아닙니다.</p></article>'+
 '<article class="creature-guide"><h4>함귀 <small>소음 추적형</small></h4><p>네 개체 중 소음 감도가 가장 높습니다. 가까이 있을 때 달리기와 상자 조작을 피하고 C로 천천히 이동하세요. 직접 비춘 빛에 더 빨라지므로 손전등을 끄고 구조물 뒤로 시야를 끊으세요. 한 번 숨었다고 안심하지 마세요.</p></article>'+
 '<article class="creature-guide"><h4>적재귀 <small>고속 돌진형</small></h4><p>기본 추격 속도가 가장 빠르고 공격 준비 거리도 깁니다. 정면에서 맞서거나 직선으로만 도망치지 말고 선반과 기둥을 돌아 거리를 벌리세요. 손전등은 오히려 자극합니다. 적재귀는 낮은 상자·작업 발판과 폐기물동·격리동의 ESCAPE DECK까지 느리게 따라 올라옵니다. 높은 곳은 시간을 버는 수단입니다. 올라오는 동안 반대편으로 내려가거나 철제 사물함에 숨으세요.</p></article>'+
 '<article class="creature-guide"><h4>표찰귀 <small>화물 반응형</small></h4><p>직접 비춘 손전등 빛으로 일시적으로 물러나게 할 수 있습니다. 표찰귀가 약 4m 이내에 있을 때 운반 중인 상자를 E로 정상적으로 내려놓으면 사라집니다. 배송 완료가 아닌 임시 적치이며, 내려놓을 공간이 필요합니다. 너무 가까워지기 전에 행동하세요. 격리동에서는 천장 이동 및 하강도 주의하세요.</p></article>'+
 '<h3>05 / 협동 근무</h3><p>메인 메뉴에서 멀티플레이를 선택하고 닉네임(2~12자)을 입력한 뒤 공개 서버 01~03 중 원하는 서버에 참가합니다. 초대 코드는 필요하지 않습니다. 2명 이상 입장하면 방장이 시작할 수 있습니다. 2인 40개, 3인 50개, 4인 70개의 화물을 나눠 배송합니다. 방장은 모든 인원에서 대기실 난이도를 선택합니다. 근무 시작 이후 목표량은 변경되지 않고, 한 명이 사망하면 생존 팀원을 3인칭 관전하며 Q/E 또는 좌우 방향키로 전환합니다. 생존 팀원은 벽을 투과하는 구조 실루엣을 따라가 E를 2.5초 유지해 부활시킬 수 있습니다. 인원이 늘면 동시에 활동하는 개체 수, 감지 범위, 소음 추적, 수색 지속 시간이 증가합니다. 협동 중 ESC는 개인 메뉴만 열며 서버 시간은 계속 흐릅니다.</p><h3>06 / 지도 및 이동 팁</h3><p>구역 지도의 파란 사각형은 낮은 은신처 입구, 금색 사각형은 철제 사물함, 초록 원은 지정 피신 지점입니다. ESC → 구역 지도로 확인할 수 있습니다. 마우스가 고정되지 않으면 왼쪽 버튼을 누른 채 드래그하거나 방향키로 시점을 돌리세요.</p></div>'+
 '<div class="panel-actions">'+action('cargo','특수 화물 안내')+action('anomalies','이상 현상 안내')+action('map','구역 지도')+'</div>'+links,'조작 방법 및 공략','WORK 모드 / 근무자 생존 매뉴얼');
 if(name==='map'){
 const n=session?deliveryCount(session):0;
 panel(name,'<p>현재 위치, 실제 창고 구조, 배송 화물과 숨는 공간을 확인하세요.</p><div class="facility-map-layout"><section id="live-map" class="gdg-section">'+plan()+'</section>'+mapLegendArt()+'</div><div class="facility-footer"><span id="facility-progress">배송 '+n+' / '+missionTotal(session)+' · '+sectorName(session)+'</span><span>정전 중에는 지도를 더 자주 확인하세요.</span></div><div class="panel-actions">'+action('back','닫기',true)+'</div>','물류창고 전체 지도','GDG / MAP OVERLAY');
 }
 if(name==='settings'){
 const toggle=(k,l)=>'<div class="row"><span>'+l+'</span><button class="toggle '+(settings[k]?'on':'')+'" data-toggle="'+k+'">'+(settings[k]?'켜기':'끄기')+'</button></div>';
 const range=(id,label,val,min,max,step,display)=>'<label class="row setting-range"><span>'+label+'</span><input id="'+id+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"><output id="'+id+'Val">'+display+'</output></label>';
 panel(name,'<div class="settings-grid"><section class="gdg-section"><h3>'+icon('screen')+' 그래픽</h3><small>그래픽 품질</small><div class="presets">'+['HIGH','BALANCED','PERFORMANCE'].map(q=>'<button class="preset '+(q===settings.quality?'active':'')+'" data-quality="'+q+'">'+({HIGH:'높음',BALANCED:'균형',PERFORMANCE:'성능'}[q])+'</button>').join('')+'</div>'+range('brightness','밝기',settings.brightness,.65,1.45,.05,Math.round(settings.brightness*100)+'%')+range('scale','렌더 해상도',settings.scale,.55,1,.05,Math.round(settings.scale*100)+'%')+'</section><section class="gdg-section"><h3>'+icon('sound')+' 오디오</h3>'+range('volume','전체 음량',settings.volume,0,1,.05,Math.round(settings.volume*100)+'%')+toggle('audio','게임 소리')+'</section><section class="gdg-section"><h3>'+icon('pad')+' 조작</h3>'+range('sens','마우스 감도',settings.sensitivity,.4,1.8,.1,settings.sensitivity.toFixed(1)+'×')+toggle('invert','상하 시점 반전')+'</section><section class="gdg-section"><h3>'+icon('gear')+' 게임</h3>'+toggle('motion','걸을 때 시점 흔들림')+toggle('hints','조작 힌트 / 미니맵')+'<p>설정값은 즉시 적용되며 이 브라우저에 저장됩니다.</p></section></div><div class="panel-actions">'+action('back','적용 및 뒤로',true)+'</div>','설정','SECTOR B / 환경 설정');
 }
 if(name==='pause'){
 const n=deliveryCount(session),t=telemetry(session,!!closedLocker(session));
 panel(name,'<section class="gdg-section"><h3>현재 상황</h3><div class="row"><span>현재 섹터</span><b>'+sectorName(session)+'</b></div><div class="row"><span>임무 진행도</span><b>'+n+' / ' +missionTotal(session)+'</b></div>'+progressBar(n,missionTotal(session))+'<div class="row"><span>플레이 시간</span><b>'+clock(session.elapsed)+'</b></div><div class="row"><span>난이도</span><b>'+difficultyLabel(session.difficultyLevel)+'</b></div><div class="row"><span>근무 모드</span><b>'+(coopStarting?'협동 · '+(coop?.snapshot?.players?.filter(p=>!p.failed).length??0)+'명 생존':'싱글')+'</b></div><div class="row"><span>위협 상태</span><b>'+t.danger+'</b></div></section><section class="gdg-section paper-note"><h3>주요 목표</h3><p>□ 지정 화물 찾기</p><p>□ 가까운 출고대에 배송 · '+n+' / ' +missionTotal(session)+'</p><p>□ 괴물을 피하며 생존</p>'+(coopStarting?'<p>※ 협동 근무는 메뉴에서도 계속 진행됩니다.</p>':'')+'</section>','일시 정지','GDG / 대기 중');
 }
}
function closePane(){if(mode==='menu'&&['cargo','anomalies'].includes(pane)){soloDifficulty();return;}if(pane==='coop'&&!coopStarting){disconnectCoop();$('#modal').hidden=true;pane='';$('#start').focus();return;}if(pane==='coopresult'){return;}if(mode==='paused'&&session?.failed&&coopStarting){beginSpectator();return;}if(mode==='paused'&&pane!=='pause'&&pane!=='complete'){openPane('pause');return;}if(mode==='paused'&&pane==='pause'){resume();return;}if(pane==='complete'||pane==='failed'){toMenu();return;}$('#modal').hidden=true;pane='';$('#start').focus();}
function toMenu(){
 if(coop)disconnectCoop();
 canvas.classList.remove('captured');
 cancelAnimationFrame(raf);mode='menu';keys.clear();jump=false;drag=false;pane='';
 for(const id of ['#modal','#play','#loading','#ended'])$(id).hidden=true;
 $('#briefing').hidden=false;
 const continuing=!!session&&!session.failed&&deliveryCount(session)<missionTotal(session);
 $('#start .resume-label').hidden=!continuing;
 $('#start').setAttribute('aria-label',continuing?'싱글플레이 이어서 근무':'싱글플레이');
 $('#start').focus();audioOn();
}
function clockOut(){
 if(coop)disconnectCoop();
 cancelAnimationFrame(raf);keys.clear();jump=false;drag=false;session=null;finishAt=null;mode='ended';pane='';
 $('#modal').hidden=true;$('#briefing').hidden=true;$('#play').hidden=true;$('#ended').hidden=false;
 $('#ended button').focus();if(document.pointerLockElement===canvas)document.exitPointerLock();audioOn();
}
function releaseGameInput(){keys.clear();jump=false;drag=false;coop?.inputChanged();if(session){session.renderPrevious=null;session.slideRequested=false;}accumulator=0;last=performance.now();}
function pauseShift(show=true){if(mode!=='game')return;mode='paused';releaseGameInput();cancelAnimationFrame(raf);if(document.pointerLockElement===canvas)document.exitPointerLock();audioOn();if(show)openPane('pause');}
async function lock(){if(grabbing||document.pointerLockElement===canvas)return;grabbing=true;try{await canvas.requestPointerLock();}catch{}finally{grabbing=false;}}
function resume(){if(session?.failed&&coopStarting){beginSpectator();return;}if(!renderer||session?.failed)return;canvas.classList.remove('captured');mode='game';pane='';$('#modal').hidden=true;$('#briefing').hidden=true;$('#play').hidden=false;canvas.focus();lock();audioOn();last=performance.now();accumulator=0;session.renderPrevious=null;cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
function clearSpectator(){spectateId=null;spectateCamera=null;$('#play')?.classList.remove('spectating');const h=$('#spectator-hud');if(h)h.hidden=true;const m=$('#rescue-markers');if(m)m.replaceChildren();}
function beginSpectator(){
 if(!renderer||!session?.failed||!coopStarting)return;
 mode='game';pane='';keys.clear();jump=false;accumulator=0;$('#modal').hidden=true;$('#play').hidden=false;$('#play').classList.add('spectating');$('#spectator-hud').hidden=false;$('#target-brackets').hidden=true;$('#waypoint').hidden=true;$('#hud-locker').hidden=true;$('#play').classList.remove('locker-ui','threat-ui');canvas.classList.remove('captured');
 if(document.pointerLockElement===canvas)document.exitPointerLock();audioOn();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
}
function switchSpectator(direction){const p=spectatorTarget(coop?.snapshot?.players,coop?.snapshot?.you,spectateId,direction);if(p){spectateId=p.id;spectateCamera=null;}}
function updateRescueMarkers(s,eye){
 const host=$('#rescue-markers');if(!host)return;
 const players=coopStarting?coop?.snapshot?.players??[]:[],seen=new Set();
 for(const p of players){if(!p.failed||p.id===coop?.snapshot?.you)continue;seen.add(p.id);let el=[...host.children].find(n=>n.dataset.player===p.id);if(!el){el=document.createElement('div');el.dataset.player=p.id;el.className='rescue-marker';const icon=document.createElement('b');icon.textContent='✚';const label=document.createElement('span');el.append(icon,label);host.append(el);}
  const d=Math.round(Math.hypot(p.x-eye[0],p.y-eye[1],p.z-eye[2])),clip=renderer.project([p.x,p.y+.85,p.z]);el.hidden=!clip||Math.abs(clip[0])>1.02||Math.abs(clip[1])>1.02;if(!el.hidden){el.style.transform='translate('+((clip[0]+1)*50/100*host.clientWidth)+'px,'+((1-clip[1])*50/100*host.clientHeight)+'px) translate(-50%,-100%)';textIfChanged(el.lastElementChild,p.name+' · 구조 '+d+'m');}
 }
 for(const el of [...host.children])if(!seen.has(el.dataset.player))el.remove();
}
function spectateFrame(now,dt){
 const s=session,snap=coop?.snapshot,p=spectatorTarget(snap?.players,snap?.you,spectateId);if(!p){raf=requestAnimationFrame(frame);return;}
 spectateId=p.id;const visual=remoteAt(coop.remoteTracks.get(p.id),now,true)??p;
 const observed={...visual,id:p.id,hidden:p.hidden};spectateCamera=spectatorCamera(observed,worlds[0].blocks,spectateCamera,dt,lockerDoorBlocks(s));
 const {eye,view}=spectateCamera;interpolateCoopHaunt({...s,x:observed.x,z:observed.z},dt,now);
 s.coopVisualClock=(s.coopVisualClock??s.elapsed)+dt;
 const lighting=eventLighting(s),actors=peerLayers(coop,observed,dt,TEAM_WORKER_GROUP,p.id);
 const pose={hands:[],actors:[...hauntLayers(s,name=>renderer?.skins?.has(name)),...lockerLayers(s,LOCKER_DOOR_GROUP),...actors],rescueActors:rescueLayers(snap.players,snap.you,TEAM_WORKER_GROUP),spectating:true,clock:s.coopVisualClock,gridPower:lighting.power,zonePowers:zonePowers(s),localPower:zonePower(s,observed.x,observed.z),flashlight:0,lowCostShadow:true,adaptiveLite:(s.adaptiveScale??1)<=.70};
 renderer.render(eye,view,parcelPositions(s,-1,Boolean(renderer.gl)),pose,settings.scale*Math.min(.85,s.adaptiveScale??1));
 updateRescueMarkers(s,eye);textIfChanged($('#spectator-name'),p.name+(p.hidden?' · 은신 중':''));textIfChanged($('#delivered'),deliveryCount(s)+' / '+missionTotal(s));textIfChanged($('#taskLine'),'팀원 구조 대기 · 3인칭 관전');textIfChanged($('#hud-sector'),sectorName(observed));
 if(now-(s.lastCoopHud??-1000)>=150){s.lastCoopHud=now;updateHud({...s,...observed,failed:false},false,deliveryCount(s),missionTotal(s),plan,now,settings.hints,mapMarkersNow,worlds[0].blocks);}
 if(s.hauntSounds)s.hauntSounds.length=0;
 raf=requestAnimationFrame(frame);
}
const painted=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function reportProgress(value,label){
 const percent=Math.round(value*100);
 $('#progress').setAttribute('aria-valuenow',percent);
 $('#progress').style.setProperty('--pct',percent+'%');
 $('#load-detail').textContent=label+'  ·  '+percent+'%';
}
async function load(){
 const layout=expandedLayout(session?.difficultyLevel??settings.difficulty)?'hard':'normal';
 if(renderer&&setupPromise&&renderLayout!==layout){await setupPromise;worlds=sceneFor(layout);reportProgress(.12,'난이도별 창고 배치');await painted();if(renderer.setWorld)renderer.setWorld(worlds[0]);else await renderer.prepare(rigs(worlds),(value,label)=>reportProgress(.12+.78*value,label));renderLayout=layout;return;}
 if(!setupPromise)setupPromise=(async()=>{
  worlds=sceneFor(layout);reportProgress(.12,'창고 배치 완료');await painted();
  try{renderer=new Renderer(canvas);}
  catch(error){
   if(!error.message.startsWith('WebGL 2 is unavailable'))throw error;
   const {SoftwareRenderer}=await import('./software.js');renderer=new SoftwareRenderer(canvas);
  }
  await renderer.prepare(rigs(worlds),(value,label)=>reportProgress(.12+.78*value,label),sceneFor('hard')[0]);
  renderer.setQuality(settings.quality);renderLayout=layout;
 })();
 await setupPromise;
}
let soloConfirmed=false;
$('#start').onclick=async()=>{
 if(mode!=='menu')return;
 if(coop&&!coopStarting)disconnectCoop();
 if(!coopStarting&&!soloConfirmed){soloDifficulty();return;}soloConfirmed=false;$('#modal').hidden=true;pane='';
 const b=$('#start');b.disabled=true;mode='loading';$('#briefing').hidden=true;$('#loading').hidden=false;
 $('#loading-quota').textContent='목표: 배송 상자 '+(coopStarting?(coop?.snapshot?.quota??coop?.snapshot?.states?.length??30):30)+'개 완료';
 try{
  audioOn();reportProgress(0,'구역 준비 중');await painted();
  if(!coopStarting&&(!session||session.failed||deliveryCount(session)===missionTotal(session))){session=newShift(Math.random,settings.difficulty);finishAt=null;receiptUntil=0;}
  if(coopStarting&&coop?.snapshot){applyCoopSnapshot(session,coop.snapshot,true);finishAt=null;receiptUntil=0;}
  await load();
  if(coopStarting&&coop?.snapshot?.phase==='lobby'){returnCoopLobby();return;}
  reportProgress(.96,'첫 화면 준비 중');$('#play').hidden=false;
  const eye=[session.x,session.y+CONFIG.eye,session.z],facing=forward(session);
  const pose=choreography(session,eye,false,false,false,session.elapsed);
  // Prime each creature's GPU draw path under the loading screen, not on a jump scare.
  if(renderer.gl&&!renderer.hauntPrimed){
   for(let kind=0;kind<4;kind++){
    pose.actors=hauntLayers({...session,haunt:[{kind,x:eye[0]+facing[0]*3,z:eye[2]+facing[2]*3,yaw:0,phase:1,age:1,speed:2,aggression:.5,state:'alert'}]});
    renderer.render(eye,facing,[],pose,.55);await painted();
   }
   renderer.gl.finish();renderer.hauntPrimed=true;pose.actors=[];
  }
  pose.actors=[...hauntLayers(session),...lockerLayers(session,LOCKER_DOOR_GROUP)];
  renderer.render(eye,facing,parcelPositions(session,pose.hidden,Boolean(renderer.gl)),pose,settings.scale);
  reportProgress(1,'출근 준비 완료');await painted();
  $('#loading').hidden=true;if(coopStarting&&coop){if(coop.snapshot?.phase==='lobby'){returnCoopLobby();return;}await coop.action('ready');if(coop.snapshot?.phase==='lobby'){returnCoopLobby();return;}}resume();say(coopStarting?'팀원 준비 확인 중 · 공동 배송 근무':'GDG 표식이 있는 상자를 가까운 출고대로 운반하세요.',4);
 }catch(error){
  setupPromise=null;renderer=null;renderLayout=null;toMenu();
  panel('error','<p id="errorText"></p><div class="panel-actions">'+action('retry','다시 시도',true)+'</div>','구역 진입 실패');
  $('#errorText').textContent='창고를 준비하지 못했습니다. '+error.message;
 }finally{b.disabled=false;}
};
function failShift(name){
 const delivered=deliveryCount(session),total=missionTotal(session),elapsed=session.elapsed,sector=sectorName(session);
 mode='failed';keys.clear();jump=false;drag=false;cancelAnimationFrame(raf);finishAt=null;
 if(document.pointerLockElement===canvas)document.exitPointerLock();
 beep(69,.55,'sawtooth',.12);audioOn();
 session=null;$('#play').hidden=true;
 panel('failed','<div class="failure-art-stage"><img class="failure-art-image" src="assets/interface/shift-art/failure-art.webp" alt="임무 실패 · 작업자 신호가 소실되었습니다."><div class="failure-value fv1">'+delivered+' / '+total+'</div><div class="failure-value fv2">'+Math.floor(elapsed/60)+'분 '+Math.floor(elapsed%60)+'초</div><div class="failure-value fv3">'+sector+'</div><div class="failure-value fv4">'+escapeNickname(name)+'에게 포획됨</div><button class="failure-hit retry-hit" data-action="retry" aria-label="다시 시도"></button><button class="failure-hit home-hit" data-action="brief" aria-label="메인 메뉴"></button><button class="failure-hit close-hit" data-action="brief" aria-label="닫기"></button></div>','임무 실패','GDG / GAME OVER');
}
function complete(){pauseShift(false);beep(630,.3);panel('complete',resultMarkup(session,true,1)+'<div class="panel-actions">'+action('retry','다음 근무',true)+action('brief','메인으로')+action('resume','창고 둘러보기')+'</div>','근무 완료','GDG / SHIFT RESULT');}
let receiptUntil=0;
function use(target=null,locked=false){
 if(coopStarting&&coop){coop.command('use');return;}
 const staticBlocks=worlds[0].blocks,blocks=staticBlocks.concat(lockerDoorBlocks(session));
 if(!locked&&!closedLocker(session)){const panel=powerTarget(session,blocks);if(panel){const e=toggleZone(session,panel);say(e.message,3);beep(180,.12,'triangle',.06);return;}}
 if(!locked&&!session.handAction&&!session.pendingUse){const l=lockerTarget(session,staticBlocks);if(l&&session.carried<0){const result=useLocker(session,l);if(result==='opening'||result==='closing'){beep(112,.19,'triangle',.08);if(result==='closing')session.lockerLook={yaw:session.yaw,pitch:session.pitch,t:0};}else if(result==='step-back')say('문이 열릴 공간이 필요합니다. 한 걸음 물러서서 E를 누르세요.',2.5);else if(result==='enter-first')say('문이 열린 상태입니다. 내부 중앙으로 들어가 E를 누르세요.',2.5);return;}}
 target??=handlingTarget(session,blocks);
 if(session.handAction||session.pendingUse||!canUse(session,target,blocks,locked))return;
 // Match the server: lock the valid interaction immediately instead of waiting for torch stow.
 if(beginHandling(session,target,blocks,locked))beep(235,.07,'sine',.035);
}
function onHandling(result,now,id){
 if(session.restoreTorch){session.flashlight=true;session.restoreTorch=false;}
 if(result==='cancelled'){say('작업이 중단됐습니다. 상자나 출고대를 향해 다시 시도하세요.',2);return;}
 if(result==='dropped'){beep(195,.11);say(id+' 임시 적치 완료. 다시 집어 배송할 수 있습니다.',2);return;}
 if(result==='picked'){beep(295,.13);say(id+' 집화 완료. 가까운 출고대로 운반하세요.',3);return;}
 if(result==='delivered'){
  const n=deliveryCount(session);beep(620,.18);$('#receipt').hidden=false;
  $('#receipt').textContent='✓ 배송 완료  ·  ' +n+' / '+missionTotal(session);receiptUntil=now+1750;
  say(n===missionTotal(session)?'오늘 야간 근무의 배송이 모두 끝났습니다.':n%5===0?'경고: 미확인 개체의 활동이 증가합니다. 남은 화물 '+(missionTotal(session)-n)+'개.':id+' 배송 확인. 잔여 '+(missionTotal(session)-n)+'개.',3);
  if(n===missionTotal(session)){$('#delivered').textContent=n+' / '+n;finishAt=session.elapsed+1.25;}
 }
}
let finishAt=null;
const areaNames={'Employee intake':'직원 입고대','Storage cross aisle':'보관 통로','Conveyor sorting':'컨베이어 분류대','Upper catwalk':'상층 캣워크','Loading aisle':'하역 통로','Outbound dispatch':'02번 출고대','Annex freight':'C-01 적재 화물','Annex rack':'C-01 선반','High storage':'B-12 상층 선반','Transfer hall':'D-02 이송동','Returns hall':'D-03 반품동','Waste processing':'C-02 폐기물 처리동','Containment lab':'D-04 격리실험동','Oversize freight':'E-01 대형 화물동','Night reserve':'E-02 야간 예비창고'};
function targetCorners(pos,dock){
 const w=dock?1.25:CONFIG.parcelWidth/2,h=dock?.12:CONFIG.parcelWidth*.88,d=dock?.82:CONFIG.parcelWidth*.41;
 const points=[];for(const x of [-w,w])for(const y of [0,h])for(const z of [-d,d]){
  const pt=renderer.project([pos[0]+x,pos[1]+y,pos[2]+z]);if(!pt)return null;points.push(pt);
 }
 const xx=points.map(p=>(p[0]+1)*50),yy=points.map(p=>(1-p[1])*50);
 return [Math.min(...xx),Math.min(...yy),Math.max(...xx)-Math.min(...xx),Math.max(...yy)-Math.min(...yy)];
}
const textIfChanged=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
function frame(now){if(mode!=='game')return;const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(.067,rawDt);last=now;const s=session;if(document.hidden){accumulator=0;s.renderPrevious=null;raf=requestAnimationFrame(frame);return;}if(coopStarting&&s.failed){spectateFrame(now,dt);return;}
 if(keys.has('ArrowLeft'))s.yaw+=dt*1.65;if(keys.has('ArrowRight'))s.yaw-=dt*1.65;if(keys.has('ArrowUp'))s.pitch=Math.min(CONFIG.pitchLimit,s.pitch+dt);if(keys.has('ArrowDown'))s.pitch=Math.max(-CONFIG.pitchLimit,s.pitch-dt);
 const was=s.steps;const tick=1/(coopStarting?60:PHYSICS.hz);if(coopStarting&&coop?.snapshot?.phase!=='playing'){accumulator=0;s.renderPrevious=null;s.vx=s.vz=s.vy=0;}else if(s.encounterHit){keys.clear();jump=false;s.vx=s.vz=s.vy=0;accumulator=0;s.renderPrevious=null;}else{const budget=frameBudget(rawDt,accumulator,tick);for(let i=0;i<budget.steps;i++){s.renderPrevious=posePoint(s);step(s,keys,worlds[0].blocks,tick,jump);jump=false;}accumulator=budget.remainder;}
 const doors=lockerDoorBlocks(s),dynamic=parcelBlocks(s).concat(doors).filter(b=>b[0]<s.x+3&&b[2]>s.x-3&&b[1]<s.z+3&&b[3]>s.z-3);const interactionBlocks=nearbyBlocks(worlds[0].blocks,s.x,s.z).concat(doors.filter(b=>b[0]<s.x+3&&b[2]>s.x-3&&b[1]<s.z+3&&b[3]>s.z-3));
 if(coopStarting&&coop?.snapshot?.phase==='playing'){const before=posePoint(s);advanceCoopPrediction(s,worlds[0].blocks,dynamic,dt,now);s.renderPrevious=shiftPrevious(s.renderPrevious,before,posePoint(s));}
 equipmentClearance(s,worlds[0].blocks,dt,dynamic);
 if(s.lockerLook){const a=s.lockerLook;a.t=Math.min(1,a.t+dt/.44);const t=a.t*a.t*(3-2*a.t);s.yaw=a.yaw+Math.atan2(Math.sin(-a.yaw),Math.cos(-a.yaw))*t;s.pitch=a.pitch*(1-t);if(a.t>=1)s.lockerLook=null;}updateViewmodel(s,dt);
 if(s.pendingUse&&s.flashAmount===0){const target=s.pendingUse;s.pendingUse=null;use(target.drop?dropTarget(s,interactionBlocks):target,true);if(!s.handAction&&s.restoreTorch){s.flashlight=true;s.restoreTorch=false;}}
 if(s.grounded&&Math.floor(s.steps/1.12)>Math.floor(was/1.12))beep(95,.08,'sine',.04);
 if(s.zoneScare){const zone=s.zoneScare;s.zoneScare=null;if(zone==='lab'||zone==='waste'){beep(zone==='lab'?64:43,.42,'triangle',.095);if(zone==='lab')say('경고: 격리 설비의 접근 제한이 해제되었습니다.',2.6);}}
 const moving=s.steps>was+.002;const bob=settings.motion&&moving&&s.grounded?Math.sin(s.steps*5.5)*.014:0;
 const active=s.handAction;
 if(active&&!coopStarting){const result=advanceHandling(s,interactionBlocks,dt);if(result)onHandling(result,now,active.target.id);}
 if(!coopStarting){pruneSignals(s);const event=tickShiftEvents(s);if(event){beep(event.phase==='start'?58:180,.35,'triangle',.12);say(event.message,4);}}
 const signal=s.cargoSignalAt;if(Number.isFinite(signal)&&signal!==s.lastRenderedSignal&&s.carried>=0){s.lastRenderedSignal=signal;beep(s.cargo?.[s.carried]?.special==='cursed'?47:142,.25,'triangle',.07);}
 const facing=forward(s);
 let threat=null;if(coopStarting){interpolateCoopHaunt(s,dt,now);}else{const hauntSteps=Math.max(1,Math.ceil(dt*60));for(let k=0;k<hauntSteps&&!threat;k++)threat=updateHaunt(s,worlds[0].blocks,facing,dt/hauntSteps);}
 if(threat){canvas.classList.remove('captured');failShift(threat);return;}
 if(s.encounterHit&&!canvas.classList.contains('captured')){canvas.classList.add('captured');beep([130,83,48,190][s.encounterHit.kind]??69,.38,'sawtooth',.17);}
 for(const event of s.hauntSounds??[]){
  if(event.spawnWarning&&event.initial)say('⚠ 귀신 출현! 도주 경로를 확보하십시오.',2.5);
  if(!settings.audio||!sound||settings.volume<=0)continue;
  const dx=event.x-s.x,dz=event.z-s.z,d=Math.max(1,Math.hypot(dx,dz));
  const pan=sound.createStereoPanner(),gain=sound.createGain(),voice=sound.createOscillator();
  pan.pan.value=Math.max(-1,Math.min(1,(dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw))/d));
  voice.type=['sine','triangle','sine','sawtooth'][event.kind];
  const f=[208,86,52,307][event.kind]*(event.spawnWarning?1.12:event.accent?1.35:1),now=sound.currentTime;
  voice.frequency.setValueAtTime(f,now);voice.frequency.exponentialRampToValueAtTime(f*.53,now+(event.spawnWarning?.28:.16));
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime((event.spawnWarning?.75:.42)/(1+d*.52),now+.018);
  gain.gain.exponentialRampToValueAtTime(.0001,now+(event.spawnWarning?.38:.2));
  voice.connect(gain).connect(pan).connect(master);voice.start();voice.stop(now+(event.spawnWarning?.39:.21));
  voice.onended=()=>{voice.disconnect();gain.disconnect();pan.disconnect();};
 }
 if(s.hauntSounds)s.hauntSounds.length=0;
 const l=lockerTarget(s,interactionBlocks),hiddenLocker=closedLocker(s);
 const useTarget=handlingTarget(s,interactionBlocks),available=!hiddenLocker&&canUse(s,useTarget,interactionBlocks);
 const target=s.carried<0&&available?useTarget:nextTarget(s);
 const eyeHeight=(s.bodyHeight??1.70)-.12;
 s.viewHeight=eyeHeight<(s.viewHeight??eyeHeight)?eyeHeight:(s.viewHeight??eyeHeight)+(eyeHeight-(s.viewHeight??eyeHeight))*(1-Math.exp(-dt*19));
 const renderAt=renderPosition(s,s.renderPrevious,accumulator/tick);
 const eye=[renderAt[0],renderAt[1]+s.viewHeight+bob-(settings.motion?(s.landKick??0)*.4:0),renderAt[2]];
 const view=facing;
 const visualTime=coopStarting?(s.coopVisualClock??s.elapsed):s.elapsed;
 const pose=choreography(s,eye,available,moving,keys.has('ShiftLeft')||keys.has('ShiftRight'),visualTime,view);
 pose.actors=[...hauntLayers(s,name=>renderer?.skins?.has(name)),...lockerLayers(s,LOCKER_DOOR_GROUP),...(hiddenLocker?[]:workerLegLayers(s)),...peerLayers(coop,s,dt,TEAM_WORKER_GROUP)];pose.rescueActors=coopStarting?rescueLayers(coop?.snapshot?.players,coop?.snapshot?.you,TEAM_WORKER_GROUP):[];pose.clock=visualTime;const lighting=eventLighting(s);pose.gridPower=lighting.power;pose.zonePowers=zonePowers(s);pose.localPower=zonePower(s,s.x,s.z);if(s.flashlight&&s.elapsed<(s.signalPulseUntil??0))pose.flashlight=(pose.flashlight??0)*(1.25+.25*Math.sin(s.elapsed*5));
 if(hiddenLocker){pose.hands=[];if(Math.floor(s.elapsed*1.6)>Math.floor((s.elapsed-dt)*1.6)&&s.haunt.some(a=>Math.hypot(a.x-s.x,a.z-s.z)<8))beep(43,.15,'sine',.055);}
 // Hysteresis: lower render resolution only after sustained slow frames.
 const frameMs=Math.min(150,rawDt*1000);s.frameAverage=(s.frameAverage??16.7)*.90+frameMs*.10;
 if(s.frameAverage>24){s.slowFrames=(s.slowFrames??0)+1;s.fastFrames=0;}else if(s.frameAverage<17.6){s.fastFrames=(s.fastFrames??0)+1;s.slowFrames=0;}else{s.slowFrames=0;s.fastFrames=0;}
 if((s.slowFrames??0)>=(s.frameAverage>45?4:10)&&now-(s.lastScaleChange??-2000)>(s.frameAverage>45?650:1200)){s.adaptiveScale=Math.max(coopStarting?.50:.65,(s.adaptiveScale??1)-(s.frameAverage>45?.15:.10));s.slowFrames=0;s.lastScaleChange=now;}
 if((s.fastFrames??0)>=240&&now-(s.lastScaleChange??-1000)>2500){s.adaptiveScale=Math.min(1,(s.adaptiveScale??1)+.05);s.fastFrames=0;s.lastScaleChange=now;}
 pose.lowCostShadow=(s.adaptiveScale??1)<.85;pose.adaptiveLite=(s.adaptiveScale??1)<=.70||s.frameAverage>45&&s.slowFrames>=3;
 renderer.render(eye,view,parcelPositions(s,pose.hidden,Boolean(renderer.gl)),pose,settings.scale*(s.adaptiveScale??1));
 if(coopStarting)updateRescueMarkers(s,eye);
 if(s.showTraversal||document.querySelector('#traversal-debug'))drawTraversalDebug(s,worlds[0].blocks,renderer,pose,eye,view);
 const mark=$('#waypoint'),p=$('#prompt'),brackets=$('#target-brackets');
 let msg=s.climbHint>s.elapsed?'높은 선반에 오르려면 E로 상자를 내려놓으세요.':'';brackets.hidden=true;mark.hidden=true;
 const blackout=s.shiftEvents?.active?.kind==='blackout';
 if(target&&!s.handAction){
  const distance=Math.hypot(s.x-target.pos[0],s.y-target.pos[1],s.z-target.pos[2]);const pt=target.pos.slice();pt[1]+=target.dock?1.05:.83;
  const clip=renderer.project(pt),label=target.dock?'출고 '+target.id.slice(-2):target.id;
  if(!blackout&&clip&&Math.abs(clip[0])<.92&&Math.abs(clip[1])<.84){mark.hidden=false;mark.style.left=(clip[0]+1)*50+'%';mark.style.top=(1-clip[1])*50+'%';textIfChanged(mark,'◆ '+label+' · '+Math.round(distance)+' m');}
  else msg=blackout?'정전 · 전체 지도(M)에서 목표 확인':label+' / '+areaNames[target.area]+' · '+Math.round(distance)+' m';
  if(available){
   msg='<kbd>E</kbd> '+(useTarget.dock?'배송하기':useTarget.drop?'상자 내려놓기':'상자 들기');
   const box=targetCorners(useTarget.pos,useTarget.dock);
   if(box){brackets.hidden=false;['left','top','width','height'].forEach((k,i)=>brackets.style[k]=box[i]+'%');}
  }
 }
 if(s.handAction)msg=s.handAction.placing?'상자 내려놓는 중':'상자 드는 중';
 if(l&&!s.handAction&&s.carried<0){msg=lockerPrompt(s,l);brackets.hidden=true;if(hiddenLocker){msg='은신 중 · 문틈 관찰 / Q 소등 / E 열기';mark.hidden=true;}}
 const powerPanel=hiddenLocker?null:powerTarget(s,interactionBlocks);if(powerPanel){msg='<kbd>E</kbd> '+powerPanel.name+' 전력 '+(s.powerZones?.[powerPanel.id]===false?'복구':'차단');brackets.hidden=true;}
 if(coopStarting&&coop?.snapshot){const me=coop.snapshot.players.find(a=>a.id===coop.snapshot.you),down=findReviveTarget(s,coop.snapshot.players,interactionBlocks,coop.snapshot.you,me?.reviveTarget);if(down&&!hiddenLocker){const percent=Math.min(100,Math.floor((me?.reviveProgress??0)/REVIVE_SECONDS*100));msg='<kbd>E</kbd> 2.5초 유지 · '+escapeNickname(down.name)+' 구조 '+percent+'%<span style="display:block;height:4px;background:#48392a;margin-top:5px"><i style="display:block;height:100%;width:'+percent+'%;background:#ffbb54"></i></span>';brackets.hidden=true;}}
 if(document.pointerLockElement!==canvas&&!drag&&!s.failed)msg='화면 클릭 · 마우스 고정 재개'+(msg?' | '+msg:'');
 textIfChanged($('#torch-status'),'Q · 손전등 '+(s.flashlight?'ON':'OFF')+' · F '+(signalReady(s)>0?Math.ceil(signalReady(s))+'초':'신호')+(s.shiftEvents?.active?' · '+(s.shiftEvents.active.kind==='blackout'?'정전':'전파 간섭'):''));if(p.innerHTML!==msg)p.innerHTML=msg;textIfChanged($('#delivered'),deliveryCount(s)+' / '+missionTotal(s));
 textIfChanged($('#carry-status span'),s.handAction?(s.handAction.placing?'내려놓는 중':'드는 중'):s.carried>=0?(s.flashlight?'한 손 운반 중':'운반 중'):'빈손');
 const special=specialLabel(s,s.carried>=0?s.carried:target?.index??-1);
 textIfChanged($('#taskLine'),(target?(target.dock?shiftParcel(s,s.carried).id+' → '+target.id+' 출고대':target.id+' · '+(areaNames[target.area]??'')):'전체 배송 완료')+(special?' · '+special:''));
 const directions=['N','NE','E','SE','S','SW','W','NW'];const bearing=((Math.round(-s.yaw*180/Math.PI)%360)+360)%360;
 textIfChanged($('#heading'),directions[Math.round(bearing/45)%8]+'  '+String(bearing).padStart(3,'0')+'°');
 if(now-(s.lastCoopHud??-1000)>=80){s.lastCoopHud=now;updateHud(s,!!hiddenLocker,deliveryCount(s),missionTotal(s),plan,now,settings.hints,mapMarkersNow,worlds?.[0]?.blocks);}
 if(coopStarting){s.netFrameMs=(s.netFrameMs??frameMs)*.94+frameMs*.06;if(now-(s.lastNetInfo??-1000)>600){s.lastNetInfo=now;const team=$('#coop-team');if(team){team.dataset.connection=coop?.connectionState??'connected';team.title=(coop?.connectionState==='recovering'?'연결 복구 중 · ':coop?.connectionState==='expired'?'연결 만료 · ':'')+'FPS '+Math.round(1000/Math.max(1,s.netFrameMs))+' · 서버 응답 '+Math.round(coop?.rtt??0)+' ms · 갱신 간격 '+Math.round(coop?.snapshotGap??0)+' ms · 강제 보정 '+(s.netHardCorrections??0)+'회';}}}
 if(now>radioUntil)textIfChanged($('#radio'),'');if(now>receiptUntil)$('#receipt').hidden=true;
 if(!coopStarting&&finishAt!==null&&s.elapsed>=finishAt){finishAt=null;complete();return;}
 raf=requestAnimationFrame(frame);
}
document.addEventListener('keydown',e=>{
 if(e.code==='Enter'&&!$('#modal').hidden&&pane==='coop'&&!coop&&document.activeElement?.id==='coop-nickname'){e.preventDefault();if(selectedServer)coopConnect(selectedServer);return;}
 if(e.code==='Escape'){if(e.repeat)return;e.preventDefault();if(mode==='game'){pauseShift();}else if(!$('#modal').hidden){closePane();}return;}
 if(mode==='game'&&blockGameplayShortcut(e)){e.preventDefault();e.stopPropagation();return;}
 if(mode!=='game')return;if(coopStarting&&session?.failed){if(['ArrowLeft','ArrowRight','KeyA','KeyD','KeyQ','KeyE','Space'].includes(e.code)){e.preventDefault();if(!e.repeat)switchSpectator(['ArrowLeft','KeyA','KeyQ'].includes(e.code)?-1:1);}else if(e.code==='KeyM'&&!e.repeat){session.mapExpanded=!session.mapExpanded;$('#play').classList.toggle('map-expanded',session.mapExpanded);}return;}if(['Space','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyC','ShiftLeft','ShiftRight','ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
 if(e.code==='KeyM'){e.preventDefault();if(!e.repeat){session.mapExpanded=!session.mapExpanded;$('#play').classList.toggle('map-expanded',session.mapExpanded);}return;}
 if(e.code==='F3'){e.preventDefault();if(!e.repeat)session.showTraversal=!session.showTraversal;return;}
 if(e.code==='KeyV'){e.preventDefault();if(!e.repeat){session.slideRequested=true;if(coopStarting&&coop)coop.command('slide');}return;}
 if(e.code==='KeyF'){e.preventDefault();if(!e.repeat){if(coopStarting&&coop)coop.command('signal');else if(!closedLocker(session)&&emitSignal(session,session,worlds[0].blocks.concat(lockerDoorBlocks(session)))){beep(240,.3,'triangle',.07);say('유인 신호 전송 · 12초 대기',2.5);}else say(signalReady(session)>0?'유인 신호 재사용 대기 중':'손전등을 켜고 열린 공간을 조준하세요.',2);}return;}
 if(e.code==='KeyQ'&&!e.repeat){if(coopStarting&&coop){coop.command('torch');return;}if(session.handAction){session.restoreTorch=!session.restoreTorch;return;}if(toggleFlashlight(session)){session.pendingUse=false;session.restoreTorch=false;beep(180,.055,'triangle',.025);}else say('상자를 집거나 내려놓는 동안에는 장비 전환을 할 수 없습니다.',2);return;}if(e.code==='KeyE'&&!e.repeat){if(coopStarting&&coop){keys.add('KeyE');coop.inputChanged();}use();return;}if(e.code==='Space'&&!e.repeat){jump=true;if(coopStarting&&coop)coop.command('jump');}const changed=!keys.has(e.code);keys.add(e.code);if(changed&&coopStarting&&coop&&['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space'].includes(e.code))coop.inputChanged();
});document.addEventListener('keyup',e=>{const changed=keys.delete(e.code);if(changed&&coopStarting&&coop)coop.inputChanged();});
canvas.addEventListener('wheel',e=>{if(mode==='game'){e.preventDefault();if(session?.failed){switchSpectator(e.deltaY>0?1:-1);return;}jump=true;if(coopStarting&&coop)coop.command('jump');}},{passive:false});
function pointer(e){if(mode!=='game'||session?.failed||(document.pointerLockElement!==canvas&&!drag)||performance.now()<lookReady)return;session.yaw-=mouseDelta(e.movementX,settings.sensitivity);session.yaw=Math.atan2(Math.sin(session.yaw),Math.cos(session.yaw));session.pitch=Math.max(-CONFIG.pitchLimit,Math.min(CONFIG.pitchLimit,session.pitch-mouseDelta(e.movementY,settings.sensitivity)*(settings.invert?-1:1)));}
document.addEventListener('mousemove',pointer);canvas.addEventListener('mousedown',e=>{if(mode==='game'&&!session?.failed&&e.button===0){e.preventDefault();canvas.focus({preventScroll:true});drag=true;lock();}});document.addEventListener('mouseup',()=>drag=false);
// Browser focus/pointer lock loss is not an intentional menu action.
 document.addEventListener('pointerlockchange',()=>{lookReady=performance.now()+65;if(document.pointerLockElement!==canvas&&mode==='game'&&!session?.failed)releaseGameInput();});window.addEventListener('blur',()=>{if(mode==='game')releaseGameInput();});document.addEventListener('visibilitychange',()=>{if(mode==='game')releaseGameInput();});canvas.addEventListener('contextmenu',e=>e.preventDefault());
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
 const a=b.dataset.action;if(a==='spectate-prev'||a==='spectate-next'){switchSpectator(a==='spectate-prev'?-1:1);return;}if(a?.startsWith('solo-difficulty-')){settings.difficulty=normalizeDifficulty(a.slice(16));persist();soloDifficulty();return;}if(a?.startsWith('coop-difficulty-')){if(coop){coop.chosenDifficulty=normalizeDifficulty(a.slice(16));coop.action('difficulty',{level:coop.chosenDifficulty});}return;}if(a==='solo-confirm'||a==='solo-continue'){if(a==='solo-confirm')session=null;soloConfirmed=true;$('#modal').hidden=true;$('#start').click();return;}if(a?.startsWith('coop-select-')){selectedServer=a.slice(12);drawServerList(visibleServers);return;}if(a==='coop-join-selected'){if(selectedServer)coopConnect(selectedServer);return;}if(a==='coop-quick'){const s=visibleServers.filter(v=>v.joinable).sort((a,b)=>b.count-a.count)[0];if(s)coopConnect(s.id);return;}if(a==='back'){closePane();return;}if(a==='solo-start'){disconnectCoop();$('#modal').hidden=true;pane='';$('#start').click();return;}if(a==='coop-refresh'){refreshServers();return;}if(a==='coop-start'){coop?.action('start',{level:coop.chosenDifficulty??coop.snapshot?.requestedDifficulty??'normal'});return;}if(a==='coop-leave'){const was=coopStarting;disconnectCoop();if(was)toMenu();else coopLobby();return;}if(a==='quit')clockOut();else if(a==='retry'){toMenu();$('#start').click();}else if(a==='reload')location.reload();else if(a==='resume'){resume();}else if(a==='brief')toMenu();else if(a)openPane(a);
});
$('#modal').addEventListener('input',e=>{if(e.target.id==='coop-nickname'){coopNickname=e.target.value;return;}if(e.target.id==='brightness'||e.target.id==='volume'){settings[e.target.id]=Number(e.target.value);$('#'+e.target.id+'Val').textContent=Math.round(settings[e.target.id]*100)+'%';audioOn();}else if(e.target.id==='scale'){settings.scale=Number(e.target.value);$('#scaleVal').textContent=Math.round(settings.scale*100)+'%';}else if(e.target.id==='sens'){settings.sensitivity=Number(e.target.value);$('#sensVal').textContent=settings.sensitivity.toFixed(1)+'×';}persist();});

if(/^[A-Z2-9]{6}$/.test(new URLSearchParams(location.search).get('room')??''))openPane('coop');
