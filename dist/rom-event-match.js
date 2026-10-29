// Coordinates alone are not identities: doorway aliases and sign regions can overlap.
const payload=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['index','address'].includes(k)));
const same=(a,b)=>{const x=payload(a),y=payload(b),keys=Object.keys(x).sort();return keys.length===Object.keys(y).length&&keys.every(k=>x[k]===y[k]);};
export function matchNativeEvent(old,fresh,type){
 const candidates=type==='npc'?fresh.filter(n=>n.localId===old.localId):fresh.filter(n=>n.x===old.x&&n.y===old.y&&(type!=='sign'||n.type===old.type));
 if(!candidates.length&&type==='warp'){
 const aliases=fresh.filter(n=>n.target===old.target&&n.warp===old.warp&&n.elevation===old.elevation);
 if(aliases.length>1&&aliases.every(n=>n.x===aliases[0].x&&n.y===aliases[0].y)&&Math.abs(aliases[0].x-old.x)+Math.abs(aliases[0].y-old.y)<=1){const at=aliases.find(n=>n.index===old.index);if(at)return[at];}
 }
 if(candidates.length<=1)return candidates;
 // If fresh aliases are wholly indistinguishable, a retained index is safe
 // only when the non-script identity still agrees. Script relocation itself
 // is expected across revisions and is reviewed separately by refresh.
 if(candidates.every(n=>same(candidates[0],n))){const at=candidates.find(n=>n.index===old.index),fields=type==='warp'?['target','warp','elevation']:type==='sign'?['type','elevation']:[];if(at&&fields.length&&fields.every(k=>old[k]===at[k]))return[at];}
 const exact=candidates.filter(n=>same(old,n));
 if(exact.length===1)return exact;
 // Indistinguishable aliases keep their incoming warp indices. Only accept an
 // index when the complete native record agrees; never use an index for a move.
 if(exact.length>1&&exact.every(n=>same(exact[0],n))){const at=exact.find(n=>n.index===old.index);if(at)return[at];}
 return candidates;
}
