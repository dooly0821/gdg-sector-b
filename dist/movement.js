import {nearbyBlocks} from './contact.js';
// Original, Source-inspired movement controller. All units are metres/seconds.
export const PHYSICS=Object.freeze({hz:120,walk:4.5,sprint:7,groundAccel:11,friction:7,stopSpeed:1.7,airAccel:22,airWish:2.65,hopTurn:3.35,bhopCap:13.4,gravity:18,jump:Math.sqrt(2*18*1.2),jumpHeight:1.2,crouchJumpHeight:1.0,hopHeightBonus:.35,slideExit:.24,slideTurn:2.2,slideDuration:.8,slideRecovery:.4,radius:.255,height:1.70,stepHeight:.25,groundSnap:.16,jumpBuffer:.18,skin:.001});
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
 if(b[6]==='stair-ramp')return y<stairTop(b,x,z)-.012&&y+height>.012;
 if(!b[7])return y<b[5]-.012&&y+height>b[4]+.012;
 const span=heightSpan(b,x,z);
 return y<Math.max(blockHeight(b,z-span,1),blockHeight(b,z+span,1))-.012&&
  y+height>Math.min(blockHeight(b,z-span,0),blockHeight(b,z+span,0))+.012;
}
// Visual treads and AI/visibility geometry remain unchanged. The player
// uses a cached, continuous floor across each tagged stair flight.
const stairCache=new WeakMap();
export function movementBlocks(blocks){
 if(stairCache.has(blocks))return stairCache.get(blocks);
 const groups=new Map(),out=[];
 for(const b of blocks){const meta=b[8];if(!meta?.id){out.push(b);continue;}
  let r=groups.get(meta.id);if(!r){r=[b[0],b[1],b[2],b[3],0,meta.top,'stair-ramp',null,meta];groups.set(meta.id,r);out.push(r);}
  else {r[0]=Math.min(r[0],b[0]);r[1]=Math.min(r[1],b[1]);r[2]=Math.max(r[2],b[2]);r[3]=Math.max(r[3],b[3]);}
 }
 const result=groups.size?out:blocks;stairCache.set(blocks,result);return result;
}
export function stairTop(b,x,z){const m=b[8],a=m.axis===0?x:z;return m.top*clamp((a-m.low)/(m.high-m.low),0,1);}
function supportTop(b,x,z){return b[6]==='stair-ramp'?stairTop(b,x,z):b[6]==='rail'?railTop(b,x,z):blockHeight(b,z,1);}
function clip(s,nx,nz){let v=s.vx*nx+s.vz*nz;if(v<0){s.vx-=nx*v;s.vz-=nz*v;}}
// Resolve pre-existing overlaps gradually, not by projecting a worker
// through a deep collider in one frame. Never enter another solid while escaping.
function penetration(s,blocks,x=s.x,z=s.z){
 const hits=new Map();
 for(const b of blocks){if(!overlaps(s.y,b,z,x,s.bodyHeight))continue;const n=contact(x,z,b,P.radius);if(n&&n[2]>.002)hits.set(b,n[2]);}
 return hits;
}
function recoverOverlap(s,blocks,dt){
 const old=penetration(s,blocks);if(!old.size){s.collisionRecovery=false;return false;}
 // A valid low step/ramp seam is not a deep overlap. Allow the original
 // bounded step-up if the entire capsule fits at the accessible support.
 if(s.grounded){
  const y=s.y,top=Math.max(y,...[...old.keys()].map(b=>supportTop(b,s.x,s.z)).filter(h=>h<=y+P.stepHeight));
  if(top>y){s.y=top;if(!penetration(s,blocks).size){s.collisionRecovery=false;return false;}s.y=y;}
 }
 s.collisionRecovery=true;const total=[...old.values()].reduce((a,b)=>a+b,0);
 const step=Math.min(.055,3*dt);let best=null,score=total;
 // Search only a local ring; no arbitrary destination or floor change.
 for(const scale of [1,.5])for(let i=0;i<16;i++){
  const a=i*Math.PI/8,x=s.x+Math.cos(a)*step*scale,z=s.z+Math.sin(a)*step*scale;
  const next=penetration(s,blocks,x,z);
  if([...next].some(([b,d])=>!old.has(b)||d>old.get(b)+.001))continue;
  const sum=[...next.values()].reduce((a,b)=>a+b,0);
  if(sum<score-1e-6){best=[x,z];score=sum;}
 }
 if(best){s.x=best[0];s.z=best[1];}
 s.vx=s.vz=0;s.vy=0;s.jumpBuffer=0;
 return true;
}
function solve(s,blocks,dx,dz,surface){
 const oldX=s.x,oldZ=s.z,oldY=s.y; s.x+=dx;s.z+=dz;
 // Only allow a step if the top is accessible and the full body fits.
 if(s.grounded){let top=surface(s.x,s.z,s.y);for(const b of blocks){if(b[6]==='stair-ramp'&&contact(s.x,s.z,b,P.radius-.035)){const h=stairTop(b,s.x,s.z);if(h<=s.y+P.stepHeight)top=Math.max(top,h);}else if(b[6]!=='rail'&&b[6]!=='stair-ramp'&&b[5]>s.y+.012&&b[5]<=s.y+P.stepHeight&&contact(s.x,s.z,b,P.radius+.005))top=Math.max(top,b[5]);else if(railSupport(b,s.x,s.z)&&railSupport(b,oldX,oldZ)&&Math.abs(railTop(b,oldX,oldZ)-oldY)<.20){const h=railTop(b,s.x,s.z);if(h<=s.y+P.stepHeight)top=Math.max(top,h);}}
  if(top>s.y&&top-s.y<=P.stepHeight&&!blocks.some(b=>overlaps(top,b,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,b,P.radius)))s.y=top;
 }
 for(let i=0;i<7;i++){let hit=false;for(const b of blocks){if(!overlaps(s.y,b,s.z,s.x,s.bodyHeight))continue;const n=contact(s.x,s.z,b,P.radius);if(!n)continue;hit=true;s.x+=n[0]*(n[2]+P.skin);s.z+=n[1]*(n[2]+P.skin);clip(s,n[0],n[1]);}if(!hit)break;}
 if(Math.hypot(s.x-oldX,s.z-oldZ)>Math.hypot(dx,dz)+.012||blocks.some(b=>overlaps(s.y,b,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,b,P.radius-.002))){s.x=oldX;s.z=oldZ;s.y=oldY;s.vx=s.vz=0;}
}
function accelerate(s,x,z,wish,accel,dt){const add=wish-(s.vx*x+s.vz*z);if(add<=0)return;const amt=Math.min(add,accel*wish*dt);s.vx+=x*amt;s.vz+=z*amt;}
// Only momentum above ordinary sprint speed contributes to jump height.
export function jumpHeightFor(speed,duck=false){return (duck?P.crouchJumpHeight:P.jumpHeight)+P.hopHeightBonus*clamp((speed-P.sprint)/(P.bhopCap-P.sprint),0,1);}
function steerHop(s,x,z,dt,turn=P.hopTurn){
 const speed=Math.hypot(s.vx,s.vz);if(speed<2.5)return;
 const current=Math.atan2(s.vx,s.vz),goal=Math.atan2(x,z),angle=Math.atan2(Math.sin(goal-current),Math.cos(goal-current));
 const next=current+clamp(angle,-turn*dt,turn*dt);
 s.vx=Math.sin(next)*speed;s.vz=Math.cos(next)*speed;
}
export function move(s,keys,staticBlocks,dt,jump,surface,dynamic=[]){
 if(dt<=0)return;s.vx??=0;s.vz??=0;s.jumpBuffer??=0;
 const crouch=keys.has('KeyC'),pressed=keys.has('KeyV')&&!s.wasSlideKey||s.slideRequested;s.wasSlideKey=keys.has('KeyV');s.slideRequested=false;
 const wasSliding=(s.slideTime??0)>0;
 s.slideCooldown=Math.max(0,(s.slideCooldown??0)-dt);s.slideTime=Math.max(0,(s.slideTime??0)-dt);s.slideExit=Math.max(0,(s.slideExit??0)-dt);
 if(wasSliding&&!s.slideTime)s.slideExit=P.slideExit;
 if(pressed&&!s.slideTime&&!s.slideCooldown&&Math.hypot(s.vx,s.vz)>=P.sprint*.78){s.slideTime=P.slideDuration;s.slideCooldown=P.slideDuration+P.slideRecovery;s.slideExit=0;}
 const duck=crouch||s.slideTime>0,hopHeld=crouch&&keys.has('Space');
 // Retire legacy scripted vaults; all jumps are controlled by gravity and input.
 s.vault=null;s.ledgeIntent=0;
 if(jump||hopHeld)s.jumpBuffer=P.jumpBuffer;else s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 const blocks=[...nearbyBlocks(movementBlocks(staticBlocks),s.x,s.z),...dynamic,...bounds];
 const current=s.bodyHeight??P.height,target=duck?1.06:P.height;
 const height=current+clamp(target-current,-dt*6.8,dt*5.5);
 s.bodyHeight=height<=current||!blocks.some(b=>contact(s.x,s.z,b,P.radius)&&overlaps(s.y,b,s.z,s.x,height))?height:current;
 if(recoverOverlap(s,blocks,dt)){s.elapsed+=dt;return;}
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),heavy=s.carried>=0&&s.cargo?.[s.carried]?.special==='heavy',up=+keys.has('KeyW')-+keys.has('KeyS'),side=+keys.has('KeyD')-+keys.has('KeyA'),mag=Math.hypot(up,side),wish=(s.bodyHeight<P.height-.01?P.walk*.55:sprint?P.sprint:P.walk)*(heavy?.85:1);
 const x=mag?(Math.cos(s.yaw)*side-Math.sin(s.yaw)*up)/mag:0,z=mag?(-Math.sin(s.yaw)*side-Math.cos(s.yaw)*up)/mag:0;

 const preSpeed=Math.hypot(s.vx,s.vz);
 // A/D are steering inputs, never an acceleration trigger. Require actual
 // forward running momentum and unambiguous W at the instant of takeoff.
 const forwardSpeed=-Math.sin(s.yaw)*s.vx-Math.cos(s.yaw)*s.vz;
 const forwardHop=crouch&&up===1&&!keys.has('KeyA')&&!keys.has('KeyD')&&preSpeed>P.sprint*.78&&forwardSpeed>=preSpeed*.8;
 s.wasDuck=crouch;
 if(s.grounded&&s.jumpBuffer>0){
  // Compensate the semi-implicit gravity step equally at 60 and 120 Hz.
  s.vy=Math.sqrt(2*P.gravity*jumpHeightFor(preSpeed,crouch))+P.gravity*dt*.5;s.grounded=false;s.onRail=false;s.jumpBuffer=0;s.hopBoosted=false;
  // The slide remains active through takeoff; gravity alone controls Y.
  s.slideExit=0;
  if(forwardHop){const gain=Math.min(P.bhopCap,preSpeed+.88)/preSpeed;s.vx*=gain;s.vz*=gain;s.hopBoosted=true;}
 }
 const speedBeforeMove=Math.hypot(s.vx,s.vz),sliding=s.slideTime>0&&speedBeforeMove>P.walk;
 if(s.grounded||sliding){
  const speed=speedBeforeMove;
  const alignment=mag&&speed>.01?(s.vx*x+s.vz*z)/speed:0;
  if(sliding){
   // Forward input preserves the actual entry momentum. No velocity floor,
   // per-tick boost or position override: collision losses remain losses.
   const friction=alignment>.15?0:alignment<-.35?(s.grounded?4.0:2.0):(s.grounded?.12:0);
   const next=Math.max(0,speed-Math.max(speed,P.stopSpeed)*friction*dt);
   s.vx*=next/speed;s.vz*=next/speed;
   if(mag&&alignment>-.35)steerHop(s,x,z,dt,P.slideTurn);
  }else{
   const exit=!crouch&&s.slideExit>0&&alignment>.15&&speed>P.walk;
   const blend=exit?1-s.slideExit/P.slideExit:1;
   const friction=exit?P.friction*blend:P.friction,next=Math.max(0,speed-Math.max(speed,P.stopSpeed)*friction*dt);
   if(speed>0){s.vx*=next/speed;s.vz*=next/speed;}
   const exitWish=exit?(sprint?P.sprint:P.walk)*(heavy?.85:1):wish;
   if(mag)accelerate(s,x,z,exitWish,P.groundAccel,dt);
  }
 }else if(mag){
  const before=Math.hypot(s.vx,s.vz);
  if(duck&&!(keys.has('KeyA')&&keys.has('KeyD')))steerHop(s,x,z,dt);
  accelerate(s,x,z,P.airWish,P.airAccel,dt);
  // Preserve normal low-speed air control; fast movement and crouched air
  // steering may redirect existing momentum but cannot manufacture it.
  const cap=crouch?Math.max(before,P.airWish):Math.max(before,P.sprint*.78);
  const after=Math.hypot(s.vx,s.vz);if(after>cap){s.vx*=cap/after;s.vz*=cap/after;}
 }
 const speed=Math.hypot(s.vx,s.vz);if(speed>P.bhopCap){s.vx*=P.bhopCap/speed;s.vz*=P.bhopCap/speed;}
 const ox=s.x,oy=s.y,oz=s.z,wasGrounded=s.grounded;
 const slices=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vz)*dt/.035));for(let i=0;i<slices;i++)solve(s,blocks,s.vx*dt/slices,s.vz*dt/slices,surface);
 // Bound the whole tick too, rather than accumulating solver pushes per slice.
 if(Math.hypot(s.x-ox,s.z-oz)>speed*dt+.018){s.x=ox;s.y=oy;s.z=oz;s.vx=s.vz=0;}
 s.steps+=Math.hypot(s.x-ox,s.z-oz);
 const old=s.y;s.vy-=P.gravity*dt;let next=old+s.vy*dt;
 let floor=surface(s.x,s.z,old);
 for(const b of blocks){if(!contact(s.x,s.z,b,P.radius-.035))continue;const top=supportTop(b,s.x,s.z);if((b[6]!=='rail'||railSupport(b,s.x,s.z))&&top<=old+(s.vy<=0?.065:.025)&&top>=floor&&!blocks.some(c=>c!==b&&overlaps(top,c,s.z,s.x,s.bodyHeight)&&contact(s.x,s.z,c,P.radius)))floor=top;
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
 const blocks=[...nearbyBlocks(movementBlocks(staticBlocks),s.x,s.z),...dynamic,...bounds],n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.025));
 const rail=s.onRail&&s.netOnRail?blocks.find(b=>railSupport(b,s.x,s.z)&&Math.abs(railTop(b,s.x,s.z)-s.y)<.035):null;
 const clear=(x,z)=>(!rail||railSupport(rail,x,z)&&Math.abs(railTop(rail,x,z)-s.y)<.08)&&!blocks.some(b=>overlaps(s.y,b,z,x,s.bodyHeight??P.height)&&contact(x,z,b,P.radius));
 for(let i=0;i<n;i++){const x=s.x+dx/n,z=s.z+dz/n;if(clear(x,z)){s.x=x;s.z=z;}else{if(clear(x,s.z))s.x=x;if(clear(s.x,z))s.z=z;}}
}
