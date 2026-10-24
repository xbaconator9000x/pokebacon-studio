// Generated from linked engine symbols. Save layouts are never accepted from project files.
const BUILDS=[
  {
    "game": {
      "version": 2,
      "capabilities": {
        "species": true,
        "moves": true,
        "items": true,
        "trainers": true,
        "encounters": false
      },
      "speciesCount": 1489,
      "moveCount": 992,
      "itemCount": 814,
      "abilityCount": 317,
      "trainerCount": 743,
      "trainerClassCount": 107,
      "trainers": 19326212,
      "trainerClasses": 19324820,
      "expandedTrainerParty": true,
      "speciesNames": 23124332,
      "moveNames": 17723068,
      "baseStats": 27860410,
      "abilityNames": 17735964,
      "items": 19259084,
      "moves": 19312496,
      "learnsets": 27691180,
      "evolutions": 27479780,
      "evolutionSlots": 16,
      "learnsetStride": 3,
      "speciesAbilities": 27902102,
      "abilityNameLength": 17,
      "typeMax": 18,
      "wildCount": 0
    },
    "sprites": {
      "title": "Expanded FireRed",
      "layout": "tables",
      "count": 1489,
      "namesAddress": 23124332,
      "front": 27841052,
      "back": 27793404,
      "normal": 27467308,
      "shiny": 27754268,
      "icons": 27676292,
      "iconIndices": 27465816,
      "iconPals": 4014136,
      "trainerFront": 2332028,
      "trainerPal": 2333212,
      "trainerCount": 0
    },
    "saveDescriptor": 18967560,
    "anchors": [
      {
        "at": 17109552,
        "hex": "0e22f0b500253c4b1b68db07db1785b01340039102930195029b384c581900062168374e000e00f07cfb2068354bc45a002c01d1344b1d80039be4001c19a188324b00f06bfb2d4f314a3968314b8a589a421dd1304bcb5a834219d1a28820682e4c00f05cfb3968264bcb5a042b3bd00d2b3dd0002b09d1cc222948ff231b019b1a1b041b0cc91800f049fb0123019301350e2dc0d1019b002b22d08022214c52010021204f200000f03cfb21001e2000f037fbff22210012011c48174d00f02ffb802200215201200000f02bfb21001f2000f026fbff2221001548120100f01ffb012005b0f0bd962212489200c5e7ba2211481201c1e79053000394530003"
      },
      {
        "at": 17110324,
        "hex": "f7b506001f4b1888301800040d00000c0e21aff745fd0e221b4f3b68db07db171340cc18f300ed182b680093ab88174d7232019328680021154b520100f0ecf92868144b144ac652144bc2503a68144b0099c250019a134b00f0def901990098114b2e6800f0d8f9104b2404f052240cfff718fe200629680d4b000e00f0ccf9febdc046805300039053000394530003d95e1e08f40f000025200108f80f0000fc0f0000795e1e08a9a10d08f60f0000d9990d08f7b52f4b2f4c1c602f4b0d00"
      },
      {
        "at": 18966716,
        "hex": "0000240f0000f00ff00ff00fe01ff00fd02f980d0000f00ff00ff00fe01ff00fd02ff00fc03ff00fb04ff00fa05ff00f906ff00f807f5004"
      },
      {
        "at": 18967560,
        "hex": "50425331010000000c500003200e000090000000b8700302d0700302"
      }
    ]
  }
];
export const ENGINE_SAVE_PROFILES=Object.assign(Object.create(null),{
  "efda0bee44328f20aff62fd695c338df70c5eca565f25bb4c8072a8fc5866c23": {
    "game": {
      "version": 2,
      "capabilities": {
        "species": true,
        "moves": true,
        "items": true,
        "trainers": true,
        "encounters": false
      },
      "speciesCount": 1489,
      "moveCount": 992,
      "itemCount": 814,
      "abilityCount": 317,
      "trainerCount": 743,
      "trainerClassCount": 107,
      "trainers": 19326212,
      "trainerClasses": 19324820,
      "expandedTrainerParty": true,
      "speciesNames": 23124332,
      "moveNames": 17723068,
      "baseStats": 27860410,
      "abilityNames": 17735964,
      "items": 19259084,
      "moves": 19312496,
      "learnsets": 27691180,
      "evolutions": 27479780,
      "evolutionSlots": 16,
      "learnsetStride": 3,
      "speciesAbilities": 27902102,
      "abilityNameLength": 17,
      "typeMax": 18,
      "wildCount": 0
    },
    "sprites": {
      "title": "Expanded FireRed",
      "layout": "tables",
      "count": 1489,
      "namesAddress": 23124332,
      "front": 27841052,
      "back": 27793404,
      "normal": 27467308,
      "shiny": 27754268,
      "icons": 27676292,
      "iconIndices": 27465816,
      "iconPals": 4014136,
      "trainerFront": 2332028,
      "trainerPal": 2333212,
      "trainerCount": 0
    },
    "saveDescriptor": 18967560
  }
});

export function identifyEngineProfile(bytes,hash){
 if(!/^[a-f0-9]{64}$/.test(hash||''))return null;
 const p=BUILDS.find(p=>p.anchors.every(a=>a.at+a.hex.length/2<=bytes.length&&Array.from({length:a.hex.length/2},(_,i)=>bytes[a.at+i]===parseInt(a.hex.slice(i*2,i*2+2),16)).every(Boolean)));
 if(!p)return null;
 const ptr=at=>{if(at+4>bytes.length)return -1;const n=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(at,true)-0x08000000;return n>=0&&n<bytes.length?n:-1;};
 const game={...p.game,speciesNames:ptr(0x144),moveNames:ptr(0x148),baseStats:ptr(0x1bc),abilityNames:ptr(0x1c0),items:ptr(0x1c8),moves:ptr(0x1cc),speciesAbilities:ptr(0x1d8)};
 if([game.speciesNames,game.moveNames,game.baseStats,game.abilityNames,game.items,game.moves,game.speciesAbilities].some(n=>n<0))return null;
 const sprites={...p.sprites,namesAddress:ptr(0x144),front:ptr(0x128),back:ptr(0x12c),normal:ptr(0x130),shiny:ptr(0x134),icons:ptr(0x138),iconIndices:ptr(0x13c),iconPals:ptr(0x140)};
 const profile={...p,game,sprites};ENGINE_SAVE_PROFILES[hash]=profile;return profile;
}
