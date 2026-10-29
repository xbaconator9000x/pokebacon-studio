// Save storage is verified independently of species, item and sprite tables.
// Shattered 0.71: matches recovered linked.o save functions and global.h.
// SaveBlock2 filler_E20[0x100] is persisted by the 0xF24-byte section 0.
const anchors=[
 [0x1277a4c,'10b50f4b18680f4bc35a042b0fd00d2b11d0002b0ad1cc220b49ff231b019b1a1b041b0cc018094b00f0a4fb10bd962207499200f1e7ba2206491201ede7c04694530003f40f000074b1030289221f0840b2030298b40302'],
 [0x1277aa4,'0e22f0b500253c4b1b68db07db1785b01340039102930195029b384c581900062168374e000e00f07cfb2068354bc45a002c01d1344b1d80039be4001c19a188324b00f06bfb2d4f314a3968314b8a589a421dd1304bcb5a834219d1a28820682e4c00f05cfb3968264bcb5a042b3bd00d2b3dd0002b09d1cc222948ff231b019b1a1b041b0cc91800f049fb0123019301350e2dc0d1019b002b22d08022214c52010021204f200000f03cfb21001e2000f037fbff22210012011c48174d00f02ffb802200215201200000f02bfb21001f2000f026fbff2221001548120100f01ffb012005b0f0bd962212489200c5e7ba2211481201c1e790530003945300036ddf0d08f40f00008053000385df0d08f80f000009520108f60f000089221f0874b10302389a0302e9221f0838c0030228d0030240b2030298b40302'],
 [0x1278070,'10b50021024a0348034b00f0a1f810bda42e000074b10302e9221f08'],
 [0x141dee8,'0000240f0000f00ff00ff00fe01ff00fd02f980d0000f00ff00ff00fe01ff00fd02ff00fc03ff00fb04ff00fa05ff00f906ff00f807f5004']
];
export const VERIFIED_SAVE_PROFILES=Object.create(null);
export function identifySaveProfile(bytes,hash){
 if(!/^[a-f0-9]{64}$/.test(hash||''))return null;
 if(!anchors.every(([at,hex])=>at+hex.length/2<=bytes.length&&Array.from({length:hex.length/2},(_,i)=>bytes[at+i]===parseInt(hex.slice(i*2,i*2+2),16)).every(Boolean)))return null;
 const profile=Object.freeze({name:'Shattered expanded save 0.71',saveBlock:2,savePointer:0x0300500C,saveOffset:0xE20,saveLength:144});
 VERIFIED_SAVE_PROFILES[hash]=profile;return profile;
}
