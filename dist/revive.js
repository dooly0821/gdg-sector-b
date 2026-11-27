import {traceBox} from './contact.js';
export const REVIVE_SECONDS=1.7,REVIVE_RANGE=2.8;
export function findReviveTarget(s,players,blocks,you,preferred=null){
 if(s.failed)return null;
 const valid=(players??[]).filter(p=>p.id!==you&&p.failed&&Math.abs(p.y-s.y)<=1.65&&Math.hypot(p.x-s.x,p.z-s.z)<=REVIVE_RANGE+(p.id===preferred?.toString()? .25:0)&&
  [ .65,1.05,1.35 ].some(h=>[.25,.55,.85].some(th=>!blocks.some(b=>traceBox([s.x,s.y+h,s.z],[p.x,p.y+th,p.z],b)<.985))));
 return valid.find(p=>p.id===preferred)??valid.sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z))[0]??null;
}
