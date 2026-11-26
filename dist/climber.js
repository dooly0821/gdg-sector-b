import {CLIMB_ROUTES,routeForPlayer} from './dressing.js';
import {queryBlocks,freeAt,segmentFree,navigate,recover} from './haunt-navigation.js';
import {traceBox} from './contact.js';
const BODY={r:.245,y:0,h:.95},EPS=.025;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const pos=a=>[a.x,a.surfaceY??0,a.z];
const bodyAt=y=>({...BODY,y});
const clear=(nav,p)=>freeAt(nav,p[0],p[2],bodyAt(p[1]));
const oldDecks=[-32,-2].map((x,i)=>({zone:'ESCAPE-'+i,x,z:64,top:3,deck:[x-1.5,65.8,x+1.5,69.5],nodes:[[x,0,58.7],...[.65,1.27,1.89,2.51].map((y,j)=>[x,y,60+j*1.6]),[x,3,66.45],[x,3,68]]}));
function deckFor(s){return oldDecks.find(r=>Math.abs(s.x-r.x)<1.3&&s.z>59.5&&s.z<69.4&&s.y>=.55&&s.y<=3.25)??null;}
function crateFor(s,nav,actor){
 if(s.y<.45||s.y>1.27)return null;
 const candidates=queryBlocks(nav,s.x-.35,s.z-.35,s.x+.35,s.z+.35).filter(b=>b[6]==='climb'&&Math.abs(s.y-b[5])<.10&&b[2]-b[0]>.55&&b[3]-b[1]>.55&&s.x>b[0]-.05&&s.x<b[2]+.05&&s.z>b[1]-.05&&s.z<b[3]+.05);
 for(const b of candidates){
  const x=(b[0]+b[2])*.5,z=(b[1]+b[3])*.5,h=b[5],p=[x,h,z];if(!clear(nav,p))continue;
  const edges=[[x,0,b[1]-.32],[x,0,b[3]+.32],[b[0]-.32,0,z],[b[2]+.32,0,z]].filter(q=>clear(nav,q)&&clear(nav,[q[0],h,q[2]])&&segmentFree(nav,[q[0],q[2]],[x,z],bodyAt(h),0));
  edges.sort((a,b)=>dist(a,pos(actor))-dist(b,pos(actor)));
  if(edges.length)return {zone:'crate:'+b.slice(0,6).join(','),x,z,top:h,deck:[b[0],b[1],b[2],b[3]],nodes:[edges[0],p]};
 }
 return null;
}
function eligible(s,nav,actor){
 if(!s.grounded||s.vault||s.y<.45)return null;
 return routeForPlayer(s)??deckFor(s)??crateFor(s,nav,actor);
}
const resetNav=a=>{a.navDelay=0;a.navPath=null;a.navJob=null;a.recoverPoint=null;a.navDirect=false;a.stuck=0;};
function toward(actor,p,dt,speed,nav,y=0){
 const dx=p[0]-actor.x,dz=p[2]-actor.z,d=Math.hypot(dx,dz),step=Math.min(d,speed*dt);
 if(d>.0001){
  const next=[actor.x+dx/d*step,actor.z+dz/d*step];
  if(!segmentFree(nav,[actor.x,actor.z],next,bodyAt(y),0))return false;
  actor.x=next[0];actor.z=next[1];const yaw=Math.atan2(dx,dz);actor.yaw+=clamp(Math.atan2(Math.sin(yaw-actor.yaw),Math.cos(yaw-actor.yaw)),-dt*7,dt*7);
 }return d<=step+.015;
}
function moveStep(a,p,dt,nav){
 const old=a.surfaceY??0,dy=p[1]-old,d=Math.hypot(p[0]-a.x,p[2]-a.z),v=dy>0?1.18:1.4;
 // Lift before crossing a riser. Lower only after reaching the next tread.
 if(dy>EPS){
  const y=Math.min(p[1],old+dt*v);
  if(!clear(nav,[a.x,y,a.z]))return 'blocked';
  a.surfaceY=y;return 'moving';
 }
 if(d>EPS){const x=a.x,z=a.z;if(!toward(a,p,dt,1.35,nav,old))return Math.hypot(a.x-x,a.z-z)<.0001?'blocked':'moving';}
 if(dy<-EPS){const y=Math.max(p[1],old-dt*v);if(!clear(nav,[a.x,y,a.z]))return 'blocked';a.surfaceY=y;return 'moving';}
 a.surfaceY=p[1];return 'done';
}
function face(a,s,dt){const yaw=Math.atan2(s.x-a.x,s.z-a.z);a.yaw+=clamp(Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw)),-dt*6,dt*6);}
export function updateClimber(a,s,nav,blocks,dt,hidden=false){
 if(a.kind!==2)return null;
 const target=hidden?null:eligible(s,nav,a),distance=Math.hypot(a.x-s.x,a.z-s.z);
 if(!a.climb){
  if(!target||distance>19||(!a.pursuit&&blocks.some(b=>traceBox([a.x,.75,a.z],[s.x,s.y+1.1,s.z],b)<.999)))return null;
  // Never begin a climb unless all waypoints have body clearance.
  if(!target.nodes.every(p=>clear(nav,p)))return null;
  a.climb={route:target,index:0,stage:'approach',clock:0};a.pursuit=true;a.lastKnown=[s.x,s.z];resetNav(a);
 }
 const c=a.climb,r=c.route,active=target?.zone===r.zone;
 a.aggression=Math.min(1,(a.aggression??0)+dt*2.8);a.phase+=dt*(c.stage==='approach'?4:2.7);a.speed=c.stage==='approach'?2.8:1.15;a.timer=0;
 if(c.stage==='approach'){
  if(!active){a.climb=null;a.surfaceY=0;a.state='search';resetNav(a);return null;}
  a.state='climbApproach';const p=r.nodes[0],here=[a.x,a.z];
  if(Math.hypot(a.x-p[0],a.z-p[2])<.14){c.stage='up';c.index=1;resetNav(a);}
  else if(!recover(a,nav,BODY,[p[0],p[2]],dt)){
   const aim=navigate(a,[p[0],p[2]],nav,BODY,dt,32),before=[a.x,a.z];
   if(aim)toward(a,[aim[0],0,aim[1]],dt,2.8,nav,0);
   a.stuck=Math.hypot(a.x-before[0],a.z-before[1])<.001?(a.stuck??0)+dt:0;
  }
  return {handled:true};
 }
 if(c.stage==='up'||c.stage==='down'){
  a.state=c.stage==='up'?'climbUp':'climbDown';
  const p=r.nodes[c.index],status=moveStep(a,p,dt,nav);
  if(status==='blocked'){c.totalBlocked=(c.totalBlocked??0)+dt;if(c.totalBlocked>8){a.state='disappear';a.speed=0;a.climb=null;return {handled:true};}}else if(status==='done')c.totalBlocked=0;
  if(status==='done'){
   if(c.stage==='up'&&!active){c.stage='down';c.index=Math.max(0,c.index-1);}
   else if(c.stage==='up'&&c.index>=r.nodes.length-1){c.stage='top';c.clock=0;}
   else if(c.stage==='down'&&c.index<=0){a.climb=null;a.surfaceY=0;a.state='search';resetNav(a);return null;}
   else c.index+=c.stage==='up'?1:-1;
  }else if(status==='blocked'){c.blocked=(c.blocked??0)+dt;if(c.blocked>1.5){if(c.stage==='up'){c.stage='down';c.index=Math.max(0,c.index-1);}c.blocked=0;}}else c.blocked=0;
  return {handled:true};
 }
 // The creature remains on the real platform, follows at walking pace, and can
 // strike only after a short telegraph with line of sight and matching height.
 if(c.stage==='top'){
  a.state='climbTop';const y=a.surfaceY??r.top,edge=r.deck;
  if(!active||s.y<y-.35){
   const back=r.nodes.at(-1);if(toward(a,back,dt,1.25,nav,y)){c.stage='down';c.index=r.nodes.length-2;}return {handled:true};
  }
  const p=[clamp(s.x,edge[0]+BODY.r,edge[2]-BODY.r),y,clamp(s.z,edge[1]+BODY.r,edge[3]-BODY.r)];
  const near=distance<.88&&Math.abs(s.y-y)<.38,open=!blocks.some(b=>traceBox([a.x,y+.64,a.z],[s.x,s.y+.6,s.z],b)<.999);
  if(near&&open){a.speed=0;face(a,s,dt);a.state='climbWindup';c.clock+=dt;if(c.clock>.48)return {handled:true,hit:true};}
  else {c.clock=0;toward(a,p,dt,1.24,nav,y);}
  return {handled:true};
 }
 return null;
}
