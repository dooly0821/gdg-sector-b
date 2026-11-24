import {traceBox} from './contact.js';
import {basis,multiply,dot} from './world.js';
import {buildCreatureRigs,CREATURE_JOINTS} from './creature-models.js';

const cast=[
 {name:'녹령',kind:'flicker',speed:2.75,range:7,float:.35},
 {name:'함귀',kind:'boxhead',speed:2.66,range:7,float:0},
 {name:'적재귀',kind:'imp',speed:3.25,range:5,float:0},
 {name:'표찰귀',kind:'wraith',speed:2.13,range:6,float:.38}
];
// Shared patrol loops. A creature can start from any of these loops and either direction.
const routes=[
 [[-21,14],[-25,14],[-28,12],[-23,13]],
 [[-38,14],[-35,16],[-32,13],[-35,12]],
 [[-19,4],[-20,8],[-20,12],[-18,11]],
 [[-37.8,2],[-38.4,-4],[-37,-7],[-39.6,-6]],
 [[-27,1],[-24,0],[-21,-3],[-19,0]]
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
const clear=(blocks,x,z,r,y=0)=>!blocks.some(([x1,z1,x2,z2,y1,y2])=>
 y+.06<y2&&y+1.2>y1&&Math.hypot(x-clamp(x,x1,x2),z-clamp(z,z1,z2))<r);
const eyeHeights=[1.9,1.8,.80,2.0],armReach=[1.04,.96,.73,1.13];
function visible(blocks,a,b){
 return !blocks.some(box=>traceBox(a,b,box)<1);
}
function line(blocks,actor,s){
 const eye=[actor.x,eyeHeights[actor.kind??0],actor.z],h=s.bodyHeight??1.7;
 return [[0,h-.15],[-.18,h*.56],[.18,h*.56]].some(([offset,height])=>
  visible(blocks,eye,[s.x+offset,s.y+height,s.z]));
}
const annexCache=new WeakMap();
const sizes=[.35,.34,.44,.32];
function detour(actor,target,blocks){
 const cell=.65,r=sizes[actor.kind],y=cast[actor.kind].float;
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
   if(x>=-17||x<=-42.5||z>20||z<-8||!clear(blocks,x,z,r,y)||!clear(blocks,x-dx*cell/2,z-dz*cell/2,r,y))continue;
   queue.push([nx,nz,first??[x,z],Math.hypot(nx-gx,nz-gz)+.18*Math.hypot(nx,nz)]);
  }
 }
 return null;
}
function updateSpawns(s,blocks,forward,dt,rng){
 const director=s.hauntDirector??={delay:1.8+rng()*2.8,bag:[]};
 if(s.x>=-16)return;
 for(const actor of s.haunt)actor.age+=dt;
 for(const actor of s.haunt){
  if(actor.age>actor.life&&Math.hypot(s.x-actor.x,s.z-actor.z)>7&&actor.state==='patrol')actor.state='disappear';
  if(actor.state==='disappear')actor.fade=(actor.fade??1)-dt/.65;
 }
 s.haunt=s.haunt.filter(actor=>(actor.fade??1)>0);
 director.delay-=dt;
 if(director.delay>0||s.haunt.length>=2)return;
 if(!director.bag.length)director.bag=randomOrder([0,1,2,3],rng);
 const slot=director.bag.findIndex(kind=>!s.haunt.some(actor=>actor.kind===kind));
 if(slot<0)return;
 const kind=director.bag[slot],type=cast[kind];
 const candidates=routes.flatMap((path,route)=>path.map(([x,z],index)=>({path,route,index,x,z})));
 const spawn=randomOrder(candidates,rng).find(candidate=>{
  const {x,z,route}=candidate,dx=x-s.x,dz=z-s.z,dist=Math.hypot(dx,dz);
  if(dist<6.2||dist>20||!clear(blocks,x,z,.63,type.float))return false;
  if(s.haunt.some(a=>a.route===route||Math.hypot(a.x-x,a.z-z)<5))return false;
  return dot(forward,[dx/dist,0,dz/dist])<.47||!line(blocks,candidate,s);
 });
 if(!spawn){director.delay=.85+rng()*.75;return;}
 director.bag.splice(slot,1);
 const {path,route,index,x,z}=spawn,direction=rng()<.5?-1:1,pathIndex=(index+direction+path.length)%path.length;
 const yaw=Math.atan2(path[pathIndex][0]-x,path[pathIndex][1]-z);
 s.haunt.push({kind,route,path,direction,pathIndex,x,z,yaw,phase:rng()*Math.PI*2,
  state:'patrol',timer:0,speed:0,age:0,life:25+rng()*18,aggression:0});
 director.delay=7+rng()*8-(s.states?.filter(k=>k==='DELIVERED').length??0)*.38;
}
export function updateHaunt(s,blocks,forward,dt,rng=Math.random){
 if(s.x>=-16&&!s.haunt)return null;
 if(!annexCache.has(blocks))annexCache.set(blocks,blocks.filter(b=>b[0]<-15));
 blocks=annexCache.get(blocks);
 s.haunt??=[];
 updateSpawns(s,blocks,forward,dt,rng);
 s.hauntCooldown=Math.max(0,(s.hauntCooldown??0)-dt);
 let encounter=null;
 s.haunt.forEach(actor=>{
  if(actor.state==='disappear')return;
  const previous=actor.state;
  const i=actor.kind,type=cast[i],delta=[s.x-actor.x,s.z-actor.z],dist=Math.hypot(...delta);
  const local=blocks.filter(b=>b[0]<-15&&b[2]>Math.min(actor.x,s.x)-2&&b[0]<Math.max(actor.x,s.x)+2&&b[3]>Math.min(actor.z,s.z)-2&&b[1]<Math.max(actor.z,s.z)+2);
  const seen=s.x<-16&&dist<type.range*(s.bodyHeight<1.2&&!s.flashlight? .72:1)&&line(local,actor,s);
  const moving=Math.hypot(s.vx??0,s.vz??0);
  const heard=s.x<-16&&dist<(moving*.85+(s.vault?2:0))*(seen?1:.65);
  if(seen||heard)actor.lastKnown=[s.x,s.z];
  if(actor.state==='patrol'&&heard&&!seen){actor.state='search';actor.timer=2.6;}
  if(actor.state==='alert'&&!seen){actor.state='search';actor.timer=3.1;}
  if(actor.state==='alert'&&seen&&dist<1.38&&s.y<eyeHeights[i]+.24){
   actor.state='windup';actor.timer=[.32,.49,.58,.37][i];actor.chargeTarget=[s.x,s.z];
  }
  const lit=seen&&s.flashAmount>.8&&dist>0&&dot(forward,[-delta[0]/dist,0,-delta[1]/dist])>.9;
  actor.timer=Math.max(0,actor.timer-dt);
  if(actor.state==='windup'&&!actor.timer){actor.state='charge';actor.timer=.7;}
  else if(actor.state==='charge'&&!actor.timer){actor.state='recovery';actor.timer=[.68,.9,1.25,.72][i];}
  else if((['retreat','alert','search','recovery'].includes(actor.state))&&!actor.timer)actor.state='patrol';
  if(lit&&(i===0||i===3)&&actor.state!=='retreat'){actor.state='retreat';actor.timer=1.3;}
  if(seen&&(actor.state==='patrol'||actor.state==='search')){
   actor.state=i===2?'windup':'alert';actor.timer=i===2?.48:2.4;
   if(i===2)actor.chargeTarget=[s.x,s.z];
  }
  const chasing=seen&&(actor.state==='alert'||actor.state==='charge');
  const path=actor.path;
  actor.aggression=approach(actor.aggression,chasing?1:actor.state==='windup'?.35:0,dt*3.7);
  if(!chasing&&Math.hypot(path[actor.pathIndex][0]-actor.x,path[actor.pathIndex][1]-actor.z)<.5)
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
  actor.speed=approach(actor.speed,['windup','recovery'].includes(actor.state)?0:actor.state==='charge'?type.speed:chasing?type.speed:1.17,dt*7);
  const stride=actor.speed*dt;
  for(const turn of [0,.68,-.68,1.36,-1.36]){
   const angle=actor.yaw+turn,x=actor.x+Math.sin(angle)*stride,z=actor.z+Math.cos(angle)*stride;
   if(x<-17.5&&z<20&&z>-8.1&&clear(blocks,x,z,sizes[i],type.float)){actor.x=x;actor.z=z;break;}
  }
  const beat=Math.floor(actor.phase/Math.PI);
  actor.phase+=dt*(1+actor.speed*(i===2?5.3:2.4));
  if(previous!==actor.state||beat!==Math.floor(actor.phase/Math.PI)){
   (s.hauntSounds??=[]).push({x:actor.x,z:actor.z,kind:i,accent:previous!==actor.state});
   if(s.hauntSounds.length>4)s.hauntSounds.shift();
  }
  const strikeHeight=eyeHeights[i]-.30;
  const vertical=Math.max(0,s.y-strikeHeight,strikeHeight-s.y-(s.bodyHeight??1.70));
  const aligned=(Math.sin(actor.yaw)*delta[0]+Math.cos(actor.yaw)*delta[1])/Math.max(.001,dist);
  if(actor.state==='charge'&&actor.timer<.57&&seen&&aligned>.40&&visible(local,[actor.x,strikeHeight,actor.z],[s.x,clamp(strikeHeight,s.y+.1,s.y+(s.bodyHeight??1.7)-.1),s.z])&&Math.hypot(dist,vertical)<armReach[i]&&s.hauntCooldown===0){
   s.hauntCooldown=4;actor.state='retreat';actor.timer=2;
   s.handAction=null;s.pendingUse=null;s.vault=null;s.jumpBuffer=0;s.vx=s.vz=0;s.vy=0;s.x=-16.1;s.y=0;s.z=14;s.grounded=true;
   encounter=type.name;
  }
 });
 return encounter;
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

  const stride=Math.min(i===2?.65:.49,a.speed*.22),swing=Math.sin(a.phase)*stride,reach=a.aggression;
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
  const coil=a.state==='windup'?1-a.timer/[.32,.49,.48,.37][i]:0;
  const strike=a.state==='charge'?Math.sin(Math.PI*Math.min(1,(.7-a.timer)/.53)):0;
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
  const root=matrix([a.x,rise-.09*coil,a.z],[0,a.yaw,0],emergence*(a.fade??1));
  const boneMatrices=[];
  return joints.map(({pivot,parent},j)=>{
   const joint=multiply(matrix(pivot,angles[j]),matrix(pivot.map(v=>-v)));
   const bone=multiply(parent===undefined?root:boneMatrices[parent],joint);
   boneMatrices.push(bone);
   return {group:ACTOR_START+i*joints.length+j,matrix:bone,
    footprint:j===0?[a.x,a.z,i===2?.37:i===1?.45:.62,float?.16:.49]:null};
  });
 });
}
