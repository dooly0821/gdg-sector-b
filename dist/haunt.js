import {World,basis,multiply,dot} from './world.js';

const cast=[
 {name:'녹령',kind:'flicker',path:[[-21,14],[-25,10],[-28,12]],speed:2.75,range:7,float:.35},
 {name:'함귀',kind:'boxhead',path:[[-39,13],[-34,15],[-30,14]],speed:2.66,range:7,float:0},
 {name:'적재귀',kind:'imp',path:[[-19,4],[-21,8],[-23,10]],speed:3.25,range:5,float:0},
 {name:'표찰귀',kind:'wraith',path:[[-36,2],[-38,-4],[-36,-7]],speed:2.13,range:6,float:.38}
];
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
export function updateHaunt(s,blocks,forward,dt){
 if(s.x>-16&&!s.haunt)return null;
 s.haunt??=cast.map(({path},i)=>({x:path[0][0],z:path[0][1],yaw:0,phase:i,pathIndex:1,state:'patrol',timer:0,speed:0}));
 s.hauntCooldown=Math.max(0,(s.hauntCooldown??0)-dt);
 let encounter=null;
 s.haunt.forEach((actor,i)=>{
  const type=cast[i],delta=[s.x-actor.x,s.z-actor.z],dist=Math.hypot(...delta);
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
  if(!chasing&&Math.hypot(type.path[actor.pathIndex][0]-actor.x,type.path[actor.pathIndex][1]-actor.z)<.5)
   actor.pathIndex=(actor.pathIndex+1)%type.path.length;
  const target=actor.state==='charge'?actor.chargeTarget:chasing?[s.x,s.z]:type.path[actor.pathIndex];
  const desired=Math.atan2(target[0]-actor.x,target[1]-actor.z);
  actor.yaw+=clamp(Math.atan2(Math.sin(desired-actor.yaw),Math.cos(desired-actor.yaw)),-dt*7,dt*7);
  actor.speed=approach(actor.speed,actor.state==='windup'?0:actor.state==='charge'?type.speed:chasing?type.speed:1.17,dt*7);
  const stride=actor.speed*dt;
  for(const turn of [0,.68,-.68,1.36,-1.36]){
   const angle=actor.yaw+turn,x=actor.x+Math.sin(angle)*stride,z=actor.z+Math.cos(angle)*stride;
   if(x<-17.5&&z<20&&z>-8.1&&clear(blocks,x,z,.29,type.float)){actor.x=x;actor.z=z;break;}
  }
  actor.phase+=dt*(1+actor.speed*2.4);
  if(chasing&&dist<.68&&s.hauntCooldown===0&&!s.handAction&&!s.vault){
   s.hauntCooldown=4;actor.state='retreat';actor.timer=2;
   s.vx=s.vz=0;s.vy=0;s.x=-16.1;s.y=0;s.z=14;s.grounded=true;
   encounter=type.name;
  }
 });
 return encounter;
}

export const ACTOR_START=11;
const joints=[
 {name:'body',pivot:[0,0,0]}, {name:'head',pivot:[0,1.35,0]},
 {name:'leftArm',pivot:[-.26,1.23,0]}, {name:'rightArm',pivot:[.26,1.23,0]},
 {name:'leftLeg',pivot:[-.14,.65,0]}, {name:'rightLeg',pivot:[.14,.65,0]},
 {name:'leftElbow',pivot:[-.53,.99,.025],parent:2}, {name:'rightElbow',pivot:[.53,.99,.025],parent:3}
];
export function buildHauntRigs(){
 return cast.flatMap(({kind},i)=>{
  const w=new World(),model=(name,color,type='cloth',emission=0)=>w.mat(kind+name,color,type,emission);
  const cloth=model('fabric',['#719990','#645668','#705c55','#ae895e'][i]);
  const wrap=model('wrap',['#86978f','#a68a6e','#ae8a4f','#dec29b'][i],'cardboard');
  const eye=model('eye',i===3?'#ff593e':'#ffe5b5','plain',1.65),shadow=model('shade','#241f26','rubber');
  const trim=model('trim','#cc9b53','metal'),box=model('box','#a87753','carton');
  const mark=w.imageMat(kind+'label','assets/package-side.webp');
  const bones=joints.map((joint,j)=>{
   w.parts=[];
   if(j===0){
    if(i===0)w.shape('spectral-drape',0,.98,0,.56,1.79,.39,cloth,0,0,.12);
    else w.ball(0,.99,0,.29,.39,.20,cloth);
    if(i===3){
     for(let n=0;n<9;n++){
      const a=n*2.4,r=.13+n*.014,x=Math.cos(a)*r,z=Math.sin(a)*r;
      w.ball(x,.72-n*.055,z,.07,.19+n*.013,.075,n%2?cloth:wrap,0,a,.22*Math.sin(a));
     }
    }
    if(i!==0)for(let n=0;n<4;n++)w.box(0,.84+n*.13,.15,.46,.083,.08,n%2?wrap:cloth,0,0,n%2?.34:-.28);
   }else if(j===1){
    if(i===1||i===2){
     w.box(0,1.58,0,.57,i===1?.52:.40,.49,box,0,.12,.12);
     w.box(0,1.51,.249,.40,.23,.045,shadow,0,0,-.08);
     w.box(.04,1.82,.05,.20,.038,.44,wrap,0,0,.12);
     w.face(.125,1.68,.267,.20,.14,mark,0,0,.14);
     if(i===2)for(const x of [-.31,.31])w.cyl(x,1.66,0,.15,.09,.15,trim,0,0,Math.PI/2);
    }else{
     w.ball(0,1.57,0,.31,.37,.24,cloth);
     w.ball(0,1.53,.192,.207,.237,.095,shadow);
     w.ball(0,1.41,.273,.083,.103,.020,shadow);
     if(i===3)for(const x of [-.25,.25])w.ball(x,1.65,.06,.10,.24,.17,wrap,0,0,x);
     if(i===3)for(let n=0;n<7;n++)w.box(Math.sin(n*2.1)*.25,1.78+Math.sin(n)*.09,Math.cos(n*2.1)*.13,.22,.15,.05,n%2?wrap:box,0,n,.35);
    }
    for(const x of [-.096,.096])w.ball(x,1.585,.289,.049,i===3?.075:.047,.021,eye);
   }else if(j<4){
    const side=j===2?-1:1;
    w.beam([side*.22,1.23,0],[side*.52,.98,.025],.12,.14,cloth);
   }else if(j>=6){
    const side=j===6?-1:1;
    w.ball(side*.53,.99,.025,.095,.105,.094,i===0?cloth:wrap);
    w.beam([side*.53,.98,.025],[side*.64,.72,.19],.13,.14,cloth);
    w.ball(side*.65,.70,.202,.115,.098,.105,wrap);
    for(let n=0;n<3;n++){
     const x=side*(.57+n*.075);
     w.beam([x,.71,.24],[x+side*.025,.52,.29+(n%2)*.052],.047,.052,wrap);
     w.ball(x+side*.025,.52,.29+(n%2)*.052,.027,.046,.031,wrap);
    }
   }else if(i===1||i===2){
    const x=joint.pivot[0];
    w.beam([x,.73,0],[x*1.2,.19,0],.145,.16,cloth);
    w.ball(x*1.2,.12,.08,.138,.119,.207,shadow);
    w.box(x*1.2,.25,.04,.17,.075,.21,wrap);
   }
   return {materials:w.materials,parts:w.parts};
  });
  return bones;
 });
}
function matrix(position,angles=[0,0,0],scale=1){
 return new Float32Array([...basis(...angles).flatMap(axis=>[...axis.map(v=>v*scale),0]),...position,1]);
}
export function hauntLayers(s){
 return (s.haunt??[]).flatMap((a,i)=>{
  if(Math.hypot(a.x-s.x,a.z-s.z)>33)return [];
  if(i===0&&a.state!=='retreat'&&Math.sin(a.phase*.79)<-.65)return [];
  const type=cast[i],swing=Math.sin(a.phase)*Math.min(.55,a.speed*.21),reach=a.state==='alert'||a.state==='charge'?.45:0;
  const size=i===2?.68:i===1?1.16:1;
  const rise=type.float?(Math.sin(a.phase*.8)*.16+type.float):Math.abs(swing)*.115;
  const root=matrix([a.x,rise,a.z],[0,a.yaw,0],size);
  const angles=[[0,0,.035*swing],[0,.25*Math.sin(a.phase*.45),swing*.17],
   [swing-reach,0,-.12+.14*swing],[-swing-reach,0,.12+.14*swing],[-swing,0,.035],[swing,0,-.035],[-.12-swing*.55-reach*.35,0,0],[-.12+swing*.55-reach*.35,0,0]];
  const boneMatrices=[];
  return joints.map(({pivot,parent},j)=>{
   const joint=multiply(matrix(pivot,angles[j]),matrix(pivot.map(v=>-v)));
   const bone=multiply(parent===undefined?root:boneMatrices[parent],joint);
   boneMatrices.push(bone);
   return {group:ACTOR_START+i*joints.length+j,matrix:bone};
  });
 });
}
