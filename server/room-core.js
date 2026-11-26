import {DIFFICULTIES,normalizeDifficulty,effectiveDifficulty,cargoQuota,difficultyLabel} from '../dist/difficulty.js';
// Authoritative room simulation. All clients share one cargo list, one ghost
// director and one door state. Clients send controls, never claimed deliveries.
import {randomBytes} from 'node:crypto';
import {createShiftEvents,tickShiftEvents} from '../dist/shift-events.js';
import {normalizeNickname} from '../dist/nickname.js';
import {createScene,newShift,randomCargo,step,forward,handlingTarget,canUse,dropTarget,deliveryCount,MISSION_TOTAL,parcelBlocks} from '../dist/mission.js';
import {beginHandling,advanceHandling,toggleFlashlight,updateViewmodel} from '../dist/handling.js';
import {advanceLockers,lockerDoorBlocks,lockerTarget,useLocker,insideLocker,closedLocker,LOCKERS} from '../dist/lockers.js';
import {updateHaunt,teamDifficulty} from '../dist/haunt.js';
export const ROOM_TTL=7200,MAX_PLAYERS=4;
const keysAllowed=new Set(['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space']);
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand=(n=18)=>randomBytes(n).toString('hex');
export const roomCode=()=>Array.from(randomBytes(6),b=>alphabet[b%alphabet.length]).join('');
export class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const check=(ok,msg,status=400)=>{if(!ok)throw new RoomError(msg,status);};
let scene;
const world=()=>scene??=createScene()[0];
const spawns=[[1.7,15],[.7,15],[2.7,15],[1.7,16.1]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d=0)=>Number.isFinite(v)?v:d;
const publicPlayer=p=>({id:p.id,name:p.name,ready:p.ready,failed:!!p.state.failed,hidden:!!closedLocker(p.state),x:p.state.x,y:p.state.y,z:p.state.z,yaw:p.state.yaw,pitch:p.state.pitch,bodyHeight:p.state.bodyHeight??1.7,steps:p.state.steps,carried:p.state.carried,flashlight:!!p.state.flashlight,vx:p.state.vx,vy:p.state.vy,vz:p.state.vz,grounded:p.state.grounded!==false,vault:!!p.state.vault});
const sharedKeys=['cargo','states','parked','deliveryOrder','lockers','lockerRevision','horrorEvent','cargoDeadlines','shiftEvents'];
function attach(room,p){
 const s=p.state,q=room.shared;q.cargoDeadlines??={};for(const k of sharedKeys)s[k]=q[k];
 s.elapsed=q.elapsed;s.skipLockerAdvance=true;s.id=p.id;return s;
}
function detach(p){for(const k of sharedKeys)delete p.state[k];delete p.state.hauntSounds;delete p.state.teamView;}
function pushEvent(room,e){room.eventSeq++;room.events.push({...e,seq:room.eventSeq});if(room.events.length>28)room.events.shift();}
function addPlayer(room,now,nickname){
 const used=new Set(Object.values(room.players).map(p=>p.slot));const slot=[0,1,2,3].find(n=>!used.has(n));check(slot!==undefined,'최대 4명까지 입장할 수 있습니다.',409);
 const name=nickname===undefined?'WORKER '+String(slot+1).padStart(2,'0'):normalizeNickname(nickname);
 check(name,'닉네임은 한글, 영문, 숫자 등 2~12자로 입력하세요.');
 check(!Object.values(room.players).some(p=>p.name.toLowerCase()===name.toLowerCase()),'같은 서버에 이미 사용 중인 닉네임입니다.',409);
 const id=rand(6),token=rand(24),state=newShift();
 const [x,z]=spawns[slot];Object.assign(state,{x,z,bodyHeight:1.7,carried:-1,id,elapsed:0});
 const p={id,token,slot,name,state,ready:false,lastSeen:now,input:{keys:[],yaw:state.yaw,pitch:state.pitch},commandSeq:0,jump:false};
 detach(p);room.players[id]=p;if(!room.host)room.host=id;return p;
}
export function createRoom(code,now=Date.now(),nickname){
 const room={code,phase:'lobby',requestedDifficulty:'normal',host:null,players:{},shared:{cargo:randomCargo(Math.random),cargoDeadlines:{},shiftEvents:createShiftEvents(),states:Array(MISSION_TOTAL).fill('AVAILABLE'),parked:{},deliveryOrder:[],lockers:{},lockerRevision:0,elapsed:0,haunt:[],hauntSounds:[],hauntDirector:{delay:9,bag:[]}},events:[],eventSeq:0,lastTick:now,updatedAt:now};
 const p=addPlayer(room,now,nickname);return {room,player:p};
}
const live=room=>Object.values(room.players).filter(p=>!p.state.failed);
function dropOwned(room,p){
 const s=attach(room,p);if(s.carried>=0){const i=s.carried,blocks=world().blocks.concat(lockerDoorBlocks(s)),t=dropTarget(s,blocks);if(t)room.shared.parked[i]=t.pos.slice();else delete room.shared.parked[i];room.shared.states[i]='AVAILABLE';s.carried=-1;room.shared.horrorEvent={type:'drop',time:room.shared.elapsed};}detach(p);
}
function removePlayer(room,p){
 dropOwned(room,p);delete room.players[p.id];if(room.host===p.id)room.host=Object.keys(room.players)[0]??null;
 if(!Object.keys(room.players).length)room.phase='closed';
 if(room.phase==='loading'&&Object.values(room.players).length<2){room.phase='lobby';for(const a of Object.values(room.players))a.ready=false;}
}
function prune(room,now){
 for(const p of Object.values(room.players))if(now-p.lastSeen>(room.phase==='loading'?180000:35000))removePlayer(room,p);
}
function canStart(room,now){
 if(room.phase==='loading'&&Object.keys(room.players).length>=2&&Object.values(room.players).every(p=>p.ready)){
  room.phase='playing';room.lastTick=now;room.shared.elapsed=0;pushEvent(room,{type:'notice',message:difficultyLabel(room.shared.difficultyLevel)+' · 팀 화물 '+room.shared.states.length+'개 배송 시작.'});
 }
}
function syncShared(room,p){const s=p.state,q=room.shared;if(s.lockerRevision!==q.lockerRevision)q.lockerRevision=s.lockerRevision;if(s.horrorEvent&&s.horrorEvent!==q.horrorEvent)q.horrorEvent=s.horrorEvent;}
function command(room,p,cmd){
 if(!cmd||!Number.isSafeInteger(cmd.seq)||cmd.seq<=p.commandSeq||cmd.seq>p.commandSeq+128)return;
 p.commandSeq=cmd.seq;
 const s=attach(room,p),q=room.shared;
 if(s.failed||room.phase!=='playing'){detach(p);return;}
 const staticBlocks=world().blocks,blocks=staticBlocks.concat(lockerDoorBlocks(s));
 if(cmd.type==='jump')p.jump=true;
 if(cmd.type==='torch'){if(!s.handAction)toggleFlashlight(s);}
 if(cmd.type==='use'&&!s.handAction&&!s.pendingUse){
  const l=lockerTarget(s,staticBlocks);
  if(l&&s.carried<0){
   const other=live(room).some(a=>a!==p&&insideLocker(a.state,l));
   if(!other){const result=useLocker(s,l);if(result==='closing'){s.yaw=0;s.pitch=0;p.input.yaw=0;p.input.pitch=0;}if(result==='opening'||result==='closing')pushEvent(room,{type:'door',x:l.x,z:l.z,player:p.id});else if(result==='step-back')pushEvent(room,{type:'notice',player:p.id,message:'문이 열릴 공간이 필요합니다. 한 걸음 물러서세요.'});}
   else pushEvent(room,{type:'notice',player:p.id,message:'다른 작업자가 사용하는 사물함입니다.'});
  }else {const t=handlingTarget(s,blocks);if(canUse(s,t,blocks)){s.restoreTorch=s.flashlight;beginHandling(s,t,blocks);}}
 }
 syncShared(room,p);detach(p);
}
export function tickRoom(room,now=Date.now()){
 now=Math.max(now,room.lastTick??now);
 prune(room,now);canStart(room,now);
 const delta=Math.min(.40,Math.max(0,(now-room.lastTick)/1000));room.lastTick=now;
 if(room.phase!=='playing'||!delta)return;
 const q=room.shared,players=live(room);q.cargoDeadlines??={};q.shiftEvents??=createShiftEvents();if(!players.length){room.phase='failed';return;}
 const blocks=world().blocks,dt=1/60,ticks=Math.min(24,Math.floor(delta/dt+(room.fraction??0)));
 room.fraction=Math.min(.99,Math.max(0,delta/dt+(room.fraction??0)-ticks));
 for(let k=0;k<ticks;k++){
  const active=live(room);if(!active.length){room.phase='failed';break;}
  const ss=active.map(p=>attach(room,p));advanceLockers(q,dt,ss);
  for(const p of active){
   const s=attach(room,p);if(now-p.lastSeen>1800){p.input.keys=[];p.jump=false;}s.yaw=p.input.yaw;s.pitch=p.input.pitch;
   step(s,new Set(p.input.keys),blocks,dt,p.jump);p.jump=false;
   updateViewmodel(s,dt);
   if(s.handAction){
    const id=s.handAction.target.id,result=advanceHandling(s,blocks.concat(lockerDoorBlocks(s)),dt);
    if(result){if(s.restoreTorch){s.flashlight=true;s.restoreTorch=false;}if(result!=='cancelled')pushEvent(room,{type:'cargo',result,id,player:p.id});}
   }
   syncShared(room,p);
  }
  q.elapsed+=dt;const anomaly=tickShiftEvents(q);if(anomaly)pushEvent(room,anomaly);
  for(const p of active){const s=attach(room,p);s.teamView=forward(s);}
  const anchor=active[0].state;Object.assign(q,{x:anchor.x,y:anchor.y,z:anchor.z,bodyHeight:anchor.bodyHeight,flashAmount:anchor.flashAmount,grounded:anchor.grounded});
  q.teamPlayers=active.map(p=>p.state);q.hauntSounds=[];
  updateHaunt(q,blocks,forward(anchor),dt);
  for(const e of q.hauntSounds)pushEvent(room,{type:'haunt',...e});
  delete q.teamPlayers;
  for(const p of active){if(p.state.failed){dropOwned(room,p);pushEvent(room,{type:'capture',player:p.id,kind:p.state.capturedBy});}detach(p);}
  if(q.states.every(v=>v==='DELIVERED')){room.phase='complete';break;}
 }
 if(!live(room).length&&room.phase==='playing')room.phase='failed';
}
const ghostFields=['kind','x','z','yaw','phase','age','life','speed','aggression','state','timer','fade','surfaceY','surfaceRoll','lightReaction','reveal','pursuit','spawnGrace','targetId'];
function ghostPublic(a){return Object.fromEntries(ghostFields.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));}
function selfState(room,p){const s=attach(room,p),out={};for(const k of ['x','y','z','yaw','pitch','vx','vy','vz','grounded','bodyHeight','steps','onRail','carried','flashlight','flashAmount','handAction','vault','failed','capturedBy','noise','horrorEvent','cargoSignalAt'])if(s[k]!==undefined)out[k]=s[k];detach(p);return out;}
export function snapshot(room,p){
 const q=room.shared;const count=Object.keys(room.players).length,startCount=room.phase==='lobby'?count:q.startCount??count,level=room.phase==='lobby'?effectiveDifficulty(room.requestedDifficulty,count):q.difficultyLevel??'normal';const players=Object.values(room.players).map(a=>{attach(room,a);const pub=publicPlayer(a);detach(a);return pub;});
 return {room:room.code,phase:room.phase,serverTime:room.lastTick,host:room.host,you:p.id,ack:p.commandSeq,players,self:selfState(room,p),cargo:q.cargo,cargoDeadlines:q.cargoDeadlines??{},shiftEvents:q.shiftEvents??null,states:q.states,parked:q.parked,deliveryOrder:q.deliveryOrder,lockers:q.lockers,lockerRevision:q.lockerRevision,elapsed:q.elapsed,haunt:q.haunt.map(ghostPublic),events:room.events,quota:room.phase==='lobby'?cargoQuota(count):q.states.length,startCount,requestedDifficulty:normalizeDifficulty(room.requestedDifficulty),difficulty:teamDifficulty(Math.max(1,live(room).length),level,room.phase==='lobby'?count:q.startCount??1)};
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
 else if(op==='start'){check(p.id===room.host,'방장만 근무를 시작할 수 있습니다.',403);check(room.phase==='lobby','이미 근무 준비 중입니다.',409);const count=Object.keys(room.players).length;check(count>=2,'최소 2명이 입장해야 합니다.',409);if(body.level!==undefined){check(typeof body.level==='string'&&Object.hasOwn(DIFFICULTIES,body.level),'잘못된 난이도입니다.');room.requestedDifficulty=body.level;}const q=room.shared,level=effectiveDifficulty(room.requestedDifficulty,count),total=cargoQuota(count);q.startCount=count;q.difficultyLevel=level;q.cargo=randomCargo(Math.random,total,level);q.states=Array(total).fill('AVAILABLE');q.cargoDeadlines={};q.parked={};q.deliveryOrder=[];q.shiftEvents=createShiftEvents(Math.random,level);q.hauntDirector={delay:Math.max(5,9*DIFFICULTIES[level].interval),bag:[]};room.phase='loading';room.lastTick=now;}
 else if(op==='ready'){check(['loading','playing'].includes(room.phase),'아직 근무를 시작하지 않았습니다.',409);p.ready=true;canStart(room,now);}
 else if(op==='sync'){
  if(room.phase==='playing'&&!p.state.failed){
   const input=body.input??{};p.input={keys:Array.isArray(input.keys)?[...new Set(input.keys.filter(k=>keysAllowed.has(k)))].slice(0,8):[],yaw:clamp(finite(input.yaw,p.input.yaw),-1e4,1e4),pitch:clamp(finite(input.pitch,p.input.pitch),-1.3,1.3)};
   for(const cmd of (Array.isArray(body.commands)?body.commands.slice(0,16):[]))command(room,p,cmd);
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
