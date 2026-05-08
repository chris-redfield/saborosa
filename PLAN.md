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

### Phase 8 — "Fall-behind" system ✅ **DONE**

The mountain silhouette occludes the player when they fall behind it. Final architecture:

**Two-layer background.** `tools/fall-behind-overlay.html` splits the source PNG into two transparent layers that stack back to the original:
- `assets/cor-saborosa-fundo-02-lower.png` — full image below the midline + sand-only above. Drawn as the base by `world.renderGround`.
- `assets/cor-saborosa-fundo-02-overlay.png` — mountain silhouette above the midline; everything else transparent. Drawn either before or after the player depending on `behindMountain`.

The original `stage3_bg` is still loaded but only used by `_ensureZoneData` to build the zone-classification canvas — it's never drawn anymore.

**Fall trigger.** Stepping off any non-sand zone onto sand while the player's feet are above the image midline sets `surfaceState='falling'` and `player.fallTargetY = midlineWorldY`. The falling-exit branch snaps `player.y` so the collision center lands exactly at midline. Wall-side falls keep their old behavior (`fallTargetY === null` → exit when zone leaves `WALL`).

**`player.behindMountain` flag.** Set true the frame a midline-targeted fall begins; cleared when the player walks out of the silhouette. State, not pure geometry — a geometric "is below mountain pixels" check fires when the player walks *under* the mountain from the south too, which should render in front, not behind.

**Silhouette detection (`world.isSpriteBehindMountain(wx, wy, ww, wh)`).** Reads the overlay PNG's alpha channel directly — the overlay *is* the polygon, alpha *is* the boundary. Returns true if any opaque pixel of the overlay overlaps the given world rect. Sparse 2-pixel sampling for cost. Used in two places:
- **`onMountain` (1×1 sample at the feet)** drives transition triggers (fall-behind / walk-back-behind). Robust against junction misreads because overlay's outline pixels are opaque.
- **Sprite-bbox sample** clears `behindMountain` once the sprite no longer overlaps any opaque pixel.

Earlier silhouette attempts that didn't work, kept as warnings:
1. *"Any pixel in the column"* — trapped the player anywhere a stray outline existed above midline.
2. *Min-run of opaque pixels per column* — tuning the threshold either trapped or freed the player too early.
3. *Column mass* — same problem, plus performance per frame.
4. *Per-column bottom-edge near midline (REACH_PX=60)* — broke at concave silhouettes; the threshold was a guess.

The current bbox-overlap approach has no thresholds; the source of truth is the overlay PNG itself.

**Render order.** `lower` → if `!behindMountain` then `overlay` → entities → if `behindMountain` then `overlay` at `globalAlpha = 0.5`. Half-opacity keeps the sprite visible while occluded.

**Behind-state physics override.** While `behindMountain` is true, `playerZone` is forced to `Zone.SAND` regardless of the actual painted zone. This disables ramp drift, climb/fall transitions, dense-sand slowdown, and re-triggering the fall (since `lastZone` ends up `SAND`, `lastWasMountain` stays false).

**One-way midline wall.** While `behindMountain`, after `player.move` we clamp `feetY` back to `midlineWorldY` if it pushed south. Up is unconstrained (the player is "above" the wall conceptually). Forces sideways exit instead of letting the player slide south onto colored ground and re-bind themselves behind.

### Phase 9 — Walk-back-behind + behind-state isolation ✅ **DONE**

**Walk-back-behind trigger.** Mirror of fall-behind: while on sand above the midline, stepping into the mountain should set `behindMountain = true` directly — no climb, no fall, just slip behind.

**Object non-interaction while behind.** ✅ Done.
- Empty obstacle list to `player.move` while `behindMountain` so rocks/cubes don't collide.
- `liftOrDrop` / `updateStackTarget` / portal interactions skipped.

**Trigger source — chain of failed attempts** (all from this session, kept as warnings):

| Approach | Why it failed |
| --- | --- |
| Zone-based: `lastZone === SAND && realZone === non-SAND` | Junction misread fires both fall-behind and walk-back-behind. Black-outline pixel cluster returns NONE; bright anti-aliased pixels can return SAND. |
| Widen the `getZoneAt` outline-fallback radius (±3 / ±6 / ±10 / ±15) + return WALKABLE for in-bounds-all-black | Reduced misreads but didn't eliminate them — anti-aliased gray-on-color produces low-saturation bright pixels that still classify as SAND. |
| Gate trigger on column-shadow check (`isInMountainShadow(wx)` with bottom-Y ≥ midline − REACH_PX) | Per-column heuristic, not a true polygon test. Got stuck behind tendrils, released too early near edges. |
| Gate trigger on sprite-bbox silhouette test (`isSpriteBehindMountain`) | Worked for walk-back-behind, but blocked legit fall-behind because the sprite still overlaps the silhouette one frame after the feet step onto sand. |
| Two-channel: sprite-bbox for walk-back-behind, 1×1 feet for fall-behind | Junction-safe and fall-correct, but a different problem appeared: midline crossing (overlay is transparent below midline → opaque above) read as a sand→mountain transition. |
| Single feet-on-overlay primitive with both `lastOnMountain → onMountain` flip AND `aboveMidline && lastAboveMidline` guard | Initially looked like the answer — fixed midline-crossing. But two new problems surfaced as we played longer: (a) sand-sink visual flicker at black junctions because `getZoneAt` still flickered between NONE/SAND/DENSE_SAND; (b) wall trigger firing → `climbing → falling` pushing south when zone briefly read sand-like at a green strip on the mountain top, producing a "can't walk up, bounces back" feel. |
| Tighten SAND classifier at runtime (`s<0.18 && v>=0.70 && r>b+8`) to stop bright neutral-gray reading as sand | Reverted — caused a different visible flicker because gameplay (`onSand`, speed mult, drift) reacted to bright-gray reads now landing in `DENSE_SAND` instead of `SAND`. Pixel-by-pixel value changes during movement made motion feel jittery. |
| Gate the entire wall trigger on `!player.lastOnMountain` | Killed the bounce — but also killed the legitimate "step off cube top onto green wall face → fall" (Phase 5 cube-edge fall), since both frames are on the mountain. Reverted. |

**What actually worked (final).** Two surgical guards on top of the feet-on-overlay primitive, neither touching the wall trigger entry:

- **`onSand` override above midline (B).** When `aboveMidline && onMountain`, force `player.onSand = false` regardless of classifier output. Kills the sand-sink visual blip at junctions because the overlay is opaque on outline pixels too. Three-line change in the `onSand` block.
- **`climbing → falling` gated on `!onMountain` (D).** While on the mountain, climbing exits to ground rather than falling when the zone briefly reads sand-like. Kills the southward-push bounce while leaving wall-fall (`ground+WALL+!up → falling`) intact, so cube-edge falls still work.

**The overlay PNG has pinhole holes.** The generation tool (`tools/fall-behind-overlay.html`) uses the same loose `s<0.18 && v>=0.70 → SAND` classifier as runtime — so any bright neutral-gray pixel inside the source's gray polygons (anti-alias slivers, scanned-art highlights) gets marked transparent in the overlay. When the player's feet sample landed on such a hole, the trigger correctly fired ("feet just left the mountain") even though visually they were still on it.

**Hole-tolerant feet sample.** Instead of `isSpriteBehindMountain(feetX, feetY, 1, 1)`, sample an 8-pixel box around the feet (`FEET_BOX = 8`). Any opaque pixel in the box → `onMountain = true`. Pinholes (1–3 px) get absorbed because some neighbors are still opaque. Real sand stays unambiguous because the transparent area is much wider than 8 px. Trade-off: trigger fires a few pixels late when stepping off the mountain — imperceptible.

Alternative we *didn't* take: regenerate the overlay PNG with a tighter SAND rule in the tool. Would eliminate the holes at asset-build time without runtime cost. Box-sampling was preferred because it doesn't require rerolling the asset.

**Exit criteria:** (1) Walking south on sand into the silhouette puts the player behind without climbing; lateral exit returns control. (2) Walking up the mountain across the midline does nothing — player stays on top, no behind state. (3) Walking over polygon junctions on the mountain top doesn't fall, doesn't trigger behind, doesn't sink-flicker, doesn't bounce. (4) Stepping off the mountain top onto sand triggers the midline drop. (5) Walking into a green wall from sand still climbs / wall-side-falls correctly. (6) Rocks/portals are inert while behind.

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
- [x] Phase 9 — Walk-back-behind trigger + object non-interaction while behind

## Known Issues / Follow-ups

- **Pushing against drift feels sluggish.** Pushing a rock *uphill* on a ramp works (the player is a collider so the rock won't drift back through them), but the net rock speed while being pushed is pusher-speed − drift-speed, which can feel slow. Not a bug per se, but worth tuning when we revisit ramp feel.
- **Fall feel.** Acceleration is currently `startSpeed=1.8`, `accel=18 px/s²`, `cap=14.3` — tweak whenever the fall starts to feel too floaty/sudden.
- **Cube sprite scale.** Cubes replaced rock PNGs; at the current `size` range (25–60px) they may look smaller than intended. Bump `rockCount` scale in `world.js` `_generateBlock` if desired.
- **Junction speed flicker (cosmetic).** When walking through a narrow green strip on the mountain top, the wall trigger still enters `climbing` for 1–2 frames, so speed briefly drops to climb-factor (0.4×). No bounce, no fall, just a tiny speed wobble. Living with it; would require either gating the wall trigger entry (which broke cube-edge falls last time) or per-frame zone-stability hysteresis.
- **Overlay-tool classifier loose.** `tools/fall-behind-overlay.html` mirrors the runtime classifier, including the loose SAND rule. Any future regeneration of the overlay should consider tightening the SAND check there (`r > b + 8 && v >= 0.70`) — eliminates the pinhole holes the runtime box-sampler currently absorbs. Safe to do because it's an asset-time change, not a runtime classifier change.

## Architecture quick-reference (for future-me)

If you're touching the fall-behind / walk-back-behind code, these are the only signals you should use for the triggers — DO NOT route them through the zone classifier:

- `onMountain` — `world.isSpriteBehindMountain(feetX - 4, feetY - 4, 8, 8)`. 8-px box at the feet. True iff any opaque overlay pixel overlaps.
- `player.lastOnMountain` — previous-frame value, updated end-of-frame.
- `aboveMidline` — `feetY < world.getMidlineWorldY()`.
- `player.lastAboveMidline` — previous-frame value, updated end-of-frame.
- `player.behindMountain` — true while occluded by the overlay.

Triggers fire on *transitions* gated by both midline frames being above:
- Walk-back-behind: `!lastOnMountain && onMountain && aboveMidline && lastAboveMidline && state==='ground' && !behindMountain`.
- Fall-behind: `lastOnMountain && !onMountain && aboveMidline && lastAboveMidline && state==='ground'`. Sets `fallTargetY = midlineWorldY` and `behindMountain = true`.

Behind-state guards still in place:
- Zone override: `playerZone = behindMountain ? Zone.SAND : realZone` (suppresses ramp drift, climb, etc.).
- `onSand` override: `aboveMidline && onMountain → onSand = false`.
- Climbing→falling gate: `onSandLike && !onMountain → falling` (otherwise stays climbing/ground).
- Empty obstacle list while behind so the player phases through rocks.
- Y-clamp at midline so `feetY > midlineWorldY` is pulled back while behind.
- Clear: full sprite-bbox `isSpriteBehindMountain(player.x, player.y, player.width, player.height)` returns false → `behindMountain = false`.
