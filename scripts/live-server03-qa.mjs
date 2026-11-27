import {performance} from 'node:perf_hooks';
import {CoopClient,applyCoopSnapshot,advanceCoopPrediction,peerLayers} from '../dist/multiplayer.js';
import {createScene,newShift,step,parcelBlocks} from '../dist/mission.js';
import {lockerDoorBlocks} from '../dist/lockers.js';
const origin='https://gdg-sector-b.vercel.app',room='GDGS24',sleep=ms=>new Promise(r=>setTimeout(r,ms)),native=globalThis.fetch;
globalThis.fetch=(u,o)=>native(new URL(u,origin),o);
const stats=a=>{let v=a.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?{n:v.length,p50:+v[Math.floor((v.length-1)*.5)].toFixed(2),p95:+v[Math.floor((v.length-1)*.95)].toFixed(2),max:+v.at(-1).toFixed(2)}:null;};
const [world]=createScene('normal');
const status=async()=>(await new CoopClient().request('list')).servers.find(s=>s.id===room);
const health=await fetch('/api/room').then(r=>r.json());console.log('LIVE_HEALTH',JSON.stringify(health));
for(let i=0;i<16&&(await status())?.count!==0;i++)await sleep(2500);
for(const count of [4]){
 const before=await status();console.log('SERVER03_BEFORE',JSON.stringify(before));if(before?.count!==0){console.log('SKIP_OCCUPIED');break;}
 const bots=[],names=Array.from({length:count},(_,i)=>'QA'+count+'BOT'+(i+1));
 try{
  for(let i=0;i<count;i++){
   const m={rtt:[],gap:[],lag:[],correction:[],reverse:[],peerStep:[],speed:[],errors:[],snap:0,steps:0,maxDrift:0},s=newShift(),input={keys:[],yaw:0,pitch:0};let first=true,last=0;
   const c=new CoopClient(snap=>{if(snap.phase==='playing'){m.rtt.push(snap.netRtt);m.lag.push(snap.simLagMs);if(last)m.gap.push(snap.netReceived-last);last=snap.netReceived;applyCoopSnapshot(s,snap,first);first=false;m.maxDrift=Math.max(m.maxDrift,Math.hypot(s.x-snap.self.x,s.z-snap.self.z));m.snap=s.netHardCorrections??0;}},e=>m.errors.push(e.message),()=>input);
   const orig=c.request.bind(c);c.request=async(...a)=>{try{return await orig(...a)}catch(e){m.errors.push(e.status??e.message);throw e}};
   bots.push({c,s,input,m,prevPeers:new Map()});await c.connect('enter',room,names[i]);
  }
  await sleep(1000);if(bots.some(b=>b.c.snapshot.players.some(p=>!names.includes(p.name)))||bots[0].c.snapshot.host!==bots[0].c.snapshot.you)throw Error('Non-QA player or host in room; abort');
  await bots[0].c.action('start',{level:'easy'});for(let i=0;i<100&&!bots.every(b=>b.c.snapshot.phase==='loading'||b.c.snapshot.phase==='playing');i++)await sleep(100);
  await Promise.all(bots.map(b=>b.c.action('ready')));for(let i=0;i<100&&!bots.every(b=>b.c.snapshot.phase==='playing');i++)await sleep(100);
  if(!bots.every(b=>b.c.snapshot.phase==='playing'))throw Error('not playing');
  const start=performance.now();let last=start,acc=0,frame=0;
  while(performance.now()-start<10000&&bots.every(b=>b.c.snapshot?.phase==='playing')){
   await sleep(16);const now=performance.now(),t=(now-start)/1000,dt=Math.min(.067,(now-last)/1000);last=now;acc+=dt;frame++;
   for(const [i,b] of bots.entries()){
    const {s,input,c,m}=b;const phase=Math.floor((t+i*.23)/1.5)%4,keys=[['KeyW','ShiftLeft'],['KeyD','ShiftLeft'],['KeyS','ShiftLeft'],['KeyA','ShiftLeft']][phase];
    if(input.keys.join()!=keys.join()){input.keys=keys;c.inputChanged();}s.yaw=input.yaw=0;
    if(frame%100===25+i*3){s.slideRequested=true;c.command('slide');}
    if(frame%100===60+i*3){b.jump=true;c.command('jump');}
    if(s.failed)continue;
    for(let j=0;j<Math.floor(acc*60);j++){step(s,new Set(keys),world.blocks,1/60,!!b.jump);b.jump=false;}
    const x=s.x,z=s.z,velocity=Math.hypot(s.vx,s.vz),dynamic=parcelBlocks(s).concat(lockerDoorBlocks(s));
    advanceCoopPrediction(s,world.blocks,dynamic,dt,now);const dx=s.x-x,dz=s.z-z;m.correction.push(Math.hypot(dx,dz));if(velocity>.5)m.reverse.push(Math.max(0,-(dx*s.vx+dz*s.vz)/velocity));m.speed.push(velocity);m.steps++;
    for(const p of peerLayers(c,s,dt,11)){if(p.prop)continue;const id=p.skin?.name+':'+p.root.join(',');} 
   }
   acc-=Math.floor(acc*60)/60;
  }
  console.log('LIVE_RESULT',JSON.stringify({count,phase:bots[0].c.snapshot.phase,bots:bots.map(({m,c})=>({rttMs:stats(m.rtt),gapMs:stats(m.gap),simLagMs:stats(m.lag),correctionM:stats(m.correction),reverseM:stats(m.reverse),speed:stats(m.speed),hardSnaps:m.snap,maxRawPoseGap:+m.maxDrift.toFixed(2),errors:m.errors,steps:m.steps,phase:c.snapshot.phase}))}));
 }finally{for(const b of bots)await b.c.leave();await sleep(800);console.log('SERVER03_AFTER',JSON.stringify(await status()));}
}
