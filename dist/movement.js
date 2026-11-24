// Original, Source-inspired movement controller. All units are metres/seconds.
export const PHYSICS=Object.freeze({hz:120,walk:4.5,sprint:7,groundAccel:11,friction:7,stopSpeed:1.7,airAccel:12,airWish:1.15,bhopCap:9.8,gravity:14,jump:5.25,radius:.255,height:1.70,stepHeight:.25,groundSnap:.16,jumpBuffer:.10,skin:.001});
const P=PHYSICS,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const bounds=[[-16,-23,-14.79,12,-10,20],[-16,16,-14.79,23,-10,20],[14.55,-23,16,23,-10,20],[-16,-23,16,-21.4,-10,20],[-16,21.4,16,23,-10,20],[11,-20,14.9,7,3.12,3.6]];
function contact(x,z,b,r){const [a,c,d,e]=b;const qx=clamp(x,a,d),qz=clamp(z,c,e),dx=x-qx,dz=z-qz,len=Math.hypot(dx,dz);if(len>=r)return null;if(len>1e-8)return [dx/len,dz/len,r-len];const sides=[[x-a,-1,0],[d-x,1,0],[z-c,0,-1],[e-z,0,1]].sort((a,b)=>a[0]-b[0]);return [sides[0][1],sides[0][2],r+sides[0][0]];}
export const worldBounds=bounds;
const overlaps=(y,b)=>y<b[5]-.012&&y+P.height>b[4]+.012;
function clip(s,nx,nz){let v=s.vx*nx+s.vz*nz;if(v<0){s.vx-=nx*v;s.vz-=nz*v;}}
function solve(s,blocks,dx,dz,surface){
 const oldX=s.x,oldZ=s.z,oldY=s.y; s.x+=dx;s.z+=dz;
 // Only allow a step if the top is accessible and the full body fits.
 if(s.grounded){let top=surface(s.x,s.z,s.y);for(const b of blocks){if(b[5]>s.y+.012&&b[5]<=s.y+P.stepHeight&&contact(s.x,s.z,b,P.radius+.005))top=Math.max(top,b[5]);}
  if(top>s.y&&top-s.y<=P.stepHeight&&!blocks.some(b=>overlaps(top,b)&&contact(s.x,s.z,b,P.radius)))s.y=top;
 }
 for(let i=0;i<7;i++){let hit=false;for(const b of blocks){if(!overlaps(s.y,b))continue;const n=contact(s.x,s.z,b,P.radius);if(!n)continue;hit=true;s.x+=n[0]*(n[2]+P.skin);s.z+=n[1]*(n[2]+P.skin);clip(s,n[0],n[1]);}if(!hit)break;}
 if(blocks.some(b=>overlaps(s.y,b)&&contact(s.x,s.z,b,P.radius-.002))){s.x=oldX;s.z=oldZ;s.y=oldY;s.vx=s.vz=0;}
}
function accelerate(s,x,z,wish,accel,dt){const add=wish-(s.vx*x+s.vz*z);if(add<=0)return;const amt=Math.min(add,accel*wish*dt);s.vx+=x*amt;s.vz+=z*amt;}
const ease=t=>t*t*(3-2*t);
function vaultPoint(v,t){
 const lift=ease(Math.min(1,t/.43)),travel=ease(clamp((t-.43)/.57,0,1));
 return [v.x+v.dx*travel,v.y+(v.top-v.y)*lift,v.z+v.dz*travel];
}
function planVault(s,blocks,x,z,surface){
 if(s.handAction||s.pendingUse||s.carried>=0)return null;
 const blocked=(px,py,pz)=>blocks.some(b=>overlaps(py,b)&&contact(px,pz,b,P.radius));
 for(let reach=.08;reach<=.36;reach+=.07){
  const obstacle=blocks.find(b=>b[6]&&b[5]-s.y>P.stepHeight&&b[5]-s.y<=1.12&&
    contact(s.x+x*reach,s.z+z*reach,b,P.radius));
  if(!obstacle)continue;
  let distance=reach+.27;
  if(obstacle[6]==='rail'){
   while(distance<1.55&&contact(s.x+x*distance,s.z+z*distance,obstacle,P.radius+.075))distance+=.065;
   if(distance>=1.55)return null;
  }else if(!contact(s.x+x*distance,s.z+z*distance,obstacle,.08)){
   return null; // Too little room to land on the prop.
  }
  const v={x:s.x,y:s.y,z:s.z,dx:x*distance,dz:z*distance,top:obstacle[5]+.015,time:0,duration:obstacle[6]==='rail'?.46:.41};
  const ceiling=surface(s.x+v.dx,s.z+v.dz,v.top);
  if(ceiling>v.top)return null;
  for(let i=1;i<=24;i++){const p=vaultPoint(v,i/24);if(blocked(...p))return null;}
  return v;
 }
 return null;
}
function advanceVault(s,dt){
 const v=s.vault,oldX=s.x,oldZ=s.z;
 v.time=Math.min(v.duration,v.time+dt);
 [s.x,s.y,s.z]=vaultPoint(v,v.time/v.duration);
 s.steps+=Math.hypot(s.x-oldX,s.z-oldZ);s.elapsed+=dt;
 if(v.time===v.duration)s.vault=null;
}
export function move(s,keys,staticBlocks,dt,jump,surface){
 if(dt<=0)return;s.vx??=0;s.vz??=0;s.jumpBuffer??=0;
 if(jump)s.jumpBuffer=P.jumpBuffer;else s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 const up=+keys.has('KeyW')-+keys.has('KeyS'),side=+keys.has('KeyD')-+keys.has('KeyA'),mag=Math.hypot(up,side),wish=keys.has('ShiftLeft')||keys.has('ShiftRight')?P.sprint:P.walk;
 const x=mag?(Math.cos(s.yaw)*side-Math.sin(s.yaw)*up)/mag:0,z=mag?(-Math.sin(s.yaw)*side-Math.cos(s.yaw)*up)/mag:0;
 const blocks=[...staticBlocks,...bounds];
 if(s.vault){advanceVault(s,dt);return;}
 if(s.grounded&&s.jumpBuffer>0&&mag){
  s.vault=planVault(s,blocks,x,z,surface);
  if(s.vault){s.grounded=false;s.jumpBuffer=0;s.vx=s.vy=s.vz=0;advanceVault(s,dt);return;}
 }
 if(s.grounded&&s.jumpBuffer>0){s.vy=P.jump;s.grounded=false;s.jumpBuffer=0;}
 if(s.grounded){const speed=Math.hypot(s.vx,s.vz),next=Math.max(0,speed-Math.max(speed,P.stopSpeed)*P.friction*dt);if(speed>0){s.vx*=next/speed;s.vz*=next/speed;}if(mag)accelerate(s,x,z,wish,P.groundAccel,dt);}
 else if(mag)accelerate(s,x,z,P.airWish,P.airAccel,dt);
 const speed=Math.hypot(s.vx,s.vz);if(speed>P.bhopCap){s.vx*=P.bhopCap/speed;s.vz*=P.bhopCap/speed;}
 const ox=s.x,oz=s.z,wasGrounded=s.grounded;
 const slices=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vz)*dt/.035));for(let i=0;i<slices;i++)solve(s,blocks,s.vx*dt/slices,s.vz*dt/slices,surface);
 s.steps+=Math.hypot(s.x-ox,s.z-oz);
 const old=s.y;s.vy-=P.gravity*dt;let next=old+s.vy*dt;
 let floor=surface(s.x,s.z,old);
 for(const b of blocks){if(!contact(s.x,s.z,b,P.radius-.035))continue;const top=b[5];if(top<=old+.025&&top>=floor)floor=top;
  if(s.vy>0&&old+P.height<=b[4]+.012&&next+P.height>=b[4]){next=Math.min(next,b[4]-P.height-.002);s.vy=0;}}
 if(s.vy<=0&&(next<=floor+.003||(wasGrounded&&old-floor<=P.groundSnap&&old>=floor))){s.y=floor;s.vy=0;s.grounded=true;}else{s.y=next;s.grounded=false;}
 s.elapsed+=dt;
}
