// Client-only visual identifiers. No new models, textures, lights, particles or network state.
export const CARGO_GLOW=Object.freeze({
 noisy:1,heavy:2,urgent:3,cursed:4
});
export const cargoGlowCode=type=>Object.hasOwn(CARGO_GLOW,type)?CARGO_GLOW[type]:0;
const COLORS=[[0,0,0],[.922,.773,.294],[.322,.553,1],[1,.224,.224],[.682,.322,.914]];
export const GLOW_MAX_DISTANCE=24;
export function glowPalette(t=0){
 const time=Number.isFinite(t)?t:0;
 // Slow, continuous low-amplitude pulses, computed once per type per frame.
 return COLORS.map((rgb,i)=>[...rgb,i===0?0:i===1?.22+.035*Math.sin(time*2.1):i===2?.18+.012*Math.sin(time*.85):i===3?.23+.045*Math.sin(time*2.5):.22+.035*Math.sin(time*1.7)+.015*Math.sin(time*2.9)]);
}
export function glowDistanceFactor(d2=0){
 if(!Number.isFinite(d2)||d2>=576)return 0;
 return Math.min(1,Math.max(0,(576-d2)/252));
}
// Exact parcel-only identifiers. Never tint a fused/unknown hand or flashlight mesh.
export const isParcelNode=name=>typeof name==='string'&&/^(?:parcel|carton|box|cargo|gdg[_ -](?:parcel|carton|box|cargo))(?:[_. -]?(?:mesh|model|body|\d+))*$/i.test(name);
