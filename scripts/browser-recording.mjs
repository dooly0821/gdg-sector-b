// Capture real rendered canvas frames; captureStream's rate is an upper limit.
import {writeFile} from 'node:fs/promises';
export async function startRecording(page){
 await page.evaluate(()=>{
  const stream=document.querySelector('canvas').captureStream(60),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
  recorder.ondataavailable=e=>chunks.push(e.data);
  window.finishClip=()=>new Promise(resolve=>{
   recorder.onstop=async()=>{
    const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());
    let data='';for(const byte of bytes)data+=String.fromCharCode(byte);
    resolve(btoa(data));stream.getTracks().forEach(t=>t.stop());
   };
   recorder.stop();
  });
  recorder.start();
 });
}
export async function saveRecording(page,path){
 const data=await page.evaluate(()=>finishClip());
 await writeFile(path,Buffer.from(data,'base64'));
}
