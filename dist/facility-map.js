import {LOCKERS} from './lockers.js';
import {HIDING_POINTS,REFUGES} from './annex.js';
import {DRESSING_HIDE} from './dressing.js';
import {RUN_LANES} from './layout.js';
import {DOCK,DOCKS,PARCELS} from './mission.js';
import {cargoColor} from './shift-ui.js';
export const mapX=x=>8+(x+43)*5,mapZ=z=>8+(z+22)*5;
const X=mapX,Y=mapZ;
const n=x=>Number.isFinite(x)?+x.toFixed(2):0;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FACILITY_REGIONS=[[-43,-9,28,30,'C-01 분류동'],[-15,-22,30,44,'B 메인 창고'],[-43,21,28,33,'D-03 반품동'],[-15,22,30,32,'D-02 이송동'],[-43,54,28,24,'C-02 폐기물동'],[-15,54,30,24,'D-04 격리동']];
const regions=FACILITY_REGIONS;
const rect=(x,z,w,d,fill)=>'<rect x="'+n(X(x))+'" y="'+n(Y(z))+'" width="'+n(w*5)+'" height="'+n(d*5)+'" fill="'+fill+'" stroke="#748083" stroke-width=".65"/>';
const cache=new WeakMap();
export function mapBase(blocks){
 if(cache.has(blocks))return cache.get(blocks);
 let out=regions.map(([x,z,w,d,id])=>rect(x,z,w,d,'#292a28')).join('');
 // Rasterise actual floor collision footprints into one compact path.
 const W=116,H=200,grid=new Uint8Array(W*H);
 for(const b of blocks??[]){if(b[4]>1.5||b[5]<.24)continue;
  const x0=Math.max(0,Math.floor((b[0]+43)*2)),x1=Math.min(W,Math.ceil((b[2]+43)*2)),z0=Math.max(0,Math.floor((b[1]+22)*2)),z1=Math.min(H,Math.ceil((b[3]+22)*2));
  for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++)grid[z*W+x]=1;
 }
 let d='';for(let z=0;z<H;z++){for(let x=0;x<W;){if(!grid[z*W+x]){x++;continue;}const a=x;while(x<W&&grid[z*W+x])x++;d+='M'+n(8+a*2.5)+' '+n(8+z*2.5)+'h'+n((x-a)*2.5)+'v2.5h-'+n((x-a)*2.5)+'z';}}
 out+='<path d="'+d+'" fill="#746a59"/>';
 for(const {a,b} of RUN_LANES)out+='<path d="M'+X(a[0])+' '+Y(a[1])+'L'+X(b[0])+' '+Y(b[1])+'" stroke="#d6ae54" stroke-width="1" stroke-dasharray="3 4" opacity=".52" fill="none"/>';
 for(const [x,z] of [...HIDING_POINTS,...DRESSING_HIDE])out+='<rect x="'+n(X(x)-1.8)+'" y="'+n(Y(z)-1.8)+'" width="3.6" height="3.6" rx=".6" fill="#9bb3c4"/>';
 for(const [x,y,z] of REFUGES)out+='<path d="M'+X(x)+' '+(Y(z)-3)+'l3 6h-6z" fill="#94b7af"/>';
 for(const {x,z,id} of LOCKERS)out+='<g transform="translate('+n(X(x))+' '+n(Y(z))+')"><rect x="-4" y="-4" width="8" height="8" rx="1" fill="#438c72" stroke="#c3f4d9" stroke-width="1"/><path d="M-1.6 -2v4m3.2 -4v4M-1.6 0h3.2" stroke="#effff6" stroke-width=".9"/><title>은신 사물함 '+id+'</title></g>';
 for(const [x,z,w,d,id] of regions)out+='<text x="'+X(x+1.2)+'" y="'+Y(z+1.8)+'" fill="#e2e7e5" font-size="7.5" font-weight="800" paint-order="stroke" stroke="#222521" stroke-width="1.7">'+id+'</text>';
 for(const [i,dock] of DOCKS.entries())out+='<g transform="translate('+X(dock[0])+' '+Y(dock[2])+')"><rect x="-5" y="-3" width="10" height="6" fill="#79c9ec" stroke="#effbff" stroke-width="1"/><text x="-7" y="10" style="fill:#a9e8ff;font-size:6.2px" paint-order="stroke" stroke="#202426" stroke-width="1.6">출고 '+String(i+2).padStart(2,'0')+'</text></g>';
 cache.set(blocks,out);return out;
}
const teamColors=['#bb9bf5','#6ed9e3','#ff9ac6','#b7d987'];
const arrow=(p,color,label)=>'<g transform="translate('+n(X(p.x))+' '+n(Y(p.z))+')"><path transform="rotate('+n(-(p.yaw??0)*180/Math.PI)+')" d="M0 -5.5L3.8 4L0 2L-3.8 4Z" fill="'+color+'" stroke="#14212a" stroke-width="1"/><text x="5" y="-4" font-size="6.6" fill="'+color+'" font-weight="700" paint-order="stroke" stroke="#14212a" stroke-width="2">'+safe(label)+'</text></g>';
export function mapMarkers(s,peers=[],you=null){
 let out='';
 for(const [i,p] of (s?(s.cargo??PARCELS):[]).entries()){
  if(s&&s.states[i]!=='AVAILABLE')continue;
  const [x,y,z]=s?.parked?.[i]??p.pos,fill=cargoColor(p.special);
  const marker=p.special?'<path d="M0 -3.4L3.4 0 0 3.4 -3.4 0Z" fill="'+fill+'" stroke="#fff2ce" stroke-width=".7"/>':'<rect x="-2.2" y="-2.2" width="4.4" height="4.4" rx=".5" fill="'+fill+'" stroke="#252322" stroke-width=".6"/>';
  out+='<g transform="translate('+n(X(x))+' '+n(Y(z))+')">'+marker+(y>1.25?'<path d="M-2 -4l2 -2 2 2" stroke="#fff1b8" fill="none" stroke-width=".85"/>':'')+'<title>'+safe(p.id)+(p.special?' · 특수 화물':'')+'</title></g>';
 }
 for(const [i,p] of peers.entries())if(p.id!==you&&!p.failed)out+=arrow(p,teamColors[i%4],String(p.name??'팀원').slice(0,12)+(p.hidden?' · 은신':'')+(p.carried>=0?' · 화물':''));
 if(s&&!s.failed)out+=arrow(s,'#fff','나'+(s.carried>=0?' · 화물':''));else if(!s)out+=arrow({x:1.7,z:15,yaw:0},'#fff','시작 위치');
 return out;
}
export const MAP_KEY='<div class="map-key"><span style="color:#fff">▲ 나</span><span style="color:#bb9bf5">▲ 팀원</span><span style="color:#f4ca63">■ 화물</span><span style="color:#ebc54b">◆ 소음</span><span style="color:#528dff">◆ 중량</span><span style="color:#ff3939">◆ 긴급</span><span style="color:#ae52e9">◆ 격리</span><span style="color:#79c9ec">■ 출고대</span><span style="color:#c3f4d9">▣ 은신함</span><span style="color:#9bb3c4">■ 엄폐</span><span style="color:#a3b7b5">┄ 가속 통로</span></div>';
export function mapMarkup(blocks,s,peers,you){return '<svg class="map-drawing" viewBox="0 0 306 516" aria-label="GDG 전체 시설 실시간 지도"><g>'+mapBase(blocks)+'</g><g class="gdg-map-markers">'+mapMarkers(s,peers,you)+'</g></svg>'+MAP_KEY;}
