import {gameScore} from './music-game-score.js';
import {learnPhrases} from './music-learning.js';
import {phraseScore} from './music-phrase-engine.js';
import {applySongMotif} from './music-song-motif.js';
import {composeMusic,checkScore,MUSIC_SCALES,MUSIC_MOODS,musicRandom} from './music-compose.js';

export const SONG_DEFAULTS={introBars:4,verseBars:16,bridgeBars:16};
export function songStructureFields(prefix,settings={}){const s={...SONG_DEFAULTS,...settings};return `<fieldset class="song-structure"><legend>Song structure</legend><p>Intro plays once. Groove → bridge repeats.</p><div class="studio-grid">${[['introBars','Intro bars (0 = off)',0],['verseBars','Groove / verse bars',1],['bridgeBars','Melodic bridge bars',1]].map(([key,label,min])=>`<label>${label}<input id="${prefix}${key}" type="number" min="${min}" max="128" value="${s[key]}"></label>`).join('')}</div><p id="${prefix}structureSummary" class="hint-line"></p></fieldset>`;}
export function readSongStructure(prefix,doc=document){return Object.fromEntries(Object.keys(SONG_DEFAULTS).map(key=>[key,Number(doc.querySelector('#'+prefix+key).value)]));}

// Each section shares one musical vocabulary. The groove repeats its main
// phrase; the bridge develops a small melodic cell over changing harmony.
export function composeSong(options={},generate=composeMusic){
 const config={...SONG_DEFAULTS,...options}, {introBars,verseBars,bridgeBars}=config;
 for(const [name,value,min]of [['intro',introBars,0],['groove',verseBars,1],['bridge',bridgeBars,1]])if(!Number.isInteger(value)||value<min||value>128)throw Error('Choose '+min+'–128 bars for the '+name+'.');
 if(generate===composeMusic&&options.quickPreset){let score=gameScore(options);if(options.referenceScore)score=applySongMotif(score,options.referenceScore,options);checkScore(score);return score;}
 if(generate===composeMusic){const sections=[];if(introBars)sections.push({kind:'intro',name:'Intro',start:0,length:introBars*96});sections.push({kind:'verse',name:'Groove / verse',start:introBars*96,length:verseBars*96},{kind:'bridge',name:'Melodic bridge',start:(introBars+verseBars)*96,length:bridgeBars*96});const generated={...options};if(options.learnFullSong&&options.referenceScore)generated.learned=learnPhrases(options.referenceScore,options.track||0);let score=phraseScore(generated,sections);if(options.referenceScore)score=applySongMotif(score,options.referenceScore,options);checkScore(score);return score;}
 const phrase=generate({...options,bars:Math.max(4,Math.min(8,verseBars))});checkScore(phrase);
 const score={ppq:24,length:(introBars+verseBars+bridgeBars)*96,loopStart:introBars*96,tempos:[{...phrase.tempos[0],tick:0}],tracks:phrase.tracks.map(t=>({...t,notes:[],automation:undefined})),songSections:[]};
 const append=(kind,bars,start)=>{score.songSections.push({kind,name:kind==='verse'?'Groove / verse':kind==='intro'?'Intro':'Melodic bridge',start:start*96,length:bars*96});};
 if(introBars)append('intro',introBars,0);append('verse',verseBars,introBars);append('bridge',bridgeBars,introBars+verseBars);
 const copy=(source,from,to,at,gain=1)=>source.filter(n=>n.tick<to&&n.tick+n.duration>from).map(n=>({...n,tick:at+Math.max(0,n.tick-from),duration:Math.min(to,n.tick+n.duration)-Math.max(from,n.tick),velocity:Math.max(1,Math.round(n.velocity*gain))}));
 for(let bar=0;bar<verseBars;bar++){const sourceBar=bar%(phrase.length/96);score.tracks.forEach((t,i)=>t.notes.push(...copy(phrase.tracks[i].notes,sourceBar*96,(sourceBar+1)*96,(introBars+bar)*96)));}
 // Sparse introduction builds towards the same groove, never repeats in-game.
 for(let bar=0;bar<introBars;bar++){const from=(bar%(phrase.length/96))*96;score.tracks.forEach((t,i)=>{let ns=copy(phrase.tracks[i].notes,from,from+96,bar*96,.55+.4*(bar+1)/introBars);if(i===0)ns=ns.filter((n,j)=>j%3===0);if(i===3&&bar<introBars-1)ns=[];t.notes.push(...ns);});}
 const random=musicRandom((options.seed??1)^0xb71d9e),steps=MUSIC_SCALES[options.scale||MUSIC_MOODS[options.mood||'Battle']?.scale]||MUSIC_SCALES['Natural minor'],key=options.key??0;
 const scalePitches=Array.from({length:61},(_,i)=>36+i).filter(n=>steps.includes((n-key+120)%12)),degree=n=>scalePitches.reduce((best,p,i)=>Math.abs(p-n)<Math.abs(scalePitches[best]-n)?i:best,0),pitch=d=>scalePitches[Math.max(0,Math.min(scalePitches.length-1,d))];
 const melody=phrase.tracks[0].notes.slice(0,4),base=degree(melody[0]?.key??67),cell=melody.map(n=>Math.max(-3,Math.min(3,degree(n.key)-base)));if(cell.length<3)cell.push(1,-1,0);
 const backing=generate({...options,seed:((options.seed??1)^0x42524944)>>>0,bars:Math.max(4,Math.min(32,bridgeBars)),complexity:Math.min(55,options.complexity??45)});
 let previous=base;
 for(let bar=0;bar<bridgeBars;bar++){
  const at=(introBars+verseBars+bar)*96,from=bar%(backing.length/96)*96;
  score.tracks.slice(1).forEach((t,j)=>t.notes.push(...copy(backing.tracks[j+1].notes,from,from+96,at,j===1?.8:1)));
  const shape=[0,1,2,1,0,-1,0,1][bar%8]+Math.floor(bar/8)%3,root=base+shape,turn=bar%4;
  const rhythms=[[0,24,60],[0,18,48,72],[0,36,60,84],[0,30,54]][(turn+Math.floor(random()*2))%4];
  rhythms.forEach((beat,i)=>{const target=root+cell[i%cell.length]+(i===rhythms.length-1&&bar===bridgeBars-1?-shape:0);let next=bar===0&&i===0?base:Math.max(previous-2,Math.min(previous+2,target));if(i===rhythms.length-1&&bar===bridgeBars-1)next=base;const space=(rhythms[i+1]??96)-beat;score.tracks[0].notes.push({tick:at+beat,duration:Math.max(2,space-(turn%2?3:5)),key:pitch(next),velocity:88+Math.floor(random()*12)});previous=next;});
 }
 score.tracks.forEach(t=>t.notes.sort((a,b)=>a.tick-b.tick||a.key-b.key));checkScore(score);return score;
}

export function scoreSeconds(score,end=score.length){let seconds=0;for(let i=0;i<score.tempos.length;i++){const t=score.tempos[i],to=Math.min(end,score.tempos[i+1]?.tick??end);if(to>t.tick)seconds+=(to-t.tick)*60/(24*t.bpm);if(to===end)break;}return seconds;}
