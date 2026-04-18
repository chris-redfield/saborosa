# Implementation Plan — Color-Coded Terrain Zones

Roadmap for the zone system described in [README.md › Color-Coded Terrain Zones](./README.md#color-coded-terrain-zones-planned). Reference art: `assets/cor-saborosa-fundo-02.png` (current stage 3 background). Earlier iterations used `assets/saborosa-fund-01.png`.

## Decisions

### 1. Zone source → **Sample the background art directly**

The background image (`assets/saborosa-fund-01.png`) is the source of truth for zones. No parallel zone-map. This means the art and the physics are authored together: paint a yellow triangle and it *is* a left-ramp.

Implications:
- Need color classification (hue/saturation buckets), not exact RGB match — hand-drawn art has edge pixels and anti-aliasing.
- "Dynamic zones" (repaint at runtime) = draw onto a copy of the background canvas that's used for both display and sampling.
- Black outlines in the art must be handled (e.g. treat as "use the nearest classified color" or as "no zone / walkable default").

### 2. Altitude model → **Marble Madness-style (implicit, partly Y-driven)**

The player does not have an explicit integer `level` or float `z`. Instead:
- Most of the world is flat — walking doesn't change height.
- **Ramps** (yellow / blue) tilt the surface: the player slides along the ramp, which in our top-down view reads as constant-velocity push in a direction. No explicit height tracked; "rolling downhill" is emergent.
- **Walls** (green / red) are *higher surfaces*. The player has a boolean-ish state `onWall` (or a small set: `ground | climbing | onWall`). When stepping from ground into a wall zone → climb transition. When stepping off the edge of a wall → fall back to ground.
- Because visual "up" in an isometric-ish top-down game maps partly to Y, moving north on screen *feels* like going up — that's what the user means by "altitude is kinda defined by Y, but not 100%."

Implications:
- No camera zoom driven by a `level` integer. Camera zoom-out instead triggers when the player is `onWall` (or scales with a smoothed "wall-ness" value).
- Depth sorting already uses Y; walls add a vertical render offset on top of that.
- Falling off a wall is a state transition, not a physics drop.

### 3. Red zone → **Treat as wall (same as green) for now**

Same physics as green. Separate color kept in the enum so we can differentiate later without reworking.

## Phased Implementation

### Phase 1 — Zone infrastructure ✅ **DONE**

Shipped:
- Background image cached into an offscreen canvas at stage load (`_ensureZoneData` in `src/world/world.js`).
- `World.getZoneAt(worldX, worldY)` samples a single pixel at the world→image coordinate; if that pixel is an outline-black fallback samples 8 nearby points.
- HSV classifier `classifyZoneColor(r, g, b)` → `Zone` enum: `WALKABLE | RAMP_LEFT | RAMP_RIGHT | DENSE_SAND | WALL | NONE`.
- Debug overlay (hold `C`): zone name in the HUD + a colored swatch next to the player's footprint. Palette in `src/main.js` (`ZONE_DEBUG_COLORS`).

Key tuning knobs in `src/world/world.js`: outline cutoff (`Math.max(r,g,b) < 46`) and the HSV hue buckets in `classifyZoneColor`.

### Phase 2 — Ramps (yellow + blue) ✅ **DONE**

Shipped:
- Pure `getZoneDrift(zone)` → `{dx, dy}` (yellow: `(-1.2, 0.6)`, blue: `(1.2, 0.6)`). 2:1 ratio matches the isometric `yRatio=0.5`, so drift runs down the visual slope.
- Player drift applied in `main.js` after walking speed is computed — magnitude is below walking speed so the player can counter-walk uphill.
- Rocks and live rocks drift too, via `applyObstacleDrift(obs, dx, dy, obstacles, player)` in `world.js`. Axis-separated collision rejection; stack children are dragged along with their parent. Player rect is passed in as a collider so drift can't shove a pushed rock back through the pusher.

### Phase 3 — Dense sand (gray) ✅ **DONE**

Shipped:
- Gray is treated as sand in addition to walkable — `player.onSand` is `true` when on `DENSE_SAND`, so the existing sink/crop effect applies.
- Extra 10% slowdown on top of the regular `sandSpeedFactor` (net `0.63` of base speed, or `~0.91` while running).
- Rocks are intentionally unaffected on gray.

Change lives in `updateGame` in `src/main.js` (the `playerZone` sample is reused for sand + drift + debug).

### Phase 4 — Dynamic zones ⏸ **DEFERRED**

Out of order — skipped for now because by itself it has no visible payoff; coming back once a gameplay reason (switches, puzzles, triggers) justifies it.

- Expose `world.setZoneAt(worldX, worldY, zone)` / region variant that paints onto the cached zone canvas at runtime.
- Small test: a trigger tile that flips a yellow ramp to blue.

**Exit criteria:** A scripted event can repaint a region and the physics immediately reflect it.

### Phase 5 — Walls (green + red) ✅ **DONE**

Marble-Madness-style: walls are higher surfaces, not an altitude integer.

Shipped:
- `player.surfaceState`: `'ground' | 'climbing' | 'onWall' | 'falling'`, plus `player.lastZone` for edge detection.
- **Entering a wall (ground → climbing/falling):** walking into a WALL pixel moving predominantly up (`dy < 0 && |dy| >= |dx|`) triggers `climbing`. Any other approach (down / sideways) triggers `falling`.
- **Climb = physical lift.** The climb lasts `climbDurationMs = 800ms` and *actually* moves the player up 40px by interpolating `dy` over the duration (no visual-only offset — the earlier approach caused a mismatch where zone sampling still read `WALL` even though the sprite looked on top). After the timer hits 0, state → `onWall`.
- **Sticky top zones while onWall:** `WALL | DENSE_SAND | RAMP_LEFT | RAMP_RIGHT` all keep you up. Gray (cube top) and ramps on top both count as "still on the cube."
- **Edge fall-offs:** stepping from a top zone (`DENSE_SAND` / `RAMP_*`) back onto a `WALL` pixel = you walked off the front edge → `falling`. Implemented via `player.lastZone` comparison.
- **Ramp drift applies while onWall too** — standing on a yellow/blue ramp at the top of a cube slides you.
- **Falling = unrecoverable gravity.** Input is ignored, `dy` accelerates from `fallStartSpeed = 1.5` up to `fallMaxSpeed = 11` at `fallAccelPerSec = 15` (bumped +25% from the initial 12). Transitions back to `ground` when the sampled zone is no longer `WALL` / `NONE`.
- **Red is plain walkable.** The classifier was later changed so red no longer counts as a wall (see Phase 7 below).

Change lives in `src/entities/player.js` (state fields + constants) and `src/main.js` (`updateGame` state machine, sample once at collision-box center, reuse for sand/drift/wall).

### Phase 6 — Camera zoom when on walls ← **next**

Since there's no `level` integer, zoom is driven by `surfaceState`:

- `ground` / `climbing` / `falling` → scale 1.0
- `onWall` → scale ~0.85 (smoothed over ~0.5s)
- Apply in `renderGround` / entity pass.

**Exit criteria:** Climbing onto a wall visibly zooms out; stepping off zooms back in smoothly.

### Phase 7 — Differentiate red (partial)

Shipped so far:
- Red reclassified from `WALL` to `WALKABLE` in `classifyZoneColor` — walking on red is currently indistinguishable from walking on beige.

Still open:
- Decide red's *distinct* behavior (user hasn't defined it yet).
- If it needs different physics from plain walkable, split `WALKABLE` → add a `RED` zone with its own rule.

## Risks & Gotchas

- **Color classification on hand-drawn art.** Black outlines, slight color variance, and anti-aliased pixels between zones will all be sampled. Use hue/saturation buckets (HSV distance) with a fallback to `WALKABLE` for ambiguous pixels. Consider blurring-then-quantizing the cached sample buffer at stage-load time to reduce edge noise.
- **Pixel-to-world mapping.** Current stage 3 stretches the image non-uniformly (1600×1308 → 2560×1440). Zone sampling must apply the same transform. Cleaner option: draw the background at 1:1 (centered) and let the outer sand color fill the rest; zone sampling then becomes a direct pixel read.
- **Which point to sample?** Player's center vs. feet vs. full footprint. Feet (bottom-center) matches "what are they standing on" intuition. For ramp push, sampling one point is enough; for wall transitions, test the *destination* pixel before committing to a move.
- **Walls × rocks × lifting.** The existing stack system visually offsets y already. Reconcile "on a wall" with "standing on a stacked rock" — both should use the same render-offset convention so a carried rock on a wall doesn't float.
- **Mutable zones × rendering.** Since the background image is the zone source, painting at runtime repaints the art too. Acceptable if we want visible ramp flips; if not, cache a separate un-painted copy for display.

## Progress Tracking

- [x] Phase 1 — Zone infrastructure
- [x] Phase 2 — Ramps (yellow + blue, player + rocks)
- [x] Phase 3 — Dense sand
- [ ] Phase 4 — Dynamic zones *(deferred)*
- [x] Phase 5 — Walls (climb / onWall / fall with gray-top stickiness and edge-fall)
- [ ] Phase 6 — Camera zoom on walls ← **next**
- [~] Phase 7 — Red reclassified to plain walkable; distinct behavior still TBD

## Known Issues / Follow-ups

- **Pushing against drift feels sluggish.** Pushing a rock *uphill* on a ramp works (the player is a collider so the rock won't drift back through them), but the net rock speed while being pushed is pusher-speed − drift-speed, which can feel slow. Not a bug per se, but worth tuning when we revisit ramp feel.
- **Fall feel.** Acceleration is currently `startSpeed=1.5`, `accel=15 px/s²`, `cap=11` — tweak whenever the fall starts to feel too floaty/sudden.
- **Cube sprite scale.** Cubes replaced rock PNGs; at the current `size` range (25–60px) they may look smaller than intended. Bump `rockCount` scale in `world.js` `_generateBlock` if desired.
