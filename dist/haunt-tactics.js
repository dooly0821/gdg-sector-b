// Observation-based tactics: bounded prediction, never read live hidden coordinates.
import {freeAt,segmentFree} from './haunt-navigation.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>Number.isFinite(v)?v:0;
export const HUNT_PROFILE=Object.freeze([
 {lead:.34,reach:2.6,memory:12,hearing:1.07,search:1.10,speed:1.045},
 {lead:.22,reach:1.65,memory:14,hearing:1.15,search:1.13,speed:1.055},
 {lead:.42,reach:3.1,memory:12,hearing:1.05,search:1.15,speed:1.045},
 {lead:.48,reach:3.4,memory:14,hearing:1.08,search:1.12,speed:1.05}
].map(Object.freeze));
export function clearObservation(a){a.observedVelocity=null;a.observedPoint=null;a.predictedTarget=null;a.predictDelay=0;a.trailUsed=false;a.trailTarget=null;a.sweepChecked=[];a.inspectRetry=0;}
export function observePlayer(a,s){
 const vx=finite(s.vx),vz=finite(s.vz),speed=Math.hypot(vx,vz),limit=speed>13.4?13.4/speed:1;
 const old=a.observedVelocity??[vx*limit,vz*limit];
 a.observedVelocity=[old[0]*.4+vx*limit*.6,old[1]*.4+vz*limit*.6];
 a.observedPoint=[s.x,s.z];a.trailUsed=false;a.trailTarget=null;
}
export function predictedPoint(a,nav,body,seconds,maxDistance){
 const p=a.observedPoint,v=a.observedVelocity;if(!p||!v)return null;
 const speed=Math.hypot(...v);if(speed<.8)return null;
 const d=Math.min(maxDistance,speed*seconds),dir=v.map(n=>n/speed);
 for(const f of [1,.66,.33]){const q=p.map((n,i)=>n+dir[i]*d*f);
  if(freeAt(nav,...q,body,.03)&&segmentFree(nav,p,q,body,.025))return q;
 }return null;
}
export function pursueVisible(a,s,nav,body,dt){
 const profile=HUNT_PROFILE[a.kind],p=a.observedPoint??[s.x,s.z],dist=Math.hypot(a.x-p[0],a.z-p[1]);
 if(dist<2.5||s.y>.65){a.predictedTarget=null;a.predictDelay=0;return p;}
 a.predictDelay=Math.max(0,(a.predictDelay??0)-dt);
 if(!a.predictDelay){a.predictDelay=.17+a.kind*.025;a.predictedTarget=predictedPoint(a,nav,body,profile.lead,profile.reach);}
 return a.predictedTarget??p;
}
export function lostTrail(a,nav,body){
 if(a.trailUsed)return a.trailTarget??null;
 a.trailUsed=true;a.trailTarget=predictedPoint(a,nav,body,.65,3.5);return a.trailTarget;
}
export function searchBearing(a,phase){
 const v=a.observedVelocity;if(!v||Math.hypot(...v)<.8)return phase;
 return Math.atan2(v[0],v[1])+Math.sin(phase)*1.05;
}
export function searchExpired(a,difficulty,dist){
 const lost=a.lost??0;
 return lost>HUNT_PROFILE[a.kind].memory+Math.max(0,difficulty.count-1)*1.5+(difficulty.memoryBonus??0)||
  dist>difficulty.escape&&lost>difficulty.memory;
}
export function alreadyChecked(a,p){return (a.checked??[]).some(q=>Array.isArray(q)&&Math.hypot(q[0]-p[0],q[1]-p[1])<.25);}

// Prefer fresh search locations aligned with the last observed motion.
export function sweepVisited(a,p){return (a.sweepChecked??[]).some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1.1);}
export function rememberSweep(a,p){if(p&&!sweepVisited(a,p))a.sweepChecked=[...(a.sweepChecked??[]).slice(-7),p.slice()];}
export function hidingScore(a,p){const origin=a.lastKnown??[a.x,a.z],v=a.observedVelocity??[0,0],speed=Math.hypot(...v),dx=p[0]-origin[0],dz=p[1]-origin[1],d=Math.hypot(dx,dz);const ahead=speed>.8&&d>.1?(dx*v[0]+dz*v[1])/(d*speed):0;return Math.hypot(p[0]-a.x,p[1]-a.z)+d*.35-ahead*1.4;}
