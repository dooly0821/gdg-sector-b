import {roomRequest} from '../server/room-service.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.status(405).json({error:'POST 요청만 허용합니다.'});return;}
 try{
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body??{});
  if(raw.length>12000){res.status(413).json({error:'요청이 너무 큽니다.'});return;}
  const result=await roomRequest(JSON.parse(raw));res.status(200).json(result);
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'협동 서버 오류입니다.'});}
}
