import {dot} from './world.js';

export const jointShares=[.42,.40,.18];
export const jointStops=[0,.37,.68];
export const defaultFingers={
 digitWidths:[-.044,-.014,.016,.046],
 knuckles:[.006,.006,.006,.006],
 digitLengths:[.085,.093,.087,.073]
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function interpolate(value,widths,values){
 for(let i=0;i<3;i++){
  if(value<=widths[i+1])return mix(values[i],values[i+1],smooth((value-widths[i])/(widths[i+1]-widths[i])));
 }
 return values[3];
}
export function prepareFingerBend(flex){
 if(!flex||Math.abs(flex.amount)<.00001)return null;
 const {pivot,forward,normal,width,amount}=flex;
 const {digitWidths,knuckles,digitLengths}={...defaultFingers,...flex};
 const amounts=flex.fingerAmounts??[1,1,1,1];
 return p=>{
  const rel=[p[0]-pivot[0],p[1]-pivot[1],p[2]-pivot[2]],across=dot(rel,width);
  const weight=smooth((across-digitWidths[0]+.026)/.016);
  const root=interpolate(across,digitWidths,knuckles);
  const length=interpolate(across,digitWidths,digitLengths);
  const curl=amount*interpolate(across,digitWidths,amounts)*weight;
  let z=dot(rel,forward),y=dot(rel,normal);
  const oldZ=z,oldY=y;
  // Compose distal hinges first so the proximal rotation carries the whole finger.
  for(let j=2;j>=0;j--){
   const joint=root+length*jointStops[j],localZ=z-joint;
   const angle=curl*jointShares[j]*smooth(localZ/.017);
   const c=Math.cos(angle),s=Math.sin(angle);
   z=joint+localZ*c+y*s;y=y*c-localZ*s;
  }
  // The thumb opposes the palm around its own oblique basal axis.
  // Fade the rotation into the thenar pad to keep the wrist and palm fixed.
  const thumbMask=smooth((digitWidths[0]-.009-across)/.029)*smooth((oldZ+.075)/.037);
  // Bend the interphalangeal and metacarpophalangeal joints before
  // applying basal opposition. All three axes rotate the existing tissue.
  for(const [joint,share] of [[-.020,.24],[-.050,.19]]){
   const local=z-joint,angle=amount*share*thumbMask*smooth(local/.018);
   const c=Math.cos(angle),s=Math.sin(angle);
   z=joint+local*c+y*s;y=y*c-local*s;
  }
  const thumbAngle=amount*.88*thumbMask;
  const w=across-digitWidths[0],h=y+.009;
  const c=Math.cos(thumbAngle),s=Math.sin(thumbAngle);
  return p.map((v,i)=>v+forward[i]*(z-oldZ)+normal[i]*(y-oldY+w*s+h*(c-1))+width[i]*(w*(c-1)-h*s));
 };
}
export function relaxedFingerAmounts(time,step,side){
 const pulse=Math.sin(time*1.31+side*.76);
 return [0,1,2,3].map(i=>.80+i*.115+.13*Math.sin(step-i*.36)+.08*pulse);
}

// Shared timing for the reach, weight transfer and recovery of a vault.
export function vaultPose(v){
 if(!v)return {reach:0,brace:0};
 const t=v.time/v.duration;
 const reach=smooth(t/v.entry)* (1-smooth((t-v.entry)/(1-v.entry)));
 const brace=smooth(t/.18)*(1-smooth((t-.68)/.32));
 return {reach,brace};
}
