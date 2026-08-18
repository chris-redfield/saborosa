# Beat 'em up — how to edit it

The knobs, and where they are. `STATE.md` is the design record: what the game
is and why it is shaped that way. **This file is the opposite** — it assumes you
know what you want to change and just need the number.

Everything here lives in `src/config.js` unless it says otherwise. Config is
plain data with no logic, so nothing in it can break by being edited; the worst
case is a value that reads wrong.

```
Run it:      serve the repo root, open beatemup-dungeon/index.html
Debug it:    hold C
Package it:  ./package.sh   ->  dist/ + beatemup-dungeon-itch.zip
Inspect it:  node tools/build-manifest.js --list
```

Reloading is enough to see a config change — `index.html` cache-busts its own
script tags with `?v=Date.now()`, so there is no stale-JS trap.

---

## How big everyone is

**One number: `BODY_SCALE`, at the very top of `config.js`.**

```js
const BODY_SCALE = 0.72;   // 0.8 was the original; 0.72 is 10% smaller
```

Lower it and the whole cast shrinks. It scales everything measured against a
body — drawn height, hurtbox, every punch's reach and lift, enemy stand-off and
reach, jump height, ground shadow, floating enemy bars — so a sprite never
shrinks while the punch it throws stays long.

It deliberately does **not** touch anything measured against the level (belt
depth, walk speed, camera, knockback) or the player's life bar, which is screen
furniture rather than a fighter.

> It used to be a literal `* 0.8` written out twenty-odd times with a comment
> saying "grep it and move them all together". Missing one did not fail — it
> just made a punch land across a visible gap.

### One thing BODY_SCALE does NOT scale, on purpose

`verticalReach: 70` — how far up or down a punch connects. If it scaled with the
bodies, a shrinking cast would eventually be unable to reach the Mosca Boss at
all, and the fight would silently become impossible.

The trade is that shrinking the cast still narrows the window you can hit the
boss in, because the jump apex drops while `flyBossHoverY` stays put:

| BODY_SCALE | jump apex | window to punch the boss |
|---|---|---|
| 0.80 | 94 | 221ms of the 620ms jump |
| 0.72 | 85 | 136ms |

If that gets too tight, lower **`flyBossHoverY`** (150) rather than touching
`verticalReach`. 142 restores the 0.80 window at 0.72 scale.

---

## The backdrop

One layer, parallax 1.0, and it is the **video itself**, projected behind the
fighters. Walking winds the shot forward; standing still freezes it on a frame.

```js
SOURCES.plate: {
  kind: 'video',
  src: 'v2:beatemup-dungeon/batidao-de-coco-background-original.mp4',
  worldPxPerSecond: 116,  // THE SYNC -- see below
  resyncS: 0.75,          // drift allowed before it seeks instead of catching up
  trackGain: 1.2,         // how hard drift is corrected
  maxRate: 6,             // playbackRate ceiling
},
beltTopY: 520,   // where the walkable band starts -- measured off the plate
beltDepth: 190,  // how deep it is; THE difficulty dial, change alone
```

**`worldPxPerSecond` is the only number that matters here**, and it is measured,
not chosen: how many px of camera travel one second of the shot's own pan is
worth. Get it right and the background moves 1:1 with the world. Too low and the
film races you; too high and you slide across a still. If walking looks wrong,
change this and nothing else.

For this shot: the pan is 2266px of the 848-wide source over 29.52s, which at
720 tall is 3413 screen px — 116 px/s. At `walkSpeedX 300` that plays it at
about 2.6x, which reads as normal because the only motion in the shot is the
pan itself.

**The video does not scroll**; it is drawn stationary filling the canvas and the
shot's own pan supplies the parallax. Sliding it as well would move the picture
twice.

**It is played, not seeked.** Writing `currentTime` every frame is the obvious
implementation and it stutters — seeks decode from the nearest keyframe, seconds
apart. Instead the rate is set to whatever keeps it level with the camera, and
it only seeks when drift exceeds `resyncS`.

**A stitched panorama was tried here and rejected — do not propose it again for
this level.** The whole shot stitched into one strip drawn as `kind: 'image'` is
cheaper on every countable measure and it looked bad. The plate is the moving
footage; that is the point of it. `tools/build-plate-panorama.py` and its output
remain on disk, unused.

**If a future shot has motion in it** — smoke, a crowd, anything that moves
while the camera is still — `kind: 'film'` is still wired, with a scrub mode for
scrolling and a play mode for arenas. See STATE.md.

**To move the belt onto the ground of a new plate**, hold **C**: the magenta
bands are where the player cannot stand, each labelled with the knob that
resizes it.

**To move the belt onto the ground of a new plate**, hold **C**: the magenta
bands are where the player cannot stand, each labelled with the knob that
resizes it. Move `beltTopY` alone first — `beltDepth` is the depth dial of the
genre and changing both at once makes neither judgeable.

## How fast the animations play

Three separate systems. Only the first is free to change.

### 1. `POSE_MS` — the looping and one-shot poses

```js
POSE_MS: { idle: 200, walk: 124, hurt: 100, down: 110, death: 130 },
```

Milliseconds **per frame**. Pure animation — changing these costs nothing in
gameplay. Multiply by the row's frame count for the full pass:

| pose | frames | ms/frame | full pass |
|---|---|---|---|
| idle | 3 | 200 | 600ms breath |
| walk | 6 | 124 | 744ms cycle |
| hurt | 2 | 100 | 200ms |
| down (knockdown) | 6 | 110 | 660ms |
| death | 8 | 130 | 1040ms |

Looping poses (idle, walk) run off a free-running clock and wrap. One-shot
poses (hurt, down, death) play forward once and **hold the last frame** —
holding matters, or a death would loop and resurrect the corpse every second.

**Picking up** spreads its frames across the action rather than running at a
fixed rate, so the drawing always fills exactly the time the player is committed
for. One button, two animations, and the OBJECT chooses which:

```js
PICKUP_MS: { ground: 420, heavy: 640 },
```

`ground` is the stoop (row 9, 2 frames); `heavy` is the hoist from in front
(row 7, 4 frames). Changing the number changes both the commitment and the
animation length together. Which one plays comes from
`Player._liftTargetHeavy()` — there are no liftable objects yet, so it is always
the stoop.

**The GO prompt** — the arrow shown when an arena clears and the way forward
opens:

```js
goMs: 2600,      // total time on screen
goFadeMs: 400,   // the fade, taken from the END of goMs -- not added to it
```

So it is solid for 2200ms and then fades. Raising `goMs` buys solid time. Its
place, size, bob and fade are the other `go*` knobs in the same block.

**After you die**, the death row plays out and then *holds*, before the game
will accept a restart or fade up the DOWN card:

```js
deathHoldMs: 1000,   // held on the last frame, on top of the row's 1040ms
```

A player who dies is almost always mid-mash. Without the hold the first press
lands a heartbeat after the animation ends, and the death is gone before it
registers — you know you lost, but not how. Total before anything is accepted:
**2040ms**.

> **Reading old numbers back:** these were once tuned against a bug. `animT` was
> advanced twice per frame, so every looping pose ran at DOUBLE the written
> rate — `walk: 95` really played at 47ms. That is fixed. What is written here
> is now what is drawn.

### 2. The jump — driven by the arc, not by a clock

The six jump frames are spread across **`jumpMs: 620`**, so they stay married to
the height the fighter is actually at. Retiming the jump retimes the animation
for free; there is no separate frame rate to keep in sync.

**`jumpMs` is gameplay** — it sets the window above, so changing it changes the
boss fight.

To make the *landing* read longer without touching that, use:

```js
jumpLandHoldMs: 150,   // the last frame is held this long AFTER touchdown
```

This adds time rather than moving it — re-weighting the six frames to linger on
the landing would have to steal that time from the rise. The hold is dropped the
instant the player moves, so it reads as landing rather than as sticking.

### 3. The combo — driven by the hit windows

```js
COMBO: [ { pose: 'combo1', startupMs: 55, activeMs: 70, recoverMs: 85, ... }, ... ]
```

**These are not animation timings.** Each combo hit is a 2-frame slice — the
wind-up is shown for `startupMs`, the strike for `activeMs + recoverMs` — so
the drawing can never drift out of step with the window that can actually hit.

Changing them changes the fight:

- `startupMs` is the tell an opponent can react to. Longer = easier to read you.
- `activeMs` is how long the hitbox lives.
- `recoverMs` is your punish window if you whiff.
- `cancelMs` is how long a press still continues the string.

Current string: 5 hits, 210 / 210 / 250 / 210 / 450ms, **1330ms** uncancelled.

**The two combos intercalate off one button.** Both rows are the same string
through hit four — the same drawings — and differ only in the finisher, so
`CONFIG.COMBO` holds the shared hits and `CONFIG.COMBO_ALT_FINISH` replaces the
last one on alternate chains:

```
chain 1   ... -> combo5     the uppercut, launches
chain 2   ... -> comboLow5  the low lunging punch, shoves down the belt
chain 3   ... -> combo5     and so on
```

The flip happens in `Player._comboDefs()` and **only when a chain begins**, so
a finisher can never change mid-combo. A chain broken by a hit still alternates,
which is what stops it settling back into one drawing when a fight goes badly.

**Both endings do the same damage on purpose.** Alternating is a look, not a
rotation to track — if one ending hit harder the string would become worth
counting, and mashing would be optimal on every other chain.

---

## The camera

```js
camFocusX: 0.42,       // where in the frame the player sits, 0..1
camDeadzone: 130,      // px either side of that before the camera reacts
camFollowGain: 1.8,    // px of framing correction bought by one px of WALKING
```

**The camera only moves because the player moved forward.** `camFollowGain` is a
budget: walk a px, earn that many px of camera. Stand still and the camera is
still.

**At 1.0 the player is never dragged back toward the middle** — the camera
matches the walk exactly, so their position on screen does not change. Wherever
they are when they push the edge is where they stay, and where they will be
standing when the next arena locks. Above 1 the camera outruns them to re-frame
the shot, which reads as the player sliding backwards under their own feet.

It only goes forward — the left edge of the view is a wall. Making it reverse is
a real feature, not a free one: the plate is video, and no browser can play a
video backwards.

## Sizes

```js
BODY_SCALE: 0.72,                       // every fighter, and everything measured against one
CHARACTERS.coconut.drawScale: 0.9,      // the player only, DRAWN size
flyBossSizePx: 253,                     // the Mosca, drawn AND simulated
```

`drawScale` is a per-character drawn size on top of `fighterSizePx`. It does
**not** touch the hurtbox, punch reaches or jump, which are global — so it is a
look, not a rebalance. Keep it near 1: the rule elsewhere in the file is that a
sprite must not shrink while its reach does not, and far below 0.9 the punches
start landing across a visible gap.

`flyBossSizePx` is different — `halfW()` and `bodyHeight()` derive from it, so
the boss's size in the simulation moves with its drawn size.

## Dev mode

```js
DEV: { on: true, punchDamage: 50 },   // top of config.js
```

Every player punch does `punchDamage` instead of its own. **Damage and nothing
else** — reach, timing, knockdown, the combo and every enemy's HP behave exactly
as they ship, so what you are testing is the real fight at speed rather than a
different game. At 50: JUIXY and TOM die in one hit, ERKPA and the Mosca in two.

It is applied at the one place the player's damage is read (`combat.playerHits`)
rather than by rewriting `CONFIG.COMBO` — the table documents a 28-damage string
that every enemy's HP is tuned against, and a config that lies about that is
worse than a branch.

**It is loud on purpose.** The HUD draws a `DEV 50 dmg` marker in the top right
while it is on, and **`package.sh` refuses to build** until `on` is false. A
shipped build where every punch does 50 reads as a balance disaster rather than
a forgotten switch, and by then the person looking at it is usually not the
person who left it on.

## How hard everyone hits

```
COMBO damage   4 + 5 + 6 + 4 + 9  =  28 for the full string
enemy HP       JUIXY 34   TOM 40   ERKPA 55
player HP      110
```

**Keep the player's HP a multiple of 22.** The hand-drawn life bar is 22 squares,
so 110 makes each square exactly 5 damage. The boss's 88 is a multiple for the
same reason.

The full-combo total was held at 28 when the combo went from three hits to five,
deliberately — so every enemy's time-to-kill stayed where it was tuned. Raising
it is a real rebalance, not a tweak: at 40 damage a full string one-combos TOM.

---

## The coconut's sprites

The player has a sheet drawn for this game. The villains are still the main
game's 9x5 packs, so `sheets.js` carries both formats until villain sheets exist.

### Re-cutting the sheet

```
python3 tools/build-beat-coconut-defs.py     # from the REPO ROOT, not here
```

Master in, atlas + defs out:

```
assets-v2/beatemup-dungeon/coconut-sprites-flat.png     the illustrator's file
  ->  coconut-beat-game.png        packed atlas, 45 unique frames
  ->  coconut-beat-sprites.json    per-frame rects + anchors, named animations
```

The tool **fails loudly** if a row's frame count does not match what it expects,
rather than cutting something plausible and wrong. If the illustrator adds or
removes a frame, update the `ROWS` table in the tool to match.

### The 13 rows

The illustrator's rows, 1-indexed as delivered:

| row | meaning | frames | animation |
|---|---|---|---|
| 1 | respirando | 3 | `idle` |
| 2 | andando | 6 | `walk` |
| 3 | pulando | 6 | `jump` |
| 4 | pulando e socando | 7 | `airPunch` — **cut, not wired** |
| 5 | combo 1 | 10 | `combo` — 5 hits, ends in the **uppercut** |
| 6 | combo 2 | 10 | `comboLow` — same 5 hits, ends in a low punch. **Wired**, alternates |
| 7 | levanta objeto | 4 | `lift` — the heavy hoist, **wired** to pickup |
| 8 | levanta e joga | 5 | `liftThrow` — **cut, not wired** |
| 9 | pega do chao | 2 | `pickGround` — the stoop, **wired** to pickup (default) |
| 10 | carregando e andando | 5 | `carryWalk` — **cut, not wired** |
| 11 | apanhando 1 | 2 | `hurt` |
| 12 | apanhando e caindo | 6 | `down` |
| 13 | caindo e morrendo | 8 | `death` |

Both combo rows are the **same string** pose-for-pose through hit 4; only the
9th frame and the finisher differ. Contact lands on frames 2, 4, 6, 8 and 10.

### Two things about this sheet that will bite

**It is not a grid.** Rows hold 3 to 10 frames and frame widths run 190px to
285px, because an extended arm is simply wider than a guard. There is no cell
size to divide by — every frame is found by its own content bbox.

**Every frame carries an anchor, and centring on the bbox instead is wrong.**
The anchor is read off the coconut *body* (the tan ball, ignoring the yellow
arms): horizontal centroid, and the body's lowest row as the ground line. Centre
a ragged frame on its bbox and an extended arm drags the centre toward the
punch, so the body wobbles away from it on every hit.

**The body's bottom is the lowest row with a RUN of body in it**, not the lowest
body-coloured pixel — `BODY_MIN_RUN` in the cutter. Where the yellow arm meets
its black outline the art antialiases through colours within tolerance of the
body tan; they are single pixels, one per row, but "lowest matching pixel"
cannot tell them from a body. On the ground-pickup frame that put the anchor
34px low, at the tip of the reaching arm, and the coconut was drawn hanging in
the air off its own hand — a handstand. The real body has 8 to 51 pixels a row
where the noise has 1, so the rule needs no tuning.

**Which way the art faces is recorded in the defs, not assumed in code.** This
sheet is drawn facing **right**; the main game's packs face **left**. Each pack
declares `native` and the draw flip is "not that side". Getting this wrong does
not fail loudly — the character simply walks backwards, facing away from the
direction it is moving.

### Wiring a cut-but-unused row

`airPunch` (row 4), `liftThrow` (row 8) and `carryWalk` (row 10) are cut and
named but have no mechanic behind them. To wire one it is a `POSE_RAGGED` entry
(already there) plus whatever state drives it.

**The lift mechanic is half wired.** The button (L/E, pad B), the `pickup` state
and both animations are in; what is missing is anything to pick up. The whole
seam is one method:

```js
// player.js -- returns false today, so the stoop always plays
_liftTargetHeavy() { return false; }
```

Give it something to find and the hoist starts appearing on its own. Carrying
and throwing still need `carryWalk` and `liftThrow` wired on top.

---

## Adding an asset

Add it to **`src/manifest.js`**, once. `package.sh` derives its copy list from
that same file, so the build follows automatically and never needs editing.

This is not a style preference. The flying dungeon shipped without its fly
sprites because a folder was added and a `cp` line was not — dev kept working
because it read the repo, and every packaged build was broken.

`package.sh` refuses to build on: a `src/*.js` missing from `index.html`'s
loader list, a missing required asset, a failed path rewrite, or any manifest
file absent from `dist/`.

> **`dist/` is a transformed copy, not a snapshot.** `package.sh` rewrites the
> asset base paths inside it. Never restore source from `dist/` — use git.
