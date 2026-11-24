import {parcelBlocks} from './mission.js';
import {worldBounds} from './movement.js';
import {traceBox} from './contact.js';
import {basis,multiply,dot} from './world.js';
import {buildCreatureRigs,CREATURE_JOINTS} from './creature-models.js';

const cast=[
 {name:'녹령',kind:'flicker',speed:5.15,range:11,float:.35},
 {name:'함귀',kind:'boxhead',speed:4.95,range:10,float:0},
 {name:'적재귀',kind:'imp',speed:5.85,range:10,float:0},
 {name:'표찰귀',kind:'wraith',speed:5.35,range:11,float:.38}
];
// Shared patrol loops. A creature can start from any of these loops and either direction.
const routes=[
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
 [[-40,27],[-39,33],[-40,44],[-38,51]]
];
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
function line(blocks,actor,s){
 const eye=[actor.x,eyeHeights[actor.kind??0],actor.z],h=s.bodyHeight??1.7;
 const targets=[[0,h-.15],[-.18,h*.56],[.18,h*.56]];
 if(s.showTraversal)actor.rays=[];
 let seen=false;
 for(const [offset,height] of targets){
  const to=[s.x+offset,s.y+height,s.z],open=visible(blocks,eye,to);
  if(s.showTraversal)actor.rays.push({from:eye,to,open});
  if(open){seen=true;if(!s.showTraversal)break;}
 }
 return seen;
}
const mapCache=new WeakMap();
const bodyHeights=[1.85,1.8,.95,1.95];
const inMap=(x,z)=>x>-42.5&&x<14.35&&z>-21.1&&z<53.5&&(x>=-15||z>-8.65);
const sizes=[.35,.34,.44,.32];
function detour(actor,target,blocks){
 const cell=.65,r=sizes[actor.kind],y=cast[actor.kind].float,h=bodyHeights[actor.kind];
 const local=blocks.filter(b=>b[2]>actor.x-14&&b[0]<actor.x+14&&b[3]>actor.z-14&&b[1]<actor.z+14);
 const gx=Math.round((target[0]-actor.x)/cell),gz=Math.round((target[1]-actor.z)/cell);
 const queue=[[0,0,null,0]],visited=new Set(['0,0']);
 for(let n=0;queue.length&&n<340;n++){
  queue.sort((a,b)=>b[3]-a[3]);
  const [cx,cz,first]=queue.pop();
  if(Math.abs(cx-gx)+Math.abs(cz-gz)<=1)return first;
  for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const nx=cx+dx,nz=cz+dz,key=nx+','+nz;
   if(visited.has(key))continue;
   visited.add(key);
   const x=actor.x+nx*cell,z=actor.z+nz*cell;
   if(!inMap(x,z)||Math.abs(nx)>19||Math.abs(nz)>19||!clear(local,x,z,r,y,h)||!clear(local,x-dx*cell/2,z-dz*cell/2,r,y,h))continue;
   queue.push([nx,nz,first??[x,z],Math.hypot(nx-gx,nz-gz)+.18*Math.hypot(nx,nz)]);
  }
 }
 return null;
}
function updateSpawns(s,blocks,forward,dt,rng){
 const director=s.hauntDirector??={delay:1.8+rng()*2.8,bag:[]};
 for(const actor of s.haunt)actor.age+=dt;
 for(const actor of s.haunt){
  if(actor.age>actor.life&&Math.hypot(s.x-actor.x,s.z-actor.z)>7&&actor.state==='patrol')actor.state='disappear';
  if(actor.state==='disappear')actor.fade=(actor.fade??1)-dt/.65;
 }
 s.haunt=s.haunt.filter(actor=>(actor.fade??1)>0);
 const event=s.horrorEvent;
 if(event&&event!==director.lastEvent){director.lastEvent=event;if(rng()<(event.type==='delivery'?.85:event.type==='pickup'?.72:.42))director.delay=Math.min(director.delay,.45+rng()*1.1);}
 director.delay-=dt;
 if(director.delay>0||s.haunt.length>=2)return;
 if(!director.bag.length)director.bag=randomOrder([0,1,2,3],rng);
 const slot=director.bag.findIndex(kind=>!s.haunt.some(actor=>actor.kind===kind));
 if(slot<0)return;
 const kind=director.bag[slot],type=cast[kind];
 const candidates=routes.flatMap((path,route)=>path.map(([x,z],index)=>({path,route,index,x,z})));
 const spawn=randomOrder(candidates,rng).find(candidate=>{
  const {x,z,route}=candidate,dx=x-s.x,dz=z-s.z,dist=Math.hypot(dx,dz);
  if(!inMap(x,z)||dist<6.2||dist>20||!clear(blocks,x,z,.63,type.float,bodyHeights[kind]))return false;
  if(s.haunt.some(a=>a.route===route||Math.hypot(a.x-x,a.z-z)<5))return false;
  return dot(forward,[dx/dist,0,dz/dist])<.47||!line(blocks,{...candidate,kind},s);
 });
 if(!spawn){director.delay=.85+rng()*.75;return;}
 director.bag.splice(slot,1);
 const {path,route,index,x,z}=spawn,direction=rng()<.5?-1:1,pathIndex=(index+direction+path.length)%path.length;
 const yaw=Math.atan2(path[pathIndex][0]-x,path[pathIndex][1]-z);
 s.haunt.push({kind,route,path,direction,pathIndex,x,z,yaw,phase:rng()*Math.PI*2,
  state:'patrol',timer:0,speed:0,age:0,life:25+rng()*18,aggression:0});
 director.delay=Math.max(4,8+rng()*6-Math.min(6,(s.states?.filter(k=>k==='DELIVERED').length??0)*.2));
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
export function updateHaunt(s,blocks,forward,dt,rng=Math.random){
 if(!mapCache.has(blocks))mapCache.set(blocks,blocks.concat(worldBounds));
 blocks=mapCache.get(blocks).concat(s.states?parcelBlocks(s):[]);
 s.haunt??=[];
 if(s.encounterHit){
  s.encounterHit.time-=dt;
  if(s.encounterHit.time<=0){
   const name=s.encounterHit.name;s.encounterHit=null;
   s.handAction=null;s.pendingUse=null;s.vault=null;s.jumpBuffer=0;s.vx=s.vz=0;s.vy=0;s.failed=true;
   return name;
  }
  return null;
 }
 if(s.failed)return null;
 updateSpawns(s,blocks,forward,dt,rng);
 s.hauntCooldown=Math.max(0,(s.hauntCooldown??0)-dt);
 s.haunt.forEach(actor=>{
  if(actor.state==='disappear')return;
  const previous=actor.state;
  const i=actor.kind,type=cast[i],delta=[s.x-actor.x,s.z-actor.z],dist=Math.hypot(...delta);
  const local=blocks.filter(b=>b[2]>Math.min(actor.x,s.x)-2&&b[0]<Math.max(actor.x,s.x)+2&&b[3]>Math.min(actor.z,s.z)-2&&b[1]<Math.max(actor.z,s.z)+2);
  const seen=dist<type.range*(s.bodyHeight<1.2&&!s.flashlight? .62:1)&&line(local,actor,s);
  const noise=s.noise;
  const heard=noise&&s.elapsed-noise.time<.55&&Math.hypot(noise.x-actor.x,noise.z-actor.z,noise.y-eyeHeights[i])<noise.radius*(seen?1:.62);
  if(seen)actor.lastKnown=[s.x,s.z];else if(heard)actor.lastKnown=[noise.x,noise.z];
  if(actor.state==='patrol'&&heard&&!seen){actor.state='search';actor.timer=2.6;}
  if(actor.state==='alert'&&!seen){actor.state='search';actor.timer=5.2;}
  if(actor.state==='alert'&&seen)actor.timer=3.0;
  if(i===3&&s.horrorEvent?.type==='drop'&&s.elapsed-s.horrorEvent.time<.55&&dist<4){actor.state='disappear';return;}
  if(actor.age>.65&&actor.state==='alert'&&seen&&dist<(i===2?2.65:1.65)&&s.y<eyeHeights[i]+.24){
   actor.state='windup';actor.timer=[.32,.39,.48,.37][i];actor.chargeTarget=[s.x,s.z];
  }
  const lit=seen&&s.flashAmount>.8&&dist>0&&dot(forward,[-delta[0]/dist,0,-delta[1]/dist])>.9;
  actor.timer=Math.max(0,actor.timer-dt);
  if(actor.state==='windup'&&!actor.timer){actor.state='charge';actor.timer=.7;}
  else if(actor.state==='charge'&&!actor.timer){actor.state='recovery';actor.timer=[.68,.9,1.25,.72][i];}
  else if((['retreat','alert','search','recovery'].includes(actor.state))&&!actor.timer)actor.state='patrol';
  if(lit&&(i===0||i===3)&&actor.state!=='retreat'){actor.state='retreat';actor.timer=1.3;}
  if(seen&&(actor.state==='patrol'||actor.state==='search')){
   actor.state='alert';actor.timer=3;
  }
  const chasing=seen&&(actor.state==='alert'||actor.state==='charge');
  const path=actor.path;
  actor.aggression=approach(actor.aggression,chasing?1:actor.state==='windup'?.35:0,dt*3.7);
  if(actor.state==='patrol'&&Math.hypot(path[actor.pathIndex][0]-actor.x,path[actor.pathIndex][1]-actor.z)<.5)
   actor.pathIndex=(actor.pathIndex+actor.direction+path.length)%path.length;
  const target=actor.state==='charge'?actor.chargeTarget:actor.state==='search'&&actor.lastKnown?actor.lastKnown:chasing?[s.x,s.z]:path[actor.pathIndex];
  const retreat=actor.state==='retreat'&&lit;
  actor.routeDelay=(actor.routeDelay??0)-dt;
  if(actor.routeDelay<=0){
   actor.routeDelay=.32+i*.046;
   const h=type.float+.45;
   const obstruction=blocks.some(b=>traceBox([actor.x,h,actor.z],[target[0],h,target[1]],b,sizes[i])<1);
   actor.corner=obstruction&&actor.state!=='charge'?detour(actor,target,blocks):null;
  }
  const aim=actor.corner??target;
  const desired=retreat?Math.atan2(-delta[0],-delta[1]):Math.atan2(aim[0]-actor.x,aim[1]-actor.z);
  actor.yaw+=clamp(Math.atan2(Math.sin(desired-actor.yaw),Math.cos(desired-actor.yaw)),-dt*7,dt*7);
  const pressure=1+Math.min(1,(s.states?.filter(k=>k==='DELIVERED').length??0)/30)*.19;
  // Different chase rhythms; the telegraphed charge is faster than sprinting.
  const pulse=i===0?.88+.22*Math.sin(actor.phase*.73):i===1?.91+.18*Math.sin(actor.phase*.46):i===2?.94+.10*Math.sin(actor.phase*.31):.87+.26*Math.pow(.5+.5*Math.sin(actor.phase*.69),3);
  const goalSpeed=['windup','recovery'].includes(actor.state)?0:actor.state==='charge'?type.speed*1.23*pressure:chasing?type.speed*pressure*pulse:actor.state==='search'?2.65:retreat?3.2:1.35;
  actor.speed=approach(actor.speed,goalSpeed,dt*(actor.state==='charge'?18:chasing?[15,11,9,17][i]:7));
  const stride=actor.speed*dt;
  for(const turn of [0,.68,-.68,1.36,-1.36]){
   const angle=actor.yaw+turn,x=actor.x+Math.sin(angle)*stride,z=actor.z+Math.cos(angle)*stride;
   if(inMap(x,z)&&clear(local,(actor.x+x)/2,(actor.z+z)/2,sizes[i],type.float,bodyHeights[i])&&clear(local,x,z,sizes[i],type.float,bodyHeights[i])){actor.x=x;actor.z=z;break;}
  }
  const beat=Math.floor(actor.phase/Math.PI);
  actor.phase+=dt*(1+actor.speed*(i===2?5.3:2.4));
  if(previous!==actor.state||beat!==Math.floor(actor.phase/Math.PI)){
   (s.hauntSounds??=[]).push({x:actor.x,z:actor.z,kind:i,accent:previous!==actor.state});
   if(s.hauntSounds.length>4)s.hauntSounds.shift();
  }
  if(actor.state!=='charge')actor.strikePoints=null;
  const striking=actor.state==='charge'&&attackContact(actor,s,local);
  const strikeHeight=eyeHeights[i]-.30;
  const vertical=Math.max(0,s.y-strikeHeight,strikeHeight-s.y-(s.bodyHeight??1.70));
  const hitDx=s.x-actor.x,hitDz=s.z-actor.z,hitDist=Math.hypot(hitDx,hitDz);
  const aligned=(Math.sin(actor.yaw)*hitDx+Math.cos(actor.yaw)*hitDz)/Math.max(.001,hitDist);
  if(striking&&!s.encounterHit&&actor.age>.65&&actor.timer<.57&&line(local,actor,s)&&aligned>.40&&visible(local,[actor.x,strikeHeight,actor.z],[s.x,clamp(strikeHeight,s.y+.1,s.y+(s.bodyHeight??1.7)-.1),s.z])&&Math.hypot(hitDist,vertical)<armReach[i]&&s.hauntCooldown===0){
   s.hauntCooldown=4;actor.state='retreat';actor.timer=2;
   s.encounterHit={name:type.name,time:.40};
  }
 });
 return null;
}

export const ACTOR_START=11;
export const CREATURE_GROUP_COUNT=CREATURE_JOINTS.reduce((sum,joints)=>sum+joints.length,0);
export const buildHauntRigs=buildCreatureRigs;
function matrix(position,angles=[0,0,0],scale=1){
 return new Float32Array([...basis(...angles).flatMap(axis=>[...axis.map(v=>v*scale),0]),...position,1]);
}
export function hauntLayers(s){
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
  const coil=a.state==='windup'?1-a.timer/[.32,.39,.48,.37][i]:0;
  const strike=a.state==='charge'?Math.sin(Math.PI*Math.min(1,(.7-a.timer)/.53)):0;
  if(a.state==='alert'||a.state==='charge'){
   angles[0][0]+=[.13,.48,.54,.20][i]*reach;angles[1][2]+=[.26,.10,.06,.38][i]*Math.sin(a.phase*1.71)*reach;
   angles[2][0]-=[.31,.48,.24,.67][i]*reach;angles[3][0]-=[.36,.31,.24,.44][i]*reach;
   angles[1][1]+=[.28,.12,.04,.35][i]*Math.sin(a.phase*.83)*reach;
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
  const root=matrix([a.x,rise-.09*coil-(1-emergence)*.14+leaving*(float?.24:-.09),a.z],[0,a.yaw,0]);
  const boneMatrices=[];
  return joints.map(({pivot,parent},j)=>{
   const joint=multiply(matrix(pivot,angles[j]),matrix(pivot.map(v=>-v)));
   const bone=multiply(parent===undefined?root:boneMatrices[parent],joint);
   boneMatrices.push(bone);
   return {group:ACTOR_START+i*joints.length+j,matrix:bone,opacity,
    footprint:j===0?[a.x,a.z,i===2?.37:i===1?.45:.62,float?.16:.49]:null};
  });
 });
}
