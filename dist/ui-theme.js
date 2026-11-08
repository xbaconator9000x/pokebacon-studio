import { authoring } from "./authoring-model.js";
import { makeZip } from "./zip.js";
import { uiEngineSource } from "./ui-engine-source.js";
const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  E = (type, x, y, w, h, text = "", binding = "") => ({
    id: uid(),
    type,
    x,
    y,
    width: w,
    height: h,
    text,
    binding,
    fill: type === "text" ? "ink" : "paper",
    stroke: "border",
    font: 10,
    visible: true,
    value: 50,
    max: 100,
  }),
  S = (name, elements) => ({ id: uid(), name, elements });
export const UI_TEMPLATES = {
  dialogue: () =>
    S("Dialogue", [
      E("window", 4, 112, 232, 44),
      E("text", 12, 120, 216, 28, "Welcome, {PLAYER}!"),
    ]),
  bag: () =>
    S("Bag", [
      E("window", 2, 2, 236, 156),
      E("text", 12, 12, 140, 14, "BAG"),
      E("window", 10, 30, 144, 112),
      E("text", 18, 38, 128, 88, "Potion × 3\nPoké Ball × 10\nEscape Rope"),
      E("image", 166, 34, 62, 62),
      E("text", 164, 104, 64, 30, "Potion\nHeals 20 HP"),
    ]),
  trainer: () =>
    S("Trainer card", [
      E("window", 8, 8, 224, 144),
      E("text", 18, 18, 130, 14, "TRAINER CARD"),
      E("image", 18, 42, 72, 72),
      E(
        "text",
        104,
        42,
        112,
        72,
        "WADE\nID No. 00001\nBADGES  0\nMONEY  ₽3,000",
      ),
    ]),
  options: () =>
    S("Options", [
      E("window", 22, 18, 196, 124),
      E("text", 34, 30, 160, 14, "OPTIONS"),
      E(
        "text",
        36,
        56,
        144,
        68,
        "Text Speed     Fast\nBattle Style   Set\nSound          Stereo\nButton Mode    Help",
      ),
      E("window", 32, 54, 10, 10),
    ]),
  party: () =>
    S("Party", [
      E("window", 4, 4, 232, 152),
      ...Array.from({ length: 6 }, (_, i) =>
        E("window", 12 + (i % 2) * 112, 14 + Math.floor(i / 2) * 44, 104, 36),
      ),
      E(
        "text",
        20,
        22,
        88,
        112,
        "BULBASAUR\nLv. 12   HP 28/28\n\nPIDGEY\nLv. 10   HP 22/22\n\nEMPTY",
      ),
      E("bar", 64, 38, 42, 4, "", "party_hp"),
    ]),
  dex: () =>
    S("Pokédex", [
      E("window", 4, 4, 232, 152),
      E("text", 14, 14, 212, 16, "POKÉDEX"),
      E("window", 12, 34, 92, 112),
      E("text", 20, 42, 76, 92, "#001 Bulbasaur\n#002 Ivysaur\n#003 Venusaur"),
      E("image", 122, 40, 92, 72),
      E("text", 118, 120, 100, 20, "Bulbasaur"),
    ]),
  battle: () =>
    S("Battle HUD", [
      E("window", 128, 8, 106, 38),
      E("text", 138, 14, 88, 12, "WILD PIDGEY  Lv5"),
      E("bar", 154, 30, 64, 5, "", "enemy_hp"),
      E("window", 6, 112, 140, 42),
      E("text", 16, 118, 110, 12, "BULBASAUR  Lv12"),
      E("bar", 56, 134, 64, 5, "", "player_hp"),
    ]),
  menu: () =>
    S("Main menu", [
      E("window", 132, 12, 96, 120),
      E(
        "text",
        146,
        24,
        70,
        98,
        "POKÉDEX\nPOKÉMON\nBAG\nTRAINER\nSAVE\nOPTIONS\nEXIT",
      ),
    ]),
  summary: () => S("Pokémon summary", [E("window", 4, 4, 232, 152), E("image", 14, 30, 72, 72), E("text", 96, 18, 126, 102, "BULBASAUR  Lv.12\nGRASS / POISON\n\nHP  28 / 28\nATTACK  18\nDEFENSE  17\n\nOT  WADE"), E("bar", 104, 54, 104, 6, "", "summary_hp")]),
  pc: () => S("PC storage", [E("window", 4, 4, 232, 152), E("text", 16, 14, 200, 16, "BILL'S PC · BOX 1"), ...Array.from({length: 30}, (_, i) => E("window", 14 + (i % 6) * 36, 38 + Math.floor(i / 6) * 20, 28, 16)), E("text", 16, 140, 190, 12, "MOVE  SUMMARY  WITHDRAW  EXIT")]),
  target: () => S("Battle target", [E("window", 14, 12, 212, 132), E("text", 30, 24, 180, 16, "Which target?"), E("button", 34, 54, 172, 26, "BULBASAUR"), E("button", 34, 90, 172, 26, "PIDGEY")]),
  battlemenu: () => S("Battle commands", [E("window", 4, 110, 232, 46), E("button", 14, 120, 96, 14, "FIGHT"), E("button", 130, 120, 96, 14, "BAG"), E("button", 14, 140, 96, 12, "POKÉMON"), E("button", 130, 140, 96, 12, "RUN")]),
  wardrobe: () => S("Wardrobe", [E("window", 6, 6, 228, 148), E("text", 18, 18, 140, 16, "WARDROBE"), E("image", 20, 44, 76, 90), E("button", 116, 42, 96, 22, "OUTFIT"), E("button", 116, 72, 96, 22, "HAIR"), E("button", 116, 102, 96, 22, "SAVE LOOK")]),
  pokepedia: () => S("PokéPedia", [E("window", 4, 4, 232, 152), E("text", 16, 16, 180, 16, "POKÉPEDIA"), E("window", 14, 38, 86, 102), E("text", 22, 48, 72, 80, "CREATURES\nMOVES\nABILITIES\nITEMS"), E("text", 116, 48, 100, 72, "Select a topic\nto browse your\nregional guide.")]),
};
export function newUITheme() {
  return {
    version: 2,
    name: "My interface",
    colours: {
      paper: "#f8f8e8",
      ink: "#283040",
      border: "#809060",
      accent: "#b8d878",
      danger: "#d86070",
    },
    screens: [UI_TEMPLATES.dialogue()],
  };
}
export function validateUITheme(t) {
  if (
    !t ||
    !Array.isArray(t.screens) ||
    !t.screens.length ||
    t.screens.length > 32
  )
    throw Error("Use 1–32 interface screens.");
  if (
    !t.colours ||
    Object.values(t.colours).some((c) => !/^#[0-9a-f]{6}$/i.test(c))
  )
    throw Error("Use six-digit theme colours.");
  const ids = new Set();
  for (const s of t.screens) {
    if (
      !s.id ||
      ids.has(s.id) ||
      !Array.isArray(s.elements) ||
      s.elements.length > 64
    )
      throw Error("Screen IDs must be unique and have up to 64 elements.");
    ids.add(s.id);
    for (const e of s.elements) {
      if (
        !["window", "text", "bar", "button", "image"].includes(e.type) ||
        ![e.x, e.y, e.width, e.height].every(Number.isInteger) ||
        e.x < 0 ||
        e.y < 0 ||
        e.width < 1 ||
        e.height < 1 ||
        e.x + e.width > 240 ||
        e.y + e.height > 160 ||
        !Object.hasOwn(t.colours, e.fill) ||
        !Object.hasOwn(t.colours, e.stroke)
      )
        throw Error("Keep every element on the 240 × 160 screen.");
    }
  }
  return { ...t, version: 2 };
}
export function uiThemeEditor(api) {
  let theme,
    screenIndex = 0,
    selected = 0,
    history = [],
    future = [],
    drag;
  const $ = (s) => document.querySelector(s),
    esc = api.esc,
    active = () => theme.screens[screenIndex],
    current = () => active().elements[selected];
  const save = () => {
      theme = validateUITheme(theme);
      api.change(() => {
        const a = authoring(api.project());
        a.presentation ??= { texts: {}, scenes: [], playerLooks: [] };
        a.presentation.uiTheme = structuredClone(theme);
      });
    },
    change = (fn) => {
      const b = structuredClone(theme);
      try {
        fn();
        history.push(b);
        history = history.slice(-40);
        future = [];
        save();
        render();
      } catch (err) {
        theme = b;
        api.error(err);
      }
    };
  function render() {
    const s = active(),
      e = current();
    api.modal(
      "Interface designer",
      `<p>Touch-first UI builder. Drag an element to move it; drag its pink lower-right corner to resize it.</p><div class="studio-tabs">${Object.keys(
        UI_TEMPLATES,
      )
        .map(
          (k) =>
            `<button data-template="${k}">${esc(k === "dex" ? "Pokédex" : k[0].toUpperCase() + k.slice(1))}</button>`,
        )
        .join(
          "",
        )}</div><div class="studio-actions"><button id="undo" ${history.length ? "" : "disabled"}>Undo</button><button id="redo" ${future.length ? "" : "disabled"}>Redo</button><button id="export">Export theme</button><button id="import">Import theme</button><button id="source">Engine source</button></div><input hidden id="themeFile" type="file" accept="application/json,.json"><label>Screen<select id="screens">${theme.screens.map((v, i) => `<option value="${i}" ${i === screenIndex ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label><canvas id="preview" width="240" height="160" style="width:100%;max-height:46dvh;object-fit:contain;image-rendering:pixelated;touch-action:none"></canvas><details open><summary>Selected element</summary>${e ? `<div class="studio-actions">${["window", "text", "bar", "button", "image"].map((t) => `<button data-add="${t}">+ ${t}</button>`).join("")}</div><label>Type<select id="type">${["window", "text", "bar", "button", "image"].map((t) => `<option ${e.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><div class="field-row">${["x", "y", "width", "height"].map((k) => `<label>${k}<input data-field="${k}" type="number" value="${e[k]}"></label>`).join("")}</div><label>Text<textarea id="text">${esc(e.text || "")}</textarea></label><label>Binding<input id="binding" value="${esc(e.binding || "")}" placeholder="player_hp, money, badge_count"></label>${e.type === "bar" ? `<div class="field-row"><label>Preview value<input id="value" type="number" value="${e.value || 0}"></label><label>Maximum<input id="max" type="number" value="${e.max || 100}"></label></div>` : ""}<div class="studio-actions"><button id="apply">Apply</button><button id="clone">Duplicate</button><button id="delete">Delete</button><button id="front">Bring forward</button></div>` : `<button data-add="window">Add element</button>`}</details><details><summary>Screen & colours</summary><label>Name<input id="name" value="${esc(s.name)}"></label><div class="studio-actions"><button id="rename">Rename</button><button id="copy">Duplicate screen</button><button id="remove" ${theme.screens.length === 1 ? "disabled" : ""}>Delete screen</button></div>${Object.entries(
        theme.colours,
      )
        .map(
          ([k, v]) =>
            `<label>${esc(k)}<input type="color" data-colour="${k}" value="${v}"></label>`,
        )
        .join(
          "",
        )}</details><details><summary>Help</summary><p>Templates add editable Bag, Trainer card, Options, Party, Pokédex, Battle HUD and menu screens without replacing your work. Theme packs can be imported/exported. Engine source is for a decomp integration, not a guessed compiled-ROM patch.</p></details>`,
      save,
      "Done",
    );
    const c = $("#preview");
    paint(c);
    bind(c);
    document.querySelectorAll("[data-template]").forEach(
      (b) =>
        (b.onclick = () =>
          change(() => {
            theme.screens.push(UI_TEMPLATES[b.dataset.template]());
            screenIndex = theme.screens.length - 1;
            selected = 0;
          })),
    );
    document.querySelectorAll("[data-add]").forEach(
      (b) =>
        (b.onclick = () =>
          change(() => {
            s.elements.push(
              E(
                b.dataset.add,
                12,
                12,
                b.dataset.add === "text" ? 100 : 72,
                b.dataset.add === "text" ? 16 : 24,
                b.dataset.add === "button" ? "Button" : "Text",
              ),
            );
            selected = s.elements.length - 1;
          })),
    );
    $("#screens").onchange = (x) => {
      screenIndex = +x.target.value;
      selected = 0;
      render();
    };
    $("#undo").onclick = () => {
      future.push(structuredClone(theme));
      theme = history.pop();
      screenIndex = 0;
      selected = 0;
      save();
      render();
    };
    $("#redo").onclick = () => {
      history.push(structuredClone(theme));
      theme = future.pop();
      screenIndex = 0;
      selected = 0;
      save();
      render();
    };
    if (e) {
      $("#apply").onclick = () =>
        change(() => {
          for (const n of document.querySelectorAll("[data-field]"))
            e[n.dataset.field] = +n.value;
          e.type = $("#type").value;
          e.text = $("#text").value;
          e.binding = $("#binding").value;
          if ($("#value")) {
            e.value = +$("#value").value;
            e.max = +$("#max").value;
          }
        });
      $("#clone").onclick = () =>
        change(() => {
          s.elements.push({
            ...structuredClone(e),
            id: uid(),
            x: Math.min(239, e.x + 4),
            y: Math.min(159, e.y + 4),
          });
          selected = s.elements.length - 1;
        });
      $("#delete").onclick = () =>
        change(() => {
          s.elements.splice(selected, 1);
          selected = Math.max(0, selected - 1);
        });
      $("#front").onclick = () =>
        change(() => {
          s.elements.push(s.elements.splice(selected, 1)[0]);
          selected = s.elements.length - 1;
        });
    }
    $("#rename").onclick = () =>
      change(() => (s.name = $("#name").value.trim() || s.name));
    $("#copy").onclick = () =>
      change(() => {
        theme.screens.push({
          ...structuredClone(s),
          id: uid(),
          name: s.name + " copy",
        });
        screenIndex = theme.screens.length - 1;
        selected = 0;
      });
    $("#remove").onclick = () =>
      change(() => {
        theme.screens.splice(screenIndex, 1);
        screenIndex = 0;
        selected = 0;
      });
    document
      .querySelectorAll("[data-colour]")
      .forEach(
        (n) =>
          (n.onchange = () =>
            change(() => (theme.colours[n.dataset.colour] = n.value))),
      );
    $("#export").onclick = () =>
      api.save(
        new Blob([JSON.stringify(validateUITheme(theme), null, 2)], {
          type: "application/json",
        }),
        "pokebacon-ui-theme.json",
      );
    $("#import").onclick = () => $("#themeFile").click();
    $("#themeFile").onchange = async (x) => {
      try {
        const f = x.target.files[0];
        if (!f || f.size > 1e6) throw Error("Use a theme JSON below 1 MB.");
        const parsed = validateUITheme(JSON.parse(await f.text()));
        change(() => {
          theme = parsed;
          screenIndex = 0;
          selected = 0;
        });
      } catch (err) {
        api.error(err);
      }
    };
    $("#source").onclick = () =>
      api.save(
        makeZip(uiEngineSource(validateUITheme(theme))),
        "pokebacon-ui-engine-source.zip",
      );
  }
  function paint(c) {
    const x = c.getContext("2d"),
      e = current();
    x.fillStyle = "#182028";
    x.fillRect(0, 0, 240, 160);
    for (const v of active().elements) {
      if (!v.visible) continue;
      x.fillStyle = theme.colours[v.fill];
      x.strokeStyle = theme.colours[v.stroke];
      if (v.type === "text") {
        x.font = "10px monospace";
        v.text
          .split("\n")
          .forEach((l, i) => x.fillText(l, v.x, v.y + 10 + i * 12));
      } else if (v.type === "bar") {
        x.fillRect(v.x, v.y, v.width, v.height);
        x.fillStyle = theme.colours.accent;
        x.fillRect(
          v.x,
          v.y,
          v.width * Math.min(1, (v.value || 0) / (v.max || 1)),
          v.height,
        );
        x.strokeRect(v.x, v.y, v.width, v.height);
      } else {
        x.fillRect(v.x, v.y, v.width, v.height);
        x.strokeRect(v.x, v.y, v.width, v.height);
        if (v.type === "image") {
          x.fillStyle = theme.colours.ink;
          x.font = "9px monospace";
          x.fillText("IMAGE", v.x + 4, v.y + 12);
        }
      }
    }
    if (e) {
      x.strokeStyle = "#ff6090";
      x.lineWidth = 2;
      x.strokeRect(e.x + 1, e.y + 1, e.width - 2, e.height - 2);
      x.fillStyle = "#ff6090";
      x.fillRect(e.x + e.width - 4, e.y + e.height - 4, 6, 6);
    }
  }
  function bind(c) {
    const point = (v) => {
      const b = c.getBoundingClientRect(),
        scale = Math.min(b.width / 240, b.height / 160);
      return {
        x: Math.round(
          (v.clientX - b.left - (b.width - 240 * scale) / 2) / scale,
        ),
        y: Math.round(
          (v.clientY - b.top - (b.height - 160 * scale) / 2) / scale,
        ),
      };
    };
    c.onpointerdown = (v) => {
      const p = point(v);
      for (let i = active().elements.length - 1; i >= 0; i--) {
        const q = active().elements[i];
        if (
          p.x >= q.x &&
          p.y >= q.y &&
          p.x < q.x + q.width &&
          p.y < q.y + q.height
        ) {
          selected = i;
          drag = {
            before: structuredClone(theme),
            x: p.x,
            y: p.y,
            resize: p.x > q.x + q.width - 10 && p.y > q.y + q.height - 10,
          };
          c.setPointerCapture(v.pointerId);
          paint(c);
          break;
        }
      }
    };
    c.onpointermove = (v) => {
      if (!drag) return;
      const p = point(v),
        q = current(),
        dx = p.x - drag.x,
        dy = p.y - drag.y;
      if (drag.resize) {
        q.width = Math.max(1, Math.min(240 - q.x, q.width + dx));
        q.height = Math.max(1, Math.min(160 - q.y, q.height + dy));
      } else {
        q.x = Math.max(0, Math.min(240 - q.width, q.x + dx));
        q.y = Math.max(0, Math.min(160 - q.height, q.y + dy));
      }
      drag.x = p.x;
      drag.y = p.y;
      paint(c);
    };
    c.onpointerup = () => {
      if (drag) {
        history.push(drag.before);
        future = [];
        save();
        drag = null;
        render();
      }
    };
  }
  return {
    open() {
      theme = validateUITheme(
        structuredClone(
          api.project().authoring?.presentation?.uiTheme || newUITheme(),
        ),
      );
      screenIndex = 0;
      selected = 0;
      history = [];
      future = [];
      render();
    },
  };
}
