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
- **Falling = unrecoverable gravity.** Input is ignored, `dy` accelerates from `fallStartSpeed = 1.8` up to `fallMaxSpeed = 14.3` at `fallAccelPerSec = 18`. Transitions back to `ground` when the sampled zone is no longer `WALL` / `NONE`.
- **Red is plain walkable.** The classifier was later changed so red no longer counts as a wall (see Phase 7 below).

Change lives in `src/entities/player.js` (state fields + constants) and `src/main.js` (`updateGame` state machine, sample once at collision-box center, reuse for sand/drift/wall).

### Phase 6 — Camera zoom when on walls ← **next**

Since there's no `level` integer, zoom is driven by `surfaceState`:

- `ground` / `climbing` / `falling` → scale 1.0
- `onWall` → scale ~0.85 (smoothed over ~0.5s)
- Apply in `renderGround` / entity pass.

**Exit criteria:** Climbing onto a wall visibly zooms out; stepping off zooms back in smoothly.

### Phase 8 — "Fall-behind" system (high-zone → sand fall with occlusion) ✅ **DONE**

Shipped:
- Asset built via `tools/fall-behind-overlay.html`; saved as `assets/cor-saborosa-fundo-02-overlay.png` and registered in `engine/game.js` as `stage3_overlay`. Stage 3 in `world/stages.js` references it via `backgroundOverlayImage`.
- `world.getMidlineWorldY()` returns the world Y of the image midline; `world.isPlayerBehindMountain(wx, wy)` answers the per-frame occlusion check using a precomputed 1D `_mountainBottomEdge` array (largest non-sand row per column above the midline). `world.renderOverlay(ctx)` draws the overlay PNG using the same rect transform as the base background.
- `player.fallTargetY` (default `null`) flags fall-behind drops. When a fall begins on sand above the midline, `fallTargetY` is set to the midline world Y; the falling exit branch in `main.js` lands the player exactly on it (`player.y` snapped so collision center = midline).
- New `ground → falling` transition for "stepping off any non-sand zone onto sand while above the midline" — covers tops of cubes (`DENSE_SAND`), ramps, and red walkable. The existing `WALL`/`climbing` transitions are left intact; they automatically pick up the midline target if applicable.
- Render order: full background → entities (incl. player) → overlay (only when `isPlayerBehindMountain` is true). Drawn before HUD so the stage name still sits on top.

Below the original specification for reference:



When the player steps off a colored (non-sand) zone whose Y is above the image midline directly onto sand, they fall in +Y at locked X (same as the wall-fall logic) until `y == image_height / 2` (the midline). If, during/after that fall, the player's X is within the horizontal span of mountain pixels *below* them (there are colored pixels between the player's Y and the midline at that X), they're "behind" the mountain — the mountain silhouette must render on top of the player to sell the occlusion.

Decisions locked in with the user:
- **Trigger**: stepping off a colored zone above the midline directly onto sand. Reuse the existing wall-fall state machine (`falling`) — extend it for this case, don't refactor it in a way that breaks current wall behavior.
- **Fall end Y**: exactly `image_height / 2` (same reference used to define "high zone"). Not "next sand pixel."
- **Behind detection**: at the player's current X, scan upward (or check the precomputed mask) — if there are colored mountain pixels between the player and the midline, they're behind.
- **Overlay image**: generated *offline* by a separate script so we can inspect the asset before integrating. Script reads the original background, keeps non-sand colored pixels above the midline opaque, makes everything else transparent. Output saved to `assets/` alongside the original.
- **Render layering when behind**: full background → player → mountain-overlay image on top. Player-only for now (rocks etc. unaffected).
- **Exit from behind**: player walks sideways out of the occluded X-band onto open sand (no mountain pixels above them anymore). Once they exit, stop rendering the overlay (effectively back to the normal background).

Plan of attack:
1. **Asset script** (`scripts/build-fall-behind-overlay.js` or similar). Standalone Node script — input: `assets/cor-saborosa-fundo-02.png`, output: `assets/cor-saborosa-fundo-02-overlay.png`. Uses the same HSV classifier rules as `classifyZoneColor` to decide sand vs. colored. Inspect output by hand before wiring in.
2. **Load the overlay** alongside the existing background in `world.js` (same stretch transform applied).
3. **Behind-detection helper**: `world.isPlayerBehindMountain(worldX, worldY)` — samples the cached zone canvas in a vertical strip from player.y up to midline at column worldX; returns `true` if any colored (non-sand, non-walkable) pixel exists in that strip. Cache or scan-line precompute possible if perf becomes an issue.
4. **Fall trigger extension** in the player surface-state machine: when transitioning to `falling` from a high zone onto sand, mark fall as "high-zone fall" and use midline-Y as the termination instead of "next non-WALL pixel."
5. **Render hook** in `main.js` (or wherever ground/entities are rendered): if `world.isPlayerBehindMountain(player.x, player.y)`, draw the overlay image after the player pass.

**Exit criteria**: From the upper mountain area (Phase 5 walls), walking off the left side drops the player straight down to the midline; while in the X-band of the mountain, the colored silhouette draws on top of the sprite; walking sideways out from behind restores normal rendering. Walking off the right side falls without occlusion.

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
- [ ] Phase 6 — Camera zoom on walls
- [~] Phase 7 — Red reclassified to plain walkable; distinct behavior still TBD
- [x] Phase 8 — Fall-behind system (overlay-asset occlusion when falling left of mountain)

## Known Issues / Follow-ups

- **Pushing against drift feels sluggish.** Pushing a rock *uphill* on a ramp works (the player is a collider so the rock won't drift back through them), but the net rock speed while being pushed is pusher-speed − drift-speed, which can feel slow. Not a bug per se, but worth tuning when we revisit ramp feel.
- **Fall feel.** Acceleration is currently `startSpeed=1.8`, `accel=18 px/s²`, `cap=14.3` — tweak whenever the fall starts to feel too floaty/sudden.
- **Cube sprite scale.** Cubes replaced rock PNGs; at the current `size` range (25–60px) they may look smaller than intended. Bump `rockCount` scale in `world.js` `_generateBlock` if desired.
