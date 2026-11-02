export function normalizeLearnset(rows,{moves=null}={}){
 if(!Array.isArray(rows)||rows.length>256)throw Error('Use at most 256 level-up moves.');
 return rows.map((row,index)=>{const level=row?.level,move=row?.move;if(!Number.isInteger(level)||level<0||level>255||!Number.isInteger(move)||move<1||move>65534)throw Error('Move '+(index+1)+' needs a level from 0–255 and a valid move ID.');if(moves?.length&&!moves.some(m=>m.id===move))throw Error('Move '+move+' is not in the opened ROM.');return{level,move};}).sort((a,b)=>a.level-b.level);
}
export function parseLearnset(text,moves=[]){
 if(typeof text!=='string'||text.length>50000)throw Error('Paste a learnset under 50,000 characters.');
 const rows=[];for(const [index,line]of text.split(/\r?\n/).entries()){const value=line.trim();if(!value||value.startsWith('//'))continue;const match=value.match(/^(\d+)\s*[:=,]\s*(.+)$/);if(!match)throw Error('Line '+(index+1)+': use level: move name or ID.');const name=match[2].trim(),number=name.match(/^(?:#)?(\d+)$|\(#(\d+)\)$/);let move=number?Number(number[1]??number[2]):null;if(move===null){const found=moves.filter(m=>m.name.toLowerCase()===name.toLowerCase());if(found.length!==1)throw Error('Line '+(index+1)+': choose a unique move name or use its ID.');move=found[0].id;}rows.push({level:Number(match[1]),move});}return normalizeLearnset(rows,{moves});
}
export function movesAtLevel(rows,level){
 if(!Number.isInteger(level)||level<1||level>255)throw Error('Choose a preview level from 1–255.');
 const known=[];for(const row of normalizeLearnset(rows)){if(row.level===0||row.level>level)continue;if(known.includes(row.move))continue;if(known.length===4)known.shift();known.push(row.move);}return known;
}
