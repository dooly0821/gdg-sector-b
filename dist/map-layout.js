// Shared difficulty layout contract. Hard and Hell open the same two extra halls.
export const expandedLayout=value=>['hard','hell'].includes(typeof value==='string'?value:value?.difficultyLevel??value?.difficulty?.level);
export const EXTENSION_END=102;
export const EXTENSION_LOCKERS=[[-40,83],[-21,96],[-40,99],[-11,83],[9,96],[12,99]];
export const EXTENSION_STAIRS=[[-35,91],[-22,88],[-5,91],[8,88]];
export const EXTENSION_HIDE=[[-35,92.8],[-22,89.8],[-5,92.8],[8,89.8],[-38,87],[-19,91],[-8,87],[11,91]];
export const EXTENSION_ROUTES=[[[ -30,80],[-30,85],[-30,95],[-27,99]], [[-39,81],[-38,89],[-38,96],[-30,98]], [[0,80],[0,85],[0,95],[3,99]], [[13,81],[13,89],[13,96],[5,98]]];
export const EXTENSION_CARGO=[[-30,0,82],[-30,0,86],[-30,0,90],[-30,0,96],[-26,0,99],[-39,0,80],[-39,0,94],[-25,0,81],[-19,0,99],[-17,0,84],[0,0,82],[0,0,86],[0,0,90],[0,0,96],[4,0,99],[13,0,80],[13,0,94],[5,0,81],[-12,0,99],[-13,0,84]].map(pos=>({area:pos[0]<-15?'Oversize freight':'Night reserve',pos}));
export const extensionRegions=[[-43,78,28,24,'E-01 대형 화물동'],[-15,78,30,24,'E-02 야간 예비창고']];
export const hasExtension=blocks=>blocks.some(b=>b[6]==='extension-boundary');
