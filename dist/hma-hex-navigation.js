const LIMIT=128;

// Navigation is deliberately ephemeral: it describes where the user has
// inspected in the currently opened source ROM, not a native edit to save.
export function createHexNavigation(offset=0){return {entries:[offset],index:0};}

export function currentHexLocation(history){return history.entries[history.index];}

export function visitHexLocation(history,offset){
 if(!Number.isInteger(offset)||offset<0)throw Error('Use a valid source-ROM offset.');
 const entries=history.entries.slice(0,history.index+1);
 if(entries.at(-1)!==offset)entries.push(offset);
 return {entries:entries.slice(-LIMIT),index:Math.min(entries.length,LIMIT)-1};
}

export function moveHexHistory(history,direction){
 if(!Number.isInteger(direction)||!direction)throw Error('Choose a navigation direction.');
 const index=Math.max(0,Math.min(history.entries.length-1,history.index+(direction<0?-1:1)));
 return {entries:history.entries.slice(),index};
}

export function canMoveHexHistory(history,direction){return direction<0?history.index>0:history.index<history.entries.length-1;}

export function findHexAnchor(anchors,query){
 const name=String(query||'').trim().toLowerCase();
 if(!name)throw Error('Enter a named HMA anchor.');
 const matches=(anchors||[]).filter(anchor=>anchor.name.toLowerCase()===name);
 if(matches.length!==1)throw Error(matches.length?'That HMA anchor is ambiguous.':'No named HMA anchor matches that name.');
 return matches[0];
}
