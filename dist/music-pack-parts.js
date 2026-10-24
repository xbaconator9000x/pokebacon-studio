import {automationFor} from './music-controls.js';
// MP2K tracks can share an instrument when their controls match and no pitch
// overlaps itself. Keep every note, including same-pitch overlaps on separate tracks.
export function packMusicParts(source){
 const score=structuredClone(source),groups=[];
 const identity=t=>JSON.stringify([t.program,t.channel===9,automationFor(t)]);
 const fits=(a,b)=>{const endings=new Map();for(const n of [...a,...b].sort((x,y)=>x.tick-y.tick)){if((endings.get(n.key)||0)>n.tick)return false;endings.set(n.key,n.tick+n.duration);}return true;};
 for(const track of score.tracks){const key=identity(track),group=groups.find(g=>g.key===key&&fits(g.track.notes,track.notes));if(group){group.track.notes.push(...track.notes);group.track.sourcePartNames.push(track.name||'Unnamed part');}else groups.push({key,track:{...track,sourcePartNames:[track.name||'Unnamed part']}});}
 score.tracks=groups.map(({track})=>({...track,name:track.sourcePartNames.length>1?track.sourcePartNames[0]+' + '+(track.sourcePartNames.length-1)+' parts':track.name,notes:track.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key)}));return score;
}
