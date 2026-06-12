# Performance Plan — make Saborosa lightweight (incl. no-GPU machines)

Goal: smooth gameplay on weak hardware — specifically machines with **no GPU**
(software-rendered canvas) and little RAM. Current state: perfect on a GPU
machine, laggy on a no-GPU machine.

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

## 5. Already fixed earlier (kept, see README "Performance" section)
- Viewport-culled 9-arg blits of the big layers (allocation-free view AABB).
- ImageBitmap decode-once for displayed layers.
- `deltaTime` clamp (no spiral-of-death lock).
- Zone/silhouette sampling capped at 6M px.
