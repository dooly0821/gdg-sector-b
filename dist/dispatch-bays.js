export const DOCK=[4.6,.24,-19.6];
export const DOCKS=[DOCK,[-34,.24,13.5],[.5,.24,49.5]];
export const clearOfNewDocks=([x,y,z])=>DOCKS.slice(1).every(([dx,dy,dz])=>Math.abs(x-dx)>=2.06||Math.abs(z-dz)>=1.59||y>=2);
