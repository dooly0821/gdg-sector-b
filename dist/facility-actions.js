import {expandedLayout} from './map-layout.js';
import {traceBox} from './contact.js';
export const SIGNAL_RANGE=18,SIGNAL_DURATION=2,SIGNAL_COOLDOWN=12;
export const VENTS=[{x:-15,z:45},{x:-15,z:58.5},{x:-15,z:93,extra:true}];
export const ventsFor=s=>VENTS.filter(v=>!v.extra||expandedLayout(s));
export const zoneIndex=(x,z)=>z>=78?(x<-15?6:7):z>=54?(x<-15?4:5):z>=22?(x<-15?2:3):x<-15?1:0;
const zoneNames=['B','C-01','D-03','D-02','C-02','D-04','E-01','E-02'];
export const panelsFor=s=>Array.from({length:expandedLayout(s)?8:6},(_,i)=>({id:i,name:zoneNames[i],x:i===0||i%2===1&&i>1?-14.72:-15.28,z:[3,3,30,30,60,60,92,92][i],y:1.25}));
export const zonePowers=s=>Array.from({length:8},(_,i)=>s.powerZones?.[i]===false?.16:1);
export const zonePower=(s,x,z)=>s.powerZones?.[zoneIndex(x,z)]===false?.16:1;
export function powerTarget(s,blocks){
 if(s.failed||s.handAction||s.pendingUse)return null;
 const eye=[s.x,s.y+(s.bodyHeight??1.7)-.12,s.z],cp=Math.cos(s.pitch??0),f=[-Math.sin(s.yaw??0)*cp,Math.sin(s.pitch??0),-Math.cos(s.yaw??0)*cp];
 let best=null,dist=2.05;
 for(const p of panelsFor(s)){const q=[p.x,p.y,p.z],v=q.map((n,i)=>n-eye[i]),d=Math.hypot(...v);if(d<.1||d>dist||v.reduce((n,x,i)=>n+x*f[i],0)/d<.72||blocks.some(b=>traceBox(eye,q,b)<.96))continue;best=p;dist=d;}
 return best;
}
export function toggleZone(s,p,root=s){
 const power=root.powerZones??={};power[p.id]=power[p.id]===false;s.powerZones=power;
 return {type:'power',zone:p.id,message:p.name+' 구역 전력 '+(power[p.id]?'복구':'차단')};
}
export function buildFacilityPanels(w,level){
 const steel=w.mat('power-control','#414b50','metal'),red=w.mat('power-switch','#d08142','paint'),green=w.mat('power-indicator','#7cbb83','plain',.65);
 for(const p of panelsFor(level)){const side=p.x>-15?1:-1;w.box(p.x,1.25,p.z,.12,.48,.42,steel);w.box(p.x+side*.07,1.24,p.z,.035,.17,.10,red);w.box(p.x+side*.075,1.42,p.z,.025,.045,.06,green);w.sign(p.x+side*.068,1.6,p.z,.55,.15,'POWER / '+p.name,'#292e30','#d9c59a',side*Math.PI/2);}
}
export function buildVent(w,z){
 const frame=w.mat('vent-frame','#656c70','metal'),dark=w.mat('vent-lining','#3a4143','metal'),paint=w.mat('vent-stripe','#c2a05c','paint');
 // Portal shares the wall opening; trim is outside the 1.5m wide / 1.18m high clearance.
 for(const side of [-1,1]){w.box(-15,.59,z+side*.79,.65,1.18,.08,frame);w.box(-15,1.22,z,.68,.08,1.66,frame);w.box(-15,.014,z+side*.66,.67,.026,.08,paint);}
 w.box(-15,1.25,z,.74,.09,1.68,dark);
 for(const x of [-14.61,-15.39])w.sign(x,1.51,z,1.34,.18,'VENT / LOW ACCESS','#292e30','#dfca98',x>-15?Math.PI/2:-Math.PI/2);
}
export function signalReady(s){return Math.max(0,(s.signalCooldownUntil??0)-(s.elapsed??0));}
export function emitSignal(s,root,blocks){
 if(s.failed||!s.flashlight||s.handAction||s.pendingUse||signalReady(s)>0)return null;
 const eye=[s.x,s.y+(s.bodyHeight??1.7)-.12,s.z],cp=Math.cos(s.pitch??0),f=[-Math.sin(s.yaw??0)*cp,Math.sin(s.pitch??0),-Math.cos(s.yaw??0)*cp];
 const end=eye.map((n,i)=>n+f[i]*SIGNAL_RANGE);let hit=1;
 for(const b of blocks)hit=Math.min(hit,traceBox(eye,end,b));
 if(f[1]<0)hit=Math.min(hit,eye[1]/(-f[1]*SIGNAL_RANGE));
 const reach=Math.max(0,Math.min(SIGNAL_RANGE,hit*SIGNAL_RANGE-.28));
 let point=null;
 for(let d=reach;d>=1.5;d-=.4){const x=eye[0]+f[0]*d,z=eye[2]+f[2]*d;if(Math.hypot(x-s.x,z-s.z)<1.2)continue;if(blocks.some(b=>b[4]<1.0&&b[5]>.08&&b[0]<x+.45&&b[2]>x-.45&&b[1]<z+.45&&b[3]>z-.45))continue;point=[x,z,Math.max(.12,eye[1]+f[1]*d)];break;}
 if(!point)return null;
 const now=root.elapsed??s.elapsed??0,id=s.id??'solo',signals=root.signals??={};
 const signal={id:id+':'+now,owner:id,x:point[0],z:point[1],y:point[2],start:now,until:now+SIGNAL_DURATION};
 signals[id]=signal;s.signals=signals;s.signalCooldownUntil=now+SIGNAL_COOLDOWN;s.signalPulseUntil=signal.until;
 return signal;
}
export function signalForActor(root,a,nav,freeAt,body){
 const radius=[14,18,16,15][a.kind],t=root.elapsed??0;let best=null,distance=Infinity;
 for(const sig of Object.values(root.signals??{})){if(sig.until<=t||sig.id===a.lastSignal)continue;const d=Math.hypot(sig.x-a.x,sig.z-a.z);if(d>radius||d>=distance)continue;
  if(!freeAt(nav,sig.x,sig.z,body))continue;best=sig;distance=d;}
 return best;
}

// Expired signals need not occupy shared room storage or be sent to clients.
export function pruneSignals(s){if(!s.signals)return;for(const [id,signal] of Object.entries(s.signals))if(signal.until<=s.elapsed)delete s.signals[id];}
