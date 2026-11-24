import {relaxedFingerAmounts,vaultPose} from './hand-motion.js';
import {buildHauntRigs} from './haunt.js';
import {basis,cameraView,multiply,unit,cross,dot} from './world.js';
import {TORCH_LOCAL,SOCKETS,FINGER_FLEX} from './viewmodel.js';
import {CONFIG,baySlot,deliveryCount,canUse,interact,forward} from './mission.js';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
// Seconds. Keep all contact phases and shared transforms intact.
export const HAND_TIMING=Object.freeze({pickup:.48,place:.52,equip:.18,stow:.16,cargoEquip:.34,cargoStow:.28});

// Keep the exported scene intact. Split only the viewmodel's draw batches.
export function rigs(worlds){
 const [building,parcel,empty,carried,flashlight]=worlds;
 const group=(world,channel)=>({materials:world.materials,parts:world.parts.filter(p=>p.channel===channel)});
 return [building,parcel,group(empty,'left'),group(empty,'right'),group(carried,'left'),group(carried,'right'),group(carried,'parcel'),flashlight,group(carried,'leftSleeve'),group(carried,'rightSleeve'),group(carried,'support'),...buildHauntRigs()];
}
export function beginHandling(s,target,blocks){
 if(s.handAction||!canUse(s,target,blocks))return false;
 if((target.dock||target.drop)?s.carried<0:s.states[target.index]!=='AVAILABLE'||s.carried>=0)return false;
 s.flashlight=false;s.flashAmount=0;
 s.handAction={placing:!!(target.dock||target.drop),target,index:target.dock?s.carried:target.index,
  worldPos:target.dock?baySlot(deliveryCount(s)):target.pos.slice(),time:0,duration:target.dock||target.drop?HAND_TIMING.place:HAND_TIMING.pickup};
 return true;
}
export function advanceHandling(s,blocks,dt){
 const a=s.handAction;if(!a)return null;
 if(!a.result&&!canUse(s,a.target,blocks)){s.handAction=null;return 'cancelled';}
 a.time+=dt;
 const contact=a.duration*(a.placing?.72:.30);
 if(!a.result&&a.time>=contact)a.result=interact(s,a.target,blocks);
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
export function updateViewmodel(s,dt){
 const target=s.flashlight&&!s.handAction&&!s.vault?.high?1:0;
 const flashA=s.flashAmount??0;
 const equip=s.carried>=0?HAND_TIMING.cargoEquip:HAND_TIMING.equip,stow=s.carried>=0?HAND_TIMING.cargoStow:HAND_TIMING.stow;
 s.flashAmount=target>flashA?Math.min(target,flashA+dt/equip):Math.max(target,flashA-dt/stow);
 const speed=Math.hypot(s.vx||0,s.vz||0),a=1-Math.exp(-dt*12);
 s.motionSpeed=mix(s.motionSpeed??0,speed,a);
 const dyaw=Math.atan2(Math.sin(s.yaw-(s.lastViewYaw??s.yaw)),Math.cos(s.yaw-(s.lastViewYaw??s.yaw)));
 const dpitch=s.pitch-(s.lastViewPitch??s.pitch);
 const rateScale=1/Math.max(1,dt*60);
 s.swayX=mix(s.swayX??0,Math.max(-.050,Math.min(.050,-dyaw*2.9*rateScale)),a);
 s.swayY=mix(s.swayY??0,Math.max(-.042,Math.min(.042,-dpitch*2.7*rateScale)),a);
 s.handYawLag=mix(s.handYawLag??0,Math.max(-.028,Math.min(.028,-dyaw*1.8)),1-Math.exp(-dt*10));
 s.handPitchLag=mix(s.handPitchLag??0,Math.max(-.022,Math.min(.022,-dpitch*1.6)),1-Math.exp(-dt*10));
 s.lastViewYaw=s.yaw;s.lastViewPitch=s.pitch;
 if(s.grounded&&s.wasAirborne)s.landKick=Math.min(.055,.012+(s.fallSpeed??0)*.004);
 s.fallSpeed=Math.max(0,-s.vy);
 s.wasAirborne=!s.grounded;s.landKick=(s.landKick??0)*Math.exp(-dt*13);
 s.airOffset=mix(s.airOffset??0,s.grounded?0:Math.max(-.038,Math.min(.038,-s.vy*.0075)),a);
 // Critically damped spring: inertia driven by actual player velocity, shared by hands and parcel.
 const side=(s.vx||0)*Math.cos(s.yaw)-(s.vz||0)*Math.sin(s.yaw),front=-(s.vx||0)*Math.sin(s.yaw)-(s.vz||0)*Math.cos(s.yaw);
 const goals=[Math.max(-.023,Math.min(.023,-side*.003)),s.grounded?0:Math.max(-.035,Math.min(.035,-(s.vy||0)*.006)),Math.max(-.026,Math.min(.026,(front-(s.prevFront??front))*.018))];s.prevFront=front;
 s.cargoSpring??=[0,0,0];s.cargoSpringV??=[0,0,0];const omega=17,decay=Math.exp(-omega*dt);
 for(let i=0;i<3;i++){const x=s.cargoSpring[i]-goals[i],v=s.cargoSpringV[i],j=v+omega*x;s.cargoSpring[i]=goals[i]+(x+j*dt)*decay;s.cargoSpringV[i]=(v-omega*j*dt)*decay;}
}
const ANCHOR=[0,-.584,-.864], HELD_SIZE=.446;
const translate=p=>transform([0,0,0],p,1);
const point=(M,p)=>[0,1,2].map(i=>M[i]*p[0]+M[i+4]*p[1]+M[i+8]*p[2]+M[i+12]);
// Stretch only the sleeve along its longitudinal axis. The glove stays rigid;
// its wrist remains welded visually to the sleeve, and the other end stays outside the camera frustum.
function sleeveLayer(layer,i){
 const {wrist,elbow}=SOCKETS[i?'carryR':'carryL'],M=layer.matrix??translate(layer.offset);
 const targetW=point(M,wrist.map((v,j)=>v+(layer.matrix?layer.offset[j]:0)));
 const from=unit(wrist.map((v,j)=>v-elbow[j]));
 const targetE=[i?.77:-.77,-.72,-.20];
 const toV=targetW.map((v,j)=>v-targetE[j]),to=unit(toV);
 const fRight=unit(cross(from,[0,1,0])),fUp=unit(cross(fRight,from));
 const tRight=unit(cross(to,[0,1,0])),tUp=unit(cross(tRight,to));
 const lengthScale=Math.hypot(...toV)/Math.hypot(...wrist.map((v,j)=>v-elbow[j]));
 const source=[fRight,fUp,from],dest=[tRight,tUp,to.map(v=>v*lengthScale)];
 const axes=[0,1,2].map(j=>[0,1,2].map(k=>source.reduce((sum,a,n)=>sum+a[j]*dest[n][k],0)));
 const tr=targetE.map((v,k)=>v-axes.reduce((sum,axis,j)=>sum+axis[k]*elbow[j],0));
 return {group:8+i,offset:[0,0,0],matrix:new Float32Array([...axes[0],0,...axes[1],0,...axes[2],0,...tr,1])};
}
export function choreography(s,eye,near,moving,sprinting,t){
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
  layer.offset=[0,0,0];
  const open=a?Math.sin(Math.PI*phase):reach;
  layer.flex={...FINGER_FLEX[name],fingerAmounts:relaxedFingerAmounts(t,s.steps*3.8,i),
   amount:.12+.047*Math.sin(t*1.45+i*.79)+.028*wave*stride-.164*open};
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
   // Early reach/late withdrawal passes below the viewport, hiding the pose swap.
   const switchAt=.20;
   if(reach<switchAt){hands=idle.map(layer=>({...layer,offset:[layer.offset[0],layer.offset[1]-.65*smooth(reach/switchAt),layer.offset[2]]}));}
   else {
    const close=smooth((reach-switchAt)/(1-switchAt));
    // Offset in the same local frame as the box; hands remain outside both sides.
    hands=[4,5].map((group,i)=>({group,matrix:cargoMatrix,offset:[(i?1:-1)*.14*(1-close),-.54*(1-close),.07*(1-close)],flex:{pivot:[(i?1:-1)*.25,-.43,-.69],forward:[0,0,-1],normal:[i?1:-1,0,0],width:[0,1,0],amount:-.23*(1-close)}}));
   }
   // A pickup stays in its original world location until contact. A placed parcel
   // stays at the dock while hands withdraw, without a duplicate world draw.
   if(!a.placing||a.result)flight=null;
  }
 }
 const flash=a?0:(s.flashAmount??0);
 if(holding&&!a&&flash>0){
  // Transfer load while the right hand still supports the carton. Both paths are reversible.
  const transfer=smooth(flash/.52),shift=cargoBob.map((v,i)=>v+[-.23,.100,.035][i]*transfer);
  const left=flash<.26?{group:4,offset:[shift[0]-.09*smooth(flash/.26),shift[1]-.62*smooth(flash/.26),shift[2]+.04*smooth(flash/.26)]}:{group:10,offset:[shift[0],shift[1]-.62*(1-smooth((flash-.26)/.26)),shift[2]]};
  let right;
  if(flash<.76){const pull=smooth((flash-.52)/.24);right={group:5,offset:[shift[0]+.25*pull,shift[1]-.67*pull,shift[2]+.10*pull]};}
  else{const rise=smooth((flash-.76)/.24);right={group:7,offset:[bob[0]+.035*(1-rise),bob[1]-.69*(1-rise),bob[2]+.045*(1-rise)]};}
  hands=[left,right,{group:6,offset:shift}];
 }
 if(!holding&&!a&&flash>0){
  if(flash<.5){hands[1].offset[1]-=.72*smooth(flash*2);}
  else {const rise=smooth((flash-.5)*2);hands[1]={group:7,offset:[bob[0]+.012*(1-rise),bob[1]-.72*(1-rise),bob[2]+.045*(1-rise)]};}
 }
 // Static carry uses the authored sleeve meshes. During a reach, extend sleeves
 // from the viewport edge to the exact animated wrist; no detached arm ends.
 for(const layer of [...hands])if(layer.group===4||layer.group===5){const i=layer.group-4;hands.push(a||holding&&flash>0?sleeveLayer(layer,i):{group:8+i,offset:layer.offset});}
 const torchIndex=hands.findIndex(layer=>layer.group===7);
 const torchOffset=torchIndex<0?bob:hands[torchIndex].offset;
 if(torchIndex>=0){
  torchOffset[1]-=.115*brace;
  torchOffset[2]+=.06*brace;
  hands[torchIndex]=torchLayer(hands[torchIndex]);
 }
 return {hands,flight,assembly,flashlight:flash>(holding?.82:.65)?smooth((flash-(holding?.82:.65))/(holding?.18:.35)):0,torchOffset,torchLocal:torchAim,hidden};
}
