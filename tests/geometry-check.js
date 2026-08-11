/**
 * Geometry + form-rule checks for the exercise counter.
 *
 * These drive the real metrics and rules from index.html with synthetic skeletons, so they need
 * no camera and no recorded video. They verify sign conventions, plane separation (abduction must
 * not read as flexion), and that each form rule fires on the fault it was written for and stays
 * quiet otherwise.
 *
 * HOW TO RUN
 *   1. Serve the project:  python3 -m http.server 8731
 *   2. Open http://localhost:8731/index.html
 *   3. Paste this whole file into the DevTools console.
 *
 * Or from Playwright / Puppeteer:
 *   await page.addScriptTag({ path: 'tests/geometry-check.js' })
 *
 * This is the seed of the replay harness in docs/exercise-form-reference.md §6. The next step is
 * feeding recorded video through detectForVideo and asserting against per-rep labels; the
 * assertion style below carries over unchanged.
 */
(function () {
  const X = window.__exercise;
  if (!X) throw new Error("window.__exercise missing — open index.html first");

  // MediaPipe world convention: x right, y down, z depth (+z away from camera).
  // Person faces the camera, so their RIGHT side sits at negative x.
  const base = () => ({
    11: { x: 0.2, y: -0.5, z: 0 },  12: { x: -0.2, y: -0.5, z: 0 },   // shoulders L, R
    13: { x: 0.2, y: -0.25, z: 0 }, 14: { x: -0.2, y: -0.25, z: 0 },  // elbows
    15: { x: 0.2, y: 0.0, z: 0 },   16: { x: -0.2, y: 0.0, z: 0 },    // wrists, arms hanging
    23: { x: 0.1, y: 0.0, z: 0 },   24: { x: -0.1, y: 0.0, z: 0 },    // hips
    25: { x: 0.1, y: 0.45, z: 0 },  26: { x: -0.1, y: 0.45, z: 0 },   // knees
    27: { x: 0.1, y: 0.9, z: 0 },   28: { x: -0.1, y: 0.9, z: 0 },    // ankles
  });
  // screen-space landmarks; only the hip/ankle/shoulder x values matter (hip-shift rule)
  const screenPose = (hipX) => {
    const s = {};
    for (const k in base()) s[k] = { x: 0.5, y: 0.5 };
    Object.assign(s, {
      11: { x: .6, y: .3 }, 12: { x: .4, y: .3 },
      23: { x: (hipX ?? .55), y: .55 }, 24: { x: (hipX ?? .55) - .1, y: .55 },
      27: { x: .55, y: .95 }, 28: { x: .45, y: .95 },
    });
    return s;
  };
  const screen = screenPose();
  const cal = X.buildCalibration(Array.from({ length: 30 }, () => X.calibSample(screen, base())));
  const ex = Object.fromEntries(X.EXERCISES.map(e => [e.key, e]));
  const deg = (key, wlm, scr) => ex[key].metric(scr || screen, wlm, cal);
  const rule = (key, id, wlm, scr) =>
    ex[key].form.find(r => r.id === id).check(scr || screen, wlm, cal);

  const rad = d => d * Math.PI / 180;
  const results = [];
  const near = (label, got, want, tol) => results.push({
    label, pass: Math.abs(got - want) <= (tol ?? 1), detail: got.toFixed(1) + " vs " + want + "°",
  });
  const is = (label, got, want) => results.push({
    label, pass: got === want, detail: (got ? "ok" : "VIOLATION") + ", expected " + (want ? "ok" : "VIOLATION"),
  });

  // --- body axes -------------------------------------------------------------------------------
  const f = X.bodyFrame(base());
  const axis = (label, v, want) => results.push({
    label, pass: Math.abs(v.x - want[0]) < 1e-6 && Math.abs(v.y - want[1]) < 1e-6 && Math.abs(v.z - want[2]) < 1e-6,
    detail: [v.x, v.y, v.z].map(n => n.toFixed(2)).join(","),
  });
  axis("axis up is -y", f.up, [0, -1, 0]);
  axis("axis right is -x (person's right)", f.right, [-1, 0, 0]);
  axis("axis forward is -z (toward camera, anterior)", f.forward, [0, 0, -1]);

  // --- plane separation for the two arm raises -------------------------------------------------
  const armSide = base(); armSide[16] = { x: -0.8, y: -0.5, z: 0 }; armSide[14] = { x: -0.5, y: -0.5, z: 0 };
  near("arm out to the side reads abduction 90", deg("abduction", armSide), 90);
  near("...and does not leak into flexion", deg("flexion", armSide), 0);

  const armFwd = base(); armFwd[16] = { x: -0.2, y: -0.5, z: -0.6 }; armFwd[14] = { x: -0.2, y: -0.5, z: -0.3 };
  near("arm straight forward reads flexion 90", deg("flexion", armFwd), 90);
  near("...and does not leak into abduction", deg("abduction", armFwd), 0);

  // --- trunk directions, including the sign of `forward` ---------------------------------------
  const tilt = (angle, ax) => { // ax: 'back' | 'fwd' | 'side'
    const p = base(), s = Math.sin(rad(angle)), c = Math.cos(rad(angle));
    const dz = ax === "back" ? 0.5 * s : ax === "fwd" ? -0.5 * s : 0;
    const dx = ax === "side" ? -0.5 * s : 0;
    p[11] = { x: 0.2 + dx, y: -0.5 * c, z: dz };
    p[12] = { x: -0.2 + dx, y: -0.5 * c, z: dz };
    return p;
  };
  near("leaning back 20 reads extension 20", deg("extension", tilt(20, "back")), 20);
  near("leaning FORWARD must not read as extension", deg("extension", tilt(20, "fwd")), 0);
  near("side bend 20 reads lateral flexion 20", deg("lateralFlexion", tilt(20, "side")), 20);
  near("side bend does not leak into extension", deg("extension", tilt(20, "side")), 0);

  const twisted = (angle, alsoHips) => {
    const p = base(), s = Math.sin(rad(angle)), c = Math.cos(rad(angle));
    p[11] = { x: 0.2 * c, y: -0.5, z: 0.2 * s };
    p[12] = { x: -0.2 * c, y: -0.5, z: -0.2 * s };
    if (alsoHips) {
      p[23] = { x: 0.1 * c, y: 0, z: 0.1 * s };
      p[24] = { x: -0.1 * c, y: 0, z: -0.1 * s };
    }
    return p;
  };
  near("shoulder twist 30 reads rotation 30", deg("rotation", twisted(30)), 30);
  near("twist does not leak into lateral flexion", deg("lateralFlexion", twisted(30)), 0);

  // --- squat depth -----------------------------------------------------------------------------
  const parallel = () => {
    const p = base();
    p[24] = { x: -0.1, y: 0.45, z: 0 }; p[26] = { x: -0.1, y: 0.45, z: -0.45 }; p[28] = { x: -0.1, y: 0.9, z: -0.45 };
    p[23] = { x: 0.1, y: 0.45, z: 0 };  p[25] = { x: 0.1, y: 0.45, z: -0.45 };  p[27] = { x: 0.1, y: 0.9, z: -0.45 };
    p[11] = { x: 0.2, y: 0.0, z: 0 };   p[12] = { x: -0.2, y: 0.0, z: 0 };
    return p;
  };
  near("parallel squat reads interior 90", deg("squat", parallel()), 90);

  // --- form rules: each must fire on its own fault and stay quiet on clean form -----------------
  is("clean parallel squat: no valgus", rule("squat", "valgus", parallel()), true);
  is("clean parallel squat: no lean fault", rule("squat", "lean", parallel()), true);
  is("clean parallel squat: symmetric", rule("squat", "symmetry", parallel()), true);

  const caveR = parallel(); caveR[26] = { x: 0.05, y: 0.45, z: -0.45 };
  is("right knee caving inward trips valgus", rule("squat", "valgus", caveR), false);
  const caveL = parallel(); caveL[25] = { x: -0.05, y: 0.45, z: -0.45 };
  is("left knee caving inward trips valgus", rule("squat", "valgus", caveL), false);
  const wide = parallel(); wide[26] = { x: -0.3, y: 0.45, z: -0.45 }; wide[25] = { x: 0.3, y: 0.45, z: -0.45 };
  is("knees tracking WIDE is not valgus", rule("squat", "valgus", wide), true);
  const asym = parallel(); asym[25] = { x: 0.1, y: 0.2, z: -0.25 };
  is("one leg straighter trips symmetry", rule("squat", "symmetry", asym), false);

  const bentElbow = base();
  bentElbow[14] = { x: -0.5, y: -0.5, z: 0 }; bentElbow[16] = { x: -0.55, y: -0.75, z: 0 };
  is("bent elbow trips the abduction elbow rule", rule("abduction", "elbow", bentElbow), false);
  const shrug = base();
  shrug[16] = { x: -0.8, y: -0.62, z: 0 }; shrug[14] = { x: -0.5, y: -0.62, z: 0 }; shrug[12] = { x: -0.2, y: -0.62, z: 0 };
  is("raised shoulder trips the shrug rule", rule("abduction", "shrug", shrug), false);
  const cleanAbd = base(); cleanAbd[16] = { x: -0.8, y: -0.5, z: 0 }; cleanAbd[14] = { x: -0.5, y: -0.5, z: 0 };
  is("clean abduction: no shrug", rule("abduction", "shrug", cleanAbd), true);
  is("clean abduction: elbow straight", rule("abduction", "elbow", cleanAbd), true);
  is("clean abduction: stays in the frontal plane", rule("abduction", "plane", cleanAbd), true);
  const scaption = base(); scaption[16] = { x: -0.62, y: -0.5, z: -0.42 }; scaption[14] = { x: -0.4, y: -0.5, z: -0.25 };
  is("arm drifting forward trips the abduction plane rule", rule("abduction", "plane", scaption), false);

  const shifted = screenPose(0.75); // pelvis slid well off the ankle line
  is("hip shift trips the lateral flexion hips rule",
    rule("lateralFlexion", "hips", tilt(25, "side"), shifted), false);
  is("bending without shifting keeps the hips rule quiet",
    rule("lateralFlexion", "hips", tilt(25, "side")), true);
  is("bending without twisting keeps the rotate rule quiet",
    rule("lateralFlexion", "rotate", tilt(25, "side")), true);

  is("pelvis turning with the shoulders trips the rotation pelvis rule",
    rule("rotation", "pelvis", twisted(30, true)), false);
  is("shoulders-only twist keeps the pelvis rule quiet",
    rule("rotation", "pelvis", twisted(30)), true);

  const kneeBend = tilt(20, "back");
  kneeBend[26] = { x: -0.1, y: 0.45, z: -0.35 }; kneeBend[25] = { x: 0.1, y: 0.45, z: -0.35 };
  is("bending the knees trips the extension knees rule", rule("extension", "knees", kneeBend), false);
  is("straight knees keep the extension knees rule quiet", rule("extension", "knees", tilt(20, "back")), true);

  // --- report ----------------------------------------------------------------------------------
  const failed = results.filter(r => !r.pass);
  results.forEach(r => console.log((r.pass ? "PASS  " : "FAIL  ") + r.label + "   [" + r.detail + "]"));
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed");
  if (failed.length) console.error("FAILURES:\n" + failed.map(r => "  " + r.label + " — " + r.detail).join("\n"));
  return { total: results.length, failed: failed.length, failures: failed.map(r => r.label) };
})();
