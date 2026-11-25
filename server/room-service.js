import {randomBytes} from 'node:crypto';
import {createRoom,operateRoom,snapshot,roomCode,RoomError,serializeRoom,ROOM_TTL} from './room-core.js';
const rooms=new Map(),MAX_ROOMS=100;
const env=()=>({url:process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN});
async function redis(config,cmd){
 const res=await fetch(config.url.replace(/\/$/,''),{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(4000)});
 if(!res.ok)throw new RoomError('협동 저장 서버 연결에 실패했습니다.',503);
 const data=await res.json();if(data.error)throw new RoomError('협동 저장 서버 처리 오류입니다.',503);return data.result;
}
const key=code=>'gdg:coop:v1:'+code;
const release="if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
const commit="if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]); redis.call('DEL',KEYS[1]); return 1";
async function durable(config,body){
 const now=Date.now();
 if(body.op==='create'){
  for(let n=0;n<5;n++){
   const code=roomCode(),{room,player}=createRoom(code,now);
   if(await redis(config,['SET',key(code),serializeRoom(room),'NX','EX',ROOM_TTL]))return {token:player.token,snapshot:snapshot(room,player)};
  }throw new RoomError('방 생성에 실패했습니다.',503);
 }
 const code=String(body.room||'').toUpperCase();
 if(!/^[A-Z2-9]{6}$/.test(code))throw new RoomError('6자리 방 코드를 입력하세요.');
 const stateKey=key(code),lockKey=stateKey+':lock',token=randomBytes(16).toString('hex');
 if(!await redis(config,['SET',lockKey,token,'NX','PX',8000]))throw new RoomError('방 상태 동기화 중입니다. 다시 시도하세요.',423);
 try{
  const value=await redis(config,['GET',stateKey]);if(!value)throw new RoomError('방을 찾을 수 없습니다.',404);
  const room=JSON.parse(value);room.shared.stateless=true;const result=operateRoom(room,body,now);
  if(!await redis(config,['EVAL',commit,2,lockKey,stateKey,token,serializeRoom(room),ROOM_TTL]))throw new RoomError('방 상태 동기화 중입니다.',423);
  return result;
 }finally{try{await redis(config,['EVAL',release,1,lockKey,token]);}catch{}}
}
function memory(body){
 const now=Date.now();
 for(const [code,room] of rooms)if(now-room.updatedAt>ROOM_TTL*1000||room.phase==='closed')rooms.delete(code);
 if(body.op==='create'){
  if(rooms.size>=MAX_ROOMS)throw new RoomError('현재 서버의 방 수가 가득 찼습니다.',503);
  let code;do{code=roomCode();}while(rooms.has(code));
  const {room,player}=createRoom(code,now);rooms.set(code,room);return {token:player.token,snapshot:snapshot(room,player)};
 }
 const code=String(body.room||'').toUpperCase();return operateRoom(rooms.get(code),body,now);
}
export async function roomRequest(body,{allowMemory=false}={}){
 if(!body||typeof body!=='object'||Array.isArray(body)||!['create','join','sync','start','ready','leave','health'].includes(body.op))throw new RoomError('잘못된 요청입니다.');
 const config=env(),configured=!!(config.url&&config.token);
 if(body.op==='health')return {online:configured||allowMemory,storage:configured?'redis':allowMemory?'memory':'unconfigured'};
 if(!configured&&!allowMemory)throw new RoomError('협동 서버의 공유 저장소가 아직 연결되지 않았습니다. 싱글플레이는 정상 이용할 수 있습니다.',503);
 if(body.op!=='create'&&body.op!=='join'&&(typeof body.token!=='string'||body.token.length!==48))throw new RoomError('잘못된 입장 인증입니다.',401);
 return configured?durable(config,body):memory(body);
}
