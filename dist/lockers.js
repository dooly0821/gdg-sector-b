import {World,basis,dot} from './world.js';
import {traceBox} from './contact.js';
export const LOCKERS=Object.freeze([[9,13],[-36,17],[10,39],[-37,40],[-39.5,65.5],[9,68]].map(([x,z],i)=>Object.freeze({x,z,id:i+1})));
const W=1.16,D=1.12,H=2.12,half=W/2,front=D/2,span=W-.09;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hinge=l=>[l.x-half+.045,l.z-front];
export function buildLockers(w){
 const shell=w.mat('locker-shell','#4a5152','metal'),dark=w.mat('locker-inner','#282e30','metal'),trim=w.mat('locker-edge','#696c66','metal');
 for(const {x,z,id} of LOCKERS){
  const solid=(x,y,z,a,b,c,m)=>{w.box(x,y,z,a,b,c,m);w.block(x-a/2,z-c/2,x+a/2,z+c/2,y-b/2,y+b/2,'locker-shell');};
  w.box(x,.018,z,W,.036,D,dark);solid(x,H-.045,z,W,.09,D,shell);
  solid(x,H/2,z+front-.035,W,H,.07,dark);
  for(const k of [-1,1]){solid(x+k*(half-.035),H/2,z,.07,H,D,shell);w.box(x+k*(half-.035),H/2,z-front-.015,.07,H,.065,trim);}
  w.sign(x,H-.12,z-front-.031,.72,.12,'GDG / LOCKER '+String(id).padStart(2,'0'),'#303638','#c8c4aa',Math.PI);
  w.shadow(x,z,W+.12,D+.12);
 }
}
export function buildLockerDoor(){
 const w=new World(),steel=w.mat('locker-door','#4b5354','metal'),edge=w.mat('locker-door-edge','#676c68','metal'),dark=w.mat('locker-grip','#282a29','metal'),rust=w.mat('locker-worn','#80674c','metal');
 const strip=(x0,x1,y0,y1)=>w.box((x0+x1)/2,(y0+y1)/2,0,x1-x0,y1-y0,.055,steel);
 strip(.055,span-.055,.09,1.33);strip(.055,span-.055,1.87,2.04);
 strip(.055,.16,1.33,1.87);strip(span-.16,span-.055,1.33,1.87);
 for(let i=0;i<6;i++)strip(.16,span-.16,1.33+i*.09,1.33+i*.09+.025);
 for(const x of [.025,span-.025])w.box(x,1.065,0,.05,1.95,.07,edge);
 for(const y of [.075,2.06])w.box(span/2,y,0,span,.045,.07,edge);
 for(const y of [.25,1.91])w.cyl(.015,y,0,.04,.15,.04,rust);
 w.box(span-.12,1.02,-.06,.07,.24,.055,dark);w.box(span-.12,1.02,.052,.055,.17,.05,dark);
 w.sign(span/2,1.94,-.031,.52,.10,'PERSONNEL','#343a3a','#ddd4bf',Math.PI);
 return w;
}
function state(s,l){return (s.lockers??={})[l.id]??={open:0,target:0};}
function door(l,open){
 const a=open*Math.PI*.5,[hx,hz]=hinge(l),dx=Math.cos(a),dz=-Math.sin(a),out=[],n=open<.0001||open>.9999?1:8;
 for(let i=0;i<n;i++){
  const t=i*span/n,u=(i+1)*span/n,x=hx+dx*t,z=hz+dz*t,xx=hx+dx*u,zz=hz+dz*u;
  out.push([Math.min(x,xx)-.035,Math.min(z,zz)-.035,Math.max(x,xx)+.035,Math.max(z,zz)+.035,.035,H-.04,'locker-door']);
 }
 return out;
}
const cache=new WeakMap();
export function lockerDoorBlocks(s){
 const rev=s.lockerRevision??0,old=cache.get(s);if(old?.rev===rev)return old.blocks;
 const blocks=LOCKERS.flatMap(l=>door(l,state(s,l).open));cache.set(s,{rev,blocks});return blocks;
}
export function lockerLayers(s,group){return LOCKERS.map(l=>{const [x,z]=hinge(l),a=state(s,l).open*Math.PI*.5,m=new Float32Array([...basis(0,a,0).flatMap(v=>[...v,0]),x,0,z,1]);return {group,matrix:m,root:[l.x,1,l.z],prop:true};});}
export function insideLocker(s,l){return Math.abs(s.x-l.x)<.28&&s.z>l.z-.22&&s.z<l.z+.23&&s.y>=-.02&&s.y<.26;}
export function closedLocker(s){return LOCKERS.find(l=>insideLocker(s,l)&&state(s,l).open<.025&&state(s,l).target===0)??null;}
export function lockerTarget(s,blocks=[]){
 if(s.failed||s.vault||s.handAction||s.pendingUse)return null;
 const inside=LOCKERS.find(l=>insideLocker(s,l));if(inside)return inside;
 if(Math.abs(s.y)>.4)return null;
 const eye=[s.x,s.y+(s.bodyHeight??1.7)-.12,s.z],f=[-Math.sin(s.yaw),0,-Math.cos(s.yaw)];
 return LOCKERS.filter(l=>{
  const dx=l.x-s.x,dz=l.z-front-s.z,d=Math.hypot(dx,dz);
  if(s.z>l.z-.27||d>1.85||d<.01||dot(f,[dx/d,0,dz/d])<.55)return false;
  return !blocks.some(b=>traceBox(eye,[l.x,1.25,l.z-front-.065],b)<.96);
 }).sort((a,b)=>Math.hypot(s.x-a.x,s.z-a.z)-Math.hypot(s.x-b.x,s.z-b.z))[0]??null;
}
const overlap=(s,b)=>s.y+.04<b[5]&&s.y+(s.bodyHeight??1.7)>b[4]&&Math.hypot(s.x-clamp(s.x,b[0],b[2]),s.z-clamp(s.z,b[1],b[3]))<.262;
export function useLocker(s,l){
 if(!l)return null;if(s.carried>=0)return 'hands-full';
 const st=state(s,l);if(Math.abs(st.open-st.target)>.03)return 'moving';
 const closing=st.target===1;
 if(closing&&!insideLocker(s,l))return 'enter-first';
 if(!closing&&!insideLocker(s,l)){
  // Reject a door swing blocked by the player; prompt them to step back.
  for(let k=1;k<=16;k++)if(door(l,k/16).some(b=>overlap(s,b)))return 'step-back';
 }
 s.vx=s.vz=0;s.jumpBuffer=0;
 st.target=closing?0:1;s.lockerRevision=(s.lockerRevision??0)+1;
 s.noise={x:l.x,y:.8,z:l.z,radius:2.1,time:s.elapsed};
 return closing?'closing':'opening';
}
export function advanceLockers(s,dt,occupants=[s]){
 for(const l of LOCKERS){
  const st=state(s,l);if(st.open===st.target)continue;
  const old=st.open,next=clamp(old+Math.sign(st.target-old)*dt/.48,0,1);
  if(door(l,next).some(b=>occupants.some(p=>overlap(p,b)))){if(st.target===0)st.target=1;continue;}
  st.open=next;if(Math.abs(old-next)>1e-7)s.lockerRevision=(s.lockerRevision??0)+1;
 }
}
export function lockerPrompt(s,l){
 if(!l)return '';const st=state(s,l);
 if(s.carried>=0)return '먼저 상자를 내려놓으세요.';
 if(Math.abs(st.target-st.open)>.03)return '문 이동 중 · 문에서 물러나세요';
 return st.target?(insideLocker(s,l)?'E · 사물함 문 닫기':'문 열림 · W로 진입 후 E로 닫기'):'E · 사물함 문 열기';
}
export function lockerEntry(l){return [l.x,l.z-front-.78];}
