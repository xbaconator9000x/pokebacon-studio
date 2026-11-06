import { sourceText, sourceBytes } from './source-archive.js';

const ENGINES = new Set(['pokefirered', 'pokeemerald', 'cfru', 'shiny']);
const FIELDS = ['tilemapLeft', 'tilemapTop', 'width', 'height'];

export function readSourceUILayouts(files, engine) {
  if (!ENGINES.has(engine)) throw Error('Choose a supported FireRed, Emerald or CFRU source engine.');
  const rows = [];
  for (const [path, bytes] of files) {
    if (!/^src\/.*\.(?:c|h)$/.test(path)) continue;
    const text = sourceText(bytes);
    const tables = /\b(?:static\s+)?const\s+struct\s+WindowTemplate\s+(\w+)\s*\[[^\]]*\]\s*=\s*\{([\s\S]*?)\n\s*\};/g;
    for (const table of text.matchAll(tables)) {
      let index = 0;
      for (const entry of table[2].matchAll(/(?:\[(\w+)\]\s*=\s*)?\{([^{}]*)\}/g)) {
        const original = entry[2], values = {};
        for (const field of FIELDS) {
          const m = original.match(new RegExp('\\.' + field + '\\s*=\\s*(\\d+)\\s*(?=,|$)'));
          if (m) values[field] = Number(m[1]);
        }
        if (FIELDS.every(field => Number.isInteger(values[field]))) rows.push({
          id: `${path}::${table[1]}::${index}`, engine, path, table: table[1], index,
          label: entry[1] || String(index), original, ...values
        });
        index++;
      }
    }
  }
  return rows;
}

export function applySourceUILayouts(files, engine, edits = []) {
  const slots = readSourceUILayouts(files, engine), out = new Map(files), seen = new Set();
  for (const edit of edits) {
    const slot = slots.find(s => s.id === edit.id);
    if (!slot || seen.has(edit.id) || slot.original !== edit.original) throw Error('The UI source changed. Reimport it before applying this layout.');
    seen.add(edit.id);
    const values = Object.fromEntries(FIELDS.map(k => [k, edit[k]]));
    if (!FIELDS.every(k => Number.isInteger(values[k])) || values.tilemapLeft < 0 || values.tilemapTop < 0 || values.width < 1 || values.height < 1 || values.tilemapLeft + values.width > 30 || values.tilemapTop + values.height > 20 || values.width * values.height > slot.width * slot.height) throw Error('Keep the window inside the 30 × 20 screen and within its original tile allocation.');
    let text = sourceText(out.get(slot.path));
    if (text.split(slot.original).length !== 2) throw Error('This source window is not unique enough to edit safely.');
    let next = slot.original;
    for (const field of FIELDS) next = next.replace(new RegExp('(\\.' + field + '\\s*=\\s*)\\d+'), (_, lead) => lead + values[field]);
    out.set(slot.path, sourceBytes(text.replace(slot.original, next)));
  }
  return out;
}
