import {basis} from './world.js';
export class CoopClient{
 constructor(onState,onError,input){this.onState=onState;this.onError=onError;this.input=input;this.room=null;this.token=null;this.snapshot=null;this.seq=0;this.queue=[];this.running=false;this.busy=false;this.peers=new Map();}
 async request(op,extra={}){
  const res=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({op,room:this.room,token:this.token,...extra}),signal:AbortSignal.timeout(10000)});
  let data;try{data=await res.json();}catch{throw Error('협동 서버에 연결할 수 없습니다.');}
  if(!res.ok){const e=new Error(data.error||'서버 연결 오류');e.status=res.status;throw e;}return data;
 }
 accept(data){
  if(data.token)this.token=data.token;
  if(!data.snapshot)return;
  this.snapshot=data.snapshot;this.room=data.snapshot.room;
  this.queue=this.queue.filter(q=>q.seq>data.snapshot.ack);
  this.onState?.(data.snapshot);
 }
 async connect(op,room=null){
  if(this.running)return;
  this.room=room;this.seq=0;this.queue=[];this.peers.clear();
  this.accept(await this.request(op));this.running=true;this.poll();
 }
 async action(op){
  if(!this.running)return;
  // Serialize start/ready with an in-flight sync rather than racing server state.
  if(this.busy){this.pendingAction=op;return;}
  this.busy=true;try{const data=await this.request(op);if(this.running)this.accept(data);}catch(e){if(e.status===423)this.pendingAction=op;else this.onError?.(e);}finally{this.busy=false;}
 }
 command(type){if(this.running&&this.snapshot?.phase==='playing'&&this.queue.length<64)this.queue.push({seq:++this.seq,type});}
 poll(){
  if(!this.running)return;
  const run=async()=>{
   if(!this.running)return;
   if(!this.busy){
    this.busy=true;
    const pending=this.pendingAction;this.pendingAction=null;
    try{
     const input=this.input?.()??{keys:[],yaw:0,pitch:0};
     const data=await this.request(pending||'sync',pending?{}:{input,commands:this.queue.slice(0,16)});
     if(this.running){this.accept(data);this.failures=0;}
    }catch(e){
     if(this.running&&e.status!==423){this.failures=(this.failures??0)+1;if(this.failures>=3||e.status===401||e.status===404)this.onError?.(e);if(e.status===401||e.status===404){this.running=false;return;}}
     else if(this.running&&pending)this.pendingAction=pending;
    }finally{this.busy=false;}
   }
   if(this.running)this.timer=setTimeout(run,this.snapshot?.phase==='playing'?150:850);
  };this.timer=setTimeout(run,100);
 }
 async leave(){const room=this.room,token=this.token;this.running=false;clearTimeout(this.timer);this.room=this.token=null;this.snapshot=null;this.pendingAction=null;this.peers.clear();try{if(room&&token)await this.request('leave',{room,token});}catch{}}
}
export function peerLayers(client,s,dt,group){
 if(!client?.snapshot)return [];
 const layers=[],seen=new Set();
 for(const p of client.snapshot.players){
  if(p.id===client.snapshot.you||p.failed||p.hidden)continue;
  if(Math.hypot(p.x-s.x,p.z-s.z)>35)continue;
  seen.add(p.id);let old=client.peers.get(p.id);
  if(!old||Math.hypot(old.x-p.x,old.z-p.z)>4){old={...p};client.peers.set(p.id,old);}
  const alpha=1-Math.exp(-dt*13);for(const k of ['x','y','z','bodyHeight','steps'])old[k]+=(p[k]-old[k])*alpha;
  old.yaw+=Math.atan2(Math.sin(p.yaw-old.yaw),Math.cos(p.yaw-old.yaw))*alpha;
  const speed=Math.hypot(p.vx??0,p.vz??0),bob=Math.sin(old.steps*10)*Math.min(.035,speed*.008),sy=Math.max(.61,Math.min(1,old.bodyHeight/1.7));
  const axes=basis(Math.sin(old.steps*5)*Math.min(.06,speed*.01),Math.PI+old.yaw,0);
  const matrix=new Float32Array([...axes.flatMap((a,i)=>[...a.map(v=>v*(i===1?sy:1)),0]),old.x,old.y+bob,old.z,1]);
  layers.push({group,matrix,root:[old.x,old.y+1,old.z]});
  // The same shared parcel batch is rendered in the teammate's hands.
  if(p.carried>=0){const x=old.x-Math.sin(old.yaw)*.42,z=old.z-Math.cos(old.yaw)*.42,m=new Float32Array([...basis(0,Math.PI+old.yaw,0).flatMap(a=>[...a,0]),x,old.y+.90*sy,z,1]);layers.push({group:1,matrix:m,root:[x,old.y+1,z],prop:true});}
 }
 for(const id of client.peers.keys())if(!seen.has(id))client.peers.delete(id);
 return layers;
}
export function applyCoopSnapshot(s,snap,first=false){
 if(!s||!snap)return;
 const v=snap.self,oldHidden=s.coopHidden;
 const me=snap.players.find(p=>p.id===snap.you);
 const hidden=!!me?.hidden;
 // Locally predict normal walking. Correct larger differences and all
 // transitions (climbing, hiding, death) using the authoritative snapshot.
 const err=Math.hypot(s.x-v.x,s.z-v.z),vertical=Math.abs(s.y-v.y);
 const hard=first||err>1.15||vertical>.38||hidden!==oldHidden||v.failed;
 if(hard){for(const k of ['x','y','z','vx','vy','vz','grounded','bodyHeight','steps','vault'])s[k]=v[k]??(k==='vault'?null:s[k]);}
 else {s.x+=(v.x-s.x)*.15;s.z+=(v.z-s.z)*.15;s.y+=(v.y-s.y)*.15;}
 if(first){s.yaw=v.yaw;s.pitch=v.pitch;}else if(hidden&&!oldHidden){s.yaw=0;s.pitch=0;}
 for(const k of ['cargo','states','parked','deliveryOrder','lockers','lockerRevision','elapsed'])s[k]=snap[k];
 for(const k of ['carried','flashlight','handAction','failed','capturedBy','noise','horrorEvent'])s[k]=v[k]??(k==='carried'?-1:k==='flashlight'||k==='failed'?false:null);
 if(first)s.flashAmount=v.flashAmount??0;
 s.skipLockerAdvance=true;s.coopHidden=hidden;
 // Keep rendered ghosts continuous between authoritative network snapshots.
 s.haunt=snap.haunt.map(a=>{const old=s.haunt?.find(p=>p.kind===a.kind);if(!old||Math.hypot(old.x-a.x,old.z-a.z)>5)return {...a};return {...a,x:old.x,z:old.z,surfaceY:old.surfaceY??0,netTarget:[a.x,a.surfaceY??0,a.z],netYaw:a.yaw,yaw:old.yaw};});
}
export function interpolateCoopHaunt(s,dt){for(const a of s.haunt??[]){if(!a.netTarget)continue;const t=1-Math.exp(-dt*14);a.x+=(a.netTarget[0]-a.x)*t;a.surfaceY+= (a.netTarget[1]-a.surfaceY)*t;a.z+=(a.netTarget[2]-a.z)*t;a.yaw+=Math.atan2(Math.sin(a.netYaw-a.yaw),Math.cos(a.netYaw-a.yaw))*t;}}
