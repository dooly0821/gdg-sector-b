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
  return p.map((v,i)=>v+forward[i]*(z-oldZ)+normal[i]*(y-oldY));
 };
}
export function relaxedFingerAmounts(time,step,side){
 const pulse=Math.sin(time*1.31+side*.76);
 return [0,1,2,3].map(i=>.80+i*.115+.13*Math.sin(step-i*.36)+.08*pulse);
}
