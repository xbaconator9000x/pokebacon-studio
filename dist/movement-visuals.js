// One palette for rule controls, icons and the movement overlay.
export const MOVEMENT_VISUALS={
 grass:{name:'Encounter grass',color:'#a58b00',icon:'♧'},
 original:{name:'Keep ROM rule',color:'#687a89',icon:'≋'},
 walk:{name:'Walkable',color:'#23945f',icon:'✓'},
 block:{name:'Blocked',color:'#d14d59',icon:'×'},
 behind:{name:'Walk behind',color:'#9858d4',icon:'◐'},
 water:{name:'Water / Surf',color:'#208bd5',icon:'≈'},
 ledge_south:{name:'Jump down ledge',color:'#d36f1b',icon:'↓'},
 ledge_north:{name:'Jump up ledge',color:'#c04493',icon:'↑'},
 ledge_west:{name:'Jump left ledge',color:'#2760af',icon:'←'},
 ledge_east:{name:'Jump right ledge',color:'#008b8b',icon:'→'}
};
export const SURFACE_VISUALS={
 22:{name:'Reflective puddle · walkable',color:'#00a5b5',icon:'P'},
 16:{name:'Reflective pond · Surf',color:'#424cc5',icon:'W'},
 23:{name:'Shallow water · splashes',color:'#447fa1',icon:'S'},
 33:{name:'Sand · footprints',color:'#9b6b35',icon:'F'}
};
export function surfaceVisual(rule){return SURFACE_VISUALS[rule.behavior]||null;}
export function movementVisual(rule,{water=false}={}){
 const ledge=Object.entries({0x3b:'south',0x3a:'north',0x39:'west',0x38:'east'}).find(([id])=>Number(id)===rule.behavior)?.[1];
 if(rule.mode?.startsWith('ledge_'))return MOVEMENT_VISUALS[rule.mode]||MOVEMENT_VISUALS.block;
 if(ledge)return MOVEMENT_VISUALS['ledge_'+ledge];
 if(rule.collision)return MOVEMENT_VISUALS.block;
 if(rule.mode==='behind'||rule.behind)return MOVEMENT_VISUALS.behind;
 if(surfaceVisual(rule))return surfaceVisual(rule);
 if(rule.mode==='water'||rule.behavior===16||water)return MOVEMENT_VISUALS.water;
 if([2,3].includes(rule.behavior))return MOVEMENT_VISUALS.grass;
 return MOVEMENT_VISUALS.walk;
}
