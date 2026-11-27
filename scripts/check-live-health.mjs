// Read-only production inspection; never join or reset public rooms.
import assert from 'node:assert/strict';
const origin='https://gdg-sector-b.vercel.app',start=performance.now();
const res=await fetch(origin+'/api/room',{cache:'no-store',signal:AbortSignal.timeout(12000)});
const health=await res.json();console.log('LIVE_HEALTH',JSON.stringify({status:res.status,ms:Math.round(performance.now()-start),online:health.online,storage:health.storage,region:health.region,maxPlayers:health.maxPlayers,netRevision:health.netRevision}));assert(res.ok&&health.online===true);
const t=performance.now(),list=await fetch(origin+'/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'list'}),signal:AbortSignal.timeout(12000)});
const data=await list.json();console.log('LIVE_PUBLIC',JSON.stringify({status:list.status,ms:Math.round(performance.now()-t),servers:data.servers?.map(({id,count,max,phase,joinable})=>({id,count,max,phase,joinable}))}));assert(list.ok&&data.servers?.length===3);
const page=await fetch(origin+'/',{cache:'no-store',signal:AbortSignal.timeout(12000)});const html=await page.text();console.log('LIVE_WEB',page.status,html.includes('Sector B — Graveyard Delivery Group'));assert(page.ok&&html.includes('Sector B — Graveyard Delivery Group'));
