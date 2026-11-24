import {dropTarget} from './mission.js';
import {buildLegs} from './worker.js';
import {relaxedFingerAmounts,vaultPose} from './hand-motion.js';
import {ACTOR_START,CREATURE_GROUP_COUNT,buildHauntRigs} from './haunt.js';
import {basis,cameraView,multiply,unit,cross,dot} from './world.js';
import {TORCH_LOCAL,SOCKETS,FINGER_FLEX} from './viewmodel.js';
import {CONFIG,baySlot,deliveryCount,canUse,interact,forward} from './mission.js';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
// Seconds. Keep all contact phases and shared transforms intact.
export const HAND_TIMING=Object.freeze({pickup:.34,place:.40,equip:.16,stow:.10,cargoEquip:.24,cargoStow:.15});

// Keep the exported scene intact. Split only the viewmodel's draw batches.
export function rigs(worlds){
 const [building,parcel,empty,carried,flashlight]=worlds;
 const group=(world,channel)=>({materials:world.materials,parts:world.parts.filter(p=>p.channel===channel)});
 const creatures=buildHauntRigs();
 const upper=['leftSleeve','rightSleeve'].map(channel=>{
  const sleeve=group(carried,channel),fabric=sleeve.parts.find(p=>p.m.name==='vm_uniform')?.m;
  return {...sleeve,parts:sleeve.parts.map(p=>({...p,m:fabric??p.m}))};
 });
 return [building,parcel,group(empty,'left'),group(empty,'right'),group(carried,'left'),group(carried,'right'),group(carried,'parcel'),flashlight,group(carried,'leftSleeve'),group(carried,'rightSleeve'),group(carried,'support'),...creatures,...upper,...buildLegs()];
}
export function workerLegLayers(s){
 if(s.pitch>-.68)return [];
 const root=transform([0,Math.PI+s.yaw,0],[s.x,s.y,s.z],1);
 const speed=Math.min(1,Math.hypot(s.vx,s.vz)/CONFIG.walk);
 const stride=Math.sin(s.steps*4.9)*speed*(s.grounded?.42:.12);
 const crouch=(1.70-(s.bodyHeight??1.70))/.64;
 return [-1,1].map((side,i)=>{
  const hip=[side*.115,.63,0],swing=side*stride-.26*crouch;
  const leg=multiply(translate(hip),multiply(transform([swing,0,0],[0,0,0],1),translate(hip.map(v=>-v))));
  const lift=.63*(1-Math.cos(swing));
  leg[13]-=lift;
  return {group:ACTOR_START+CREATURE_GROUP_COUNT+2+i,matrix:multiply(root,leg)};
 });
}
export function beginHandling(s,target,blocks,locked=false){
 if(s.handAction||!canUse(s,target,blocks,locked))return false;
 if((target.dock||target.drop)?s.carried<0:s.states[target.index]!=='AVAILABLE'||s.carried>=0)return false;
 s.flashlight=false;s.flashAmount=0;
 s.handAction={placing:!!(target.dock||target.drop),target,index:target.dock?s.carried:target.index,
  worldPos:target.dock?baySlot(deliveryCount(s)):target.pos.slice(),time:0,duration:target.dock||target.drop?HAND_TIMING.place:HAND_TIMING.pickup};
 return true;
}
export function advanceHandling(s,blocks,dt){
 const a=s.handAction;if(!a)return null;
 if(!a.result&&a.target.drop){
  const target=dropTarget(s,blocks);
  if(!target){s.handAction=null;return 'cancelled';}
  a.target=target;a.worldPos=target.pos.slice();
 }
 if(!a.result&&!canUse(s,a.target,blocks,true)){s.handAction=null;return 'cancelled';}
 a.time+=dt;
 const contact=a.duration*(a.placing?.72:.30);
 if(!a.result&&a.time>=contact)a.result=interact(s,a.target,blocks,true);
 if(a.time<a.duration)return null;
 s.handAction=null;
 return a.result??'cancelled';
}
function transform(angles,position,scale){
 const axes=basis(...angles);
 return new Float32Array([...axes[0].map(v=>v*scale),0,...axes[1].map(v=>v*scale),0,...axes[2].map(v=>v*scale),0,...position,1]);
}
// Keep the torch, glove and sleeve in one assembly. Aim down camera -Z.
const torchBasis=basis(Math.asin(TORCH_LOCAL.direction[1]),Math.atan2(-TORCH_LOCAL.direction[0],-TORCH_LOCAL.direction[2]),0);
const torchWrist=SOCKETS.torch.wrist;
const aimTorch=p=>torchBasis.map((axis,i)=>dot(axis,p.map((v,j)=>v-torchWrist[j]))+torchWrist[i]);
const torchAim={position:aimTorch(TORCH_LOCAL.position),direction:[0,0,-1]};
function torchLayer(layer){
 const offset=layer.offset;
 const origin=aimTorch([0,0,0]).map((v,i)=>v+offset[i]);
 return {...layer,offset:[0,0,0],matrix:new Float32Array([
  ...torchBasis.map(a=>a[0]),0,...torchBasis.map(a=>a[1]),0,...torchBasis.map(a=>a[2]),0,...origin,1
 ])};
}
// Q toggles a stored tool.
export function toggleFlashlight(s){
 if(s.handAction)return false;
 s.flashlight=!s.flashlight;return true;
}
// Exact critically damped step for offsets measured in view metres or radians.
function settle(position,velocity,goals,omega,dt){
 const decay=Math.exp(-omega*dt);
 for(let i=0;i<goals.length;i++){
  const error=position[i]-goals[i],v=velocity[i],j=v+omega*error;
  position[i]=goals[i]+(error+j*dt)*decay;
  velocity[i]=(v-omega*j*dt)*decay;
 }
}
export function updateViewmodel(s,dt){
 const target=s.flashlight&&!s.handAction&&!s.vault?.high?1:0;
 const flashA=s.flashAmount??0;
 const equip=s.carried>=0?HAND_TIMING.cargoEquip:HAND_TIMING.equip,stow=s.carried>=0?HAND_TIMING.cargoStow:HAND_TIMING.stow;
 s.flashAmount=target>flashA?Math.min(target,flashA+dt/equip):Math.max(target,flashA-dt/stow);
 const speed=Math.hypot(s.vx||0,s.vz||0),a=1-Math.exp(-dt*12);
 s.motionSpeed=mix(s.motionSpeed??0,speed,a);
 const dyaw=Math.atan2(Math.sin(s.yaw-(s.lastViewYaw??s.yaw)),Math.cos(s.yaw-(s.lastViewYaw??s.yaw)));
 const dpitch=s.pitch-(s.lastViewPitch??s.pitch);
 const rateScale=dt>0?1/(dt*60):0;
 const yawRate=dyaw*rateScale,pitchRate=dpitch*rateScale;
 const targets=[[-yawRate*2.9,.050],[-pitchRate*2.7,.042],[-yawRate*1.8,.028],[-pitchRate*1.6,.022]]
  .map(([value,limit])=>Math.max(-limit,Math.min(limit,value)));
 s.viewLag??=[0,0,0,0];s.viewLagVelocity??=[0,0,0,0];
 settle(s.viewLag,s.viewLagVelocity,targets,21,dt);
 [s.swayX,s.swayY,s.handYawLag,s.handPitchLag]=s.viewLag;
 s.lastViewYaw=s.yaw;s.lastViewPitch=s.pitch;
 if(s.grounded&&s.wasAirborne)s.landKick=Math.min(.055,.012+(s.fallSpeed??0)*.004);
 s.fallSpeed=Math.max(0,-s.vy);
 s.wasAirborne=!s.grounded;s.landKick=(s.landKick??0)*Math.exp(-dt*13);
 s.airOffset=mix(s.airOffset??0,s.grounded?0:Math.max(-.038,Math.min(.038,-s.vy*.0075)),a);
 // Critically damped spring: inertia driven by actual player velocity, shared by hands and parcel.
 const side=(s.vx||0)*Math.cos(s.yaw)-(s.vz||0)*Math.sin(s.yaw),front=-(s.vx||0)*Math.sin(s.yaw)-(s.vz||0)*Math.cos(s.yaw);
 const goals=[Math.max(-.023,Math.min(.023,-side*.003)),s.grounded?0:Math.max(-.035,Math.min(.035,-(s.vy||0)*.006)),Math.max(-.026,Math.min(.026,(front-(s.prevFront??front))*.018))];s.prevFront=front;
 s.cargoSpring??=[0,0,0];s.cargoSpringV??=[0,0,0];
 settle(s.cargoSpring,s.cargoSpringV,goals,17,dt);
}
const ANCHOR=[0,-.584,-.864], HELD_SIZE=.446;
const translate=p=>transform([0,0,0],p,1);
const point=(M,p)=>[0,1,2].map(i=>M[i]*p[0]+M[i+4]*p[1]+M[i+8]*p[2]+M[i+12]);
function approachRotation(matrix,t){
 const scale=Math.hypot(matrix[0],matrix[1],matrix[2]);
 const r=Array.from(matrix,v=>v/scale);
 const w=Math.sqrt(Math.max(0,1+r[0]+r[5]+r[10]))/2;
 // Extract the axis from the largest diagonal near a half turn.
 let axis;
 if(w>.001)axis=unit([r[6]-r[9],r[8]-r[2],r[1]-r[4]]);
 else{
  const j=[r[0],r[5],r[10]].indexOf(Math.max(r[0],r[5],r[10]));
  axis=unit([0,1,2].map(k=>r[4*j+k]+(j===k?1:0)));
 }
 const [x,y,z]=axis,a=2*Math.acos(Math.min(1,w))*t,c=Math.cos(a),k=1-c,b=Math.sin(a),size=mix(1,scale,t);
 const axes=[[c+x*x*k,y*x*k+z*b,z*x*k-y*b],[x*y*k-z*b,c+y*y*k,z*y*k+x*b],[x*z*k+y*b,y*z*k-x*b,c+z*z*k]];
 return new Float32Array([...axes.flatMap(v=>[...v.map(n=>n*size),0]),0,0,0,1]);
}
// Solve shoulder/elbow/wrist in view metres. A forward shoulder reach absorbs
// the final distance for low shelves without scaling the forearm or glove.
function sleeveLayers(layer,i){
 const {wrist,elbow}=SOCKETS[i?'carryR':'carryL'],M=layer.matrix??translate(layer.offset);
 const hand=point(M,wrist.map((v,j)=>v+(layer.matrix?layer.offset[j]:0)));
 const side=i?1:-1,shoulder=[side*.29,-.24,.16];
 const axis=unit(hand.map((v,j)=>v-shoulder[j]));
 const lower=Math.hypot(...wrist.map((v,j)=>v-elbow[j])),upper=.47;
 const d=Math.max(.15,Math.min(lower+upper-.004,Math.hypot(...hand.map((v,j)=>v-shoulder[j]))));
 const root=hand.map((v,j)=>v-d*axis[j]);
 const pole=[side*.75,-1,.05],along=(upper*upper-lower*lower+d*d)/(2*d);
 const bend=unit(pole.map((v,j)=>v-dot(pole,axis)*axis[j]));
 const joint=root.map((v,j)=>v+axis[j]*along+bend[j]*Math.sqrt(Math.max(0,upper*upper-along*along)));
 const from=unit(wrist.map((v,j)=>v-elbow[j])),right=unit(cross(from,[0,1,0]));
 const source=[right,cross(right,from),from];
 function segment(start,end,group,length){
  const to=unit(end.map((v,j)=>v-start[j])),right=unit(cross(to,Math.abs(to[1])>.98?[0,0,1]:[0,1,0]));
  const dest=[right,cross(right,to),to.map(v=>v*length/lower)];
  const axes=[0,1,2].map(j=>[0,1,2].map(k=>source.reduce((sum,a,n)=>sum+a[j]*dest[n][k],0)));
  const tr=start.map((v,k)=>v-axes.reduce((sum,a,j)=>sum+a[k]*elbow[j],0));
  return {group,offset:[0,0,0],matrix:new Float32Array([...axes[0],0,...axes[1],0,...axes[2],0,...tr,1])};
 }
 return [segment(joint,hand,8+i,lower),segment(root,joint,ACTOR_START+CREATURE_GROUP_COUNT+i,upper)];
}
export function choreography(s,eye,near,moving,sprinting,t,view=forward(s)){
 const a=s.handAction,phase=a?Math.min(1,a.time/a.duration):0;
 const holding=s.carried>=0,{reach:plant,brace}=vaultPose(s.vault);
 const stride=Math.min(1.45,(s.motionSpeed??(moving?(sprinting?7:4.5):0))/4.5)*(s.grounded?1:.28);
 const wave=Math.sin(s.steps*4.9),breath=Math.sin(t*1.45)*.003;
 const bob=[wave*.006*stride+(s.swayX??0)*.65,breath+Math.sin(s.steps*9.8+.6)*.0048*stride+(s.swayY??0)*.6+(s.airOffset??0)-(s.landKick??0),Math.cos(s.steps*4.9+.4)*.005*stride];
 bob[1]-=(s.obstruction??0)*.10;bob[2]+=(s.obstruction??0)*.52;
 // Carry is a rigid assembly: no independent hand or box sway.
 const cargoBob=bob.map((v,i)=>v*(i===1?.55:.65)+[0,.060+.075*brace,-.085+.105*brace][i]+(s.cargoSpring?.[i]??0));
 const idle=[-1,1].map((side,i)=>({group:2+i,offset:[bob[0]+side*wave*.008*stride,bob[1]+side*wave*.012*stride+(i?0:Math.sin(t*1.1)*.002),bob[2]]}));
 for(let i=0;i<2;i++){
  const name=i?'emptyR':'emptyL',side=i?1:-1,layer=idle[i],wrist=SOCKETS[name].wrist;
  const reach=plant*(i?.78:1);
  const rotation=transform([.027*stride*wave*side+(s.handPitchLag??0)-.34*reach,
   (s.handYawLag??0)+side*.11*reach,.021*stride*wave-side*.13*reach], [0,0,0],1);
  layer.offset[0]+=side*.06*reach;layer.offset[1]+=.20*reach;layer.offset[2]-=.24*reach;
  const rotated=point(rotation,wrist);
  // Rotate the entire hand/sleeve assembly around the wrist. The cuff never separates.
  layer.matrix=multiply(translate(wrist.map((v,j)=>v-rotated[j]+layer.offset[j])),rotation);
  if(s.vault?.grip&&!holding&&(!i||!s.flashlight)){
   const cam=cameraView(eye,view),target=point(cam,s.vault.grip);
   // Move the palm pad to the edge during support. Blend out beyond reach.
   const palm=point(layer.matrix,FINGER_FLEX[name].pivot);
   const delta=target.map((v,k)=>v-palm[k]+[side*.055,.032,.015][k]);
   const phase=s.vault.time/s.vault.duration;
   const contact=smooth(phase/.12)*(1-smooth((phase-.48)/.26))*(1-smooth((Math.hypot(...delta)-.38)/.60));
   for(let k=0;k<3;k++)layer.matrix[12+k]+=delta[k]*contact;
  }
  layer.offset=[0,0,0];
  const open=a?Math.sin(Math.PI*phase):reach;
  layer.flex={...FINGER_FLEX[name],fingerAmounts:relaxedFingerAmounts(t,s.steps*3.8,i),
   amount:.12+.047*Math.sin(t*1.45+i*.79)+.028*wave*stride-.164*open+.50*plant};
 }
 let hands=holding?[4,5,6].map(group=>({group,offset:cargoBob})):idle;
 let flight=null,assembly=false,hidden=-1;
 if(a){
  // Reach / contact / carry as a single rigid assembly / release / withdraw.
  const contact=a.placing? .72:.30;
  const heldFraction=a.placing?1-smooth(phase/contact):smooth((phase-contact)/(1-contact));
  const held=ANCHOR.map((v,i)=>v+cargoBob[i]);
  const cameraAxes=basis(s.pitch,s.yaw,0);
  const end=eye.map((v,i)=>v+cameraAxes.reduce((sum,axis,j)=>sum+axis[i]*held[j],0));
  const position=a.worldPos.map((v,i)=>mix(v,end[i],heldFraction));
  // shortest angular arc; exactly aligns with camera in the final pose.
  const yaw=Math.atan2(Math.sin(s.yaw),Math.cos(s.yaw));
  const pitch=s.pitch*heldFraction,scale=mix(1,HELD_SIZE/CONFIG.parcelWidth,heldFraction);
  if(a.target.drop||s.parked?.[a.index]){
   // Clear the support with the rotated bottom edge, then come to rest flush on contact.
   const corner=Math.abs(Math.sin(pitch))*CONFIG.parcelWidth*.41*scale;
   const correction=Math.max(0,a.worldPos[1]+corner-position[1]);
   position[1]+=correction*(1-smooth((heldFraction-.68)/.32));
  }
  flight=transform([pitch,yaw*heldFraction,0],position,scale);
  const cam=cameraView(eye,forward(s));
  const cargoMatrix=multiply(multiply(cam,flight),multiply(transform([0,0,0],[0,0,0],CONFIG.parcelWidth/HELD_SIZE),translate(ANCHOR.map(v=>-v))));
  const gripping=a.placing?phase<=contact:phase>=contact;
  assembly=gripping;
  hidden=!a.placing&&gripping?a.index:-1;
  if(gripping){hands=[4,5,6].map(group=>({group,offset:[0,0,0],matrix:cargoMatrix}));}
  else {
   // Open the grip outwards, never through the object. Use a smooth reach path.
   const reach=a.placing?1-smooth((phase-contact)/(1-contact)):smooth(phase/contact);
   hands=[4,5].map((group,i)=>{
    const side=i?1:-1,wrist=SOCKETS[i?'carryR':'carryL'].wrist;
    const start=point(idle[i].matrix,SOCKETS[i?'emptyR':'emptyL'].wrist);
    const goal=point(cargoMatrix,wrist);
    const desired=start.map((v,k)=>mix(v,goal[k],reach));
    desired[0]+=side*.095*Math.sin(Math.PI*reach);
    // Rotate from the view axes into the box's local axes along the shortest arc.
    const M=approachRotation(cargoMatrix,reach);
    const socket=point(M,wrist);
    for(let k=0;k<3;k++)M[12+k]=desired[k]-socket[k];
    return {group,matrix:M,offset:[0,0,0],flex:{pivot:wrist,forward:[0,0,-1],normal:[side,0,0],width:[0,1,0],amount:-.15*(1-reach)}};
   });
   // A pickup stays in its original world location until contact. A placed parcel
   // stays at the dock while hands withdraw, without a duplicate world draw.
   if(!a.placing||a.result)flight=null;
  }
 }
 const flash=a?0:(s.flashAmount??0);
 if(holding&&!a&&flash>0){
  // Transfer load while the right hand still supports the carton. Both paths are reversible.
  const transfer=smooth(flash/.52),shift=cargoBob.map((v,i)=>v+[-.23,.100,.035][i]*transfer);
  const under=smooth(flash/.52),arc=Math.sin(Math.PI*under);
  const base=flash<.26?SOCKETS.carryL:SOCKETS.supportL;
  const left={group:flash<.26?4:10,offset:under===1?shift:shift.map((v,k)=>v+mix(SOCKETS.carryL.wrist[k],SOCKETS.supportL.wrist[k],under)-base.wrist[k]+[-.10,-.12,.055][k]*arc)};
  const draw=smooth((flash-.52)/.48),tool=flash>=.76;
  const start=SOCKETS.carryR.wrist.map((v,k)=>v+shift[k]);
  const right={group:tool?7:5,offset:draw===0?shift:start.map((v,k)=>mix(v,SOCKETS.torch.wrist[k]+bob[k],draw)
   -(tool?SOCKETS.torch:SOCKETS.carryR).wrist[k]+[.065,-.08,.11][k]*Math.sin(draw*Math.PI))};
  hands=[left,right,{group:6,offset:shift}];
 }
 if(!holding&&!a&&flash>0){
  const u=smooth(flash),tool=flash>=.5;
  const start=point(idle[1].matrix,SOCKETS.emptyR.wrist);
  const wrist=start.map((v,k)=>mix(v,SOCKETS.torch.wrist[k]+bob[k],u)+[.025,-.085,.09][k]*Math.sin(Math.PI*u));
  if(tool)hands[1]={group:7,offset:wrist.map((v,k)=>v-SOCKETS.torch.wrist[k])};
  else for(let k=0;k<3;k++)hands[1].matrix[12+k]+=wrist[k]-start[k];
 }
 // Static carry uses the authored sleeve meshes. During a reach, extend sleeves
 // from the viewport edge to the exact animated wrist; no detached arm ends.
 for(const layer of [...hands])if(layer.group===4||layer.group===5){const i=layer.group-4;if(a||holding&&flash>0)hands.push(...sleeveLayers(layer,i));else hands.push({group:8+i,offset:layer.offset});}
 const torchIndex=hands.findIndex(layer=>layer.group===7);
 const torchOffset=torchIndex<0?bob:hands[torchIndex].offset;
 if(torchIndex>=0){
  torchOffset[1]-=.115*brace;
  torchOffset[2]+=.06*brace;
  hands[torchIndex]=torchLayer(hands[torchIndex]);
 }
 return {hands,flight,assembly,flashlight:flash>(holding?.82:.65)?smooth((flash-(holding?.82:.65))/(holding?.18:.35)):0,torchOffset,torchLocal:torchAim,hidden};
}
