const color=(p,i)=>Math.round(p[i]*31/255)|Math.round(p[i+1]*31/255)<<5|Math.round(p[i+2]*31/255)<<10;
// Two BG planes may use different palettes. Repartition only where their native
// priority is equivalent; never move canopy pixels below the player to fit.
export function factorNativePalettePair(lower,upper,palettes,{preservePriority=true}={}){
 const sets=palettes.map(p=>new Set(p)),has=(p,s)=>{for(let i=0;i<p.length;i+=4)if(p[i+3]>=128&&!s.has(color(p,i)))return false;return true;};
 if(sets.some(s=>has(lower,s))&&sets.some(s=>has(upper,s)))return[lower,upper];
 let best=null;for(const a of sets)for(const b of sets){const lo=new Uint8ClampedArray(lower.length),hi=new Uint8ClampedArray(upper.length);let cost=0,ok=true;for(let i=0;i<lower.length;i+=4){const top=upper[i+3]>=128,p=top?upper:lower;if(p[i+3]<128)continue;const c=color(p,i);if(top&&b.has(c))hi.set(p.subarray(i,i+4),i);else if(!top&&a.has(c))lo.set(p.subarray(i,i+4),i);else if(!preservePriority&&(a.has(c)||b.has(c))){(a.has(c)?lo:hi).set(p.subarray(i,i+4),i);cost++;}else{ok=false;break;}}if(ok&&(!best||cost<best.cost))best={cost,lo,hi};}
 return best?[best.lo,best.hi]:null;
}
