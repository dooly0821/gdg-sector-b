// Surveyed straight runs, not invulnerability or auto-movement paths.
export const RUN_LANES=[["B",[-13.5,15.9],[9.5,15.9]],["B",[-7.8,0],[-7.8,20]],["B",[2.7,3.8],[2.7,20]],["C-01",[-18.8,-7.5],[-18.8,16]],["C-01",[-41,15.7],[-19.3,15.7]],["D-03",[-17.9,27],[-17.9,48]],["D-03",[-37.5,33.5],[-22.6,33.5]],["D-02",[-13.5,25.7],[13.5,25.7]],["D-02",[-2.7,32.5],[-2.7,52.5]],["C-02",[-34.2,71.5],[-19.9,71.5]],["D-04",[-12.6,62.4],[-12.6,75.8]],["D-04",[-0.4,63.7],[11.2,63.7]]].map(([zone,a,b])=>({zone,a,b,width:2.7}));
export function markRunLanes(w){
 const paint=w.mat('lane-muted-safety','#8c845b','paint');
 // Sparse edge dashes, no collision geometry or extra light sources.
 for(const {a,b,width} of RUN_LANES){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  for(let t=.6;t<len-.6;t+=2.8)for(const side of [-1,1]){
   const x=a[0]+ux*t+uz*width*.5*side,z=a[1]+uz*t-ux*width*.5*side;
   w.box(x,.021,z,Math.abs(dx)>.1?.72:.07,.012,Math.abs(dz)>.1?.72:.07,paint);
  }
 }
}
