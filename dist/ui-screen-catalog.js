// Screen names deliberately come from source paths / table names rather than guessed ROM addresses.
// Unknown tables remain available as "Other" so engine forks are never silently omitted.
const RULES = [
  ['bag', /(?:bag|item)/i, 'Bag & item menus'],
  ['trainer', /(?:trainer_card|trainercard)/i, 'Trainer card'],
  ['options', /(?:option|settings)/i, 'Options'],
  ['party', /(?:party|move_menu)/i, 'Party & moves'],
  ['summary', /(?:summary|pokemon_info|monstats|movesinfo)/i, 'Pokémon summary'],
  ['pc', /(?:storage|box|pc)/i, 'PC storage'],
  ['dex', /(?:pokedex|dexnav|dex)/i, 'Pokédex'],
  ['dialogue', /(?:textbox|text_window|message)/i, 'Dialogue'],
  ['battle', /(?:battle|target)/i, 'Battle'],
  ['menu', /(?:start_menu|main_menu|save_screen)/i, 'Field & save menus'],
  ['shattered', /(?:wardrobe|pedia|shattered)/i, 'Shattered custom screens'],
];

export function screenKind(slot) {
  const source = `${slot.path} ${slot.table}`;
  const hit = RULES.find(([, pattern]) => pattern.test(source));
  return hit ? hit[0] : 'other';
}

export function screenLabel(kind) {
  return (RULES.find(([id]) => id === kind) || ['other', null, 'Other source windows'])[2];
}

export function catalogScreens(slots) {
  const groups = new Map();
  for (const slot of slots) {
    const id = screenKind(slot);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(slot);
  }
  return [...groups].map(([id, windows]) => ({ id, label: screenLabel(id), windows }));
}
