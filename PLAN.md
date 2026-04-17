# Implementation Plan — Color-Coded Terrain Zones

Roadmap for the zone system described in [README.md › Color-Coded Terrain Zones](./README.md#color-coded-terrain-zones-planned). Reference art: `assets/saborosa-fund-01.png`.

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

### Phase 1 — Zone infrastructure (no gameplay change yet)

- Draw the background image once into an **offscreen canvas** (not a separate zone-map — the background *is* the zone source).
- Cache `getImageData` once per stage load so sampling is O(1).
- Add `world.getZoneAt(worldX, worldY)` → maps world coords to image pixel coords (accounting for `backgroundImageRect` scale/offset), reads RGB, classifies by hue/saturation into a zone enum: `WALKABLE | RAMP_LEFT | RAMP_RIGHT | DENSE_SAND | WALL | NONE`.
- Handle black outlines: classify as `WALKABLE` (walk over the line).
- Debug overlay (hold `C`): show the detected zone name near the player + a small color swatch.

**Exit criteria:** Walking around stage 3, the debug overlay shows the right zone label for each colored region (yellow → `RAMP_LEFT`, blue → `RAMP_RIGHT`, gray → `DENSE_SAND`, green & red → `WALL`, beige → `NONE`).

### Phase 2 — Ramps (yellow, blue)

- On each frame, if player is on a ramp zone, add a constant `vx` nudge (left or right).
- Tune magnitude until sliding *feels* right.
- Sanity test: walking uphill should be slow, downhill fast.

**Exit criteria:** Standing still on yellow drifts player left; on blue drifts right.

### Phase 3 — Dense sand (gray)

- New zone hooks into the existing sand path (`player.onSand`).
- Override sink amount (smaller than `STACK_OFFSET`) and speed factor (slower than current 0.7).

**Exit criteria:** Gray zone feels visibly different from regular sand — less sinking, slower pace.

### Phase 4 — Dynamic zones

- Expose `world.setZoneAt(worldX, worldY, zone)` / region variant.
- Small test: a trigger tile that flips a yellow ramp to blue.

**Exit criteria:** A scripted event can repaint a region and the physics immediately reflect it.

### Phase 5 — Walls (green + red)

Marble-Madness-style: walls are higher surfaces, not an altitude integer.

- Add a `player.surfaceState`: `'ground' | 'climbing' | 'onWall'`.
- **Entering** a wall zone from `ground`: transition to `climbing` — movement slows (~40% speed), wait ~0.8s, snap to `onWall`.
- **Moving while `onWall`:** if the next step is still a wall-zone pixel → stay on. If it's a non-wall pixel ("edge of the wall") → transition back to `ground` (the "fall").
- Render offset: small constant upward y-offset while `onWall` so the sprite visually rises onto the wall — doesn't need to match physical cube heights, just read as "up there."
- Treat red identically to green for classification and physics.

**Exit criteria:** Player walks into the green rectangle, climbs for ~1s, ends up visibly "on top" (offset). Walking off the edge drops them back.

### Phase 6 — Camera zoom when on walls

Since there's no `level` integer, zoom is driven by `surfaceState`:

- `ground` → scale 1.0
- `onWall` → scale ~0.85 (smoothed over ~0.5s)
- Apply in `renderGround` / entity pass.

**Exit criteria:** Climbing onto a wall visibly zooms out; stepping off zooms back in smoothly.

### Phase 7 — Differentiate red

- Decide red's distinct behavior (user hasn't defined it yet).
- Split `WALL` into `WALL_GREEN` and `WALL_RED` in the enum so only the physics branch needs swapping.

## Risks & Gotchas

- **Color classification on hand-drawn art.** Black outlines, slight color variance, and anti-aliased pixels between zones will all be sampled. Use hue/saturation buckets (HSV distance) with a fallback to `WALKABLE` for ambiguous pixels. Consider blurring-then-quantizing the cached sample buffer at stage-load time to reduce edge noise.
- **Pixel-to-world mapping.** Current stage 3 stretches the image non-uniformly (1600×1308 → 2560×1440). Zone sampling must apply the same transform. Cleaner option: draw the background at 1:1 (centered) and let the outer sand color fill the rest; zone sampling then becomes a direct pixel read.
- **Which point to sample?** Player's center vs. feet vs. full footprint. Feet (bottom-center) matches "what are they standing on" intuition. For ramp push, sampling one point is enough; for wall transitions, test the *destination* pixel before committing to a move.
- **Walls × rocks × lifting.** The existing stack system visually offsets y already. Reconcile "on a wall" with "standing on a stacked rock" — both should use the same render-offset convention so a carried rock on a wall doesn't float.
- **Mutable zones × rendering.** Since the background image is the zone source, painting at runtime repaints the art too. Acceptable if we want visible ramp flips; if not, cache a separate un-painted copy for display.

## Progress Tracking

- [ ] Phase 1 — Zone infrastructure
- [ ] Phase 2 — Ramps
- [ ] Phase 3 — Dense sand
- [ ] Phase 4 — Dynamic zones
- [ ] Phase 5 — Walls (green + red share behavior)
- [ ] Phase 6 — Camera zoom on walls
- [ ] Phase 7 — Differentiate red
