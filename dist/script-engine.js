// Reused from the existing PokéWebKit Mobile port; original credits retained in README.
import { SCRIPT_DATA } from "./script-data.js";
const BASE = 134217728;
const ALIASES = { if1: "goto_if", if2: "call_if", loadpointer: "loadword", setbyte: "setmysteryeventstatus", setbyte2: "loadbyte", writebytetooffset: "setptr", loadbytefrompointer: "loadbytefromptr", setfarbyte: "setptrbyte", copyscriptbanks: "copylocal", compare: "compare_var_to_value", comparevars: "compare_var_to_var", callasm: "callnative", special2: "specialvar", pause: "delay", sound: "playse", checksound: "waitse", fanfare: "playfanfare", playsong: "playbgm", playsong2: "savebgm", fadedefault: "fadedefaultbgm", fadesong: "fadenewbgm", fadeout: "fadeoutbgm", fadein: "fadeinbgm", warpmuted: "warpsilent", warpwalk: "warpdoor", warp3: "setwarp", warp4: "setdivewarp", warp5: "setholewarp", countpokemon: "getpartysize", getplayerpos: "getplayerxy", checkitemroom: "checkitemspace", addpcitem: "addpcitem", testdecoration: "checkdecor", checkdecoration: "checkdecorspace", hidesprite: "removeobject", showsprite: "addobject", hidespritepos: "removeobjectat", showspritepos: "addobjectat", movesprite: "setobjectxy", spriteface: "turnobject", movesprite2: "setobjectxyperm", spritebehave: "setobjectmovementtype", preparemsg: "message", preparemsg2: "messageautoscroll", closeonkeypress: "waitmessage", givepokemon: "givemon", bufferpokemon: "bufferspeciesname", bufferfirstpokemon: "bufferleadmonspeciesname", bufferpartypokemon: "bufferpartymonnick", bufferitem: "bufferitemname", bufferattack: "buffermovename", bufferstring: "bufferstring", pokemart2: "pokemartdecoration", pokemart3: "pokemartdecoration2", pokecasino: "playslotmachine", paymoney: "removemoney", setwildbattle: "setwildbattle", dowildbattle: "dowildbattle", setmaptile: "setmetatile", resetweather: "resetweather", doweather: "doweather", setmapfooter: "setmaplayoutindex", sethealingplace: "setrespawn", cry: "playmoncry", waitcry: "waitmoncry", darken: "doflash", lighten: "setflashlevel", doanimation: "dofieldeffect", setanimation: "setfieldeffectargument", checkanimation: "waitfieldeffect", showmoney: "showmoneybox", hidemoney: "hidemoneybox", updatemoney: "updatemoneybox", checkattack: "checkpartymove" };
const CONTROL_ARGS = { 1: 1, 2: 1, 3: 1, 4: 3, 5: 1, 6: 1, 7: 0, 8: 1, 9: 0, 10: 0, 11: 2, 12: 1, 13: 1, 14: 1, 15: 0, 16: 2, 17: 1, 18: 1, 19: 1, 20: 1, 21: 0, 22: 0, 23: 0, 24: 0 };
const textTokens = SCRIPT_DATA.tokens;
const charKeys = Object.keys(SCRIPT_DATA.characters).sort((a, b) => b.length - a.length);
const inverse = /* @__PURE__ */ new Map();
for (const key of charKeys) {
  const value = SCRIPT_DATA.characters[key];
  if (value.length === 1 && !inverse.has(value.join(",")))
    inverse.set(value.join(","), key);
}
for (const [key, value] of Object.entries(textTokens)) {
  if (value.length > 1 && value[0] === 253 && !inverse.has(value.join(",")))
    inverse.set(value.join(","), "{" + key + "}");
}
function lineError(line, message) {
  throw new Error("Line " + line + ": " + message);
}
function expression(text, constants, labels = {}, base = 0, origins = {}, pointer = false) {
  text = text.trim();
  if (Object.prototype.hasOwnProperty.call(labels, text))
    return BASE + base + labels[text];
  if (Object.prototype.hasOwnProperty.call(constants, text))
    return constants[text];
  if (/^[-+]?0x[0-9a-f]+$/i.test(text) || /^[-+]?\d+$/.test(text)) {
    const n = /^-0x/i.test(text) ? -parseInt(text.slice(1), 16) : Number(text);
    const normal = n >= BASE && n < BASE + 33554432 ? n - BASE : n;
    if (Object.prototype.hasOwnProperty.call(origins, normal))
      return BASE + base + origins[normal];
    return pointer && n > 0 && n < 33554432 ? BASE + n : n;
  }
  const sum = text.match(/^(@?[A-Za-z_][\w@]*)\s*([+-])\s*(0x[0-9a-f]+|\d+)$/i);
  if (sum)
    return expression(sum[1], constants, labels, base, origins, pointer) + (sum[2] === "+" ? 1 : -1) * Number(sum[3]);
  throw new Error("Unknown value or label \u201C" + text + "\u201D. Use a number, a listed constant, or #define.");
}
function textEncode(text) {
  const bytes = [];
  for (let i = 0; i < text.length; ) {
    if (text.startsWith("\\x", i)) {
      const hex = text.slice(i + 2, i + 4);
      if (!/^[0-9a-f]{2}$/i.test(hex))
        throw new Error("Use two hex digits after \\x.");
      bytes.push(parseInt(hex, 16));
      i += 4;
      continue;
    }
    if (text[i] === "\\") {
      const c = text[i + 1];
      if (c === "n" || c === "l" || c === "p") {
        bytes.push(c === "n" ? 254 : c === "l" ? 250 : 251);
        i += 2;
        continue;
      }
      if (c === "$") {
        bytes.push(183);
        i += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        bytes.push(c === '"' ? 177 : 180);
        i += 2;
        continue;
      }
    }
    if (text[i] === "{") {
      const close = text.indexOf("}", i);
      if (close < 0)
        throw new Error("A text token is missing \u201C}\u201D.");
      const parts = text.slice(i + 1, close).trim().split(/\s+/), token = textTokens[parts.shift()];
      if (!token)
        throw new Error("Unknown text token.");
      bytes.push(...token);
      for (const p of parts) {
        if (textTokens[p])
          bytes.push(...textTokens[p]);
        else {
          const n = expression(p, SCRIPT_DATA.constants);
          if (n < 0 || n > 255)
            throw new Error("Text token values must fit in one byte.");
          bytes.push(n);
        }
      }
      i = close + 1;
      continue;
    }
    if (text[i] === "\n") {
      bytes.push(254);
      i++;
      continue;
    }
    if (text[i] === '"') {
      bytes.push(177);
      i++;
      continue;
    }
    if (text[i] === "'") {
      bytes.push(180);
      i++;
      continue;
    }
    const key = charKeys.find((k) => text.startsWith(k, i));
    if (!key)
      throw new Error("The game font has no character \u201C" + text[i] + "\u201D.");
    bytes.push(...SCRIPT_DATA.characters[key]);
    i += key.length;
  }
  if (bytes[bytes.length - 1] !== 255)
    bytes.push(255);
  return Uint8Array.from(bytes);
}
function decodeScriptText(bytes, address) {
  let text = "", i = address;
  for (; i < Math.min(address + 8192, bytes.length); i++) {
    const b = bytes[i];
    if (b === 255)
      return { text, length: i - address + 1 };
    if (b === 254) {
      text += "\\n";
      continue;
    }
    if (b === 250) {
      text += "\\l";
      continue;
    }
    if (b === 251) {
      text += "\\p";
      continue;
    }
    if (b === 252) {
      const n = CONTROL_ARGS[bytes[i + 1]];
      if (n === void 0)
        throw new Error("Unknown text control code.");
      for (let j = 0; j < n + 2; j++)
        text += "\\x" + bytes[i + j].toString(16).padStart(2, "0");
      i += n + 1;
      continue;
    }
    if (b === 253) {
      const token = inverse.get(b + "," + bytes[i + 1]);
      if (token) {
        text += token;
        i++;
        continue;
      }
    }
    const c = inverse.get(String(b));
    text += c && c !== "$" ? c : "\\x" + b.toString(16).padStart(2, "0");
  }
  throw new Error("Text has no terminator within the decoding limit.");
}
function paramsFor(command, args) {
  if (command.code !== 92)
    return command.params;
  const counts = { 0: 2, 1: 3, 2: 3, 3: 1, 4: 3, 5: 2, 6: 4, 7: 3, 8: 4, 9: 2 }, n = counts[args[0]];
  if (n === void 0)
    throw new Error("Unsupported trainerbattle type " + args[0] + ".");
  return [...command.params, ...Array.from({ length: n }, (_, i) => ({ name: "pointer" + (i + 1), width: 4 }))];
}
function isPointer(command, index, param) {
  if (param.width !== 4 || [184, 185, 186, 187, 188, 189, 190, 191].includes(command.code))
    return false;
  return /destination|source|ptr|text|msg|movement|func|pointer/i.test(param.name) && !["givemoney", "removemoney", "checkmoney"].includes(command.name) || command.code === 92;
}
function compileScript(source, base = 0, engine = "frlg") {
  if (source.length > 262144)
    throw new Error("Keep one script package under 256 KB of source.");
  const definitions = SCRIPT_DATA[engine] || SCRIPT_DATA.frlg, byName = new Map(definitions.map((c) => [c.name, c]));
  const constants = { ...SCRIPT_DATA.constants }, labels = {}, origins = {}, nodes = [];
  let offset = 0, firstCode = -1, commands = 0;
  const add = (node, length) => {
    node.offset = offset;
    nodes.push(node);
    offset += length;
    if (offset > 1048576)
      throw new Error("Compiled package exceeds 1 MB.");
  };
  const emit = (name, args, line) => {
    if (name === "msgbox") {
      if (args.length < 1 || args.length > 2)
        lineError(line, "msgbox takes a text label and optional message type.");
      emit("loadword", ["0", args[0]], line);
      emit("callstd", [args[1] || "MSG_NORMAL"], line);
      return;
    }
    if (["giveitem", "finditem", "giveitem2"].includes(name)) {
      if (args.length < 1 || args.length > 3)
        lineError(line, "giveitem takes item and quantity.");
      emit("setorcopyvar", ["0x8000", args[0]], line);
      emit("setorcopyvar", ["0x8001", args[1] || "1"], line);
      emit("callstd", [name === "finditem" ? "1" : "0"], line);
      return;
    }
    if (name === "if") {
      if (args.length !== 3 || !["goto", "call"].includes(args[1]))
        lineError(line, "Use: if condition goto @label.");
      emit(args[1] === "goto" ? "goto_if" : "call_if", [args[0], args[2]], line);
      return;
    }
    const original = name;
    name = ALIASES[name] || name;
    const command = byName.get(name);
    if (!command)
      lineError(line, "Unknown command \u201C" + original + "\u201D.");
    let fields;
    try {
      fields = paramsFor(command, command.code === 92 ? [expression(args[0], constants)] : []);
    } catch (error) {
      lineError(line, error.message);
    }
    if (name === "givemon" && args.length === 2)
      args = [...args, "0"];
    const required = fields.reduce((n, p, i) => p.default === void 0 ? i + 1 : n, 0);
    if (args.length < required || args.length > fields.length)
      lineError(line, command.name + " takes " + required + (required !== fields.length ? "\u2013" + fields.length : "") + " values: " + fields.map((p) => p.name).join(", "));
    args = fields.map((p, i) => args[i] === void 0 ? String(p.default) : args[i]);
    if (firstCode < 0)
      firstCode = offset;
    commands++;
    add({ kind: "command", command, fields, args, line, original }, 1 + fields.reduce((n, p) => n + p.width, 0));
  };
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    let text = raw.trim();
    if (!text || text.startsWith("//") || text.startsWith("'"))
      return;
    const define = text.match(/^(?:#define|\.equ)\s+([A-Za-z_]\w*)\s*[,=]?\s+(.+)$/i);
    if (define) {
      try {
        constants[define[1]] = expression(define[2], constants);
      } catch (e) {
        lineError(line, e.message);
      }
      return;
    }
    if (/^#dynamic\b|^\.global\b/i.test(text))
      return;
    const org = text.match(/^#org\s+(.+)$/i);
    if (org) {
      const value = org[1].trim();
      if (/^0x[0-9a-f]+$/i.test(value)) {
        let n = Number(value);
        if (n >= BASE)
          n -= BASE;
        origins[n] = offset;
        labels["org_" + n.toString(16)] = offset;
      } else {
        if (labels[value] !== void 0)
          lineError(line, "Duplicate label.");
        labels[value] = offset;
      }
      return;
    }
    const label = text.match(/^(@?[A-Za-z_][\w@]*):{1,2}(.*)$/);
    if (label) {
      if (labels[label[1]] !== void 0)
        lineError(line, "Duplicate label.");
      labels[label[1]] = offset;
      text = label[2].trim();
      if (!text)
        return;
    }
    if (text.startsWith("=") || /^\.string\s/.test(text)) {
      let value = text.startsWith("=") ? text.slice(1).replace(/^ /, "") : text.replace(/^\.string\s+/, "");
      if (text.startsWith("=") && value.endsWith("$"))
        value = value.slice(0, -1);
      if (/^".*"$/.test(value))
        value = value.slice(1, -1);
      try {
        const bytes2 = textEncode(value);
        add({ kind: "data", bytes: bytes2, line }, bytes2.length);
      } catch (error) {
        lineError(line, error.message);
      }
      return;
    }
    text = text.replace(/\s+\/\/.*$/, "").trim();
    const split = text.match(/^(\S+)(?:\s+(.*))?$/);
    if (!split)
      return;
    const name = split[1].toLowerCase(), args = (split[2] || "").replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
    if ([".byte", "#raw", ".hword", ".2byte", ".word", ".4byte", ".movement"].includes(name)) {
      const width = [".hword", ".2byte"].includes(name) ? 2 : [".word", ".4byte"].includes(name) ? 4 : 1;
      if (!args.length)
        lineError(line, "Provide at least one value.");
      add({ kind: "raw", width, args, line }, width * args.length);
      return;
    }
    if (name === ".align") {
      const alignment = Number(args[0] || 4);
      if (![1, 2, 4, 8, 16].includes(alignment))
        lineError(line, "Alignment must be 1, 2, 4, 8, or 16.");
      const length = (alignment - offset % alignment) % alignment;
      add({ kind: "data", bytes: new Uint8Array(length), line }, length);
      return;
    }
    if (SCRIPT_DATA.movements[name] !== void 0 && !args.length) {
      add({ kind: "data", bytes: Uint8Array.of(SCRIPT_DATA.movements[name]), line }, 1);
      return;
    }
    emit(name, args, line);
  });
  if (firstCode < 0)
    throw new Error("Include at least one event command.");
  const bytes = new Uint8Array(offset), view = new DataView(bytes.buffer);
  const write = (at, width, value, line) => {
    const max = width === 4 ? 4294967295 : 2 ** (width * 8) - 1, min = -(2 ** (width * 8 - 1));
    if (!Number.isInteger(value) || value < min || value > max)
      lineError(line, "Value does not fit in " + width + " byte" + (width === 1 ? "" : "s") + ".");
    if (width === 1)
      view.setUint8(at, value);
    else if (width === 2)
      view.setUint16(at, value, true);
    else
      view.setUint32(at, value, true);
  };
  for (const node of nodes) {
    try {
      if (node.kind === "data") {
        bytes.set(node.bytes, node.offset);
        continue;
      }
      if (node.kind === "raw") {
        node.args.forEach((arg, i) => write(node.offset + i * node.width, node.width, expression(arg, { ...constants, ...SCRIPT_DATA.movements }, labels, base, origins), node.line));
        continue;
      }
      view.setUint8(node.offset, node.command.code);
      let at = node.offset + 1;
      node.fields.forEach((p, i) => {
        let pointer = isPointer(node.command, i, p) || node.original === "loadpointer" && i === 1;
        const value = expression(node.args[i], constants, labels, base, origins, pointer);
        write(at, p.width, value, node.line);
        at += p.width;
      });
    } catch (error) {
      if (error.message.startsWith("Line "))
        throw error;
      lineError(node.line, error.message);
    }
  }
  const entry = labels["@start"] ?? labels.start ?? labels["@main"] ?? labels.main ?? firstCode;
  return { bytes, entryOffset: entry, labels, commands };
}
function disassembleScript(bytes, address, engine = "frlg", inspect = false, limits = {}) {
  const definitions = SCRIPT_DATA[engine] || SCRIPT_DATA.frlg, byCode = new Map(definitions.map((c) => [c.code, c])), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const blocks = /* @__PURE__ */ new Map(), texts = /* @__PURE__ */ new Map(), movements = /* @__PURE__ */ new Map(), labels = /* @__PURE__ */ new Map();
  let total = 0;
  const valid = (p) => p >= 512 && p < bytes.length;
  const offset = (p) => p >= BASE && p < BASE + bytes.length ? p - BASE : -1;
  const label = (p, type) => {
    if (!labels.has(p))
      labels.set(p, type + "_" + p.toString(16));
    return labels.get(p);
  };
  labels.set(address, "@start");
  const scanText = (p) => {
    if (!valid(p))
      return;
    if (texts.has(p))
      return;
    texts.set(p, decodeScriptText(bytes, p).text);
    label(p, "@text");
  };
  const scanMovement = (p) => {
    if (!valid(p) || movements.has(p))
      return;
    const data = [];
    for (let i = p; i < Math.min(p + 512, bytes.length); i++) {
      data.push(bytes[i]);
      if (bytes[i] === 254) {
        movements.set(p, data);
        label(p, "@movement");
        return;
      }
    }
    throw new Error("A movement list has no terminator.");
  };
  const scan = (p, depth = 0) => {
    if (blocks.has(p))
      return;
    if (!valid(p) || depth > Math.min(limits.maxDepth??24,256) || blocks.size >= Math.min(limits.maxBlocks??128,2048))
      throw new Error("A script branch cannot be decoded within the bounds.");
    const list = [];
    blocks.set(p, list);
    label(p, "@script");
    for (let at = p, count = 0; count < 2048 && total++ < Math.min(limits.maxInstructions??8192,131072); count++) {
      if (at !== p && blocks.has(at)) {
        list.push({ jump: at });
        return;
      }
      const command = byCode.get(bytes[at]);
      if (!command)
        throw new Error("Unknown opcode 0x" + bytes[at]?.toString(16) + " at 0x" + at.toString(16) + ". Import raw source or select a known script entry.");
      let cursor = at + 1, args = [], fields = paramsFor(command, command.code === 92 ? [bytes[at + 1]] : []);
      for (const field of fields) {
        if (cursor + field.width > bytes.length)
          throw new Error("Truncated script.");
        args.push(field.width === 1 ? bytes[cursor] : field.width === 2 ? view.getUint16(cursor, true) : view.getUint32(cursor, true));
        cursor += field.width;
      }
      const node = { at, command, fields, args };
      list.push(node);
      for (let i = 0; i < fields.length; i++)
        if (fields[i].width === 4) {
          const target = offset(args[i]);
          if (target < 0)
            continue;
          if ([4, 5, 6, 7].includes(command.code)) {
            scan(target, depth + 1);
          } else if ([103, 133, 155].includes(command.code) || command.code === 15 && args[0] === 0 && bytes[cursor] === 9)
            scanText(target);
          else if ([79, 80].includes(command.code))
            scanMovement(target);
          else if (command.code === 92) {
            const mode = args[0], finish = [1, 2].includes(mode) ? 5 : [6, 8].includes(mode) ? 6 : -1;
            if (i === finish)
              scan(target, depth + 1);
            else
              scanText(target);
          }
        }
      at = cursor;
      if ([2, 3, 5, 8, 12, 13, 94, 95].includes(command.code))
        return;
    }
    throw new Error("Script exceeds the decoding limit.");
  };
  scan(address);
  const hex = (n) => "0x" + n.toString(16).toUpperCase(), lines = ["// Gen III event source. Compiling creates a new copy and updates this event only."];
  for (const [at, list] of blocks) {
    lines.push("", labels.get(at) + ":");
    for (const node of list) {
      if (node.jump) {
        lines.push("goto " + labels.get(node.jump));
        continue;
      }
      const params = node.args.map((n, i) => node.fields[i].width === 4 && labels.has(offset(n)) ? labels.get(offset(n)) : hex(n));
      lines.push(node.command.name + (params.length ? " " + params.join(", ") : ""));
    }
  }
  for (const [at, text] of texts)
    lines.push("", labels.get(at) + ":", "= " + text + "$");
  for (const [at, data] of movements)
    lines.push("", labels.get(at) + ":", ".movement " + data.map(hex).join(", "));
  const source=lines.join("\n")+"\n";
  if(inspect){const references=[];for(const list of blocks.values())for(const node of list){if(!node.fields)continue;let cursor=node.at+1;node.fields.forEach((f,i)=>{if(f.width===4&&texts.has(offset(node.args[i])))references.push({pointer:cursor,address:offset(node.args[i])});cursor+=f.width;});}return{source,texts:[...texts].map(([address,text])=>({address,text,references:references.filter(r=>r.address===address).map(r=>r.pointer)}))};}
  return source;
}
const SCRIPT_TEMPLATE = "@start:\nlock\nfaceplayer\nmsgbox @text, MSG_NORMAL\nrelease\nend\n\n@text:\n= Hello there!\\nWelcome to PokeBacon.$\n";
function scriptCommandHelp(engine = "frlg") {
  return (SCRIPT_DATA[engine] || SCRIPT_DATA.frlg).map((c) => c.name + " " + c.params.map((p) => p.name + (p.default !== void 0 ? "=" + p.default : "")).join(", ")).join("\n");
}
export {
  textEncode as encodeScriptText,
  SCRIPT_TEMPLATE,
  compileScript,
  decodeScriptText,
  disassembleScript,
  scriptCommandHelp
};
