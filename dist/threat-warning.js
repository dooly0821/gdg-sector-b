// Per-player warning state; no new physics or network endpoint.
export const WARNING_RADIUS=12,WARNING_EXIT=14,REACTION_SECONDS=1.25;
const names=['녹령','함귀','적재귀','표찰귀'],dirs=['정면','오른쪽 앞','오른쪽','오른쪽 뒤','뒤쪽','왼쪽 뒤','왼쪽','왼쪽 앞'],arrows=['↑','↗','→','↘','↓','↙','←','↖'];
export function updateThreatWarnings(root,players,actors){
 const now=root.elapsed??0;
 for(const a of actors)if(!a.warningId)a.warningId=String(root.threatActorSequence=(root.threatActorSequence??0)+1);
 for(const p of players){
  const old=p.threatWarnings??{},next={};
  if(!p.failed)for(const a of actors){
   if(a.state==='disappear')continue;
   const prior=old[a.warningId],d=Math.hypot(a.x-p.x,a.z-p.z),dy=(a.surfaceY??0)-p.y;
   if(d>(prior?WARNING_EXIT:WARNING_RADIUS)||Math.abs(dy)>4&&a.state!=='ceilingStalk'&&a.state!=='wallDescent')continue;
   const w=prior??{id:(p.id??'solo')+':'+a.warningId+':'+(p.threatSequence=(p.threatSequence??0)+1),first:now,ackAt:null};
   w.kind=a.kind;w.x=a.x;w.z=a.z;w.y=a.surfaceY??0;w.distance=d;w.urgent=d<=4.5;next[a.warningId]=w;
  }
  p.threatWarnings=next;
 }
}
export function warningList(p){return Object.values(p.threatWarnings??{}).sort((a,b)=>a.distance-b.distance);}
export function acknowledgeWarnings(p,ids,now){
 if(!Array.isArray(ids))return;
 for(const w of warningList(p))if(w.ackAt==null&&ids.slice(0,4).includes(w.id))w.ackAt=now;
}
export function warnedForCapture(p,a,now){
 const w=p.threatWarnings?.[a.warningId];return !!w&&Number.isFinite(w.ackAt)&&now-w.ackAt>=REACTION_SECONDS;
}
export function warningLabel(p,w){
 const dx=w.x-p.x,dz=w.z-p.z,dy=w.y-p.y,right=dx*Math.cos(p.yaw??0)-dz*Math.sin(p.yaw??0),ahead=-dx*Math.sin(p.yaw??0)-dz*Math.cos(p.yaw??0);
 const i=(Math.round(Math.atan2(right,ahead)/(Math.PI/4))+8)%8,vertical=dy>2.2?' · 위층/상부':dy< -2.2?' · 아래층':'';
 return {arrow:arrows[i],text:names[w.kind]+' · '+dirs[i]+vertical+(w.urgent?' · 즉시 회피':' 접근 주의'),urgent:w.urgent};
}
