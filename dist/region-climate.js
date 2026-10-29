import{landscapeHeight,landscapeNoise}from'./landscape-field.js';
export function regionClimate(plan,{temperature=50,rainfall=50}={}){
 if(![temperature,rainfall].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('Climate sliders must be between 0 and 100.');
 const maxY=Math.max(1,...plan.nodes.map(n=>n.y));
 for(const n of plan.nodes){const x=n.x*64+32,y=n.y*64+32,height=landscapeHeight(plan.seed,x,y),heat=Math.max(0,Math.min(1,temperature/100+(n.y/maxY-.5)*.48+(landscapeNoise(plan.seed^301,x,y,110)-.5)*.6)),rain=Math.max(0,Math.min(1,rainfall/100+(landscapeNoise(plan.seed^811,x,y,85)-.5)*1.2));
  n.climate={temperature:heat,rainfall:rain,elevation:height,habitat:n.biome};
  if(plan.theme!=='continent')continue;
  n.biome=heat<.28?'snow':height>.65?'mountain':rain<.28?'desert':rain>.54?'forest':'meadow';
  n.climate.habitat=n.biome==='forest'?(heat>.65?'jungle':heat<.42?'pine forest':'forest'):n.biome==='meadow'&&rain<.42?'dry plains':n.biome==='snow'?'tundra':n.biome;
 }
 plan.climate={temperature,rainfall};return plan;
}

export const REGION_HABITATS=[['meadow','Meadow'],['forest','Forest'],['pine forest','Pine forest'],['jungle','Jungle'],['dry plains','Dry plains'],['mountain','Mountain'],['underground','Cave'],['snow','Snow'],['tundra','Tundra'],['desert','Desert'],['coastal','Coast']];
export const HABITAT_FAMILY={'pine forest':'forest',jungle:'forest','dry plains':'meadow',tundra:'snow'};
