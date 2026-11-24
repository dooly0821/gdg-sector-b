// Spatial collision index and incremental, persistent A* for ground creatures.
const CELL=.5,BUCKET=4,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),key=(x,z)=>x+','+z;
const bounds=(x,z)=>x>-42.5&&x<14.35&&z>-21.1&&z<77.5&&(x>=-15||z>-8.65);
export function indexBlocks(blocks){
 const buckets=new Map();
 for(const block of blocks)for(let x=Math.floor(block[0]/BUCKET);x<=Math.floor(block[2]/BUCKET);x++)for(let z=Math.floor(block[1]/BUCKET);z<=Math.floor(block[3]/BUCKET);z++){
  const k=key(x,z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(block);
 }
 return buckets;
}
export function queryBlocks(index,x1,z1,x2,z2){
 const set=new Set();for(let x=Math.floor(x1/BUCKET);x<=Math.floor(x2/BUCKET);x++)for(let z=Math.floor(z1/BUCKET);z<=Math.floor(z2/BUCKET);z++)for(const b of index.get(key(x,z))??[])if(b[2]>=x1&&b[0]<=x2&&b[3]>=z1&&b[1]<=z2)set.add(b);
 return [...set];
}
function overlap(nav,x,z,r,y,h){
 let depth=0;
 for(const b of queryBlocks(nav,x-r,z-r,x+r,z+r)){
  if(y+.06>=b[5]||y+h<=b[4])continue;
  const d=Math.hypot(x-clamp(x,b[0],b[2]),z-clamp(z,b[1],b[3]));
  if(d<r)depth+=d>1e-6?r-d:r+Math.min(x-b[0],b[2]-x,z-b[1],b[3]-z);
 }
 return depth;
}
export function freeAt(nav,x,z,body,margin=0){return bounds(x,z)&&overlap(nav,x,z,body.r+margin,body.y,body.h)<1e-6;}
export function segmentFree(nav,a,b,body,margin=.015){
 const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(d/.22));
 for(let i=1;i<=n;i++)if(!freeAt(nav,a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,body,margin))return false;
 return true;
}
class Heap{
 constructor(){this.a=[];}
 push(v){const a=this.a;let i=a.length;a.push(v);while(i){let p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.a,head=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=v.f)break;a[i]=a[j];i=j;}a[i]=v;}return head;}
}
const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
function startJob(actor,target,nav,body){
 const x=Math.round(actor.x/CELL),z=Math.round(actor.z/CELL),heap=new Heap(),nodes=new Map(),open=new Map();
 const heuristic=(x,z)=>Math.hypot(x*CELL-target[0],z*CELL-target[1]);
 let best=null;
 // Start from any nearby reachable cell, not a rounded cell inside a rack post.
 for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
  const cx=x+a,cz=z+b,p=[cx*CELL,cz*CELL],g=Math.hypot(p[0]-actor.x,p[1]-actor.z);
  if(g>1.15||!freeAt(nav,...p,body,.025)||!segmentFree(nav,[actor.x,actor.z],p,body))continue;
  const k=key(cx,cz),h=heuristic(cx,cz),n={x:cx,z:cz,g,h,f:g+h*1.08,parent:null};nodes.set(k,n);heap.push(n);if(!best||h<best.h)best=n;
 }
 return {heap,nodes,open,best,target:target.slice(),nav,body,visited:0,done:false};
}
function advance(job,budget){
 const {heap,nodes,open,nav,body,target}=job;
 const walk=(x,z)=>{const k=key(x,z);if(!open.has(k))open.set(k,freeAt(nav,x*CELL,z*CELL,body,.025));return open.get(k);};
 for(let i=0;i<budget&&heap.a.length;i++){
  const n=heap.pop(),k=key(n.x,n.z);if(nodes.get(k)!==n)continue;
  job.visited++;if(!job.best||n.h<job.best.h)job.best=n;
  if(n.h<.64||job.visited>=10000){job.done=true;break;}
  for(const [dx,dz] of dirs){
   const x=n.x+dx,z=n.z+dz,k=key(x,z);if(!walk(x,z)||dx&&dz&&(!walk(n.x+dx,n.z)||!walk(n.x,n.z+dz)))continue;
   if(!segmentFree(nav,[n.x*CELL,n.z*CELL],[x*CELL,z*CELL],body,.025))continue;
   const g=n.g+CELL*Math.hypot(dx,dz);if(g>=(nodes.get(k)?.g??Infinity))continue;
   const h=Math.hypot(x*CELL-target[0],z*CELL-target[1]),v={x,z,g,h,f:g+h*1.08,parent:n};nodes.set(k,v);heap.push(v);
  }
 }
 if(!heap.a.length)job.done=true;
 if(!job.done)return null;
 const path=[];for(let n=job.best;n;n=n.parent)path.push([n.x*CELL,n.z*CELL]);return path.reverse();
}
export function navigate(actor,target,nav,body,dt,budget=48){
 const here=[actor.x,actor.z];
 actor.navDelay=Math.max(0,(actor.navDelay??0)-dt);
 if(actor.recoverPoint){
  if(Math.hypot(actor.x-actor.recoverPoint[0],actor.z-actor.recoverPoint[1])<.18||!segmentFree(nav,here,actor.recoverPoint,body,0))actor.recoverPoint=null;
  else return actor.recoverPoint;
 }
 // Direct movement is only allowed if the full body fits along the segment.
 // Avoid checking distant targets every tick; refresh at a fixed cadence.
 if(actor.navDelay===0){
  actor.navDelay=.14;
  const d=Math.hypot(target[0]-actor.x,target[1]-actor.z);
  actor.navDirect=d<=18&&segmentFree(nav,here,target,body);
  if(actor.navDirect){actor.navJob=null;actor.navPath=null;}
  else if(!actor.navJob&&(!actor.navPath?.length||!actor.navGoal||Math.hypot(target[0]-actor.navGoal[0],target[1]-actor.navGoal[1])>1.8||actor.stuck>.45)){
   actor.navJob=startJob(actor,target,nav,body);actor.navGoal=target.slice();
  }
 }
 if(actor.navDirect){const d=Math.hypot(target[0]-actor.x,target[1]-actor.z);const next=d>.65?here.map((v,i)=>v+(target[i]-v)*.65/d):target;if(segmentFree(nav,here,next,body))return target;actor.navDirect=false;actor.navDelay=0;}
 if(actor.navJob){
  if(actor.navJob.nav!==nav){actor.navJob=null;actor.navDelay=0;}
  else {const path=advance(actor.navJob,budget);if(path){actor.navPath=path;actor.navJob=null;actor.navDelay=.24;}}
 }
 if(actor.navPath?.length){
  while(actor.navPath.length&&Math.hypot(actor.x-actor.navPath[0][0],actor.z-actor.navPath[0][1])<.21)actor.navPath.shift();
  let best=-1;for(let i=0;i<Math.min(9,actor.navPath.length);i++)if(segmentFree(nav,here,actor.navPath[i],body))best=i;
  if(best>=0){actor.navPath.splice(0,best);return actor.navPath[0];}
  actor.navPath=null;actor.navDelay=0;
 }
 return null;
}
export function recover(actor,nav,body,target,dt){
 const here=[actor.x,actor.z],depth=overlap(nav,...here,body.r,body.y,body.h);
 // Resolve actual overlap in small collision-reducing steps, never teleport.
 if(depth>1e-6){
  let best=null,score=depth;for(let k=0;k<24;k++){
   const a=k*Math.PI/12,p=[here[0]+Math.sin(a)*Math.min(.09,dt*3),here[1]+Math.cos(a)*Math.min(.09,dt*3)];
   if(!bounds(...p))continue;const d=overlap(nav,...p,body.r,body.y,body.h);
   if(d<score-1e-7){best=p;score=d;}
  }
  if(best){actor.x=best[0];actor.z=best[1];actor.navDelay=0;return true;}
 }
 if(actor.stuck<.60||actor.recoverPoint)return false;
 // Backtrack or sidestep to regain clearance, including moving away from target.
 const choices=[];for(const r of [.75,1.25,1.75])for(let k=0;k<16;k++){
  const a=k*Math.PI/8,p=[here[0]+Math.sin(a)*r,here[1]+Math.cos(a)*r];
  if(segmentFree(nav,here,p,body,.04)){
   const progress=Math.hypot(p[0]-target[0],p[1]-target[1]);
   const visited=(actor.recent??[]).reduce((sum,q)=>sum+(Math.hypot(p[0]-q[0],p[1]-q[1])<.65?3:0),0);
   choices.push({p,score:progress*.18+visited-r*.35});
  }
 }
 choices.sort((a,b)=>a.score-b.score);
 if(choices.length){actor.recoverPoint=choices[0].p;actor.navJob=null;actor.navPath=null;actor.navDirect=false;actor.navDelay=0;actor.stuck=0;actor.recent=[...(actor.recent??[]).slice(-5),here];}
 else {actor.navJob=null;actor.navPath=null;actor.navDelay=0;actor.stuck=.25;}
 return false;
}
