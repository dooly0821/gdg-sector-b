import {cargoGlowCode} from './cargo-glow.js';
import {basis} from './world.js';
import {appendRemote,remoteAt} from './net-smoothing.js';
import {nudgeCoopPosition} from './movement.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,d=0)=>Number.isFinite(v)?v:d,blend=(a,b,t)=>a+(b-a)*t;
export function sampleTiming(snap,sent,received){const rtt=Math.max(0,received-sent);if(![snap.serverReceived,snap.serverSent,snap.serverTime].every(Number.isFinite))return {sample:received-Math.min(rtt*.5,500),rtt};const processing=clamp(snap.serverSent-snap.serverReceived,0,rtt),transit=(rtt-processing)*.5,age=clamp(snap.serverSent-snap.serverTime+clamp(finite(snap.simLagMs),0,350),0,1300);return {sample:received-clamp(transit+age,0,1200),rtt};}
export function pollDelay({rtt=120,players=2,collided=false,contention=0,dirty=false,playing=true,random=Math.random()}){if(!playing)return 850+random*80;if(collided)return Math.min(160,25+15*contention)+random*35;const target=players>2?145:120;return dirty?Math.max(12,30-rtt)+random*5:clamp(target-rtt,16,90)+random*18;}
export class CoopClient{
 constructor(onState,onError,input){this.onState=onState;this.onError=onError;this.input=input;this.room=null;this.token=null;this.snapshot=null;this.seq=0;this.queue=[];this.running=false;this.busy=false;this.peers=new Map();this.remoteTracks=new Map();}
 async request(op,extra={}){
  const sent=performance.now();this.lastRequestAt=sent;
  const res=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({op,room:this.room,token:this.token,...extra}),signal:AbortSignal.timeout(op==='sync'?3000:10000)});
  let data;try{data=await res.json();}catch{throw Error('협동 서버에 연결할 수 없습니다.');}
  if(!res.ok){const e=new Error(data.error||'서버 연결 오류');e.status=res.status;throw e;}
  const received=performance.now(),rtt=received-sent;
  this.rtt=this.rtt==null?rtt:blend(this.rtt,rtt,.2);
  if(data.snapshot){const timing=sampleTiming(data.snapshot,sent,received);data.snapshot.netReceived=received;data.snapshot.netSample=timing.sample;data.snapshot.netRtt=rtt;data.snapshot.netTickTime=data.snapshot.serverTime-clamp(finite(data.snapshot.simLagMs),0,350);}
  return data;
 }
 accept(data){
  if(data.token)this.token=data.token;
  if(!data.snapshot)return;
  if(this.snapshot?.room===data.snapshot.room&&Number.isFinite(data.snapshot.serverTime)&&data.snapshot.serverTime<(this.snapshot.serverTime??0))return;
  const prev=this.snapshot,next=data.snapshot;
  if(prev?.room===next.room&&prev.phase===next.phase&&prev.cargo?.length===next.cargo?.length&&JSON.stringify(prev.cargo)===JSON.stringify(next.cargo))next.cargo=prev.cargo;
  this.snapshot=next;this.room=next.room;
  if(prev?.room===next.room&&Number.isFinite(next.netReceived)&&Number.isFinite(prev.netReceived))this.snapshotGap=Math.max(0,next.netReceived-prev.netReceived);
  const now=data.snapshot.netReceived??performance.now(),seen=new Set();
  for(const p of data.snapshot.players??[]){if(p.id===data.snapshot.you||p.hidden)continue;seen.add(p.id);this.remoteTracks.set(p.id,appendRemote(this.remoteTracks.get(p.id),p,data.snapshot.netSample,now,data.snapshot.netTickTime??data.snapshot.serverTime));}
  for(const id of this.remoteTracks.keys())if(!seen.has(id))this.remoteTracks.delete(id);
  this.queue=this.queue.filter(q=>q.seq>data.snapshot.ack);
  this.onState?.(data.snapshot);
 }
 async connect(op,room=null,nickname){
  if(this.running)return;
  this.room=room;this.seq=0;this.queue=[];this.peers.clear();this.remoteTracks.clear();this.rtt=null;this.contention=0;this.dirty=false;
  this.accept(await this.request(op,{nickname}));this.running=true;this.poll();
 }
 async action(op,extra={}){
  if(!this.running)return;
  // Serialize start/ready with an in-flight sync rather than racing server state.
  if(this.busy){this.pendingAction={op,extra};return;}
  this.busy=true;try{const data=await this.request(op,extra);if(this.running)this.accept(data);}catch(e){if(e.status===423)this.pendingAction={op,extra};else this.onError?.(e);}finally{this.busy=false;}
 }
 inputChanged(){if(!this.running||this.snapshot?.phase!=='playing')return;this.dirty=true;if(!this.busy&&this.runPoll){clearTimeout(this.timer);this.timer=setTimeout(this.runPoll,Math.max(0,30-(performance.now()-(this.lastRequestAt??0))));}}
 command(type){if(this.running&&this.snapshot?.phase==='playing'&&this.queue.length<64){this.queue.push({seq:++this.seq,type});this.inputChanged();}}
 poll(){
  if(!this.running)return;
  const run=async()=>{
   if(!this.running)return;
   let collided=false;
   if(!this.busy){
    this.busy=true;
    const pending=this.pendingAction;this.pendingAction=null;
    try{
     const input=this.input?.()??{keys:[],yaw:0,pitch:0};this.dirty=false;
     const data=await this.request(pending?.op||'sync',pending?pending.extra:{input,commands:this.queue.slice(0,16)});
     if(this.running){this.accept(data);this.failures=0;this.contention=Math.max(0,(this.contention??0)-1);}
    }catch(e){
     if(this.running&&e.status!==423){this.dirty=true;this.failures=(this.failures??0)+1;if(this.failures>=3||e.status===401||e.status===404)this.onError?.(e);if(e.status===401||e.status===404){this.running=false;return;}}
     else if(this.running){collided=true;this.contention=Math.min(5,(this.contention??0)+1);if(pending)this.pendingAction=pending;}
    }finally{this.busy=false;}
   }
   if(this.running){
    const playing=this.snapshot?.phase==='playing',players=this.snapshot?.players?.length??2;
    const delay=pollDelay({playing,players,rtt:finite(this.rtt,120),collided,contention:this.contention??0,dirty:this.dirty||this.queue.length>0});
    this.timer=setTimeout(run,Math.max(delay,Math.min(450,(this.failures??0)*60)));
   }
  };this.runPoll=run;this.timer=setTimeout(run,70+Math.random()*70);
 }
 async leave(){const room=this.room,token=this.token;this.running=false;clearTimeout(this.timer);this.room=this.token=null;this.snapshot=null;this.pendingAction=null;this.runPoll=null;this.peers.clear();this.remoteTracks.clear();try{if(room&&token)await this.request('leave',{room,token});}catch{}}
}
export function peerLayers(client,s,dt,group){
 if(!client?.snapshot)return [];
 const layers=[],seen=new Set();
 for(const p of client.snapshot.players){
  if(p.id===client.snapshot.you||p.hidden)continue;
  if(Math.hypot(p.x-s.x,p.z-s.z)>35)continue;
  seen.add(p.id);let old=client.peers.get(p.id);
  if(!old||(Math.hypot(old.x-p.x,old.z-p.z)>16&&(client.remoteTracks?.get(p.id)?.samples?.length??0)<=1)){old={...p};client.peers.set(p.id,old);}
  const alpha=1-Math.exp(-dt*20),visual=remoteAt(client.remoteTracks?.get(p.id),performance.now(),true)??p;
  for(const k of ['x','y','z','bodyHeight'])old[k]+=(visual[k]-old[k])*alpha;
  const targetSpeed=Math.hypot(finite(visual.vx),finite(visual.vz));
  old.visualSpeed=blend(finite(old.visualSpeed,targetSpeed),targetSpeed,alpha);
  old.steps=blend(old.steps+old.visualSpeed*dt,visual.steps,1-Math.exp(-dt*10));
  old.yaw+=Math.atan2(Math.sin(visual.yaw-old.yaw),Math.cos(visual.yaw-old.yaw))*alpha;
  const speed=p.failed?0:old.visualSpeed,bob=Math.sin(old.steps*10)*Math.min(.035,speed*.008),sy=Math.max(.61,Math.min(1,old.bodyHeight/1.7))*(p.failed?.25:1);
  const axes=basis(Math.sin(old.steps*5)*Math.min(.06,speed*.01),Math.PI+old.yaw,0);
  const matrix=new Float32Array([...axes.flatMap((a,i)=>[...a.map(v=>v*(i===1?sy:1)),0]),old.x,old.y+bob,old.z,1]);
  layers.push({group,matrix,root:[old.x,old.y+1,old.z],skinName:'player',skin:{name:'player',root:matrix,floor:p.grounded!==false&&!p.vault?old.y:null,state:{speed,steps:old.steps,bodyHeight:old.bodyHeight,carried:p.carried??-1,vault:!!p.vault}}});
  // The same shared parcel batch is rendered in the teammate's hands.
  if(p.carried>=0){const x=old.x-Math.sin(old.yaw)*.42,z=old.z-Math.cos(old.yaw)*.42,m=new Float32Array([...basis(0,Math.PI+old.yaw,0).flatMap(a=>[...a,0]),x,old.y+.90*sy,z,1]);layers.push({group:1,matrix:m,root:[x,old.y+1,z],prop:true,cargoGlow:cargoGlowCode(s.cargo?.[p.carried]?.special)});}
 }
 for(const id of client.peers.keys())if(!seen.has(id))client.peers.delete(id);
 return layers;
}
// Reconcile against the pose at the estimated server sample time.
export function recordCoopPrediction(s,now){
 const h=s.netHistory??=[];h.push({t:now,x:s.x,y:s.y,z:s.z,cx:s.netAppliedX??0,cz:s.netAppliedZ??0,grounded:!!s.grounded,vault:!!s.vault});
 while(h.length>180||h.length>1&&h[1].t<now-1800)h.shift();
}
function historyAt(s,time){
 const h=s.netHistory??[];if(!h.length)return null;
 if(time<=h[0].t)return time<h[0].t-120?null:h[0];
 for(let i=1;i<h.length;i++)if(h[i].t>=time){const a=h[i-1],b=h[i],u=clamp((time-a.t)/Math.max(1,b.t-a.t),0,1);return {...Object.fromEntries(['x','y','z','cx','cz'].map(k=>[k,blend(a[k],b[k],u)])),grounded:(u<.5?a:b).grounded,vault:(u<.5?a:b).vault};}
 return h[h.length-1];
}
export function applyCoopSnapshot(s,snap,first=false){
 if(!s||!snap?.self)return;
 const v=snap.self,hidden=!!snap.players.find(p=>p.id===snap.you)?.hidden,oldHidden=!!s.coopHidden;
 const now=finite(snap.netReceived,performance.now()),sampleAt=finite(snap.netSample,now);
 const history=historyAt(s,sampleAt),age=clamp((now-sampleAt)/1000,0,.28);
 const dx=history?v.x-history.x-((s.netAppliedX??0)-history.cx):v.x+finite(v.vx)*age-s.x;
 const dz=history?v.z-history.z-((s.netAppliedZ??0)-history.cz):v.z+finite(v.vz)*age-s.z;
 const err=Math.hypot(dx,dz),vertical=Math.abs((history?.y??s.y)-v.y);
 const sampleAge=Math.max(0,now-sampleAt),sameLocalFloor=Math.abs((history?.y??s.y)-s.y)<.24;
 const verticalConflict=sampleAge<300&&sameLocalFloor&&(history?.grounded??s.grounded)&&v.grounded&&s.grounded&&vertical>.55;
 s.netFloorSince=verticalConflict?(s.netFloorSince??now):null;
 s.netDivergenceSince=err>4.25?(s.netDivergenceSince??now):null;
 const mismatch=!!(history?.grounded??s.grounded)!==!!v.grounded||!!(history?.vault??s.vault)!==!!v.vault;
 s.netMismatchAt=mismatch?(s.netMismatchAt??now):null;
 // Ordinary delayed snapshots must not cause a multi-meter teleport.
 // Snap only on authoritative transitions or sustained, genuinely divergent collision state.
 const revived=!!s.failed&&!v.failed;
  const hard=first||revived||hidden!==oldHidden||v.failed||err>9||(err>4.25&&now-(s.netDivergenceSince??now)>1400&&now-(s.netBlockedSince??now)>650)||(verticalConflict&&now-s.netFloorSince>450)||(mismatch&&sameLocalFloor&&sampleAge<300&&now-s.netMismatchAt>1400&&vertical>.85);
 if(hard){
  for(const k of ['x','y','z','vx','vy','vz','grounded','bodyHeight','steps','vault','onRail'])s[k]=v[k]??(k==='vault'?null:s[k]);
  s.netHistory=[];s.netAppliedX=s.netAppliedZ=0;s.netCorrection=[0,0];s.netMismatchAt=null;s.netDivergenceSince=null;s.netBlockedSince=null;s.netFloorSince=null;s.netHardCorrections=(s.netHardCorrections??0)+(first||v.failed||hidden!==oldHidden?0:1);
 }else if(!s.vault&&!v.vault&&!!s.grounded===!!v.grounded&&!hidden){
  const dead=.07+Math.min(.12,finite(snap.netRtt)*.00025),amount=Math.max(0,err-dead),weight=err>0?Math.min(s.grounded?3.2:1.1,amount)/err:0;
  s.netCorrection=[dx*weight,dz*weight];
 }else s.netCorrection=[0,0];
 s.netGrounded=!!v.grounded&&!v.vault;s.netOnRail=!!v.onRail;
 if(first){s.yaw=v.yaw;s.pitch=v.pitch;s.coopVisualClock=snap.elapsed??0;}else if(hidden&&!oldHidden){s.yaw=0;s.pitch=0;}
 for(const k of ['cargo','states','parked','deliveryOrder','deliveryBays','lockers','lockerRevision','elapsed','cargoDeadlines','shiftEvents'])s[k]=snap[k];
 s.difficultyLevel=snap.difficulty?.level??'normal';s.startCount=snap.startCount??1;
 const prevAction=s.handAction;
 for(const k of ['carried','flashlight','handAction','failed','capturedBy','noise','horrorEvent','cargoSignalAt'])s[k]=v[k]??(k==='carried'?-1:k==='flashlight'||k==='failed'?false:null);
 if(s.handAction&&prevAction&&s.handAction.index===prevAction.index&&s.handAction.placing===prevAction.placing)
  s.handAction={...s.handAction,time:Math.max(s.handAction.time,prevAction.time)};
 if(first)s.flashAmount=v.flashAmount??0;
 s.skipLockerAdvance=true;s.coopPrediction=true;s.coopHidden=hidden;
 s.haunt=(snap.haunt??[]).map(a=>{
  const old=s.haunt?.find(p=>p.kind===a.kind),elapsed=snap.elapsed??0;
  const fresh=!old||Math.hypot(old.x-a.x,old.z-a.z)>5||a.age+.15<(old.netAgeBase??old.age);
  const interval=elapsed-(old?.netElapsed??elapsed),rate=!fresh&&interval>.001?clamp((a.phase-(old.netPhase??old.phase))/interval,0,45):1+finite(a.speed)*(a.kind===2?5.3:2.4);
  return {...a,...(fresh?{}:{x:old.x,z:old.z,surfaceY:old.surfaceY??0,yaw:old.yaw,phase:old.phase,age:old.age,speed:old.speed}),
   netTrack:appendRemote(fresh?null:old.netTrack,a,sampleAt,now,snap.netTickTime??snap.serverTime),surfaceY:fresh?(a.surfaceY??0):(old.surfaceY??0),netTarget:[a.x,a.surfaceY??0,a.z],netYaw:a.yaw,netPhase:a.phase,netAgeBase:a.age,netElapsed:elapsed,netSince:0,netRate:rate,netSpeed:a.speed,netTimer:a.timer};
 });
}
export function advanceCoopPrediction(s,blocks,dynamic,dt,now){
 if(!s.coopHidden&&!!s.grounded===!!s.netGrounded&&!s.vault&&s.netCorrection){
  const [dx,dz]=s.netCorrection,len=Math.hypot(dx,dz),speed=Math.hypot(finite(s.vx),finite(s.vz));
  const maxRate=s.grounded?(speed<.5?2.8:2.2):.85,limit=Math.min(1-Math.exp(-dt*6),len>0?maxRate*dt/len:0),x=s.x,z=s.z;
  let cx=dx*limit,cz=dz*limit;
  // While sprinting, bound the backwards component so a normal correction cannot reverse motion.
  if(speed>.5){const ux=s.vx/speed,uz=s.vz/speed,back=cx*ux+cz*uz,floor=-Math.min(maxRate,speed*.18)*dt;if(back<floor){cx+=(floor-back)*ux;cz+=(floor-back)*uz;}}
  nudgeCoopPosition(s,blocks,cx,cz,dynamic);
  const mx=s.x-x,mz=s.z-z;s.netAppliedX=(s.netAppliedX??0)+mx;s.netAppliedZ=(s.netAppliedZ??0)+mz;
  s.netCorrection=[dx-mx,dz-mz];
  if(len>.25&&Math.hypot(cx,cz)>.0002&&Math.hypot(mx,mz)<.0001)s.netBlockedSince??=now;else if(Math.hypot(mx,mz)>.0001||len<.25)s.netBlockedSince=null;
  if(len<.008||Math.hypot(mx,mz)<.0001&&len>.008)s.netCorrection=[0,0];
 }
 s.coopVisualClock=(s.coopVisualClock??s.elapsed??0)+dt;
 const a=s.handAction;
 if(a){const contact=a.duration*(a.placing?.72:.30),limit=a.result?a.duration-.001:Math.max(a.time,contact-.001);a.time=Math.min(limit,a.time+dt);}
 recordCoopPrediction(s,now);
}
export function interpolateCoopHaunt(s,dt,now=performance.now()){
 for(const a of s.haunt??[]){
  if(!a.netTarget)continue;
  const t=1-Math.exp(-dt*13);a.netSince=Math.min(.32,(a.netSince??0)+dt);
  const visual=a.netTrack?.samples?.length>1?remoteAt(a.netTrack,now):null;
  // Do not add visual buffering to an imminent capture: near monsters stay
  // close to their latest authoritative position. Blend the transition.
  const distance=Math.hypot(finite(s.x)-a.netTarget[0],finite(s.z)-a.netTarget[2]),buffer=clamp((distance-4)/5,0,1);
  const target=visual?[blend(a.netTarget[0],visual.x,buffer),blend(a.netTarget[1],visual.surfaceY??0,buffer),blend(a.netTarget[2],visual.z,buffer)]:a.netTarget;
  const motion=1-Math.exp(-dt*(13+(1-buffer)*9));
  a.x+=(target[0]-a.x)*motion;a.surfaceY+=(target[1]-a.surfaceY)*motion;a.z+=(target[2]-a.z)*motion;
  const yaw=visual?a.netYaw+Math.atan2(Math.sin(visual.yaw-a.netYaw),Math.cos(visual.yaw-a.netYaw))*buffer:a.netYaw;a.yaw+=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw))*motion;
  a.speed=blend(finite(a.speed),finite(a.netSpeed),t);
  a.phase=blend(a.phase,a.netPhase+finite(a.netRate,1)*a.netSince,1-Math.exp(-dt*14));a.age=blend(a.age,a.netAgeBase+a.netSince,t);
  a.timer=Math.max(0,finite(a.netTimer)-a.netSince);
 }
}
