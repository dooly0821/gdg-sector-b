import {roomChatRequest} from '../server/room-service.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.status(405).json({error:'POST 요청만 허용합니다.'});return;}
 try{const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});if(raw.length>1800){res.status(413).json({error:'채팅 요청이 너무 큽니다.'});return;}
  res.status(200).json(await roomChatRequest(JSON.parse(raw)));
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'팀 채팅 연결 오류입니다.'});}
}
