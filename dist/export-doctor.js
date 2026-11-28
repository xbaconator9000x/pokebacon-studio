// Export Doctor: boots a ROM headlessly, presses buttons on a fixed script and reports what happened.
// Pure logic: it needs a core with load/frame/video/unload (the bundled mGBA adapter).
export const DOCTOR_KEYS = { a: 1, start: 8 };
export const DOCTOR_PLAN = Object.freeze({ frames: 2400, sampleEvery: 120, pressFrom: 240, pressEvery: 45, pressFor: 4 });

export function frameStats(video) {
  const { pixels, width, height } = video, n = width * height;
  const counts = new Map(); let hash = 2166136261 >>> 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4, c = pixels[o] | pixels[o + 1] << 8 | pixels[o + 2] << 16;
    counts.set(c, (counts.get(c) || 0) + 1);
    hash = Math.imul(hash ^ c, 16777619) >>> 0;
  }
  let top = 0; for (const v of counts.values()) if (v > top) top = v;
  return { hash, colours: counts.size, dominant: n ? top / n : 1, blank: n === 0 || top / n > 0.985 };
}

export function inputFor(frame, plan = DOCTOR_PLAN) {
  if (frame < plan.pressFrom) return 0;
  const phase = (frame - plan.pressFrom) % plan.pressEvery;
  if (phase >= plan.pressFor) return 0;
  return ((frame - plan.pressFrom) / plan.pressEvery | 0) % 3 === 2 ? DOCTOR_KEYS.start : DOCTOR_KEYS.a;
}

export async function runRom(core, bytes, { plan = DOCTOR_PLAN, onProgress, yieldEvery = 60, keepShots = 8 } = {}) {
  const out = { opened: false, samples: [], shots: [], error: '' };
  try { core.load(bytes); out.opened = true; } catch (e) { out.error = String(e?.message || e); return out; }
  try {
    for (let f = 0; f < plan.frames; f++) {
      core.frame(inputFor(f, plan));
      if (f % plan.sampleEvery === plan.sampleEvery - 1) {
        const v = core.video(), s = frameStats(v);
        out.samples.push({ frame: f + 1, ...s });
        if (!s.blank && (!out.shots.length || out.shots[out.shots.length - 1].hash !== s.hash)) out.shots.push({ frame: f + 1, hash: s.hash, width: v.width, height: v.height, pixels: v.pixels });
      }
      if (f % yieldEvery === 0) { onProgress?.(f / plan.frames); await new Promise(r => setTimeout(r, 0)); }
    }
  } catch (e) { out.error = String(e?.message || e); }
  finally { try { core.unload(); } catch { /* ignore */ } }
  if (out.shots.length > keepShots) { const step = (out.shots.length - 1) / (keepShots - 1); out.shots = Array.from({ length: keepShots }, (_, i) => out.shots[Math.round(i * step)]); }
  return out;
}

export function judge(run, baseline = null) {
  const notes = [];
  if (!run.opened) return { verdict: 'fail', title: 'The ROM would not open', notes: [run.error || 'The engine refused this file. Check that it is a full GBA ROM.'] };
  if (run.error) notes.push('The engine stopped part-way: ' + run.error);
  const s = run.samples, shown = s.filter(x => !x.blank), distinct = new Set(shown.map(x => x.hash)).size;
  const lateChanges = new Set(s.filter(x => x.frame > 600).map(x => x.hash)).size;
  let verdict = 'pass', title = 'Boots and responds';
  if (!shown.length) { verdict = 'fail'; title = 'Nothing was ever drawn'; notes.push('The screen stayed one flat colour for the whole test. This usually means a crash or a bad edit very early in startup.'); }
  else if (distinct < 2) { verdict = 'warn'; title = 'Drew one screen and never changed'; notes.push('The game showed something but never moved on, even with A and Start pressed. It may be waiting for a save prompt or it may be frozen.'); }
  else if (lateChanges < 2 && s.length > 6) { verdict = 'warn'; title = 'Started, then stopped changing'; notes.push('The picture stopped changing after the first few seconds despite button presses. It may have frozen.'); }
  else notes.push(`${distinct} different screens were drawn in ${run.samples.length * 2} seconds of play.`);
  if (baseline) {
    const b = judge(baseline);
    if (b.verdict === 'pass' && verdict !== 'pass') { verdict = 'fail'; title = 'Worse than the original ROM'; notes.unshift('The original ROM boots and responds under the same test, so this looks like a regression from your edits.'); }
    else if (b.verdict !== 'pass' && verdict !== 'pass') notes.push('The original ROM behaves the same way under this test, so this may not come from your edits.');
  }
  return { verdict, title, notes };
}
