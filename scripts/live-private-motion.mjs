import assert from 'node:assert/strict';
import {CoopClient,applyCoopSnapshot,advanceCoopPrediction} from '../dist/multiplayer.js';
import {createScene,newShift,step,parcelBlocks,pickupTargetByIndex,canUse} from '../dist/mission.js';
import {lockerDoorBlocks,lockerTarget} from '../dist/lockers.js';
import {powerTarget} from '../dist/facility-actions.js';
const origin='https://gdg-sector-b.vercel.app',native=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms));
globalThis.fetch=(u,o)=>native(new URL(u,origin),o);
for(let i=0;i<30;i++){const r=await fetch('/?qa='+i,{cache:'no-store'});if((await r.text()).includes('app.js?v=20261127-coop-motion'))break;if(i===29)throw Error('New production release not visible');await sleep(1500);}
const [world]=createScene('easy'),bots=[],dt=1/60;
const wait=async(fn,ms=15000)=>{const t=performance.now();while(!fn()){if(performance.now()-t>ms)throw Error('Timed out waiting for room state');await sleep(80);}};
const aim=(s,t)=>{const [x,y,z]=t.pos,dx=x-s.x,dz=z-s.z;s.yaw=Math.atan2(-dx,-dz);s.pitch=Math.max(-1.3,Math.min(1.3,Math.atan2(y+.24-s.y-(s.bodyHeight??1.7)+.12,Math.hypot(dx,dz))));};
const blocks=s=>world.blocks.concat(lockerDoorBlocks(s));
function targetPlan(s,excluded){
 const candidates=s.cargo.map((c,i)=>({i,d:Math.hypot(c.pos[0]-s.x,c.pos[2]-s.z)})).filter(c=>!excluded.has(c.i)&&s.states[c.i]==='AVAILABLE'&&c.d<17).sort((a,b)=>a.d-b.d);
 let best=null;
 for(const {i} of candidates.slice(0,18)){
  const q=structuredClone(s);let ok=false;
  for(let j=0;j<220;j++){
   const t=pickupTargetByIndex(q,i);if(!t)break;aim(q,t);
   if(canUse(q,t,blocks(q))&&!lockerTarget(q,world.blocks)&&!powerTarget(q,blocks(q))){if(!best||j<best.steps)best={i,steps:j};ok=true;break;}
   step(q,new Set(['KeyW']),world.blocks,dt);
  }
 }
 return best;
}
try{
 for(let i=0;i<2;i++){
  const s=newShift(),input={keys:[],yaw:0,pitch:0},m={acks:[],rtt:[],gap:[],error:[],back:[],errors:[],ticks:0};let first=true,last=0;
  const c=new CoopClient(snap=>{if(snap.phase!=='playing')return;m.rtt.push(snap.netRtt);if(last)m.gap.push(snap.netReceived-last);last=snap.netReceived;
   if(snap.netMotionPose){m.acks.push(snap.motionAck);m.error.push(Math.hypot(snap.self.x-snap.netMotionPose.x,snap.self.z-snap.netMotionPose.z));}
   applyCoopSnapshot(s,snap,first);first=false;},e=>m.errors.push(e.message),()=>input);c.enableMotion=true;
  bots.push({c,s,input,m,plan:null,used:false});
  await c.connect(i?'join':'create',i?bots[0].c.room:null,'QAMotion'+(i+1));
 }
 const code=bots[0].c.room;assert(!['GDGS22','GDGS23','GDGS24'].includes(code),'private test only');
 await wait(()=>bots.every(b=>b.c.snapshot?.players?.length===2));
 assert(bots.every(b=>b.c.snapshot.players.every(p=>/^QAMotion[12]$/.test(p.name))));
 await bots[0].c.action('start',{level:'easy'});await wait(()=>bots.every(b=>['loading','playing'].includes(b.c.snapshot?.phase)));
 await Promise.all(bots.map(b=>b.c.action('ready')));await wait(()=>bots.every(b=>b.c.snapshot?.phase==='playing'));
 assert(bots.every(b=>b.c.usesMotion()),'production movement protocol');
 const chosen=new Set();for(const b of bots){b.plan=targetPlan(b.s,chosen);assert(b.plan,'No reachable nearby cargo in random fixture');chosen.add(b.plan.i);}
 console.log('PRIVATE_PLAN',JSON.stringify(bots.map(b=>({target:b.s.cargo[b.plan.i].id,walkTicks:b.plan.steps}))));
 const start=performance.now();let last=start,acc=0;
 while(performance.now()-start<14000&&!bots.every(b=>b.s.carried===b.plan.i)){
  await sleep(8);const now=performance.now();acc+=Math.min(.067,(now-last)/1000);last=now;const n=Math.floor(acc*60);acc-=n*dt;
  for(const b of bots){const {c,s,input,m}=b;if(s.failed)throw Error('QA worker captured');if(!c.canRecordMotion())continue;
   for(let j=0;j<n&&c.canRecordMotion();j++){
    let keys=new Set();const t=pickupTargetByIndex(s,b.plan.i);
    if(!b.used&&t){aim(s,t);input.yaw=s.yaw;input.pitch=s.pitch;if(canUse(s,t,blocks(s))){c.command('use',{cargoIndex:t.index,yaw:s.yaw,pitch:s.pitch});b.used=true;}else keys=new Set(['KeyW']);}
    const k=[...keys];if(input.keys.join()!=k.join()){input.keys=k;c.inputChanged();}
    step(s,keys,world.blocks,dt);c.recordMotion(s,keys,false,false,now);m.ticks++;
   }
   const x=s.x,z=s.z,v=Math.hypot(s.vx,s.vz);advanceCoopPrediction(s,world.blocks,parcelBlocks(s).concat(lockerDoorBlocks(s)),Math.min(.067,n*dt),now);
   if(v>.5)m.back.push(Math.max(0,-((s.x-x)*s.vx+(s.z-z)*s.vz)/v));
  }
 }
 const stats=a=>{const v=a.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{n:v.length,p50:+v[Math.floor((v.length-1)*.5)].toFixed(3),p95:+v[Math.floor((v.length-1)*.95)].toFixed(3),max:+v.at(-1).toFixed(3)}:null;};
 const results=bots.map(({c,s,m,plan,used})=>({target:s.cargo[plan.i].id,picked:s.carried===plan.i,used,ack:c.snapshot.motionAck,ticks:m.ticks,positionErrorM:stats(m.error),backwardCorrectionM:stats(m.back),rttMs:stats(m.rtt),snapshotGapMs:stats(m.gap),hardSnaps:s.netHardCorrections??0,errors:m.errors,phase:c.snapshot.phase}));
 console.log('PRIVATE_LIVE_RESULT',JSON.stringify(results));
 assert(results.every(r=>r.picked&&r.ack>0&&r.hardSnaps===0),'Both workers must pick cargo over production API');
}finally{for(const b of bots){try{console.log('PRIVATE_CLEANUP',await b.c.leave());}catch(e){console.log('PRIVATE_CLEANUP_ERROR',e.message);}}}
