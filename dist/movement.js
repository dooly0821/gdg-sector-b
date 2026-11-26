import {nearbyBlocks} from './contact.js';
// Original, Source-inspired movement controller. All units are metres/seconds.
export const PHYSICS=Object.freeze({hz:120,walk:4.5,sprint:7,groundAccel:11,friction:7,stopSpeed:1.7,airAccel:22,airWish:2.65,hopTurn:3.35,bhopCap:13.4,gravity:18,jump:Math.sqrt(2*18*1.2),jumpHeight:1.2,crouchJumpHeight:1.0,hopHeightBonus:.35,radius:.255,height:1.70,stepHeight:.25,groundSnap:.16,jumpBuffer:.18,skin:.001});
const P=PHYSICS,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const bounds=[[-16,-23,-14.79,12,-10,20],[-16,16,-14.79,23,-10,20],[14.55,-23,16,23,-10,20],[-16,-23,16,-21.4,-10,20],[-16,21.4,-3,22.15,-10,20],[3,21.4,16,22.15,-10,20],[11,-20,14.9,7,3.12,3.6]];
function contact(x,z,b,r){const [a,c,d,e]=b;const qx=clamp(x,a,d),qz=clamp(z,c,e),dx=x-qx,dz=z-qz,len=Math.hypot(dx,dz);if(len>=r)return null;if(len>1e-8)return [dx/len,dz/len,r-len];const sides=[[x-a,-1,0],[d-x,1,0],[z-c,0,-1],[e-z,0,1]].sort((a,b)=>a[0]-b[0]);return [sides[0][1],sides[0][2],r+sides[0][0]];}
export const worldBounds=bounds;
// Sloping rails carry the bottom and top heights at their near and far Z ends.
function blockHeight(b,z,edge){
 const slope=b[7];
 if(!slope)return b[4+edge];
 const t=clamp((z-b[1])/(b[3]-b[1]),0,1);
 return slope[edge]+(slope[edge+2]-slope[edge])*t;
}
function heightSpan(b,x,z){
 const dx=x-clamp(x,b[0],b[2]);
 return Math.sqrt(Math.max(0,P.radius*P.radius-dx*dx));
}
function railTop(b,x,z){const span=b[7]?heightSpan(b,x,z):0;return Math.max(blockHeight(b,z-span,1),blockHeight(b,z+span,1));}
function railSupport(b,x,z){return b[6]==='rail'&&contact(x,z,b,.15);}
function overlaps(y,b,z,x,height=P.height){
 if(!b[7])return y<b[5]-.012&&y+height>b[4]+.012;
 const span=heightSpan(b,x,z);
 return y<Math.max(blockHeight(b,z-span,1),blockHeight(b,z+span,1))-.012&&
  y+height>Math.min(blockHeight(b,z-span,0),blockHeight(b,z+span,0))+.012;
}
function clip(s,nx,nz){let v=s.vx*nx+s.vz*nz;if(v<0){s.vx-=nx*v;s.vz-=nz*v;}}
function solve(s,blocks,dx,dz,surface){
 const oldX=s.x,oldZ=s.z,oldY=s.y; s.x+=dx;s.z+=dz;
 // Only allow a step if the top is accessible and the full body fits.
 if(s.grounded){let top=surface(s.x,s.z,s.y);for(const b of blocks){if(b[6]!=='rail'&&b[5]>s.y+.012&&b[5]<=s.y+P.stepHeight&&contact(s.x,s.z,b,P.radius+.005))top=Math.max(top,b[5]);else if(railSupport(b,s.x,s.z)&&railSupport(b,oldX,oldZ)&&Math.abs(railTop(b,oldX,oldZ)-oldY)<.20){const h=railTop(b,s.x,s.z);if(h<=s.y+P.stepHeight)top=Math.max(top,h);}}
  if(top>s.y&&top-s.y<=P.stepHeight&&!blocks.some(b=>overlaps(top,b,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,b,P.radius)))s.y=top;
 }
 for(let i=0;i<7;i++){let hit=false;for(const b of blocks){if(!overlaps(s.y,b,s.z,s.x,s.bodyHeight))continue;const n=contact(s.x,s.z,b,P.radius);if(!n)continue;hit=true;s.x+=n[0]*(n[2]+P.skin);s.z+=n[1]*(n[2]+P.skin);clip(s,n[0],n[1]);}if(!hit)break;}
 if(blocks.some(b=>overlaps(s.y,b,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,b,P.radius-.002))){s.x=oldX;s.z=oldZ;s.y=oldY;s.vx=s.vz=0;}
}
function accelerate(s,x,z,wish,accel,dt){const add=wish-(s.vx*x+s.vz*z);if(add<=0)return;const amt=Math.min(add,accel*wish*dt);s.vx+=x*amt;s.vz+=z*amt;}
// Only momentum above ordinary sprint speed contributes to jump height.
export function jumpHeightFor(speed,duck=false){return (duck?P.crouchJumpHeight:P.jumpHeight)+P.hopHeightBonus*clamp((speed-P.sprint)/(P.bhopCap-P.sprint),0,1);}
function steerHop(s,x,z,dt){
 const speed=Math.hypot(s.vx,s.vz);if(speed<2.5)return;
 const current=Math.atan2(s.vx,s.vz),goal=Math.atan2(x,z),angle=Math.atan2(Math.sin(goal-current),Math.cos(goal-current));
 const next=current+clamp(angle,-P.hopTurn*dt,P.hopTurn*dt);
 s.vx=Math.sin(next)*speed;s.vz=Math.cos(next)*speed;
}
export function move(s,keys,staticBlocks,dt,jump,surface,dynamic=[]){
 if(dt<=0)return;s.vx??=0;s.vz??=0;s.jumpBuffer??=0;
 const duck=keys.has('KeyC'),hopHeld=duck&&keys.has('Space');
 // Retire legacy scripted vaults; all jumps are controlled by gravity and input.
 s.vault=null;s.ledgeIntent=0;
 if(jump||hopHeld)s.jumpBuffer=P.jumpBuffer;else s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 const blocks=[...nearbyBlocks(staticBlocks,s.x,s.z),...dynamic,...bounds];
 const current=s.bodyHeight??P.height,target=duck?1.06:P.height;
 const height=current+clamp(target-current,-dt*6.8,dt*5.5);
 s.bodyHeight=height<=current||!blocks.some(b=>contact(s.x,s.z,b,P.radius)&&overlaps(s.y,b,s.z,s.x,height))?height:current;
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),heavy=s.carried>=0&&s.cargo?.[s.carried]?.special==='heavy',up=+keys.has('KeyW')-+keys.has('KeyS'),side=+keys.has('KeyD')-+keys.has('KeyA'),mag=Math.hypot(up,side),wish=(s.bodyHeight<P.height-.01?P.walk*.55:sprint?P.sprint:P.walk)*(heavy?.85:1);
 const x=mag?(Math.cos(s.yaw)*side-Math.sin(s.yaw)*up)/mag:0,z=mag?(-Math.sin(s.yaw)*side-Math.cos(s.yaw)*up)/mag:0;

 const preSpeed=Math.hypot(s.vx,s.vz);
 if(s.grounded&&duck&&!s.wasDuck&&preSpeed>P.sprint*.78)s.slideTime=.42;
 if(!duck)s.slideTime=0;
 s.wasDuck=duck;
 s.slideTime=Math.max(0,(s.slideTime??0)-dt);
 if(s.grounded&&s.jumpBuffer>0){
  // Compensate the semi-implicit gravity step equally at 60 and 120 Hz.
  s.vy=Math.sqrt(2*P.gravity*jumpHeightFor(preSpeed,duck))+P.gravity*dt*.5;s.grounded=false;s.onRail=false;s.jumpBuffer=0;s.hopBoosted=false;
  s.slideTime=0;
 }
 // One small momentum gain per airborne hop, never a per-frame speed exploit.
 // Crouch-jumping at running speed rewards a forward or strafe input.
 if(!s.grounded&&duck&&mag&&!s.hopBoosted&&preSpeed>P.sprint*.78&&s.vx*x+s.vz*z>preSpeed*.15){
  const gain=Math.min(P.bhopCap,preSpeed+.88)/preSpeed;
  s.vx*=gain;s.vz*=gain;s.hopBoosted=true;
 }
 if(s.grounded){
  const speed=Math.hypot(s.vx,s.vz),sliding=s.slideTime>0&&duck&&speed>P.walk;
  const friction=sliding?1.6:P.friction,next=Math.max(0,speed-Math.max(speed,P.stopSpeed)*friction*dt);
  if(speed>0){s.vx*=next/speed;s.vz*=next/speed;}
  if(mag)accelerate(s,x,z,wish,sliding?3:P.groundAccel,dt);
 }else if(mag){if(duck)steerHop(s,x,z,dt);accelerate(s,x,z,P.airWish,P.airAccel,dt);}
 const speed=Math.hypot(s.vx,s.vz);if(speed>P.bhopCap){s.vx*=P.bhopCap/speed;s.vz*=P.bhopCap/speed;}
 const ox=s.x,oz=s.z,wasGrounded=s.grounded;
 const slices=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vz)*dt/.035));for(let i=0;i<slices;i++)solve(s,blocks,s.vx*dt/slices,s.vz*dt/slices,surface);
 s.steps+=Math.hypot(s.x-ox,s.z-oz);
 const old=s.y;s.vy-=P.gravity*dt;let next=old+s.vy*dt;
 let floor=surface(s.x,s.z,old);
 for(const b of blocks){if(!contact(s.x,s.z,b,P.radius-.035))continue;const top=b[6]==='rail'?railTop(b,s.x,s.z):blockHeight(b,s.z,1);if((b[6]!=='rail'||railSupport(b,s.x,s.z))&&top<=old+(s.vy<=0?.065:.025)&&top>=floor&&!blocks.some(c=>c!==b&&overlaps(top,c,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,c,P.radius)))floor=top;
  const span=b[7]?heightSpan(b,s.x,s.z):0;
  const bottom=Math.min(blockHeight(b,s.z-span,0),blockHeight(b,s.z+span,0));
  if(s.vy>0&&old+s.bodyHeight<=bottom+.012&&next+s.bodyHeight>=bottom){next=Math.min(next,bottom-s.bodyHeight-.002);s.vy=0;}}
 if(s.vy<=0&&(next<=floor+.003||(wasGrounded&&old-floor<=P.groundSnap&&old>=floor))){s.y=floor;s.vy=0;s.grounded=true;}else{s.y=next;s.grounded=false;}
 s.onRail=s.grounded&&blocks.some(b=>railSupport(b,s.x,s.z)&&Math.abs(railTop(b,s.x,s.z)-s.y)<.035);
 s.elapsed+=dt;
}

// Apply small network corrections without changing input velocity or crossing walls.
export function nudgeCoopPosition(s,staticBlocks,dx,dz,dynamic=[]){
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||s.vault)return;
 const blocks=[...nearbyBlocks(staticBlocks,s.x,s.z),...dynamic,...bounds],n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.025));
 const rail=s.onRail&&s.netOnRail?blocks.find(b=>railSupport(b,s.x,s.z)&&Math.abs(railTop(b,s.x,s.z)-s.y)<.035):null;
 const clear=(x,z)=>(!rail||railSupport(rail,x,z)&&Math.abs(railTop(rail,x,z)-s.y)<.08)&&!blocks.some(b=>overlaps(s.y,b,z,x,s.bodyHeight??P.height)&&contact(x,z,b,P.radius));
 for(let i=0;i<n;i++){const x=s.x+dx/n,z=s.z+dz/n;if(clear(x,z)){s.x=x;s.z=z;}else{if(clear(x,s.z))s.x=x;if(clear(s.x,z))s.z=z;}}
}
