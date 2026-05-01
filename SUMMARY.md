# Saborosa — Session Summary

A living snapshot of where the game is. Pairs with [PLAN.md](./PLAN.md) (the forward roadmap) and [README.md](./README.md) (the mechanics spec).

## What got shipped this session

### 1. Stage 3 — Painted Isle (new image-driven stage)

A finite stage whose ground is a hand-drawn image, with a color-coded zone system driving physics.

- Background: `assets/cor-saborosa-fundo-02.png` (replaces the earlier `saborosa-fund-01.png`).
- Layout evolved: **2×2 walkable → 4×4 → 6×6 → 9×9** (about 20× bigger in area than the original).
- Total blocks 11×11 with a 1-block sand border.
- Image is placed at a `backgroundImageRect` that fits the walkable height while preserving the image's native 1.291 aspect ratio — no distortion.
- `renderGround` early-returns when a stage has `backgroundImage`, skipping all procedural terrain drawing for this stage.
- `rectBlocks(minX, minY, maxX, maxY)` helper added in `src/world/stages.js` so future resizes are one-liners.

### 2. Color-Coded Terrain Zones (Phases 1, 2, 3, 5 done)

The game samples the background image pixel under the player's collision-box center each frame and classifies by HSV:

| Color  | Zone          | Behavior |
|--------|---------------|----------|
| Yellow | `RAMP_LEFT`   | Constant drift (-1.2, +0.6) — slides down-left |
| Blue   | `RAMP_RIGHT`  | Constant drift (+1.2, +0.6) — slides down-right |
| Gray   | `DENSE_SAND`  | Slows player to `0.63×` base speed (no sprite-sink cropping) |
| Green  | `WALL`        | Climbable / fall-off-able higher surface |
| Red    | `WALKABLE`    | Plain walkable (was originally WALL; reclassified) |
| Beige / outside image | `WALKABLE` / `NONE` | Default walkable |

Core building blocks live in `src/world/world.js`:
- `World._ensureZoneData()` — background image → offscreen canvas → cached `ImageData`.
- `World.getZoneAt(x, y)` — single-pixel sample at a world coordinate, with an 8-point fallback if the pixel is part of a black outline.
- `classifyZoneColor(r, g, b)` — HSV bucket classifier (outline cutoff `max(r,g,b) < 46`).
- `getZoneDrift(zone)` — pure function returning `{dx, dy}` per-frame drift for ramps. Used by both the player and by rocks via `applyObstacleDrift(obs, dx, dy, obstacles, player)`, which performs axis-separated collision rejection and drags stack children along.

### 3. Walls — climb, stand, fall (Phase 5)

`player.surfaceState` is a 4-state machine: `ground | climbing | onWall | falling`.

- **Climbing:** entering a green pixel while moving up (`dy < 0`) kicks off an ~0.8s climb that *physically* lifts the player 40px by interpolating `dy` over the climb duration. (Earlier attempt used a render-only offset — scrapped because zone sampling still read the wall underneath.)
- **On the cube:** sticky zones while `onWall` are `WALL | DENSE_SAND | RAMP_LEFT | RAMP_RIGHT`. Walking across the gray top or a ramp on top keeps you up. Ramp drift still applies up there.
- **Edge detection:** `player.lastZone` is recorded each frame. Transitioning from a *top zone* (gray or ramp) back onto a `WALL` pixel = you walked over the front edge → `falling`. Stepping off onto walkable/image-void = `falling`.
- **Falling:** input ignored; `dy` starts at `1.5` and accelerates by `15 px/s²` up to `11 px/frame` (bumped +25% from the initial tuning). Lands when the sampled zone is no longer `WALL` / `NONE`.
- **Falling into a wall from above/sideways** is also a fall trigger from the `ground` state.

### 4. Rocks → Cubes

Rocks are now isometric colored cubes from `assets/cor-saborosa-box-01.png`.

- Game loader adds a `_makeWhiteTransparent('cubes')` post-process so the white sheet background becomes alpha-0.
- `CUBE_REGIONS` table in `src/entities/environment.js` holds the 6 tight bboxes (detected via flood-fill, 361×422 or 422×361 each).
- `Rock` picks a region by `type` (1..6, modulo), renders via `drawImage(sheet, rx, ry, rw, rh, …)`, and scales its own `height` to preserve the cube's aspect ratio.
- Random rock generation widened from 3 types to 6 in `world.js`.
- Existing ramp-drift + stacking logic works on cubes without changes.

### 5. Debug overlay

Hold `C` to see the HUD:
- Player world coords, block, stage id.
- **Zone:** live name of the classified pixel.
- **State:** `player.surfaceState`.
- A small colored swatch appears at the collision-box center showing the sampled zone's palette color.

## Fixes worth remembering

- **Zone sample misclassified as `WALKABLE` on black outlines.** Fixed by adding the 8-point fallback in `getZoneAt` and sampling at the collision-box center instead of the sprite's bottom.
- **Can't push rocks uphill.** Fixed by passing `player` to `applyObstacleDrift` so the player's rect blocks the rock from drifting back through the pusher.
- **Climb ended with immediate fall.** Fixed twice: first by locking movement during climb (so a thin wall zone didn't eject the player), then by making climb a real physical lift (so the zone sampler actually reads the top zone when the climb finishes).
- **Gray top kicked you off.** Fixed by adding `DENSE_SAND` to the onWall sticky set.
- **Ramp-on-top ejected you.** Fixed by adding `RAMP_LEFT / RAMP_RIGHT` to the sticky set.
- **Walking gray → wall didn't fall.** Fixed by comparing `lastZone` (top-zone) vs current (`WALL`) for edge detection.

## Current snapshot

- ✅ Phase 1 — Zone infrastructure
- ✅ Phase 2 — Ramps (yellow + blue) for player and rocks
- ✅ Phase 3 — Dense sand (gray)
- ⏸ Phase 4 — Dynamic zones, deferred until a gameplay reason calls for it
- ✅ Phase 5 — Walls (climb + onWall + fall + edge detection)
- 🟡 Phase 6 — Camera zoom when on walls — **next up**
- 🟡 Phase 7 — Red differentiation — red is currently plain walkable; awaiting a distinct spec

## Open items

See `PLAN.md › Known Issues / Follow-ups` for:
- Sluggish push-uphill on ramps.
- Fall feel tuning knobs.
- Cube sprite scale.
