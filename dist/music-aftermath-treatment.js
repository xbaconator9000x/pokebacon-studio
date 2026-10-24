// A deterministic transformation layer for turning a familiar route or town
// arrangement into a worn, atmospheric version.  It deliberately leaves the lead
// track's pitches and timing alone: the source identity is the point.

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const hash=(seed,track,tick,extra=0)=>{
  let x=(seed>>>0)^Math.imul((track+17)>>>0,0x9e3779b9)^Math.imul((tick+31)>>>0,0x85ebca6b)^Math.imul((extra+7)>>>0,0xc2b2ae35);
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return((x^(x>>>16))>>>0)/4294967296;
};
const amountFor=({mode='none',amount}={})=>{
  if(Number.isFinite(amount))return clamp(Number(amount),0,1);
  return mode==='aftermath-subtle'||mode==='worn-subtle'||mode==='subtle'?0.42:mode==='aftermath-strong'||mode==='worn-strong'||mode==='strong'?0.82:mode==='aftermath-route'||mode==='worn-route'?0.64:0;
};
const safeKey=(n)=>clamp(Math.round(n),0,127);
const darkPitch=(key,root,amount)=>{
  const rel=((key-root)%12+12)%12;
  // The three notes that most strongly announce a major/bright colour.
  const changed={4:3,9:8,11:10}[rel];
  if(changed===undefined||amount<0.18)return key;
  if(amount<0.55&&hash(0x53484154,rel,key)<(amount-.12)*1.7)return key;
  return safeKey(key+changed-rel);
};
const normalise=(notes,length)=>{
  const byKey=new Map(),out=[];
  for(const raw of notes||[]){
    const n={...raw,tick:Math.max(0,Math.floor(raw.tick)),duration:Math.max(1,Math.floor(raw.duration)),key:safeKey(raw.key),velocity:clamp(Math.round(raw.velocity??80),1,127)};
    if(n.tick>=length)continue;
    n.duration=Math.min(n.duration,length-n.tick);
    const previous=byKey.get(n.key);
    if(previous&&previous.tick+previous.duration>n.tick){
      previous.duration=n.tick-previous.tick;
      if(previous.duration<1){const at=out.indexOf(previous);if(at>=0)out.splice(at,1);}
    }
    if(n.duration<1)continue;
    out.push(n);byKey.set(n.key,n);
  }
  return out.sort((a,b)=>a.tick-b.tick||a.key-b.key);
};
const thin=(notes,prob,track,seed)=>notes.filter((n,i)=>hash(seed,track,n.tick,i)<prob);
const firstPerBar=(notes,length,mapper)=>{
  const bars=new Map();
  for(const n of notes){const bar=Math.floor(n.tick/96);const old=bars.get(bar);if(!old||mapper(n,old))bars.set(bar,n);}
  return [...bars.values()].sort((a,b)=>a.tick-b.tick);
};

/**
 * Apply the worn atmosphere to a symbolic score.
 *
 * `mode` is `none`, `aftermath-subtle`, `aftermath-route`, or
 * `aftermath-strong`; callers may pass `amount` (0..1) for a continuous UI.
 * The operation is immutable and reproducible for a given seed.
 */
export function applyAftermathTreatment(source,{mode='none',amount,seed=0}={}){
  const strength=amountFor({mode,amount});
  const score=structuredClone(source);
  if(!strength)return score;
  const root=Number.isInteger(score.composition?.settings?.key)?score.composition.settings.key:0;
  const leadScale=1-.12*strength;
  score.tempos=(score.tempos||[{tick:0,bpm:120}]).map(t=>({...t,bpm:clamp(Math.round(t.bpm*(1-.18*strength)),10,510)}));
  score.tracks=(score.tracks||[]).map((track,index)=>{
    const label=(track.name||'').toLowerCase();
    const isLead=index===0||label.includes('lead')||label.includes('melody');
    const isAnswer=label.includes('answer')||label.includes('counter');
    const isBass=label.includes('bass');
    const isArp=label.includes('arp')||label.includes('echo');
    const isChord=label.includes('chord')||label.includes('harmony')||label.includes('pad');
    const isDrum=label.includes('perc')||label.includes('drum')||track.program===3;
    let notes=(track.notes||[]).map(n=>({...n}));
    if(isLead){
      // Recognition lock: no pitch, tick, duration, or ordering changes.
      notes=notes.map(n=>({...n,velocity:clamp(Math.round(n.velocity*leadScale),1,127)}));
    }else if(isAnswer){
      notes=thin(notes,.34-.20*strength,index,seed).map(n=>({...n,duration:Math.max(n.duration,Math.min(72,score.length-n.tick)),key:darkPitch(n.key,root,strength),velocity:clamp(Math.round(n.velocity*(.72-.10*strength)),1,127)}));
    }else if(isBass){
      // A lonely root/pedal per bar. Prefer the lowest source note in each bar.
      const chosen=firstPerBar(notes,score.length,(a,b)=>a.key<b.key);
      notes=chosen.map(n=>({...n,duration:Math.min(score.length-n.tick,Math.max(48,Math.min(96,n.duration+36))),key:darkPitch(n.key,root,strength),velocity:clamp(Math.round(n.velocity*(.78-.12*strength)),1,127)}));
    }else if(isChord){
      // Sustained, slightly lowered chord colour: one memory-like tone per bar.
      const chosen=firstPerBar(notes,score.length,(a,b)=>a.velocity>b.velocity);
      notes=chosen.map(n=>({...n,duration:Math.min(score.length-n.tick,Math.max(48,Math.min(84,n.duration+48))),key:darkPitch(n.key,root,strength),velocity:clamp(Math.round(n.velocity*(.58-.10*strength)),1,127)}));
    }else if(isArp){
      notes=thin(notes,.36-.18*strength,index,seed).map(n=>({...n,duration:Math.min(n.duration,Math.max(6,Math.round(18-6*strength))),key:darkPitch(n.key,root,strength),velocity:clamp(Math.round(n.velocity*(.56-.12*strength)),1,127)}));
    }else if(isDrum){
      notes=thin(notes,.30-.16*strength,index,seed).map(n=>({...n,duration:Math.min(n.duration,3),velocity:clamp(Math.round(n.velocity*(.48-.12*strength)),1,127)}));
    }else{
      notes=thin(notes,.52-.20*strength,index,seed).map(n=>({...n,key:darkPitch(n.key,root,strength),velocity:clamp(Math.round(n.velocity*(.7-.1*strength)),1,127)}));
    }
    return {...track,notes:normalise(notes,score.length)};
  });
  score.composition={...(score.composition||{}),description:`${score.composition?.description||'Source arrangement'} Worn treatment preserves the source lead while thinning the arrangement, darkening the harmony, and leaving more silence.`,treatment:{name:'Worn',mode,amount:strength,seed:seed>>>0,preserved:'lead melody pitches and timing'}};
  return score;
}

export const aftermathTreatment=applyAftermathTreatment;

