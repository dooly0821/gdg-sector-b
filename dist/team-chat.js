// Completely separate from CoopClient's movement, action queue and RTT statistics.
export class TeamChatClient{
 constructor(onChange,{fetcher=(...a)=>fetch(...a),visible=()=>!document.hidden,active=()=>true,delay=2500}={}){this.onChange=onChange;this.fetcher=fetcher;this.visible=visible;this.active=active;this.delay=delay;this.messages=[];this.cursor=0;this.generation=0;this.controllers=new Set();}
 start(room,token,you){
  if(this.room===room&&this.token===token)return;
  this.stop();this.room=room;this.token=token;this.you=you;this.status='';this.onChange?.(this,false);const g=this.generation;this.timer=setTimeout(()=>this.poll(g),400);
 }
 stop(){this.generation++;clearTimeout(this.timer);for(const c of this.controllers)c.abort();this.controllers.clear();this.readController=null;this.room=this.token=this.you=null;this.messages=[];this.cursor=0;this.status='';this.sending=false;this.retry=null;this.disabled=false;this.readFailures=0;this.lastSentAt=-Infinity;this.onChange?.(this,false);}
 async request(op,extra={},generation=this.generation){
  if(!this.room||generation!==this.generation||this.disabled)throw Error('팀 채팅이 종료되었습니다.');
  const controller=new AbortController();this.controllers.add(controller);if(op==='read')this.readController=controller;const timer=setTimeout(()=>controller.abort(),3200);
  try{const res=await this.fetcher('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({op,room:this.room,token:this.token,after:this.cursor,...extra})});
   const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'팀 채팅 오류'),{status:res.status});return data;
  }finally{clearTimeout(timer);this.controllers.delete(controller);if(this.readController===controller)this.readController=null;}
 }
 ingest(data){const bySeq=new Map();for(const m of Array.isArray(data.messages)?data.messages:[])if(Number.isSafeInteger(m.seq)&&m.seq>this.cursor&&typeof m.text==='string'&&typeof m.name==='string')bySeq.set(m.seq,m);
  const incoming=[...bySeq.values()].sort((a,b)=>a.seq-b.seq);
  if(incoming.length){this.messages=[...this.messages,...incoming].slice(-30);this.cursor=incoming.at(-1).seq;this.onChange?.(this,true);}
 }
 terminal(e){if(![401,404,409].includes(e?.status))return false;this.disabled=true;clearTimeout(this.timer);this.status='팀 채팅 연결 종료';return true;}
 async poll(g){
  if(g!==this.generation||!this.room||this.disabled)return;
  let wait=this.active()?this.delay:Math.max(this.delay,4000);
  if(this.visible()&&!this.sending&&!this.readController)try{const data=await this.request('read',{},g);if(g===this.generation&&!this.disabled){this.ingest(data);this.readFailures=0;if(this.status==='채팅 연결 복구 중'){this.status='';this.onChange?.(this,false);}}}
  catch(e){if(g===this.generation&&!this.disabled){if(this.sending&&e.name==='AbortError'){wait=this.delay;}else if(this.terminal(e)){this.onChange?.(this,false);}else{this.readFailures=(this.readFailures??0)+1;wait=Math.min(15000,2500*2**Math.min(3,this.readFailures));if(!this.sending&&!this.status.startsWith('전송 실패'))this.status='채팅 연결 복구 중';this.onChange?.(this,false);}}}
  if(g===this.generation&&this.room&&!this.disabled)this.timer=setTimeout(()=>this.poll(g),wait);
 }
 async send(text){
  text=String(text??'').trim();if(!this.room||this.disabled||this.sending||!text||Array.from(text).length>100)return false;
  if(performance.now()-this.lastSentAt<1200){this.status='잠시 후 다시 보내세요.';this.onChange?.(this,false);return false;}
  const g=this.generation,id=this.retry?.text===text?this.retry.id:crypto.randomUUID();this.retry={text,id};this.sending=true;this.status='전송 중';this.readController?.abort();this.onChange?.(this,false);
  try{const data=await this.request('send',{text,id},g);if(g!==this.generation)return false;if(data.ack!==id)throw Error('메시지 전송 확인 실패');this.retry=null;this.status='';this.lastSentAt=performance.now();this.ingest(data);return true;}
  catch(e){if(g===this.generation&&!this.terminal(e)){this.status=e.status===429?'잠시 후 다시 보내세요.':'전송 실패 · Enter로 재시도';if(e.status===429)this.lastSentAt=performance.now();}return false;}
  finally{if(g===this.generation){this.sending=false;this.onChange?.(this,false);}}
 }
}
export function chatCompositionKey(e,composing,endedAt,now=performance.now()){return composing||e.isComposing||e.keyCode===229||(e.code==='Enter'&&now-endedAt<85);}
