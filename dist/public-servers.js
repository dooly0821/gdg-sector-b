// Fixed public server identities. No invite code is needed.
export const PUBLIC_SERVERS=Object.freeze([
 {id:'GDGS22',name:'서버 01'},
 {id:'GDGS23',name:'서버 02'},
 {id:'GDGS24',name:'서버 03'}
].map(Object.freeze));
export const publicServer=id=>PUBLIC_SERVERS.find(s=>s.id===id)??null;
export const serverName=id=>publicServer(id)?.name??'협동 근무';
export const roomConnectionTimeout=phase=>phase==='loading'?180000:phase==='playing'?90000:35000;
export function publicStatus(id,room,now=Date.now()){
 const server=publicServer(id);if(!server)return null;
 const timeout=roomConnectionTimeout(room?.phase);
 const count=room?.phase==='closed'?0:Object.values(room?.players??{}).filter(p=>now-p.lastSeen<=timeout).length;
 const phase=count?room.phase:'empty';
 return {id:server.id,name:server.name,count,max:4,phase,joinable:phase==='empty'||phase==='lobby'&&count<4};
}
