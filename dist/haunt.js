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
const line=(blocks,a,b)=>{
 for(let i=1;i<=14;i++){
  const t=i/15;
  if(!clear(blocks,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.065,Math.max(.35,(b.y??0)*t)))return false;
 }
 return true;
};
function updateSpawns(s,blocks,forward,dt,rng){
 const director=s.hauntDirector??={delay:1.8+rng()*2.8,bag:[]};
 if(s.x>=-16)return;
 for(const actor of s.haunt)actor.age+=dt;
 s.haunt=s.haunt.filter(actor=>actor.age<actor.life||
  actor.state==='alert'||actor.state==='charge'||Math.hypot(s.x-actor.x,s.z-actor.z)<7);
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
 director.delay=7+rng()*8;
}
export function updateHaunt(s,blocks,forward,dt,rng=Math.random){
 if(s.x>=-16&&!s.haunt)return null;
 s.haunt??=[];
 updateSpawns(s,blocks,forward,dt,rng);
 s.hauntCooldown=Math.max(0,(s.hauntCooldown??0)-dt);
 let encounter=null;
 s.haunt.forEach(actor=>{
  const i=actor.kind,type=cast[i],delta=[s.x-actor.x,s.z-actor.z],dist=Math.hypot(...delta);
  const seen=s.x<-16&&dist<type.range&&s.y<1.25&&line(blocks,actor,s);
  const lit=seen&&s.flashAmount>.8&&dist>0&&dot(forward,[-delta[0]/dist,0,-delta[1]/dist])>.9;
  actor.timer=Math.max(0,actor.timer-dt);
  if(actor.state==='windup'&&!actor.timer){actor.state='charge';actor.timer=.7;}
  else if(actor.state==='charge'&&!actor.timer){actor.state='retreat';actor.timer=1.5;}
  else if((actor.state==='retreat'||actor.state==='alert')&&!actor.timer)actor.state='patrol';
  if(lit&&(i===0||i===3)&&actor.state!=='retreat'){actor.state='retreat';actor.timer=1.3;}
  if(seen&&actor.state==='patrol'){
   actor.state=i===2?'windup':'alert';actor.timer=i===2?.48:2.4;
   if(i===2)actor.chargeTarget=[s.x,s.z];
  }
  const chasing=seen&&(actor.state==='alert'||actor.state==='charge');
  const path=actor.path;
  actor.aggression=approach(actor.aggression,chasing?1:actor.state==='windup'?.35:0,dt*3.7);
  if(!chasing&&Math.hypot(path[actor.pathIndex][0]-actor.x,path[actor.pathIndex][1]-actor.z)<.5)
   actor.pathIndex=(actor.pathIndex+actor.direction+path.length)%path.length;
  const target=actor.state==='charge'?actor.chargeTarget:chasing?[s.x,s.z]:path[actor.pathIndex];
  const retreat=actor.state==='retreat'&&lit;
  const desired=retreat?Math.atan2(-delta[0],-delta[1]):Math.atan2(target[0]-actor.x,target[1]-actor.z);
  actor.yaw+=clamp(Math.atan2(Math.sin(desired-actor.yaw),Math.cos(desired-actor.yaw)),-dt*7,dt*7);
  actor.speed=approach(actor.speed,actor.state==='windup'?0:actor.state==='charge'?type.speed:chasing?type.speed:1.17,dt*7);
  const stride=actor.speed*dt;
  for(const turn of [0,.68,-.68,1.36,-1.36]){
   const angle=actor.yaw+turn,x=actor.x+Math.sin(angle)*stride,z=actor.z+Math.cos(angle)*stride;
   if(x<-17.5&&z<20&&z>-8.1&&clear(blocks,x,z,.29,type.float)){actor.x=x;actor.z=z;break;}
  }
  actor.phase+=dt*(1+actor.speed*(i===2?5.3:2.4));
  if(chasing&&dist<.68&&s.hauntCooldown===0&&!s.handAction&&!s.vault){
   s.hauntCooldown=4;actor.state='retreat';actor.timer=2;
   s.vault=null;s.jumpBuffer=0;s.vx=s.vz=0;s.vy=0;s.x=-16.1;s.y=0;s.z=14;s.grounded=true;
   encounter=type.name;
  }
 });
 return encounter;
}

export const ACTOR_START=11;
export const buildHauntRigs=buildCreatureRigs;
function matrix(position,angles=[0,0,0],scale=1){
 return new Float32Array([...basis(...angles).flatMap(axis=>[...axis.map(v=>v*scale),0]),...position,1]);
}
export function hauntLayers(s){
 return (s.haunt??[]).flatMap(a=>{
  const i=a.kind,type=cast[i],joints=CREATURE_JOINTS[i];
  if(Math.hypot(a.x-s.x,a.z-s.z)>35)return [];
  if(i===0&&a.state!=='retreat'&&Math.sin(a.phase*.64)+.35*Math.sin(a.phase*3.3)<-1.04)return [];
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
  const root=matrix([a.x,rise,a.z],[0,a.yaw,0]);
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
