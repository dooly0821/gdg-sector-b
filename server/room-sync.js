// Optimistic sync: one Redis round trip on a warm uncontended room.
// All simulation results remain private until the exact-state CAS commits.
// Lifecycle requests use the existing lease; the CAS respects that lease.
export function createSyncEngine({read,compare,operate,serialize,error,clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random}){
 const cache=new Map(),turns=new Map();
 function remember(key,raw){
  cache.delete(key);if(typeof raw!=='string'||!raw)return;
  cache.set(key,{raw,at:clock()});while(cache.size>64)cache.delete(cache.keys().next().value);
 }
 async function execute(key,ctx,body){
  const started=clock(),cached=cache.get(key);
  let raw=cached&&started-cached.at<5000?cached.raw:await read(ctx),fresh=!(cached&&started-cached.at<5000);
  for(let attempt=0;attempt<5;attempt++){
   if(!raw)throw error('방을 찾을 수 없습니다.',404);
   let room=JSON.parse(raw),result;
   try{room.shared.stateless=true;result=operate(room,body,Math.max(clock(),room.lastTick??0));}
   catch(e){
    if(fresh)throw e;
    raw=await read(ctx);fresh=true;continue;
   }
   const next=serialize(room);
   const response=await compare(ctx,raw,next);
   if(!Array.isArray(response))throw error('협동 저장 서버 처리 오류입니다.',503);
   const status=Number(response[0]);
   if(status===1){remember(key,next);return result;}
   if(status===3){remember(key,null);throw error('방을 찾을 수 없습니다.',404);}
   if(typeof response[1]==='string'&&response[1]){raw=response[1];remember(key,raw);fresh=true;}
   if(clock()-started>=320||attempt===4)break;
   if(status===0)await sleep(12+Math.floor(random()*18)+attempt*10);
   else if(status===2)await sleep(2+Math.floor(random()*8));
   else throw error('협동 저장 서버 처리 오류입니다.',503);
  }
  throw error('방 상태 동기화 중입니다. 다시 시도하세요.',423);
 }
 async function sync(key,ctx,body){
  const old=turns.get(key);
  if((old?.count??0)>=8)throw error('방 상태 동기화 중입니다.',423);
  const turn=old??{tail:Promise.resolve(),count:0};
  turns.set(key,turn);turn.count++;
  const waiting=clock(),prior=turn.tail;
  let finish;turn.tail=new Promise(r=>{finish=r;});
  try{await prior;if(clock()-waiting>700)throw error('방 상태 동기화 중입니다.',423);return await execute(key,ctx,body);}
  finally{finish();turn.count--;if(!turn.count&&turns.get(key)===turn)turns.delete(key);}
 }
 return {sync,remember};
}
