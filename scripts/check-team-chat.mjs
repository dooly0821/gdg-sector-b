import assert from 'node:assert/strict';
import {normalizeChat,requestTeamChat} from '../server/team-chat.js';
import {TeamChatClient,chatCompositionKey} from '../dist/team-chat.js';
assert.equal(normalizeChat('  안녕\n 팀원  '),'안녕 팀원');assert.equal(normalizeChat('가'.repeat(101)),null);assert.equal(normalizeChat('🎁'.repeat(100)),'🎁'.repeat(100));assert.equal(normalizeChat('\u202e'),null);
let called=0;const auth={room:'CHAT23',token:'a'.repeat(48)},deps={redis:async cmd=>{called++;assert.equal(cmd[2],2);assert.equal(cmd[3],'room:CHAT23');assert.equal(cmd[4],'room:CHAT23:team-chat');return [200,'[]','test-message-id-123'];},key:c=>'room:'+c,error:(m,status)=>Object.assign(Error(m),{status}),now:10000};
await assert.rejects(requestTeamChat({...auth,op:'send',text:'x'.repeat(101),id:'test-message-id-123'},deps),e=>e.status===400);assert.equal(called,0);
assert.equal((await requestTeamChat({...auth,op:'send',text:'안녕하세요',id:'test-message-id-123'},deps)).ack,'test-message-id-123');
const sent=[];const client=new TeamChatClient(()=>{},{fetcher:async(url,opt)=>{sent.push({url,body:JSON.parse(opt.body)});return {ok:true,json:async()=>({messages:[{seq:1,name:'A',text:'안녕',player:'me'}],ack:sent.at(-1).body.id})};},visible:()=>true});
client.start(auth.room,auth.token,'me');assert(await client.send('안녕'));assert.equal(sent[0].url,'/api/chat');assert.equal(client.cursor,1);client.ingest({messages:[{seq:1,name:'A',text:'안녕'}]});assert.equal(client.messages.length,1);client.stop();assert.equal(client.messages.length,0);
assert(chatCompositionKey({code:'Enter',isComposing:true},false,0,1000));assert(chatCompositionKey({code:'Enter'},false,100,150));assert(!chatCompositionKey({code:'Enter'},false,100,200));
console.log('PASS isolated chat API validation, Unicode, deduplication, channel teardown and IME guards');

// Network faults are isolated; one read is interrupted by an outgoing message.
const fault=new TeamChatClient(()=>{},{visible:()=>true,fetcher:async(url,opt)=>{
 const b=JSON.parse(opt.body);
 if(b.op==='read')return new Promise((_,reject)=>{opt.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true});});
 return {ok:true,json:async()=>({ack:b.id,messages:[{seq:2,name:'B',text:b.text,player:'me'},{seq:2,name:'B',text:b.text,player:'me'}]})};
}});
fault.start(auth.room,auth.token,'me');clearTimeout(fault.timer);const poll=fault.poll(fault.generation);
assert(fault.readController);assert(await fault.send('확인'));await poll;assert.equal(fault.messages.length,1);assert(!fault.readController);assert(!await fault.send('도배'));assert.equal(fault.status,'잠시 후 다시 보내세요.');fault.stop();
const disconnected=new TeamChatClient(()=>{},{visible:()=>true,fetcher:async()=>({ok:false,status:401,json:async()=>({error:'expired'})})});
disconnected.start(auth.room,auth.token,'me');clearTimeout(disconnected.timer);await disconnected.poll(disconnected.generation);assert(disconnected.disabled);assert(!await disconnected.send('재시도'));disconnected.stop();
let attempts=0;const failing=new TeamChatClient(()=>{},{visible:()=>true,fetcher:async()=>{attempts++;throw Error('network');}});
failing.start(auth.room,auth.token,'me');clearTimeout(failing.timer);await failing.poll(failing.generation);clearTimeout(failing.timer);await failing.poll(failing.generation);assert.equal(attempts,2);assert.equal(failing.readFailures,2);assert.equal(failing.status,'채팅 연결 복구 중');failing.stop();
console.log('PASS chat abort/read priority, local spam throttle, duplicate reply, expired auth, offline backoff and teardown');
