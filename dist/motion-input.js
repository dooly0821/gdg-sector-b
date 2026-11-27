// Versioned, bounded input stream. No client-supplied position is authoritative.
export const MOTION_VERSION=1,MOTION_HZ=60,MAX_MOTION_BATCH=48,MAX_PENDING_MOTION=96;
const keys=['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space','KeyE'];
export function packMotion(seq,input,yaw,pitch,jump,slide){
 let mask=0;for(let i=0;i<keys.length;i++)if(input.has(keys[i]))mask|=1<<i;
 return [seq,mask,yaw,pitch,(jump?1:0)|(slide?2:0)];
}
export function unpackMotion(frame){
 if(!Array.isArray(frame)||frame.length!==5||!Number.isSafeInteger(frame[0])||frame[0]<1||!Number.isInteger(frame[1])||frame[1]<0||frame[1]>511||!Number.isFinite(frame[2])||Math.abs(frame[2])>1e4||!Number.isFinite(frame[3])||Math.abs(frame[3])>1.31||!Number.isInteger(frame[4])||frame[4]<0||frame[4]>3)return null;
 return {seq:frame[0],keys:new Set(keys.filter((_,i)=>frame[1]&(1<<i))),yaw:frame[2],pitch:frame[3],jump:!!(frame[4]&1),slide:!!(frame[4]&2)};
}
export function motionPose(s,t){return {t,x:s.x,y:s.y,z:s.z,cx:s.netAppliedX??0,cz:s.netAppliedZ??0,grounded:!!s.grounded,vault:!!s.vault};}
