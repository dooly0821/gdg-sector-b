// Optimistic sync: one Redis round trip on a warm uncontended room.
// All simulation results remain private until the exact-state CAS commits.
// Lifecycle requests use the existing lease; the CAS respects that lease.
export function createSyncEngine({read,compare,operate,serialize,error,clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random}){
 const cache=new Map(),turns=new Map();
 function remember(key,raw){
  cache.delete(key);if(typeof raw!=='string'||!raw)return;
  cache.set(key,{raw,at:clock()});while(cache.size>64)cache.delete(cache.keys().next().value);
 }
 async function execute(key,ctx,batch){
  const started=clock(),cached=cache.get(key);
  let raw=cached&&started-cached.at<5000?cached.raw:await read(ctx),fresh=!(cached&&started-cached.at<5000);
  for(let attempt=0;attempt<5;attempt++){
   if(!raw)throw error('방을 찾을 수 없습니다.',404);
   const room=JSON.parse(raw),results=[];
   let reread=false;
   room.shared.stateless=true;
   const tickAt=Math.max(clock(),room.lastTick??0);
   for(const item of batch){
    try{
     results.push({value:JSON.parse(JSON.stringify(operate(room,item.body,tickAt)))});
    }catch(e){
     if(!fresh&&(e.status===401||e.status===404)){reread=true;break;}
     if(e.status===401||e.status===404){results.push({error:e});continue;}
     throw e;
    }
   }
   if(reread){raw=await read(ctx);fresh=true;continue;}
   if(results.every(r=>r.error))return results;
   const next=serialize(room);
   const response=await compare(ctx,raw,next);
   if(!Array.isArray(response))throw error('협동 저장 서버 처리 오류입니다.',503);
   const status=Number(response[0]);
   if(status===1){remember(key,next);return results;}
   if(status===3){remember(key,null);throw error('방을 찾을 수 없습니다.',404);}
   if(typeof response[1]==='string'&&response[1]){raw=response[1];remember(key,raw);fresh=true;}
   if(clock()-started>=320||attempt===4)break;
   if(status===0)await sleep(12+Math.floor(random()*18)+attempt*10);
   else if(status===2)await sleep(2+Math.floor(random()*8));
   else throw error('협동 저장 서버 처리 오류입니다.',503);
  }
  throw error('방 상태 동기화 중입니다. 다시 시도하세요.',423);
 }
 async function drain(key,turn){
  if(turn.running)return;
  turn.running=true;
  try{
   while(turn.queue.length){
    const expired=turn.queue.filter(i=>clock()-i.waiting>700);
    for(const item of expired)item.reject(error('방 상태 동기화 중입니다.',423));
    turn.queue=turn.queue.filter(i=>!expired.includes(i));
    const batch=turn.queue.splice(0,4);if(!batch.length)continue;
    try{const results=await execute(key,batch[0].ctx,batch);
     batch.forEach((item,i)=>results[i].error?item.reject(results[i].error):item.resolve(results[i].value));
    }catch(e){for(const item of batch)item.reject(e);}
   }
  }finally{turn.running=false;if(!turn.queue.length&&turns.get(key)===turn)turns.delete(key);}
 }
 function sync(key,ctx,body){
  let turn=turns.get(key);
  if(!turn){turn={running:false,scheduled:false,queue:[]};turns.set(key,turn);}
  if(turn.queue.length>=8)return Promise.reject(error('방 상태 동기화 중입니다.',423));
  const result=new Promise((resolve,reject)=>turn.queue.push({ctx,body,waiting:clock(),resolve,reject}));
  // No artificial batching delay: combine already waiting inputs.
  if(!turn.running&&!turn.scheduled){turn.scheduled=true;Promise.resolve().then(()=>{turn.scheduled=false;return drain(key,turn);});}
  return result;
 }
 return {sync,remember};
}
