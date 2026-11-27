import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRoom,operateRoom,serializeRoom} from '../server/room-core.js';
import {requestTeamChat} from '../server/team-chat.js';
const container=process.env.REDIS_CONTAINER,run=(...args)=>execFileSync('docker',['exec',container,'redis-cli','--json',...args.map(String)],{encoding:'utf8',maxBuffer:4*1024*1024});
const redis=async cmd=>JSON.parse(run(...cmd)),key=code=>'test:room:'+code,error=(m,status)=>Object.assign(Error(m),{status});
let now=1795757883000;const {room,player}=createRoom('CHAT23',now,'작업자A'),tokens=[player.token];for(let i=1;i<4;i++)tokens.push(operateRoom(room,{op:'join',nickname:'작업자'+i},now).token);
operateRoom(room,{op:'start',token:tokens[0]},now);for(const token of tokens)operateRoom(room,{op:'ready',token},now);
const original=serializeRoom(room);await redis(['SET',key(room.code),original]);
const chat=(i,op,extra={})=>requestTeamChat({op,room:room.code,token:tokens[i],...extra},{redis,key,error,now});
const id='message-id-123456';let r=await chat(0,'send',{text:'택배 <script> 집었어',id});assert.equal(r.ack,id);assert.equal(r.messages[0].name,'작업자A');assert.equal(r.messages[0].text,'택배 <script> 집었어');
assert.equal((await chat(0,'send',{text:'택배 <script> 집었어',id})).messages.length,1);
await assert.rejects(chat(0,'send',{text:'도배',id:'another-message-123'}),e=>e.status===429);
await assert.rejects(requestTeamChat({op:'read',room:room.code,token:'x'.repeat(48)},{redis,key,error,now}),e=>e.status===401);
for(let i=1;i<4;i++)assert.equal((await chat(i,'read')).messages[0].text,'택배 <script> 집었어');
for(let round=0;round<8;round++){now+=1250;await Promise.all(tokens.map((_,i)=>chat(i,'send',{text:'팀'+i+' '+round,id:'round-message-'+round+'-'+i+'-123'})));}
r=await chat(2,'read');assert.equal(r.messages.length,30);assert.equal(new Set(r.messages.map(m=>m.seq)).size,30);assert.equal((await chat(2,'read',{after:r.messages.at(-1).seq})).messages.length,0);
assert.equal(await redis(['GET',key(room.code)]),original,'chat never mutates game room JSON');
const newRoom=createRoom(room.code,now,'신규작업자').room;newRoom.phase='playing';const newP=Object.values(newRoom.players)[0];await redis(['SET',key(room.code),serializeRoom(newRoom)]);
const clean=await requestTeamChat({op:'read',room:room.code,token:newP.token},{redis,key,error,now});assert.equal(clean.messages.length,0);await assert.rejects(chat(0,'read'),e=>e.status===401);
console.log('PASS real Redis: four-player isolated chat, authorization, duplicate sends, rate limit, 30-message bound, fresh-room isolation, byte-identical game state');

// All public storage key versions, player counts, room phases and access scopes
// run only against the disposable Redis service, never public production rooms.
const {roomStorageKey}=await import('../server/room-service.js');
const {PUBLIC_SERVERS}=await import('../dist/public-servers.js');
const {createSyncEngine}=await import('../server/room-sync.js');
for(const count of [2,3,4]){
 const fixtures=[];
 for(const {id:code} of PUBLIC_SERVERS){
  let t=1795758000000;const {room,player}=createRoom(code,t,'QA'+code+'0');const tokens=[player.token];
  for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join',nickname:'QA'+code+i},t).token);
  const k=roomStorageKey(code),ctx={redis,key:roomStorageKey,error,now:t};await redis(['DEL',k,k+':team-chat']);await redis(['SET',k,serializeRoom(room)]);
  const request=(token,op,extra={},at=t)=>requestTeamChat({op,room:code,token,...extra},{...ctx,now:at});
  await assert.rejects(request(tokens[0],'read'),e=>e.status===409);
  operateRoom(room,{op:'start',token:tokens[0],level:'normal'},t);await redis(['SET',k,serializeRoom(room)]);await assert.rejects(request(tokens[0],'read'),e=>e.status===409);
  for(const token of tokens)operateRoom(room,{op:'ready',token},t);room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];await redis(['SET',k,serializeRoom(room)]);
  const engine=createSyncEngine({read:()=>redis(['GET',k]),compare:async(_,before,next)=>redis(['EVAL',"local cur=redis.call('GET',KEYS[1]);if cur~=ARGV[1] then return {2,cur} end;redis.call('SET',KEYS[1],ARGV[2]);return {1}",1,k,before,next]),operate:operateRoom,serialize:serializeRoom,error,clock:()=>t,sleep:async()=>{},random:()=>.5});
  fixtures.push({code,k,room,tokens,request,engine,advance:ms=>t+=ms});
 }
 for(let i=0;i<fixtures.length;i++){const a=fixtures[i],b=fixtures[(i+1)%fixtures.length];await assert.rejects(a.request(b.tokens[0],'read'),e=>e.status===401);}
 for(let round=0;round<5;round++){
  await Promise.all(fixtures.map(async a=>{
   const t=a.advance(1250);
   const sync=a.tokens.map(token=>a.engine.sync(a.k,{}, {op:'sync',token,inputSeq:round+1,input:{keys:[],yaw:0,pitch:0},commands:[]}));
   const sends=a.tokens.map((token,i)=>a.request(token,'send',{text:a.code+' '+round+' '+i,id:'matrix-'+a.code+'-'+round+'-'+i+'-123'},t));
   const results=await Promise.all([...sync,...sends]);assert(results.slice(0,count).every(r=>r.snapshot.inputAck===round+1&&r.snapshot.phase==='playing'&&r.snapshot.players.length===count));
   assert(results.slice(count).every(r=>r.ack));
  }));
 }
 for(const a of fixtures){
  const t=a.advance(10),before=await redis(['GET',a.k]);
  for(const token of a.tokens){const r=await a.request(token,'read',{},t);assert.equal(r.messages.length,count*5);assert(r.messages.every(m=>m.text.startsWith(a.code)));assert.equal(new Set(r.messages.map(m=>m.seq)).size,count*5);}
  assert.equal(await redis(['GET',a.k]),before);
  await assert.rejects(a.request(a.tokens[0],'read',{},t+91000),e=>e.status===401);
  const leaving=JSON.parse(before);delete leaving.players[Object.keys(leaving.players)[0]];await redis(['SET',a.k,serializeRoom(leaving)]);await assert.rejects(a.request(a.tokens[0],'read',{},t),e=>e.status===401);
  leaving.phase='complete';await redis(['SET',a.k,serializeRoom(leaving)]);await assert.rejects(a.request(a.tokens[1],'read',{},t),e=>e.status===409);
  console.log('CHAT_MATRIX_OK',a.code,count,'sync+send, scope, lifecycle, expired/left membership');
 }
}
