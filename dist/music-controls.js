// Native MP2K track controls. Bends use its signed seven-bit resolution.
export const CONTROL_DEFAULTS={bend:0,range:2,volume:100,pan:64};
export function validateAutomation(track,length){
 if(track.automation===undefined)return;
 if(!Array.isArray(track.automation)||track.automation.length>8192)throw Error('Keep part automation below 8192 points.');
 let last=-1;for(const point of track.automation){if(!point||!Number.isInteger(point.tick)||point.tick<0||point.tick>=length||point.tick<last)throw Error('Part automation must be ordered within the song.');last=point.tick;for(const [key,min,max]of [['bend',-64,63],['range',0,127],['volume',0,127],['pan',0,127]])if(point[key]!==undefined&&(!Number.isInteger(point[key])||point[key]<min||point[key]>max))throw Error('Invalid music '+key+' control.');}
}
export function automationFor(track){
 const points=[{tick:0,...CONTROL_DEFAULTS}];
 for(const p of track.automation||[]){const last=points.at(-1),next={...last,...p};if(p.tick===last.tick)points[points.length-1]=next;else points.push(next);}
 return points.filter((p,i,a)=>!i||Object.keys(CONTROL_DEFAULTS).some(k=>p[k]!==a[i-1][k]));
}
