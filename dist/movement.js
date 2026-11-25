import {nearbyBlocks} from './contact.js';
// Original, Source-inspired movement controller. All units are metres/seconds.
export const PHYSICS=Object.freeze({hz:120,walk:4.5,sprint:7,groundAccel:11,friction:7,stopSpeed:1.7,airAccel:16,airWish:2.15,hopTurn:2.65,bhopCap:11.2,gravity:14,jump:5.25,radius:.255,height:1.70,stepHeight:.25,groundSnap:.16,jumpBuffer:.10,skin:.001});
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
function railSupport(b,x,z){return b[6]==='rail'&&contact(x,z,b,.105);}
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
const ease=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const vaultHeight=1.25,landingRadius=P.radius-.035;
function travel(t,length,start,end){
 const blend=t*(1-t);
 return length*ease(t)+blend*((1-t)*start-t*end);
}
function vaultPoint(v,t){
 if(v.perch){const u=ease(clamp((t-.43)/.57,0,1)),h=ease(clamp(t/.43,0,1));return [mix(v.x,v.perch[0],u),t<.43?mix(v.y,v.crest,h):mix(v.crest,v.landing,ease(clamp((t-.87)/.13,0,1))),mix(v.z,v.perch[1],u)];}
 const distance=t<v.entry
  ? travel(t/v.entry,v.approach,v.startTangent*v.entry,v.entryTangent*v.entry)
  : v.approach+travel((t-v.entry)/(1-v.entry),v.distance-v.approach,
   v.entryTangent*(1-v.entry),v.exitSpeed*v.duration*(1-v.entry));
 let y=v.crest;
 if(t<v.entry)y=mix(v.y,v.crest,ease(t/v.entry));
 else if(v.rail)y=Math.max(v.landing,v.crest-P.gravity*(v.duration*Math.max(0,t-v.release))**2/2);
 else y=mix(v.crest,v.landing,ease(clamp((t-v.release)/(1-v.release),0,1)));
 return [v.x+v.dirX*distance,y,v.z+v.dirZ*distance];
}
// Controlled jump onto the actual rail. Sprinting still vaults across.
function planRailMount(s,blocks,x,z,surface){
 if(s.handAction||s.pendingUse||Math.hypot(s.vx,s.vz)>5.4)return null;
 const candidates=[];
 for(const b of blocks){
  if(b[6]!=='rail')continue;
  const thinX=b[2]-b[0]<b[3]-b[1],px=thinX?(b[0]+b[2])/2:clamp(s.x+x*.18,b[0]+.025,b[2]-.025),
   pz=thinX?clamp(s.z+z*.18,b[1]+.025,b[3]-.025):(b[1]+b[3])/2;
  const dx=px-s.x,dz=pz-s.z,d=Math.hypot(dx,dz),landing=railTop(b,px,pz),rise=landing-s.y;
  if(d<.035||d>.85||rise<.22||rise>1.22||d>.39&&(dx*x+dz*z)/d<.35)continue;
  candidates.push({px,pz,d,landing});
 }
 candidates.sort((a,b)=>a.d-b.d);
 for(const {px,pz,d,landing} of candidates){
  const v={perch:[px,pz],rail:true,grip:[px,landing,pz],x:s.x,y:s.y,z:s.z,dirX:(px-s.x)/d,dirZ:(pz-s.z)/d,distance:d,approach:d,entry:.43,release:.87,
   crest:landing+.065,landing,exitSpeed:0,duration:.43,bodyHeight:s.bodyHeight,time:0};
  let ok=true;
  for(let i=1;i<=80;i++){const [a,y,c]=vaultPoint(v,i/80);if(surface(a,c,y)>y+.012||blocks.some(b=>overlaps(y,b,c,a,s.bodyHeight)&&contact(a,c,b,P.radius))){ok=false;break;}}
  if(ok)return v;
 }
 return null;
}
function steerHop(s,x,z,dt){
 const speed=Math.hypot(s.vx,s.vz);if(speed<2.5)return;
 const current=Math.atan2(s.vx,s.vz),goal=Math.atan2(x,z),angle=Math.atan2(Math.sin(goal-current),Math.cos(goal-current));
 const next=current+clamp(angle,-P.hopTurn*dt,P.hopTurn*dt);
 s.vx=Math.sin(next)*speed;s.vz=Math.cos(next)*speed;
}
function planVault(s,blocks,x,z,surface,wish){
 if(s.handAction||s.pendingUse)return null;
 const speed=Math.hypot(s.vx,s.vz),alignment=speed?(x*s.vx+z*s.vz)/speed:0;
 if(alignment>.5){
  x=x+s.vx/wish*.35;
  z=z+s.vz/wish*.35;
  const length=Math.hypot(x,z);
  x/=length;z/=length;
 }
 const reach=mix(.60,.85,clamp(speed/P.sprint,0,1));
 const at=d=>[s.x+x*d,s.z+z*d];
 const hits=(b,d,r=P.radius)=>{const [px,pz]=at(d);return contact(px,pz,b,r);};
 const nearby=blocks.filter(b=>b[2]>=Math.min(s.x,s.x+2*x)-P.radius&&b[0]<=Math.max(s.x,s.x+2*x)+P.radius&&
  b[3]>=Math.min(s.z,s.z+2*z)-P.radius&&b[1]<=Math.max(s.z,s.z+2*z)+P.radius);
 let planHeight=s.bodyHeight;
 const blocked=(px,py,pz)=>surface(px,pz,py)>py+.012||
  nearby.some(b=>overlaps(py,b,pz,px,planHeight)&&contact(px,pz,b,P.radius));
 function planCrossing(obstacle,entryDistance){
  const rail=obstacle[6]==='rail',shelf=obstacle[6]==='shelf';
  // Tuck before entering the shelf, using the real collision height.
  planHeight=shelf?Math.min(s.bodyHeight,1.06):s.bodyHeight;
  // A landing footprint must fit on terrain or on the actual climbing surface.
  const footprint=[[0,0],...Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*landingRadius,Math.sin(i*Math.PI/4)*landingRadius])];
  function landingHeight(px,pz,limit){
   const levels=footprint.map(([dx,dz])=>{
    const fx=px+dx,fz=pz+dz;
    let top=surface(fx,fz,limit);
    for(const b of nearby){
     if(b[6]==='rail'||fx<b[0]||fx>b[2]||fz<b[1]||fz>b[3])continue;
     if(b[5]<=limit+.012)top=Math.max(top,b[5]);
    }
    return top;
   });
   return Math.max(...levels)-Math.min(...levels)<=.12?levels[0]:null;
  }
  let crest=blockHeight(obstacle,s.z+z*entryDistance,1);
  // A diagonal ascent can gain additional height from the ramp itself.
  const high=obstacle[6]==='shelf'&&crest-s.y>vaultHeight;
  if(high&&s.carried>=0){s.climbHint=s.elapsed+2;return null;}
  const maxCrest=s.y+(high?1.94:vaultHeight);
  if(high&&entryDistance>.60)return null;
  const onRamp=obstacle[7]&&Math.abs(blockHeight(obstacle,s.z,0)-s.y)<.24;
  if(crest>maxCrest&&!onRamp)return null;
  // Lower pallet boards can protrude beyond the upper crate. Begin lifting
  // before the first lip reached by the capsule, even from a standstill.
  let approach=rail?entryDistance*.97:Math.max(0,entryDistance-.025);
  if(!rail){
   for(let d=0;d<=approach;d=Math.min(approach,d+.015)){
    const [px,pz]=at(d);
    if(nearby.some(b=>b!==obstacle&&b[5]>s.y+.012&&b[5]<=crest&&overlaps(s.y,b,pz,px,s.bodyHeight)&&hits(b,d))){
     approach=Math.max(0,d-.015);break;
    }
    if(d===approach)break;
   }
  }
  for(let distance=entryDistance+.04;distance<=1.95;distance+=.025){
   const [px,pz]=at(distance);
   if(rail){
    // Follow the local top on a sloping rail through the entire crossing.
    if(hits(obstacle,distance,P.radius+.075)){
     const span=obstacle[7]?heightSpan(obstacle,px,pz):0;
     crest=Math.max(crest,blockHeight(obstacle,pz-span,1),blockHeight(obstacle,pz+span,1));
     continue;
    }
   }else if(px<obstacle[0]+landingRadius||px>obstacle[2]-landingRadius||
     pz<obstacle[1]+landingRadius||pz>obstacle[3]-landingRadius)continue;
   const localMax=onRamp?Math.max(maxCrest,blockHeight(obstacle,pz,0)+vaultHeight):maxCrest;
   if(crest>localMax)return null;
   const landing=landingHeight(px,pz,crest+.025);
   if(landing===null||(!rail&&Math.abs(landing-crest)>.012))continue;
   const top=crest+.026;
   // Check the fall column too. A free point above the rail is insufficient.
   let clear=true;
   for(let y=top;y>landing;y-=.035){if(blocked(px,y,pz)){clear=false;break;}}
   if(!clear||blocked(px,landing,pz))continue;
   const entry=high?.48:clamp(.34+approach*.12,.34,.44),crossing=distance-approach;
   const desiredExit=shelf?Math.min(2.5,Math.max(1.35,speed*.55)):Math.max(2.3,speed*Math.max(.78,alignment));
   const rise=Math.max(0,crest-s.y);
    const duration=high?clamp(.48+rise*.08,.58,.65):clamp(Math.max(.20+rise*.12,1.65*crossing/((1-entry)*desiredExit)),.25,.46);
   const exitSpeed=Math.min(desiredExit,2.65*crossing/((1-entry)*duration));
   const startTangent=Math.min(speed*duration,2*approach/entry);
   const entryTangent=Math.min(.75*approach/entry,.75*crossing/(1-entry));
   // Keep the feet above the rail until the capsule clears its far edge.
   const release=rail?.88:.80;
   const [edgeX,edgeZ]=at(entryDistance+P.radius);
   const grip=[clamp(edgeX,obstacle[0],obstacle[2]),blockHeight(obstacle,edgeZ,1),clamp(edgeZ,obstacle[1],obstacle[3])];
   const v={grip,x:s.x,y:s.y,z:s.z,dirX:x,dirZ:z,distance,approach,entry,release,crest:top,rail,landing,
    high,startTangent,entryTangent,exitSpeed,time:0,duration,bodyHeight:planHeight};
   // Sample the swept body more finely than a normal collision substep.
   for(let i=1;i<=96;i++){if(blocked(...vaultPoint(v,i/96))){clear=false;break;}}
   if(clear&&(!shelf||!blocks.some(b=>overlaps(s.y,b,s.z,s.x,planHeight)&&contact(s.x,s.z,b,P.radius))))return v;
  }
  return null;
 }
 const obstacles=[];
 for(const b of nearby){
  if(!b[6])continue;
  for(let d=0;d<=reach+.001;d=Math.min(d+.025,reach)){
   if(hits(b,d)){
    let low=Math.max(0,d-.025),high=d;
    for(let i=0;i<10;i++){const mid=(low+high)/2;if(hits(b,mid))high=mid;else low=mid;}
    const [px,pz]=at(d);
    if(blockHeight(b,pz,1)>s.y+P.stepHeight&&(b[6]==='shelf'||overlaps(s.y,b,pz,px,s.bodyHeight)))obstacles.push([b,low]);
    break;
   }
   if(d===reach)break;
  }
 }
 obstacles.sort((a,b)=>a[1]-b[1]);
 for(const [obstacle,entryDistance] of obstacles){
  const vault=planCrossing(obstacle,entryDistance);
  if(vault)return vault;
 }
 return null;
}
function advanceVault(s,dt){
 const v=s.vault,oldX=s.x,oldY=s.y,oldZ=s.z;
 v.time=Math.min(v.duration,v.time+dt);
 [s.x,s.y,s.z]=vaultPoint(v,v.time/v.duration);
 s.vx=(s.x-oldX)/dt;s.vy=(s.y-oldY)/dt;s.vz=(s.z-oldZ)/dt;
 s.steps+=Math.hypot(s.x-oldX,s.z-oldZ);s.elapsed+=dt;
 if(v.time===v.duration){
  s.vault=null;
  s.vx=v.dirX*v.exitSpeed;s.vz=v.dirZ*v.exitSpeed;
  s.grounded=s.y<=v.landing+.003;
  s.vy=s.grounded?0:-P.gravity*v.duration*(1-v.release);
  if(s.grounded)s.y=v.landing;s.onRail=!!v.perch&&s.grounded;
 }
}
export function move(s,keys,staticBlocks,dt,jump,surface,dynamic=[]){
 if(dt<=0)return;s.vx??=0;s.vz??=0;s.jumpBuffer??=0;
 const duck=keys.has('KeyC'),hopHeld=duck&&keys.has('Space');
 if((jump||hopHeld)&&!s.vault)s.jumpBuffer=P.jumpBuffer;else s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 const blocks=[...nearbyBlocks(staticBlocks,s.x,s.z),...dynamic,...bounds];
 const current=s.bodyHeight??P.height,target=duck||s.vault?.bodyHeight===1.06?1.06:P.height;
 const height=current+clamp(target-current,-dt*6.8,dt*5.5);
 s.bodyHeight=height<=current||!blocks.some(b=>contact(s.x,s.z,b,P.radius)&&overlaps(s.y,b,s.z,s.x,height))?height:current;
 const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),heavy=s.carried>=0&&s.cargo?.[s.carried]?.special==='heavy',up=+keys.has('KeyW')-+keys.has('KeyS'),side=+keys.has('KeyD')-+keys.has('KeyA'),mag=Math.hypot(up,side),wish=(s.bodyHeight<P.height-.01?P.walk*.55:sprint?P.sprint:P.walk)*(heavy?.85:1);
 const x=mag?(Math.cos(s.yaw)*side-Math.sin(s.yaw)*up)/mag:0,z=mag?(-Math.sin(s.yaw)*side-Math.cos(s.yaw)*up)/mag:0;

 if(s.vault){
  const [px,py,pz]=vaultPoint(s.vault,Math.min(1,(s.vault.time+dt)/s.vault.duration));
  if(!blocks.some(b=>overlaps(py,b,pz,px,s.bodyHeight)&&contact(px,pz,b,P.radius))){advanceVault(s,dt);return;}
  s.vault=null;s.vy=Math.min(0,s.vy);s.jumpBuffer=0;
 }
 if(s.grounded&&s.jumpBuffer>0){
  s.vault=!sprint&&!duck?planRailMount(s,blocks,mag?x:-Math.sin(s.yaw),mag?z:-Math.cos(s.yaw),surface):null;
  if(!s.vault&&mag)s.vault=planVault(s,blocks,x,z,surface,wish);
  if(s.vault){s.onRail=false;s.bodyHeight=s.vault.bodyHeight;s.grounded=false;s.jumpBuffer=0;advanceVault(s,dt);return;}
 }
 const preSpeed=Math.hypot(s.vx,s.vz);
 if(s.grounded&&duck&&!s.wasDuck&&preSpeed>P.sprint*.78)s.slideTime=.42;
 if(!duck)s.slideTime=0;
 s.wasDuck=duck;
 s.slideTime=Math.max(0,(s.slideTime??0)-dt);
 if(s.grounded&&s.jumpBuffer>0){
  s.vy=P.jump;s.grounded=false;s.onRail=false;s.jumpBuffer=0;s.hopBoosted=false;
  s.slideTime=0;
 }
 // One small momentum gain per airborne hop, never a per-frame speed exploit.
 // Crouch-jumping at running speed rewards a forward or strafe input.
 if(!s.grounded&&duck&&mag&&!s.hopBoosted&&preSpeed>P.sprint*.78&&s.vx*x+s.vz*z>preSpeed*.15){
  const gain=Math.min(P.bhopCap,preSpeed+.52)/preSpeed;
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
 for(const b of blocks){if(!contact(s.x,s.z,b,P.radius-.035))continue;const top=b[6]==='rail'?railTop(b,s.x,s.z):blockHeight(b,s.z,1);if((b[6]!=='rail'||railSupport(b,s.x,s.z))&&top<=old+.025&&top>=floor)floor=top;
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
