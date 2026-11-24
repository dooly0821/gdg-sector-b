import {traceBox} from './contact.js';
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
// Six risk zones, five unique cargo assignments per zone. Keep the original
// five-position fixture for automated legacy tests (newShift without RNG).
export const MISSION_TOTAL=30;
const spots=(area,positions)=>positions.map(pos=>({area,pos}));
const cargoPools=[
 [PARCELS[0],...spots('Employee intake',[[-9,0,5],[2,0,7],[-8,0,15],[3,0,17],[9,0,10],[-10,0,19]])],
 [PARCELS[1],PARCELS[4],...spots('Loading aisle',[[-7,0,-8],[2,0,-13],[10,0,-12],[-6,0,-19],[1,0,-19]])],
 spots('Annex freight',[[-21,.72,10],[-30,.72,17.8],[-37,.72,11],[-29,.72,-3],[-21,0,14],[-38,0,14],[-32,0,3],[-40,0,-6]]),
 [PARCELS[3],...spots('Annex rack',[[-25,.855,7.35],[-24.5,2.355,7]]),...spots('High storage',[[-1.6,3.58,.25],[-1.6,5.27,2.35],[-2,1.88,.25]])],
 spots('Transfer hall',[[-10,0,25],[-3,0,27],[4,0,25],[11,0,32],[-10,0,38],[-1,0,43],[10,0,49],[-6,0,51],[-5.25,1.16,36],[9.75,1.16,35]]),
 spots('Returns hall',[[-39,0,26],[-30,0,25],[-20,0,26],[-40,0,40],[-31,0,46],[-20,0,50],[-37,0,50],[-25,0,35],[-39.25,1.16,35],[-28.25,1.16,38]]),
 spots('Waste processing',[[-30,0,57],[-34,0,62],[-29,0,67],[-40,0,70],[-20,0,76],[-32,3,68]]),
 spots('Containment lab',[[0,0,57],[3,0,65],[-5,0,71],[5,0,76],[13,0,72],[-2,3,68]])
];
function shuffle(items,rng){
 const selected=items.slice();
 for(let i=selected.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[selected[i],selected[j]]=[selected[j],selected[i]];}
 return selected;
}
export function randomCargo(rng=Math.random){
 return shuffle(cargoPools.flatMap((pool,i)=>shuffle(pool,rng).slice(0,[4,4,4,4,3,3,4,4][i])),rng).map((p,i)=>({id:'B-'+String(i+1).padStart(2,'0'),area:p.area,pos:p.pos.slice()}));
}
export const shiftParcel=(s,i)=>s?.cargo?.[i]??PARCELS[i];
const sceneBlocks=new WeakSet();
export function createScene(){
 const w=new World();buildArchitecture(w);buildStorage(w);buildMachinery(w);stageFreight(w);buildAnnex(w);
 const emergency=w.mat('emergency-red-lens','#e52c29','plain',1.65),housing=w.mat('emergency-housing','#33363a','metal');
 for(const [x,z] of [[-7,1],[3,-11],[-20,13],[-32,4],[0,23],[-10,38],[8,47],[-30,23],[-38,40],[-19,37]]){
  w.box(x,4.1,z,.36,.18,.32,housing);w.cyl(x,3.91,z,.14,.22,.14,emergency);w.lights.push([x,3.8,z,1]);
 }
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
export function newShift(rng){return {cargo:typeof rng==='function'?randomCargo(rng):null,x:1.7,y:0,z:15,yaw:.24,pitch:-.04,vy:0,vx:0,vz:0,flashlight:false,flashAmount:0,grounded:true,states:Array(typeof rng==='function'?MISSION_TOTAL:PARCELS.length).fill('AVAILABLE'),carried:-1,elapsed:0,steps:0};}
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
const parcelPos=(s,i)=>s.parked?.[i]??shiftParcel(s,i).pos;
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
  const candidate={pos:[x,y,z],index:s.carried,drop:true,id:shiftParcel(s,s.carried).id};
  if(canUse(s,candidate,blocks))return candidate;
 }
 return null;
}
// Select the box under the crosshair, not merely the closest objective.
export function handlingTarget(s,blocks){
 if(s.carried>=0){
  const target=dockTarget();return canUse(s,target,blocks)?target:dropTarget(s,blocks);
 }
 let best=null,score=Infinity;
 for(let i=0;i<s.states.length;i++){
  if(s.states[i]!=='AVAILABLE')continue;
  const target={...shiftParcel(s,i),index:i,pos:parcelPos(s,i)};
  const hit=pickupContact(s,target,blocks);
  if(hit&&hit.score<score){best=target;score=hit.score;}
 }
 return best??nextTarget(s);
}
export function nextTarget(s){
 if(s.carried>=0)return dockTarget();
 let best=null,d=Infinity;for(let i=0;i<s.states.length;i++){if(s.states[i]!=='AVAILABLE')continue;const p={...shiftParcel(s,i),pos:parcelPos(s,i)};let dist=Math.hypot(s.x-p.pos[0],s.z-p.pos[2],(s.y-p.pos[1])*1.8);if(dist<d){best={...p,index:i};d=dist;}}
 return best;
}
const useEye=s=>[s.x,s.y+(s.bodyHeight??1.70)-.12,s.z];
const cargoBox=([x,y,z])=>[x-parcelHalf[0],z-parcelHalf[2],x+parcelHalf[0],z+parcelHalf[2],y,y+parcelHalf[1]];
function lineClear(s,target,eye,p,blocks,others=[]){
 // Only ignore the original conveyor's conservative load collision.
 for(const b of [...blocks,...worldBounds,...others]){
  if(target.area==='Conveyor sorting'&&!s.parked?.[target.index]&&!target.drop&&
     b[0]<target.pos[0]&&b[2]>target.pos[0]&&b[1]<target.pos[2]&&b[3]>target.pos[2]&&b[5]<=target.pos[1]+.14)continue;
  if(traceBox(eye,p,b)<.985)return false;
 }
 return true;
}
function pickupContact(s,target,blocks,locked=false){
 if(!target||s.failed||s.vault||s.carried>=0||s.states[target.index]!=='AVAILABLE')return null;
 const eye=useEye(s),f=forward(s),[x,y,z]=target.pos,[w,h,d]=parcelHalf;
 const box=cargoBox(target.pos),limit=locked?2.02:1.80;
 const nearest=[Math.max(x-w,Math.min(x+w,eye[0])),Math.max(y,Math.min(y+h,eye[1])),Math.max(z-d,Math.min(z+d,eye[2]))];
 if(Math.hypot(...vsub(nearest,eye))>limit)return null;
 const nearby=blocks.filter(b=>b[2]>=eye[0]-2.2&&b[0]<=eye[0]+2.2&&b[3]>=eye[2]-2.2&&b[1]<=eye[2]+2.2);
 const others=s.states.flatMap((state,i)=>i===target.index?[]:state==='AVAILABLE'?[cargoBox(parcelPos(s,i))]:state==='DELIVERED'?[cargoBox(baySlot((s.deliveryOrder??s.states.flatMap((v,j)=>v==='DELIVERED'?[j]:[])).indexOf(i)))]:[]);
 const end=eye.map((v,i)=>v+f[i]*limit),t=traceBox(eye,end,box);
 const direct=t<=1?eye.map((v,i)=>v+(end[i]-v)*t):null;
 // Real visible surfaces: center, front/back, edges and upper/lower faces.
 const points=[...(direct?[direct]:[]),[x,y+h*.52,z],nearest];
 for(const dx of [-w*.94,0,w*.94])for(const dy of [h*.12,h*.55,h*.92])for(const dz of [-d*.94,0,d*.94])points.push([x+dx,y+dy,z+dz]);
 let best=null;
 for(const p of points){
  const v=vsub(p,eye),dist=Math.hypot(...v),alignment=dot(unit(v),f);
  if(dist>limit||(!locked&&alignment<.78))continue;
  if(!lineClear(s,target,eye,p,nearby,others))continue;
  const score=dist*.13+(1-alignment)*5-(p===direct?2:0);
  if(!best||score<best.score)best={point:p,score};
  if(p===direct)return best;
 }
 return best;
}
export function canUse(s,target,blocks=[],locked=false){
 if(!target||s.vault||s.failed)return false;
 if(!target.dock&&!target.drop)return !!pickupContact(s,target,blocks,locked);
 if(target.drop&&(!s.grounded||s.carried!==target.index||!placementClear(s,target.pos,blocks)))return false;
 if(target.dock&&s.carried<0)return false;
 const eye=useEye(s),f=forward(s),[x,y,z]=target.pos;
 if(target.drop){
  const p=[x,y+.24,z],v=vsub(p,eye);
  if(Math.hypot(...v)>1.91||dot(unit([v[0],0,v[2]]),[-Math.sin(s.yaw),0,-Math.cos(s.yaw)])<.73)return false;
  return lineClear(s,target,eye,p,blocks);
 }
 // The dispatch pallet is a zone. Aim at any visible portion of its top,
 // including the upper stack, instead of an invisible single point.
 if(Math.abs(s.y-y)>1.25||Math.hypot(s.x-x,s.z-z)>2.50)return false;
 for(const dx of [-.92,0,.92])for(const dz of [-.52,0,.52])for(const dy of [.35,.78,1.15]){
  const p=[x+dx,y+dy,z+dz],v=vsub(p,eye),d=Math.hypot(...v);
  if(d<=2.1&&(locked||dot(unit(v),f)>.70)&&lineClear(s,target,eye,p,blocks))return true;
 }
 return false;
}
export function interact(s,target,blocks,locked=false){
 if(!canUse(s,target,blocks,locked))return null;
 if(target.drop){
  (s.parked??={})[target.index]=target.pos.slice();
  s.states[target.index]='AVAILABLE';s.carried=-1;
  s.noise={x:target.pos[0],y:target.pos[1],z:target.pos[2],radius:4.5,time:s.elapsed};s.horrorEvent={type:'drop',time:s.elapsed};return 'dropped';
 }
 if(target.dock&&s.carried>=0&&s.states[s.carried]==='CARRIED'){s.deliveryOrder??=s.states.flatMap((v,i)=>v==='DELIVERED'?[i]:[]);s.deliveryOrder.push(s.carried);s.states[s.carried]='DELIVERED';s.carried=-1;s.horrorEvent={type:'delivery',time:s.elapsed};s.noise={x:s.x,y:s.y+.5,z:s.z,radius:7,time:s.elapsed};return 'delivered';}
 if(!target.dock&&s.carried===-1&&s.states[target.index]==='AVAILABLE'){s.carried=target.index;s.states[target.index]='CARRIED';s.horrorEvent={type:'pickup',time:s.elapsed};s.noise={x:s.x,y:s.y+.5,z:s.z,radius:5,time:s.elapsed};return 'picked';}
 return null;
}
export function baySlot(n){return [DOCK[0]+((n%3)-1)*.65,DOCK[1]+Math.floor(n/6)*.484,DOCK[2]+(Math.floor((n%6)/3)-.5)*.60];}
export function parcelPositions(s,hidden=-1){
 const order=s.deliveryOrder??s.states.flatMap((v,i)=>v==='DELIVERED'?[i]:[]);
 return s.states.flatMap((p,i)=>i===hidden?[]:s.states[i]==='AVAILABLE'?[parcelPos(s,i)]:s.states[i]==='DELIVERED'?[baySlot(order.indexOf(i))]:[]);
}
