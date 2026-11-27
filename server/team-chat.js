// Separate Redis key and request path: never tick, lock or rewrite a game room.
export const CHAT_MAX=100,CHAT_LIMIT=30,CHAT_INTERVAL=1200,CHAT_TTL=1800;
export function normalizeChat(value){
 if(typeof value!=='string'||value.length>400)return null;
 const text=value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/gu,' ').trim();
 return text&&Array.from(text).length<=CHAT_MAX?text:null;
}
export const CHAT_LUA=`
local raw=redis.call('GET',KEYS[1])
if not raw then return {404,'방을 찾을 수 없습니다.'} end
local room=cjson.decode(raw)
local now=tonumber(ARGV[1])
local member=nil
for _,p in pairs(room.players or {}) do
 if p.token==ARGV[2] and now-tonumber(p.lastSeen or 0)<=90000 then member=p;break end
end
if not member then return {401,'채팅 참가 인증이 만료되었습니다.'} end
if room.phase~='playing' or not room.chatEpoch then return {409,'진행 중인 팀 근무에서만 채팅할 수 있습니다.'} end
local saved=redis.call('GET',KEYS[2])
local chat=saved and cjson.decode(saved) or {}
if chat.epoch~=room.chatEpoch then chat={epoch=room.chatEpoch,seq=0,messages={},last={}} end
local ack=''
if ARGV[3]=='send' then
 local last=chat.last[member.id]
 if last and last.id==ARGV[5] then ack=last.id
 else
  if last and now-last.at<tonumber(ARGV[7]) then return {429,'메시지를 너무 빠르게 보내고 있습니다.'} end
  chat.seq=math.max(chat.seq+1,now*1000)
  table.insert(chat.messages,{seq=chat.seq,player=member.id,name=member.name,text=ARGV[4],at=now})
  while #chat.messages>tonumber(ARGV[6]) do table.remove(chat.messages,1) end
  for id,_ in pairs(chat.last) do if not room.players[id] then chat.last[id]=nil end end
  chat.last[member.id]={id=ARGV[5],at=now}
  ack=ARGV[5]
  redis.call('SET',KEYS[2],cjson.encode(chat),'EX',tonumber(ARGV[8]))
 end
end
local result={}
for _,m in ipairs(chat.messages) do if m.seq>tonumber(ARGV[9]) then table.insert(result,m) end end
return {200,cjson.encode(result),ack}
`;
export async function requestTeamChat(body,{redis,key,now=Date.now(),error}){
 const fail=(m,s)=>{throw error(m,s)};
 if(!body||typeof body!=='object'||!['read','send'].includes(body.op))return fail('잘못된 채팅 요청입니다.',400);
 if(typeof body.room!=='string'||!/^[A-Z2-9]{6}$/.test(body.room)||typeof body.token!=='string'||body.token.length!==48)return fail('잘못된 참가 인증입니다.',401);
 const sending=body.op==='send',text=sending?normalizeChat(body.text):'';
 if(sending&&(!text||typeof body.id!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(body.id)))return fail('메시지는 1~100자로 입력하세요.',400);
 const cursor=Number.isSafeInteger(body.after)&&body.after>=0?body.after:0,roomKey=key(body.room);
 const out=await redis(['EVAL',CHAT_LUA,2,roomKey,roomKey+':team-chat',now,body.token,body.op,text,sending?body.id:'',CHAT_LIMIT,CHAT_INTERVAL,CHAT_TTL,cursor]);
 if(!Array.isArray(out)||!Number.isInteger(Number(out[0])))return fail('채팅 서버 응답 오류입니다.',503);
 const status=Number(out[0]);if(status!==200)return fail(String(out[1]??'채팅 오류'),status);
 const messages=JSON.parse(out[1]);return {messages:Array.isArray(messages)?messages:[],ack:out[2]||null};
}
