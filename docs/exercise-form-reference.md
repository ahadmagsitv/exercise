# Exercise Form Reference

Clinical range-of-motion norms and form criteria backing the rule engine in `index.html`.
Every threshold in the code traces to a row in this document. When you change a number in
`EXERCISES`, change it here too and say why.

**Status:** the geometry is verified (`tests/geometry-check.js`, 34 assertions). The *threshold
values* are research-grounded starting points that have **not** been validated against labelled
video of real people. See [§6](#6-testing-and-threshold-tuning).

---

## 1. Normative range of motion

### AAOS (American Academy of Orthopaedic Surgeons) reference values

| Joint / motion | Normal ROM |
|---|---|
| Shoulder flexion | 0–180° |
| Shoulder abduction | 0–180° |
| Shoulder extension | 0–60° |
| Shoulder internal rotation | 0–70° |
| Shoulder external rotation | 0–90° |
| Knee flexion | 0–135° |
| Hip flexion | 0–120° |
| Hip extension | 0–30° |
| Thoracolumbar flexion | 0–80° |
| Thoracolumbar extension | 0–25° |
| Thoracolumbar lateral flexion (each side) | 0–35° |
| Thoracolumbar rotation (each side) | 0–45° |

Sources: [AAOS ROM chart](https://goniometer.io/range-of-motion), [AAOS normal ROM values (LWW supplement)](https://cdn-links.lww.com/permalink/prsgo/b/prsgo_8_6_2020_04_17_hendriks_gox-d-20-00155r2_sdc1.pdf)

> **Caveat on trunk extension.** AAOS gives 25° for the *thoracolumbar* segment. Isolated
> *lumbar* extension is often cited far lower (~8°), because standing back-bend recruits hips
> and knees. The app measures whole-trunk deviation, so 25° is the right reference — but the
> knee-lock form rule exists precisely because the hip/knee compensation is what inflates it.

### Squat depth classification (knee flexion angle)

| Depth | Knee flexion | Interior hip–knee–ankle angle (what the code measures) |
|---|---|---|
| Mini squat | 40–50° | 130–140° |
| Parallel squat | 70–90° | 90–110° |
| Deep squat | >110–130° | <50–70° |

Parallel is defined as the femur reaching parallel to the floor, which corresponds to roughly
90° of knee flexion.

Sources: [ISSA — Squat Depth: How Low Is Too Low?](https://www.issaonline.com/blogs/training-tips/squat-depth-how-low-is-too-low), [IJSPT — A Biomechanical Review of the Squat Exercise](https://ijspt.scholasticahq.com/article/94600-a-biomechanical-review-of-the-squat-exercise-implications-for-clinical-practice), [The Biomechanics of Squat Depth](https://www.lookgreatnaked.com/articles/the_biomechanics_of_squat_depth.pdf)

> **Sign convention.** The code's `metric` for squat is the *interior* hip–knee–ankle angle:
> standing ≈ 180°, deeper = smaller. Knee flexion = `180 − interior`. Do not mix the two.

### Trunk rotation

45° per side is the standard pass criterion for the seated trunk rotation screen, matching the
AAOS thoracolumbar value.

Source: [TPI — The Seated Trunk Rotation Test](https://www.mytpi.com/articles/screening/the-seated-trunk-rotation-test)

---

## 2. Compensation patterns worth detecting

### Knee valgus (squat)

Dynamic knee valgus is assessed clinically via the **frontal plane projection angle (FPPA)** —
the hip–knee–ankle angle projected into the frontal plane. The screening criterion in the
literature is an **increase of ≥10° from the participant's own baseline**, not an absolute
angle. Reliability of 2D video FPPA is good (within-day ICC .59–.88, between-day .72–.91).

This is why the app calibrates each user's neutral standing knee alignment and checks
*deviation*, rather than assuming a perfectly stacked leg.

> **Implementation note — why not literal FPPA.** The first implementation computed FPPA by
> projecting the thigh and shank into the frontal plane. It flagged every clean parallel squat.
> At parallel the thigh is horizontal and points almost purely forward, so projecting it into the
> frontal plane yields a **zero-length vector** and the angle is undefined — the measure
> degenerates at exactly the depth it is needed. The shipped rule instead measures how far the
> knee sits off the hip→ankle line along the body's lateral axis, normalised by leg length. A
> knee offset `d` on a leg of length `L` subtends roughly `2·asin(2d/L)`, so the literature's 10°
> criterion maps to `d/L ≈ 0.044` (`KNEE_DEV_LIMIT`). The check is **directional** — knees
> tracking wide (varus) are not flagged. Both behaviours are covered in
> `tests/geometry-check.js`.

Sources: [Association between Selected Screening Tests and Knee Alignment (PMC9179976)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9179976/), [Reliability of 2D video assessment of frontal-plane dynamic knee valgus](https://pubmed.ncbi.nlm.nih.gov/22104115/), [Dynamic knee valgus in female runners (PMC9221657)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9221657/)

### Shoulder shrug / scapular substitution (abduction, flexion)

Scapulohumeral rhythm is approximately **2:1** — 2° of humeral motion per 1° of scapular upward
rotation. The first **0–30°** of abduction is the "setting phase", during which the scapula
stays essentially stationary and motion is glenohumeral. Elevating the shoulder girdle early
("shrug sign") is a recognised scapulohumeral dysrhythmia and the classic cheat when
glenohumeral range or strength is lacking.

Two consequences for the app:
- The `restValue: 30` threshold for abduction/flexion is not arbitrary — it is the top of the
  setting phase, so "arm at rest" is clinically defensible.
- Shrug is detected as **shoulder-to-hip distance growing beyond its calibrated baseline**,
  which is why calibration must be captured in relaxed standing.

Sources: [Orthofixar — Scapulohumeral Rhythm](https://orthofixar.com/special-test/scapulohumeral-rhythm/), [Hand Therapy Academy — Scapulohumeral Rhythm Degrees](https://www.handtherapyacademy.com/treatments/increase-shoulder-range-by-improving-scapulohumeral-rhythm/), [Systematic review of scapular stabiliser exercises (PMC4886800)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4886800/)

### Trunk lateral flexion

Proper form is bending the trunk laterally **without shifting the hips and without rotating or
leaning forward/backward**. Hips and feet stay facing forward. The two documented compensations
are trunk rotation and hip shift — both are implemented as form rules.

Sources: [MAT Assessment — Spine Lateral Flexion Test](https://www.matassessment.com/blog/spine-lateral-flexion-test), [The BioMechanics Method — Assess and Improve Trunk Rotation](https://www.thebiomechanicsmethod.com/2023/02/24/how-to-assess-and-improve-trunk-rotation/)

### Trunk rotation

Limited thoracic rotation causes people to substitute with **excessive lumbar rotation or
uncontrolled pelvic rotation**, or to over-use the shoulder joint and present shoulder movement
as trunk rotation. The app's rule compares hip-line rotation against shoulder-line rotation and
flags a rep when the pelvis turns with the trunk.

Sources: [TPI — Seated Trunk Rotation Test](https://www.mytpi.com/articles/screening/the-seated-trunk-rotation-test), [MAT Assessment — Spine Rotation Test](https://www.matassessment.com/blog/spine-rotation-test)

### Trunk extension

Standing back-bend is contaminated by hip and knee motion unless controlled for; assessment
guidance is explicitly to look for motion in the lumbar spine *versus* the hip and knees. Hence
the knee-lock rule.

Sources: [CSS Physio — Lumbar Spine Flexion & Extension Impairments](https://www.cssphysio.com.au/post/lumbar-spine-assessment-flexion-extension-impairments), [MAT Assessment — Spine Extension Test](https://www.matassessment.com/blog/spine-extension-test)

### Squat trunk lean

Trunk and tibia inclination have *opposite* effects on the knee flexion moment — forward trunk
inclination decreases it, forward tibial inclination increases it. So some forward lean is
normal and mechanically useful; the coaching target is avoiding **excessive** trunk flexion and
lumbar rounding, not zero lean. The rule threshold is set permissively (45°) for that reason.

Source: [IJSPT — Biomechanical Review of the Squat Exercise](https://ijspt.scholasticahq.com/article/94600-a-biomechanical-review-of-the-squat-exercise-implications-for-clinical-practice)

---

## 3. Measurement accuracy — what MediaPipe can and cannot support

MediaPipe is a reasonable markerless option for this class of application, but its accuracy is
**highly sensitive to camera geometry**, and error in shoulder abduction specifically has been
observed to *grow with both camera offset and increasing abduction angle*. In one validation
study, diagonal camera positions degraded detection of the shoulder and waist centres from RGB
images, and the authors recovered accuracy (MAPE ≈1.5% over 0–160°) only by adding a two-stage
LightGBM model that first estimates camera position and then corrects the angle — i.e. **that
headline accuracy is a corrected pipeline, not raw MediaPipe landmarks.**

Practical implications baked into the implementation:

1. **Prefer world landmarks over screen landmarks.** World landmarks are metric 3D; screen `z`
   is a coarse monocular estimate. All six metrics were migrated to world landmarks.
2. **Prefer body-relative frames over image axes.** Every angle is computed against the user's
   own calibrated `up`/`right`/`forward` axes, which removes camera tilt and much of camera
   yaw from the measurement.
3. **Prefer deltas from a personal baseline over absolute angles.** Valgus, shrug, and hip
   shift are all measured as deviation from the user's own calibrated neutral, which is both
   the clinical convention (FPPA) and the robust choice given landmark bias.
4. **Sagittal-plane motion remains the weak axis.** Trunk extension and, to a lesser degree,
   arm flexion depend on depth, which is the least-observed direction for a single front-facing
   camera. Treat those two as lower-confidence than squat / abduction / lateral flexion.

Sources: [Measurement of Shoulder Abduction Angle with Posture Estimation AI (PMC10416158)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10416158/), [Markerless joint angle estimation using MediaPipe (Springer)](https://link.springer.com/article/10.1007/s11042-026-21256-z), [Human Pose Estimation Using MediaPipe Pose and Humanoid Model Optimisation (MDPI)](https://www.mdpi.com/2076-3417/13/4/2700)

---

## 4. Implemented thresholds

`rest` / `active` drive rep detection (hysteresis). `minROM` gates whether a rep counts at all.
`targetROM` is the full-range goal — missing it flags the rep but still counts it.

| Exercise | Metric | rest | active | minROM | targetROM | Clinical normal |
|---|---|---|---|---|---|---|
| Chair Squat | interior hip–knee–ankle angle | 150° | 130° | 105° | 90° | 90° interior = parallel |
| Abduction | arm vs trunk axis, frontal plane | 30° | 80° | 90° | 140° | 180° |
| Flexion | arm vs trunk axis, sagittal plane | 30° | 80° | 90° | 140° | 180° |
| Lateral Flexion | trunk lean along calibrated right axis | 8° | 15° | 20° | 30° | 35° |
| Rotation | shoulder-line twist about calibrated up axis | 8° | 20° | 30° | 45° | 45° |
| Extension | trunk lean along calibrated backward axis | 5° | 12° | 15° | 22° | 25° |

`targetROM` sits deliberately below the clinical normal — normals are passive/assisted maxima
measured by goniometer, and demanding them from an unassisted rep in front of a webcam would
flag almost every rep.

### Form rules

| Exercise | Rule | Criterion | Basis |
|---|---|---|---|
| Squat | `depth` | peak interior ≤ 90° | parallel squat definition |
| Squat | `lean` | \|sagittal trunk lean\| < 45° | avoid excessive trunk flexion |
| Squat | `valgus` | knee-off-hip→ankle-line within 0.044·legLength of calibrated baseline, medial direction only, both knees | FPPA ≥10° screening criterion |
| Squat | `symmetry` | \|right knee − left knee\| < 15° | load-sharing / favouring one leg |
| Abduction | `elbow` | shoulder–elbow–wrist > 150° | straight-arm requirement |
| Abduction | `shrug` | shoulder–hip distance < 1.08 × baseline | shrug sign / scapular substitution |
| Abduction | `plane` | arm's forward component < 20° off frontal | keep it abduction, not scaption |
| Abduction | `lean` | \|lateral trunk lean\| < 12° | trunk side-lean substitution |
| Abduction | `range` | peak ≥ 140° | full-ROM goal |
| Flexion | `elbow`, `shrug`, `lean`, `range` | as abduction | as abduction |
| Flexion | `plane` | arm's lateral component < 20° off sagittal | keep it flexion, not scaption |
| Lateral Flexion | `rotate` | trunk twist < 15° | documented compensation |
| Lateral Flexion | `sagittal` | \|forward/back lean\| < 15° | documented compensation |
| Lateral Flexion | `hips` | hip-over-ankle shift < 0.35 × shoulder span | hip shift compensation |
| Lateral Flexion | `range` | peak ≥ 30° | ROM goal vs 35° normal |
| Rotation | `pelvis` | hip-line twist < 0.5 × shoulder twist + 8° | uncontrolled pelvic rotation |
| Rotation | `sidebend` | \|lateral lean\| < 12° | isolate rotation |
| Rotation | `range` | peak ≥ 45° | AAOS normal |
| Extension | `knees` | both knee angles > 155° | hip/knee compensation in back-bend |
| Extension | `rotate` | trunk twist < 15° | keep it symmetric |
| Extension | `sidebend` | \|lateral lean\| < 12° | keep it symmetric |
| Extension | `range` | peak ≥ 22° | ROM goal vs 25° normal |

A rule must fail for **5 consecutive frames** before it is confirmed, so single-frame landmark
noise cannot flag a rep. Once confirmed it sticks for the remainder of that rep.

### Rep outcomes

| Outcome | When | Counted? |
|---|---|---|
| **clean** | reached `minROM`, no rule broken | yes, and counted as clean |
| **flagged** | reached `minROM`, at least one rule broken | yes, not clean; the first fault is shown |
| **partial** | never reached `minROM` | no — discarded, tallied separately |

---

## 5. Calibration

Rep counting cannot start until a 1-second neutral standing pose is captured. The baseline stores:

| Field | Use |
|---|---|
| `up`, `right`, `forward` | body-local axes; every subsequent angle is relative to these |
| `hipRight` | pelvis orientation, for the rotation `pelvis` rule |
| `torso` | shoulder→hip distance, for the `shrug` rule |
| `kneeR`, `kneeL` | per-user neutral knee alignment, for the `valgus` rule |
| `hipOverAnkle`, `span` | normalised pelvis position, for the `hips` rule |

This is what makes the thresholds body-proportion independent and camera-tilt independent, and
it is what replaced the previous screen-space `z` heuristics for lateral flexion, rotation, and
extension.

Calibration restarts itself if the user leaves frame mid-capture — a half-captured baseline is
worse than none, because every rule is expressed as a deviation from it.

### Only the squat needs legs

Requiring the whole body made the app unusable at a desk, which is where most people first open
it. But of the six exercises, **only the squat reads anything below the hips**. The other five
need shoulders, hips, and (for the arm raises) one elbow and wrist.

So calibration requires the **torso only**. Legs are optional:

| | legs in frame | legs not in frame |
|---|---|---|
| Calibration | requires a standing pose | accepts the user's neutral seated torso |
| `cal.hasLegs` | `true` | `false` |
| `cal.kneeR` / `kneeL` / `hipOverAnkle` | measured | **`null`**, never `0` |
| Chair Squat | available | dimmed, "your legs and feet in frame" |
| Other five | available | available |

Each exercise declares a `needs` array of the landmarks its metric *and its rules* actually
read — not just the two or three that get drawn — and is gated on those every frame. The panel
dims what is unavailable and says what would enable it.

Two rules depend on leg baselines and become no-ops rather than misfiring when there are none:
Lateral Flexion's `hips` (no ankle reference to measure a shift against) and Extension's `knees`.

Leg-derived baselines are `null` rather than `0` for the usual reason: a `0` reads as a real
measurement and would silently poison the valgus and hip-shift rules.

### Calibration must say why it is blocked

`calibrationBlocker(lm, wlm)` returns an actionable sentence, or `null` when ready, and the
calibration screen shows it. Gates, in order: pose present → **legs and feet** visible and inside
the frame → whole body visible and inside the frame → standing (both knees above
`STANDING_INTERIOR` = 150°).

This exists because the first live test sat at 0% forever with no explanation. The user was
seated at a desk, so MediaPipe was extrapolating their legs at low confidence — correctly
refused, but indistinguishable from a broken app. A progress bar stuck at zero with no reason is
the worst failure mode here.

Note that MediaPipe *extrapolates* joints it cannot see rather than omitting them, so an
out-of-shot leg arrives either as a low-confidence landmark or as coordinates outside 0…1. Both
are checked.

| Situation | Message |
|---|---|
| No pose at all | "I can't see anyone — step into view." |
| Seated / legs not visible | "Step back so your legs and feet are in frame — sitting at a desk won't work." |
| Torso partly out of frame | "Step back so your whole body is in frame." |
| Visible but crouching | "Stand up straight to start." |

**Axis signs are verified**, not assumed: `tests/geometry-check.js` asserts `up = -y`,
`right = -x` (the person's own right), and `forward = -z` (anterior, toward the camera), and
separately asserts that leaning *forward* does not register as trunk extension. If MediaPipe
ever changes its world-landmark convention, those three assertions fail first.

---

## 6. Testing and threshold tuning

### What is tested today

`tests/geometry-check.js` drives the real metrics and form rules with synthetic skeletons — no
camera, no video. 34 assertions covering:

- the three body axes and their signs;
- plane separation (arm to the side reads abduction 90° and flexion 0°, and vice versa);
- direction (leaning forward must not read as extension; twisting must not read as side bend);
- every form rule firing on the fault it was written for **and** staying quiet on clean form.

Run it by serving the project, opening `index.html`, and pasting the file into the DevTools
console; it prints a pass/fail line per assertion. `index.html` exposes `window.__exercise` for
this purpose.

This catches sign errors, unit errors, and cross-triggering. It **cannot** tell you whether a
threshold is set at the right value for real humans — synthetic poses are exactly as clean or as
faulty as you make them.

### What real recorded data says (`tests/replay-check.js`)

The rules have now been replayed over **25 real MediaPipe recordings** (33 world + 33 image
landmarks per frame, 12 FPS, front-facing squats) borrowed from the SquatWell iOS project. The
clips are not copied into this repo; the harness is pointed at them. See the file header for how
to run it.

Only the **squat** rules get real-data coverage — every clip is a squat. The other five
exercises remain synthetic-only.

**The geometry is confirmed against an independent implementation.** SquatWell computes knee
flexion as `180 − interiorAngle` over the same world landmarks this app reads with
`jointAngle(wlm, 24, 26, 28)`. Across **663 frames** the two sums differ by at most
**2.3 × 10⁻¹³ degrees** — floating-point noise. Two separately written codebases read the same
geometry identically.

Three findings that synthetic poses could never have produced:

1. **`restValue` was 160 and lost 41% of reps — now 150. FIXED.**
   A rep only completes when the knee returns above `restValue`. At 160° interior (under 20° of
   flexion) that demanded a near-lockout, and real people finish a squat without locking out, so
   the rep stayed open forever — never counted, never graded, no feedback at all. 7 of 17 clips
   were affected. SquatWell's equivalent threshold is 150°.

   Lowered to 150°, which also aligns it with `STANDING_INTERIOR`, the definition calibration
   uses, so "standing enough to calibrate" and "standing enough to end a rep" cannot drift apart.

   | | 160° | 150° |
   |---|---|---|
   | clips producing a rep | 10 / 17 | **14 / 17** |
   | reps never closing | 7 | **3** |

   The 3 that remain (`IMG_3547`, `IMG_3549_3`, `Walter_squat_5`) genuinely end while the person
   is still down — there is no return-to-standing in the recording to detect.

2. **A rule could be recorded twice in one rep.** If a rule failed, recovered, then failed again,
   the streak hit `VIOLATION_FRAMES` a second time and pushed a duplicate label — `IMG_2522`
   reported "symmetry" twice. Fixed with a re-trigger guard in `index.html`.

3. **8 of 25 clips have no standing frames at all**, so calibration correctly refuses them. Worth
   noting that SquatWell silently substituted a mid-squat frame in exactly these cases; refusing
   is the better behaviour, but the app needs a graceful message for "your clip starts too late".

Rule firing rates on the 10 clips that did produce a rep: `depth` 50%, `valgus` 50%, `lean` 30%,
`symmetry` 30%. No rule is dead, none fires on everything. Whether 50% valgus is real or a
too-tight threshold cannot be answered without labels.

### Frame rate is a hidden dependency

The recordings are 12 FPS; a webcam is typically 30–60. Both debounce constants are expressed in
**frames**, not seconds:

| constant | at 12 FPS | at 60 FPS |
|---|---|---|
| `VIOLATION_FRAMES = 5` | 417 ms | 83 ms |
| EMA `alpha = 0.25` | slow | 5× faster |

So a fault must be held five times longer at 12 FPS before it counts, and the smoothing time
constant moves with the frame rate too. **Any threshold tuned at one frame rate does not
transfer to another.** Converting both to milliseconds using real frame timestamps would remove
the coupling.

### What still needs real video

1. Record 10–20 clips per exercise, deliberately split good-form / bad-form, labelled per rep.
2. Extend the harness to feed those files through `detectForVideo` instead of `getUserMedia`, so
   runs are deterministic and repeatable. The assertion style in `geometry-check.js` carries over.
3. Tune `active`/`rest` for rep-count accuracy first (precision/recall on rep events), *then*
   tune form rules against the good/bad labels. Tuning both at once conflates the two errors.
4. Keep the harness as a regression test. It is the only way to know a threshold change did not
   break rep counting.

Expect the noisiest results on trunk **extension** and arm **flexion** — both are sagittal, and
depth is the weak axis for a single front-facing camera (§3).

Camera setup matters as much as any threshold: front-on, full body in frame, even lighting,
and a fixed camera. Accuracy degrades measurably with camera offset angle.

Camera setup matters as much as any threshold: front-on, full body in frame, even lighting,
and a fixed camera. Accuracy degrades measurably with camera offset angle.
