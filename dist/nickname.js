export function normalizeNickname(value){
 if(typeof value!=='string')return null;
 const name=value.normalize('NFC').trim().replace(/ +/g,' ');
 const length=Array.from(name).length;
 return length>=2&&length<=12&&/^[\p{L}\p{N} _-]+$/u.test(name)&&/[\p{L}\p{N}]/u.test(name)?name:null;
}
export function escapeNickname(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
