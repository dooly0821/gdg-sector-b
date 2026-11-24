import {PHYSICS,move,worldBounds} from './movement.js';
import {World,unit,dot,vsub} from './world.js';
import {buildStorage} from './storage.js';
import {buildArchitecture} from './architecture.js';
import {buildMachinery} from './machinery.js';
import {buildAnnex} from './annex.js';
import {stageFreight} from './freight.js';
import {buildHands,buildParcel,buildFlashlight} from './viewmodel.js';
export const CONFIG={eye:1.58,radius:.255,height:1.70,walk:PHYSICS.walk,sprint:PHYSICS.sprint,gravity:PHYSICS.gravity,jump:PHYSICS.jump,reach:1.45,fov:78,pitchLimit:1.30,spawn:[1.7,0,15],sensitivity:.0021,parcelWidth:.55};
export const PARCELS=[
 {id:'B-01',area:'Employee intake',pos:[.8,.72,12.75]},
 {id:'B-02',area:'Storage cross aisle',pos:[-6.22,.72,-5.2]},
 {id:'B-03',area:'Conveyor sorting',pos:[7.15,1.072,2.4]},
 {id:'B-04',area:'Upper catwalk',pos:[13.90,4.32,-4.45]},
 {id:'B-05',area:'Loading aisle',pos:[-7.75,.72,-13.4]}];
export const DOCK=[4.6,.24,-19.6];
const sceneBlocks=new WeakSet();
export function createScene(){
 const w=new World();buildArchitecture(w);buildStorage(w);buildMachinery(w);stageFreight(w);buildAnnex(w);
 const steel=w.mat('dispatch-steel','#566168','metal'),edge=w.mat('bench-edge','#a58a53','paint'),plank=w.mat('dispatch-pine','#a58462','wood');
 const black=w.mat('bay-charcoal','#4b4b46','paint'),amber=w.mat('amber-traffic-paint','#c59a43','paint');
 for(const p of PARCELS.filter(p=>p.id!=='B-03')){
  const [x,y,z]=p.pos,base=y-.72;
  for(let side of [-1,1])for(let end of [-1,1])w.box(x+side*.43,base+.33,z+end*.31,.055,.66,.055,steel);
  w.box(x,y-.048,z,1.03,.096,.79,plank);w.box(x,y-.13,z+.33,1.0,.12,.045,edge);
  w.block(x-1.03/2,z-.79/2,x+1.03/2,z+.79/2,base,y,"climb");
 }
 const [x,y,z]=DOCK;
 for(let dx of [-1,0,1])w.box(x+dx,.092,z,.13,.184,1.6,plank);
 for(let i=0;i<9;i++)w.box(x+(i-4)*.283,.208,z,.266,.064,1.6,plank);
 w.block(x-1.27,z-.8,x+1.27,z+.8,0,.27);
 for(const dx of [-1.52,1.52])w.box(x+dx,.009,z,.09,.015,1.95,amber);
 for(const dz of [-.98,.98])w.box(x,.009,z+dz,3.12,.015,.09,amber);
 for(const dx of [-1.65,1.65]){w.box(x+dx,.82,z-1,.07,1.64,.07,steel);w.box(x+dx,.08,z-1,.21,.16,.21,black);}
 w.box(x,1.72,z-1,3.46,.55,.1,black);w.sign(x,1.71,z-.94,3.32,.45,'DISPATCH   /   BAY 02','#b08837','#171b17');
 const parcel=new World(),empty=new World(),carry=new World();buildParcel(parcel,0,0,0,CONFIG.parcelWidth);buildHands(empty,false);buildHands(carry,true);
 const flashlight=new World();buildFlashlight(flashlight);
 sceneBlocks.add(w.blocks);
 return [w,parcel,empty,carry,flashlight];
}
export function newShift(){return {x:1.7,y:0,z:15,yaw:.24,pitch:-.04,vy:0,vx:0,vz:0,flashlight:false,flashAmount:0,grounded:true,states:PARCELS.map(()=> 'AVAILABLE'),carried:-1,elapsed:0,steps:0};}
export const deliveryCount=s=>s.states.filter(k=>k==='DELIVERED').length;
export const forward=s=>[-Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch)];
export function surface(x,z,y){
 if(x>11.64&&x<13.36&&z<15.13&&z>=6.94){const top=Math.min(3.6,Math.max(0,(15-z)*.45));return y+.32>=top?top:0;}
 if(x>=11&&x<=14.9&&z>=-20&&z<=7.08&&y>=3.25)return 3.6;
 return 0;
}
export function parcelBlocks(s){
 const [w,h,d]=parcelHalf;
 return parcelPositions(s).map(([x,y,z])=>[x-w,z-d,x+w,z+d,y,y+h,'climb']);
}
export function step(s,keys,blocks,dt,jump=false){
 const dynamic=sceneBlocks.has(blocks)?parcelBlocks(s).filter(b=>b[0]<s.x+3&&b[2]>s.x-3&&b[1]<s.z+3&&b[3]>s.z-3):[];
 const grounded=s.grounded,vy=s.vy,previousStep=Math.floor(s.steps/.90),vault=s.vault;
 move(s,keys,blocks,dt,jump,surface,dynamic);
 const speed=Math.hypot(s.vx,s.vz);
 let radius=0;
 if(!grounded&&s.grounded)radius=2+Math.min(7,Math.abs(vy));
 else if(!vault&&s.vault)radius=s.vault.rail||s.vault.high?6:4;
 else if(s.grounded&&Math.floor(s.steps/.90)>previousStep)radius=s.bodyHeight<1.3?1.4:speed*1.1;
 if(radius)s.noise={x:s.x,y:s.y+.2,z:s.z,radius,time:s.elapsed};
}
const parcelPos=(s,i)=>s.parked?.[i]??PARCELS[i].pos;
const dockTarget=()=>({pos:DOCK,id:'BAY 02',area:'Outbound dispatch',dock:true});
const parcelHalf=[CONFIG.parcelWidth/2,CONFIG.parcelWidth*.88,CONFIG.parcelWidth*.41];
function placementClear(s,pos,blocks){
 const [x,y,z]=pos,[w,h,d]=parcelHalf;
 return ![...blocks,...worldBounds].some(([x1,z1,x2,z2,y1,y2])=>
   x+w>x1&&x-w<x2&&z+d>z1&&z-d<z2&&y+h>y1+.001&&y<y2-.001)&&
  !parcelPositions(s).some(([px,py,pz])=>Math.abs(px-x)<2*w+.03&&Math.abs(py-y)<h+.01&&Math.abs(pz-z)<2*d+.03);
}
export function dropTarget(s,blocks){
 if(!s.grounded||s.vault)return null;
 const [w,,d]=parcelHalf, clear=.012;
 const running=Math.hypot(s.vx||0,s.vz||0)>PHYSICS.walk;
 const offsets=running?[[.86,.66],[.86,-.66],[1.04,0]]:[[1.04,0],[.93,0],[1.18,0]];
 for(const [distance,side] of offsets){
  const x=s.x-Math.sin(s.yaw)*distance+Math.cos(s.yaw)*side;
  const z=s.z-Math.cos(s.yaw)*distance-Math.sin(s.yaw)*side;
  let y=surface(x,z,s.y);
  for(const [dx,dz] of [[-w,-d],[-w,d],[w,-d],[w,d]]){
   if(Math.abs(surface(x+dx,z+dz,s.y)-y)>.025){y=null;break;}
  }
  if(y===null)continue;
  for(const [x1,z1,x2,z2,,top,kind] of blocks){
   if(kind!=='rail'&&top<=s.y+.95&&top>y&&x-w>x1+clear&&x+w<x2-clear&&z-d>z1+clear&&z+d<z2-clear)y=top;
  }
  if(Math.abs(y-s.y)>.95)continue;
  const candidate={pos:[x,y,z],index:s.carried,drop:true,id:PARCELS[s.carried].id};
  if(canUse(s,candidate,blocks))return candidate;
 }
 return null;
}
export function handlingTarget(s,blocks){
 const target=nextTarget(s);
 if(s.carried<0){
  if(canUse(s,target,blocks))return target;
  for(let i=0;i<PARCELS.length;i++){
   if(s.states[i]!=='AVAILABLE'||i===target?.index)continue;
   const alternative={...PARCELS[i],index:i,pos:parcelPos(s,i)};
   if(canUse(s,alternative,blocks))return alternative;
  }
  return target;
 }
 if(canUse(s,target,blocks))return target;
 return dropTarget(s,blocks);
}
export function nextTarget(s){
 if(s.carried>=0)return dockTarget();
 let best=null,d=Infinity;for(let i=0;i<PARCELS.length;i++){if(s.states[i]!=='AVAILABLE')continue;const p={...PARCELS[i],pos:parcelPos(s,i)};let dist=Math.hypot(s.x-p.pos[0],s.z-p.pos[2],(s.y-p.pos[1])*1.8);if(dist<d){best={...p,index:i};d=dist;}}
 return best;
}
export function canUse(s,target,blocks=[]){
 if(!target||s.vault)return false;
 if(target.drop&&(!s.grounded||s.carried!==target.index||!placementClear(s,target.pos,blocks)))return false;
 let pos=target.pos.slice();pos[1]+=target.dock?.55:.24;
 const eye=[s.x,s.y+(s.bodyHeight??1.70)-.12,s.z],v=vsub(pos,eye),d=Math.hypot(...v);
 if(target.drop){
  if(d>1.91||dot(unit([v[0],0,v[2]]),[-Math.sin(s.yaw),0,-Math.cos(s.yaw)])<.73)return false;
 }else if(d>(s.parked?.[target.index]?1.91:CONFIG.reach)||dot(unit(v),forward(s))<.63)return false;
 // Ray segment intersects solid props. Skip the target's own support.
 for(const [x1,z1,x2,z2,y1,y2] of blocks){
  if(!target.drop&&!s.parked?.[target.index]&&target.id==='B-03' && x1<pos[0]&&x2>pos[0]&&z1<pos[2]&&z2>pos[2])continue;
  let lo=0,hi=.97;
  for(const [j,a,b] of [[0,x1,x2],[1,y1,y2],[2,z1,z2]]){if(Math.abs(v[j])<.00001){if(eye[j]<a||eye[j]>b){hi=-1;break;}continue;}const t1=(a-eye[j])/v[j],t2=(b-eye[j])/v[j];lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
  if(lo<hi)return false;
 }
 return true;
}
export function interact(s,target,blocks){
 if(!canUse(s,target,blocks))return null;
 if(target.drop){
  (s.parked??={})[target.index]=target.pos.slice();
  s.states[target.index]='AVAILABLE';s.carried=-1;
  s.noise={x:target.pos[0],y:target.pos[1],z:target.pos[2],radius:4.5,time:s.elapsed};return 'dropped';
 }
 if(target.dock&&s.carried>=0&&s.states[s.carried]==='CARRIED'){s.deliveryOrder??=s.states.flatMap((v,i)=>v==='DELIVERED'?[i]:[]);s.deliveryOrder.push(s.carried);s.states[s.carried]='DELIVERED';s.carried=-1;return 'delivered';}
 if(!target.dock&&s.carried===-1&&s.states[target.index]==='AVAILABLE'){s.carried=target.index;s.states[target.index]='CARRIED';return 'picked';}
 return null;
}
export function baySlot(n){return [DOCK[0]+((n%3)-1)*.65,DOCK[1],DOCK[2]+(Math.floor(n/3)-.5)*.60];}
export function parcelPositions(s,hidden=-1){
 const order=s.deliveryOrder??s.states.flatMap((v,i)=>v==='DELIVERED'?[i]:[]);
 return PARCELS.flatMap((p,i)=>i===hidden?[]:s.states[i]==='AVAILABLE'?[parcelPos(s,i)]:s.states[i]==='DELIVERED'?[baySlot(order.indexOf(i))]:[]);
}
