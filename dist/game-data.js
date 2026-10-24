import{patchNativeItems}from'./rom-items.js';
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ../../sites/pokewebkit-mobile/src/app/mobile/rom-profile.ts
function discoverProfile(bytes, maps, progress = () => {
}) {
  return __async(this, null, function* () {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size = bytes.length;
    const u16 = (o) => o >= 0 && o + 2 <= size ? v.getUint16(o, true) : 0;
    const u32 = (o) => o >= 0 && o + 4 <= size ? v.getUint32(o, true) : 0;
    const ptr = (o) => {
      if (o < 0 || o + 4 > size)
        return -1;
      const p = u32(o) - 134217728;
      return p >= 0 && p < size ? p : -1;
    };
    const lz = (o) => o >= 0 && o + 4 <= size && bytes[o] === 16 ? u32(o) >>> 8 : -1;
    const ascii = (text) => Array.from(text).map((c) => c === " " ? 0 : c >= "A" && c <= "Z" ? c.charCodeAt(0) - 65 + 187 : c >= "a" && c <= "z" ? c.charCodeAt(0) - 97 + 213 : 172);
    const find = (needle) => {
      outer:
        for (let at = 0; at <= size - needle.length; at++) {
          if (bytes[at] !== needle[0])
            continue;
          for (let i = 1; i < needle.length; i++)
            if (bytes[at + i] !== needle[i])
              continue outer;
          return at;
        }
      return -1;
    };
    const profile = { PROFILE_NAME: "Discovered FireRed tables", VERIFIED_TOOLS: { world: true }, MAP_LAYOUTS_ADDRESS: -1, MAP_LAYOUTS_REFS: [] };
    progress("Checking Pok\xE9mon and item tables\u2026");
    const names = ptr(324), moves = ptr(328), stats = ptr(444), abilities = ptr(448), items = ptr(456);
    const monCount = (moves - names) / 11;
    let monsterValid = Number.isInteger(monCount) && monCount >= 387 && monCount <= 1024 && stats > 0 && stats + monCount * 28 <= size && abilities > 0;
    for (let i = 0; monsterValid && i < monCount; i++) {
      const at = stats + i * 28;
      monsterValid = bytes[at + 6] <= 17 && bytes[at + 7] <= 17 && bytes[at + 22] < 78 && bytes[at + 23] < 78 && bytes.slice(names + i * 11, names + i * 11 + 11).includes(255);
      if (ptr(ptr(296) + i * 8) < 0 || ptr(ptr(300) + i * 8) < 0 || ptr(ptr(304) + i * 8) < 0 || ptr(ptr(308) + i * 8) < 0)
        monsterValid = false;
    }
    if (monsterValid) {
      const icons = ptr(312), indices = ptr(316), paletteTable = ptr(320), paletteAddresses = [];
      let iconValid = icons > 0 && indices > 0 && paletteTable > 0;
      for (let i = 0; i < monCount; i++)
        if (ptr(icons + i * 4) < 0 || bytes[indices + i] > 15)
          iconValid = false;
      const paletteCount = Math.max(...bytes.slice(indices, indices + monCount)) + 1;
      for (let i = 0; i < paletteCount; i++) {
        const p = ptr(paletteTable + i * 8);
        if (p < 0 || p + 32 > size)
          iconValid = false;
        paletteAddresses.push(p);
      }
      if (iconValid)
        Object.assign(profile, { MONSTER_COUNT: monCount, MONSTER_NAMES_ADDRESS: 324, MOVE_NAMES_ADDRESS: 328, MOVE_COUNT: 355, MONSTER_BASE_STATS_ADDRESS: 444, ABILITY_NAMES_ADDRESS: abilities, ABILITY_COUNT: 78, MONSTER_FRONT_PIXEL_ADDRESS: 296, MONSTER_BACK_PIXEL_ADDRESS: 300, MONSTER_NORMAL_PALETTE_ADDRESS: 304, MONSTER_SHINY_PALETTE_ADDRESS: 308, MONSTER_ICON_PIXEL_ADDRESS: icons, MONSTER_ICON_PALETTE_ADDRESS: indices, MONSTER_ICON_PALETTE_ADDRESSES: paletteAddresses, MONSTER_ICON_PALETTE_COUNT: paletteCount });
      monsterValid = iconValid;
    }
    let itemCount = 0;
    if (items > 0)
      for (; itemCount < 1024; itemCount++) {
        const at = items + itemCount * 44;
        if (at + 44 > size || u16(at + 14) !== itemCount && !(u16(at + 14) === 0 && bytes[at] === 172 && bytes[at + 1] === 172) || bytes[at + 26] > 5 || !bytes.slice(at, at + 14).includes(255) || ptr(at + 20) < 0)
          break;
      }
    const encounterRows = /* @__PURE__ */ new Map();
    const encounterRow = (at) => {
      if (encounterRows.has(at))
        return encounterRows.get(at);
      if (at < 0 || at + 20 > size || !maps.byKey(bytes[at] + "." + bytes[at + 1]))
        return false;
      let groups = 0;
      for (let kind = 0; kind < 4; kind++) {
        const raw = u32(at + 4 + kind * 4);
        if (raw === 0)
          continue;
        const info = ptr(at + 4 + kind * 4), count = [12, 5, 5, 10][kind];
        if (info < 0 || info + 8 > size || bytes[info] > 100 || bytes[info + 1] > 1)
          return false;
        const mons = ptr(info + 4);
        if (mons < 0)
          return false;
        const starts = bytes[info + 1] === 1 ? [0, 1, 2, 3].map((i) => ptr(mons + i * 4)) : [mons];
        for (const start of starts) {
          if (start < 0 || start + count * 4 > size)
            return false;
          for (let i = 0; i < count; i++) {
            const p = start + i * 4;
            if (bytes[p] < 1 || bytes[p] > 100 || bytes[p + 1] < bytes[p] || bytes[p + 1] > 100 || u16(p + 2) < 1 || u16(p + 2) >= monCount)
              return false;
          }
        }
        groups++;
      }
      const valid = groups > 0;
      encounterRows.set(at, valid);
      return valid;
    };
    const encounterTables = [];
    const itemIconCandidates = [], trainerPicCandidates = [], trainerPaletteCandidates = [], trainerCandidates = [], battleCandidates = [];
    const trainerRow = (at, none = false) => {
      if (at < 0 || at + 40 > size || bytes[at] > 3 || bytes[at + 1] > 106 || bytes[at + 3] > 147 || !bytes.slice(at + 4, at + 16).includes(255) || bytes[at + 32] > 6)
        return false;
      const count = bytes[at + 32], party = ptr(at + 36), stride = bytes[at] & 1 ? 16 : 8;
      if (count === 0)
        return none && u32(at + 36) === 0;
      if (party < 0 || party + count * stride > size)
        return false;
      for (let i = 0; i < count; i++) {
        const at2 = party + i * stride;
        if (u16(at2 + 2) < 1 || u16(at2 + 2) > 100 || u16(at2 + 4) >= monCount)
          return false;
      }
      return true;
    };
    for (let block = 0; block < size; block += 1048576) {
      progress("Verifying relocated graphics and trainer tables\u2026");
      for (let at = block; at < Math.min(block + 1048576, size - 48); at += 4) {
        const p = ptr(at), length = lz(p);
        if (bytes[at] < maps.bankCount && bytes[at + 2] === 0 && bytes[at + 3] === 0 && encounterRow(at) && !encounterRow(at - 20)) {
          let count = 0;
          while (count < 512 && encounterRow(at + count * 20))
            count++;
          if (count >= 10 && bytes[at + count * 20] === 255 && bytes[at + count * 20 + 1] === 255)
            encounterTables.push({ address: at, count });
        }
        if (length === 288 && lz(ptr(at + 4)) === 32 && lz(ptr(at + 8)) === 288 && lz(ptr(at + 12)) === 32) {
          if (at < 8 || lz(ptr(at - 8)) !== 288 || lz(ptr(at - 4)) !== 32)
            itemIconCandidates.push(at);
        }
        if (length === 2048 && (u32(at + 4) & 4294901760) === 0 && u32(at + 12) >>> 16 === 1)
          trainerPicCandidates.push(at);
        if (length === 32 && u32(at + 4) === 0 && u32(at + 12) === 1)
          trainerPaletteCandidates.push(at);
        if (bytes[at] === 0 && u32(at) === 0 && bytes[at + 4] === 255 && u32(at + 32) === 0 && u32(at + 36) === 0 && trainerRow(at + 40) && trainerRow(at + 80)) {
          let count = 1;
          while (count < 2048 && trainerRow(at + count * 40))
            count++;
          if (count > 100)
            trainerCandidates.push({ address: at, count });
        }
        if (length > 0 && lz(ptr(at + 16)) === 96 && lz(ptr(at + 36)) === 96 && [4, 8, 12, 20, 24, 28, 32].every((n) => lz(ptr(at + n)) > 0)) {
          if (at >= 20 && lz(ptr(at - 4)) === 96 && [0, 4, 8, 12].every((n) => lz(ptr(at - 20 + n)) > 0))
            continue;
          let count = 0;
          while (count < 40 && at + count * 20 + 20 < size && [0, 4, 8, 12].every((n) => lz(ptr(at + count * 20 + n)) > 0) && lz(ptr(at + count * 20 + 16)) === 96)
            count++;
          if (count >= 10)
            battleCandidates.push({ address: at, count });
        }
      }
      yield new Promise((r) => setTimeout(r, 0));
    }
    const iconTable = itemIconCandidates.filter((at) => {
      for (let i = 0; i < itemCount; i++)
        if (lz(ptr(at + i * 8)) !== 288 || lz(ptr(at + i * 8 + 4)) !== 32)
          return false;
      return itemCount >= 300;
    });
    if (iconTable.length === 1) {
      Object.assign(profile, { ITEM_COUNT: itemCount, ITEM_DATA_ADDRESS: items, ITEM_BITMAPS_ADDRESS: iconTable[0] });
      profile.VERIFIED_TOOLS.items = true;
    }
    if (monsterValid && profile.VERIFIED_TOOLS.items)
      profile.VERIFIED_TOOLS.monsters = true;
    const classNeedle = [83, 84, 0, ...ascii("TRAINER"), 255, 0, 0], classNames = find([...classNeedle, ...classNeedle]);
    const pals = trainerPaletteCandidates.filter((at) => ![ptr(304), ptr(308)].includes(at) && Array.from({ length: 148 }, (_, i) => i).every((i) => lz(ptr(at + i * 8)) === 32 && u32(at + i * 8 + 4) === i));
    const pics = trainerPicCandidates.filter((at) => ![ptr(296), ptr(300)].includes(at) && Array.from({ length: 148 }, (_, i) => i).every((i) => lz(ptr(at + i * 8)) === 2048 && u32(at + i * 8 + 4) >>> 16 === i && [2048, 4096].includes(u16(at + i * 8 + 4))));
    if (trainerCandidates.length === 1 && pals.length === 1 && pics.length === 1 && classNames >= 0 && profile.VERIFIED_TOOLS.monsters) {
      const t = trainerCandidates[0];
      Object.assign(profile, { TRAINER_COUNT: t.count, TRAINER_DATA_ADDRESS: t.address, TRAINER_BITMAPS_ADDRESS: pics[0], TRAINER_PALETTES_ADDRESS: pals[0], TRAINER_SPRITE_COUNT: 148, TRAINER_CLASS_NAMES_DIRECT: classNames, TRAINER_CLASS_COUNT: 107 });
      profile.VERIFIED_TOOLS.trainers = true;
    }
    if (battleCandidates.length === 1) {
      Object.assign(profile, { BATTLE_BACKGROUNDS_ADDRESS: battleCandidates[0].address, BATTLE_BACKGROUNDS_COUNT: battleCandidates[0].count });
      profile.VERIFIED_TOOLS.battles = true;
    }
    if (encounterTables.length === 1 && profile.VERIFIED_TOOLS.monsters) {
      profile.MAP_ENCOUNTER_TABLE_DIRECT = encounterTables[0].address;
      profile.VERIFIED_TOOLS.encounters = true;
    }
    const byId = /* @__PURE__ */ new Map();
    for (const map of maps.maps) {
      const id = u16(map.address + 18);
      if (id)
        byId.set(id, map.layout.address);
    }
    const first = [...byId.entries()].sort((a, b) => a[0] - b[0])[0], layoutTables = [];
    if (first) {
      for (let at = 0; at < size - 4; at += 4)
        if (ptr(at) === first[1]) {
          const start = at - (first[0] - 1) * 4;
          if (start < 0)
            continue;
          if ([...byId].every(([id, address]) => ptr(start + (id - 1) * 4) === address))
            layoutTables.push(start);
        }
    }
    if (layoutTables.length === 1) {
      profile.MAP_LAYOUTS_ADDRESS = layoutTables[0];
      profile.MAP_LAYOUTS_COUNT = Math.max(...byId.keys());
      for (let at = 0; at < size - 4; at += 4)
        if (ptr(at) === layoutTables[0])
          profile.MAP_LAYOUTS_REFS.push(at);
    }
    profile.PROFILE_NAME = "Discovered native data tables";
    return profile;
  });
}

// ../../sites/pokewebkit-mobile/src/app/mobile/rom-reader.ts
var SPECIAL = { 0: " ", 1: "\xC0", 2: "\xC1", 3: "\xC2", 4: "\xC7", 5: "\xC8", 6: "\xC9", 7: "\xCA", 8: "\xCB", 9: "\xCC", 11: "\xCE", 12: "\xCF", 13: "\xD2", 14: "\xD3", 15: "\xD4", 16: "\u0152", 17: "\xD9", 18: "\xDA", 19: "\xDB", 20: "\xD1", 21: "\xDF", 22: "\xE0", 23: "\xE1", 25: "\xE7", 26: "\xE8", 27: "\xE9", 28: "\xEA", 29: "\xEB", 30: "\xEC", 32: "\xEE", 33: "\xEF", 34: "\xF2", 35: "\xF3", 36: "\xF4", 37: "\u0153", 38: "\xF9", 39: "\xFA", 40: "\xFB", 41: "\xF1", 45: "&", 46: "+", 81: "\xBF", 82: "\xA1", 90: "\xCD", 91: "%", 92: "(", 93: ")", 104: "\xE2", 111: "\xED", 171: "!", 172: "?", 173: ".", 174: "-", 175: "\xB7", 176: "\u2026", 177: "\u201C", 178: "\u201D", 179: "\u2018", 180: "\u2019", 181: "\u2642", 182: "\u2640", 183: "$", 184: ",", 185: "\xD7", 186: "/", 239: "\u25B6", 240: ":", 241: "\xC4", 242: "\xD6", 243: "\xDC", 244: "\xE4", 245: "\xF6", 246: "\xFC" };
function decodeText(bytes, start, limit = 100) {
  let out = "";
  for (let i = start; i < Math.min(bytes.length, start + limit); i++) {
    const c = bytes[i];
    if (c === 255)
      return out.trim();
    if (c >= 187 && c <= 212)
      out += String.fromCharCode(65 + c - 187);
    else if (c >= 213 && c <= 238)
      out += String.fromCharCode(97 + c - 213);
    else if (c >= 161 && c <= 170)
      out += String(c - 161);
    else if (SPECIAL[c] !== void 0)
      out += SPECIAL[c];
    else
      return null;
  }
  return null;
}

// game-data-research/game-data-candidate.ts
const trustedGameProfiles=new WeakMap();
var TYPE_NAMES = ["Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "???", "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"];
var EVOLUTION_METHODS = ["None", "Friendship", "Friendship (day)", "Friendship (night)", "Level", "Trade", "Trade holding item", "Use item", "Level: Attack > Defense", "Level: Attack = Defense", "Level: Attack < Defense", "Level: Silcoon personality", "Level: Cascoon personality", "Level: Ninjask", "Level: Shedinja", "Beauty"];
var ENCOUNTER_KINDS = [{ id: "land", name: "Grass / cave", count: 12, weights: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1] }, { id: "water", name: "Surfing", count: 5, weights: [60, 30, 5, 4, 1] }, { id: "rock", name: "Rock Smash", count: 5, weights: [60, 30, 5, 4, 1] }, { id: "fishing", name: "Fishing", count: 10, weights: [70, 30, 60, 20, 20, 40, 40, 15, 4, 1] }];
var BASE = 134217728;
var owns = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
var get = (bytes) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { b, v, ptr: (a) => {
    if (a < 0 || a + 4 > b.length)
      return -1;
    const p = v.getUint32(a, true) - BASE;
    return p >= 0 && p < b.length ? p : -1;
  } };
};
var integer = (n, min, max, label) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(label + " must be a whole number from " + min + " to " + max + ".");
  return n;
};
function fixedName(bytes, at, n) {
  let s = "";
  for (let i = at; i < Math.min(bytes.length, at + n); i++) {
    const c = bytes[i];
    if (c === 255)
      return s.trim();
    const extra = { 42: "\xBA", 43: "\xAA", 52: "Lv", 53: "=", 54: ";", 83: "PK", 84: "MN", 85: "PO", 86: "K\xE9", 87: "BL", 88: "OC", 89: "K", 121: "\u2191", 122: "\u2193", 123: "\u2190", 124: "\u2192", 133: "<", 134: ">" };
    if (extra[c] !== void 0) {
      s += extra[c];
      continue;
    }
    const one = decodeText(Uint8Array.of(c, 255), 0, 2);
    if (one === null)
      throw Error("Unsupported native name glyph " + c + " at " + i);
    s += c === 0 ? " " : one;
  }
  throw Error("Unterminated native name at " + at);
}
function refsTo(bytes, address) {
  const { v } = get(bytes), a = [];
  for (let i = 0; i + 4 <= bytes.length; i += 4)
    if (v.getUint32(i, true) === BASE + address)
      a.push(i);
  return a;
}
function findAll(bytes, needle, alignment = 1) {
  const a = [];
  outer:
    for (let i = 0; i + needle.length <= bytes.length; i += alignment) {
      if (bytes[i] !== needle[0])
        continue;
      for (let j = 1; j < needle.length; j++)
        if (bytes[i + j] !== needle[j])
          continue outer;
      a.push(i);
    }
  return a;
}
var u16data = (list) => {
  const b = new Uint8Array(list.length * 2), v = new DataView(b.buffer);
  list.forEach((n, i) => v.setUint16(i * 2, n, true));
  return b;
};
function readLearnset(bytes, at, moveCount) {
  const { v } = get(bytes), entries = [];
  let prev = 0;
  for (let i = 0; i < 128; i++) {
    if (at < 0 || at + i * 2 + 2 > bytes.length)
      throw Error("Learnset lies outside ROM.");
    const word = v.getUint16(at + i * 2, true);
    if (word === 65535)
      return entries;
    const level = word >>> 9, move = word & 511;
    if (level < 1 || level > 100 || level < prev || move < 1 || move >= moveCount)
      throw Error("Unsupported native learnset.");
    entries.push({ level, move });
    prev = level;
  }
  throw Error("Learnset has no terminator.");
}
function discoverLearnsets(b, count, moves) {
  const { v, ptr } = get(b), needle = u16data([[1, 33], [4, 45], [7, 73], [10, 22], [15, 77], [15, 79], [20, 75], [25, 230]].map(([l, m]) => l << 9 | m)), candidates = [];
  for (const list of findAll(b, needle, 2)) {
    const p = new Uint8Array(8), pv = new DataView(p.buffer);
    pv.setUint32(0, BASE + list, true);
    pv.setUint32(4, BASE + list, true);
    for (const table of findAll(b, p, 4)) {
      try {
        for (let id = 0; id < count; id++)
          readLearnset(b, ptr(table + id * 4), moves);
        candidates.push(table);
      } catch {
      }
    }
  }
  const unique = [...new Set(candidates)];
  if (unique.length !== 1)
    throw Error("Level-up table is ambiguous.");
  return unique[0];
}
function discoverEvolutions(b, count) {
  const { v } = get(b), sig = new Uint8Array(120), sv = new DataView(sig.buffer);
  sv.setUint16(40, 4, true);
  sv.setUint16(42, 16, true);
  sv.setUint16(44, 2, true);
  sv.setUint16(80, 4, true);
  sv.setUint16(82, 32, true);
  sv.setUint16(84, 3, true);
  const candidates = [];
  for (const table of findAll(b, sig, 4)) {
    let valid = true;
    for (let i = 0; i < count * 5; i++) {
      const a = table + i * 8;
      if (a + 8 > b.length) {
        valid = false;
        break;
      }
      const method = v.getUint16(a, true), param = v.getUint16(a + 2, true), species = v.getUint16(a + 4, true);
      if (method > 15 || species >= count || !method && (param || species) || method && !species) {
        valid = false;
        break;
      }
    }
    if (valid)
      candidates.push(table);
  }
  if (candidates.length !== 1)
    throw Error("Evolution table is ambiguous.");
  return candidates[0];
}
async function discoverGameData(reader, { sourceSha256, progress = () => {
} } = {}) {
  const b = reader.bytes || reader;
  let sha = sourceSha256;
  if (!sha) {
    const digest = await crypto.subtle.digest("SHA-256", b);
    sha = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
  }
  const c = await discoverProfile(b, reader, progress),{ptr}=get(b);
  const caps={species:!!c.VERIFIED_TOOLS.monsters,moves:!!c.VERIFIED_TOOLS.monsters,items:!!c.VERIFIED_TOOLS.items,trainers:!!c.VERIFIED_TOOLS.trainers,encounters:!!c.VERIFIED_TOOLS.encounters};
  if(!Object.values(caps).some(Boolean))return null;
  const p={version:2,sourceSha256:sha,capabilities:caps,speciesCount:c.MONSTER_COUNT||0,moveCount:c.MOVE_COUNT||0,itemCount:c.ITEM_COUNT||0,abilityCount:c.ABILITY_COUNT||0,trainerCount:c.TRAINER_COUNT||0,trainerClassCount:c.TRAINER_CLASS_COUNT||0,speciesNames:ptr(324),moveNames:ptr(328),baseStats:ptr(444),abilityNames:ptr(448),items:ptr(456),moves:ptr(460),trainers:c.TRAINER_DATA_ADDRESS,trainerClasses:c.TRAINER_CLASS_NAMES_DIRECT,wild:c.MAP_ENCOUNTER_TABLE_DIRECT,itemIcons:c.ITEM_BITMAPS_ADDRESS,learnsets:null,evolutions:null,wildCount:0};
  if(caps.species){try{p.learnsets=discoverLearnsets(b,p.speciesCount,p.moveCount);}catch{}try{p.evolutions=discoverEvolutions(b,p.speciesCount);}catch{}for(let id=0;id<p.speciesCount;id++)fixedName(b,p.speciesNames+id*11,11);for(let id=0;id<p.abilityCount;id++)fixedName(b,p.abilityNames+id*13,13);}
  if(caps.moves)for(let id=0;id<p.moveCount;id++){const at=p.moves+id*12;if(at<0||at+12>b.length||b[at+2]>17||b[at+3]>100||b[at+5]>100){caps.moves=false;break;}fixedName(b,p.moveNames+id*13,13);}
  if(caps.encounters){while(p.wildCount<512){const at=p.wild+p.wildCount*20;if(b[at]===255&&b[at+1]===255)break;p.wildCount++;}p.wildRefs=refsTo(b,p.wild);if(p.wildCount===512||!p.wildRefs.length)caps.encounters=false;}
  trustedGameProfiles.set(p,b);return p;
}

function readSpecies(bytes, p, id) {
  integer(id, 0, p.speciesCount - 1, "Species");
  const { b, v, ptr } = get(bytes), a = p.baseStats + id * 28, effort = v.getUint16(a + 10, true), evolutions = [];
  for (let j = 0; p.evolutions!==null && j < 5; j++) {
    const at = p.evolutions + (id * 5 + j) * 8, method = v.getUint16(at, true);
    if (method)
      evolutions.push({ method, param: v.getUint16(at + 2, true), species: v.getUint16(at + 4, true) });
  }
  return { id, name: fixedName(b, p.speciesNames + id * 11, 11), stats: Array.from(b.slice(a, a + 6)), types: [b[a + 6], b[a + 7]], catchRate: b[a + 8], baseExp: b[a + 9], evYield: Array.from({ length: 6 }, (_, i) => effort >>> i * 2 & 3), items: [v.getUint16(a + 12, true), v.getUint16(a + 14, true)], genderRatio: b[a + 16], eggCycles: b[a + 17], friendship: b[a + 18], growthRate: b[a + 19], eggGroups: [b[a + 20], b[a + 21]], abilities: [b[a + 22], b[a + 23]], learnset: p.learnsets===null?[]:readLearnset(b, ptr(p.learnsets + id * 4), p.moveCount), evolutions };
}
function readMove(bytes, p, id) {
  integer(id, 0, p.moveCount - 1, "Move");
  const { b } = get(bytes), a = p.moves + id * 12;
  return { id, name: fixedName(b, p.moveNames + id * 13, 13), effect: b[a], power: b[a + 1], type: b[a + 2], accuracy: b[a + 3], pp: b[a + 4], secondaryChance: b[a + 5], target: b[a + 6], priority: b[a + 7] << 24 >> 24, flags: b[a + 8] };
}
function readItem(bytes, p, id) {
  integer(id, 0, p.itemCount - 1, "Item");
  const { b, v, ptr } = get(bytes), a = p.items + id * 44;
  return { id, name: fixedName(b, a, 14), price: v.getUint16(a + 16, true), holdEffect: b[a + 18], holdEffectParam: b[a + 19], descriptionAddress: ptr(a + 20), pocket: b[a + 26], type: b[a + 27] };
}
function readTrainer(bytes, p, id) {
  integer(id, 0, p.trainerCount - 1, "Trainer");
  const { b, v, ptr } = get(bytes), a = p.trainers + id * 40, flags = b[a], customMoves = !!(flags & 1), heldItems = !!(flags & 2), count = b[a + 32], start = ptr(a + 36), stride = customMoves ? 16 : 8, party = [];
  for (let j = 0; j < count; j++) {
    const at = start + j * stride;
    party.push({ ivQuality: v.getUint16(at, true), level: b[at + 2], species: v.getUint16(at + 4, true), heldItem: heldItems ? v.getUint16(at + 6, true) : 0, moves: customMoves ? Array.from({ length: 4 }, (_, i) => v.getUint16(at + (heldItems ? 8 : 6) + i * 2, true)) : [] });
  }
  return { id, name: fixedName(b, a + 4, 12), trainerClass: b[a + 1], sprite: b[a + 3], genderMusic: b[a + 2], customMoves, heldItems, doubleBattle: !!b[a + 24], ai: v.getUint32(a + 28, true), items: Array.from({ length: 4 }, (_, i) => v.getUint16(a + 16 + i * 2, true)), party };
}
function readEncounters(bytes, p) {
  const { b, v, ptr } = get(bytes), rows = [];
  for (let i = 0; i < p.wildCount; i++) {
    const a = p.wild + i * 20, groups = {};
    for (let j = 0; j < 4; j++) {
      const kind = ENCOUNTER_KINDS[j], info = ptr(a + 4 + j * 4);
      if (info < 0)
        continue;
      if (b[info + 1] !== 0)
        throw Error("Time-of-day encounter tables need a separate adapter.");
      const start = ptr(info + 4);
      groups[kind.id] = { rate: b[info], slots: Array.from({ length: kind.count }, (_, n) => ({ minLevel: b[start + n * 4], maxLevel: b[start + n * 4 + 1], species: v.getUint16(start + n * 4 + 2, true) })) };
    }
    rows.push({ key: b[a] + "." + b[a + 1], bank: b[a], map: b[a + 1], groups });
  }
  return rows;
}
function readGameData(bytes, p) {
  return { species: Array.from({ length: p.capabilities?.species===false?0:p.speciesCount }, (_, i) => readSpecies(bytes, p, i)), moves: Array.from({ length: p.capabilities?.moves===false?0:p.moveCount }, (_, i) => readMove(bytes, p, i)), items: Array.from({ length: p.capabilities?.items===false?0:p.itemCount }, (_, i) => readItem(bytes, p, i)), abilities: Array.from({ length: p.abilityCount }, (_, i) => fixedName(bytes, p.abilityNames + i * 13, 13)), trainerClasses: Array.from({ length: p.trainerClassCount }, (_, i) => fixedName(bytes, p.trainerClasses + i * 13, 13)), trainers: Array.from({ length: p.trainerCount }, (_, i) => readTrainer(bytes, p, i)), encounters: p.capabilities?.encounters===false?[]:readEncounters(bytes, p) };
}
function record(source, at, length) {
  return source.slice(at, at + length);
}
function writeName(b, offset, length, text) {
  const a = [];
  for (const c of String(text)) {
    let n;
    if (c === " ")
      n = 0;
    else if (c >= "A" && c <= "Z")
      n = c.charCodeAt(0) - 65 + 187;
    else if (c >= "a" && c <= "z")
      n = c.charCodeAt(0) - 97 + 213;
    else if (c >= "0" && c <= "9")
      n = c.charCodeAt(0) - 48 + 161;
    else
      n = { ".": 173, "-": 174, "!": 171, "?": 172, "'": 180, "\u2640": 182, "\u2642": 181, ":": 240, "/": 186 }[c];
    if (n === void 0)
      throw Error("This native name uses an unsupported character: " + c);
    a.push(n);
  }
  if (a.length >= length)
    throw Error("Name must fit in " + (length - 1) + " characters.");
  b.fill(255, offset, offset + length);
  b.set(a, offset);
}
function patchFields(b, patch, fields) {
  for (const [k, off, width, min, max] of fields)
    if (owns(patch, k)) {
      const n = integer(patch[k], min, max, k), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (width === 1)
        b[off] = n & 255;
      else if (width === 2)
        v.setUint16(off, n, true);
      else
        v.setUint32(off, n, true);
    }
}
function applyGameDataEdits(source, p, edits, output) {
  if (!edits)
    return [];
  if(p.itemTable){if(['species','moves','trainers','encounters'].some(k=>Object.keys(edits[k]||{}).length))throw Error('Only the verified item table is editable for this layout.');return patchNativeItems(source,p.itemTable,edits.items,output,text=>{const b=new Uint8Array(14).fill(255);writeName(b,0,14,text);return b.slice(0,b.indexOf(255)+1);});}
  if(trustedGameProfiles.get(p)!==source)throw Error('Discover game tables from the opened ROM before writing.');
  for(const key of ['species','moves','items','trainers','encounters'])if(Object.keys(edits[key]||{}).length&&p.capabilities?.[key]===false)throw Error('The '+key+' table format is not supported in this ROM.');
  const report = [];
  for (const [idText, patch] of Object.entries(edits.species || {})) {
    const id = integer(Number(idText), 1, p.speciesCount - 1, "Species"), at = p.baseStats + id * 28, b = record(source, at, 28), v = new DataView(b.buffer);
    if (patch.name !== void 0) {
      const n = record(source, p.speciesNames + id * 11, 11);
      writeName(n, 0, 11, patch.name);
      output.write(p.speciesNames + id * 11, n);
    }
    if (patch.stats) {
      if (patch.stats.length !== 6)
        throw Error("Six base stats are required.");
      patch.stats.forEach((n, i) => b[i] = integer(n, 1, 255, "Base stat"));
    }
    for (const [k, off, max] of [["types", 6, 17], ["abilities", 22, p.abilityCount - 1], ["eggGroups", 20, 15]])
      if (patch[k]) {
        if (patch[k].length !== 2)
          throw Error(k + " needs two values.");
        patch[k].forEach((n, i) => b[off + i] = integer(n, 0, max, k));
      }
    patchFields(b, patch, [["catchRate", 8, 1, 0, 255], ["baseExp", 9, 1, 0, 255], ["genderRatio", 16, 1, 0, 255], ["eggCycles", 17, 1, 1, 255], ["friendship", 18, 1, 0, 255], ["growthRate", 19, 1, 0, 5]]);
    if (patch.evYield) {
      if (patch.evYield.length !== 6)
        throw Error("Six EV yields are required.");
      let n = v.getUint16(10, true) & 61440;
      patch.evYield.forEach((x, i) => n |= integer(x, 0, 3, "EV yield") << i * 2);
      v.setUint16(10, n, true);
    }
    if (patch.items) {
      if (patch.items.length !== 2)
        throw Error("Two held-item values are required.");
      patch.items.forEach((n, i) => v.setUint16(12 + i * 2, integer(n, 0, p.itemCount - 1, "Held item"), true));
    }
    output.write(at, b);
    if (patch.learnset) {
      if(p.learnsets===null)throw Error('The level-up table format is not supported in this ROM.');
      if (!Array.isArray(patch.learnset) || patch.learnset.length > 127)
        throw Error("Keep the learnset within127 entries.");
      let prev = 0;
      const words = patch.learnset.map((e) => {
        const level = integer(e.level, 1, 100, "Learn level"), move = integer(e.move, 1, p.moveCount - 1, "Learn move");
        if (level < prev)
          throw Error("Learnset must be ordered by level.");
        prev = level;
        return level << 9 | move;
      });
      words.push(65535);
      const a = output.allocate(u16data(words), "Level-up learnset"), d = new Uint8Array(4);
      new DataView(d.buffer).setUint32(0, BASE + a, true);
      output.write(p.learnsets + id * 4, d);
    }
    if (patch.evolutions) {
      if(p.evolutions===null)throw Error('The evolution table format is not supported in this ROM.');
      if (!Array.isArray(patch.evolutions) || patch.evolutions.length > 5)
        throw Error("At most five evolutions fit the native format.");
      const d = new Uint8Array(40), dv = new DataView(d.buffer);
      patch.evolutions.forEach((e, i) => {
        const method = integer(e.method, 1, 15, "Evolution method"), param = integer(e.param, 0, 65535, "Evolution parameter"), target = integer(e.species, 1, p.speciesCount - 1, "Evolution species");
        if ([4, 8, 9, 10, 11, 12, 13, 14].includes(method))
          integer(param, 1, 100, "Evolution level");
        if ([6, 7].includes(method))
          integer(param, 1, p.itemCount - 1, "Evolution item");
        dv.setUint16(i * 8, method, true);
        dv.setUint16(i * 8 + 2, param, true);
        dv.setUint16(i * 8 + 4, target, true);
      });
      output.write(p.evolutions + id * 40, d);
    }
    report.push("Species " + id);
  }
  for (const [idText, patch] of Object.entries(edits.moves || {})) {
    const id = integer(Number(idText), 1, p.moveCount - 1, "Move"), at = p.moves + id * 12, b = record(source, at, 12);
    patchFields(b, patch, [["effect", 0, 1, 0, 213], ["power", 1, 1, 0, 255], ["type", 2, 1, 0, 17], ["accuracy", 3, 1, 0, 100], ["pp", 4, 1, 1, 255], ["secondaryChance", 5, 1, 0, 100], ["target", 6, 1, 0, 255], ["priority", 7, 1, -7, 7], ["flags", 8, 1, 0, 255]]);
    if (patch.name !== void 0) {
      const n = record(source, p.moveNames + id * 13, 13);
      writeName(n, 0, 13, patch.name);
      output.write(p.moveNames + id * 13, n);
    }
    output.write(at, b);
    report.push("Move " + id);
  }
  for (const [idText, patch] of Object.entries(edits.items || {})) {
    const id = integer(Number(idText), 1, p.itemCount - 1, "Item"), at = p.items + id * 44, b = record(source, at, 44);
    patchFields(b, patch, [["price", 16, 2, 0, 65535], ["holdEffect", 18, 1, 0, 255], ["holdEffectParam", 19, 1, 0, 255]]);
    if (patch.name !== void 0)
      writeName(b, 0, 14, patch.name);
    output.write(at, b);
    report.push("Item " + id);
  }
  for (const [idText, patch] of Object.entries(edits.trainers || {})) {
    const id = integer(Number(idText), 1, p.trainerCount - 1, "Trainer"), old = readTrainer(source, p, id), tr = { ...old, ...patch }, at = p.trainers + id * 40, b = record(source, at, 40), v = new DataView(b.buffer);
    if (patch.name !== void 0)
      writeName(b, 4, 12, patch.name);
    patchFields(b, patch, [["trainerClass", 1, 1, 0, p.trainerClassCount - 1], ["sprite", 3, 1, 0, 147], ["genderMusic", 2, 1, 0, 255], ["ai", 28, 4, 0, 4294967295]]);
    if (patch.doubleBattle !== void 0)
      b[24] = patch.doubleBattle ? 1 : 0;
    if (patch.items) {
      if (patch.items.length !== 4)
        throw Error("A trainer has four bag-item slots.");
      patch.items.forEach((n, i) => v.setUint16(16 + i * 2, integer(n, 0, p.itemCount - 1, "Trainer bag item"), true));
    }
    if (tr.doubleBattle && tr.party.length < 2)
      throw Error("A double battle needs at least two Pok\xE9mon.");
    const needsParty = ["party", "customMoves", "heldItems"].some((k) => owns(patch, k));
    if (needsParty) {
      if (!Array.isArray(tr.party) || tr.party.length < 1 || tr.party.length > 6)
        throw Error("A trainer party needs1\u20136 Pok\xE9mon.");
      if (tr.doubleBattle && tr.party.length < 2)
        throw Error("A double battle needs at least two Pok\xE9mon.");
      const stride = tr.customMoves ? 16 : 8, d = new Uint8Array(stride * tr.party.length), dv = new DataView(d.buffer);
      tr.party.forEach((m, i) => {
        const o = i * stride;
        dv.setUint16(o, integer(m.ivQuality ?? 0, 0, 255, "IV quality"), true);
        d[o + 2] = integer(m.level, 1, 100, "Trainer level");
        dv.setUint16(o + 4, integer(m.species, 1, p.speciesCount - 1, "Trainer Pok\xE9mon"), true);
        if (tr.heldItems)
          dv.setUint16(o + 6, integer(m.heldItem || 0, 0, p.itemCount - 1, "Trainer held item"), true);
        if (tr.customMoves) {
          if (!Array.isArray(m.moves) || m.moves.length !== 4)
            throw Error("Custom moves need four slots, including0 for empty.");
          m.moves.forEach((move, j) => dv.setUint16(o + (tr.heldItems ? 8 : 6) + j * 2, integer(move, 0, p.moveCount - 1, "Trainer move"), true));
        }
      });
      b[0] = (tr.customMoves ? 1 : 0) | (tr.heldItems ? 2 : 0);
      b[32] = tr.party.length;
      v.setUint32(36, BASE + output.allocate(d, "Trainer party"), true);
    }
    output.write(at, b);
    report.push("Trainer " + id);
  }
  if (Object.keys(edits.encounters || {}).length) {
    const rows = Array.from({ length: p.wildCount }, (_, i) => record(source, p.wild + i * 20, 20));
    for (const [key, patch] of Object.entries(edits.encounters)) {
      const parts = key.split(".").map(Number);
      if (parts.length !== 2)
        throw Error("Invalid encounter map key.");
      parts.forEach((n) => integer(n, 0, 127, "Encounter map"));
      let index = rows.findIndex((b) => b[0] === parts[0] && b[1] === parts[1]);
      if (index < 0) {
        index = rows.length;
        rows.push(new Uint8Array(20));
        rows[index][0] = parts[0];
        rows[index][1] = parts[1];
      }
      const row = rows[index], rv = new DataView(row.buffer);
      for (let j = 0; j < 4; j++) {
        const kind = ENCOUNTER_KINDS[j];
        if (!owns(patch, kind.id))
          continue;
        const group = patch[kind.id];
        if (!group) {
          rv.setUint32(4 + j * 4, 0, true);
          continue;
        }
        if (!Array.isArray(group.slots) || group.slots.length !== kind.count)
          throw Error(kind.name + " requires " + kind.count + " slots.");
        const d2 = new Uint8Array(kind.count * 4), dv = new DataView(d2.buffer);
        group.slots.forEach((s, n) => {
          d2[n * 4] = integer(s.minLevel, 1, 100, "Wild minimum level");
          d2[n * 4 + 1] = integer(s.maxLevel, s.minLevel, 100, "Wild maximum level");
          dv.setUint16(n * 4 + 2, integer(s.species, 1, p.speciesCount - 1, "Wild Pok\xE9mon"), true);
        });
        const info = new Uint8Array(8), iv = new DataView(info.buffer);
        info[0] = integer(group.rate, 0, 100, "Encounter rate");
        iv.setUint32(4, BASE + output.allocate(d2, "Wild " + kind.id + " slots"), true);
        rv.setUint32(4 + j * 4, BASE + output.allocate(info, "Wild " + kind.id + " group"), true);
      }
      report.push("Encounters " + key);
    }
    if (rows.length > 511)
      throw Error("Too many encounter-map rows.");
    const d = new Uint8Array((rows.length + 1) * 20);
    rows.forEach((r, i) => d.set(r, i * 20));
    d[rows.length * 20] = 255;
    d[rows.length * 20 + 1] = 255;
    const at = output.allocate(d, "Wild encounter headers"), pv = new DataView(source.buffer, source.byteOffset, source.byteLength);
    for (const ref of p.wildRefs) {
      if (pv.getUint32(ref, true) !== BASE + p.wild)
        throw Error("Encounter table reference changed.");
      const a = new Uint8Array(4);
      new DataView(a.buffer).setUint32(0, BASE + at, true);
      output.write(ref, a);
    }
  }
  return report;
}
export {
  ENCOUNTER_KINDS,
  EVOLUTION_METHODS,
  TYPE_NAMES,
  applyGameDataEdits,
  discoverGameData,
  discoverProfile as discoverLegacyTables,
  readEncounters,
  readGameData,
  readItem,
  readMove,
  readSpecies,
  readTrainer
};

// The runtime builds scene capabilities separately from global-table editing.
export async function discoverSceneData(){return null;}
