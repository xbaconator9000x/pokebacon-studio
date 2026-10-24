// Discover object graphics from real map-event IDs and validated native records.
// Both engines use ObjectEventGraphicsInfo / SpriteFrameImage; tags are read,
// never substituted with another game's palette or character numbers.
export function discoverObjectGraphics(r){
 const used=[...new Set(r.maps.flatMap(m=>r.events(m).npcs.map(e=>e.sprite)).filter(n=>n>=0&&n<240))];if(!used.length)return null;
 const info=new Set(),valid=(at,n)=>r.valid(at,n),ptr=at=>valid(at,4)?r.ptr(at):-1;
 for(let at=512;at<r.size-36;at+=4){if(r.u16(at)!==65535)continue;const w=r.u16(at+8),h=r.u16(at+10);if(!w||!h||w%8||h%8||w>64||h>64||r.u16(at+6)!==w*h/2||![16,24,28].every(k=>valid(ptr(at+k),4)))continue;const im=ptr(at+28);if(!valid(ptr(im),w*h/2)||r.u16(im+4)!==w*h/2)continue;info.add(at);}
 const tables=[];for(let at=512;at<r.size-16;at+=4){if(!info.has(ptr(at))||!info.has(ptr(at+4))||!info.has(ptr(at+8)))continue;if(at>=516&&info.has(ptr(at-4)))continue;let count=0;while(count<512&&valid(at+count*4,4)&&info.has(ptr(at+count*4)))count++;const matches=used.filter(id=>id<count).length;if(matches>=Math.min(8,used.length)&&matches/used.length>.75)tables.push({table:at,count,matches});}
 tables.sort((a,b)=>b.matches-a.matches||b.count-a.count);if(!tables.length||tables[1]?.matches===tables[0].matches&&tables[1]?.count===tables[0].count)return null;const p=tables[0],tags=new Set();for(let id=0;id<Math.min(p.count,240);id++)tags.add(r.u16(ptr(p.table+id*4)+2));
 const palettes=[];for(let at=512;at<r.size-8;at+=4){if(!tags.has(r.u16(at+4))||r.u16(at+6)||!valid(ptr(at),32))continue;if(at>=520&&tags.has(r.u16(at-4))&&r.u16(at-2)===0&&valid(ptr(at-8),32))continue;let count=0;const found=new Set();while(count<256&&valid(at+count*8,8)){const q=at+count*8,tag=r.u16(q+4),pal=ptr(q);if(r.u16(q+6)||!valid(pal,32)||!Array.from({length:16},(_,i)=>r.u16(pal+i*2)).every(c=>c<32768))break;found.add(tag);count++;}const matches=[...tags].filter(t=>found.has(t)).length;if(matches>=Math.min(4,tags.size)&&matches/tags.size>.7)palettes.push({at,count,matches});}
 palettes.sort((a,b)=>b.matches-a.matches||b.count-a.count);if(!palettes.length||palettes[1]?.matches===palettes[0].matches&&palettes[1]?.count===palettes[0].count)return null;return{table:p.table,count:p.count,paletteTable:palettes[0].at,paletteCount:palettes[0].count,sprites:{}};
}
