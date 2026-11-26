import {expandedLayout,EXTENSION_ROUTES,EXTENSION_HIDE} from './map-layout.js';
import {DIFFICULTIES,effectiveDifficulty,missionTotal} from './difficulty.js';
import {updateClimber} from './climber.js';
import {HUNT_PROFILE,clearObservation,observePlayer,pursueVisible,lostTrail,searchBearing,searchExpired,alreadyChecked,sweepVisited,rememberSweep,hidingScore} from './haunt-tactics.js';
import {DRESSING_HIDE} from './dressing.js';
import {parcelBlocks} from './mission.js';
import {closedLocker,lockerDoorBlocks,lockerEntry} from './lockers.js';
import {HIDING_POINTS,REFUGES} from './annex.js';
import {worldBounds} from './movement.js';
import {traceBox} from './contact.js';
import {indexBlocks,queryBlocks,freeAt,segmentFree,navigate,recover,trappedTooLong} from './haunt-navigation.js';
import {basis,multiply,dot} from './world.js';
import {buildCreatureRigs,CREATURE_JOINTS} from './creature-models.js';

const cast=[
 {name:'녹령',kind:'flicker',speed:5.65,range:15,float:.35},
 {name:'함귀',kind:'boxhead',speed:5.55,range:14,float:0},
 {name:'적재귀',kind:'imp',speed:6.30,range:13,float:0},
 {name:'표찰귀',kind:'wraith',speed:5.95,range:15,float:.38}
];
// Shared patrol loops. A creature can start from any of these loops and either direction.
const baseRoutes=[
 [[-21,14],[-25,14],[-28,12],[-23,13]],
 [[-38,14],[-35,16],[-32,13],[-35,12]],
 [[-19,4],[-20,8],[-20,12],[-18,11]],
 [[-37.8,2],[-38.4,-4],[-37,-7],[-39.6,-6]],
 [[-27,1],[-24,0],[-21,-3],[-19,0]],
 [[-13,14],[-8,14],[-8,10],[-6,8]],
 [[-8,5],[-8,-5],[-8,-11],[-8,-18]],
 [[2,12],[2,6],[2,-3],[2,-10]],
 [[9,-17],[10,-10],[10,-3],[9,6]],
 [[-13,13],[-17,13],[-20,14],[-16,15]],
 [[0,25],[0,34],[2,43],[0,50]],
 [[-11,32],[-9,38],[-6,49],[-12,47]],
 [[-30,24],[-30,33],[-33,39],[-30,49]],
 [[-19,34],[-17,37],[-11,37],[-8,33]],
 [[-40,27],[-39,33],[-40,44],[-38,51]],
 [[-30,56],[-29,62],[-29,71],[-31,76]],
 [[-41,57],[-41,66],[-41,75],[-35,75]],
 [[0,56],[1,63],[1,73],[0,76]],
 [[-12,61],[-12,66],[-5,66],[-5,75]],
 [[13,56],[13,64],[13,74],[10,76]]
];
const allRoutes=[...baseRoutes,...EXTENSION_ROUTES];const routesFor=s=>expandedLayout(s)?allRoutes:baseRoutes;
const randomOrder=(items,rng)=>{
 const copy=items.slice();
 for(let i=copy.length-1;i>0;i--){
  const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];
 }
 return copy;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(v,goal,max)=>v+clamp(goal-v,-max,max);
const clear=(blocks,x,z,r,y=0,height=1.2)=>!blocks.some(([x1,z1,x2,z2,y1,y2])=>
 y+.06<y2&&y+height>y1&&Math.hypot(x-clamp(x,x1,x2),z-clamp(z,z1,z2))<r);
const eyeHeights=[1.9,1.8,.80,2.0],armReach=[1.04,.96,.73,1.13];
function visible(blocks,a,b){
 return !blocks.some(box=>traceBox(a,b,box)<1);
}
// Sample several exposed points rather than relying on a single eye ray.
function line(blocks,actor,s){
 const i=actor.kind??0,h=s.bodyHeight??1.7,dx=s.x-actor.x,dz=s.z-actor.z,d=Math.hypot(dx,dz)||1;
 const side=[dz/d,-dx/d],eyes=[eyeHeights[i],eyeHeights[i]*.73];
 const targets=[[0,h-.15],[0,h*.54],[-.20,h*.66],[.20,h*.66],[0,h*.30]];
 if(s.showTraversal)actor.rays=[];
 let seen=false;
 for(const y of eyes)for(const [offset,height] of targets){
  const eye=[actor.x,y,actor.z],to=[s.x+side[0]*offset,s.y+height,s.z+side[1]*offset],open=visible(blocks,eye,to);
  if(s.showTraversal)actor.rays.push({from:eye,to,open});
  if(open){seen=true;if(!s.showTraversal)return true;}
 }
 return seen;
}
// The actual 3D beam: vertical aiming, body samples and physical occlusion.
function lightSense(blocks,actor,s,forward){
 const power=s.flashAmount??(s.flashlight?1:0);if(power<.25)return 0;
 const eye=[s.x,s.y+(s.bodyHeight??1.7)-.12,s.z],i=actor.kind;
 const range=[20,17,16,20][i];let strength=0;
 for(const y of [eyeHeights[i],eyeHeights[i]*.68,eyeHeights[i]*.35]){
  const p=[actor.x,y,actor.z],v=p.map((x,k)=>x-eye[k]),d=Math.hypot(...v);
  if(d>range||d<.01)continue;
  const angle=dot(forward,v)/d;
  if(angle>.79&&visible(blocks,eye,p))strength=Math.max(strength,power*clamp((angle-.79)/.13,0,1));
 }
 return strength;
}
const mapCache=new WeakMap(),staticNavCache=new WeakMap();
const bodyHeights=[1.85,1.8,.95,1.95];
const inMap=(x,z,s)=>x>-42.5&&x<14.35&&z>-21.1&&z<(expandedLayout(s)?101.5:77.5)&&(x>=-15||z>-8.65);
const sizes=[.35,.34,.44,.32];
export const SPAWN_BALANCE=Object.freeze({minDistance:16,maxDistance:28,grace:2.5,firstMin:8,intervalMin:12});
export function hiddenSpawn(s,x,z,kind,blocks,surface=0){
 const dx=x-s.x,dz=z-s.z,d=Math.hypot(dx,dz)||1,side=[dz/d,-dx/d];
 const eye=[s.x,s.y+(s.bodyHeight??1.7)-.12,s.z];
 const heights=surface?[surface-.3,surface-1,surface-1.8]:[cast[kind].float+.18,eyeHeights[kind]*.55,eyeHeights[kind]+.22];
 for(const h of heights)for(const offset of [-sizes[kind],0,sizes[kind]]){
  if(visible(blocks,eye,[x+side[0]*offset,h,z+side[1]*offset]))return false;
 }
 return true;
}
function spawnCue(s,a,initial=false){
 const cues=s.hauntSounds??=[];
 cues.push({x:a.x,z:a.z,kind:a.kind,accent:true,spawnWarning:true,initial});
 if(cues.length>4)cues.shift();
}
export function teamDifficulty(count=1,selected='normal',startCount=count){
 const n=clamp(Math.trunc(count)||1,1,4),extra=n-1,level=effectiveDifficulty(selected,startCount),p=DIFFICULTIES[level];
 return {level,count:n,maxActive:Math.min(4,n+1+(level==='hell'?1:0)),interval:Math.max(5,Math.max(8,12-2*extra)*p.interval),range:(1+.075*extra)*p.range,speed:(1+.035*extra)*p.speed,hearing:(1+.10*extra)*p.hearing,memory:Math.max(1.5,3.2+.7*extra+p.memory*.35),memoryBonus:p.memory,escape:23+2*extra+p.memory,budget:24+8*extra};
}
function chooseTeamTarget(root,actor,nav,assigned,difficulty){
 const players=root.teamPlayers.filter(p=>!p.failed);
 const old=players.find(p=>p.id===actor.targetId);
 if(old&&(actor.climb||actor.lockerId&&closedLocker(old)?.id===actor.lockerId||['windup','charge'].includes(actor.state)||(actor.targetDelay??0)>0))return old;
 actor.targetDelay=.40+actor.kind*.045;
 let best=null,score=Infinity;
 for(const p of players){
  const d=Math.hypot(p.x-actor.x,p.z-actor.z);
  const hiding=closedLocker(p);
  const local=d<24?queryBlocks(nav,Math.min(p.x,actor.x)-1,Math.min(p.z,actor.z)-1,Math.max(p.x,actor.x)+1,Math.max(p.z,actor.z)+1):[];
  const sight=d<cast[actor.kind].range*difficulty.range&&!hiding&&line(local,actor,p);
  const noise=p.noise&&root.elapsed-p.noise.time<.55&&Math.hypot(p.noise.x-actor.x,p.noise.z-actor.z)<p.noise.radius*[1.12,1.55,.85,.95][actor.kind]*difficulty.hearing;
  const value=d-(sight?8:0)-(noise?5:0)-(old===p?(actor.pursuit?8:4):0)+(assigned.get(p.id)??0)*6+(hiding&&old!==p?16:0);
  if(value<score){score=value;best=p;}
 }
 return best;
}
function updateSpawns(s,blocks,forward,dt,rng){
 const team=s.teamPlayers?.filter(p=>!p.failed),players=team??[s],difficulty=teamDifficulty(players.length,s.difficultyLevel,s.startCount??1);
 const director=s.hauntDirector??={delay:Math.max(5,(SPAWN_BALANCE.firstMin+rng()*4)*DIFFICULTIES[difficulty.level].interval),bag:[]};
 if(!players.length)return;
 for(const actor of s.haunt)actor.age+=dt;
 for(const actor of s.haunt){
  if(actor.age>actor.life&&players.every(p=>Math.hypot(p.x-actor.x,p.z-actor.z)>7)&&actor.state==='patrol')actor.state='disappear';
  if(actor.state==='disappear')actor.fade=(actor.fade??1)-dt/.65;
 }
 s.haunt=s.haunt.filter(actor=>(actor.fade??1)>0);
 const event=s.horrorEvent;
 if(event&&(event.time!==director.lastEvent?.time||event.type!==director.lastEvent?.type)){director.lastEvent=event;if(director.lastSpawn!=null&&rng()<(event.type==='delivery'?.85:event.type==='pickup'?.72:.42))director.delay=Math.min(director.delay,3+rng()*2);}
 director.delay-=dt;
 if(director.delay>0||s.haunt.length>=difficulty.maxActive)return;
 if(director.lastSpawn!=null&&(s.elapsed??0)-director.lastSpawn<difficulty.interval)return;
 const eligible=players.filter(p=>!closedLocker(p)&&!s.haunt.some(a=>a.state!=='disappear'&&(a.pursuit&&(!team||a.targetId===p.id)||!team&&Math.hypot(p.x-a.x,p.z-a.z)<12)));
 if(!eligible.length){director.delay=1.2;return;}
 const anchor=team?eligible[Math.floor(rng()*eligible.length)]??eligible[0]:eligible[0];
 if(!director.bag.length||!director.bag.some(k=>!s.haunt.some(a=>a.kind===k)))director.bag=randomOrder([0,1,2,3],rng);
 const slot=director.bag.findIndex(kind=>!s.haunt.some(actor=>actor.kind===kind));
 if(slot<0)return;
 const kind=director.bag[slot],type=cast[kind];
 const zone=(x,z)=>z>=78?(x<-15?6:7):z>=54?(x<-15?4:5):z>=22?(x<-15?3:2):x<-15?1:0;
 const currentZone=zone(anchor.x,anchor.z);
 const routes=routesFor(s),candidates=routes.flatMap((path,route)=>path.map(([x,z],index)=>({path,route,index,x,z})));
 const spawn=randomOrder(candidates,rng).sort((a,b)=>Number(zone(b.x,b.z)===currentZone)-Number(zone(a.x,a.z)===currentZone)).find(candidate=>{
  const {x,z,route}=candidate,dist=Math.hypot(x-anchor.x,z-anchor.z);
  if(!inMap(x,z,s)||dist<SPAWN_BALANCE.minDistance||dist>SPAWN_BALANCE.maxDistance||!clear(blocks,x,z,.63,type.float,bodyHeights[kind]))return false;
  if(s.haunt.some(a=>a.route===route||Math.hypot(a.x-x,a.z-z)<5))return false;
  return players.every(p=>{const d=Math.hypot(x-p.x,z-p.z);if(d<SPAWN_BALANCE.minDistance)return false;if(d>35)return true;const local=queryBlocks(s.navIndex,Math.min(x,p.x)-1,Math.min(z,p.z)-1,Math.max(x,p.x)+1,Math.max(z,p.z)+1);return hiddenSpawn(p,x,z,kind,local);});
 });
 if(!spawn){director.delay=1.8+rng()*1.7;return;}
 director.bag.splice(slot,1);
 const {path,route,index,x,z}=spawn,direction=rng()<.5?-1:1,pathIndex=(index+direction+path.length)%path.length;
 const yaw=Math.atan2(path[pathIndex][0]-x,path[pathIndex][1]-z);
 s.haunt.push({kind,route,path,direction,pathIndex,x,z,yaw,phase:rng()*Math.PI*2,
  state:'patrol',timer:0,speed:0,age:0,life:40+rng()*18,aggression:0,spawnGrace:SPAWN_BALANCE.grace});
 director.lastSpawn=s.elapsed??0;
 // A confined ceiling route in the deep lab. No arbitrary wall penetration.
 if(!team&&kind===3&&x>=13&&z>=56&&z<=75&&rng()<.72){
  const a=s.haunt.at(-1);
  if(Math.hypot(s.x-13.85,s.z-z)>=SPAWN_BALANCE.minDistance&&Math.hypot(s.x-13.85,s.z-z)<=SPAWN_BALANCE.maxDistance&&clear(blocks,13.85,z,.75,0,10.7)&&hiddenSpawn(s,13.85,z,kind,queryBlocks(s.navIndex,Math.min(13.85,s.x)-1,Math.min(z,s.z)-1,Math.max(13.85,s.x)+1,Math.max(z,s.z)+1),10.55)){
   a.x=13.85;a.state='ceilingStalk';a.surfaceY=10.55;a.surfaceRoll=Math.PI;a.surfaceDir=direction;a.timer=6.5;
  }
 }
 spawnCue(s,s.haunt.at(-1),true);
 director.delay=difficulty.interval+Math.max(2,5-(difficulty.count-1))+rng()*7-Math.min(4,(s.states?.filter(k=>k==='DELIVERED').length??0)*3.9/missionTotal(s));
}
// Sample the rendered wrist joints and torso through the active window.
function attackContact(actor,s,blocks){
 const layers=hauntLayers({x:s.x,z:s.z,haunt:[actor]}),joints=CREATURE_JOINTS[actor.kind];
 if(!layers.length)return false;
 const points=[10,11,0].map(index=>{
  const m=layers[index].matrix,p=index?joints[index].pivot:[0,eyeHeights[actor.kind]*.57,.11];
  return [0,1,2].map(k=>m[k]*p[0]+m[4+k]*(p[1]-(index?.06:0))+m[8+k]*(p[2]+(index?.08:0))+m[12+k]);
 });
 const old=actor.strikePoints??points;actor.strikePoints=points;
 return points.some((p,i)=>{
  const a=old[i],dx=p[0]-a[0],dz=p[2]-a[2],len=dx*dx+dz*dz;
  const t=len?clamp(((s.x-a[0])*dx+(s.z-a[2])*dz)/len,0,1):1;
  const x=a[0]+dx*t,z=a[2]+dz*t,y=a[1]+(p[1]-a[1])*t,r=i===2?sizes[actor.kind]:.095;
  const bodyY=clamp(y,s.y+.22,s.y+(s.bodyHeight??1.70)-.22);
  return Math.hypot(x-s.x,y-bodyY,z-s.z)<r+.255&&visible(blocks,[x,y,z],[s.x,bodyY,s.z]);
 });
}
export function updateHaunt(root,blocks,rootForward,dt,rng=Math.random){
 const s=root,routes=routesFor(root),team=Array.isArray(s.teamPlayers),difficulty=teamDifficulty(team?s.teamPlayers.filter(p=>!p.failed).length:1,s.difficultyLevel,s.startCount??1),assigned=new Map();
 if(!mapCache.has(blocks))mapCache.set(blocks,blocks.concat(worldBounds));
 const staticBlocks=mapCache.get(blocks);
 // Cargo geometry changes only on pickup, drop or delivery. Keep the same
 // spatial index between ticks so in-flight searches can finish.
 if(s.navStatic!==staticBlocks||s.navEvent!==s.horrorEvent||s.navCarried!==s.carried||s.navLockerRevision!==s.lockerRevision){
  s.navStatic=staticBlocks;s.navEvent=s.horrorEvent;s.navCarried=s.carried;
  s.navLockerRevision=s.lockerRevision;
  const dynamic=(s.states?parcelBlocks(s):[]).concat(lockerDoorBlocks(s));
  if(!staticNavCache.has(staticBlocks))staticNavCache.set(staticBlocks,indexBlocks(staticBlocks));
  s.navBlocks=staticBlocks.concat(dynamic);s.navIndex=indexBlocks(dynamic,staticNavCache.get(staticBlocks));
 }
 blocks=s.navBlocks;const nav=s.navIndex;
 s.haunt??=[];
 if(s.failed)return null;
 updateSpawns(s,blocks,rootForward,dt,rng);
 s.hauntCooldown=Math.max(0,(s.hauntCooldown??0)-dt);
 let captured=null;
 s.haunt.forEach(actor=>{
  if((captured&&!team)||actor.state==='disappear')return;
  if(team)actor.targetDelay=Math.max(0,(actor.targetDelay??0)-dt);
  const s=team?chooseTeamTarget(root,actor,nav,assigned,difficulty):root;if(!s)return;
  const forward=team?s.teamView??rootForward:rootForward;
  if(team){s.hauntSounds=root.hauntSounds??=[];s.hauntCooldown=root.hauntCooldown;if(actor.targetId!==s.id){actor.targetId=s.id;clearObservation(actor);actor.lastHeardTime=null;actor.sightDelay=0;actor.seenCache=false;actor.beam=0;if(!actor.climb){actor.pursuit=false;actor.lastKnown=null;actor.state='patrol';actor.navPath=null;actor.navJob=null;actor.navDelay=0;}}assigned.set(s.id,(assigned.get(s.id)??0)+1);}
  if((actor.spawnGrace??0)>0){
   const old=actor.spawnGrace;actor.spawnGrace=Math.max(0,old-dt);
   actor.speed=0;actor.phase+=dt*.65;
   if(old>1.25&&actor.spawnGrace<=1.25)spawnCue(s,actor);
   return;
  }
  const previous=actor.state;
  const i=actor.kind,type=cast[i],profile=HUNT_PROFILE[i],body={r:sizes[i],y:type.float,h:bodyHeights[i]},delta=[s.x-actor.x,s.z-actor.z],dist=Math.hypot(...delta);
  const local=queryBlocks(nav,Math.min(actor.x,s.x)-2,Math.min(actor.z,s.z)-2,Math.max(actor.x,s.x)+2,Math.max(actor.z,s.z)+2);
  if(actor.state==='ceilingStalk'||actor.state==='wallDescent'){
   actor.phase+=dt*8;actor.timer=Math.max(0,actor.timer-dt);
   const canSee=dist<10&&visible(local,[actor.x,5.6,actor.z],[s.x,s.y+1,s.z]);
   if(actor.state==='ceilingStalk'){
    const next=actor.z+(canSee?Math.sign(s.z-actor.z):actor.surfaceDir)*dt*2.8*.95;
    if(next>56&&next<76&&clear(blocks,actor.x,next,.75,0,10.7))actor.z=next;else actor.surfaceDir*=-1;
    actor.yaw=actor.surfaceDir>0?0:Math.PI;actor.speed=2.8*.95;
    if(canSee||!actor.timer){actor.state='wallDescent';actor.timer=1.4;(s.hauntSounds??=[]).push({x:actor.x,z:actor.z,kind:i,accent:true});}
   }else{
    const t=1-actor.timer/1.4;
    actor.surfaceY=10.55*(1-t);actor.surfaceRoll=Math.PI*(1-clamp((t-.08)/.70,0,1));actor.speed=1.8;
    if(!actor.timer){actor.surfaceY=0;actor.surfaceRoll=0;actor.state='patrol';actor.pursuit=false;actor.speed=0;actor.age=Math.max(actor.age,.65);}
   }
   return;
  }
  const hiding=closedLocker(s),entry=hiding?lockerEntry(hiding):null;
  const climb=updateClimber(actor,s,nav,local,dt,!!hiding);
  if(climb?.handled){if(actor.state==='disappear')return;if(climb.hit&&!s.netHitProtected&&(s.hitProtectedUntil??0)<=root.elapsed){actor.speed=0;captured=type.name;s.handAction=null;s.pendingUse=null;s.vault=null;s.jumpBuffer=0;s.vx=s.vz=s.vy=0;s.failed=true;s.capturedBy=i;}return;}
  const safe=s.grounded&&REFUGES.some(([x,y,z,r])=>Math.abs(s.y-y)<.09&&Math.hypot(s.x-x,s.z-z)<r);
  const pursuit=actor.pursuit??false,torchOn=(s.flashAmount??0)>.25;
  const detectRange=type.range*difficulty.range*1.04*(s.bodyHeight<1.2&&!torchOn?.67:1);
  const near=dist<5.5,range=pursuit?24+(difficulty.count-1)*2:Math.max(5.5,detectRange);
  actor.sightDelay=(actor.sightDelay??0)-dt;
  // Immediately test entry into the close zone or a newly switched-on light.
  const sampledSight=actor.sightDelay<=0||near!==actor.wasNear||torchOn!==actor.wasTorch;
  if(sampledSight){
   actor.sightDelay=near?.032:.068+i*.009;
   actor.seenCache=dist<Math.max(range,torchOn?20:0)&&line(local,actor,s);
   actor.beam=lightSense(local,actor,s,forward);
   actor.wasNear=near;actor.wasTorch=torchOn;
  }
  const lit=!hiding&&!safe&&torchOn&&(actor.beam??0)>.25;
  const seen=!hiding&&!safe&&actor.seenCache&&(dist<range||torchOn&&dist<type.range*difficulty.range+4)||lit;
  const acquired=seen&&!pursuit;
  const noise=s.noise,hearing=[1.12,1.55,.85,.95][i]*difficulty.hearing*profile.hearing;
  const heard=!hiding&&noise&&s.elapsed-noise.time<.55&&Math.hypot(noise.x-actor.x,noise.z-actor.z,noise.y-eyeHeights[i])<noise.radius*hearing;
  if(!hiding&&actor.lockerId){
   const done=actor.lockerDone;
   if(done){const route=routes.filter(path=>path.every(p=>Math.hypot(p[0]-s.x,p[1]-s.z)>9)).sort((a,b)=>Math.hypot(a[0][0]-actor.x,a[0][1]-actor.z)-Math.hypot(b[0][0]-actor.x,b[0][1]-actor.z))[0];if(route){actor.path=route;actor.pathIndex=0;}}
   actor.lockerId=null;actor.lockerAway=null;actor.lockerDone=false;
   if(['lockerSearch','lockerWait','lockerLeave','lockerAway'].includes(actor.state)){actor.state=done?'patrol':'search';actor.pursuit=!done;actor.timer=4;actor.navDelay=0;actor.navPath=null;actor.navJob=null;}
  }
  if(seen){
   if(sampledSight||!actor.observedPoint)observePlayer(actor,s);
   actor.lastKnown=(actor.observedPoint??[s.x,s.z]).slice();actor.lost=0;actor.pursuit=true;actor.searchPoint=null;actor.inspect=null;actor.checked=[];actor.sweepChecked=[];actor.inspectRetry=0;actor.fakeDone=false;
   if(acquired||['fakeLeave','ambush','inspect','guard','patrol'].includes(actor.state)){
    actor.state='alert';actor.timer=0;actor.navDelay=0;actor.navDirect=false;actor.navPath=null;actor.navJob=null;actor.recoverPoint=null;
    actor.speed=Math.max(actor.speed??0,2.6);actor.aggression=Math.max(actor.aggression??0,.65);
    actor.reveal=1;
   }
  }
  else {actor.lost=(actor.lost??0)+dt;if(heard&&noise.time!==actor.lastHeardTime){actor.lastHeardTime=noise.time;actor.lastKnown=[noise.x,noise.z];actor.lost=0;actor.searchPoint=null;clearObservation(actor);if(actor.pursuit)actor.inspect=null;}}
  // Do not give up just because one frame of sight was blocked.
  // Once acquired, continue to the last seen position and sweep the area.
  if(actor.pursuit&&!seen&&!hiding&&searchExpired(actor,difficulty,dist)){
   actor.pursuit=false;actor.state='patrol';actor.lastKnown=null;actor.corner=null;actor.inspect=null;actor.fakeDone=false;actor.searchPoint=null;clearObservation(actor);actor.navDelay=0;
  }
  if(i===3&&s.horrorEvent?.type==='drop'&&s.elapsed-s.horrorEvent.time<.55&&dist<4){actor.state='disappear';return;}
  actor.lightReaction=approach(actor.lightReaction??0,lit?1:0,dt*9);
  actor.reveal=Math.max(0,(actor.reveal??0)-dt*2.8);
  const repelled=lit&&(i===0||i===3);
  actor.timer=Math.max(0,actor.timer-dt);
  if(hiding&&(actor.lockerId===hiding.id||actor.pursuit||actor.state==='search'||dist<6)){
   if(actor.lockerId!==hiding.id){
    actor.lockerId=hiding.id;actor.lockerDone=false;actor.lockerAway=null;actor.state='lockerSearch';actor.timer=12;
    actor.pursuit=false;actor.lastKnown=entry;actor.inspect=null;actor.searchPoint=null;actor.navDelay=0;actor.navPath=null;actor.navJob=null;actor.recoverPoint=null;
   }
   const chooseAway=()=>{
    const body={r:sizes[i],y:type.float,h:bodyHeights[i]},here=[actor.x,actor.z];
    const options=routes.flat().filter(p=>Math.hypot(p[0]-hiding.x,p[1]-hiding.z)>11&&Math.hypot(p[0]-actor.x,p[1]-actor.z)<28&&Math.hypot(p[0]-actor.x,p[1]-actor.z)>3&&clear(blocks,p[0],p[1],sizes[i],type.float,bodyHeights[i]));
    options.sort((a,b)=>Math.hypot(a[0]-actor.x,a[1]-actor.z)-Math.hypot(b[0]-actor.x,b[1]-actor.z));
    const direct=options.find(p=>segmentFree(nav,here,p,body));
    return direct??options[0]??actor.lockerAway??here;
   };
   if(actor.state==='lockerSearch'&&(Math.hypot(actor.x-entry[0],actor.z-entry[1])<.65||!actor.timer)){
    actor.state='lockerWait';actor.timer=(torchOn?7:4.5)+rng()*2+[.4,.9,.25,.65][i];actor.lockerPaceOrigin=[actor.x,actor.z];actor.navDelay=0;
   }else if(actor.state==='lockerWait'&&!actor.timer){
    actor.lockerAway=chooseAway();actor.state='lockerLeave';actor.timer=12;actor.navDelay=0;actor.navJob=null;actor.navPath=null;actor.recoverPoint=null;
   }else if(actor.state==='lockerLeave'&&Math.hypot(actor.x-hiding.x,actor.z-hiding.z)>10){
    actor.lockerDone=true;actor.state='lockerAway';actor.pursuit=false;actor.lastKnown=null;
   }else if((actor.state==='lockerLeave'&&!actor.timer)||(actor.state==='lockerAway'&&actor.lockerAway&&Math.hypot(actor.x-actor.lockerAway[0],actor.z-actor.lockerAway[1])<.7)){
    actor.lockerAway=chooseAway();actor.timer=12;actor.navDelay=0;actor.navPath=null;actor.navJob=null;actor.recoverPoint=null;
   }
  }else if(safe&&(actor.pursuit||actor.state==='guard')){
   if(actor.state!=='guard'){actor.state='guard';actor.timer=2.6;actor.guardPoint=actor.lastKnown??[actor.x,actor.z];actor.pursuit=false;actor.corner=null;}
   if(!actor.timer){actor.state='patrol';actor.lastKnown=null;}
  }else if(actor.state==='guard'){
   actor.state='search';actor.pursuit=true;actor.lastKnown=actor.guardPoint;actor.timer=4;
  }else if(repelled){
   actor.state='retreat';actor.timer=.20;
  }else if(actor.state==='retreat'){
   // Reacquire immediately when the beam leaves the body.
   if(seen||!actor.timer){actor.state=actor.pursuit?'alert':'patrol';actor.timer=0;actor.navDelay=0;}
  }else if(actor.state==='windup'){
   if(seen&&actor.timer>.065)actor.chargeTarget=[s.x,s.z];
   if(!actor.timer){actor.state='charge';actor.timer=.62;}
  }else if(actor.state==='charge'){
   if(seen&&actor.timer>.30)actor.chargeTarget=[s.x,s.z];
   if(!actor.timer){actor.state='recovery';actor.timer=[.12,.16,.23,.11][i];}
  }else if(actor.state==='recovery'){
   if(!actor.timer)actor.state=actor.pursuit?'alert':heard?'search':'patrol';
   }else if(actor.state==='fakeLeave'||actor.state==='ambush'||actor.state==='inspect'){
   if(heard){actor.state='search';actor.pursuit=true;actor.inspect=null;}
   else if(!actor.timer){
    if(actor.state==='fakeLeave'){actor.state='ambush';actor.timer=1.0+i*.18;actor.corner=null;}
    else if(actor.state==='ambush'){actor.state='search';actor.pursuit=true;actor.searchPoint=null;actor.inspect=null;actor.corner=null;}
    else {actor.state='search';actor.inspect=null;actor.searchPoint=null;}
   }
  }else if(actor.pursuit){
   actor.state=seen?'alert':'search';
   if(actor.age>.65&&seen&&dist<(i===2?2.75:1.80)&&s.y<eyeHeights[i]+.24){
    actor.state='windup';actor.timer=[.18,.22,.28,.17][i];actor.chargeTarget=[s.x,s.z];
   }
  }else if(heard){actor.state='search';actor.timer=5;}
  else if(actor.state==='search'&&!actor.timer){actor.state='patrol';actor.lastKnown=null;}
  // Follow one plausible continuation of the last observed motion, then sweep.
  if(actor.state==='search'&&actor.lastKnown&&!seen&&!safe&&!hiding&&!actor.trailUsed&&Math.hypot(actor.x-actor.lastKnown[0],actor.z-actor.lastKnown[1])<1.3){
   const trail=lostTrail(actor,nav,body);if(trail){actor.lastKnown=trail.slice();actor.searchPoint=null;actor.inspect=null;actor.navDelay=0;}
  }
  // Inspect likely hiding entrances using only the last known position.
  if(actor.state==='search'&&actor.lastKnown&&!seen&&!safe){
   const nearLast=Math.hypot(actor.x-actor.lastKnown[0],actor.z-actor.lastKnown[1])<2.5;
   if(nearLast||actor.inspect){
    actor.checked??=[];
    actor.inspectRetry=Math.max(0,(actor.inspectRetry??0)-dt);
    if(!actor.inspect&&!actor.inspectRetry){
     actor.inspectRetry=.35;
     actor.inspect=[...HIDING_POINTS,...DRESSING_HIDE,...(expandedLayout(root)?EXTENSION_HIDE:[])].filter(p=>!alreadyChecked(actor,p)&&Math.hypot(p[0]-actor.lastKnown[0],p[1]-actor.lastKnown[1])<7&&clear(blocks,p[0],p[1],sizes[i],type.float,bodyHeights[i])).sort((a,b)=>hidingScore(actor,a)-hidingScore(actor,b))[0]??null;
    }
    if(actor.inspect&&Math.hypot(actor.x-actor.inspect[0],actor.z-actor.inspect[1])<.85){actor.checked.push(actor.inspect);actor.state='inspect';actor.timer=.65+i*.13;}
    else if(!actor.inspect&&!actor.fakeDone&&(actor.lost??0)>2.1){
     const center=actor.lastKnown;
     const away=routes.flat().filter(p=>Math.hypot(p[0]-center[0],p[1]-center[1])>4&&Math.hypot(p[0]-center[0],p[1]-center[1])<10&&clear(blocks,p[0],p[1],sizes[i],type.float,bodyHeights[i])).sort((a,b)=>Math.hypot(a[0]-actor.x,a[1]-actor.z)-Math.hypot(b[0]-actor.x,b[1]-actor.z))[0];
     if(away){actor.fakeDone=true;actor.fakeTarget=away;actor.state='fakeLeave';actor.timer=2.4+i*.25;actor.corner=null;actor.routeDelay=0;}
    }
   }
  }
  const chasing=actor.pursuit&&['alert','search','charge','recovery','windup'].includes(actor.state);
  if(actor.state==='search'&&!actor.inspect&&actor.lastKnown&&(actor.searchPoint||Math.hypot(actor.x-actor.lastKnown[0],actor.z-actor.lastKnown[1])<.75)){
   actor.searchDelay=(actor.searchDelay??0)-dt;
   if(!actor.searchPoint||actor.searchDelay<=0||Math.hypot(actor.x-actor.searchPoint[0],actor.z-actor.searchPoint[1])<.65){
    if(actor.searchPoint&&Math.hypot(actor.x-actor.searchPoint[0],actor.z-actor.searchPoint[1])<.9)rememberSweep(actor,actor.searchPoint);
    actor.searchDelay=1.2;
    const phase=(actor.scanPhase??0)+2.40;actor.scanPhase=phase;
    const center=actor.lastKnown;
    for(let k=0;k<8;k++){const angle=searchBearing(actor,phase)+k*Math.PI/4,r=1.5+(k%3)*.85,x=center[0]+Math.sin(angle)*r,z=center[1]+Math.cos(angle)*r;
     if(inMap(x,z,root)&&!sweepVisited(actor,[x,z])&&clear(blocks,x,z,sizes[i],type.float,bodyHeights[i])){actor.searchPoint=[x,z];break;}}
   }
  }
  const path=actor.path;
  actor.aggression=approach(actor.aggression,chasing?1:actor.state==='windup'?.75:0,dt*5.5);
  if(actor.state==='patrol'&&Math.hypot(path[actor.pathIndex][0]-actor.x,path[actor.pathIndex][1]-actor.z)<.5)
   actor.pathIndex=(actor.pathIndex+actor.direction+path.length)%path.length;
  const target=actor.state==='lockerSearch'?entry:actor.state==='lockerWait'?[(actor.lockerPaceOrigin?.[0]??actor.x)+Math.sin(actor.age*2.1)*.36,actor.lockerPaceOrigin?.[1]??actor.z]:['lockerLeave','lockerAway'].includes(actor.state)?(actor.lockerAway??[actor.x,actor.z]):actor.state==='guard'?(actor.guardPoint??[actor.x,actor.z]):actor.state==='fakeLeave'?(actor.fakeTarget??[actor.x,actor.z]):actor.state==='ambush'?[actor.x,actor.z]:actor.inspect&&(actor.state==='search'||actor.state==='inspect')?actor.inspect:(actor.state==='charge'||actor.state==='windup')?(actor.chargeTarget??actor.lastKnown??[s.x,s.z]):actor.state==='search'&&actor.lastKnown?(actor.searchPoint??actor.lastKnown):chasing?(seen?pursueVisible(actor,s,nav,body,dt):(actor.lastKnown??path[actor.pathIndex])):path[actor.pathIndex];
  const retreat=actor.state==='retreat';
  const still=actor.state==='inspect'||actor.state==='ambush';
  if(actor.navState!==actor.state){actor.navState=actor.state;actor.navDelay=0;actor.navDirect=false;if(still||retreat){actor.navPath=null;actor.navJob=null;actor.recoverPoint=null;}}
  const seek=retreat?[actor.x-delta[0]/Math.max(.01,dist)*2,actor.z-delta[1]/Math.max(.01,dist)*2]:target;
  const resolved=!still&&recover(actor,nav,body,seek,dt);
  const aim=still||resolved?null:navigate(actor,seek,nav,body,dt,difficulty.budget*(root.stateless?4:1));
  actor.corner=aim;
  const heading=aim??[actor.x,actor.z];
  const desired=actor.state==='lockerWait'?Math.atan2(s.x-actor.x,s.z-actor.z)+Math.sin(actor.age*2.5)*.23:actor.state==='inspect'||actor.state==='ambush'?actor.yaw+Math.sin(actor.age*2.4)*.09:aim?Math.atan2(heading[0]-actor.x,heading[1]-actor.z):actor.yaw;
  actor.yaw+=clamp(Math.atan2(Math.sin(desired-actor.yaw),Math.cos(desired-actor.yaw)),-dt*(chasing?12:7),dt*(chasing?12:7));
  const pressure=(1+Math.min(1,(s.states?.filter(k=>k==='DELIVERED').length??0)/missionTotal(s))*.19)*difficulty.speed;
  const rage=lit&&(i===1||i===2)?1.14:1;
  // Different chase rhythms; the telegraphed charge is faster than sprinting.
  const pulse=i===0?.88+.22*Math.sin(actor.phase*.73):i===1?.91+.18*Math.sin(actor.phase*.46):i===2?.94+.10*Math.sin(actor.phase*.31):.87+.26*Math.pow(.5+.5*Math.sin(actor.phase*.69),3);
  const goalSpeed=.95*(actor.state==='lockerWait'?.70:actor.state==='lockerSearch'?3.0:['lockerLeave','lockerAway'].includes(actor.state)?2.8:actor.state==='ambush'||actor.state==='inspect'?0:actor.state==='fakeLeave'?2.3:actor.state==='guard'?Math.hypot(actor.x-target[0],actor.z-target[1])>1.3?2.5:0:retreat?3.3:actor.state==='windup'?type.speed*.38:actor.state==='charge'?Math.min(11.05,type.speed*1.32*pressure):actor.state==='recovery'?type.speed*.72:chasing?Math.min(10.9,type.speed*profile.speed*pressure*pulse*rage*(actor.state==='search'?.88*profile.search:1)):actor.state==='search'?2.8:1.35);
  actor.speed=approach(actor.speed,aim?goalSpeed:0,dt*(actor.state==='charge'?18:chasing?[23,22,20,25][i]:7));
  const before=[actor.x,actor.z],distance=aim?Math.hypot(aim[0]-actor.x,aim[1]-actor.z):0;
  const stride=Math.min(actor.speed*dt,distance);
  let moved=resolved;
  if(aim&&stride>1e-5&&!resolved&&goalSpeed>0){
   // Travel towards the collision-checked waypoint, independently of cosmetic body yaw.
   for(const turn of [0,.32,-.32,.68,-.68,1.1,-1.1,1.55,-1.55]){
    const angle=(actor.state==='lockerWait'?Math.atan2(heading[0]-actor.x,heading[1]-actor.z):desired)+turn,p=[actor.x+Math.sin(angle)*stride,actor.z+Math.cos(angle)*stride];
    if(segmentFree(nav,before,p,body,0)){actor.x=p[0];actor.z=p[1];moved=true;break;}
   }
  }
  const wantsMove=!still&&goalSpeed>.1&&(Math.hypot(seek[0]-actor.x,seek[1]-actor.z)>.65||!freeAt(nav,actor.x,actor.z,body));
  if(trappedTooLong(actor,wantsMove,dt)){actor.state='disappear';actor.speed=0;actor.navJob=null;actor.navPath=null;actor.recoverPoint=null;return;}
  actor.stuck=wantsMove&&!moved?(actor.stuck??0)+dt:Math.max(0,(actor.stuck??0)-dt*2);
  // Detect oscillation at a corner even when every tiny step is technically valid.
  actor.progressClock=(actor.progressClock??0)+dt;
  if(actor.progressClock>=.55){
   const progress=actor.progressAnchor?Math.hypot(actor.x-actor.progressAnchor[0],actor.z-actor.progressAnchor[1]):1;
   if(wantsMove&&progress<.23)actor.stuck=Math.max(actor.stuck,.65);
   actor.progressAnchor=[actor.x,actor.z];actor.progressClock=0;
  }
  if(!moved&&wantsMove){actor.navDelay=Math.min(actor.navDelay??0,.075);actor.speed*=.86;}
  const beat=Math.floor(actor.phase/Math.PI);
  actor.phase+=dt*(1+actor.speed*(i===2?5.3:2.4));
  if(acquired||previous!==actor.state||beat!==Math.floor(actor.phase/Math.PI)){
   (s.hauntSounds??=[]).push({x:actor.x,z:actor.z,kind:i,accent:acquired||previous!==actor.state});
   if(s.hauntSounds.length>4)s.hauntSounds.shift();
  }
  if(actor.state!=='charge')actor.strikePoints=null;
  const striking=actor.state==='charge'&&dist<2.8&&attackContact(actor,s,local);
  const strikeHeight=eyeHeights[i]-.30;
  const vertical=Math.max(0,s.y-strikeHeight,strikeHeight-s.y-(s.bodyHeight??1.70));
  const hitDx=s.x-actor.x,hitDz=s.z-actor.z,hitDist=Math.hypot(hitDx,hitDz);
  const aligned=(Math.sin(actor.yaw)*hitDx+Math.cos(actor.yaw)*hitDz)/Math.max(.001,hitDist);
  if(!hiding&&!safe&&!s.netHitProtected&&(s.hitProtectedUntil??0)<=root.elapsed&&striking&&(!captured||team)&&actor.age>.65&&actor.timer<.56&&line(local,actor,s)&&aligned>.40&&visible(local,[actor.x,strikeHeight,actor.z],[s.x,clamp(strikeHeight,s.y+.1,s.y+(s.bodyHeight??1.7)-.1),s.z])&&Math.hypot(hitDist,vertical)<armReach[i]&&s.hauntCooldown===0){
   actor.speed=0;captured=type.name;
   s.handAction=null;s.pendingUse=null;s.vault=null;s.jumpBuffer=0;s.vx=s.vz=s.vy=0;s.failed=true;s.capturedBy=i;
  }
 });
 return captured;
}

export const ACTOR_START=11;
export const CREATURE_GROUP_COUNT=CREATURE_JOINTS.reduce((sum,joints)=>sum+joints.length,0);
export const buildHauntRigs=buildCreatureRigs;
function matrix(position,angles=[0,0,0],scale=1){
 return new Float32Array([...basis(...angles).flatMap(axis=>[...axis.map(v=>v*scale),0]),...position,1]);
}
export function hauntLayers(s,hasSkin=null){
 return (s.haunt??[]).flatMap(a=>{
  const i=a.kind,type=cast[i],joints=CREATURE_JOINTS[i];
  if(Math.hypot(a.x-s.x,a.z-s.z)>35)return [];

  const stride=Math.min(i===2?.95:.78,a.speed*.19),swing=Math.sin(a.phase)*stride,reach=a.aggression;
  const float=type.float>0;
  const rise=float?Math.sin(a.phase*.66)*.093+type.float:Math.abs(swing)*(i===2?.14:.088);
  const angles=[
   [reach*(i===2?.27:.13),.075*swing,.115*swing],
   [-.09*reach,.18*Math.sin(a.phase*.38),.075*Math.cos(a.phase*.43)],
   [swing-reach*.66,.11*reach,-.08-swing*.09],[-swing-reach*.66,-.11*reach,.08-swing*.09],
   [-swing,0,.04],[swing,0,-.04],
   [-.12-Math.max(0,swing)*.55-reach*.24,0,.07*Math.sin(a.phase*.77)],
   [-.12+Math.min(0,swing)*.55-reach*.24,0,-.07*Math.sin(a.phase*.77)],
   [Math.max(0,swing)*.83,0,0],[Math.max(0,-swing)*.83,0,0],
   [.15*Math.cos(a.phase*.74)-reach*.16,0,-.07],[.15*Math.sin(a.phase*.74)-reach*.16,0,.07],
   [.23*Math.sin(a.phase*.97)+reach*.12,.16*Math.cos(a.phase*.67),.22*Math.sin(a.phase*.78)]
  ];
  if(['inspect','ambush','guard','lockerWait'].includes(a.state)){angles[1][1]+=.75*Math.sin(a.age*2.7);angles[1][2]+=.29*Math.cos(a.age*2.1);angles[0][0]+=.13;}
  if(['climbUp','climbDown','climbTop','climbWindup'].includes(a.state)){const step=Math.sin(a.phase*1.5);angles[0][0]+=.30;angles[2][0]-=.75+step*.26;angles[3][0]-=.75-step*.26;angles[6][0]-=.18+Math.max(0,step)*.40;angles[7][0]-=.18+Math.max(0,-step)*.40;if(a.state==='climbWindup'){angles[0][0]+=.35;angles[2][0]-=.45;angles[3][0]-=.45;}}
  const reaction=a.lightReaction??0,reveal=a.reveal??0;
  if(reaction>0){angles[1][2]+=(i===0||i===3?.48:.25)*reaction*Math.sin(a.phase*2.3);angles[0][0]+=(i===0||i===3?-.20:.18)*reaction;angles[2][0]-=.20*reaction;}
  angles[1][1]+=.35*reveal*Math.sin(a.phase*2.1);angles[0][0]+=.15*reveal;
  const coil=a.state==='windup'?clamp(1-a.timer/[.18,.22,.28,.17][i],0,1):0;
  const strike=a.state==='charge'?Math.sin(Math.PI*clamp((.62-a.timer)/.57,0,1)):0;
  if(a.pursuit||a.state==='charge'||a.state==='alert'){
   // Independent pose rhythms, bounded joint angles, continuous animation.
   const twitch=Math.sin(a.phase*1.7)*.65+Math.sin(a.phase*3.37)*.35;
   const lurch=Math.pow(.5+.5*Math.sin(a.phase*.79),3);
   angles[0][0]+=[.18,.54,.65,.30][i]*reach;
   angles[0][2]+=[.24,.18,.08,.27][i]*Math.sin(a.phase*.52)*reach;
   angles[1][2]+=[.62,.30,.14,.73][i]*twitch*reach;
   angles[1][1]+=[.48,.18,.12,.58][i]*Math.sin(a.phase*.83)*reach;
   angles[2][0]-=[.48,.65,.34,.78][i]*reach;
   angles[3][0]-=[.62,.45,.37,.61][i]*reach;
   angles[2][2]-=[.32,.21,.12,.37][i]*lurch*reach;
   angles[3][2]+=[.22,.35,.17,.42][i]*(1-lurch)*reach;
   angles[6][0]-=.24*lurch*reach;angles[7][0]-=.25*(1-lurch)*reach;
  }
  if(i===0){
   angles[0][1]+=.22*Math.sin(a.phase*.41);angles[12][0]+=.32*Math.sin(a.phase*.41-.9);
   angles[2][2]-=.19*Math.cos(a.phase*.59);angles[3][2]+=.21*Math.cos(a.phase*.59-.6);
  }else if(i===1){
   angles[1][0]+=.13*Math.sin(a.phase-.8);angles[2][0]-=.66*strike;
   angles[0][0]+=.16*coil+.12*Math.abs(swing);angles[6][0]-=.32*strike;
  }else if(i===2){
   angles[0][0]+=.42*coil+.22*strike;
   angles[8][0]+=.5*coil;angles[9][0]+=.5*coil;angles[12][2]+=.19*Math.sin(a.phase-1.1);
  }else{
   angles[1][1]+=.30*Math.sin(a.phase*.43);angles[10][1]+=.36*Math.sin(a.phase*.71);
   angles[11][0]-=.65*strike;angles[12][2]+=.30*Math.sin(a.phase*1.24-.7);
  }
  const emergence=clamp((a.age??1)/.42,.02,1);
  const leaving=1-(a.fade??1);
  const flicker=i===0&&!['charge','windup','retreat'].includes(a.state)?
   clamp((Math.sin(a.phase*.64)+.35*Math.sin(a.phase*3.3)+1.13)/.25,.08,1):1;
  const opacity=emergence*(1-leaving)*flicker;
  const surface=a.surfaceY??0,roll=a.surfaceRoll??0;
  const root=matrix([a.x,surface+rise*(1-Math.min(1,surface))-.09*coil-(1-emergence)*.14+leaving*(float?.24:-.09),a.z],[0,a.yaw,roll]);
  const skinName=['ghost','boxhead','imp','wraith'][i];
  const skin={name:skinName,kind:i,root,angles,floor:!float&&Math.abs(roll)<.02&&emergence>.98&&leaving<.02&&!['climbUp','climbDown','climbTop','climbWindup'].includes(a.state)?surface:null};
  if(hasSkin?.(skinName))return [{group:ACTOR_START+i*joints.length,matrix:root,opacity,skinName,skin,root:[a.x,surface+1,a.z],footprint:surface<.5?[a.x,a.z,i===2?.37:i===1?.45:.62,float?.16:.49]:null}];
  const boneMatrices=[];
  return joints.map(({pivot,parent},j)=>{
   const joint=multiply(matrix(pivot,angles[j]),matrix(pivot.map(v=>-v)));
   const bone=multiply(parent===undefined?root:boneMatrices[parent],joint);
   boneMatrices.push(bone);
   return {group:ACTOR_START+i*joints.length+j,matrix:bone,opacity,skinName,skin:j===0?skin:null,root:[a.x,surface+1,a.z],
    footprint:j===0&&surface<.5?[a.x,a.z,i===2?.37:i===1?.45:.62,float?.16:.49]:null};
  });
 });
}
