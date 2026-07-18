# How to create infinite (tiled) dungeons

A practical handoff guide for adding a **new tiled dungeon** to Saborosa — the
"infinite" top-down kind with **constant character size** (NO perspective /
depth-scaling tricks, unlike the overworld stage 3 or the first "perspective"
dungeon). It distills everything learned building the first tiled dungeon (the
skull-field "Bone Pit") + its collision + the rope.

> TL;DR: `TileDungeonScreen` is already tile-agnostic. A new tiled dungeon =
> **new tile PNG + new collision JSON + a stage config block + a hole + one
> dispatch line.** You usually do NOT need to write a new screen class.

---

## 0. Two dungeon models (pick the tiled one)

- **Perspective room** — `src/screens/dungeon.js` (`DungeonScreen`). One fixed
  one-point-perspective background; character shrinks toward a vanishing point.
  This is the OLD kind. **Not what you want here.**
- **Infinite tiled floor** — `src/screens/tiledungeon.js` (`TileDungeonScreen`).
  A single square tile repeated forever, top-down, **constant character scale**.
  This is the kind this guide is about.

Both share the same interface (`update(dt)`, `render(ctx)`, `renderDebug(ctx)`)
and are stored in `gameState.dungeon`, so `main.js` treats them identically.

> **Tiled dungeons are not all the same.** `TileDungeonScreen` started as ONE
> shape — an opaque tile repeating in every direction over a dark void (the Bone
> Pit). It has since grown config-driven **variants** that change the whole feel
> without a new screen class: a transparent tile over a flat **sand** fill, a tile
> that only tiles **horizontally** (a bridge, not a field), spawn-on-a-strip, and
> a **depth-sorted railing** that draws over the player. The second real dungeon —
> the **pista** (§9) — turns all of these on at once. So: before you reach for a
> new screen, check whether a flag already does what you want. See §9 for the full
> worked example and the flag list.

---

## 1. How a dungeon is entered (the plumbing)

1. **Holes** live on the stage (`src/world/stages.js`, `stage.holes[]`). Each is
   a non-colliding trigger box with a `target` string:
   ```js
   { x, y, w, h, target: 'tiled', triggerInset: 0.22, vanishLine: 0.5 }
   ```
   When the player's feet enter the inner region, `main.js` (`startDungeonFall`)
   plays the fall-in and then calls `enterDungeon()`.
   - The hole box should sit over an actual hole graphic in the overworld
     overlay art. Existing hole graphics ("buracos") are in the baked overlay
     layer; find their world centers by converting `overlay-objects.json` normals
     with `backgroundImageRect`. The normal is the object's TOP-LEFT, so the
     buraco CENTRE is `worldX = rect.x + (nx + nw/2)*rect.w`,
     `worldY = rect.y + (ny + nh/2)*rect.h`. Round-trip a known hole to confirm:
     the three `kind:'buracos'` entries convert to **(6314, 3525)**, **(4925,
     3536)**, **(5678, 2850)** — exactly the centres of the three `holes[]` boxes.
     Centre a `w×h` box on that (`x = cx − w/2`, `y = cy − h/2`). Do NOT eyeball it
     from the overworld debug `World:` readout — that's the player's sprite
     top-left, not the buraco (this bit us once: the pista hole landed ~80px off).

2. **Dispatch** — `enterDungeon()` in `main.js` picks the screen by `target`:
   ```js
   const target = (gameState.dungeonFromHole && gameState.dungeonFromHole.target) || 'dungeon';
   if (target === 'tiled') {
       gameState.dungeon = new TileDungeonScreen(game, p, stage.dungeonTiled || {});
   } else {
       gameState.dungeon = new DungeonScreen(game, p, stage.dungeon || {});
   }
   ```
   To add a SECOND tiled dungeon, add another branch (e.g. `target === 'tiled2'
   → new TileDungeonScreen(game, p, stage.dungeonTiled2)`). If you ever have
   many, generalize to a `stage.dungeons[target]` lookup with a `kind` field —
   but the one-line branch is fine for 2–3.

3. `main.js` update loop: `gameState.dungeon.update(dt)` each frame; the tiled
   screen sets `handlesInteract=true` and raises `exitRequested` when interact
   means "climb out" (see the rope section — it owns the interact key).
   `renderGame` calls `gameState.dungeon.render(ctx)` (+ `renderDebug` when `C`).

---

## 2. Recipe: add a new tiled dungeon

### 2.1 Prepare the tile art
- The tile is one **square-ish PNG** repeated infinitely. Line-art on a light/
  white ground fits the game. Put it in `assets-v2/`.
- If your source is a **vector .eps/.jpg** (like the rope was), rasterize the eps
  cleanly (see §5 art pipeline). The tile does NOT need a transparent background
  — it's drawn opaque as the floor.
- Whatever the tile's native resolution, it will be **scaled by `tileScale`** at
  draw time (see §3.2). You do not need to pre-size it.

### 2.2 Load it (game.js)
In `src/engine/game.js` `loadAssets()`, near the other dungeon assets:
```js
this.loadImage('dungeon_tile2', 'assets-v2/your-new-tile.png'),
this.loadJSON('dungeon_tile2_collision', 'assets-v2/your-new-tile-collision.json'),
```

### 2.3 Build the collision mask (tool)
Skulls/bushes-style obstacles = solid, walkable ground = passable. See §4. Export
`your-new-tile-collision.json` into `assets-v2/`.

### 2.4 Stage config (stages.js)
Add a config block alongside `dungeonTiled`:
```js
dungeonTiled2: {
    name: 'Your Dungeon', tile: 'dungeon_tile2', collision: 'dungeon_tile2_collision',
    tileScale: 1.2722,   // see §3.2 — density-matched to the overworld, −20%
    charScale: 1.0,      // constant character size (keep 1.0)
    colScale: 0.7,       // collision footprint shrink vs character (see §3.5)
    // optional rope: { enabled:true, length:540, width:15, sway:10, endDX:90, endDY:0 },
},
```
All fields are optional (defaults live in the `TileDungeonScreen` constructor).

### 2.5 Add the hole + dispatch
- `stage.holes.push({ x, y, w, h, target:'tiled2', triggerInset:0.22, vanishLine:0.5 })`
  centered on a hole graphic.
- Add the `target === 'tiled2'` branch in `enterDungeon()` (§1.2).

That's it — reusing `TileDungeonScreen` for a new tile.

---

## 3. How `TileDungeonScreen` works (what you're reusing)

File: `src/screens/tiledungeon.js`. Config keys: `tile, collision, name,
tileScale, charScale, colScale, dropHeight, startX, startY, rope, jump` plus the
variant keys `sandColor, bgColor, horizontal, deckYFrac, railYFrac` (see §9).

### 3.1 Coordinate model — the ONE thing to internalize
The character is **pinned to a fixed screen point** (`_feetPoint()` =
`(width/2, height*0.56)`, canvas is 1280×720). The **world scrolls** under it via
a virtual camera `camX/camY` (floor-plane pixels).

**Plane → screen mapping is: `screen = plane − cam`.** i.e. a floor point at
plane `(Px,Py)` draws at screen `(Px−camX, Py−camY)`. The player's plane feet
position is therefore `(camX + feetPoint.x, camY + feetPoint.y)`. Everything
(rope anchoring, touch tests, collision sampling) uses this one rule.

Walking increases/decreases `camX/camY` (`moveSpeed = player.speed*60 ≈ 180 px/s`,
diagonal-normalized, per-axis so you slide along walls).

### 3.2 Seam-free infinite tiling (`_drawFloor`)
- `tileScale` = the **stage-3 map's own on-screen density** so the dungeon reads
  at the same detail level as the overworld: `backgroundImageRect.w / mapNativeW
  = 8815/5543 ≈ 1.5903`, then the user dialed it **−20% → 1.2722**. Bigger tile =
  fewer repeats on screen (each tile > one screen).
- **No hairline seams:** at fractional scale/scroll, drawing tiles at raw float
  positions leaks the dark background through as thin grey lines. Fix: snap every
  tile boundary to a shared integer pixel (`x0=round(...)`, `x1=round(next)`,
  width `=x1−x0+1`) so neighbours share the exact edge AND overlap 1px. Tiles are
  opaque so the overlap is invisible.

### 3.3 Constant-size character (`_drawCharacter`)
- Draws `player.getCurrentFrame()` at `frame.width*charScale` (no perspective
  factor). Feet anchored (bottom-centre) at `_feetPoint()`; honors `frame.flipped`
  and `frame.vAlign`. `charScale=1.0` ≈ the overworld's ~1× camera.
- Facing is computed by the screen ITSELF (8-way from the movement vector) — it
  does NOT call `player.move()`. So any facing rules (see the rope's down-facing
  disable) must be applied in this screen's facing block, not in `player.js`.

### 3.4 Entry fall + HUD
- `falling` drop-in reuses the overworld fall dynamics (`fallStartSpeed/
  fallAccelPerSec/fallMaxSpeed`), lifting the feet by `dropOffset` (default 460)
  at constant size; `fadeIn` black→clear; a hustle/charge bar (`updateCharge` +
  `chargeUp` on dash) identical to the overworld; `[E] climb out` hint.

### 3.5 Collision box = stage-3 box, shrunk
- `_spriteRect()` = full sprite bbox (`player.width/height × charScale`),
  feet-anchored & centered on `_feetPoint()`. `_footRect()` = that inset by the
  SAME `colOffX/colOffY/colW/colH` ratios the overworld uses, then shrunk by
  `colScale` (0.7, −30%) **about its centre**.
- Why shrink: the overworld inflates the sprite past its footprint via the
  perspective factor (~1.6–1.9× in the play area), so the box reads small vs the
  character there; this flat screen has no such inflation, so −30% matches the
  feel. `C`-debug draws lime bbox + red footprint exactly like `player.render`.

### 3.6 Spawn unstick
`_unstickSpawn()` spiral-searches outward from `cam(0,0)` for an open cell so the
player never drops in wedged inside a solid obstacle.

---

## 4. Tile collision (per-tile grid mask + tool)

**Model:** because the floor is ONE tile repeated, collision is a **per-tile grid
mask** that tiles by modulo. At runtime the player's feet plane position is
wrapped into tile-local cells and tested (`_boxHitsSolid`, per-axis so you slide).

**Mask JSON format** (`assets-v2/<tile>-collision.json`):
```json
{ "tile":"<file>.png", "nativeW":820, "nativeH":1169, "cols":128, "rows":182,
  "cells": ["0010...", "..."] }   // rows of '0'/'1' strings, '1' = solid
```
Loaded via `game.loadJSON('<key>_collision', ...)`; the screen parses it into a
`Uint8Array` in its constructor. Runtime reads whatever `cols/rows` the JSON
declares — no code change to change resolution.

**Authoring tool:** `tools/tile-collision.html` (open via a local http server:
`python3 -m http.server` then `/tools/tile-collision.html`).
- Auto-detects by color: **yellow → skull (solid)**, **tan with enough coverage →
  bush (solid)**, white/gray rock → walkable. Sliders: bush threshold + grid
  resolution (default 128 cols, max 160). Paint/erase to fix stragglers. Load
  JSON to keep editing. Export writes the JSON (download → move into `assets-v2/`).
- **For a DIFFERENT tile:** pass `?tile=<file-in-assets-v2>` — e.g.
  `tools/tile-collision.html?tile=rafe-saborosa-pista.png`. The tool derives
  `TILE_SRC`, the export filename, and the JSON `tile` field from that basename, so
  ONE tool serves every tiled dungeon (no-param = the default skull tile). Adjust
  the color classifiers (`isYellow`/`isTan`) only if your tile's obstacle colors
  differ — the pista's tan structure already trips `isTan`, so its walls/legs
  auto-seed solid and the white road deck stays open.
- Auto-detection is a starting point; verify in-game with the `C` debug overlay
  (draws solid cells red + the feet box) and paint corrections.

---

## 5. Art pipeline (rasterizing vector art, tileable segments, thick lines)

Learned extracting the rope from a vecteezy `.eps`; reuse for tiles/props.
- **Rasterize an .eps** cleanly: `gs -q -dSAFER -dEPSCrop -r50 -sDEVICE=pngalpha
  -o out.png file.eps`. NOTE these files often have a **white background fill**,
  so the alpha is opaque everywhere — **key on DARKNESS (luminance < 128), not
  alpha**, to find the ink.
- **Find a vertically-tileable segment:** the pattern repeats with some pixel
  period; find it via **autocorrelation of the per-row ink count**, then crop
  exactly one period → it tiles seamlessly at any length.
- **Transparent exterior, opaque interior:** `scipy.ndimage.label` the white
  pixels; components touching the **left/right edges** are exterior → set alpha 0;
  enclosed interior white (not touching edges) stays opaque.
- **Thicker outlines:** `scipy.ndimage.binary_dilation(dark, iterations=R)` — do
  it with **vertical wrap** (vstack 3 copies, dilate, crop the middle third) so
  the tiling seam stays seamless. Higher R = thicker lines.
- **Downscaled line-art → use NEAREST, not bilinear.** At a big downscale (the
  rope was ~14×) bilinear greys thin black lines into mush; nearest keeps them
  solid black and crisp. Set `ctx.imageSmoothingEnabled=false` scoped by a
  `save()/restore()`. (The FLOOR tiles are large and fine with smoothing; this is
  specifically for small/thin high-contrast art.)

---

## 6. Gotchas & conventions (don't relearn these)

- **Interact key ownership:** the tiled screen sets `handlesInteract=true` and
  raises `exitRequested` when interact should climb out; `main.js` honors both
  flags. This lets the rope steal `E` for grab/release without also exiting. The
  perspective `DungeonScreen` does NOT set the flag, so it still exits on interact
  directly. If your new dungeon needs a context key, follow this pattern.
- **Facing rules go in the screen**, not `player.js` — the tiled screen computes
  facing itself and never calls `player.move()` (where the green-wall climb clamp
  lives). E.g. the rope disables the 3 down facings by remapping them to up/
  up-diagonals right after the screen's 8-way facing block.
- **Input actions:** movement = arrows/WASD; `dash` = hustle; `interact` = E
  (gamepad button 3); `lift` = **Space** (gamepad button 0) — `lift` is currently
  UNUSED in the tiled screen except for the rope jump, so it's free.
- **Perf:** the floor draws a small grid of `drawImage`s; cheap. When tiling a
  long strip (the rope), **cap the loop to the visible screen** so an off-screen
  end can't spawn hundreds of draws. Game targets 60fps (see PERFORMANCE.md).
- **Headless verify harness** (handy but the user now prefers testing in-session):
  a throwaway HTML including `perf,input,audio,scale.config,game,spritesheet,
  player,world,stages,tiledungeon` scripts + a `fakeInput`, driving `update`/
  `render` in a **requestAnimationFrame loop** (a single render often screenshots
  black), captured with `google-chrome --headless --virtual-time-budget=9000
  --screenshot`. Delete the harness after.
- **Git:** the user does ALL git (commit/push). Claude only edits code — never
  commit. Leave changes unstaged.

---

## 7. File map (what you'll touch)

| File | What |
|------|------|
| `assets-v2/<tile>.png` | the new floor tile |
| `assets-v2/<tile>-collision.json` | per-tile solid grid (from the tool) |
| `src/engine/game.js` | `loadImage`/`loadJSON` the two assets |
| `src/world/stages.js` | `dungeonTiledN` config block + a `holes[]` entry |
| `src/main.js` | one `target === 'tiledN'` branch in `enterDungeon()` |
| `src/screens/tiledungeon.js` | REUSE as-is (already tile-agnostic + variant flags, §9); only edit for genuinely new behavior |
| `tools/tile-collision.html` | pass `?tile=<file>` (no code edit needed) |

For the pista specifically: `assets-v2/rafe-saborosa-pista.png` (+ its
`-collision.json`) is the composited/cropped tile; `assets-v2/rafe-saborosa-pista-01.png`
and `-02.png` are the two source layers kept for re-compositing.

## 8. Related notes
- Rope system + this tiled dungeon's full details: see the auto-memory
  `tiled_dungeon_and_rope.md`.
- Rope-hop / shadow mechanic (built) and the open "rope should slacken not stay a
  straight pole" work: `rope_jump_mechanic_planned.md`.
- Overworld perspective model (for contrast): `assets-v2/mapa/perspective.json` +
  `World.getPerspectiveScale`.

---

## 9. Variant worked example — the "pista" (transparent horizontal bridge)

The **second** tiled dungeon (`target: 'tiled2'`, config `stage.dungeonTiled2`)
looks nothing like the Bone Pit yet reuses `TileDungeonScreen` unchanged except
for a handful of **flags**. Use it as the template when a dungeon isn't "opaque
field over a void." What it is: an **endless bridge/aqueduct** — a tan tiled
parapet with a white-grid road deck and legs — that repeats **left↔right only**,
floating on flat sand, that the player drops onto and walks along. He is confined
to the road (never the sand), and the near railing draws **in front of** him.

### 9.1 The four things that make it different

1. **Transparent tile over a sand fill (not an opaque field over a void).**
   The tile PNG has a real alpha channel; its transparent parts must show the
   ground, not black. `render()` fills `this.bgColor` first, where
   `bgColor = cfg.sandColor || cfg.bgColor || '#0c1020'`. Pass
   `sandColor: '#c8bb9b'` (the overworld `layers.sand.color`) and the dungeon
   reads as the same flat sand as stage 3, with the structure sitting on top. The
   opaque Bone Pit tile leaves `bgColor` at the dark default and never sees it.

2. **Two-layer composite art, cropped to its ink.** The art shipped as TWO
   same-resolution PNGs meant to be stacked (`rafe-saborosa-pista-01.png` base +
   `-02.png` on top). "Extract only the non-transparent part" = alpha-composite
   them, then **crop to the opaque bounding box** so the tile IS the structure
   (transparent margins gone). Recipe (PIL): `Image.alpha_composite(a, b)`, find
   `alpha>10` bbox, `.crop(bbox)`. Keep the source layers around for re-runs.

3. **Horizontal-only tiling + spawn-on-the-deck (`horizontal`, `deckYFrac`).**
   A bridge connects to itself on the **sides only**, not top/bottom. With
   `horizontal: true`, `_drawFloor` draws **one strip** tiled in X (tile top pinned
   at plane-Y 0 → screen `−camY`); the sand backdrop shows above and below. The
   player must land ON the road, so `camY` is seeded from `deckYFrac` (the deck
   centre as a fraction of native height — measure it: the pista's white road band
   is native Y ≈ 65–260 of 659 → centre ≈ **0.246**) such that the deck centre sits
   under the feet point. **Confinement:** `_boxHitsSolid` no longer wraps rows in
   horizontal mode, and treats any row **outside** the strip (above the top rail /
   below the bottom) as solid — so the tan railings wall the deck's two long edges
   and the player physically cannot step onto the sand. Result: infinite walk in X,
   a fixed ~170px-tall road in Y.

4. **Depth-sorted near railing (`railYFrac`).** In a flat top-down blit the whole
   tile is "ground," so the player always stands on the near parapet. To make him
   walk BEHIND it at the lower edge, `_drawBridgeRailing()` re-blits just the tile
   slice from `railYFrac` downward (native Y ≈ 260 → **0.39**: the near parapet +
   legs) a SECOND time, AFTER `_drawCharacter()`, pixel-aligned to the strip. Where
   they overlap (only when he's at the deck's lower edge) his feet tuck behind the
   rail. Everywhere else the slice covers sand/itself and nothing changes. Lower
   `railYFrac` to tuck him deeper — but not into the walkable white deck, or you'll
   occlude a player standing mid-road.

### 9.2 The config that turns them all on

```js
dungeonTiled2: {
    name: 'Pista', tile: 'dungeon_tile_pista',
    collision: 'dungeon_tile_pista_collision',
    sandColor: '#c8bb9b',            // (1) flat sand behind the transparent tile
    horizontal: true, deckYFrac: 0.246, // (3) X-only strip; drop onto the road
    railYFrac: 0.39,                 // (4) near railing draws over the player
    tileScale: 0.87, charScale: 1.0, colScale: 0.7,
    rope: { enabled: false },        // the rope is a Bone-Pit thing; off here
},
```

Everything else is the standard recipe (§2): `loadImage`/`loadJSON` in `game.js`,
a `holes[]` entry (§1 — centre it on the buraco, not the debug readout), and one
`target === 'tiled2'` branch in `enterDungeon()`.

### 9.3 How to measure `deckYFrac` / `railYFrac` for a new bridge tile

Both are fractions of the tile's **native height**. Read them off the collision
mask: per row, the solid fraction spikes on a tan band and drops to ~0 on the open
white deck. The walkable deck is the low-fraction span between the top and middle
bands → `deckYFrac` = its centre ÷ native height. The near railing starts at the
middle band's top → `railYFrac` = that row ÷ native height. (For the pista: rows
7–27 open = deck, band at row ~28 = near rail; native H 659, 71 rows.)

### 9.4 Gotchas specific to this variant

- **Don't Y-wrap anything in horizontal mode.** `_drawFloor`, `_boxHitsSolid`, AND
  the `renderDebug` collision overlay each have a horizontal branch that draws/tests
  the single strip. If you add a new consumer of the tile grid, give it one too.
- **The `+1px` seam overlap is X-only** for the strip (there's no vertical
  neighbour to seam against); the height is drawn exact so it doesn't bleed past the
  legs into the sand.
- **Off-strip = solid, not open.** Treating outside-the-strip as *open* would let a
  clipped player wander infinite sand; solid keeps him on the deck no matter what.
- **Auto-collision "just worked" here** because the structure is tan and the tool's
  `isTan` classifier already flags it — the deck (white) and exterior (transparent)
  stay open with zero hand-painting. A differently-coloured structure may need the
  classifiers tuned (§4).
