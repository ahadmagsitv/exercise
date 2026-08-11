/**
 * Replay harness — runs this app's rule engine over REAL recorded MediaPipe pose data.
 *
 * `geometry-check.js` proves the geometry is right using synthetic skeletons I authored, which
 * are exactly as clean or as faulty as they were written to be. This one replays real recordings
 * of real people, which is the only way to see how the rules behave on actual landmark noise,
 * real tempo, and real framing.
 *
 * SOURCE OF THE DATA
 *   The SquatWell iOS project has 25 committed clips of real MediaPipe output — 33 world + 33
 *   image landmarks per frame at 12 FPS — recorded from front-facing squat videos. Same MediaPipe
 *   topology as this app, so they replay directly with no conversion beyond field names.
 *
 *   The recordings are NOT copied into this repo (they are somebody's recorded movement, and they
 *   belong to that project). Point the harness at them instead.
 *
 * WHAT IT CAN AND CANNOT VERIFY
 *   Every clip is a SQUAT, so only the squat rules get real-data coverage here. Abduction,
 *   flexion, lateral flexion, rotation and extension remain synthetic-only until clips exist.
 *
 *   No clip carries a human form label, so this cannot measure whether a verdict is CORRECT.
 *   It measures whether the rules are alive, whether they agree with an independent
 *   implementation, and how they behave on real input.
 *
 * THE CROSS-CHECK
 *   SquatWell computes knee flexion as `180 - interiorAngle` over the same world landmarks that
 *   this app's `jointAngle(wlm, 24, 26, 28)` reads. On identical input the two MUST sum to 180.
 *   Any drift is a real disagreement between two independent implementations, and section 3
 *   reports it to 3 decimal places.
 *
 * HOW TO RUN
 *   Serve a directory containing both this app and the fixtures, e.g. with symlinks:
 *     mkdir serve && cd serve
 *     ln -s /path/to/exercise app
 *     ln -s /path/to/SquatWell/SquatWellTests/Fixtures fixtures
 *     python3 -m http.server 8732
 *   Open http://localhost:8732/app/index.html, then paste this file into the DevTools console.
 *   It returns a summary object and prints a full report.
 *
 *   Override the fixture location with:  __replay({ base: '/some/other/path/' })
 *
 * KNOWN LIMITATION
 *   `replay()` below re-implements the rAF loop from index.html (EMA, phase machine, peak
 *   tracking, violation debounce) because that loop is welded to requestAnimationFrame and a
 *   live camera. The metrics and the form rules themselves are the real ones off
 *   `window.__exercise`, so thresholds and geometry cannot drift — but the *loop* can. It
 *   already did once: the re-trigger dedupe had to be applied here as well as in index.html.
 *   If you change the loop, change it in both places. Extracting it into a shared pure
 *   function that both the app and this harness call would remove the hazard for good.
 */
window.__replay = async function (opts = {}) {
  const X = window.__exercise;
  if (!X) throw new Error("window.__exercise missing — open the app's index.html first");
  const base = opts.base || "../fixtures/";

  const log = [];
  const say = (s = "") => { log.push(s); console.log(s); };
  const padr = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + " ".repeat(n - String(s).length);
  const padl = (s, n) => String(s).length >= n ? String(s) : " ".repeat(n - String(s).length) + String(s);
  const f1 = v => (v == null || !isFinite(v)) ? "—" : v.toFixed(1);

  // --- discover fixtures ------------------------------------------------------------------
  let names = opts.names;
  if (!names) {
    const listing = await (await fetch(base)).text();
    names = [...listing.matchAll(/href="([^"]+\.json)"/g)]
      .map(m => decodeURIComponent(m[1]).replace(/^.*\//, ""))
      .filter(n => n !== "labels.json");
    names.sort();
  }
  if (!names.length) throw new Error("no fixtures found at " + base);

  const squat = X.EXERCISES.find(e => e.key === "squat");
  const VIOLATION_FRAMES = 5;   // mirrors index.html
  const EMA = 0.75;             // mirrors index.html

  // --- replay one clip --------------------------------------------------------------------
  async function replay(name) {
    const rec = await (await fetch(base + name + ".json")).json();
    const frames = (rec.frames || [])
      .filter(f => f.world && f.image && f.world.length >= 33 && f.image.length >= 33)
      .map(f => ({
        t: f.tMs,
        lm: f.image,
        wlm: f.world,
        // SquatWell's own reading of the same frame, for the cross-check
        swFlexRight: f.angles ? f.angles.rightKneeFlexion : null,
      }));
    if (!frames.length) return { name, error: "no usable frames" };

    // Interior knee angle, this app's own measure, independent of SquatWell's angles.
    frames.forEach(f => { f.interior = X.jointAngle(f.wlm, 24, 26, 28); });

    // Calibration from genuinely standing frames at the head of the clip. Standing is defined
    // by this app's own geometry (interior > 150 == under 30 deg of flexion), not by trusting
    // the recording's angles, so the cross-check downstream stays independent.
    const standing = [];
    for (const f of frames) {
      if (f.interior > 150) standing.push(f);
      else if (standing.length >= 3) break;   // first real descent ends the baseline
      else standing.length = 0;               // brief blip before settling, restart
    }
    if (standing.length < 3) return { name, error: "no standing reference in clip", frames: frames.length };
    const cal = X.buildCalibration(standing.slice(-30).map(f => X.calibSample(f.lm, f.wlm)));

    // Rep detection + grading, mirroring the app's loop exactly.
    let smooth = null, phase = "rest", peak = null, streaks = {}, violations = [];
    const reps = [];
    for (const f of frames) {
      const raw = squat.metric(f.lm, f.wlm, cal);
      smooth = smooth == null ? raw : smooth * EMA + raw * (1 - EMA);
      f.smooth = smooth;
      const isActive = smooth < squat.activeValue;
      const isRest = smooth > squat.restValue;
      if (phase === "rest" && isActive) {
        phase = "active"; peak = smooth; streaks = {}; violations = [];
      } else if (phase === "active" && isRest) {
        phase = "rest";
        const missed = squat.form.filter(r => r.peak && !r.peak(peak)).map(r => r.id);
        const reached = peak <= squat.minROM;
        reps.push({ peak, reached, violations: [...violations], missed,
                    kind: !reached ? "partial" : (violations.length + missed.length ? "flagged" : "clean") });
      }
      if (phase === "active") {
        peak = Math.min(peak, smooth);
        for (const rule of squat.form) {
          if (!rule.check) continue;
          let held = true;
          try { held = rule.check(f.lm, f.wlm, cal); } catch (e) { continue; }
          if (held) { streaks[rule.id] = 0; continue; }
          streaks[rule.id] = (streaks[rule.id] || 0) + 1;
          // must mirror index.html exactly, including the re-trigger dedupe
          if (streaks[rule.id] === VIOLATION_FRAMES && !violations.includes(rule.id)) {
            violations.push(rule.id);
          }
        }
      }
    }
    // A clip that ends at the bottom never closes its rep; report it rather than dropping it.
    const unclosed = phase === "active";

    // Cross-check against SquatWell on every frame that carries its angle.
    let worst = 0, worstAt = null, n = 0;
    for (const f of frames) {
      if (f.swFlexRight == null) continue;
      const err = Math.abs((f.interior + f.swFlexRight) - 180);
      n++;
      if (err > worst) { worst = err; worstAt = f.t; }
    }
    const deepest = frames.reduce((a, b) => a.interior < b.interior ? a : b);
    return { name, frames: frames.length, standing: standing.length, reps, unclosed,
             deepestInterior: deepest.interior, crossN: n, crossWorst: worst, crossWorstAt: worstAt,
             baselineInterior: standing.length ? standing[standing.length - 1].interior : null };
  }

  const results = [];
  for (const n of names) { try { results.push(await replay(n.replace(/\.json$/, ""))); }
                           catch (e) { results.push({ name: n, error: String(e) }); } }

  // --- report -------------------------------------------------------------------------------
  say("═".repeat(96));
  say(" exercise.git rule engine replayed over real MediaPipe recordings");
  say("═".repeat(96));
  const ok = results.filter(r => !r.error);
  say(`clips: ${results.length}   replayed: ${ok.length}   errored: ${results.length - ok.length}`);
  results.filter(r => r.error).forEach(r => say(`   ${r.name}: ${r.error}`));

  say("\n─── 1. REP DETECTION AND VERDICT ───────────────────────────────────────────────────────");
  say(padr("clip", 18) + padl("frames", 7) + padl("reps", 6) + padl("deepest", 9)
      + padl("peak", 7) + "  verdict / faults");
  const kinds = {};
  for (const r of ok) {
    const rep = r.reps[0];
    kinds[rep ? rep.kind : (r.unclosed ? "unclosed" : "none")] =
      (kinds[rep ? rep.kind : (r.unclosed ? "unclosed" : "none")] || 0) + 1;
    const faults = rep ? [...rep.violations, ...rep.missed.map(m => m + "*")].join(", ") : "";
    say(padr(r.name, 18) + padl(r.frames, 7) + padl(r.reps.length, 6)
        + padl(f1(r.deepestInterior) + "°", 9)
        + padl(rep ? f1(rep.peak) + "°" : "—", 7)
        + "  " + (rep ? rep.kind : (r.unclosed ? "NO REP — clip ends mid-squat" : "NO REP"))
        + (faults ? " · " + faults : ""));
  }
  say("\nverdicts: " + Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(",  ") + "   (* = peak/ROM rule)");

  say("\n─── 2. RULE FIRING RATES ON REAL DATA ──────────────────────────────────────────────────");
  const withRep = ok.filter(r => r.reps.length);
  say(padr("rule", 12) + padl("fired", 8) + padl("rate", 8) + "  verdict");
  for (const rule of squat.form) {
    const fired = withRep.filter(r =>
      r.reps[0].violations.includes(rule.id) || r.reps[0].missed.includes(rule.id)).length;
    const rate = withRep.length ? Math.round(fired / withRep.length * 100) : 0;
    let v = "";
    if (!fired) v = "NEVER FIRES on real data — unverified against anything but synthetic poses";
    else if (fired === withRep.length) v = "fires on EVERY rep — threshold likely too strict";
    say(padr(rule.id, 12) + padl(`${fired}/${withRep.length}`, 8) + padl(rate + "%", 8) + "  " + v);
  }

  say("\n─── 3. CROSS-CHECK vs SQUATWELL (independent implementation) ───────────────────────────");
  say("interiorAngle(this app) + kneeFlexion(SquatWell) must equal 180 on identical landmarks.\n");
  say(padr("clip", 18) + padl("frames", 8) + padl("worst |err|", 13) + "  ");
  let globalWorst = 0, totalFrames = 0;
  for (const r of ok) {
    globalWorst = Math.max(globalWorst, r.crossWorst);
    totalFrames += r.crossN;
    say(padr(r.name, 18) + padl(r.crossN, 8) + padl(r.crossWorst.toFixed(3) + "°", 13)
        + "  " + (r.crossWorst < 0.001 ? "exact" : r.crossWorst < 0.5 ? "ok" : "DISAGREEMENT"));
  }
  say(`\nframes compared: ${totalFrames}   worst disagreement anywhere: ${globalWorst.toFixed(6)}°`);
  say(globalWorst < 0.001
    ? "→ The two implementations agree exactly. Both read the same geometry the same way."
    : "→ The implementations disagree. One of them is wrong; investigate before trusting either.");

  say("\n─── 4. BASELINE / CALIBRATION COVERAGE ─────────────────────────────────────────────────");
  const noBase = results.filter(r => r.error && /standing/.test(r.error));
  say(`clips with a usable standing reference: ${ok.length}/${results.length}`);
  if (noBase.length) say("without one (clip opens mid-squat): " + noBase.map(r => r.name).join(", "));
  const bases = ok.map(r => r.baselineInterior).filter(v => v != null).sort((a, b) => a - b);
  if (bases.length) {
    const med = bases[Math.floor(bases.length / 2)];
    say(`baseline interior knee angle — min ${f1(bases[0])}°  median ${f1(med)}°  max ${f1(bases[bases.length - 1])}°`);
    say(`(180° = standing straight; this app calibrates from frames above 150°, i.e. under 30° of flexion)`);
  }

  say("\n─── 5. FRAME-RATE COUPLING ─────────────────────────────────────────────────────────────");
  const fps = ok.length ? (results.find(r => !r.error) ? 12 : 0) : 0;
  say(`These recordings are 12 FPS. The app's constants are expressed in FRAMES, not seconds:`);
  say(`  VIOLATION_FRAMES = ${VIOLATION_FRAMES}  →  ${(VIOLATION_FRAMES / 12 * 1000).toFixed(0)} ms at 12 FPS,` +
      ` but ${(VIOLATION_FRAMES / 60 * 1000).toFixed(0)} ms at 60 FPS`);
  say(`  EMA alpha = ${1 - EMA}          →  time constant scales with frame rate the same way`);
  say(`A rule must therefore hold a fault ~5x longer at 12 FPS than on a 60 FPS webcam before it`);
  say(`counts. Any threshold tuned on one frame rate does not transfer to the other.`);

  say("\n" + "═".repeat(96));
  return {
    clips: results.length, replayed: ok.length,
    verdicts: kinds,
    crossCheckWorstDegrees: globalWorst,
    crossCheckFrames: totalFrames,
    rulesNeverFired: squat.form.filter(rule =>
      !withRep.some(r => r.reps[0].violations.includes(rule.id) || r.reps[0].missed.includes(rule.id))
    ).map(r => r.id),
    report: log.join("\n"),
  };
};
console.log("__replay ready — call: await __replay()");
