import {MOTION_VERSION,MOTION_HZ,MAX_MOTION_BATCH,unpackMotion} from '../dist/motion-input.js';
import {roomConnectionTimeout} from '../dist/public-servers.js';
import {DIFFICULTIES,normalizeDifficulty,effectiveDifficulty,cargoQuota,difficultyLabel} from '../dist/difficulty.js';
// Authoritative room simulation. All clients share one cargo list, one ghost
// director and one door state. Clients send controls, never claimed deliveries.
import {randomBytes} from 'node:crypto';
import {createShiftEvents,tickShiftEvents} from '../dist/shift-events.js';
import {normalizeNickname} from '../dist/nickname.js';
import {acknowledgeWarnings} from '../dist/threat-warning.js';
import {powerTarget,toggleZone,emitSignal,pruneSignals} from '../dist/facility-actions.js';
import {expandedLayout} from '../dist/map-layout.js';
import {createScene,newShift,randomCargo,step,forward,handlingTarget,pickupTargetByIndex,canUse,dropTarget,deliveryCount,MISSION_TOTAL,parcelBlocks} from '../dist/mission.js';
import {beginHandling,advanceHandling,toggleFlashlight,updateViewmodel} from '../dist/handling.js';
import {advanceLockers,lockerDoorBlocks,lockerTarget,useLocker,insideLocker,closedLocker,LOCKERS} from '../dist/lockers.js';
import {nearbyBlocks,traceBox} from '../dist/contact.js';
import {updateHaunt,teamDifficulty} from '../dist/haunt.js';
export const ROOM_TTL=7200,MAX_PLAYERS=4;
const keysAllowed=new Set(['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space','KeyE']);
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand=(n=18)=>randomBytes(n).toString('hex');
export const roomCode=()=>Array.from(randomBytes(6),b=>alphabet[b%alphabet.length]).join('');
export class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const check=(ok,msg,status=400)=>{if(!ok)throw new RoomError(msg,status);};
const scenes=new Map();
const world=room=>{const k=expandedLayout(room?.shared)?'hard':'normal';if(!scenes.has(k))scenes.set(k,createScene(k)[0]);return scenes.get(k);};
const spawns=[[1.7,15],[.7,15],[2.7,15],[1.7,16.1]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const publicPlayer=p=>({id:p.id,name:p.name,ready:p.ready,failed:!!p.state.failed,reviveProgress:p.reviveProgress??0,reviveTarget:p.reviveTarget??null,hidden:!!closedLocker(p.state),x:p.state.x,y:p.state.y,z:p.state.z,yaw:p.state.yaw,pitch:p.state.pitch,bodyHeight:p.state.bodyHeight??1.7,steps:p.state.steps,carried:p.state.carried,flashlight:!!p.state.flashlight,vx:p.state.vx,vy:p.state.vy,vz:p.state.vz,grounded:p.state.grounded!==false,vault:!!p.state.vault});
const sharedKeys=['cargo','states','parked','deliveryOrder','deliveryBays','lockers','lockerRevision','horrorEvent','cargoDeadlines','shiftEvents','powerZones','signals'];
function attach(room,p){
 const s=p.state,q=room.shared;q.powerZones??={};q.signals??={};q.cargoDeadlines??={};q.deliveryBays??={};for(const k of sharedKeys)s[k]=q[k];
 s.difficultyLevel=q.difficultyLevel??'normal';s.elapsed=q.elapsed;s.skipLockerAdvance=true;s.id=p.id;return s;
}
function detach(p){for(const k of sharedKeys)delete p.state[k];delete p.state.hauntSounds;delete p.state.teamView;delete p.state.placementWorkers;}
function pushEvent(room,e){room.eventSeq++;room.events.push({...e,seq:room.eventSeq});if(room.events.length>28)room.events.shift();}
function addPlayer(room,now,nickname){
 const used=new Set(Object.values(room.players).map(p=>p.slot));const slot=[0,1,2,3].find(n=>!used.has(n));check(slot!==undefined,'최대 4명까지 입장할 수 있습니다.',409);
 const name=nickname===undefined?'WORKER '+String(slot+1).padStart(2,'0'):normalizeNickname(nickname);
 check(name,'닉네임은 한글, 영문, 숫자 등 2~12자로 입력하세요.');
 check(!Object.values(room.players).some(p=>p.name.toLowerCase()===name.toLowerCase()),'같은 서버에 이미 사용 중인 닉네임입니다.',409);
 const id=rand(6),token=rand(24),state=newShift();
 const [x,z]=spawns[slot];Object.assign(state,{x,z,bodyHeight:1.7,carried:-1,id,elapsed:0});
 const p={id,token,slot,name,state,ready:false,lastSeen:now,lastInputAt:now,lastInputSeq:0,input:{keys:[],yaw:state.yaw,pitch:state.pitch},commandSeq:0,jump:false};
 detach(p);room.players[id]=p;if(!room.host)room.host=id;return p;
}
export function createRoom(code,now=Date.now(),nickname){
 const room={code,phase:'lobby',requestedDifficulty:'normal',host:null,players:{},shared:{cargo:randomCargo(Math.random),cargoDeadlines:{},shiftEvents:createShiftEvents(),states:Array(MISSION_TOTAL).fill('AVAILABLE'),parked:{},deliveryOrder:[],deliveryBays:{},lockers:{},lockerRevision:0,elapsed:0,haunt:[],hauntSounds:[],hauntDirector:{delay:9,bag:[]}},events:[],eventSeq:0,lastTick:now,updatedAt:now};
 const p=addPlayer(room,now,nickname);return {room,player:p};
}
const live=room=>Object.values(room.players).filter(p=>!p.state.failed);
function dropOwned(room,p){
 const s=attach(room,p);if(s.carried>=0){const i=s.carried,blocks=world(room).blocks.concat(lockerDoorBlocks(s)),t=dropTarget(s,blocks);if(t)room.shared.parked[i]=t.pos.slice();else delete room.shared.parked[i];room.shared.states[i]='AVAILABLE';s.carried=-1;room.shared.horrorEvent={type:'drop',time:room.shared.elapsed};}detach(p);
}
function removePlayer(room,p){
 dropOwned(room,p);if(room.shared.signals)delete room.shared.signals[p.id];delete room.players[p.id];if(room.host===p.id)room.host=Object.keys(room.players)[0]??null;
 if(!Object.keys(room.players).length)room.phase='closed';
 if(room.phase==='loading'&&Object.values(room.players).length<2){room.phase='lobby';for(const a of Object.values(room.players))a.ready=false;}
}
function prune(room,now){
 for(const p of Object.values(room.players))if(now-p.lastSeen>roomConnectionTimeout(room.phase))removePlayer(room,p);
}
function canStart(room,now){
 if(room.phase==='loading'&&Object.keys(room.players).length>=2&&Object.values(room.players).every(p=>p.ready)){
  room.phase='playing';for(const p of Object.values(room.players))p.lastInputAt=now;room.lastTick=now;room.fraction=0;room.simDebt=0;room.shared.elapsed=0;pushEvent(room,{type:'notice',message:difficultyLabel(room.shared.difficultyLevel)+' · 팀 화물 '+room.shared.states.length+'개 배송 시작.'});
 }
}
function syncShared(room,p){const s=p.state,q=room.shared;if(s.lockerRevision!==q.lockerRevision)q.lockerRevision=s.lockerRevision;if(s.horrorEvent&&s.horrorEvent!==q.horrorEvent)q.horrorEvent=s.horrorEvent;}
import {REVIVE_SECONDS,REVIVE_RANGE,findReviveTarget} from '../dist/revive.js';
export {REVIVE_SECONDS,REVIVE_RANGE};
function reviveTarget(room,p){const s=p.state;if(s.failed||closedLocker(s))return null;
 const blocks=nearbyBlocks(world(room).blocks,s.x,s.z).concat(lockerDoorBlocks(s));
 const players=Object.values(room.players).map(a=>({...a.state,id:a.id}));const target=findReviveTarget(s,players,blocks,p.id,p.reviveTarget);return target?room.players[target.id]:null;
}
function tickRevives(room,active,now,dt){
 const claimed=new Set();
 for(const p of active){const s=p.state,age=now-(p.lastInputAt??now),held=p.input.keys.includes('KeyE')||!!p.reviveHeld;const t=held&&age<=1100?reviveTarget(room,p):null;
  if(!t||claimed.has(t.id)){p.reviveTarget=null;p.reviveProgress=0;continue;}claimed.add(t.id);
  if(s.handAction&&!s.handAction.result){s.handAction=null;s.pendingUse=null;if(s.restoreTorch){s.flashlight=true;s.restoreTorch=false;}}
  if(age>650)continue;
  if(p.reviveTarget!==t.id){p.reviveTarget=t.id;p.reviveProgress=0;}
  p.reviveProgress=(p.reviveProgress??0)+dt;
  if(p.reviveProgress+1e-8>=REVIVE_SECONDS){
   Object.assign(t.state,{failed:false,capturedBy:null,handAction:null,pendingUse:null,vault:null,vx:0,vy:0,vz:0,jumpBuffer:0,slideTime:0,slideExit:0,slideRequested:false,hopBoosted:false,threatWarnings:{},hitProtectedUntil:room.shared.elapsed+3});
   t.input.keys=[];t.reviveHeld=false;t.jump=false;t.motionEpoch=(t.motionEpoch??1)+1;t.motionAck=0;t.motionCredit=12;t.motionCreditAt=now;t.reviveProgress=0;t.reviveTarget=null;p.reviveProgress=0;p.reviveTarget=null;
   pushEvent(room,{type:'revive',player:t.id,by:p.id});
  }
 }
}
function command(room,p,cmd){
 if(!cmd||!Number.isSafeInteger(cmd.seq)||cmd.seq<=p.commandSeq||cmd.seq>p.commandSeq+128)return;
 p.commandSeq=cmd.seq;
 const s=attach(room,p),q=room.shared;
 if(s.failed||room.phase!=='playing'){detach(p);return;}
 const staticBlocks=world(room).blocks,blocks=staticBlocks.concat(lockerDoorBlocks(s));
 if(cmd.type==='jump'&&!p.motionMode)p.jump=true;
 if(cmd.type==='slide'&&!p.motionMode)s.slideRequested=true;
 if(cmd.type==='signal'&&!closedLocker(s)){const signal=emitSignal(s,q,blocks);if(signal)pushEvent(room,{type:'signal',player:p.id,x:signal.x,z:signal.z});else pushEvent(room,{type:'notice',player:p.id,message:'F 신호 · 손전등을 켜고 열린 공간을 조준하세요 (12초 재사용 대기).'});}
 if(cmd.type==='torch'){if(!s.handAction)toggleFlashlight(s);}
 if(cmd.type==='use'&&reviveTarget(room,p)){p.reviveHeld=p.input.keys.includes('KeyE');if(s.handAction&&!s.handAction.result){s.handAction=null;s.pendingUse=null;}}
 else if(cmd.type==='use'&&!s.handAction&&!s.pendingUse){
  const l=lockerTarget(s,staticBlocks),panel=powerTarget(s,blocks);
  if(panel&&!closedLocker(s)){pushEvent(room,{...toggleZone(s,panel,q),player:p.id});}
  else if(l&&s.carried<0){
   const other=live(room).some(a=>a!==p&&insideLocker(a.state,l));
   if(!other){const result=useLocker(s,l);if(result==='closing'){s.yaw=0;s.pitch=0;p.input.yaw=0;p.input.pitch=0;}if(result==='opening'||result==='closing')pushEvent(room,{type:'door',x:l.x,z:l.z,player:p.id});else if(result==='step-back')pushEvent(room,{type:'notice',player:p.id,message:'문이 열릴 공간이 필요합니다. 한 걸음 물러서세요.'});}
   else pushEvent(room,{type:'notice',player:p.id,message:'다른 작업자가 사용하는 사물함입니다.'});
  }else {s.placementWorkers=live(room).filter(a=>a!==p).map(a=>a.state);const explicit=Number.isSafeInteger(cmd.cargoIndex)&&s.carried<0;const t=explicit?pickupTargetByIndex(s,cmd.cargoIndex):handlingTarget(s,blocks);if(canUse(s,t,blocks)){s.restoreTorch=s.flashlight;beginHandling(s,t,blocks);}else if(explicit)pushEvent(room,{type:'notice',player:p.id,message:'상자 집기 실패 · 상자가 이동했거나 거리/시야가 맞지 않습니다.'});}
 }
 syncShared(room,p);detach(p);
}
function simulateWorker(room,p,blocks,dt,keys,jump,active){
 const s=p.state;
 step(s,keys,blocks,dt,jump);
 updateViewmodel(s,dt);
 if(s.handAction){
  s.placementWorkers=active.filter(a=>a!==p).map(a=>a.state);const id=s.handAction.target.id,result=advanceHandling(s,blocks.concat(lockerDoorBlocks(s)),dt);delete s.placementWorkers;
  if(result){if(s.restoreTorch){s.flashlight=true;s.restoreTorch=false;}if(result!=='cancelled')pushEvent(room,{type:'cargo',result,id,player:p.id});else pushEvent(room,{type:'notice',player:p.id,message:'상자 작업 중단 · 다시 조준하고 E를 누르세요.'});}
 }
 syncShared(room,p);
}
function applyMotionBatch(room,p,motion,commands,now){
 if(!p.motionMode){p.motionMode=true;p.motionAck=0;p.motionCredit=24;p.motionCreditAt=now;p.jump=false;p.state.slideRequested=false;}
 p.motionCredit=Math.min(72,(p.motionCredit??0)+Math.max(0,now-(p.motionCreditAt??now))*MOTION_HZ/1000);p.motionCreditAt=now;
 const frames=Array.isArray(motion.frames)?motion.frames.slice(0,MAX_MOTION_BATCH):[],list=Array.isArray(commands)?commands.slice(0,16):[];
 let ci=0;const blocks=world(room).blocks,active=live(room);
 const flush=()=>{while(ci<list.length){
  const cmd=list[ci];if(!cmd||!Number.isSafeInteger(cmd.seq)||cmd.seq<=p.commandSeq){ci++;continue;}
  if(Number.isSafeInteger(cmd.motionTick)&&cmd.motionTick>(p.motionAck??0))break;
  // Use the view sampled when E was pressed, not a later mouse position.
  if(cmd.type==='use'&&Number.isFinite(cmd.yaw)&&Number.isFinite(cmd.pitch)){p.state.yaw=clamp(cmd.yaw,-1e4,1e4);p.state.pitch=clamp(cmd.pitch,-1.3,1.3);}
  command(room,p,cmd);ci++;
 }};
 flush();
 for(const raw of frames){
  const frame=unpackMotion(raw);if(!frame)break;
  if(frame.seq<=(p.motionAck??0))continue;
  if(frame.seq!==(p.motionAck??0)+1||p.motionCredit<1-1e-6)break;
  const s=attach(room,p);s.yaw=frame.yaw;s.pitch=frame.pitch;if(frame.slide)s.slideRequested=true;
  simulateWorker(room,p,blocks,1/MOTION_HZ,frame.keys,frame.jump,active);detach(p);
  p.motionAck=frame.seq;p.motionCredit=Math.max(0,p.motionCredit-1);flush();
 }
 p.state.yaw=p.input.yaw;p.state.pitch=p.input.pitch;
}
export function tickRoom(room,now=Date.now()){
 now=Math.max(now,room.lastTick??now);
 prune(room,now);canStart(room,now);
 const wallDelta=Math.max(0,(now-room.lastTick)/1000);room.lastTick=now;
 if(room.phase!=='playing'){room.simDebt=0;return;}
 // Carry a bounded short delay forward instead of silently losing simulation time.
 // Never run an unbounded catch-up loop after a disconnected/backgrounded client.
 const due=Math.min(.70,wallDelta+Math.max(0,room.simDebt??0)),delta=Math.min(.40,due);
 room.simDebt=Math.max(0,due-delta);if(!delta)return;
 const q=room.shared,players=live(room);q.cargoDeadlines??={};q.shiftEvents??=createShiftEvents();if(!players.length){room.phase='failed';return;}
 const blocks=world(room).blocks,dt=1/60,ticks=Math.min(24,Math.floor(delta/dt+(room.fraction??0)));
 room.fraction=Math.min(.99,Math.max(0,delta/dt+(room.fraction??0)-ticks));
 for(let k=0;k<ticks;k++){
  const active=live(room);if(!active.length){room.phase='failed';break;}
  const ss=active.map(p=>attach(room,p));advanceLockers(q,dt,ss);
  for(const p of active){
   const s=attach(room,p);const stale=now-(p.lastInputAt??p.lastSeen);if(stale>650){p.input.keys=[];p.jump=false;s.slideRequested=false;}
   s.netHitProtected=stale>500||wallDelta>.30||due>.50;s.yaw=p.input.yaw;s.pitch=p.input.pitch;
   if(!p.motionMode){simulateWorker(room,p,blocks,dt,new Set(p.input.keys),p.jump,active);p.jump=false;}
   syncShared(room,p);
  }
  q.elapsed+=dt;pruneSignals(q);tickRevives(room,active,now,dt);const anomaly=tickShiftEvents(q);if(anomaly)pushEvent(room,anomaly);
  for(const p of active){const s=attach(room,p);s.teamView=forward(s);}
  const anchor=active[0].state;Object.assign(q,{x:anchor.x,y:anchor.y,z:anchor.z,bodyHeight:anchor.bodyHeight,flashAmount:anchor.flashAmount,grounded:anchor.grounded});
  q.teamPlayers=active.map(p=>p.state);q.hauntSounds=[];
  updateHaunt(q,blocks,forward(anchor),dt);
  for(const e of q.hauntSounds)pushEvent(room,{type:'haunt',...e});
  delete q.teamPlayers;
  for(const p of active){if(p.state.failed){p.state.threatWarnings={};p.state.slideTime=0;p.state.slideExit=0;p.state.slideRequested=false;p.state.restoreTorch=false;p.reviveProgress=0;p.reviveTarget=null;p.input.keys=[];p.reviveHeld=false;p.jump=false;dropOwned(room,p);pushEvent(room,{type:'capture',player:p.id,kind:p.state.capturedBy});}detach(p);}
  if(q.states.every(v=>v==='DELIVERED')){room.phase='complete';break;}
 }
 if(!live(room).length&&room.phase==='playing')room.phase='failed';
}
const ghostFields=['kind','x','z','yaw','phase','age','life','speed','aggression','state','timer','fade','surfaceY','surfaceRoll','lightReaction','reveal','pursuit','spawnGrace','targetId'];
function ghostPublic(a){return Object.fromEntries(ghostFields.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));}
function selfState(room,p){const s=attach(room,p),out={};for(const k of ['x','y','z','yaw','pitch','vx','vy','vz','grounded','bodyHeight','steps','onRail','carried','flashlight','flashAmount','handAction','vault','failed','capturedBy','noise','horrorEvent','cargoSignalAt','signalCooldownUntil','signalPulseUntil','slideTime','slideCooldown','slideExit','threatWarnings'])if(s[k]!==undefined)out[k]=s[k];detach(p);return out;}
export function snapshot(room,p){
 const q=room.shared;const count=Object.keys(room.players).length,startCount=room.phase==='lobby'?count:q.startCount??count,level=room.phase==='lobby'?effectiveDifficulty(room.requestedDifficulty,count):q.difficultyLevel??'normal';const players=Object.values(room.players).map(a=>{attach(room,a);const pub=publicPlayer(a);detach(a);return pub;});
 return {room:room.code,phase:room.phase,serverTime:room.lastTick,simLagMs:Math.round(((room.simDebt??0)+(room.fraction??0)/60)*1000),host:room.host,you:p.id,ack:p.commandSeq,inputAck:p.lastInputSeq??0,motionProtocol:MOTION_VERSION,motionEpoch:p.motionEpoch??1,motionAck:p.motionAck??0,motionMode:!!p.motionMode,players,self:selfState(room,p),cargo:q.cargo,cargoDeadlines:q.cargoDeadlines??{},shiftEvents:q.shiftEvents??null,powerZones:q.powerZones??{},signals:q.signals??{},states:q.states,parked:q.parked,deliveryOrder:q.deliveryOrder,deliveryBays:q.deliveryBays??{},lockers:q.lockers,lockerRevision:q.lockerRevision,elapsed:q.elapsed,haunt:q.haunt.map(ghostPublic),events:room.events,quota:room.phase==='lobby'?cargoQuota(count):q.states.length,startCount,requestedDifficulty:normalizeDifficulty(room.requestedDifficulty),difficulty:teamDifficulty(Math.max(1,live(room).length),level,room.phase==='lobby'?count:q.startCount??1)};
}
export function operateRoom(room,body,now=Date.now()){
 check(room&&room.phase!=='closed','방을 찾을 수 없습니다.',404);
 const op=body.op;
 if(op==='join'){
  prune(room,now);check(room.phase==='lobby','이미 근무가 시작되었습니다.',409);
  const p=addPlayer(room,now,body.nickname);room.updatedAt=now;return {token:p.token,snapshot:snapshot(room,p)};
 }
 const p=Object.values(room.players).find(p=>p.token===body.token);check(p,'방 연결이 만료되었습니다.',401);
 now=Math.max(now,room.lastTick??now);p.lastSeen=now;tickRoom(room,now);room.updatedAt=now;
 if(op==='leave'){removePlayer(room,p);return {left:true};}
 if(op==='difficulty'){check(p.id===room.host,'방장만 난이도를 변경할 수 있습니다.',403);check(room.phase==='lobby','근무 시작 후에는 난이도를 바꿀 수 없습니다.',409);check(typeof body.level==='string'&&Object.hasOwn(DIFFICULTIES,body.level),'잘못된 난이도입니다.');room.requestedDifficulty=body.level;}
 else if(op==='start'){check(p.id===room.host,'방장만 근무를 시작할 수 있습니다.',403);check(room.phase==='lobby','이미 근무 준비 중입니다.',409);const count=Object.keys(room.players).length;check(count>=2,'최소 2명이 입장해야 합니다.',409);if(body.level!==undefined){check(typeof body.level==='string'&&Object.hasOwn(DIFFICULTIES,body.level),'잘못된 난이도입니다.');room.requestedDifficulty=body.level;}const q=room.shared,level=effectiveDifficulty(room.requestedDifficulty,count),total=cargoQuota(count);q.startCount=count;q.difficultyLevel=level;q.cargo=randomCargo(Math.random,total,level);q.states=Array(total).fill('AVAILABLE');q.cargoDeadlines={};q.parked={};q.deliveryOrder=[];q.deliveryBays={};q.shiftEvents=createShiftEvents(Math.random,level);q.powerZones={};q.signals={};q.hauntDirector={delay:Math.max(5,9*DIFFICULTIES[level].interval),bag:[]};room.phase='loading';room.lastTick=now;room.simDebt=0;room.fraction=0;}
 else if(op==='ready'){check(['loading','playing'].includes(room.phase),'아직 근무를 시작하지 않았습니다.',409);p.ready=true;canStart(room,now);}
 else if(op==='sync'){
  if(room.phase==='playing'&&!p.state.failed){
   const motion=body.motion&&body.motion.version===MOTION_VERSION?body.motion:null;
   if(motion&&motion.epoch!==(p.motionEpoch??1))return {snapshot:snapshot(room,p)};
   const incoming=body.inputSeq,sequenced=Number.isSafeInteger(incoming)&&incoming>0;
   if(sequenced&&incoming<=(p.lastInputSeq??0))return {snapshot:snapshot(room,p)};
   if(sequenced)p.lastInputSeq=incoming;
   const input=body.input??{};const gap=now-(p.lastInputAt??now);p.lastInputAt=now;if(gap>500)p.state.hitProtectedUntil=Math.max(p.state.hitProtectedUntil??0,room.shared.elapsed+Math.min(1.2,.55+gap/4000));p.input={keys:Array.isArray(input.keys)?[...new Set(input.keys.filter(k=>keysAllowed.has(k)))].slice(0,9):[],yaw:clamp(finite(input.yaw,p.input.yaw),-1e4,1e4),pitch:clamp(finite(input.pitch,p.input.pitch),-1.3,1.3)};
   acknowledgeWarnings(p.state,input.warningAck,room.shared.elapsed);
   p.reviveHeld=p.input.keys.includes('KeyE');p.state.yaw=p.input.yaw;p.state.pitch=p.input.pitch;
   if(motion)applyMotionBatch(room,p,motion,body.commands,now);
   else if(!p.motionMode)for(const cmd of (Array.isArray(body.commands)?body.commands.slice(0,16):[]))command(room,p,cmd);
  }
 }else if(op!=='start'&&op!=='ready')throw new RoomError('잘못된 명령입니다.');
 return {snapshot:snapshot(room,p)};
}
// Redis persistence deliberately excludes process-local spatial indexes and
// A* search jobs. Completed paths and creature behavior state remain durable.
export function serializeRoom(room){
 const omit=new Set(['navStatic','navEvent','navBlocks','navIndex','navJob','navLockerRevision','navCarried','teamPlayers','teamView','hauntSounds','motionSpeed','viewHeight','lastViewYaw','lastViewPitch']);
 return JSON.stringify(room,(key,value)=>omit.has(key)?undefined:value);
}
