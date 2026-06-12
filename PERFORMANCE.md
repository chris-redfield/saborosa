# Performance Plan — make Saborosa lightweight (weak/old hardware)

## ✅ RESOLVED (2026-06-13, perf4.jpeg): locked 60fps on the test machine

Final readout on the previously-lagging machine, same scene that measured
1084ms/frame at the start: **frame 16.7 (max 16.7), fps 60, work 2.1ms,
entities 0.6ms (was 974), ground 0.7ms (was 85.5), upd/frame 1, long(5s) 0.**

The `gpu` HUD line settled the hardware question: `ATI Radeon HD…` — an OLD
GPU with tiny VRAM (256–512MB era), NOT software rendering. Root cause across
the whole saga: **total decoded-image footprint (~1.3GB images + ~370MB
sheets) could never fit that VRAM**, so textures were evicted/re-uploaded
(and decode-cache thrashed) every frame. Every fix below reduced footprint or
per-frame image work; once the full set fit (~75MB), the old card ran 60fps.

What got it there, in order of impact:
1. Sheet + layer **ImageBitmap decode-once** (+ freeing the <img> copies).
2. **Offline right-sizing**: island layers at 0.4x; sprite sheets' `-game`
   copies at 0.25–0.45x (matched to max draw scale). 368MB sheets → 55MB.
3. **Sample-once-then-free** zoning/silhouette masters; lazy toggle layers.
4. **Viewport-culled** background blits; opaque canvas (`alpha:false`).
5. Loop hardening: `deltaTime` clamp (no catch-up spiral).

Phase 2 (smoothing-off) and the low-res mode were NOT needed — left below as
contingencies for even weaker targets (true software rendering / mobile).

---

Goal (original): smooth gameplay on weak hardware. Initial state: perfect on
a modern GPU machine, ~1fps on the test machine.

---

## 1. Why the new background DOES cost more (it's not the logic — it's the data)

"The new background uses the same logic as the previous one" — true, and that's
exactly why it *seems* to make no sense. The logic is identical; the **data
volume is ~5–7x**. Measured:

| State | Layers resident | Px/layer | Decoded RAM |
|---|---|---|---|
| Before `8c117e1` (old fundo-02) | 3 | 4679x3624 = 17M | **~195 MB** |
| `8c117e1` (V2 at full size) | 3 | 13857x10187 = 141M | ~1.7 GB (!) |
| `912acdd` (V2 scaled to 0.6x) | 3 | 8314x6112 = 51M | ~580 MB |
| `4e0b2f8` (island added) → today | 5 (+2 ImageBitmaps) | 8314x6112 | **~1.0–1.35 GB** |

The five 8314x6112 images alive today: `stage3_bg` (zoning), island
lower/overlay (displayed, + their ImageBitmap copies), V2 lower/overlay
(`_color`, for the map toggle + occlusion silhouette).

On a GPU machine: textures live in VRAM, resampling is free → no symptom.
On a no-GPU machine: every drawImage is CPU-resampled, and ~1.3 GB of decoded
pixels fights the OS for RAM → eviction/re-decode churn + slow blits = lag.
**So both commits you flagged are "guilty": `8c117e1` ballooned px/layer (3x),
`4e0b2f8` ballooned layer count (3 → 5+2).**

---

## 2. The measuring tool (already implemented) — hold **C**

A perf panel now renders top-right while the debug key is held (`src/engine/perf.js`,
instrumented in `game.js`/`main.js`/`world.js`). Zero per-frame allocation;
near-zero overhead when hidden.

| Line | Meaning | Healthy |
|---|---|---|
| `frame / avg / max / fps` | rAF-to-rAF time. `max` is a ~2s decaying peak — GC/decode spikes show here | 16.7ms / 60fps |
| `work` | measured JS time (update + render) | < 8ms |
| `other` | `frame - work`. At 60fps it's just vsync idle (ignore). **At low fps, big `other` = the browser itself is the bottleneck (canvas present / software raster / decode), not our JS** | — |
| `long(5s)` | frames >33ms in the last 5s — hitch counter (GC, decode, eviction) | 0–1 |
| `update` | game logic (all catch-up steps summed) | < 3ms |
| `render` | total draw | < 6ms |
| `ground` / `overlay` | the two big background blits — **the prime no-GPU suspects** | < 2ms each |
| `entities` | depth-sort + sprite draws | < 2ms |
| `fx` | ambient FX draws | < 0.5ms |
| `zone` / `behind` | calls/frame to getZoneAt / isSpriteBehindMountain | ~dozens / 1–3 |
| `upd/frame` | fixed-timestep catch-up steps. Sustained ≥2 = machine below 60Hz **and paying double in updates** | 1 |
| `drawn` | entities drawn vs total alive | — |
| `heap` | JS heap (Chrome only; does NOT include decoded images) | steady, not sawtooth |

### What to capture on the friend's machine
Hold C and note, while standing still AND while moving (the difference is the
diagnosis): `fps`, `work` vs `other`, `ground`, `overlay`, `entities`,
`upd/frame`, `long(5s)`. Two archetype readings:
- **`other` dominates, work small** → browser-side: software present/raster or
  memory thrash → Phase 1 (memory diet) + Phase 2 (cheaper blits).
- **`work` dominates** → our JS: see which section is fat → Phase 2/3.

---

## 3. Bottleneck inventory (hypothesis → HUD signal → fix)

### R1. Big-layer blits (ground + overlay) — PRIME SUSPECT
Two 8314x6112 sources resampled to the viewport every frame. GPU: free.
CPU: bilinear-samples ~0.9M dest px × 2 layers × 2x2 taps each.
- Signal: `ground`/`overlay` ms high (esp. while moving), fps low.
- Fixes: (a) `imageSmoothingEnabled = false` for these two blits (nearest
  sampling ≈ 2–4x cheaper; art is line-art over flat sand — visual diff tiny);
  (b) smaller display masters (see M1 — fewer source bytes touched per tap =
  better cache locality).

### R2. Browser present/composite (the invisible cost)
With no GPU the browser also *composites the canvas into the page* on CPU each
frame. We can't time it from JS — it's exactly the `other` gap at low fps.
- Signal: low fps + small `work` + big `other`.
- Fixes: (a) opaque context — `getContext('2d', { alpha: false })` (skips
  blending the canvas over the page; we fillRect the whole frame anyway);
  (b) ensure the canvas isn't CSS-upscaled (scaleCanvas already caps ≤1 — keep);
  (c) keep total canvas ops/frame low (everything else in this plan).

### R3. Decoded-image memory ≈ 1.0–1.35 GB
Five 51M-px images + 2 ImageBitmaps. Low-RAM machines: OS paging + browser
decode-cache eviction → re-decode hitches.
- Signal: `long(5s)` > 0 steadily, `frame max` spiky while avg is OK; system
  RAM pressure during play.
- Fixes (biggest wins, zero gameplay impact):
  (a) **`stage3_bg` (zoning master): sample once, then free.** It's never drawn;
      after `_ensureZoneData` caches the (≤6M px) zone map, drop the Image ref
      (`game.assets.images.stage3_bg = null`) so its ~193MB can be reclaimed.
      Cache the sampled zone data on `game` (not per-World) so stage reloads
      don't need the image again.
  (b) **`stage3_overlay_color` (silhouette): same** — sample `_mountainOverlay-
      Data` once, cache on `game`, free the image. (~193MB)
  (c) **`stage3_lower_color`: lazy-load on first toggle** to ZONING instead of
      eagerly at boot (~193MB + faster load). Or drop the toggle for shipping.
  (d) **Release the <img> behind the island ImageBitmaps** after bitmap creation
      (keep ~bitmaps only): saves the duplicate copies (~390MB).
  → end state: ~2 ImageBitmaps resident ≈ **390MB instead of ~1.35GB**.

### R4. Display-master resolution (the 0.6x decision)
8314x6112 was chosen for zoom-in sharpness (≈1:1 source:screen px at scale 1.0).
A 0.45x master (~6235x4584) is ~25% fewer bytes; 0.35x (~4850x3565) is ~66%
fewer and finally fits mobile's ~4096px texture cap (one more downscale step).
- Signal: R1/R3 confirmed but (a)–(d) not enough.
- Fix: regenerate via `tools/build-island-art.py` with a smaller TARGET; slight
  blur only at full zoom-in. Display-only — zoning keeps its own resolution.

### R5. Fixed-timestep catch-up multiplier
At 30fps the loop runs 2 updates/frame — a slow machine pays update cost twice.
Update is cheap today, but it makes every OTHER bottleneck 2x worse.
- Signal: `upd/frame` ≥ 2 sustained + `update` ms non-trivial.
- Fix: only worth touching if `update` is fat — optimize update content first
  (U1/U2), don't change the timestep model.

### U1. Per-frame allocation churn → GC hitches
`renderGame` allocates every frame: `getAllEntities()` builds a new array +
`.filter()` another + sort closures. The FX manager allocates on spawn (fine).
- Signal: `long(5s)` > 0 with sawtooth `heap`, `frame max` spikes ~every few s.
- Fix: reuse a persistent entities array (clear + repopulate in place),
  hoist the sort comparator. Cheap to do, removes steady garbage.

### U2. Zone/behind sampling volume
`getZoneAt` per entity per frame (drift loop) + player checks; `isSprite-
BehindMountain` scans the player bbox (~3.5k samples).
- Signal: `zone` calls surprisingly high (>200/frame) or `update` fat.
- Fix: only re-check zone for entities that actually MOVED this frame
  (skip resting rocks — most of them); keep player checks as-is.

### U3. Entity render cost
Each sprite drawImage is CPU-resampled under the camera scale; MapObjects
(trees) are large crops.
- Signal: `entities` ms high, scales with `drawn`.
- Fix: only if measured — tighter cull margin, pre-scaled sprite variants.

### M1. Download size (load time, not fps)
Island layers are RGBA on disk (~19MB total) since the format debugging.
- Fix (safe now under ImageBitmap, which decodes once regardless of PNG type):
  re-add palette quantization in `build-island-art.py` → ~2.3MB total.
  Keep as its OWN commit so any regression is unambiguous.

---

## 4. Phased plan (each phase = measure → change → re-measure on the friend's machine)

**Phase 0 — measure. DONE:** the C-key HUD. Get the friend's numbers (see §2).
**Phase 1 — memory diet (R3 a–d). DONE (2026-06-13):**
  - `world._sampleOnce()` — zone map + silhouette sampled once, cached on
    `game` (survives stage reloads), source images FREED right after. Warmed
    in `loadStage` so the one-time decode happens during load, never mid-frame.
  - `stage3_lower_color` no longer loaded at boot; the map toggle lazy-loads
    the V2 pair on first click ("Map: loading…").
  - The <img>s behind the island ImageBitmaps are dropped after creation.
**Phase 4a — resolution step-down (R4). DONE (2026-06-13), settled on 0.4x:**
  island layers rebuilt OFFLINE at 5543x4075 (`build-island-art.py`,
  `TARGET_W=5543`, sources no longer modified in place). 4096 was tried first
  (mobile-safe) but the ~2.15x in-game upscale made the ink read thick/soft;
  5543 (~1.6x upscale) was the user's sharpness/memory compromise. For a
  mobile build, re-run with `TARGET_W=4096` as a separate asset set.
  **RULE (user): NO post-processing of the art — plain resize only. An unsharp
  pass was tried and explicitly rejected; the art must stay exactly as drawn.**
  Download 19MB → 12MB.
  **Steady-state resident now: 2 ImageBitmaps (~172MB) + 2 cached samples
  (~48MB) ≈ 220MB — down from ~1.35GB.** All scaling is offline; runtime is
  draw-only.
**Phase 2 — cheap blits (R1a + R2a). NEXT IF STILL NEEDED:** smoothing off for
  the two layer blits (visual check vs line-art); opaque canvas
  (`getContext('2d', {alpha:false})`). Target: `ground`+`overlay` < 4ms
  combined on the no-GPU machine.
**Phase 3 — allocation cleanup (U1) + zone skip-resting (U2).**
  Target: `long(5s)` = 0, steady heap.
**Phase 4b — download re-quantize (M1)** as a final independent commit.
**Last resort — tiled/offscreen background** (pre-raster the visible region,
  re-blit by delta; redraw tiles on camera jumps). Complexity is real —
  only if Phases 1–4 don't reach the target.

**Definition of done:** on the no-GPU machine — 60fps stationary, ≥45fps while
moving with `long(5s)` ≤ 1; game loads with < 500MB total decoded image memory.

---

## 4b. MEASURED — friend's no-GPU machine HUD readout (perf.jpeg, 2026-06-13)

`fps 1, frame ~1084ms | work 1074.9, other 9.3 | update 3.1 | render ~1071 |
ground 89.8 | overlay ~41 avg | entities ~974 (13/209 drawn) | upd/frame 6 |
zone 2199 | heap 51MB`

Reading: it's OUR JS (`other` tiny), update side is CHEAP even at 6 catch-up
steps (C1/C2 are minor), and **`entities` is the fire: ~70ms PER SPRITE.**

**Root cause (C7): sprite-sheet decode thrash.** assets-001 (132MB decoded),
assets-002 (132MB) and the coconut sheet (104MB) lived as plain <img> sources;
on a low-memory no-GPU machine Chrome's discardable decode cache evicts them
between frames → every drawImage re-decodes a ~35M-px PNG. Same family as the
original background bug, on the sheets we hadn't converted.

**FIX (implemented 2026-06-13):** extended the ImageBitmap decode-once pattern
to ALL per-frame-drawn images — block/mapobjects/coconut/character/liverock
sheets, fx sheet, basket — created eagerly in `loadAssets`; every consumer
(environment, mapobject, liverock, portal, spritesheet incl. the coconut
bodyBaseline scan, fxobject) now draws via `game.getDrawable()`; the <img>
behind the three ≥100MB sheets is freed (no duplicate copy). Expected:
`entities` ~970ms → low single digits ms.

Remaining from that readout, in order: `ground` ~90ms + `overlay` ~41ms →
Phase 2 (smoothing off needs a visual OK from the user; opaque canvas is
free); after that the frame should fit even a weak CPU's budget.

**Second readout after the ImageBitmap fix (perf2.jpeg):** frame 1084→350ms,
entities 974→260ms for 8 drawn (~32ms/sprite). Decode thrash gone; what
remains is **source-read amplification**: sheets shipped at author resolution
but drawn at 0.14–0.31 scale → software raster reads 10–50x more source px
than it renders, per sprite, per frame. Plus ground 85.5ms (layer blit).

**C8 — offline sheet downscale. DONE (2026-06-13):**
- `tools/downscale-sheets.py` emits `-game` copies (Lanczos only, originals
  untouched, defs JSONs untouched): assets-002 @0.25 (132→8MB decoded),
  assets-001 @0.45 (132→26MB), coconut @0.45 (104→21MB). Factors keep ≥1.5x
  headroom over each sheet's max in-game draw scale (0.14 / 0.30 / 0.31).
- Game loads the `-game` files; `game.sheetScales` + `getSheetScale(key)` map
  author-res defs coords onto them at draw (environment.js, mapobject.js,
  spritesheet.js coconut loader — which rescales its frames array once).
- Editor/def tools keep using the full-res originals; re-run the script after
  any sheet art change.
- ALSO: canvas context is now `{ alpha: false }` (opaque — skips canvas-over-
  page blending at present time; zero visual change, helps software raster).

Expected next readout: `entities` a few ms, sheets ~55MB decoded total.
Remaining lever after that: `ground` ~85ms → smoothing-off for the two layer
blits (NEEDS USER VISUAL OK — changes sampling of the upscaled art).

## 5. CPU audit — code-read findings (2026-06-13, pending HUD confirmation)

Read of every per-frame path (update + render), ranked by expected cost on a
weak CPU. These all land in the HUD's `update` line (and `long(5s)` for the
allocation ones). The HUD's `drawn a/b` denominator shows the REAL entity
count N — read it before sizing any of this work.

### C1. Finite stages keep the WHOLE island alive — and scan it 3x per frame
`loadSurrounding` on a finite stage generates ALL `_validBlocks` (stage 3:
11x11 = **121 blocks**), each spawning up to `rockCount` [7,14] rocks (gray-
zone gated) + placements + sand. Then EVERY frame:
- `getObstacles()` — full 121-block walk, builds a fresh array (update, 1x)
- `getAllEntities()` — same walk, fresh array (throw pass, 1x — even when
  nothing is thrown)
- `getAllEntities().filter(...)` + `.sort(closure)` — again at render
Fix sketch: cache the flat entity/obstacle lists on World, invalidate in
`addEntity`/`removeEntity` (they change rarely); keep a tiny `thrown` set for
the throw pass; reuse one array + hoisted comparator at render.

### C2. Whole-island per-frame physics (drift + fall + animate loops)
Three O(N) loops over ALL obstacles every update tick (main.js ~460-585):
drift (1 `getZoneAt` each), wall-fall (another `getZoneAt` each), animate.
Worst: every rock RESTING on a ramp zone calls `applyObstacleDrift` =
**O(N) AABB scan each** → K ramp-resters × N total tests/frame, 60Hz, even
for rocks far off-screen. Fix sketch: skip drift/fall for obstacles outside
camera bounds + margin (they're invisible; freezing them is fine), or stagger
far blocks every Nth frame. Multiplied by `upd/frame` on slow machines (R5).

### C3. Input handler allocates on every query
`isKeyDown`/`isKeyJustPressed` run `Object.entries(keyMap)` (~17 pairs) +
`Object.entries(gamepadMap)` PER CALL; player movement + dash/run/attack/
interact checks ≈ 10+ calls per update → ~1–2k short-lived pair-arrays per
second feeding GC. Fix sketch: build `action → [codes]` reverse maps once in
the constructor; queries become tiny array loops, zero allocation.

### C4. `_getStageBounds()` recomputed every frame
`world.update` camera clamp calls it each frame: 121-entry loop + fresh
object. Static per stage → compute once in the constructor.

### C5. Micro-allocations in the loop
rAF callback closure per frame (`(t) => this.gameLoop(t)` — bind once);
render-path `filter` array (covered by C1). Individually trivial; together
they set GC cadence — visible as `long(5s)` > 0 with sawtooth `heap`.

### C6. Render path verdict: already lean on stage 3
Two culled bitmap blits + ~10–40 sprite draws + ≤7 FX. The remaining render
lever on no-GPU is Phase 2 (smoothing off for the layer blits, opaque canvas).
NOTE for stages 1–2 (no background image): the perspective-checkerboard +
terrain-depth path redraws many vector shapes per block per frame — heavy on
CPU; revisit only when those stages matter.

### Cost reality-check
None of C1–C5 is huge alone (~1–3ms combined on a weak CPU, est.); they
matter because (a) software rendering already eats most of the 16.7ms budget,
and (b) `upd/frame` ≥ 2 on slow machines doubles the update-side items.
Priority: C1+C2 (structural, biggest), then C3/C4/C5 (mechanical, quick).

## 6. Already fixed earlier (kept, see README "Performance" section)
- Viewport-culled 9-arg blits of the big layers (allocation-free view AABB).
- ImageBitmap decode-once for displayed layers.
- `deltaTime` clamp (no spiral-of-death lock).
- Zone/silhouette sampling capped at 6M px.
