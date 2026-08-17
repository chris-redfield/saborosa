# Beat 'em up — state of play

Handoff notes. Covers what was built, why it is shaped the way it is, and what
is still open. Numbers here were read off `src/config.js` at the time of
writing — **trust the file over this document** if they ever disagree.

```
Run it:      serve the repo root, open beatemup-dungeon/index.html
Debug it:    hold C
Package it:  ./package.sh   →  dist/ + beatemup-dungeon-itch.zip
Inspect it:  node tools/build-manifest.js --list
```

Controls: **arrows/WASD** move · **J / Z / Space** punch (tap again to combo) ·
**K / X** jump · **hold C** debug. Gamepad works through the main game's own
`assets/gamepad-mapping.json`.

---

## The one constraint that will break things if forgotten

**The backdrop will be FILMED FOOTAGE, and it is a single shot.** The far
scenery and the ground the fighters stand on are the same photograph. So the
render stack has exactly **one `plate` layer at parallax 1.0**.

It began as two tiled layers at 0.35 and 1.0, and that was wrong: real footage
would have put a second copy of a shot that already contains its own floor
sliding underneath itself. Parallax 1.0 is also the only honest value for a
plate — a real camera move already carries its own parallax inside the frame.

When the footage lands, the **only** edit is `SOURCES.plate`:

```js
plate: { kind: 'film', frames: [...], pxPerFrame: 24, holdMs: 66 }
```

`backdrop.js` already runs a film source in two modes, and **the segment picks
which**, not the config:

| segment | mode | what it means |
|---|---|---|
| `scroll` | `scrub` | frame indexed by CAMERA POSITION — a dolly. Walking winds the footage forward, stopping stops it. |
| `arena` / `boss` | `play` | frame indexed by TIME, looping — the world alive around a locked fight. |

**The belt survives that swap.** `beltTopY` / `beltDepth` are a lane defined
*over* the plate, not derived from it — they are the only thing to re-measure
when footage arrives. Read the ground band off one frame, set them, done. Hit
tests, draw sorting, camera and AI are all expressed in `z` and follow.

Footage will be downscaled before shipping. `loadBig`'s cap is the knob; a frame
sequence is the most expensive thing this game will ever load — see
PERFORMANCE.md for what happened last time textures got away from us.

---

## The files

| file | role |
|---|---|
| `src/game.js` | the disposable SHELL — canvas, loop, phases, wiring |
| `src/config.js` | every tunable, plain data, no logic |
| `src/manifest.js` | **the one list of every asset**; the game AND the build read it |
| `src/backdrop.js` | the layer stack and its sources (tile / image / **film**) |
| `src/stage.js` | the level director: segments, camera, arena locks, spawning |
| `src/fighter.js` | the shared body: belt position, health, attacks, knockdowns |
| `src/player.js` | the coconut — input → intent, and nothing else |
| `src/enemy.js` | the villains, and `Crowd`, which owns **the attack token** |
| `src/fly-boss.js` | the Mosca Boss: ambush entrance, swoop, ground pass |
| `src/combat.js` | hit resolution and hitstop |
| `src/sheets.js` | reads the 9×5 character packs as **six facings** |
| `src/life-bar.js` | STILL LIFE's hand-drawn bar, player and boss |
| `src/hud.js` | health, GO prompt, end cards |
| `src/debug.js` | everything the C key draws |
| `tools/build-go-glyph.py` | cuts "GO!" out of the title lettering sheet |
| `tools/build-manifest.js` | prints & checks what package.sh copies |

⚠️ **`index.html` writes its own script tags** with a `?v=` cache-buster, for the
reason the flying dungeon records: a change landing in source *and* dist and
still throwing "X is not a function" because the browser held a cached copy of a
file whose URL never changed. **A new `src/*.js` must be added to that list** —
`package.sh` now refuses to build if one is missing.

---

## The belt

```
x       along the belt, world px
z       across it, 0 (FAR) .. beltDepth (NEAR)
jumpY   height off the floor — DRAWN ONLY

screenX = x - camX
screenY = beltTopY + z - jumpY      draw order = z ascending
```

⚠️ **`jumpY` never touches x or z**, and that is a rule. If height moved a
fighter in world space it could clear another's depth slab and land somewhere
the walk could not reach, and every question about who can hit whom would need a
third axis in it.

Current frame at `beltTopY 430`, `beltDepth 190`:

| region | y | height |
|---|---|---|
| no-walk | 0–430 | 430px — lower `beltTopY` to eat into it |
| **walkable belt** | 430–620 | 190px |
| no-walk | 620–720 | 100px — raise `beltDepth` to eat into it |

---

## Combat — what actually connects

**No polygons.** Two axis-aligned rectangles on the floor plane, plus four
conditions with no geometry at all:

```
hurtbox   59 × 24, centred on (x, z)          — same for every fighter
hitbox    reaches FORWARD by reachX, ±reachZ  — never behind you

connect = overlap in x  AND  overlap in z
          AND |attacker.jumpY − target.jumpY| < verticalReach (70)
          AND target is vulnerable (not in i-frames)
          AND this swing has not already hit (hasHit)
          AND it is the CLOSEST overlapping target
```

| attack | startup | active | recover | cancel | dmg | reachX | reachZ |
|---|---|---|---|---|---|---|---|
| jab | 70 | 80 | 110 | 260 | 6 | 77 | ±37 |
| straight | 85 | 85 | 140 | 280 | 8 | 83 | ±37 |
| finisher | 120 | 105 | 260 | — | 14 | 94 | ±42 |

Full combo = **28**. Enemy HP: JUIXY 34 (4 hits), TOM 40 (5), ERKPA 55 (6).
Player 110 — **a multiple of 22**, so each of the life bar's 22 squares is
exactly 5 damage. Keep it a multiple.

`reachZ` is the difficulty dial of the whole genre: ~49px of depth slack on a
190px belt, about a quarter of it.

⚠️ **One active window lands one hit**, enforced by `hasHit` on the attack rather
than i-frames on the victim. A punch is a discrete event.

⚠️ **Hitstop freezes the simulation, not the renderer.** The loop keeps drawing
at full rate; it just stops advancing time. Skipping the draw would read as a
dropped frame rather than a held moment.

⚠️ **No screen shake.** Built, then removed by request — the effect is not
wanted. Hitstop carries the weight of a blow. It was deleted rather than zeroed
so it does not read as an unfinished feature and get "fixed" back in.

---

## The attack token

⚠️ **The single most important AI rule here, and it is four lines.** However many
enemies are on screen, only `maxAttackers` (2) may be committing at once. The
rest close in, hover at a stand-off and circle.

Without it, six enemies that each attack when in range all attack on the same
frame, the player is hit from three sides at once, and the game is not hard — it
is arbitrary.

⚠️ **The count is of TOKEN HOLDERS, not of swinging enemies.** A token is a
reservation taken when an enemy starts closing in and held through the approach,
the wind-up and the swing. Counting only visible attackers hands tokens to
everyone still walking, and then they all arrive together — the same pile-on,
delayed by the length of a walk.

Being hit releases the token, so the turn passes immediately rather than stalling
the crowd for the length of a stun.

---

## The level

A sequence of segments, alternating walking and fighting — the genre's spine.

| # | kind | |
|---|---|---|
| 0 | scroll | to x900 |
| 1 | arena | TOM, JUIXY |
| 2 | scroll | to x2100 |
| 3 | arena | JUIXY, TOM, ERKPA |
| 4 | scroll | to x3300 |
| 5 | **boss** | the Mosca Boss |

⚠️ **Arenas carry no `camX`, on purpose** — each locks wherever the camera had
got to when the scroll handed over, which can never disagree with it. The camera
trails the player by focus + deadzone (~670px), so a lock naively set to the same
x the scroll ended at yanks the view most of a screen forward exactly as the
fight starts. Set it only to *frame* a fight deliberately — which the filmed
backdrop will want, since a locked shot is a composed one.

The camera locking **is** the message that a fight has started; every player of
this genre already reads it. That is why the arena walls are invisible.

---

## The Mosca Boss

STILL LIFE's sprites, read in place from `assets-v2/flying-dungeon/`. Two
findings inherited whole: the sheet is a **7-pose turn** (profile-left → head-on
→ profile-right), and **the flap lives across files** as `[0,1,0]` — not `[0,1]`;
the doubled A at the seam is what the artist's three-file cycle does. 01 and 03
are byte-identical, so only two load.

**Entrance, two beats, and the ambush is the good part:**

⚠️ **The entrance is a free demonstration of the boss's signature attack.** Still
Life's version enters at the player's own *height*; on a belt that becomes the
player's own *lane* — which makes the ambush geometrically identical to the
ground pass. So it performs that move once, at full speed, before the fight
starts and before it can be hurt. By the time it does it for real the player has
been shown exactly what it looks like and what it costs.

`flyBossAmbushDamage: 0` — it knocks you down and costs nothing else. An ambush
is by definition unwarned, and chipping health for that is the genre's cardinal
sin; but an entrance that passes harmlessly through is a screensaver. A knockdown
lands, is felt, cannot kill. Raise the knob to make it bite.

Then it cuts to above the arena and descends turning head-on (1.09s), so it is
already looking at you when it stops.

**Rotation: swoop, sweep, repeating — deliberately not random.** Learning the
pattern *is* the fight; a coin flip cannot be learned.

⚠️ **The ground pass is the move the belt exists for.** It charges the entire
arena width at floor level in one lane at 980px/s — faster than the player runs.
There is nowhere along x to stand and nothing to outrun; the only answer is to
step **out of the lane in z**. The lane is locked to the player's depth *at the
tell*, not at the charge, so they are shown which line is about to become lethal
and given the wind-up to leave it. It runs to the far edge and does **not** stop
on contact — a pass that ended on a hit would reward standing in it.

⚠️ **You cannot jump over the ground pass.** The vertical tolerance that lets you
jump a mook's swing is deliberately not applied to the boss: the answer is depth,
not height, and letting a jump beat it deletes the reason the move exists.

**Reaching it.** It hovers at 150 — above a standing punch, inside a jump's apex.
At `jumpHeight 94` and `verticalReach 70` the window is **221ms of the 620ms
jump** (36%), centred on the apex, `dy` closing to 56. You can punch mid-air.
Note the trade: at apex the *mooks* go out of reach.

88 HP — a multiple of 22, so exactly 4 damage a bar square.

---

## The debug view (hold C)

⚠️ **Read this before judging a box by eye.** Collision is entirely in the (x, z)
floor plane; nothing has a height. A hurtbox is a footprint at a fighter's
**feet** while the sprite towers 152px above it — so over the side view a
*correct* box looks wrong. That is the projection, not the box.

- **Plan view** (top-left) is the authority: x across, z down, one fixed scale,
  every box the true rectangle the resolver tests. An overlap there IS an overlap
  in the maths.
- **Dashed + dimmed = right place, wrong height.** A plan view drops the y axis,
  so a hovering boss draws exactly where a reachable one would. Everything is
  measured against the player's altitude.
- **Condition readout** names which of the six tests failed — `miss: DEPTH
  (dz 61)`, `miss: i-frames`, `blocked: swing spent`, `overlaps, but not
  closest`, `CONNECTS`.
- **Magenta = where the player cannot stand**, with each band labelled with the
  knob that governs it.

⚠️ **Every box drawn comes from the same function the resolver calls** —
`debugHitbox()` and `hitbox()` both return `_attackGeom()`. An overlay that draws
a box other than the one being tested is worse than none, because it is believed.

---

## Packaging

`./package.sh` → `dist/` + `beatemup-dungeon-itch.zip` (**3.9 MB, 32 files**,
`index.html` at the top of the zip, which is itch's one hard requirement).

⚠️ **The copy list is DERIVED, not written in the script.**
`tools/build-manifest.js` evaluates `src/config.js` and `src/manifest.js` — the
same two files the game runs — so it cannot drift from what the browser asks
for. This is a direct answer to the flying dungeon's shipped bug: a folder was
added, its `cp` line was not, dev kept working because it read the repo, and
every packaged build went out **without fly sprites**.

**Add assets in `src/manifest.js`. `package.sh` needs no edit, ever.**

It also refuses to build on: a `src/*.js` missing from index.html's loader, a
missing required asset, a failed base rewrite (a `sed` whose pattern no longer
matches does nothing and says nothing), or any manifest file absent from `dist/`.

Two asset roots are **mirrored** into the build rather than flattened, so
sub-paths survive and the rewrite is two lines. Unlike the flying dungeon, the
gamepad mapping resolves under `ASSET_BASE` like everything else, so it needs no
third rewrite.

Embed settings: **1280×720**, fullscreen **on**, mobile **off**, autostart
**off** — see flying-dungeon/STATE.md for why each.

---

## Two bugs whose causes are not guessable

⚠️ **A missing config knob made the boss invisible.** `flyBossTurnMs` was
undefined; it divides into the turn rate, so `facing` went NaN → the pose index
went NaN → `MOSCA_RECTS[NaN]` was undefined → `draw()` returned early. The
**shadow kept working**, because it never reads `facing`. `poseIndex()` now falls
back to head-on if facing goes non-finite, turning that into "the boss will not
turn" — visible, and it points at the cause.

⚠️ **`jumpHeight` as a shadow reference broke on anything that flies.**
`drawShadow` normalised altitude by the *player's* 94px jump. The boss's descend
beat sits at 620 → scale `1 − 6.6×0.35 = −1.3` → **negative ellipse radius**,
which throws. It threw in the shadow pass, which runs *before* the sprite pass,
so no fighters and no HUD were drawn — and the exception escaped `loop()` before
scheduling the next frame. One bad radius froze the game. There is now a separate
`shadowLiftRef` (240) and a clamp.

Both were one-line assumptions that held until something new arrived. Worth
grepping for others of the same shape.

---

## Open

- **The filmed backdrop.** The whole plate/segment design is waiting on it.
- **No sound at all.** The flying dungeon's `sound.js` is the model.
- **`Escape`/`P` are captured but do nothing** — `takePause()` exists, no pause
  state does.
- **The font.** Futura is not bundled; the stack falls through geometric sans.
  Same open decision as the other two games.
- **Enemy variety.** All three villains differ only in speed, HP and damage —
  they share one AI and one swing. A grappler or a thrower would need
  `Enemy._think` to branch.
- **The impact FX is drawn in code** (a starburst), honestly placeholder. There
  is no impact art in any Saborosa pack yet.
- **`dist/` and the zip are build output** and are not in `.gitignore` — worth
  adding before committing.
- **Enemy bars stay plain slabs.** The hand-drawn bar is 11 inked squares in a
  333px frame; at the ~50px a floating bar occupies they turn to mush.
