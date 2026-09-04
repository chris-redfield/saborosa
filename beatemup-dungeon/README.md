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


**Per-character overrides**, on top of `BODY_SCALE`:

```js
CHARACTERS.coconut.drawScale:  0.9,     // the player, DRAWN size
CHARACTERS.cigarro.drawScale:  1.452,   // raised 45% over three requests
CHARACTERS.cigarro2.drawScale: 1.691,   // the stub, 1.164x the above
CHARACTERS.cigarro3.drawScale: 1.691,   // drawn at the stub's size
CHARACTERS.barata.drawScale:   2.20896, // both roaches; 1.888 +30% then -10%
CHARACTERS.horse.drawScale:    2.2243,  // HIPÓLITO; 1.711 + 30%, paired with sizePx
flyBossSizePx: 304,                     // the Mosca, drawn AND simulated
```

`drawScale` is a drawn size only — it does not touch the hurtbox, punch reaches
or jump, so it is a look and not a rebalance.

**⚠️ EVERY ENEMY IS NOW WELL PAST THE POINT THIS SECTION USED TO WARN ABOUT.**
The rule was "much past 1.2 and the fist visibly outruns the reach behind it",
and that is exactly where the cast sits. `ENEMY_COMBOS` still swings the
92/92/108 × BODY_SCALE the cigarettes had when they were drawn a third smaller.
Growing those reaches to match is a rebalance — it makes them hit from further
away — so it has deliberately not been done. If a swing looks like it should
have connected, this is why.

**Why a pack needs an override at all.** A ragged pack is scaled so its idle
BODY is `fighterSizePx` tall, which stops a sheet drawn at a different size
arriving as a giant — but it also flattens size differences the illustrator drew
on purpose. The stub's body is 405px in the masters against the first
cigarette's 348, so his 1.164 ratio restores exactly that.

**⚠️ A ROACH IS NOT AS BIG AS ITS NUMBER SAYS.** That normalisation measures the
whole body, and for a barata the top 44px of 168 — **26%** — is horns and
antennae, so only ~124px is animal. It is why they needed 1.888 to stand as big
as a cigarette rather than merely as tall.

**They then took another flat 30% on 2026-08-22** (1.888 → 2.4544), **and 10%
back off the same day** (→ 2.20896, where it sits). That is still past the
argument above entirely: they are no longer matching a cigarette's mass, they
are bigger than the men. A choice about what the fight looks like rather than a
correction — and ⚠️ **their boxes did not move with any of it**, so the gap this
section warns about is now roughly 17% of a roach.

| | body drawn |
|---|---|
| LEBRON (coconut) | 123px |
| DUDU (cigarro) | 199px |
| DIDI / DEDÉ (cigarro2, cigarro3) | 231px |
| CLAUDINHO & ZIDANE (baratas) | 302px (~224px of animal) |
| HIPÓLITO (horse) | 304px — **and his hurtbox and reaches grew with him** |
| ESPETO (espeto) | **123px** — `drawScale` 0.9, the same as LEBRON |
| CHARUTOBI (charutobi) | **94px** — `drawScale` 0.6885, the smallest in the game |

> ⚠️ **Shrinking ESPETO moves five other numbers.** `drawScale` is drawn size
> only, so his three string `reachX` values, the death blast's `reachX`/`reachZ`
> and his `groundNudge` were all multiplied by the same 0.9. Move the scale again
> and they follow. This is the discipline both cigarettes failed at.

> ⚠️ **His body measurement is the ball PLUS the spikes.** His `bodyH` measures the
> solid ball (`bodyMinRun` 80 in the cutter), so the ball is `fighterSizePx` like
> everyone else's body and the spikes are extra on top. Raising that threshold is
> also what stopped him floating — see below.

> ⚠️ **ESPETO is the exception in both directions.** He is the smallest villain
> (a shade taller than LEBRON, less than half a roach) because he ships at the
> size the cutter gives him — and he is also the only one whose **reaches were
> measured off the art** rather than inherited. Those two facts go together: at
> `drawScale` 1.0 his fist ends where his hitbox does. Grow him and
> `ENEMY_COMBOS.espeto`'s three `reachX` values have to grow by the same factor,
> or he joins the others in swinging past his own box.

`flyBossSizePx` is different — `halfW()` and `bodyHeight()` derive from it, so
the boss's size in the simulation moves with its drawn size.

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

## The old-film filter — DELETED

**It is gone, and it is not coming back as a flag.** Still Life's projector post
effect — grain, brightness flicker, a vignette, gate weave, the odd scratch, a
rolling frame line — was ported on request on 2026-08-22, seen, and turned down
the same day: *"it causes a terrible feeling"*. It was then kept wired and
switched off, on request, with a note in the config saying not to delete it.

On 2026-08-27 that reversed: *"remove this film thing, this is badness from the
past"*. `src/film.js`, the `CONFIG.film*` block, the `index.html` entry and the
`game.js` wiring are all deleted. `renderFilmed()` became `renderFrame()` and
now does nothing but clear the frame under each of its six call sites.

> ⚠️ **"Film" still means something in this codebase, and it is not this.** The
> backdrop is *filmed footage* — a `video` plate the camera scrubs, and a `film`
> source kind for frame sequences. `src/backdrop.js`, `src/stage.js` and
> `SOURCES` all use the word that way. Those are core and were not touched.

> ⚠️ **A "keep it toggleable, don't delete it" instruction has a shelf life.**
> The config carried *"Do not delete any of it to tidy up"* for five days and
> then the user asked for exactly that. The note was right when written; it was
> not a veto on the next decision. Same shape as the coverage target that moved
> three times — record what is true now, not a prohibition on what comes next.

## The day passing (stage 2's colour grade)

```js
GRADE: {
  on: true,
  mode: 'multiply',
  strength: 0.70,        // <- THE knob. scales every stop's alpha
  stops: [
    { t: 0.00, color: '#ffa24a', alpha: 0.16 },   // low warm sun
    { t: 0.45, color: '#ff6a4d', alpha: 0.22 },   // late afternoon
    { t: 0.80, color: '#b0508f', alpha: 0.30 },   // dusk, pink over the sand
    { t: 1.00, color: '#6b3fa0', alpha: 0.38 },   // purple
  ],
},
// ...and per room, like `scenery` and `flies`:
{ name: 'desert', grade: true, ... }
```

One composited rectangle over the whole frame, walking orange to purple as the
player crosses the desert. `src/grade.js`.

> ⚠️ **"Except the HUD" is the draw order and nothing else.** `game.js` paints
> the layers, then the combat FX, then `grade.draw`, then the bars. No mask, no
> second canvas. Moving that one call is how anything joins or leaves the grade —
> which is also why the room fade, the dev text and the debug overlay are already
> outside it.

> ⚠️ **Driven by distance, not time.** "Purple at the end" is a promise about a
> *place*; a wall clock would turn the sky purple early for a player who lingers
> in the first fight. Trade: the sunset pauses inside a locked arena, which can't
> be seen — nothing is moving to compare it against.

> ⚠️ **High-water mark.** The desert reverses, and `camX / span` would rewind the
> evening every time the player walked back. `peak` only goes up.

> ⚠️ **The stops exist because orange to purple is not a straight line.** In one
> hop `#ffa24a` to `#6b3fa0` lerps through a dead grey-brown at the midpoint —
> they sit on opposite sides of the wheel. The stops bend the path the way a sky
> does: orange, red, pink-purple, purple. Sampled every 10% the saturation never
> drops below 0.53, so no leg crosses the grey.

> ⚠️ **`multiply`, not a plain rectangle.** Flat source-over is a sheet of
> coloured plastic: it lifts the blacks and flattens the frame. Multiply is
> coloured *light* — black stays black, midtones take the tint, and the picture
> darkens as the tint does, so dusk is dimmer than noon with no second pass.

**Tuning it: `strength`, and only `strength`.** It scales every stop's alpha, so
the *shape* of the day is preserved and only the level moves. It landed at 1.0
and was refused — *"too strong, too perceivable"* — was halved to 0.50, and
settled at **0.70**. The useful range is narrow and the answer was in the middle
of it.

| strength | reads as |
|---|---|
| 0.35 | barely there; the end stops reading as purple |
| 0.50 | the over-correction — a warm/cool shift that's easy to miss |
| **0.70** | ships |
| 1.00 | the first pass, refused |

> ⚠️ **Strength is not the transition dial.** "Too perceivable" meant the tint's
> weight. The *rate* of change comes from the room's length and the spacing of
> the stops — it is spread over 5006px of camera travel, minutes of play. If the
> change ever reads as a wipe, that is one stop jumping too far to its neighbour
> and `strength` will not fix it.

> ⚠️ **The boss room is not graded, and that is a decision to revisit.** The
> desert ends purple and cuts to an ungraded room, which reads as the lights
> coming back on. One `grade: true` plus a stops list that opens where this one
> closes is the fix if that cut looks wrong in play.

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
poses (down, death) play forward once and **hold the last frame** — holding
matters, or a death would loop and resurrect the corpse every second.

**`hurt` does not read this table at all**, and that is the exception. ⚠️ *This
paragraph used to say it cycles its two drawings through one stun, and that was
reversed on 2026-08-24:* *"for every hit we use one of these frames, they should
alternate for each hit."* Cycling meant every blow played the same 0-1-0 shudder,
so two different flinches read as one animation. It is now **one drawing per
blow, held** — picked by a counter bumped in `Fighter.hurt` and taken modulo the
row, so a re-cut sheet with three flinches alternates three. `POSE_MS.hurt` is
dead for this pose as a result.

**A pack whose knockdown row also stands up** does not use the `down` row above
at all: it is sliced by phase and each slice is spread across its own phase
(`downLandMs` / `downLieMs` / `downRiseMs`), the way the jump is spread across
its arc. **That is every ragged pack in the game** — the cigarettes, and since
2026-09-03 both coconuts.

> ⚠️ **The coconut was the odd one out, and it was a bug rather than a style.**
> He declared no phase poses, so all three phases fell back to the single `down`
> — and `stateT` restarts at every phase change, so his six-frame row played from
> frame 0 **three times** in one knockdown. Reported 2026-09-03: *"the animation
> cycles 3 times, I want it to cycle only one time."* The six drawings were put
> side by side and they are a fall **and** a stand-up, exactly like the
> cigarette's: 0–2 going over, 3 flat on his back, 4–5 back up angry. So the fix
> is three lines of data per pack (`downLand` 0–3 / `downLie` 3–4 / `downRise`
> 4–6) and no code at all. ⚠️ It also spends the time better: at 110 ms a frame
> the row was over in 660 ms and then held, where the phases are 520/620/320 — so
> the fall now takes 173 ms a frame, the flat drawing is **held** for the whole
> lie, and the stand-up runs out exactly as he gets control back. ⚠️ **What made
> this survive is that a comment explained it away**: `sheets.js` said the
> coconut's row was "six frames of falling over", which is not what the row is.

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

## Lives

`LEBRON x2` beside the health bar is real now. `CONFIG.playerLives` is 3, and the
HUD shows `lives - 1` — the tries you have left **after** this one.

| death | HUD | what happens |
|---|---|---|
| 1st | x1 | back on your feet where you fell |
| 2nd | x0 | back on your feet where you fell |
| 3rd | — | the game over panel |

The death animation plays out and holds either way; the respawn then happens by
itself. A respawn that waited for a keypress would be a second thing to dismiss
on top of the death.

`Fighter.revive()` puts him back: full health, standing, and untouchable for
`respawnInvulnMs` (1500).

> ⚠️ **The invulnerability is not optional.** He comes back exactly where he
> fell, which in this genre is usually underneath whoever killed him. Without a
> moment of safety the respawn is a free hit, then another, and the remaining
> lives evaporate without the player touching anything.

The i-frames are spent as `hurtT`, so the existing hurt **blink** comes with
them for free — safety and the signal that you are safe are the same value and
cannot disagree.

> ⚠️ **`revive()` must undo the whole death path, not just the `dead` flag.** A
> death is a knockdown that never gets up, so it leaves `state`, `downPhase`,
> `stateT`, `launch` and `jumpY` mid-fall, with the killing knockback still in
> `vx`. Clearing only the flag brings him back lying on the floor, sliding, and
> unable to act — which reads as the respawn not having happened.

Nothing else resets: the crowd, the segment and the camera are exactly where
they were. He was the only thing that stopped.

## CONTINUE?

The last life is gone, the world **stops where it is**, and the panel is painted
on top of it: two beaten coconuts on the left, `CONTINUE?` and a pixel-grid
number on the right, counting 9 down to 0.

* **press anything** → a full set of lives and back up where you fell, in the
  same fight, with the crowd and the camera exactly where you left them.
* **let it reach zero** → the grey frame (`contagem-dead`) holds a beat, the
  death sting plays and the game over panel follows.

```js
CONTINUE: {
  on: true,           // false = the last death goes straight to the panel
  seconds: 9,         // counts 9…0, one second each — ten in all
  figureMs: 380,      // the figure cycle's hold at the START of the count
  figureEndMs: 80,    // …and at the end — it ramps, so they panic as time runs out
  flapMs: 110,        // the split-flap: the DARK board, at the top of a second
  deadHoldMs: 2600,   // the grey frame, before the game over panel
  deadLightMs: 2000,  // …and the light coming up on it, smoothstepped
  deadLightFrom: 0.55,// it lands DIM and clears — that is the illumination
  deadLightTo: 1.35,
  deadPunch: -0.10,   // …and a tiny stamp on the same frame it turns grey.
                      //    NEGATIVE = away from the camera; the sign is the direction
  deadPunchMs: 400,
  deadPunchSplit: 0.5595,  // the empty column between the figures and the number
  deadPunchCX: 0.3009, deadPunchCY: 0.5282,   // the figures' own ink centre
  veilAlpha: 0.50,    // how far the fight is pushed back UNDER the panel
  fadeInMs: 250,      // the VEIL ramps up over this; the panel is solid at once
  lives: null,        // null = CONFIG.playerLives, i.e. a full set
  hRel: 0.90,         // the panel's height and centre, as fractions of canvas
  yRel: 0.52,
}
```

> ⚠️ **The grey frame is lit, not just shown.** The switch to black and white
> stays instant — that is the offer closing and it should land like a switch —
> and then the frame comes up from `deadLightFrom` to `deadLightTo` over
> `deadLightMs`. **It starts *below* 1 on purpose:** ramping 1.0 → 1.4 only
> brightens a picture you have already read, where arriving dim gives the rise
> somewhere to come from and the grey visibly clears. Past about 1.6 at the top
> the desaturated coconuts lose their outlines into the light and it reads as
> fading rather than clearing.

> ⚠️ **`deadLightMs` must fit inside `deadHoldMs`** — a ramp still climbing when
> the game over panel takes the screen is a light switched off mid-rise. That is
> why the hold went 1400 → 2600 with this change; the two move together.

> ⚠️ **The coconuts stamp as the frame turns grey** — `deadPunch: -0.10`, on
> `deadT`, the same clock as the switch and the light, so all three land on one
> frame. It shipped at 0.18 ("medium", between the menu's 0.10 and the select's
> 0.25) and that was too much: **the weight of a stamp is not a slot in a scale,
> it is what the thing being stamped can carry**, and a pair of beaten coconuts
> holding still on a grey screen carries very little. ⚠️ **The sign is the
> direction:** negative recoils them *away* from the camera and springs them back,
> positive swells them towards it — same curve, mirrored. Backwards is the right
> shape here, because the menu's stamp and the select's answer a *press* and this
> one answers a clock running out.

> ⚠️ **Only the coconuts — and this picture can be split, where the fruit select's
> could not.** `contagem-dead` is one image, but measured: the figures' ink ends at
> 0.545 of the panel width and the word and number begin at 0.575, **a 33 px column
> of nothing between them**. The select art had no such gap (one connected
> component, 385 rows of ink in its thinnest column), which is why that one needed
> a new export and this one needs two clipped passes. **The two cases look
> identical and are not; measure before repeating a refusal.**

> ⚠️ **It is a `ctx.filter` on the blit, not a white veil over it.** A white rect
> at rising alpha would wash the world behind the panel too, and take the picture
> towards flat white instead of towards a clearer grey.

> ⚠️ **The coconuts speed up across the count.** The hold runs `figureMs` →
> `figureEndMs` in a straight line over the whole offer, so they go from a slump
> to a panic and the picture says the offer is closing a beat before you have read
> the number. Measured off the real code: 383ms at the 9, 83ms at the 0.
> `figureEndMs: 380` (equal to `figureMs`) restores the old constant pace.

> ⚠️ **That ramp is an integral, not a division.** `floor(t / period)` counts
> cycles only while `period` is constant; with a shrinking period it means "how
> many of *today's* periods fit in all the time so far", which jumps around as the
> period moves and makes the figures stutter instead of accelerating. The cycles
> actually completed are `(1/b)·ln((a + b·t)/a)` for `p(t) = a + b·t` — exact, so
> it cannot drift with the frame rate either.

> ⚠️ **The number *flips*, it does not cut.** Each second opens with `blank-02`
> — the board with every cell dark — up for `flapMs`, and lands on the digit, the
> way a split-flap sign turns. The beat opens the NEW second rather than closing
> the old one, because the count changing is what causes the turn. `flapMs: 0` =
> the old hard cut.

> ⚠️ **`blank-01`, the lit board, is deliberately unused.** The first cut of the
> flip alternated the two blanks; it is brighter than any digit frame, so mid-turn
> it read as a flash interrupting the count rather than as the count turning.
> Dark board alone, and it is not in the manifest.

> ⚠️ **`fadeInMs` must never carry the panel, only the veil.** It did, and the
> first playtest caught it: a translucent coconut shows the world through itself,
> and that world has just been dimmed 30% — so the characters genuinely *were*
> darkened for a quarter of a second. **Anything drawn at less than full alpha
> above a veil takes the veil on.**

> ⚠️ **The veil is the bottom layer — it dims the WORLD, not the panel.** Drawn
> over the pictures it would take 30% off the artist's colours as well and the
> yellow would go muddy. It is painted by `Continue` rather than by `game.js` for
> exactly that reason: it has to sit *between* the fight and the panel's own
> layers, and the `drawEndCards` branch cannot get in there.

> ⚠️ **It is not the game over screen's dip.** That one takes the world all the
> way to black because it is *replacing* it. This pushes the fight back so the
> question is the foreground, and leaves it legible — it is what the player is
> deciding about.

> ⚠️ **The world behind it is the real frame, not a capture.** It is drawn from
> `drawEndCards()` — the slot the CLEAR tally and the game over veil already use,
> which exists because those cards sit *over* whatever was drawn. Nothing is
> snapshotted; the world simply stops being ticked, so the corpse holds mid-fade
> and the crowd holds where it stood.

> ⚠️ **Three layers, one rect — and the rect comes from the image SIZE, never
> from its ink.** The pictures are full-canvas overlays carrying different parts
> of one composition: the figures live in the left half of the sheet, the word
> and number in the right, the dead frame carries both. They line up because the
> artist drew them lined up. Fit any of them to its own content and they scatter.

> ⚠️ **Re-cutting them needs `--no-crop`, same as the fruit select.**
> `shrink-master.py` crops to the opaque bbox by default and each of these would
> land on its own geometry — the panel would shake as the digit changed. Cut with
> `--max-dim 1100 --no-crop`, all fifteen are 1100×799. **10.4 MB of masters
> became 2.5 MB**, and the masters were deleted on request (originals live
> outside the repo).

> ⚠️ **`batidao-continue-blank-01/02` are cut and unused.** They are the grid with
> no digit — all lit, and empty — which is what a *flash* between digits would be
> made of. Not wired, because a flash was not asked for; not in the manifest
> either, so they cost repo weight and nothing in the download.

> ⚠️ **The death sting moved, it did not double.** `playDeathSting()` used to
> fire on the last death; it now fires when the **count runs out**, so the panel
> arrives with the sound it always had and the countdown plays over the level's
> own bed. A sting on arrival would tell the player the answer before asking the
> question. There is no tick sound — that was not asked for.

---

## The hand-lettered front end

Every word the game shows outside a fight is a drawing off one sheet
(`batidao-letters-game.png` + `-sprites.json`, cut by
`tools/build-letter-pack.py`, drawn by `src/letters.js`).

| frame | where |
|---|---|
| `title` `subtitle` | the title screen, replacing the typed name and gloss |
| `menuStart` `menuOptions` `menuCredits` | COMEÇAR / OPÇÕES / SABOROSA |
| `choose` | ESCOLHA SEU COCO, over the select |
| `pickLEBRON` `pickIPANEIMA` | under the two coconuts |
| `life0…life3` | one per life, under the player's name |
| `nameLEBRON` … `nameMISTERSTOP` | under a fighter's health bar |
| `optTitle` `optVolume` `optMusic` | the OPÇÕES screen |
| `credTitle` `credNames` | the SABOROSA credits |

```js
LETTERS: {
  titleWRel: 0.72,     // THE one size knob — everything scales off the title
  menuMul: 0.90,       // the menu, trimmed under that scale
  lifeMul: 0.80,       // …and the lives
  selectedMul: 1.10,   // …and the highlighted item, 10% up on its NEIGHBOURS
  itemPop: 0.10,       // the tiny stamp on an item that is CHOSEN
  itemPopMs: 260,
  menuHoldMs: 300,     // …and the beat before the screen acts on the choice
  // …and the rest is POSITION: titleYRel, menuYRel, optRowYRel, …
}
OPTIONS: { bars: 8, volume: 8, music: 8 }   // meters, in bars
```

> ⚠️ **`titleWRel` is the only size number and it moves everything.** Each frame
> is drawn at the ratio that makes the title span that much of the canvas, so the
> artist's own hierarchy reaches the screen — title 1363px in the pack against a
> fighter name at 124. Don't add a `wRel` per element; if one thing must sit
> differently, that is a **multiplier on** that scale. There are two: `menuMul`
> 0.90 and `lifeMul` 0.80. If a third and fourth appear, the question is whether
> `titleWRel` is wrong — not whether to add another.

> ⚠️ **The meters are the row drawn short.** Each option row was lettered with
> eight bars and the cutter recorded where each ends, so a level of *n* is one
> blit `cuts[n]` wide. The row stays centred on its **whole** width as it
> shortens — otherwise turning the volume down slides VOLUME across the screen.

> ⚠️ **Fighter names are looked up by the name the fighter declares.**
> `NARUTÃO` → `nameNARUTAO` (strip accents, drop non-alphanumerics, prefix). A new
> boss gets its lettering by being drawn on the sheet under the name it already
> has — no code change. `HORÁCIO` and `MISTER STOP` are cut and waiting for
> fighters to claim them.

> ⚠️ **The lives row is the lives, not the spares.** One coconut per life,
> including the one being played, so `playerLives: 3` draws three and the last
> life draws one. The four drawings cycle; repeating one reads as a stamp.

> ⚠️ **They sit at the bar's right edge, on the name's row** — where the old `x2`
> readout was, growing leftwards into the empty middle of the plate. That means
> the row has to be **measured before it is drawn**: `textAlign = 'right'` did this
> for free with two glyphs, and a row of pictures has to sum its own width first.
> It is anchored to `box.x + box.w`, the footprint `LifeBar.render` hands back, so
> moving or resizing the bar carries the lives with it.

> ⚠️ **The menu has no timing of its own.** It slides up from under the frame
> while the name drops into it, bounces the way the name bounces, and lands on the
> same frame — all of it off `titleDropMs` / `titleDropFromRel` / `titleBouncePx`
> / `titleBounceMs`, the *name's* numbers. **Synchronised by sharing the
> expression, not by matching two sets of numbers**: it had a `menuRiseMs` set
> equal to the drop, and that looks synchronised right up until somebody retunes
> one of them. The only difference is the sign — the travel is added rather than
> subtracted and the bounce is negated, because a thing overshoots past its rest
> in the direction it was moving and these arrive from the other edge. **A slide
> that also fades reads as a fade with some drift in it**, so there is no fade;
> `menuFadeMs` still fades the options and credits screens, which arrive rather
> than move.

> ⚠️ **An item stamps when it is CHOSEN, not when the cursor reaches it.** A
> punch answers a commitment; spent on every nudge of the d-pad it cheapens itself
> and leaves the real choice with no feedback. A cursor move gets `selectedMul` —
> a state, and a state needs no animation. On the options screen "clicking" is
> setting a meter, so left/right stamps and up/down does not.

> ⚠️ **`menuHoldMs` is why the punch exists at all.** Confirming COMEÇAR moves
> the screen on, so an item stamped and dismissed in the same frame is a pop
> nobody sees. The press buys the stamp; the choice is spent 300 ms later. Same
> beat, same reason, as `SELECT.chosenHoldMs`.

> ⚠️ **The menu, options and credits are stages of `title.js`, not new files** —
> the same photograph with different words on it, which is why the select lives
> there too. Returning from a detour does not re-drop the title: the drop is timed
> off `t`, which never rewinds.

### Re-cutting the sheet

```
python3 tools/build-letter-pack.py --dry-run
```

The cutter bands the sheet by rows and then a table (`PACK`) says which bands are
two lines, which are several pieces, and which multi-line block is one thing. It
asserts what it expects to find, so a re-export that gains or loses a line fails
there rather than putting half a word on screen.

## The game over panel

Dying used to dim the fight and put a small PERDEU! over it. It now gets the
**flying dungeon's game over screen** — its three photographed frames of
crawling vermin, looping at ~9.5fps, with the word revealed over them. Same
panel, same timings; **the word is a hand-drawn picture, and there are seven of
them.**

The sequence, once the death animation has played out and held:

| | |
|---|---|
| `fadeOutMs` 900 | the fight dips to black |
| `holdMs` 350 | black, alone |
| `fadeInMs` 900 | the panel arrives |
| `title.d1` 1100 | the phrase pops |
| `armMs` 500 | then a press counts — 2850 ms in total |

**The black hold is the point.** Cross-fading straight from the belt to the
worms reads as a glitch; a moment of black reads as a cut. That's the other
game's sequencing and there was no reason to differ.

**The press is armed off the reveal**, not off a constant, so retiming the word
moves the arming with it. Without that, a key still held from the last seconds
of the run blows straight past the screen the player is meant to read.

### Seven ways of saying you lost

`VIIISH…` · `OH NÃO!` · `JÁ ERA!` · `PERDEU!` · `DETONADO` · `CAIU PRA FORA…` ·
`CAPO-TOU!` — one per game over, **sampled without replacement**, from
`batidao-gameover-words-game.png` + its `-sprites.json`, cut by
`tools/build-gameover-words.py`.

```js
title: {
  SHEET: 'v2:beatemup-dungeon/batidao-gameover-words',
  wRel: 0.80,        // the WIDEST phrase, as a fraction of canvas width
  sizePct: 20.4,     // the TYPE fallback's size — NOT the picture's
}
```

> ⚠️ **`wRel` is the pack's one scale and the widest phrase sets it.** Every
> other frame is drawn at that same px-per-source ratio, so `VIIISH…` lands about
> half the width of `CAIU PRA FORA…` — which is how they were drawn. Fitting each
> phrase to `wRel` in turn would flatten the one difference the sheet is making.
> Standing rule for a pack here.

> ⚠️ **`sizePct` does not size the picture.** It is the font size, so it now
> only moves the fallback — the trap being that it looks like the knob.

> ⚠️ **It is a shuffle bag, not a fresh `random()` each time.** The seven are
> shuffled into a deck and drawn one at a time; the deck refills only when it is
> empty, so all seven are seen before any repeats. Independent draws are
> memoryless, and memoryless is not what a player reads as random — an immediate
> repeat would land one death in seven, and seeing PERDEU! twice running reads as
> the feature being broken. ⚠️ **The seam is the part that is easy to miss:** a
> bag can end on the phrase the next one starts with, so a refill that opens on
> the last-shown phrase is nudged. Verified over 200,000 draws: zero back-to-back
> repeats, every cycle of seven complete, counts even to one part in 28,571.
> The bag is per-session; a reload starts a fresh deck.

> ⚠️ **The pick is made when the phase opens, not in `draw`.** The panel is
> otherwise stateless and derives everything from `t`; a choice derived from `t`
> is re-made every frame, which is seven words flickering rather than one.
> `gameOver.roll()`, called from both places `game.js` enters `gameover`.

> ⚠️ **`CAPO-TOU!` is one frame, drawn on two lines.** The cutter bands the sheet
> by rows and then **merges** that pair — it is a hyphenated phrase, not two
> words. `MERGE` in the tool, and it asserts the final count, so a re-export that
> gains or loses a line fails there rather than putting half a word on screen.

> **The fallback word comes from `RESULTS.LABELS.lost`** — reached only if the
> sheet fails to load, in which case the panel sets PERDEU! in Futura exactly as
> it did before. A missing picture costs the lettering's look, not the screen.

The three frames are read **in place** out of `assets-v2/flying-dungeon/`, like
the health bar and the gamepad map. They are the same files this game's title
screen used to crawl on before that became a photograph.

**A press goes back to the title.** It used to restart play immediately, on the
arcade rule that a death is a retry — but ⚠️ *this panel is not a death*. The
retry already happened twice: a life is spent and the fight resumes where it
fell, and only the **third** death reaches this screen. By then the run is over
in the same sense the CLEAR board's is, so it ends where a run ends. Changed on
request, 2026-08-22.

### And it plays STILL LIFE's death music

The panel arrives on that game's `game-over.ogg`, read **in place** out of its
folder like the three frames above it, and played the way it plays it.

| knob | what it does |
|---|---|
| `GAME_OVER_STING.on` | `false` for silence |
| `.rate` | 0.9 — 10% slow. ⚠️ It **resamples**, so the pitch drops with it (~1.8 semitones). A tape-speed change, not a tempo change |
| `.doubleDelayMs` | 50 — a second voice off the same buffer, that far behind. ⚠️ In the **clip's** time, so game.js divides it by `rate` before scheduling |
| `.musicFadeSec` | 0.35 — the level's bed getting out of the way |
| `SFX_GAIN.gameOver` | 0.67 — ⚠️ not taste: Still Life plays it at 1.0 on a 0.6 bus, and 0.9 × 0.67 is that same 0.6. Re-derive it if `sfxVolume` ever moves |

**It fires when the panel is armed, not when the body hits the floor** — the
death animation and its hold run first. That is where Still Life fires its own
too. And **the bed stops for it**: this is music replacing music, not an effect
layered over one, which is the opposite of the CLEAR board, where the game
carries on.

50 ms is right on the **edge of fusion** — the ear stops hearing two attacks at
around 40 ms, so the double is nearly one thickened sound with a hard edge
rather than two. Below ~40 it fuses completely and starts colouring the tone
instead. Small changes there are not subtle.

## The ending screen

Beating HIPÓLITO now walks LEBRON out of the boss room to the right — the same
walk-out every other room gets — and then a photograph fades up, he walks in
from the left, stops in front of the rock and throws his arms up. 1.5 s after
the pose lands, the tally comes up over it.

`src/ending.js`, a sibling of `title.js`. Knobs in `CONFIG.ENDING`:

| knob | what it does |
|---|---|
| `BG` | the plate. Drawn **cover**, loaded `big`, reduced by `shrink-master.py` |
| `fadeInMs` | the plate coming up out of the outro's black |
| `startXRel` / `stopXRel` | he enters off-screen left and stops at **0.5**, dead centre |
| `walkSpeed` | px/s |
| `groundYRel` | 0.93 — his feet, on the near dirt **in front of** the rock. ⚠️ Deliberately *not* derived from the belt the way the title's is: this is a different photograph with its own ground in it, so the number answers to the picture |
| `scale` | **1.0 — exactly his size in the fight.** It was 1.55 and read as a different character. To fill more of the frame, crop the plate, not the actor |
| `poseHoldMs` | 1500, counted **from the pose landing**, not from the start of the screen |

**The victory frame is atlas frame 10** of `coconut-beat-game.png` — row 1,
column 3 counting from zero — reached through `CHARACTERS.coconut.poses.victory`
as slot 2 of the `jump` row, which is simply where the packer put that drawing.

> ⚠️ **It is addressed by atlas position, not by meaning.** Re-running
> `build-beat-coconut-defs.py` repacks the atlas; if the dedupe folds that frame
> differently the slot moves and the ending shows the wrong drawing. Verify
> against the atlas, not against the pose name.

**After the tally, a press goes back to the title screen** (`toTitle()`), which
resets the run and replays the title from the top. **Dying now does the same** —
it used to restart play immediately on the "a death is a retry" rule, but the
retry already happened twice and only the third death reaches that panel. See
*The game over panel*.

**The last fight used to hand straight to the tally.** `game.js` carried a note
saying walking him off the edge there would be "walking him out of the level
into nothing" — true until there was somewhere to arrive. The outro now carries
`outroTo` so it knows whether it is a door or an ending, and `endingShown` keeps
the photograph behind the tally instead of the boss room he already left.

## Boss nameplates

The boss's name sits under its health bar — **NARUTÃO**, **HIPÓLITO** — centred
under a centred bar, drawn by `Hud.drawBoss` along with the bar itself.

```js
bossNameSizeRel: 0.62,  // x hudSize (26) -> ~16px
bossNameGap: 4,         // px below the bar
```

**The name is asked of the boss, not worked out from its `kind` in the HUD.**
Each constructor sets `this.name`, from wherever that boss's name lives:

| boss | name from | why |
|---|---|---|
| HIPÓLITO | `CONFIG.CHARACTERS.horse.name` | he is a proper ragged pack |
| NARUTÃO | `CONFIG.MOSCA_NAME` | two raw flapping sheets, no pack entry |

So **a third boss declares a name and nothing in the HUD changes.**

> ⚠️ **Whether the bar is up at all is decided in `game.js`, not here** — it is
> gated on the boss having arrived and being neither dead nor fleeing. That is a
> fact about the fight, not about the drawing.

---

## The CLEAR board

Clearing the last room no longer writes CLEAR and stops — it counts the run up,
a row at a time. `src/stats.js` gathers the figures, `Hud.drawResults` draws
them, and every knob is in `CONFIG.RESULTS`.

```js
RESULTS: {
  rowMs: 1000,         // how long one number takes to roll up
  rowStaggerMs: 500,   // gap between rows starting
  rankDelayMs: 400,    // beat between the last row FINISHING and the stamp
  rankMs: 420,
  rankWeights: [0.40, 0.40, 0.20],   // accuracy, health kept, pace
  rankDamageBudget: 220,             // damage taken for a 0 on that third
  rankParS: 150,                     // a comfortable clear, in seconds
  rankTiers: [['S',0.90], ['A',0.75], ['B',0.55], ['C',0]],
}
```

### It is all in Portuguese

**Nothing on this board is in English**, by request. The labels are slang rather
than translations — a literal translation of a scoreboard still reads like a
scoreboard. They live in `CONFIG.RESULTS.LABELS`, so changing a word is one
line.

| row | label | what it counts |
|---|---|---|
| hits landed | **PORRADAS** | connected / swung |
| accuracy | **SAGACIDADE** | % |
| hits taken | **VACILOS** | times you got hit |
| damage dealt | **ESTRAGO** | |
| damage taken | **PREJUÍZO** | |
| time | **TEMPO** | |
| enemies downed | **RANGO** | the count. ⚠️ the by-name breakdown under it was removed 2026-08-27 |
| the stamp | **NOTA** | the letter |

The card reads **OBRIGADO POR JOGAR** with **THANK YOU** under it, and the
prompt is *pressione qualquer botão*. Losing shows **PERDEU!**

> ⚠️ **Putting the roll-call back is one field.** `Stats.rows()` used to hang
> `note: this.downedBy()` on the RANGO row, which printed "DUDU x7   DIDI x5"
> under it. Nothing was deleted when it came off — `downedBy()` and the `note`
> mechanism in `hud.js` are both intact, and the board's clock is unchanged
> (`_resultsTimes` counts rows, and a note was never one).

> ⚠️ **THANK YOU is English on purpose** — the end card was asked for as
> "obrigado por jogar THANK YOU", both languages, the same pairing the flying
> dungeon's finale uses. It is not an oversight.

> ⚠️ **Which word landed on which row is partly a judgement call.** The request
> gave "rango, sagacidade, vacilos, comédia etc" as the flavour, not a mapping.
> PORRADAS / SAGACIDADE / VACILOS place themselves; ESTRAGO, PREJUÍZO, TEMPO and
> NOTA are in the same register; RANGO went on the body count because this is a
> game about food. **COMÉDIA is unused** — it wants to be the bottom rank tier
> rather than a row label, and that is a change to how ranks draw, not a string.


**Where the time goes.** The count-up is **4.0s** end to end — rows start 0.5s
apart and each number rolls for 1.0s, so the last row starts at 3.0s and lands
on 4.0s. On the board's own clock (which starts 0.45s after CLEAR appears, so
the black is down first):

| | board clock | from CLEAR |
|---|---|---|
| last number finishes | 4.00s | 4.45s |
| rank stamp lands | 4.82s | 5.27s |
| "press anything" | 5.17s | 5.62s |

**To retime, solve for the finish:** the last row starts at `(rows - 1)` staggers
in and then takes `rowMs`, so with seven rows it is `6 x stagger + rowMs`. A
stagger raised on its own moves the finish by six times what it looks like.

**The split between them is the feel, not just the total.** A long stagger and a
short roll gives each row its own beat; a short stagger and a long roll has every
number climbing at once, which reads as noise. You can skip from 1.2s onward
regardless.

**A press part-way through SKIPS to the finished board; it does not dismiss it.**
The next press restarts. A player must never lose their figures by being early.

**The rank judges three things at once** because any one alone is farmable:
accuracy alone rewards poking at one enemy from safety, damage taken alone
rewards running away, time alone rewards skipping the fights. Both budgets are
deliberately generous, so C still reads as having finished the level.

**Adding a row** is one entry in `Stats.rows()` — `value` is the number the
count-up rolls to and `text(n)` formats it, so the animation never learns about
percent signs or clocks. A row with no `value` is not rolled. **Move `rankY`
down when you add one**: the layout is written out, not computed from the row
count, and the first numbers tried put the breakdown line under the word RANK.

**Accuracy counts a swing when its hitbox goes LIVE**, not when the button is
pressed — a punch the player was knocked out of during its start-up was never
thrown, and charging them for it would make accuracy a measure of how often they
were interrupted. In `combat.playerHits`, that is the order of two lines.

**In dev mode the damage figures are inflated** (every punch does 50) and the
board says so on itself. Hit counts, accuracy and time are unaffected.

---

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

#### The step into the finisher — `lungePx`

Since 2026-08-24 both finishers move the body **forward** across the blow, so
the punch reads as thrown from the legs rather than mimed from the shoulders.

| pose | `lungePx` | drawn |
|---|---|---|
| `combo5` (uppercut) | `30 * BODY_SCALE` | 22 px — it plants and rises |
| `comboLow5` (low lunge) | `50 * BODY_SCALE` | 36 px — it is a lunging punch |

Raised from 18/30 on sight. Over the 220 ms the step spans, 50 averages
164 px/s and **peaks near 490** as the ease-out opens, against a walk of 300 —
the low ending briefly outruns a run, which is what a lunge is. That peak is the
number to watch if it goes further: past roughly double, the step stops reading
as weight and starts reading as a dash.

- **It is a field on any attack def**, not something the Player owns, so an
  enemy string can have one by adding it. None do yet, deliberately — an enemy
  that steps in reaches further than the player has learned it reaches.
- **The timing is derived, not configured.** The step runs from `startupMs` for
  `activeMs + recoverMs / 2`, eased out: it lands with the fist and settles
  through the first half of the follow-through. Retune a pose and the step
  follows. `Fighter._updateLunge()`.
- **It is a displacement, not `vx`.** `vx` is the knockback channel — a step
  pushed through it would be eaten by `knockbackDecay` and would fight a
  knockback arriving mid-swing.
- **Hitstop handles itself.** A connect freezes the simulation, so the step
  holds at the moment of impact and completes afterwards.

#### Taking food — the punch button, not the pickup one

**Walking over a drumstick does nothing** (changed 2026-08-24). Stand on it and
press **punch**: he stoops with `pickGround` — row 9, the same drawing the
pickup button uses for a light object — and the heal lands when the stoop ends.

| | |
|---|---|
| button | **punch** (J / Z / Space). ⚠️ The pickup button is now **inert** — see `pickupButton` |
| animation | `pickGround`, over `PICKUP_MS.ground` (420 ms) |
| reach | `PROPS.food.rangeX/rangeZ/rangeY` — unchanged numbers, they now mean *close enough to reach down for* |
| at full health | **still taken, and worth nothing** — the heal is capped. Deliberate: the button stays predictable |
| in mid-air | `pickup()` refuses, so the press falls through to the **air attack** |
| interrupted | the food puts itself back on the floor, untouched |

> ⚠️ **A player standing on food cannot punch.** That is the cost of a third
> verb on that button, and it is accepted rather than solved — making it
> conditional on no enemy being nearby would be a button that silently does a
> different thing depending on something the player cannot see. The level places
> food *between* fights, so the case is rare by design. **Put food inside an
> arena and this is what will go wrong.**

The food owns the reach: `Pickup.claim(by, ms)` takes the animation's own clock
and applies the heal itself, and **aborts if the hand reaching for it is knocked
over** — the same test `Prop._liftArc` makes. `Player.eatTarget` is only a
reference to drop.

#### How a death is thrown — `CONFIG.DEATH_THROW`

`{ up: 190 * BODY_SCALE * 0.9, back: 440 }` — both **floors** on the fatal blow, not replacements. **`up` is LEBRON's own drawn height** (123 px = `fighterSizePx` × his `drawScale`) and the arc peaks at exactly this number, so he is thrown his own height and no further. It was a bare 140, which put him 14% over his own head. `back / knockbackDecay` is the total travel, so 440 is **73 px**; read those two numbers together before moving either. Tuned in play: 300 (50 px) was invisible, 520 (87 px) was too hard.
A finisher that already lifts 137 and shoves 320 is unchanged; a jab worth 45
still puts a body on the floor rather than tipping it over on the spot. Applied
in `Fighter.hurt()`, so it is one rule for everyone who dies.

> ⚠️ **The player's corpse used to not move at all.** The world stops when he
> dies and `tickDeath()` ticked only the *drawing* — `stateT`, the knockdown arc
> and the knockback drift were all frozen, so the death row played out over a
> body standing where it was hit. Enemies looked right because they die in a
> world that is still running. Fixed 2026-08-24; `tickDeath(dt, bounds)` now
> moves the body, and **needs the bounds** or a death near a locked arena's edge
> slides the corpse through the wall.

> ⚠️ **An arena eats the launch.** `Stage.bounds()` pens the player to one
> screen while the camera is locked, and dying with your back to that wall is
> common — the corpse cannot be thrown through it. Nothing is broken when that
> happens; it is the same wall that stops him walking there. **There is no
> lives-dependent path** — `tickDeath` is called once, `phase = 'dead'` is set
> once, and nothing in the death code reads `lives`. Every death runs the same
> code.

#### The air attack — `CONFIG.AIR_ATTACK`

**Punching while jumping is its own move.** It sweeps, it knocks down and it
launches — the finisher's crowd-clear off one press. Until 2026-08-24 a
jump-punch just played the next link of the ground combo in mid-air: one target,
no knockdown, drawn with a standing punch.

It wires **art that had been cut and unused since 2026-08-17** — the coconut's
row 4, a 7-frame air punch drawn as a whole jump. `frameStep` already marries an
`airPunch` pose to `jumpT` rather than to the attack phases, so the drawing
follows the arc. Nothing in the animation machine changed.

| knob | value | note |
|---|---|---|
| `damage` | 8 | ⚠️ deliberately under the finisher's 12 — see below |
| `reachY` | **120** | ⚠️ the whole reason it connects — see below |
| `lift` / `knockdown` | `190 * BODY_SCALE` / true | the launch |
| `sweep` | true | everyone in the box |
| timings | 80 / 420 / 190 | the **hitbox**, not the drawing |

> ⚠️ **`reachY` is not generosity.** `verticalReach` is 70 and the jump apex is
> 85, so a fighter at the top of his own arc **cannot reach the floor**. That is
> deliberate for the enemy jump-in, which is scripted and opens its window as it
> drops back through the band. The player presses whenever they like, so the
> same rule would make the move pass cleanly through a standing enemy about half
> the time — which reads as broken hit detection, not as a miss.

> ⚠️ **It is a positioning move, not a damage race.** It buys the room; it does
> not win the fight. If it becomes the only thing worth doing, `damage` is the
> reason and it should come down before the launch does. The cost is
> commitment: 620 ms of jump with only the direction latched at take-off, the
> ground string broken, and 190 ms of recovery after landing. One per jump falls
> out of the timings (690 ms total > 620 ms of jump) rather than being enforced.

> ⚠️ **A launched enemy can be caught again.** At the apex, 120 reaches a body
> up to 205 off the floor, above the 137 this launches to. Juggling costs a
> landing and a fresh jump (~800 ms), so it is not an infinite — if it turns out
> to be one, lower `reachY` rather than removing the launch.

**Vertical reach now rides on the hitbox**, not on a `CONFIG` read: `reachY` is
returned by `Fighter._attackGeom()` alongside `x0/x1/z0/z1`, so the resolver and
both debug sites read one number. A def with no `reachY` gets
`CONFIG.verticalReach` and nothing changes. Hold **C** and the condition readout
prints the live blow's own `reachY` and `SWEEP`.

#### The finisher sweeps the box — `sweep`

`sweep: true` on an attack def hits **every** valid target in the hitbox instead
of only the nearest. Both finishers have it; nothing else does.

Every other link hits one person — the genre's default, and what stops mashing
from clearing a room. The ending is the move that buys space back when three of
them have walked up; it already knocks down and launches for exactly that
reason, and hitting one of the three was the half that never worked.

- **Each body takes the full damage**, not a share. Splitting would make the
  finisher *worse* the better it connected.
- **Still one sweep per swing** — `hasHit` closes the box afterwards, or the
  finisher would re-hit everyone every frame of its 100 ms window.
- **The freeze does not stack.** `_impact` takes the longest pending hitstop
  rather than summing, so three bodies is one held moment.
- **The sound fires once.** Three copies of one sample in a frame is a flanged
  punch, not three punches.
- **One impact mark per body**, which is the point of the move being visible.
- **A sweep takes barrels and enemies together**, where a normal punch spends
  itself on whichever was in the way.
- **Accuracy counts swings, not bodies.** `Stats.hit()` takes the attack object
  and dedupes on it, or one punch catching three would score 300%.

> ⚠️ **A finisher into a crowd of three is 36 damage instead of 12, and the HP
> table was not moved for it.** The fight gets easier when the player is
> surrounded — that is the point — but it is a real change to the economy and
> the first thing to look at if crowds stop being frightening.

> ⚠️ **It adds a little reach to the finisher, and that is not free.**
> `hitbox()` is rebuilt from the body's x every frame, so ground covered while
> the active window is open is ground the punch can now connect from. The step
> starts on the **strike** frame precisely so the first active frame tests from
> exactly where it always did — the gain is at the *end* of the window. **The HP
> table was not moved for this.** If the fight starts feeling easier, that is
> what did it; to make it exactly neutral, subtract `lungePx` from that pose's
> `reachX` rather than removing the step.

---

## Level 3 — the bookcase (the room with its own logic)

> ⚠️ **`Level3.enterRoom(room, player, stage)` needs the stage, and the third
> argument is not optional.** It places the camera as well as the player.
> `Stage.enterRoom` sets `camX = 0`, which is right for every other room and
> wrong for this one — its first band's camera starts at **220**. Drop the
> argument and you get the bug from 2026-08-31 back: the player stands in view
> for the whole fade-in and then jumps off the left edge to walk in again, because
> `phase === 'fade'` ticks nothing and cannot correct it.

```js
// CONFIG.ROOMS[2]
{ name: 'level-3', plate: 'level3Plate', level3: true, music: false,
  belt: { topY: 470, depth: 210 }, endX: 24500,
  segments: [ { kind: 'scroll', toX: 24000 } ] }   // a formality; unread

// CONFIG.LEVEL3 — read by src/level3.js and by nothing else
{ on: true, plateSource: 'level3Plate', bandGapPx: 4000,
  startInsetPx: 200, landingInsetPx: 300,   // <- bounded by the camera, see below
  legs: [                                     // MEASURED, not designed
    { kind: 'walk', dir: +1, px: 3647, film: [ 0.00, 18.98] },   // shelf 1
    { kind: 'lift',          sec: 13.67, film: [18.98, 32.65] }, // rise
    { kind: 'walk', dir: -1, px: 5515, film: [32.68, 46.96] },   // shelf 2, LEFT
    { kind: 'lift',          sec:  8.21, film: [46.99, 55.20] }, // rise
    { kind: 'walk', dir: +1, px: 3390, film: [55.23, 73.97] },   // shelf 3
  ],
  platform: { widthPx: 620, backRatio: 0.62, depthRel: 0.42, zRel: 0.72, ... } }
```

A switchback climb of a filmed comic-book bookcase: walk right along shelf 1,
ride up, **walk left** along shelf 2, ride up, walk right along shelf 3.

> ⚠️ **This is the one room that runs its own logic, and the isolation is a
> requirement rather than a style.** Asked for in those terms — *"Trying to make
> this logic work alongside the other logic (the default one) will be our
> demise."* Level 3 does not generalise the stage, the camera or the backdrop; it
> **replaces** them for itself. **Six hooks, every one a single guarded early
> return** — `stage.reset/enterRoom/update/bounds` plus two lines in `game.js`'s
> draw loop. `CONFIG.LEVEL3.on = false` is the switch if this is ever suspected
> of anything.

**Why it needs its own logic.** The plate is wound by one ratio,
`filmTime = camX / worldPxPerSecond`, and a switchback breaks it twice:

1. on shelf 2 the player walks **left**, so `camX` falls — which under that ratio
   means *rewind*, back down the lift onto shelf 1; and
2. **it is not a sign flip** — a switchback visits the *same* `camX` three times
   at three different heights, so no function of `camX` alone can say which frame
   to show.

So the two ideas come apart: **progress** (monotonic, in film seconds, drives the
plate) and **camera x** (right, then left, then right).

> ⚠️ **`backdrop.js` was not touched at all**, and that is the trick worth
> stealing. `game.js` hands it `Level3.filmScroll()` in place of `camX`, and that
> multiplies by the very `worldPxPerSecond` `_drawVideo` is about to divide out.
> The round trip looks silly and is the point — the backdrop never learns a room
> with its own clock exists. **When isolation is the requirement, find the seam
> where shared code takes a NUMBER, not the one where it takes a decision.**

> ⚠️ **`px` is CAMERA travel, and it is the sync.** A leg's camera runs exactly
> the leg's own pan, so the background moves 1:1 with the feet. The three shelves
> pan at **192 / 386 / 181** screen px per second of film — shelf 2 twice as fast
> as the others — so one ratio could never have covered this room even if it went
> one way.

> ⚠️ **Each walk leg owns a non-overlapping band of world x**, and the player is
> teleported between them mid-lift. Invisible: the plate is drawn stationary and
> wound by progress, so nothing on screen is a function of world x. Letting shelf
> 2 walk back over shelf 1's x would make world x ambiguous for anything placed
> here later.

> ⚠️ **`bounds()` must read `Level3._camX`, never `stage.camX`.** `stage.bounds()`
> is called *before* `stage.update()` (game.js:870 vs 890), so anything read off
> the stage is one frame stale — and the bands are 4000px apart, so stale is not
> "slightly wrong", it is a different shelf. **Level3 is the source of truth for
> its own camera; the stage is the mirror.** Two of the three bugs in this room's
> first build were this.

> ⚠️ **The lift's walls are in SCREEN space and must be put back into world
> space.** The platform holds a fixed screen position while the film climbs past
> it — that *is* the illusion — so returning its rect raw as world bounds threw
> the player to screen x −3010 and the lift rode up without him.

> ⚠️ **Out of legs returns `'room'`, not `'clear'`.** `game.js` reads it with the
> same switch as the shared stage: `'room'` is a door, **`'clear'` is the end of
> the whole game**. It asks `hasNextRoom()` rather than hard-coding either, so
> re-ordering rooms cannot turn the credits on mid-game.

**The lifts.** The film pans up while the player holds his screen position — the
world scrolls down past a man standing still, and that is the whole illusion. He
is never given a `y`; his feet stay on the belt, so nothing in `combat.js` or
`fighter.js` has to know a lift exists. Input is **not** disabled (a rider who
cannot turn round reads as a hang); the walls simply close to the platform.

**A lift is a WORLD object standing at the end of its shelf**, and stepping onto
it is what ends the walk leg — there is no "walked into the boundary" event. It
comes into view on its own as the camera nears the end (~4s of approach on shelf
1, ~3.4s on shelf 2) and is boarded with no movement at all on the hand-over
frame.

> ⚠️ **It used to be drawn at a fixed SCREEN position, and that one choice caused
> both halves of what was reported** — *"it just appears out of nowhere"* and
> *"the player only goes up after he touches the border, he kinda gets pushed to
> the middle"*. A thing pinned to the screen cannot be walked up to, so it had to
> be conjured when the far wall was hit and the player dragged aboard (a 0.35s
> `boardSec` ease, now deleted). **Give it a world x and both symptoms go at
> once.** It still ends up motionless on screen during the ride — but for a
> reason now rather than by construction: the camera is already pinned.

> ⚠️ **`landingInsetPx` is bounded above by the camera, at about 367.** The film
> must *finish* the shelf before the lift takes over, so the camera has to be
> pinned at the end of its range when the player reaches the landing. It pins at
> `focus + deadzone` (667.6px) past its end walking right and `focus - deadzone`
> (407.6px) walking left, so the landing must sit at screen x ≥ 667.6 rightward
> and ≤ 407.6 leftward. Measured from the end wall, **300 gives screen 940
> rightward and 340 leftward** — mirror images. Past ~367 the leftward landing
> falls inside the pin point and the shot jumps ~0.7s (~270px of pan) at the
> hand-over.

> ⚠️ **Which is why the lift is NOT in the middle of the frame, though that is
> what was asked for.** 640 is inside the pin point in *both* directions: with a
> deadzone follow the player is never at screen centre while the camera is still
> — he is at 667.6 or 407.6 and nowhere between. Measured: film gaps at the two
> hand-overs are **0.00s and 0.03s**, i.e. the shelf completes exactly.

> ⚠️ **`sec` is the film's own duration and should stay that way.** 13.7s is a
> long time to stand there — the answer is enemies riding up with you, **not a
> faster lift**. A filmed plate cannot fast-forward convincingly.

**The platform is drawn, not a sprite** — a placeholder for elevators that do not
exist yet. A trapezoid on the belt's own perspective (narrower at the back, the
same cue every shadow uses), a front face for thickness, grating that runs
back-to-front so it converges with the slab, and **rails on the back corners
only** — a rail at the front would stand between the camera and the fighter.

**No enemies yet, deliberately** — the switchback and the lifts are the parts
that could be wrong, and a fight on top would make that harder to see.

**Re-measuring the legs:** `python3 tools/build-level-3-plate.py --measure <master>`
prints the table without re-encoding. It phase-correlates on **both** axes
(the other plate tools only ever needed x) and segments on *which axis is moving*
rather than a hard-coded frame list, so re-cutting the clip re-derives the legs
instead of silently desyncing them.

**The video: 15.26 MB → 5.04 MB (3.0x)**, same 848x478, same duration, GOP 12.

> ⚠️ **This master was not a master** — it arrived already at 848x478 h264 at
> 1.47 Mbps, so the desert's two big levers were spent before we started. What
> was left was **a 256 kbps AAC track on a silent backdrop (2.4 MB, 15% of the
> file, nothing ever plays it)** and the CRF ladder: 8.24 / 6.40 / **5.04** /
> 4.01 / 3.23 MB at CRF 26/28/30/32/34, measured at the 1280x720 the player sees.

> ⚠️ **Those SSIM figures are not comparable to the desert tool's** — they score a
> second encode against a first, not against clean footage. And **do not rescale
> it**: "resolution is the wrong knob" applies harder with no oversampling left.

---

## The worms on the bookcase's wall (level 3)

```js
VERMES: {
  on: true,
  sheet: 'v2:beatemup-dungeon/vermes-fundo',
  track: 'v2:beatemup-dungeon/level-3-wall-track.json',
  perLeg: 26,                        // patches per WALK leg — see below
  bands: 3, bandScale: [0.90, 1.15, 1.45],
  yFrom: 0.12, yTo: 0.50,            // fractions of the belt's top y (470)
  jitterXRel: 0.8, denseShare: 0.5, boilMs: 200,
},
```

Two hand-drawn sheets, each with two boil frames, cut into **nine knots** by
`tools/build-beat-vermes-defs.py`. `src/vermes.js` is the whole implementation —
a separate file, not a mode of `scenery.js`, because level 3's standing rule is
that it *replaces* shared systems for itself and touches nothing else.

### Why it needed a measured track

> ⚠️ **`x - camX` does not work here, and that is the whole problem.** The
> desert's plate *scrolls* — it is an image drawn at an offset, so a mound at
> parallax 1.0 is welded to the sand for free. **Level 3's plate is a video that
> fills the frame** and the pan lives inside the footage, so the plate never
> moves on screen and there is no camera offset meaning "where the wall has got
> to". A worm at a fixed screen position is painted on the **lens**.

So it was measured. `tools/build-level-3-plate.py --track` phase-correlates the
shot it already correlates for the legs and writes `level-3-wall-track.json`:
the wall's own horizontal travel in canvas px, **one sample per film frame**.
`vermes.js` samples it at `Level3.progress`.

> ⚠️ **A rate per leg is not enough, which is why this is a track.** The shot was
> panned by hand — fitting a constant speed to each horizontal leg leaves up to
> **12 % of that leg** unaccounted for, about **580 canvas px** of slide on art
> whose entire job is to look stuck down. Three numbers would have looked right
> in the config and wrong on the screen.

> ⚠️ **Sampled, not interpolated.** The track is one value per film frame and the
> film is the thing being drawn, so the sample the plate is showing is the sample
> the worms want.

### Nothing during a lift

*"for now don't add worms to the background of the elevator parts, just when
movement is horizontal, lets keep that for later."* The layout is per **walk**
leg and `draw()` returns early on a rise.

> ⚠️ **That leaves a pop at each leg boundary** — a known, accepted edge. Done
> properly they would ride the wall *down* out of frame as the film pans up, and
> the vertical track is already measured and sitting in the same tool. Fading
> them would be inventing a look nobody asked for.

### Per leg, not per room

> ⚠️ **Wall x is not monotonic**: the shot goes +3647, back −5515, then +3396, so
> leg 2 walks back across wall x that leg 0 already used — at a different height,
> in front of different books. One shared wall space would put the same knot on
> two different shelves. That is the switchback ambiguity `Level3.progress`
> exists to avoid, in a second costume.

### Layers without parallax

Asked for in those words. `bands` still splits the field into planes, and they
differ in **scale and draw order** (near over far) — but **every band reads the
track at the same rate**, because a band that scrolled slower would come unstuck
from the wall, which is the one thing this feature is for. The desert's mounds do
the opposite deliberately; see *The ground cover*.

### Cutting them

```
python3 tools/build-beat-vermes-defs.py
```

> ⚠️ **Cut on COLUMN gaps — the cigarette cutter cuts on ROW bands.** Same idea,
> different axis, and the axis is a property of the sheet rather than a choice:
> the mound sheets stack two drifts vertically, so a row band is one mound. These
> sheets **do not band by row at all** (measured — `A` is one unbroken band at
> every gap from 20 to 140) because the worms run right across the width. They
> separate by column: 4 knots off the dense sheet, 5 off the sparse one.

> ⚠️ **The runs are found on the UNION of the two boil frames.** Worms at a
> knot's edge wander between frames, so runs found on frame 01 alone would put a
> slightly different cut on frame 02 and the two halves of one piece would stop
> being the same object. One run list, both frames, one rect each — which is also
> what stops a patch **jumping** every time it boils.

> ⚠️ **One piece is not always a knot.** The sparse sheet also yields a 91×109
> speck; `MIN_W` drops it and the tool asserts the final count (9), so a sheet
> that gains or loses a knot fails at build time rather than shipping a smudge as
> level art. Same problem and same answer as the cigarettes' stray 143×906 mark.

> ⚠️ **`yTo` stops at 0.50 and that is measured, not chosen.** The books occupy
> only the top of the frame — the shelf's own plank starts around y 250, the belt
> line is at 470 — so a knot centred past about half the belt's height lands on
> bare wood. At 0.78 it read exactly like that: worms on the floor. And `yFrom` is
> not 0 because **the anchor is the centre**, so a knot centred at y 20 spends
> most of itself off the top of the screen.

> ⚠️ **The atlas is tall and thin** (119×2474 at `SCALE` 0.115) and the *height*
> is what would hit a texture limit. Well inside `bigTextureCap` (3200) today;
> past `SCALE` ≈ 0.148 it would not be. Go to a grid rather than shrinking the
> art.

---

## The ground cover (the desert's cigarette floor)

```js
SCENERY: {
  on: true,
  sheet: 'v2:beatemup-dungeon/cigarros-fundo',
  rows: 10,         // rows of drifts across the belt's depth <- the coverage dial
  bands: 5,         // how many PLANES the rows are cut into. Keep rows a
                    // multiple of it (10/5 = 2 rows each; 9/5 would be 2/2/2/2/1
                    // and the near plane -- the one you walk through -- is thin)
  spacing: 1.25,    // x step as a fraction of each mound's width; >1 = a gap
  zJitter: 60,
  zFrom: 0.12,      // where the rows run, as fractions of the depth,
  zTo: 1.10,        // INCLUSIVE at both ends -- and zTo is past 1 on purpose
  marginPx: 1000,   // must clear the widest mound (995px)
  // The three per-band blocks are LISTS, far -> near, and each is read as a
  // CURVE sampled at `bands` points -- so a list shorter than `bands` is legal
  // and gets interpolated, and changing `bands` never leaves a knob unread.
  parallax: {
    on: true,
    rates: [0.75, 0.81, 0.87, 0.94, 1.00],  // last entry PINNED at 1.00
  },
  bandScale:   [1.00, 1.025, 1.05, 1.075, 1.10],  // endpoints are the tuned ones
  bandOffsetZ: [0.20, 0.20, 0.20, 0.20, 0.20],    // fractions of the belt's DEPTH
  // THE SIXTH LAYER — in the dead area, not on the belt. See below.
  backLayer: { on: true, rows: 2, zFrom: -0.05, zTo: 0.15,
               parallax: 0.70, scale: 1.00, spacing: 1.25 },
},
// ...and per room, like `flies`:
{ name: 'desert', scenery: true, ... }
```

Six drifts of cigarette butts scattered over the belt. **They are drawn behind
every fighter and collide with nothing** — "behave as the ground" is a drawing
rule, not a physics one, so the belt is exactly as walkable as it was.

Re-cut them with `python3 tools/build-beat-fundo-defs.py`.

**The target is 90%, and it has moved three times** — "cover like 80%" → "its not
80%, its actually 60%" → "lets bring that up to 80% back" → "fill it 100% … to
the brim", softened in the same breath to "if 100% is unreasonable, try 90%".
Each was a *new target*, not a complaint about the last one. It is a look, not a
spec, and it is the user's look: don't defend the number that happens to be here
— re-measure and move it. What ships is **90.1%**, held there deliberately across
the move to five planes (`rows` 9 → 10 would have taken it to 91.7%; `spacing`
1.20 → 1.25 gives the point and a half back).

**100% was measured and declined on cost**, and the user made that call by
offering 90 as the fallback. It is reachable — the art is porous, so a solid mat
is just a question of stacking enough porous layers — but the knee is sharp:

| coverage | drawn/frame | overdraw |
|---|---|---|
| 81.7% | 18–23 | ~4 screens |
| **90.7%** (ships) | **23–27** | **~5 screens** |
| 99.5% | 49–55 | ~9 screens |
| 100.0% | 86–93 | ~16 screens |

> ⚠️ **Four times the fill for the last nine points**, on the one project whose
> frame rate has already collapsed once (`PERFORMANCE.md`).

> ⚠️ **If a true carpet is ever wanted, the answer is not more rows.** Ninety
> mounds a frame to paint one belt is the scatter being used as a fill tool. Bake
> the six drifts into one wide repeating strip at build time and the floor is two
> or three blits — but a baked strip can't have five bands moving at five
> speeds over it. **The parallax and the carpet are alternatives, not additions.**

**Re-measuring it.** The numbers below come from a port of `scenery.js` that lays
the scatter out with the same hash and math, blits the frames' alpha into the
belt strip at seven camera positions and counts. **Its only claim to be trusted
is that it reproduces a row of the table.** Built once for the 90% pass and
calibrated then on `6 × 1.45`; rebuilt for the five-plane pass and calibrated on
the three-plane row it was about to replace — it printed **90.3% | 90.9 / 90.4 /
89.5 | 17–20 drawn** against the **90.3% | 90.9 / 90.6 / 89.5 | 17–20** recorded
here (alpha > 63). Had it not landed there, every number after it would have been
a fiction. It lives in the session scratchpad, not in `tools/` — **it has now
been thrown away and rebuilt twice; ask whether to keep it the next time.**

⚠️ **Every number below is tied to the mounds' SIZE** (`SCALE` in the cutter,
raised twice: 0.11 → 0.143 → 0.157). Roughly **+2 points of coverage per +10% of
size** — the +10% needed no retune, a third bump will. The scatter spaces by width so x looks after itself, but a
bigger mound covers more DEPTH — the same 6 × 1.30 gave 62% at the old size and
68% at this one. Re-cut the pack, re-measure. Seven camera positions, not four:
coverage varies ~15 points across the room and a four-sample average hid it.

| rows × spacing, z span | belt | far / mid / near | drawn/frame |
|---|---|---|---|
| *old size 0.11* | | | |
| 5 × 0.52, z .10–.90 | 78% | 95 / 91 / **42** | 31–35 |
| 6 × 1.30, z 0–1.05 | 62% | 71 / 63 / 68 | 15–16 |
| *at 0.143* | | | |
| 6 × 1.30, z 0–1.05 | 68% | 80 / 71 / 53 | 12–16 |
| 6 × 1.45, z 0–1.10 | 66% | 74 / 64 / 58 | 9–12 |
| *at 0.157* | | | |
| 6 × 1.45, z 0–1.10 | 67% | 77 / 66 / 57 | 9–12 |
| 6 × 1.55, z 0–1.12 | 64% | 75 / 61 / 55 | 9–11 |
| 5 × 1.45, z 0–1.12 | 58% | 64 / 60 / 49 | 7–10 |
| *at 0.157 **with the three bands**, 2026-08-27* | | | |
| 6 × 1.45, mid off 0 | 62.6% | 75 / **46** / 66 | 9–12 |
| 6 × 1.45, mid off .10 | 65.8% | 66 / 64 / 67 | 9–12 |
| 11 × 1.45, mid off .10 | 78.8% | 83 / 76 / 77 | 17–21 |
| 10 × 1.35, mid off .10 | 78.6% | 85 / 76 / 74 | 17–22 |
| 11 × 1.35, mid off .05 | 80.3% | 89 / 76 / 76 | 18–23 |
| 11 × 1.35, mid off .10 | 81.7% | 86 / 78 / 80 | 18–23 |
| 12 × 1.35, mid off .10 | 83.5% | 87 / 79 / 85 | 19–25 |
| 11 × 1.25, mid off .10 | 86.7% | 90 / 85 / 85 | 20–24 |
| *the 90% run* | | | |
| 11 × 1.10, mid off .10 | 90.4% | 94 / 88 / 89 | 25–28 |
| 12 × 1.20, mid off .10 | 90.7% | 93 / 87 / 92 | 23–27 |
| 15 × 1.35, mid off .10 | 90.5% | 87 / 91 / 94 | 25–31 |
| 14 × 0.70, mid off .10 | 99.5% | 99 / 99 / 100 | 49–55 |
| 28 × 0.80, mid off .10 | 100.0% | 100 / 100 / 100 | 86–93 |
| *all three planes down 20% — offsets .20 / .30 / .20* | | | |
| 12 × 1.20 (the drop alone) | 95.0% | 96 / 92 / 97 | 23–27 |
| 9 × 1.20 (the 3-plane ship) | 90.3% | 91 / 91 / 90 | 17–20 |
| 12 × 1.35 | 90.5% | 92 / 85 / 94 | 19–25 |
| 13 × 1.35 | 91.3% | 94 / 85 / 96 | 20–27 |
| *five planes — `bands: 5`, offsets flat .20, spread 0.25, 2026-08-27* | | | |
| 10 × 1.20, zFrom 0 (the naive port) | 91.4% | 95 / 90 / **89** | 19–22 |
| 10 × 1.20, zFrom .10 | 91.8% | 92 / 93 / 90 | 19–22 |
| 10 × 1.25, zFrom .10 | 90.4% | 92 / 92 / 88 | 18–22 |
| **10 × 1.25, zFrom .12** (ships) | **90.1%** | **90 / 92 / 88** | **19–21** |
| 15 × 1.60, zFrom .15 (3 rows a band) | 90.8% | 89 / 90 / 93 | 20–26 |
| 10 × 1.30, zFrom .12 | 88.0% | 90 / 91 / 84 | 15–20 |

> ⚠️ **The naive port is the row to look at.** Changing *only* the band count and
> the row count — leaving the ladder where three planes left it — measures a fine
> 91.4% average with a 7-point spread across the thirds, piling ink into the far
> third at the near one's expense. **That is the reliable signature of this
> feature: whenever the field's shape changes, the average barely moves and one
> third quietly pays for it.** `zFrom` 0 → 0.12 is the fix.

> ⚠️ **Five planes is less flat than three (3.9 points of spread against 1.4) and
> more consistent per camera (86–93% against 83–95%).** Not in tension: more,
> thinner bands even out what any one camera sees while making the depth profile
> lumpier. **The per-camera number is the one to defend — a player sees camera
> positions, never an average of thirds.**

> ⚠️ **Moving the field DOWN raises coverage.** The same `12 × 1.20` went 90.7% →
> 95.0% at an identical draw count: a mound's ink is entirely *above* its ground
> point, so the top rows had been spending a slice of themselves painting up the
> back wall. That is why `rows` came back down 12 → 9 to hold 90% — same look,
> 17–20 draws instead of 23–27.

> ⚠️ **The far band is the one to watch, and the five-plane pass pushed it.** Its
> first row moved from z 0.200 to 0.320 (122px), so more of the top of the belt is
> covered only by ink hanging up from it. That prediction — "push the field down
> again and **the back of the belt goes bare first**, the reverse of this
> feature's first bug" — came true, measured and small: the top **quarter** runs
> **83–95%** across 13 camera stops against the three-plane **86–96%**. Three
> points, behind everything, while the whole belt's *worst* camera improved (83%
> against 81%). Judged affordable; `zFrom` is the one knob if it ever reads bare,
> and it trades against the near third point for point.

> ⚠️ **The shipped row is the evenest, not the highest.** 86 / 78 / 80 is the
> flattest spread anything measured, and per-camera it runs 72–85% against the old
> 48–75%. A high average hiding a weak third is what this has got wrong twice.

> ⚠️ **`rows` did nearly all of it; spacing barely moved.** 6 → 11 rows and 1.45 →
> 1.35. Spacing stays **above 1.0** so the drifts in a row stay separate — under
> it they merge into one ridge, the old "stuck together too much". Rows alone
> saturate: `11 × 1.45` is 78.8%, so the last two points came from the tighten.

> ⚠️ **Cost: 17–20 drawn a frame** — about four screens of overdraw. `rows` down
> first if it ever needs turning down; `on: false` kills it.

> ⚠️ **It will not go much under 65% without going patchy at this size.** Each
> drift is most of a screen wide now, so thinning further stops meaning "more
> sand between mounds" and starts meaning "some screens have a bare stretch".

> ⚠️ **`rows` is the coverage dial, not `spacing`.** Packing tighter in x merges
> each row into one continuous ridge and does not fill what is actually empty —
> the gaps *between rows*. Over 1.0, `spacing` leaves visible sand between mounds
> and the rows overlapping in depth do the covering.

> ⚠️ **`zTo` is past 1 on purpose.** A mound's ink sits entirely ABOVE its ground
> point, so a row at z covers about `[z - 140, z]`. Rows placed at band *centres*
> left the near edge of the belt bare — 42% where the player actually walks,
> against 78% overall. Watch the near-third column, not the average.

> ⚠️ **Read the thirds, not the average.** 78% overall was 42% where the player
> actually walks. The shipped 62% is *even* across the depth (71/63/68); the 78%
> one was not.

> ⚠️ **Cost is fill, not VRAM** — all the draws share one 908×1110 atlas, so
> there is nothing to thrash (the atlas is 997×1216). At 9–12 a frame it is under one
> full-screen blit on top of the plate's. `rows` down first, `on: false` to kill
> it.

> ⚠️ **Anything that must be stood on for real** — a height `z` or `jumpY`
> answers to — is a PROP, not scenery, and belongs in `prop.js`.

### The sixth layer (the one in the dead area)

`backLayer` is a **separate additive pass**, not a sixth band, and that is what
makes it safe to try: the five bands share one row ladder, so `bands: 6` would
need `rows` 10 → 12 and would **re-space every plane you already tuned**. This
leaves them at exactly the z they have (verified: 129/187/198/226/271/308/373/
434/483/511 before and after), and `on: false` removes it.

> ⚠️ **Negative `z` is the feature** — z measures *down* from the belt's top
> edge, so a negative ground point is above the belt entirely. Nothing else in
> `SCENERY` uses it. Rows land at y 311 and 387 on the desert's belt.

> ⚠️ **`zTo` is positive on purpose** — the "part in the dead area, part in the
> belt" half. A mound's ink sits *entirely above* its ground point, so a row just
> inside the belt still spends most of itself above the line. The layer paints
> y 111–387 against a belt starting at 330: ~80% dead area.

> ⚠️ **It answers none of the coverage rules.** Belt coverage is measured on the
> belt strip and this is almost entirely outside it, so the 90% target is
> untouched and needed no retune. It is *backdrop*, not ground cover.

> ⚠️ **Its parallax breaks the 0.25 ceiling on purpose** (0.70 = a 0.30 spread).
> That ceiling is about *ground* — a belt band under it crawls backwards and stops
> reading as the floor. This is up the back wall, where slower is just distance.
> **A rule's scope is what it was measured against.** Fallback: 0.75.

> ⚠️ **CURRENTLY 30% DOWN AND OVERLAPPING THE 5TH — an open experiment.**
> `zFrom: 0.25 / zTo: 0.45` puts its rows at y 425 / 501, *between* the far band's
> 459 / 517: **42px of shared depth**, the 6th's second row drawing in front of
> the 5th's first, and the two sliding **64px per screen** of camera travel
> (0.70 vs 0.75). It is also no longer in the dead area — both ground points are
> inside the belt. Shipped on request to be looked at. Three different fixes:
> back to `-0.05 / 0.15` (the dead-area version), or `parallax: 0.75` (moves
> *with* the far band, no slide, less separation), or ~15% down (just above it,
> no overlap).

> ⚠️ **Its hash seed is 100+, clear of the belt rows.** The scatter is keyed on
> the row index; reusing 0 and 1 would lay it out in lockstep with the two rows at
> the back of the belt — the same drifts at the same x, which reads as one band
> drawn twice rather than as depth.

### The five speeds

`parallax` cuts the rows into `bands` depth planes — two rows each at `rows: 10`,
`bands: 5` — and scrolls each at its own rate, the same meaning `parallax` has on
a backdrop layer. Walk 1000px and the far plane has drifted 250px against the
sand. `on: false` puts every row back at 1.0.

> ⚠️ **The count is data, and that was the work.** It was 3 planes, hardwired as
> `const BANDS = 3` in `scenery.js` and as `{far, mid, near}` three times over in
> the config. Adding two more names would have worked exactly once. Instead each
> block is a **curve sampled at `bands` points** (`Scenery._ramp`), so 3, 5 and 7
> all read the same file, and a list shorter than `bands` is a legal shorthand
> rather than two silently missing planes (`undefined` → `NaN` → nothing drawn).

> ⚠️ **The rollback is five numbers, and `bands: 3` alone is not it** — the count
> came with a re-tune (spread widened, ladder re-graded, density brought back
> down), and dropping the count without undoing those leaves a *third* config
> that was never measured. Paste, don't reconstruct:
>
> ```js
> bands: 3,  rows: 9,  spacing: 1.20,  zFrom: 0.0,
> parallax: { on: true, rates: [0.80, 0.90, 1.00] },
> bandScale:   [1.00, 1.05, 1.10],
> bandOffsetZ: [0.20, 0.30, 0.20],
> ```
>
> That is byte-for-byte what shipped at `4a5d788`: at three bands a three-entry
> list is read literally, so the list form is exact, not an approximation.

> ⚠️ **It breaks "they behave as the ground", on purpose.** A band under 1.0 no
> longer sits on a fixed patch of sand — it slides against the plate (1.0) and
> against the fighters (1.0). Affordable only because nothing ever asks a mound
> where it is. Incompatible with ever standing on one for real.

> ⚠️ **The last entry is pinned at 1.0 — that is the choice, not the default.**
> Anchoring the far plane instead (far 1.0 rising to near 1.25) makes the ground
> under the player's feet outrun him, and he reads as skating rather than walking.

> ⚠️ **The spread is the dial, not the individual numbers**, and it went 0.20 →
> 0.25 *because* the count went 3 → 5. What the eye reads is the **step between
> neighbouring planes**, so dividing one budget five ways instead of three halves
> it (0.10 → 0.05) — at the old spread, five planes would have been a more
> expensive way to look like three. Widening puts the step back to 0.0625.

> ⚠️ **0.25 is the documented ceiling and this now sits on it.** Much over it and
> the back of the belt crawls backwards under a fast camera and reads as a bug.
> **So "make it 7 planes" is an ask with no room left in it** — the answer there
> is the per-row lerp below, not more discrete bands.

| spread | far → near | reads as |
|---|---|---|
| 0.10 | 0.90 … 1.00 | a hint of depth |
| 0.20 | 0.80 … 1.00 | the 3-plane ship, five ways — **the rollback if 0.25 crawls** |
| **0.25** | **0.75 / 0.81 / 0.87 / 0.94 / 1.00** | ships |
| 0.40 | 0.60 … 1.00 | over the ceiling; the back visibly slides |
| — | 1.00 … 1.25 (anchored far) | skating; don't |

> ⚠️ **Bands come off the row index, not the jittered `z`** — `zJitter` would
> otherwise flip a mound's speed and tear the boundary. That is also why `rows`
> must stay a multiple of `bands`: 2/2/2/2/2 at `rows: 10`, but 2/2/2/2/**1** at 9.

> ⚠️ **Over 1.0 costs scatter, under it costs nothing.** A lagging band is inside
> the room and the field already over-covers; a fast one runs past `endX` and
> `enterRoom` extends the layout to match. Every rate here is ≤ 1.0, so none of
> that fires.

> ⚠️ **Adding planes costs nothing per frame; the rows do.** Band count is one
> multiply per item either way. What five planes actually bought was `rows` 9 →
> 10 to keep the split even: **19–21 drawn against 17–20**, one atlas bind,
> unchanged.

> ⚠️ **N bands means N−1 seams** — four of them now, 41px apart in depth and
> 0.0625 in speed. More planes is a smoother gradient *and* more places to tear;
> the rows' ink overlaps ~200px, which is what hides them. If a boundary reads as
> a tear, the fix is a per-*row* rate lerped far→near (`_ramp(…, rows, …)`
> instead of `_ramp(…, BANDS, …)` and drop the band index), not a smaller spread.

`bandScale` is the same planes, drawn bigger or smaller — a multiplier on the
pack's own scale, applied at draw time. The last entry is 1.10 because a closer
thing is bigger as well as faster.

> ⚠️ **The endpoints are the tuned ones and five planes only subdivides between
> them.** 1.00 is the pack's own size, 1.10 is the "10% bigger" that was asked
> for; the back and front of the field are drawn exactly as before and the three
> new steps are 0.025 apart. **If five planes don't read as depth, this is the
> dial and not the parallax** — a 0.025 step is near-invisible, so the cue is
> carried almost entirely by speed. Widening the ladder *downward*
> (`[0.95, 0.99, 1.02, 1.06, 1.10]` — shrinking the far drifts rather than
> growing the near ones) is the one line that makes distance visible as size. It
> is left alone because 1.00 is the art's own size, shrinking it is a decision
> nobody asked for, and it costs coverage in the far third.

> ⚠️ **It is a band multiplier, not a re-cut.** The pack is cut once at one scale
> (`SCALE` 0.157 in the cutter) and that stays the art's size — one scale per
> pack, never normalised per sprite. A *band* is level composition; every frame
> in it scales equally, so the mounds' sizes relative to each other are untouched.
> Don't push this into the cutter.

> ⚠️ **Two things scale with it, and each fails as a different-looking bug.** The
> **anchor** (`ax`/`ay` are frame pixels — miss it and the band hangs below the
> belt line, presenting as a `z` bug) and the **spacing step** (`spacing` is a fraction
> of a mound's own width — miss it and the band packs tighter as well as growing,
> so "bigger" arrives as "denser"). Both are handled in `scenery.js`; a third
> consumer of these frames would have to handle them too.

> ⚠️ **`marginPx` no longer clears the widest mound (995 → 1094 in the near band)
> and doesn't need to.** `camX` never goes below 0, so the left margin only has
> to put ink at x=0. It stays 1000 because `x0 = -marginPx` seeds the scatter's
> index — moving it re-rolls every band's layout for nothing.

> Cost: ~+2 points of coverage in the near third, ~+3% fill overall, draw count
> unchanged. **At 1.0 the scale is an exact no-op**, so the other bands and every
> other room draw exactly what they did before.

`bandOffsetZ` moves a whole plane down (or up) the belt — in fractions of the
belt's **depth**, positive toward the viewer. It is **flat at 0.20 now**: the
"bring the planes down by 20%" that was asked for, and nothing else.

> ⚠️ **It used to be 0.20 / 0.30 / 0.20, and that bump was a patch, not a shape.**
> The extra 0.10 closed a 129px hole three coarse bands opened between the mid
> band's last row and the near band's first (middle third 45.9% against a 62.6%
> average). Five bands, ten rows and the re-graded `zFrom` close that hole
> geometrically — the ten ground points land evenly from z 122 to z 494, 41px
> apart — so carrying the patch forward would put a bump back into an even ladder.

> ⚠️ **0.20 is 20% of the belt's depth (76px of 380), not of the screen.**
> The belt is the unit `zFrom`/`zTo` already use. For 20% of `GAME_H` — 144px,
> which crops most of the front row — use `0.38`.

> ⚠️ **The front planes sit past the near edge of the belt, deliberately.** Their
> ground points reach z 411–494 (screen y 741–824, below the 720px frame). A
> mound's ink is entirely *above* its ground point, so the drifts still blanket
> the near third and only their lower halves are cropped.

> ⚠️ **`zFrom` 0.0 → 0.12 is the knob that made five planes sit evenly**, and it
> is a placement change, not a density one. Ten rows on the old ladder measure a
> respectable 91.4% average while piling ink into the *far* third (95/90/89) —
> "read the thirds, not the average" for the fourth time. **`zTo` did not move:
> `zTo + bandOffsetZ` = 1.30 is the front row's ground point at z 494, which is a
> user-set position and a constraint on any future search here.** The cost is 3
> points at the very back — the top quarter runs 83–95% across 13 camera stops
> against the three-plane 86–96% — which is the "the back goes bare first"
> failure the last pass predicted, arriving, measured, and judged affordable.

> ⚠️ **It does NOT make the band a foreground.** Scenery is one layer, drawn
> before every fighter, so a mound at z 494 is still painted *behind* a player at
> z 380. It reads as ground sloping toward the lens, not as something he walks
> behind. That is a draw-order change — a second pass in the `foreground` layer
> slot (already in `LAYERS`, parallax 1.25, `on: false`) — not a number here.

---

## Coming up out of the ground

An enemy can arrive by **digging its way out of the desert floor** instead of
walking on from the side. One word in the wave data turns it on:

```js
{ kind: 'cigarro', x: 2600, z: 220, from: 'ground' }
```

`from` is the same slot `from: 'behind'` already uses, read in `Stage._spawn`.
**All three desert arenas** say it now — the mook of each wave, its espeto and its
first charutobi. It started as the first arena alone, with the other two left as
walk-ins for comparison; the comparison was made (*"make all the enemies in this
stage spawn like this (for now)"*, 2026-08-31). Nowhere else in the game says it.

**The exception is the walk-in charutobi.** One in the first arena, **three** in
the second, all deliberately *not* diggers — a room where every arrival is a hole
in the ground has no contrast left in it, and the point of these is that a rusher
can still come at you from off the screen.

**Two of the second arena's three runners come from the LEFT** (`from: 'behind'`
— the street's roaches already use it), and it is the **last two** on purpose: the
first runner still arrives from the right, where the diggers and every other enemy
in the game have taught the player to look, and the two behind him break that.
Reversed, the wave teaches nothing and then confirms it.

> ⚠️ **Four charutobi in the second arena is a deliberate override of "one per
> arena, never two."** That rule is real: he is outside the attack token
> (`CONFIG.SUICIDE_RUSH`), so **nothing in the crowd can stagger a pair** — two due
> on the same frame both run at the player at once. `delayMs` is the only tool,
> and it does all the work. Measured arrival times for that wave, from the arena
> opening:
>
> ```
>  0.9s  cigarro    z220  GROUND
>  1.8s  espeto     z300  GROUND
>  2.7s  charutobi  z150  GROUND
>  4.4s  charutobi  z250  from the right  (~802px of run, ~1.6s)
>  5.4s  charutobi  z330  from the LEFT   (~858px of run, ~1.7s)
>  6.3s  charutobi  z190  from the LEFT
> ```
>
> Coming from the left costs about **110ms** more run than the right — the two
> sides are near enough symmetrical around the locked camera — so switching sides
> does not re-time the wave. Tune the fight there; no AI knob will do it.

> ⚠️ **Each charutobi is 30 HP and does 12 damage *plus a knockdown* when he goes
> (`DEATH_BLAST.charutobi`), against `playerHealth` 110.** All four landing is 48
> — getting on for half a bar — and four knockdowns, where a knockdown is the
> state the next one reaches you in. Judge that wave before judging the room.

> ⚠️ **A rusher's `x` is unread.** He never takes a mark — he is running from the
> moment he is due — so the `x` on those entries is documentation of where he is
> aimed and nothing more. His `z` **is** read, which is why the three runners sit
> at 250 / 330 / 190: three rushers on one z run the same line and read as one
> thick enemy.

**There is no art for this.** It is two things:

| piece | what it actually is |
|---|---|
| the hole in the floor | a dark ellipse, `ctx.ellipse` — the same shape and idea as the ground shadow |
| the body half-buried | the sprite drawn *below* its ground point with everything under the floor line **clipped off** (`Fighter.draw`) |

> ⚠️ **It was three things.** A **rim** cut from the desert's floor pack sat over
> his feet to hide the clip line, and **debris** — the same drifts shrunk and
> thrown in the air — came out with him. Both were refused on sight 2026-08-31
> (*"I don't like these effects with the tiny cigarettes being thrown in the air.
> Also the small cigarettes that appear in the feet of the enemy are not good as
> well."*) and **deleted, not switched off**. Do not re-propose either. The
> deletion also removed a dependency nobody asked for: the effect used to borrow
> the floor pack, which quietly tied it to `SCENERY.on`. It needs no art now.

### He comes up from behind the cigarettes

While he is climbing he is drawn **between two of the scenery's five bands**, and
rejoins the crowd's own z-sort the instant he is out — so the floor covers him on
the way up and never once he is fighting. Which two planes is **dealt** per
enemy, so a wave of three shows three different depths.

The scenery is still **one layer** in `LAYERS`. `drawScenery()` in `game.js`
splits that one pass in two around the fighters being injected, so nothing else
in the render stack knows about it, and a room with no scenery lays out no bands,
injects nobody, and draws byte-for-byte what it always did.

### The knobs — `CONFIG.EMERGE`

```js
on: true,            // MASTER SWITCH — off, a digger is an ordinary walk-in
heaveMs: 380,        // the hole opens, nothing coming out of it yet
riseMs:  560,        // he climbs; he is UNTOUCHABLE for this and the heave
stepPx:  34,         // …and lands this far CLEAR of the hole, towards the player
hopPx:   26,         // …passing this far ABOVE the ground line on the way
clearAt: 0.55,       // fraction of the rise spent still coming through the floor
holdFrame: 2,        // the stretched jump frame, held for the whole climb
boomFrom: 5,         // dust as he breaks the surface — the HOLE-FALL subset
boomSizePx: 200,     //   …the SAME unit the death blasts use (208 / 193)
boomDelayMs: 7,      //   …held back this long AFTER `clearAt` — see below
boomAtMs: 395,       //   …or a RAW time from the hole opening; null = use the above
boomStride: 2,       //   …playing every 2nd frame, held twice as long
steps: 6,            // the climb quantised to 6 positions — "few frames" 
settleMs: 420,       // the hole closes — he is already fighting through this
holeW: 31.2, holeH: 10.2, holeAlpha: 0.62, holeColor: '#241609',
spawnBehindScenery: true,   // draw him inside the floor while he climbs
minBandsInFront: 1,         // how many planes of floor cover him — dealt
maxBandsInFront: 3,         //   per enemy between these two, inclusive
```

> ⚠️ **He is drawn with his JUMP row, not his walk row** — they jump out of the
> holes. A walk cycle reads as a body being *lifted* through the floor. It falls
> back to the walk for any pack with no `jump`.

> ⚠️ **One frame of it, held — not the row played.** `holdFrame: 2` is the apex
> in all four digger packs (espeto, charutobi, cigarro, cigarro3). The row is a
> jump from a *standing* start — crouch, push, tuck, land — so four of its six
> frames are a body doing something on the ground, and a digger is in the air for
> all of this. ⚠️ The frame was picked **by eye**: the cigarettes' tallest ink is
> frame 0, because their smoke plume is tallest there.

> ⚠️ **The dust is a SUBSET of an explosion this game already loads.** The main
> game reads two defs off one sheet: `saborosa-boom-full.json` (12 frames) for the
> furnace blast and `saborosa-boom.json` (7) for falling into a hole — and those
> seven are exactly frames **5–11** of the twelve here as `BOOM_RECTS`. So the
> hole version is the **tail**: no grow-in, no peak, just the dispersing half. It
> opens already large and thins out, which is what dust kicked up by something
> else looks like; the full string opens small and blooms, which is what a thing
> detonating looks like. `boomFrom` is an **index**, not a second sheet or a
> second defs file — the two games already share the art, they just start reading
> it in different places.

> ⚠️ **It fires `boomDelayMs` after `clearAt`, not on it.** `clearAt` is when his
> *head* passes the line, not when there is a body to see — a burst there is a
> puff of dust over nothing that he then walks out of. **The instant a thing
> starts is not the instant it reads.** ⚠️ **And the window is far tighter than it looks:**
> 200 too late, 100 still too late, 50 "almost there", 25, 15, **7**. The airborne
> half of the climb is 252 ms long and the answer is in its first *thirtieth* — the
> burst belongs **on the break-through**, near enough to `clearAt` that the delay
> is a nudge, and 0 is wrong only because nothing has broken through at that exact
> frame. ⚠️ Measured: the strided tail is ⌈7/2⌉×2×70.9 = 567 ms, ending at 1262
> against a `done` of 1360 — 98 ms of slack. `boomStride` lengthens the burst as
> well as thinning it, so the two share this budget; `settleMs` buys more.

> ⚠️ **AND ITS ZERO IS 688 ms IN, WHICH IS WHY TURNING IT DOWN STOPPED DOING
> ANYTHING.** Reported 2026-09-03: *"this explosion animation is set to run like
> 7 ms after the first animation starts. But this is not working, its taking more
> than 7 ms… in 15 ms the explosion was taking too long, but when I reduced to 7,
> not much changed."* Nothing is broken. The burst goes off at
>
> ```
> heaveMs + riseMs × clearAt + boomDelayMs
> 380     + 560    × 0.55    + 7            = 695 ms
> ```
>
> after the ground starts opening, so 15 → 7 moved **8 ms of 695** — half a frame
> at 60 Hz out of a forty-two-frame wait. **A relative knob cannot be judged
> against the wrong zero.** ⚠️ To move it somewhere the eye can see, use
> **`boomAtMs`**: a raw time from the hole opening, where `null` resolves to
> *exactly* 695 ms so switching between the two is a comparison rather than a
> jump. ⚠️ **It is set to `395` since 2026-09-03** — *"instead of 695ms, make it
> blow at 395ms"* — which is 300 ms earlier and lands on the far side of a
> landmark rather than nudging: the hole finishes opening at 380 and his head
> does not break the surface until 688, so the dust goes off over an **open,
> empty hole** and he climbs up *through* it. The burst is no longer punctuating
> his arrival; it is the thing he arrives out of. ⚠️ And it now **covers the
> whole climb** — the 567 ms tail runs 395 → 962 against a landing at 940, so the
> dust clears 22 ms after he is on his feet, where at 695 it ran to 1262 and he
> fought through the last 300 ms of it. `boomDelayMs` **asks the climb** (it rides `heaveMs`, `riseMs` and
> `clearAt`, so retiming any of them keeps the burst on the break-through);
> `boomAtMs` **tells it**, and goes stale the moment the climb is retimed — the
> same bargain as `DEATH_BLAST`'s `atFrame` vs `atMs`. Prefer the relative one.
> ⚠️ `boomAtMs` is also the only way to put the burst **before** the break-through
> without moving the hop, because `clearAt` is not a burst knob — it *splits* the
> rise, so dragging it down to fetch the dust earlier shortens the climb and
> lengthens the hop at the same time. A negative `boomDelayMs` does the same job
> relatively and is legal. ⚠️ Below ~688 the dust goes off over a hole nobody has
> come out of yet, which is the look that was refused the first time round; and
> anything within one frame (~16 ms) of 695 will not be distinguishable from 695
> on a 60 Hz display.

> ⚠️ **It is sized in the same unit as the death blasts, which is what ended six
> rounds of guessing.** It began as a `boomScale` ratio (0.5 → 0.35 → 0.455 →
> 0.637 → 0.828, every correction the same way) until the ask that settled it:
> *the same size as the explosion of the enemies that explode.*
> `DEATH_BOOM.espeto.sizePx` is 208 and `charutobi`'s is 193, so this is **200**,
> and `Emerge` does the identical `size / peak` arithmetic `Booms.draw` does off
> the identical rects. **A number you cannot compare to anything is a number you
> will guess at forever.**

> ⚠️ **The dust is its own pass, and the enemy is not.** A digger is *injected
> into the scenery* — the cigarette mounds paint over him, which is what makes him
> look like he is coming through the floor — and while the burst travelled with
> him it inherited that plane and got buried too. **A body under the floor is the
> effect; dust under the floor is a bug.** `Emerge.drawBoom` is called from
> `drawEntities` immediately before the player, so it sits over the floor, the
> props and the fighters behind him. A fighter *nearer the camera* than the player
> still draws over it — that is depth working, not the rule being broken.

> ⚠️ **Both the climb and the burst are deliberately choppy.** `steps: 6` quantises
> the rise into six positions and `boomStride: 2` plays every second frame of the
> tail, each held twice as long — 4 drawings instead of 7. The reference is the
> barrel pickup, which reads chunky not because anyone chose a stutter but because
> its **row has few frames**, each owning a visible slice of the action
> (`floor(t*n)` in `frameStep`). Here the body holds *one* drawing all the way out,
> so there is no row to thin and the **movement** is the only thing left to
> quantise. ⚠️ **One quantiser feeds `sunk`, `hop` and `travel`** — they are three
> views of one movement, and stepping them separately lands the forward step
> between two heights. ⚠️ And the burst drops **frames** rather than slowing the
> rate: slowing it would stretch the tail past the hole's own life.

> ⚠️ **He passes the ground line and comes back.** `clearAt` splits `riseMs`:
> 0.55 of it is coming through the floor (`sunk` 1→0) and the rest is airborne
> (`hop` 0→1→0, a **sine** — up and down as one curve, because an ease-out to the
> apex and an ease-in down is two moves with a hang between them). `released`
> still fires at the end of the rise, so he touches down on the exact frame the
> AI takes him over; a hop with its own duration could outlast the climb and that
> looks like a fighter walking in mid-air. The hop is folded into `sinkPx`, which
> **turns the ground scissor off by itself** — the clip is gated on `sinkPx > 0`.

> ⚠️ **`stepPx` moves the FIGHTER, not the hole.** Rising straight up and stopping
> dead on the spot reads as an elevator; the hole closing *behind* him is what
> makes the two read as two objects. Safe only because `Emerge.start` takes a copy
> of the spot. It also sets his facing for the jump — before this, `_face()` on
> release was the first thing to set it and he span round on landing. `0` = the
> old straight-up arrival.

**Two rollbacks, both one word:**

| set | what you get back |
|---|---|
| `spawnBehindScenery: false` | diggers on the ordinary fighter plane, single-pass floor. The climb stays. |
| `on: false` | no digging at all. `from: 'ground'` reverts to a normal walk-in — **the gate is in `Stage._spawn` as well as in `Enemy`**, or an enemy would be spawned on its mark with neither a walk-in nor a climb and would just appear standing. |

> ⚠️ **`maxBandsInFront` is the pop dial.** The hand-off back to the fighters'
> plane is instant, so whatever still covers him at the end of the climb is
> revealed in one frame. Rendered at 4 planes in front, the frame before release
> showed only his head and the hand-off read as him *appearing* rather than
> arriving. 3 — which is also the number originally asked for — keeps it small.

> ⚠️ **The planes are DEALT, not rolled, and that was a bug fix.** Over a range of
> three, a per-enemy position hash put all three of the first arena on the *same*
> plane — the one outcome that makes the feature look absent. The index steps
> through the range and a hash of the **wave's** seed decides where the deal
> starts. A per-*enemy* seed breaks the stepping and two of three collide again.

> ⚠️ **The dealt plane is floored at 1 in code, not just by config.** Plane 0
> would split the floor between the dead-area sixth layer and band 0, and those
> two *do* interleave in z (back layer at 95/171, band 0 at 129/187) — the only
> split that changes the floor's own draw order. Measured: every other plane
> leaves it byte-for-byte identical. `minBandsInFront: 1` keeps 0 out of range
> anyway, but a config is not a guarantee.

> ⚠️ **`holeW`/`holeH` are 40% down** from the 52 × 17 they shipped at
> (2026-08-31). For scale, the ordinary ground shadow is 44 × 13, so the hole is
> now smaller than a fighter's own shadow rather than half again as big.

**`heaveMs` is the beat that replaces the walk-in.** A walk-in exists so that
nobody materialises in front of the player; this spends the same moment in place
instead of sideways. If a digger ever reads as popping into existence, that is
the number — nothing in `stage.js`.

> ⚠️ **`holeAlpha: 0` leaves nothing to see.** The hole is now the whole of the
> arrival. The desert floor is a carpet of pale butts at 90% coverage, so nothing
> drawn *on* it in that same art reads at all — which is what the rim was, and why
> it was invisible before it was disliked. A dark gap is what the eye catches.

> ⚠️ **A pack whose frame is much taller than its body climbs "late".** The sink
> is the frame's full reach, so what clears the floor first is whatever is drawn
> highest. Measured: cigarro reaches **378px** above his ground point against a
> **203px** body — so for the first ~46% of his rise the only thing above the sand
> is his plume of smoke, and the body follows. It reads well for a cigarette and
> it is worth knowing before wondering why he seems to appear late. Espeto is
> 148/125 and charutobi 122/102, so neither of them does it.

> ⚠️ **He cannot be hit for `heaveMs + riseMs`** — 940ms as set. `buried` on
> `Fighter` is what does it (`vulnerable()` reads it), and it is a separate flag
> from the `state === 'enter'` next to it, which belongs to the player. Making
> the climb longer makes the window in which the player can stand on him and hit
> nothing longer with it.

> ⚠️ **An effect that has not STARTED is not an effect that is OVER**, and the
> sink test in `Fighter.draw` must not read `started`. It did, and it was the
> "enemies are already there, then the animation plays" bug: `delayMs` holds the
> climb off (900ms for the espeto, 1800ms for charutobi) and for all of that time
> the guard fell through to a sink of 0 and drew him standing on his mark in full
> view. `sunk` already answers **1** before the clock runs.

---

## Rooms

```js
ROOMS: [
  { name: 'street',    plate: 'plate',       startX: 220, endX: 4704, reverse: true, segments: [...] },
  { name: 'desert',    plate: 'desertPlate', startX: 220, endX: 6286, reverse: true, segments: [...] },
  { name: 'boss-room', plate: 'bossPlate',   startX: 220, endX: 1617, reverse: true, segments: [...] },
],
fadeMs: 900,   // the whole room-to-room fade; the swap happens at its midpoint
```

Each room has its own footage and its own camera origin. To add one: add a
`SOURCES` entry for its plate, a `ROOMS` entry pointing at it, and set `endX` so
the camera crosses exactly as much of the shot as exists.

**A room's place in the game is its index in this array and nothing else.**
No file reads a room number, so re-ordering the level is moving an entry — which
is how the desert went in between the street and the horse on 2026-08-27 without
touching the boss room at all.

**`reverse: true` needs a plate that can be scrubbed backwards.** Video cannot
play backwards, so reverse means seeking, and a seek decodes from the previous
keyframe. Re-encode the clip with dense keyframes first:

```
python3 tools/build-boss-plate.py       # crops at the pan's turn, keyframe every 3 frames
python3 tools/build-street-plate.py     # keyframe every 12, -b:v 3000k          -> 11.0 MB
python3 tools/build-desert-plate.py     # keyframe every 12, crf 32, downscaled  ->  4.8 MB
```

### Making a plate small

**The knob is `CRF`, not the resolution.** Measured on the desert shot at the
1280x720 the player actually sees — at the *same file size*, native 848x478 beats
a scaled-down encode every time (crf 30 / 6.1 MB scores 0.884; 640x360 crf 26 /
6.1 MB scores 0.831), and it is visible: the scaled ones go mushy where the
high-CRF ones only lose grain.

| desert plate, 848x478, GOP 12 | size |
|---|---|
| crf 28 | 7.9 MB |
| crf 30 | 6.1 MB |
| **crf 32** — what ships | **4.8 MB** |
| crf 34 | 3.8 MB |

> ⚠️ **VP9 is twice the size here, not half** (19.2 MB), because a scrubbable
> plate is forced to carry 65 keyframes and libvpx spends far more on each one
> than x264. **Denoising first saves nothing** — the bits are real gravel, not
> sensor noise. **And a longer GOP is not the answer either:** 12 → 48 saves
> 2.7 MB and makes every backward step decode four times as far.

The street plate is still `-b:v 3000k` at **11 MB** — the largest file in the
build. The same CRF pass would take it to roughly half that; it has not been done
because that shot is a shipped, judged asset.

**`lock: false` on an arena** makes the camera follow that fight instead of
locking, with the whole room as walls rather than one screen. That is what a
small room wants.

### How deep the belt is — per room

```js
{ name: 'desert', belt: { topY: 330, depth: 380 }, ... }   // double the default
```

The belt is the band a fighter walks in: `z` runs `0..depth` and anything
standing on it draws at `topY + z`. **A room may declare its own**; one that does
not gets `CONFIG.beltTopY` (520) and `CONFIG.beltDepth` (190).

| room | topY | depth | near edge |
|---|---|---|---|
| street | 520 | 190 | 710 |
| **desert** | **330** | **380** | 710 |
| boss room | 520 | 190 | 710 |

> ⚠️ **`topY` and `depth` are a pair.** `z` lives at `topY + z`, so doubling the
> depth alone puts the near edge at 900 — 180px below a 720-tall canvas, and the
> player walks off the bottom of the screen. Move `topY` up by whatever `depth`
> gains. `Belt.set()` takes the whole room for exactly this reason.

> ⚠️ **Every `z` in that room is on the new band.** The desert's enemies sit at
> `z: 220` where the street's equivalents sit at `110` — the same 58% across the
> belt, a different number. **A `z` copied from a street wave lands at half the
> depth it means.**

**What does not change:** the perspective. `depthScale` is `z / depth`, a
fraction, so bodies shrink from far to near across the same range — a deeper belt
is more room to move, not a different camera.

⚠️ **Nothing reads `CONFIG.beltTopY` / `CONFIG.beltDepth` directly.**
`src/belt.js` resolves the room's band and everything on the floor reads
`Belt.topY` / `Belt.depth`. A read left on CONFIG is a body standing on the
street's floor in the desert — and it looks like a sprite-anchor bug, not like a
missed find-and-replace. **The C-key overlay reads `Belt` too**, so its band,
walkable region, depth ruler and plan view all follow a room's belt, and its
labels name the room's own knob (`ROOMS[1].belt.depth`) rather than the CONFIG
default.

### Walking into a room

The player **walks on from the left** whenever a room begins — the start of a
run, a fade into the next room, and a DEV number-key jump. `CONFIG.playerEnterPx`
(360) is how far off his mark he starts; `state: 'enter'` means the controls are
dead and nothing can hit him on the way in.

> ⚠️ **`enterWalk` is measured from where he has already been PLACED**, so it
> must be called *after* whatever puts him on his mark (`stage.enterRoom`). Read
> before it, it walks him in from the previous room's origin.

### How long a room can be

Two numbers, and the FOOTAGE decides both:

| room | pan | `worldPxPerSecond` | camera travel | `endX` |
|---|---|---|---|---|
| street | 29.52s | 116 | 3424 | 4704 |
| desert | 26.03s | 192.4 | 5007 | 6286 |
| boss room | 5.21s | 64.8 | 337 | 1617 |

`camX` is clamped to `endX - GAME_W` (1280), so **`endX` = camera travel + 1280**
and it is a hard ceiling on how much of the shot can ever be seen. Camera travel
is `worldPxPerSecond * duration` — which is why the desert is the longest room in
the game out of the shortest walking clip: its shot pans nearly twice as fast.

The camera trails the player by `GAME_W * camFocusX + camDeadzone` ≈ **668px**,
so a scroll ending at `toX` leaves the camera at about `toX - 668`. Retune either
camera number and every scroll's film percentage moves with it.

### An arena with no enemies is a doorway

```js
{ kind: 'arena', enemies: [] },   // walked straight through
```

`Stage.update` reads the empty list and hands over on the segment's first frame:
**no camera lock, no GO arrow, no checkpoint.** It holds the place a wave will go
while a room is being laid out. Write enemies into the list and it is an ordinary
arena again, with nothing else to change — which is how the desert's two went
from doorways to fights, one `cigarro` each.

### The room's last segment is the door

The desert ends on an **arena**, not a scroll: clearing it exhausts the room, and
a room with another one after it means a **door** — the player walks off the
right edge and fades into the next. No GO arrow, because there is nothing left to
walk to. That is the shape the street already has (it ends on the Mosca rematch),
and it is why a "boss arena" placed last needs nothing else wired.

> ⚠️ **When that arena becomes a real boss, `who` is not optional.**
> `{ kind: 'boss' }` with no `who` is the **Mosca** — a default older than the
> horse — and she dies in the street. And the fight will show a **still
> backdrop**: the plate is scrubbed by camera position, this arena sits on the
> final frame of the film, so the shot has nowhere forward to go whether it locks
> or not. Give it an explicit `camX` a few hundred px short of the end if the
> footage needs to keep running under the fight.

> ⚠️ **The checkpoint comes back with the enemy, and that is usually what you
> want.** An empty arena leaves the ground behind it walkable both ways; a
> cleared one pins the camera at it (`reverseFloorX`). So "the camera stops going
> back after each fight" is not a setting — it is the difference between the two
> paths above.

> ⚠️ **Leaving `enemies` empty was not enough on its own.** It already cleared
> itself on the first frame, but on the way through it locked the camera for that
> frame, raised a GO arrow over a walk nothing had interrupted, and left a
> `reverseFloorX` checkpoint — an invisible wall across ground where no fight
> happened, which matters in a room that offers walking back.

### The Mosca leaves and comes back

The street fights her **twice**, and the difference between the two encounters
is one field on the segment:

```js
{ kind: 'boss', fleeAt: 0.5 },   // mid-street: at half a bar she breaks off and flies away
...                              // three more waves
{ kind: 'boss' },                // the last segment of the street: this one kills her
```

`fleeAt` is a **fraction of her health**. Reaching it, she stops fighting on the
hit that took her under, climbs out of reach, and leaves **to the right** — up
the street, the way she came in and the way she will come back. The segment ends
with her **alive**.

> She first left in the direction the punch sent her, which meant half the time
> she escaped back over ground the player had already cleared. Fleeing should
> point **forward**, at the fight still to come. She can now cross over the
> player on her way out; that is safe, not tolerated — she is climbing to
> `flyBossFleeY` and her hitbox went cold the frame she broke off.

- **The encounter owns the rule, not the boss.** A `FlyBoss` with no `fleeAt`
  is exactly the boss she has always been. Nothing remembers the first fight
  happened — the rematch is a **fresh boss at full health**, which is what makes
  two encounters out of one class with no state carried anywhere. Delete the
  field and the street is what it was before, twice.
- ⚠️ **`finished()` no longer means dead.** It is what the segment advances on,
  and it is now true either way. Anything hung on that moment — a tally, a drop,
  a one-time unlock — has to ask which happened.
- **Three things had to be told separately** that fleeing is not dying:
  `vulnerable()` (nobody finishes her off on the way out), the health bar in
  `game.js` (a bar over something that cannot be hit is a lie, and this one would
  sit at exactly half inviting punches), and her theme (see *Sound*).
- **The exit is fused.** `finished()` normally waits for her to clear the arena
  edge; `flyBossFleeMaxMs` (4 s) is the answer to every way that can fail to
  happen, because otherwise the level hangs on a boss nobody can hit with
  nothing visibly wrong.

| knob | |
|---|---|
| `flyBossFleeY` | 330 — the altitude she breaks off to. Above the tell (210), well under the 620 she descends from: she must exit **by the side, in shot**, not punch up through the top of the canvas. The player seeing her go is the whole point |
| `flyBossFleeSpeed` | 620 px/s — quicker than a hover drift, slower than a ground pass |
| `flyBossFleeAccelMs` | 400 — ramped into, so it reads as turning tail rather than as a teleport |
| `flyBossFleeMaxMs` | 4000 — the fuse above. Not padding |

**It costs no film.** The street's footage is spent by the time the last wave is
over; an arena and a boss both lock the camera, so the rematch plays against the
final frame exactly as the wave before it does. Scrolls are what the shot pays
for — see *Rooms*, and the note in `CONFIG.ROOMS`.

### Where enemies come from

They are placed **off screen and walk in**, rather than appearing at the spot
they will fight from — a fighter that materialises in front of the player reads
as a bug even when it is the design, and the walk-in is also how the player sees
how many are coming and from where. `from: 'behind'` brings one in from the left
instead, out of the ground already cleared.

**How far off screen is measured off the drawing, not picked.**
`Stage._spawn()` asks `Sheets.overhang()` how far the walk cycle reaches past
the enemy's ground point and adds `spawnMarginPx` (70) of clearance on top.

> ⚠️ **It used to be a flat 70 and that broke silently when the roaches grew.**
> A barata's sprite reaches **169 px** from its ground point on one side — the
> ragged anchor is nowhere near the frame's centre — so at 70 its horns sat on
> screen advertising where it would come from while the fighter itself was still
> legitimately off it. The cigarettes reach 60–68 and had always just fitted,
> which is why it had never shown before.

Two things `overhang()` does that matter: it walks **every frame of the pose**
(a walk cycle is widest mid-stride — frame 3 in all four packs, not frame 0),
and callers take the **larger of its two sides**, because a mirrored frame swaps
them and the spawn does not know which way a pack faces natively. That costs a
few px of extra walk-in and cannot be wrong.

Because it is derived, rescaling a pack moves its spawn point with it — which
matters, since `drawScale` moved three times in one day.

## Walking between fights

**The GO arrow only appears when the next segment is a `scroll`.** It means "the
way forward has opened", so a fight that hands straight to another fight — the
boss room's wave handing to HIPÓLITO — raises nothing. One place decides it,
`Stage._goPrompt()`.


`scroll` segments end at an absolute `toX` — **and at a minimum walk**,
`CONFIG.scrollMinWalkPx` (260), measured from wherever the player was standing
when the scroll began, clamped to the room's right wall.

Without the minimum, a fight that ends on the right-hand side of a locked camera
can leave the player already past the next `toX`; that scroll then completes on
its first frame and the following wave spawns on top of them. It is what
happened after the Mosca. In the normal case the player is behind `toX`, so the
minimum never binds and costs no film.

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


## Dev mode

| knob | what it does |
|---|---|
| `punchDamage` | 50 a hit. **`null` keeps the room jumps and leaves the damage real** — use that to walk the level for pacing. |
| `lives` | **total** lives a run starts with, overriding `playerLives`. `1` = no extras, so the first death opens the CONTINUE screen. `null` = leave `playerLives` alone. |
| `startRoom` | which room the game starts in, by index. |

> ⚠️ **`DEV.lives` is total lives, not extra ones.** The HUD's "x2" is lives
> *minus the one being played*, so "0 extra lives" is `1` here.

> ⚠️ **It lives in `DEV` rather than in `playerLives` on purpose.** `playerLives:
> 3` is the tuned number every fight in the game is balanced against, and
> `package.sh` refuses to build while dev mode is on — so a testing value cannot
> ship. Both the run start and a CONTINUE ask `player.fullLives()`, which is the
> only thing that knows what a full set is; two reads of `CONFIG.playerLives`
> would have left a continue quietly more generous than the run it continued.

```js
DEV: { on: true, punchDamage: 50 },   // top of config.js
```

> ⚠️ **OFF is the shipping state** — read the value in `config.js`, not this
> sentence — and `package.sh` refuses to build while it is `true`. That refusal
> is the safety net: a forgotten `true` costs a failed build rather than a
> shipped cheat, so turn it back to `false` when you are done testing rather
> than working around the build.

### Unlocking it in game — pause, then type SABOROSA

```js
DEV_UNLOCK: { on: true, word: 'SABOROSA' },   // NOT inside DEV — see below
```

**Pause (Enter), type the word in CAPITALS, and dev mode toggles.** The pause
card grows a `SABOROSA MODE ON` line, and the corner marker appears with it.
`on: false` removes the code.

> ⚠️ **There is no OFF line, and there must not be one.** One was built — off
> otherwise looks exactly like a code that was never typed — and refused on
> sight: *"remove the SABOROSA MODE OFF text, don't ever make that appear."* It
> is **deleted**, not held behind a flag, like every other look this project has
> turned down. **The absence of the line is the off state.**

> ⚠️ **The card says SABOROSA MODE, the corner marker still says DEV**, and that
> split is deliberate. The card is the only place a *player* is ever told about
> this, so it wears the game's name; the marker exists to stop a forgotten flag
> being read as a balance problem, and whoever is reading that is not a player.
> `DEV_UNLOCK.label` is the string, kept separate from `word` so that renaming
> the code does not rewrite the label.

> ⚠️ **It is deliberately NOT inside `CONFIG.DEV`.** Everything in that block is
> dead while `DEV.on` is false — every read site enforces it — and the unlock is
> the one thing that has to work *precisely then*. In there it would be a door
> locked from the inside.

> ⚠️ **Uppercase is enforced by reading `e.key` instead of `e.code`**, which is
> the opposite of how every other key in this game is read. A `code` is the
> physical key and cannot tell `S` from `s`; `e.key` is `'S'` only with shift
> held or caps lock on. **So a word with a digit or a symbol in it will not
> record at all.**

> ⚠️ **The letters are recorded at the top of the keydown handler, before
> everything else.** Two of SABOROSA's letters are movement keys — **S is down
> and A is left** — and that branch `return`s, so recording anywhere below it
> would silently drop both and the word could never be finished.

> ⚠️ **Input only listens while the card is up** (`Input.armCheat`, armed on the
> pause edge, and it forgets the buffer both ways). Recording always and
> checking only here would look identical and would not be: you could type it
> while walking around and unlock by pausing afterwards. It is matched on the
> **end** of what was typed, so a mistyped run-up does not have to be cleared.

**What the toggle reaches, and what it does not.** Every gate on `DEV.on` is a
live read inside a function — the room jump, the punch damage, the corner
marker, the debug overlay — so they all answer on the next frame. The two that
are read *once* stay read once: `startRoom` is a boot-time jump, and `DEV.lives`
is taken in `player.fullLives()` at construction and on a continue, **so
unlocking mid-run does not top the player up.**

> ⚠️ **The number-key room jump is refused in `input.js` too**, not only in
> `game.js`. A shortcut that skips most of the game should not depend on one
> `if` in the shell being right. The keys still count as "press anything" on the
> end screens, because a dead key there would be inexplicable.

Every player punch does `punchDamage` instead of its own. **Damage and nothing
else** — reach, timing, knockdown, the combo and every enemy's HP behave exactly
as they ship, so what you are testing is the real fight at speed rather than a
different game. At 50: both cigarettes die in one hit, ERKPA in two, and the
Mosca **breaks off on the second punch and dies on the third** in the rematch
(110 HP since 2026-08-27, and half of it is the threshold she leaves at).

It is applied at the one place the player's damage is read (`combat.playerHits`)
rather than by rewriting `CONFIG.COMBO` — the table documents a 28-damage string
that every enemy's HP is tuned against, and a config that lies about that is
worse than a branch.

> **`punchDamage: null` is a real setting, not a missing one.** The read site
> tests `!= null`, so `null` keeps the room jumps and the marker while leaving
> the **damage table alone**. That is the mode for walking the level to judge
> pacing and length; 50 is the mode for getting somewhere quickly. The marker
> prints `DEV real dmg` in that state so it never looks like a bug.
>
> ⚠️ **The fight cannot be judged at 50.** The horse dies in three combos and
> every mook in one, which is exactly the situation that shipped the first itch
> build with an unplayed balance.

**Jumping straight to a room.** Testing a late room by playing to it is how a
late room stops getting tested.

```js
DEV: { startRoom: 1 },   // which room the game boots into
```

The **number keys do the same thing live** — `1` for the street, `2` for the
desert, `3` for the boss room — with no fade, because sitting through the fade is exactly the
waiting the shortcut exists to avoid. It rebuilds the player from scratch, so a
key pressed mid-combo or on the death screen cannot carry that state into the
new room. The marker shows which room you are in.

Both are dead when `on` is false.

**It is loud on purpose.** The HUD draws a `DEV 50 dmg` marker in the top right
while it is on, and **`package.sh` refuses to build** until `on` is false. A
shipped build where every punch does 50 reads as a balance disaster rather than
a forgotten switch, and by then the person looking at it is usually not the
person who left it on.

## When a sprite looks like it is floating

**The ground line is the last row of the body with at least `BODY_MIN_RUN` (6)
opaque pixels in it.** That is a guard against an antialiased tail — and on a
spiky character it is not enough. ESPETO's lowest spike is 39px below his feet on
the idle frame, so at 6 he was drawn hanging off the spike tip.

```python
'bodyMinRun': 80,     # in tools/build-beat-enemy-defs.py, per sheet
```

> ⚠️ **Do not anchor on the feet instead.** They are drawn at different heights
> in different frames (39px of spike under them in idle, 17 in walk), so a
> palette rule makes the character BOB by the difference. What is stable is where
> the silhouette becomes substantial, which is what the threshold measures.

> ⚠️ **It also changes the drawn SIZE, and the reaches with it.** The same
> threshold finds the top of the body, so `bodyH` moves, so the pack scale moves,
> so every drawn distance moves. ESPETO went 137px → 170px and his measured
> reaches 123/97/121 → 146/116/138. **Re-measure after touching it.**

> ⚠️ **`baseWhite` in that tool is declared by two sheets and has never been
> passed** — `anchor(t)` at the call site. The horse has been anchored on his
> chrome highlights since he was cut. Left alone deliberately; fixing it moves a
> tuned boss.

**For the last few px, nudge instead of re-cutting:**

```js
CHARACTERS.espeto.groundNudge: 10,   // drawn px, DOWN
```

Per character, every frame, added to the shared per-pose `poseNudge`. It moves
the **picture only** — not the hurtbox, the reaches, the shadow or `depthScale`
— so it is the right tool for a taste call and the wrong one for a big number: a
large nudge is a sprite standing somewhere its hitbox is not. If it wants more
than a few px, re-cut.

### Why ESPETO needed both

His ground line was on a spike tip (the cutter fixed 27px of it) **and** his idle
row is drawn with the ball tucked up — feet 24px above the line on the first idle
frame against 4–7px across the whole walk. So the pose you look at while standing
still was the one that read as floating, and the last 10px is a nudge.

## Corpses, fading, and the one that explodes

```js
CHARACTERS.espeto.corpseFade: false,   // trust the sprites, do not dim them
```

Most death rows end with a body on the floor, so the corpse fades out over
`corpseFadeS` and is reaped. **ESPETO's ends with the body gone** — four frames
of spines scattering — so fading it as well is dimming an explosion.

> ⚠️ **The flag is the OPACITY only.** `corpseGone()` does not read it, so he is
> still removed on the same clock as everyone else. Skipping that too would leave
> the last frame of the burst lying there for the rest of the level.

### The burst has its own frame rate

```js
DEATH_BURST: {
  espeto: {
    from: 6, ms: [140, 210, 294, 224],
    shudder: { pose: 'airPunch', from: 5, to: 6, ms: 80, holdMs: 800 },
  },
},
```

**The shudder — o ouriço's tremidinha.** Before the burst, frames `from..to` loop
at `ms` for `holdMs`, inserted between the fall and the explosion. Asked for as
*"tem que repetir o frame, como se ele desse uma tremidinha, igual a bomba... esse
frame fica muito rápido"* — the six fall frames played once at 130ms each and he
was gone, so the moment he is visibly about to blow lasted a single frame.

> ⚠️ **It loops a RANGE; it does not hold one frame.** "Repetir o frame"
> describes the effect, not the mechanism — holding one drawing longer reads as
> the animation *stalling*. What makes the bomb read as live (the *"igual a
> bomba"*) is the picture changing while going nowhere: three drawings eight
> pixels apart on their own fast clock, `Prop._frame`.

> ⚠️ **`pose` lets the tremble BORROW a row, and it has to.** The right drawings
> are **row 4, sprites 6 and 7 of `espeto-sprites-fim.png`** (rows and columns
> counted from 1) — the hedgehog with its mouth wide open — and they are **not in
> the death row at all.** Row 4 *is* `airPunch`: its seven master widths match
> that anim to the pixel, so they ship as `airPunch` frames 5 and 6. **Reading
> the packed row tells you what the cutter produced, not what the artist drew for
> the moment** — a first pass picked death frames 3-5 and was wrong.

> ⚠️ **Borrowing is the tremble only.** The fall and the burst are untouched and
> `airPunch` as an attack is unaffected. No new art, no duplicated frames, no
> re-cut, nothing rescaled. A pack without the named pose falls back to its death
> row rather than drawing nothing.

> ⚠️ **An `external` attack box never drives the frame.** `frameStep` has an
> attack branch above its death branch, and the blast arms a box on the *corpse*
> — so for its 300ms window a dead espeto was drawn as death frame 1 (him
> writhing) between two explosion frames: *"another frame appears with him again,
> and then he blows up AGAIN"*. `_updateAttack` already ignored external boxes
> (somebody else owns that clock); `frameStep` does now too. **Older than the
> shudder that exposed it** — the old `atMs: 920` did the same thing where the
> burst's chaos hid it.

> ⚠️ **The pose and the frame are one decision (`_shudderNow`).** `frameStep()`
> opens by asking `pose()` and then branches on `p === 'airPunch'` for the jump
> arc — so a corpse borrowing that row would otherwise be handed the *arc's*
> frame index. Both halves come from one call.

| phase | frames | ms |
|---|---|---|
| the fall | 0-5 once at `POSE_MS.death` | 0 – 783 |
| **the shudder** | **`airPunch` 5-6 alternating, 80ms** | **783 – 1583** |
| the burst | 6-9 at their own pacing | 1583 – 2448 |
| the blast | `atFrame: 7`, 300ms window | 1720 – 2020 |

> ⚠️ **Everything downstream moves with it.** `deathAnimS` counts the shudder, so
> `corpseGone` keeps him alive the full 2.448s (it was 1.648s) — the same trap
> the burst's own slowdown hit. `holdMs` is the knob.

> ⚠️ **`hideBurst: true` — espeto's own explosion frames are switched OFF.** He
> blows up like the bomb: the fall and the tremble stay, his four burst drawings
> are never reached, and the body simply disappears on the same instant the boom
> fires (both hang on `deathFrameStartS(from)`, so a hedgehog and an explosion are
> never on screen together). `hideBurst: false` brings the old death back — which
> is why `ms` is kept below as dead config: it records how those four frames were
> paced and re-deriving it would cost a day for a flag flip.

> ⚠️ **`shudder.tint` is the bomb's red**, the same filter string as
> `PROPS.bomb.panicTint`, **copied rather than shared** — two objects that want
> the same colour today, and aliasing would tie this death to a future retune of
> the bomb. It blinks **one beat in three**, which is the bomb's number and is
> load-bearing: the tremble swaps drawing every `ms`, so a two-beat blink would
> light the *same* drawing every cycle and read as "one of his poses is red"
> rather than as flashing. Decided in the simulation, never in `draw()`.

A death row may **change pace part way through**. Every animation otherwise runs
at one rate (`POSE_MS[pose]`), which is right for eight frames of a body falling
over. ESPETO's row is two things end to end: six frames of him going down, then
four of an explosion — a different kind of event that wants a different clock.

**The principle is the flying dungeon's fly.** Its burst was never part of
another animation: `FLY_RECTS[1..4]` play on `flyBurstMs` (70), their own number,
and every frame is scaled by the factor derived from frame 0 — so because the
burst frames are drawn bigger on the sheet, the explosion visibly expands. The
second half is already true here for free (his burst tiles are 302px against a
~180px body, and the pack scale is one number). What was missing was the clock.

`ms` may be one number or one per frame. A list is what lets the **biggest frame
hold longest**, which is the specific thing that read as too fast.

> ⚠️ **The corpse has to live long enough to play it.** Slowing the burst took
> his death from 1.30s to 2.02s, past the 1.32s at which a body is reaped — he
> would have been deleted mid-explosion. `Fighter.corpseGone` now also waits for
> the death animation. Frames only, **not** `deathWatch` — that adds
> `deathHoldMs` (1000ms), which would leave every corpse in the game lying around
> a second longer.

> ⚠️ **`DEATH_BLAST.atMs` is derived from this table and nothing enforces it.**
> Re-time the burst and the blast is silently pointing at a different frame.

| frame | starts | held |
|---|---|---|
| 0–5 | 0 | 130ms each |
| 6 | 780ms | 140ms |
| 7 | 920ms | 210ms — **blast opens** |
| 8 | 1130ms | 294ms — the widest |
| 9 | 1424ms | 224ms |

### An explosion is anchored on its centre, not its feet

```python
('death', 9, 10, {'cut': 'columns', 'centreFrom': 6}),   # in the cutter
```

Frames from `centreFrom` on are anchored on their own **centre**, held at the
height the body's centre was — so a burst that grows frame by frame expands about
one unmoving point instead of walking across the floor. Every other frame in the
game is anchored on the ground it stands on; a burst has no feet, and its bbox
bottom drops as it expands.

> ⚠️ **`centreFrom` must agree with `CONFIG.DEATH_BURST.espeto.from`.** Same
> frame index, two files: the cutter decides which frames stop being a body, the
> game decides which slow down.

### A real explosion on top of the drawn one

```js
DEATH_BOOM: {
  espeto: {
    on: true, count: 1,
    atFrame: 6,                                   // <- the sync
    spreadXRel: 0, spreadYRel: 0, jitterRel: 0,   // one blast, dead centre
    baseYRel: 0.5, refPx: 180,
    sizePx: 208, sizeJitter: 0,
  },
}
```

The bosses' explosion (`boom.js`, `CONFIG.BOOM_SHEET`), **one of them**, going off
on top of the drawn burst. Keyed by `kind` like `DEATH_BURST` and `DEATH_BLAST`,
so anything not named here is untouched. Armed in `Fighter._armDeathBoom` at the
moment of death and drawn at the tail of `Fighter.draw`, over the sprite and
outside its alpha — a blast is not part of the corpse and must not fade with one.

> ⚠️ **No new effect code.** `boom.js` was extracted from horse-boss.js when the
> Mosca wanted the same death, with *how many / how far apart / how big* pushed
> into config precisely so a third caller would be free. It was.

> ⚠️ **"Sync" is `atFrame`, not a millisecond.** It hangs on death frame 6 — the
> first drawn burst frame — through `Fighter.deathFrameStartS`, the same clock the
> row is drawn from, so retiming the fall, the shudder or the burst moves the
> explosion with them. Frame 7 would put it on the widest drawing instead, which
> is where the *damage* lands but a beat after the picture says he has gone.

> ⚠️ **`deathFrameStartS` had an off-by-one on exactly this frame.** The guard was
> `i <= B.from`, so asking for the first burst frame took the plain-clock path and
> answered 780ms instead of 1580 — the boom would have fired 800ms early, over the
> tremble. Every *interior* frame was right, which is why it survived review; the
> blast's `atFrame: 7` never touched the boundary. Caught by printing the start
> time of all ten frames rather than checking one.

> ⚠️ **The corpse is kept alive for it** — `corpseGone` waits on
> `max(deathAnimS, deathBoomEndS)`. The boom ends at 2431ms against a row ending
> at 2448: seventeen milliseconds is not a margin. Third time this rule has been
> needed here, after the burst slowdown and the shudder.

> ⚠️ **One blast wants zeros, and `||` was eating them.** `spreadXRel: 0` /
> `spreadYRel: 0` silently became the seven-blast scatter. Fixed at the read site
> in `boom.js` with `!= null`; the horse's non-zero values are unchanged to the
> pixel. `baseYRel` was added so a single blast can sit on a torso instead of
> hugging the feet.

> ⚠️ **`refPx` is the DRAWN size (180), not `fighterSizePx` (136.8).** The latter
> is a nominal body height for the hit resolver; a blast has to sit on the picture.

**Timeline:** boom fires 1580ms · damage 1720ms · boom ends 2431ms · row ends 2448ms.

### The death blast

```js
DEATH_BLAST: {
  espeto: { atBoomPeak: true, activeMs: 300, damage: 8, knockdown: true, radial: true,
            reachX: 187 * BODY_SCALE, reachZ: 63 * BODY_SCALE, knockback: 240 },
}
```

**Frame 7, not frame 6.** Frame 6 is the first burst frame but it is a tight
starburst barely wider than the body — a hit landing on it reads as damage
arriving *before* the explosion. **The rule is "when it reaches you", not "when
it begins":** the 300ms window spans frames 7 and 8, the two widest drawings.
Timed off `deathT`, the same clock the row is drawn from, so the box and the
picture cannot drift.

> ⚠️ **`atFrame` asks the animation; the old `atMs: 920` told it.** 920 was
> 6 × `POSE_MS.death` + 140 — correct when written, and silently wrong the moment
> anything before frame 7 changed duration. The shudder is exactly that change:
> it pushes the explosion 800ms later, so a fixed 920 would have detonated him
> mid-tremble, damage landing a full second before the picture. `atFrame` runs
> through `Fighter.deathFrameStartS`, the same walk `_deathFrame` uses, so it
> moves by itself. **A number derived from an animation's pacing should ask the
> animation.** `atMs` still works for anything that wants a raw time.

> ⚠️ **`radial: true`** — every other hitbox in the game extends forward from the
> fighter only. An explosion that only went the way the corpse was facing would
> be the one hitbox a player could beat by standing behind it.

> ⚠️ **It hits the player only.** `crowdHits` never tests enemies against each
> other; friendly fire is new code in the resolver, not a number here.

> ⚠️ **`knockdown: true` is a design choice.** Nothing else a mook throws floors
> the player except the barata's charge. An explosion that merely stings is a
> tax; one that puts you down is a thing you step away from. `false` makes it a
> tax again.

### CHARUTOBI — the same three blocks, with the burst left ON

The suicide bomber (2026-08-28) reuses every mechanism above and changes one
thing: *"keep the frames from the spritesheet, so it will be like 2 explosions at
the same time."* So `hideBurst` is **absent** — this is espeto as he was the day
before he was asked to blow up like the bomb.

```js
CHARACTERS.charutobi: { drawScale: 0.6885, corpseFade: false, ... }

SUICIDE_RUSH.charutobi: { speed: 1.7, triggerX: 24, triggerZ: 34 }

DEATH_BURST.charutobi: { from: 7, ms: [60, 80, 110], hideAfterRow: true,
                         shudder: { from: 5, to: 6, ms: 40, holdMs: 800, tint: ... } }
DEATH_BOOM.charutobi:  { on: true, count: 1, atFrame: 7,
                         spreadXRel: 0, spreadYRel: 0, jitterRel: 0,
                         baseYRel: 0.46, refPx: 115, sizePx: 193 }
DEATH_BLAST.charutobi: { atFrame: 8, activeMs: 200, damage: 12, knockdown: true,
                         radial: true, reachX: 174 * BODY_SCALE,
                         reachZ: 59 * BODY_SCALE, knockback: 280 }
```

| phase | frames | ms |
|---|---|---|
| the fall | death 0-6 at `POSE_MS.death` | 0 - 910 |
| the shudder | death 5-6 alternating, red one beat in three | 910 - 1710 |
| the drawn burst | 7-9 at `ms` | 1710 - 1960 |
| the boom | one blast, 214px | 1710 - 2561 |
| the damage | `atFrame: 8`, 200ms | 1770 - 1970 |
| corpse reaped | | 2561 |

> ⚠️ **The burst was cut twice on 2026-08-28**: 670ms → 469 (×0.7) → **250ms**,
> 63% off the original, ~83ms a frame. That is the same order as the boom under
> it (`boomMs` 71), so the two come apart at one rate. **Below about 200ms total
> the three drawings stop being legible as separate pictures** — that is the
> floor. The tail-weighting (110 against 60) survives on purpose: equal holds
> read as three flashes rather than one thing expanding.

> ⚠️ **`activeMs` followed it down, 300 → 200, and it is not a rebalance.** Frames
> 8 and 9 now last 190ms between them; 300 would leave a hitbox live after the
> explosion had finished drawing. **A faster explosion has a shorter dangerous
> moment.**

> ⚠️ **The boom cannot follow, and the ask was not about it** — *"the character
> explosion, not the bomb one"*. Its rate is the global `CONFIG.boomMs`, shared
> with both bosses, so it runs ~600ms past the drawn spines and finishes as smoke.

> ⚠️ **Nothing downstream needed chasing, either time** — the damage window and the
> reaper both moved by themselves, because `atFrame` and `corpseGone` ask
> `deathFrameStartS` instead of carrying a millisecond.

> ⚠️ **He was shrunk twice (0.9 → 0.765 → 0.6885) and four measured numbers
> followed each time**: `reachX` 228→194→174, `reachZ` 77→65→59, `refPx`
> 150→127→115, `sizePx` 252→214→193. **`baseYRel` did not move either time, and
> that is the check the rest was done right** — it is a fraction of `refPx`, so it
> lands on the burst's new centre by itself. A ratio follows a rescale; an
> absolute number does not.

> ⚠️ **`hideAfterRow: true` — the drawn body goes when its row ends.** Without it
> the last burst drawing sat on screen for **733ms** against the 110ms `ms` asks
> for: `_deathFrame` clamps to the last frame, `corpseGone` holds the body for the
> boom, and `corpseFade` is off, so it froze at full opacity for the difference.
> **Nothing was slow — something was being held past its end.** It only affects a
> kind with this exact shape (death row ends in an explosion + fade off + a boom
> that outlasts the drawings); espeto's body is already gone via `hideBurst`, and
> every other corpse is taken away by the fade.

> ⚠️ **`triggerX: 24`, and the old 80 is what made him "stop in front of the
> player".** He was already seeking the player's own spot — the braking was
> entirely the trigger firing a body-width out (the two half-widths add to 53).
> 24 puts him inside the overlap. `triggerZ` stays looser at 34: depth is the axis
> a player dodges in, and a z trigger as tight as x would let a circling player
> hold him a hair out of range forever — a suicide bomber who never explodes.

> ⚠️ **`corpseFade: false` is LOAD-BEARING, not copied.** The fade reaches alpha 0
> at **1320ms** (`downLandMs` 520 + `corpseFadeDelayS` + `corpseFadeS`). His
> tremble starts at 910 and his first burst frame at 1710 — with the fade on, the
> red flashing dims out mid-blink and all three explosion drawings are painted at
> alpha 0. **Only the boom would have shown, which is espeto's death, which is the
> one thing this was asked not to be.** Any death row that plays past 1320ms needs
> this flag.

> ⚠️ **`from: 7`, not espeto's 6, and the extra frame is the SWELL.** Death frame 6
> is him puffing into a ball of spikes — still a body standing on the floor, and
> the best drawing in the row to tremble on. It must agree with `centreFrom: 7` in
> the cutter's row table.

> ⚠️ **The shudder is TWO drawings and the reason is the tint.** `_shudderTint`
> lights one beat in three, so a three-frame loop lights the *same* drawing every
> cycle and reads as "one of his poses is red". Two lets the red walk across both.
> He needs no borrowed row: unlike espeto, the drawings his tremble wants are in
> his own death row, so `pose` is left off and `_shudderNow` falls through to
> `death`.

> ⚠️ **`baseYRel` x `refPx` is a MEASUREMENT.** 0.46 x 150 = 69 drawn px up, which
> is where the cutter pinned his own burst — the centre of the swell frame, the
> point those three tiles expand around. Move either and the two explosions stop
> being concentric, which is what makes them read as one. `sizePx: 252` is 77% of
> his widest burst frame (328 drawn px), the ratio espeto's 208 has to his 271.

> ⚠️ **`atFrame: 8`, not `atBoomPeak`.** Espeto's damage moved onto the boom the
> day his own burst frames were switched off, and his note says in as many words
> that turning `hideBurst` off wants `atFrame` back. The rule has not changed:
> the hit lands **when the explosion reaches you**, and frames 8 and 9 are the two
> widest drawings.

## How hard everyone hits

```
COMBO damage   5 + 6 + 8 + 5 + 12 =  36 advertised   (raised 2026-08-22)
               5 +     8 +     12 =  25 ACTUALLY LANDS -- hits 2 and 4 are
               always inside the target's i-frames. See STATE.md.
player HP      110  x 3 lives

                    HP   speed   string              P(3 hits)   charge
DUDU      (cigarro)  34   0.88    3 + 3 + 5  = 11        30%        -
DIDI      (cigarro2) 40   0.72    4 + 4 + 7  = 15        20%        -
DEDÉ      (cigarro3) 55   0.58    6 + 6 + 10 = 22        20%        -
CLAUDINHO (barata)   50   1.05    4 + 4 + 6  = 14        50%       12 @ 15.4%/turn
ZIDANE    (barata2)  66   0.90    5 + 5 + 9  = 19        40%       15 @ 11.2%/turn
ESPETO    (espeto)   60   0.95    3+3+5+3+7  = 21         8%*       -   (the desert)
                                  * five hits, not three -- P(all five) is 1 in 12
CHARUTOBI (charutobi) 30  0.95*   NO PUNCH -- 12 on the death blast (the desert)
                                  * the walk-in only; his RUN is 1.7, absolute
```

**CHARUTOBI does not appear in that table properly because he does not fit it.**
He has no string, no weights and no `enemyDamage` entry: he runs at the player
and kills himself, and everything he can do is `DEATH_BLAST.charutobi` — 12
damage, a knockdown, radial, and it goes off whether he arrived or you killed
him. **30 HP is the lowest in the game and it is the fight**: his health is the
length of the window you get to stop him in. Move it before you move his speed.
See *Corpses, fading, and the one that explodes*.

**ESPETO throws the only FIVE-hit string in the game**, because his punch row is
ten drawings where every cigarette's is six. It is not five times the damage: 21
for the whole thing, a shade *under* DEDÉ's 22 over three hits, and no single
blow costs more than 7. **The length is the character, not the total** — and the
weights `[5, 3, 2, 1, 1]` mean he averages 2.2 hits and reaches the finisher one
time in twelve.

> ⚠️ **A missing `enemyComboWeights` entry caps the string silently.**
> `_rollChain` reads `min(weights.length, combo.length)`, so four weights on a
> five-hit string means two of his drawings are never seen in play.

**Everyone throws a combo now**, so `enemyDamage` is read for nobody — it is
kept as the number each string was balanced against. Damage is SPREAD, not
added: each enemy replaced one that swung once, and no single hit of a string
costs more than that swing did, so only eating the whole thing costs more.

**⚠️ The barata's second and third startups are 190ms, under `hurtMs` 260** —
the only ones in the game that are. His string is therefore hard to escape once
it has begun, which is what makes a fast enemy frightening rather than busy. If
it reads as unfair, move that number before his damage.

**⚠️ REACH MUST CLEAR THE STAND-OFF PLUS THE LAST HIT'S KNOCKBACK — AND YOU
MUST ADD THE TARGET'S HALF-WIDTH.** Enemies swing from `enemyStandoffX` (63.4px)
and do NOT step in between the hits of a string, and knockback of k moves the
player k/6 px. But the hit test is edges against half-widths, so a hit lands
while the centre gap is under **`reachX + bodyW/2`** — that is `reachX + 26.6`,
not `reachX`. Forgetting the 26.6 is what once produced a confident (and wrong)
claim in STATE.md that no cigarette had ever landed a second hit.

Measured properly: DUDU, CLAUDINHO and ZIDANE land all three. **DIDI and DEDÉ
miss their third by 1.7 and 6.2px** — their heavier mid-string knockback (130
and 140 against DUDU's 110) shoves the player out of their own finisher. That is
**deliberate and liked**; do not "fix" it.

**⚠️ Every number for both baratas is untested** — extrapolated from the
cigarettes, never watched in play.

**The pair is one gang with two tempos.** Each kept the stats of the enemy it
replaced — DUDU took JUIXY's 34 HP and 0.88 speed, DIDI took TOM's 40 and
0.72 — so the difference between them is tempo and weight, not a new system.
Every window in the stub's string is longer and every hit costs more, and his
weights lean shorter (`[5,3,2]` against `[4,3,3]`).

`enemyDamage` is **ignored for a kind that has a combo** — those hits carry
their own damage. Changing `enemyDamage.cigarro` does nothing.

How long a string he throws is rolled once, before the wind-up:

```js
enemyComboWeights: { cigarro: [4, 3, 3] }   // 1 hit : 2 hits : 3 hits
```

### He also jumps at you

```js
ENEMY_LEAP.cigarro   { pose:'airPunch', startup 420, active 200, recover 150,
                       damage 6, reachX 75, knockback 300 }
enemyLeapChance      { cigarro: 0.10, cigarro2: 0.05 }   // per TURN
enemyLeapMinX        90                // closest he will leap from
enemyLeapMaxX        520               // furthest he will leap from
enemyLeapMaxZ        34                // how lined up in depth he must be first
enemyLeapLandX       50                // px from the player he aims to land
enemyLeapMaxSpeed    2.6               // cap, as a multiple of walk speed
```

**`enemyLeapChance` is rolled once per TURN** — on the frame he is handed the
attack token — and that is the only place a per-turn decision may be made. The
same number evaluated per frame would be 10% sixty times a second: a certainty
inside two frames, and the ground combo would never come out again. It is a rate
of surprise, not a difficulty dial; it works because his ordinary approach is a
walk.

A turn that rolls a leap while he is already inside 90px is **not** re-rolled —
he walks in and throws the ground combo instead. The alternative is an enemy who
backs off to make room for a jump, which telegraphs it completely.

**`startupMs` is 420 for BOTH of them, and that is not laziness.** `verticalReach` is 70 and the jump
apex is 85, so a fighter at the top of his own jump *cannot reach the floor* —
an air attack timed to the apex passes through a standing player every time and
reads as broken hit detection. The hitbox opens as he drops back through the
reachable band (`p >= 0.69` of `jumpMs`, 429ms) and stays open until he lands.
**Retiming `jumpMs` or `jumpHeight` moves that band and this number has to move
with it** — for every kind at once, since they all jump on the same global arc.
What may differ per kind is the damage and the landing recovery: the stub hits
for 8 and is stuck for 260ms afterwards against the other's 6 and 150ms.

The leap **speed is derived, not set**: distance to cover ÷ time in the air, so
he lands beside the player rather than at a fixed hop length. He commits to a
lane before take-off and cannot steer — stepping out of it in depth is the
answer to the move.

Two rules worth keeping if you retune those defs. **No hit's startup may go
under `hurtMs` (260)** — a player stunned by hit one would otherwise be unable
to leave before hit two, and the whole string becomes unavoidable the moment it
starts. And **the last hit's recovery is the punish window**; at 460ms it is
more than double the others, which is the entire reason backing out of a string
is worth doing.

**Keep the player's HP a multiple of 22.** The hand-drawn life bar is 22 squares,
so 110 makes each square exactly 5 damage. The Mosca's HP is a multiple for the
same reason — and it is **110** as of 2026-08-27, raised from 88. That was asked
for as "+20%", which is 105.6 and not a multiple of anything: it would make a
square 4.8 damage, so identical hits would sometimes move the bar and sometimes
not. 110 is the multiple on the other side and was taken over the exact figure
deliberately. ⚠️ It is no longer the whole encounter either — she is fought
twice and comes back whole, so the player spends it 1.5 times over.

The full-combo total was held at 28 when the combo went from three hits to five,
deliberately — so every enemy's time-to-kill stayed where it was tuned. Raising
it is a real rebalance, not a tweak: at 40 damage a full string one-combos the
stub (40 HP), and at 34 it already one-combos DUDU.

---

## Sound

Three knobs and three pipelines.

| knob | what it does |
|---|---|
| `MUSIC_TRACK` | the looping bed, one file. Loaded under the key `music` |
| `BOSS_TRACK` | the boss room's song — 4m39s, played whole. Loaded under the key `musicBoss` |
| `TITLE_TRACK` | the title screen's theme — a 60s loop cut out of MIKE. Loaded under the key `musicTitle`. Unset = silent title screen |
| `MOSCA_TRACK` | **the Mosca's theme — Still Life's own soundtrack**, read in place out of that game's folder like her sprite sheets. Key `musicMosca`. Unset = she fights over the bed |
| `MUSIC_LAYERS` | **extra voices started with a track and stopped with it**, by track key. `music` gets `musicWhistle` (the whistle over the street bed). Each entry is `{ key, src }`; the manifest walks it |
| `MUSIC_LOOP` | **where each track wraps, by asset key** — `music` 5.115, `musicTitle` 60.107, `musicMosca` 14.452, `musicWhistle` 7.5735. NOT decoration; see below. A track with no entry loops at its own end (that is `musicBoss`) |
| `MUSIC_GAIN` | per-track level on the music bus, by asset key. **`music` 0.68** (the bed — 20% then a further 15%, 2026-08-24), **`musicMosca` 0.68** (tracks the bed), `musicBoss` 0.85, `musicTitle` **2.6** (MIKE is mastered quiet). Above 1 is allowed |
| `musicVolume` | 0.55 — the whole music bus. ⚠️ The bed **was** the fixed point everything else was derived against, until it came down 20% itself. `musicBoss` / `musicTitle` were levelled in absolute dBFS so they are unaffected; `musicMosca` **0.68**, the same trim as the bed — it measures level with it, so it tracks it. ⚠️ Move one, move the other |
| `SFX` | name → file. `sound.play('hit')` looks the name up here |
| `sfxVolume` | 0.9 — effects sit above the music on purpose |
| `SFX_GAIN` | per-effect trim, multiplied onto `sfxVolume` |
| `sfxHitDetune` | 0.045 — how much each combo link is pitched up. 0 = off |
| `sfxTakeHitRate` | 0.82 — the same punch sample, pitched **down**, for a blow the player *takes*. 1 = both directions sound identical |
| `GAME_OVER_STING` | how the death music is played; see *The game over panel* |
| `VICTORY_STING` | `{ on, musicFadeSec: 1.2, stopFadeSec: 0.4 }` — **the win, in two moments**. The horse's song rolls off when the walk-out starts; the fanfare (Still Life's, read in place) begins when the ending screen does. ⚠️ Played with `playOnce` so `frontEnter()` can stop it — at 10.7 s it outlives a skipped tally |
| `RESULTS.TICK` | `{ on, sfx: 'coin', ms: 90, rise: 0.25 }` — **the count-up tick**. Still Life's coin hit, once every `ms` for exactly as long as a number is moving, pitching up 1.0→1.25 across the roll. ⚠️ Stops at `resultsRollS`, not at the end of the board — the beat before the rank stamp has to stay silent |

`M` mutes everything, in every phase.

### The boss room's song

**Music is a property of the ROOM**, not of the boss in it: `ROOMS[n].music` is
an asset key, and `roomMusic()` in game.js plays it on every room entry. Only
one piece of music ever plays, so asking for one stops the other — and asking
for the one already playing is a no-op, not a restart.

**It has three states, and `false` is not the same as leaving it out:**

```js
// (no music field)     the level bed — the default, and what every room did until 2026-08-27
music: 'musicBoss',  // that track
music: false,        // NOTHING. The music stops on the way in and the room is silent
```

> ⚠️ **A falsy key does not mean silence.** `Sound.playMusic(key)` opens with
> `key || 'music'`, so `null`, `false` and `''` all reach it as *the bed* — that
> fallback is what makes `roomMusic()` safe for a room declaring nothing.
> Silence is decided in `roomMusic()` before the call, and nowhere else.

The desert is `music: false` — it is waiting on songs of its own.

> ⚠️ **It starts when the player walks in, not when the horse arrives.** It was
> hung off the boss spawning first, and the boss room opens with a wave of
> roaches — so the song only turned up once they were dead and the room's whole
> first fight played under the street's bed.

> ⚠️ **Nothing stops it.** By request it runs through the fight, the horse's
> death, the walk-out, the ending photograph and the tally, so the last thing
> the player hears is what they beat the game to. `toTitle()` is the only thing
> that ends it, because that is where the run ends.

> ⚠️ **`musicLoopSec` is the BED's crop and is not applied to it.** That number
> exists because the bed is six seconds long and a few ms of codec padding at
> the wrap is an audible tick; applied to a four-and-a-half-minute song it cuts
> it off after six seconds. `Sound._startIfReady()` guards it to the bed alone.

It is 4.5MB of mp3 — a fifth of the build again, and the one asset big enough to
notice. mp3 because that is how it was delivered; re-encoding to ogg would save
about a third if the build ever needs it.

**Taking a punch is the punch sample, on purpose.** It was asked for as "the
porrada noise when the player gets hit, like when he hits the enemies", so it is
the same recording rather than a second one — a fight should sound like one
fight. The pitch is what says which direction the blow went, and it is the only
cue in the fight that has no picture of its own: an enemy's swing stamps the
same impact burst the player's does. It fires from `Combat._takeHitSound()`, the
one place both damage paths (the crowd's swings, a boss's contact) meet. Do not
go far under ~0.7 — a 300 ms crack slowed that far becomes a thud, which reads
as something falling over.

**⚠️ `MUSIC_LOOP` must match the cuts.** `AudioBufferSourceNode.loop` with no
bounds wraps at whatever the decoded buffer turned out to be, and decoders
disagree about an Opus file's length by a few ms of padding. Left alone that is
a few ms of silence at every wrap — an audible tick. Re-cut a track and its
number moves with it; both cutters print the value to paste:

| key | file | cutter |
|---|---|---|
| `music` | `trilha-mix.ogg` | `tools/crop-beat-trilha.py` |
| `musicTitle` | `mike-title.ogg` | `tools/cut-song-loop.py` |
| `musicMosca` | the flying dungeon's `trilha-mix.ogg` | ⚠️ **not ours** — it is `loopMs` in `tools/music-lab.html`, that game's arrangement. Re-bake there and move this with it |

A track with **no entry** is not pinned and loops at the end of its own buffer.
That is right for a finished song (`musicBoss`) and wrong for anything cropped
to a downbeat — the map is keyed by asset key precisely so there is no rule to
get backwards.

**⚠️ You cannot make an effect louder by re-cutting it.** The clips are
normalised to −1 dBFS; a hotter render is a flatter one. Use `SFX_GAIN`. Past
about 1.3 it clips against the music rather than getting louder — turn
`musicVolume` down instead.

### Re-mixing the music

    python3 -m http.server 8000
    http://localhost:8000/tools/beat-music-lab.html

Every take loops against the bed; turn a layer **on** and it joins immediately.
`repeat` off turns a layer into one-shots you place by tapping **1–4** or
clicking its lane. The **ARRANGEMENT** box at the bottom is the JSON to paste
back over `DEFAULT_MIX` / `DEFAULT_MASTER` so the tool reopens on your mix.

Both `fit by rate` and `fit by loop` solve a layer that does not divide the loop
— the panel says in amber when one does not. Rate changes pitch as well as
tempo here (these are samples, not stems), so a couple of percent passes and ten
does not.

**⚠️ The shipped `trilha-mix.ogg` came from the tool's `export wav`, not from
`tools/bake-beat-trilha.py`.** That script does not currently reproduce the
browser's render and writes `trilha-mix-baked.ogg` so it cannot overwrite an
approved mix. See STATE.md for what is known about the discrepancy.

### Moving the loop points

The lab exports the ARRANGEMENT. Where the loop begins and ends is a second
stage, because the lab's `loopMs` opened at the bed take's whole file length and
1.2 s of that is the take's own dead lead-in and dead tail — put back to back at
the wrap, that was ~0.9 s of near-silence every pass:

    python3 tools/crop-beat-trilha.py --dry-run          # measure, write nothing
    python3 tools/crop-beat-trilha.py                    # 745 ms in, 3 bars
    python3 tools/crop-beat-trilha.py --start 745 --length 5195

| knob | what it is |
| --- | --- |
| `--start` | ms into the render where the loop begins. **745** = the attack of the bed's loudest hit |
| `--length` | loop length in ms. **5115** = three bars. This IS `CONFIG.musicLoopSec` |
| `--overhang` | ms of the cut event's ring faded back onto the head so the wrap does not click. 100 |

It reads `beat-trilha-mix.wav` (the full 6146 ms export, never overwritten) and
writes `trilha-mix.ogg`. `--dry-run` prints the longest quiet stretch in the
loop before and after, and the size of the seam step against its neighbours —
read both before shipping. The level is deliberately untouched.

**⚠️ Do not shorten the lab's `loopMs` to match.** The crop needs the material
outside the loop window to still be in the render it reads.

### Cutting a loop out of a song

For a finished track that is longer than the screen it plays behind — MIKE on
the title screen is 4m10s of song for a ten-second screen:

    python3 tools/cut-song-loop.py --dry-run
    python3 tools/cut-song-loop.py                          # MIKE, 28 bars
    python3 tools/cut-song-loop.py --start 113.737 --length 51.521
    python3 tools/cut-song-loop.py --src assets/beats.mp3 --out-name beats-loop

| knob | what it is |
| --- | --- |
| `--src` | the song. **Never overwritten** — MIKE is the main game's intro theme and `src/main.js` still plays it whole |
| `--start` / `--length` | seconds. Both should land on downbeats and `--length` should be a whole number of bars. **`--length` IS the `MUSIC_LOOP` entry** |
| `--overhang` | equal-power crossfade at the wrap, ms. 120. ⚠️ Keep it well under a beat or the downbeat smears |
| `--bitrate` | 96k stereo opus. MIKE: 7.4 MB → 812 KB |

**How the cut points were found** (the script's header has the detail): onset
flux → autocorrelation for the tempo, comb the flux for the downbeat *phase*,
then score every (downbeat, whole-bar-length) pair by how alike the music is at
`S` and at `S+L` on a 24-band log spectrogram. A loop's seam works when the
music arriving at the end sounds like the music about to begin.

**⚠️ The seam is crossfaded here, unlike the bed.** `crop-beat-trilha.py` sums
the tail onto the head, which works because that bed's head is a downbeat with
near-silence in front of it. A song has no silence anywhere, so summing leaves
the step exactly where it was — measured, an 18× jump against the neighbouring
samples, which is a click.

#### The enemy's reaction — `enemyHit`

Layered **under** the punch on the two blows that knock down (the finisher and
the air attack). `enemy-hit-1.ogg`, cut.

- **Triggered by `box.def.knockdown`, not by the move's name**, so a third
  knockdown attack gets it for free.
- ⚠️ **Two gates, asking different things.** `t.scores !== false` is "is this a
  fighter" — the same test the kill counter uses, and without it a finisher that
  caught only a crate would grunt for a crate. `t.voiced !== false` is "does
  this one make noises about it", and it is how **both bosses stay silent**:
  they take the punch sound and nothing else, because a boss is announced by its
  own art, its own bar and its own death. Properties on the target rather than
  `kind` tests, so a third boss is silent by declaring it.
- ⚠️ **Once per swing**, not once per body — three grunts in one frame from a
  sweep is one flanged grunt. Same rule as the punch sound.
- `SFX_GAIN` **0.7**, about 3 dB under the blow that caused it: the punch is the
  event, this is the answer.
- **`CONFIG.ENEMY_HIT_SFX` is a pool**, rolled per knockdown. One entry today:
  `enemy-hit-3` was the second grunt for an hour before becoming the hero's
  voice. Left as a list because a second is one entry there and one in `SFX`,
  with nothing in `combat.js` to touch. ⚠️ The roll happens **on the event**,
  never per frame — the same rule the impact art follows.

#### The hero's voice — `PLAYER_HIT_VOICE`

`enemy-hit-3`, under the pitched-down punch, on the hits that **knock him
down** — `box.def.knockdown`. The same rule the enemies' grunt follows.

The pitched punch (every hit) is the same recording he hears when *he* connects
— deliberate, so the fight has one vocabulary — but pitch alone is a thin way to
tell the two directions apart in a crowd. The voice is what says *who* was hit,
and being bowled over is the moment worth one.

**Four attacks knock the player down — but only one reaches the voice:**

| | | |
|---|---|---|
| `BARATA_CHARGE.knockdown` | the rolling ball, through the roach waves | **voice** |
| `HORSE_BOSS.chargeKnockdown` | his charge | strike only |
| `HORSE_BOSS.kickKnockdown` | his kick | strike only |
| `FlyBoss`, `knockdown: ambush` | the Mosca's ambush pass | strike only |

> ⚠️ **`bossHits` passes `false`** — both bosses come through one function and
> both were grunting. A boss's blows already announce themselves: the Mosca's
> ambush drops you for no damage at all as its entire point, and the horse's
> charge has a wind-up you are meant to read. A voice under either is one cue
> too many on the loudest moments in the game. Putting them back is one
> argument.

#### The white hit flash — `hitFlash`

**`false`.** Fighters (mooks *and* the player) no longer whiten when hit. The
two **bosses still do** — their `flash` lives in `FlyBoss` / `HorseBoss`, which
do not extend `Fighter`, so this knob cannot reach them.

> **The asymmetry is the point.** A fighter announces a hit three other ways —
> the flinch pose, the knockback, and a grunt if it was floored. The bosses have
> **no hurt art at all** (`horse-boss.js` says so at the top, "confirmed rather
> than assumed"), so the flash is the only thing that tells you a punch landed
> on one. Taking it off everybody else is what turns it from decoration into
> their tell.

The machinery stays — `flash` is still a field, still decays, still reaches
`sheets.draw`. One boolean brings it back.

#### The hero's death cry — `PLAYER_DEATH_VOICE`

`enemy-hit-2`, cut. On the blow that kills him, **in place of** the knockdown
voice — the killing blow also floors him, so both would fire on one frame. The
strike still plays; he was still hit.

> ⚠️ **Not the same thing as `GAME_OVER_STING`.** That is *music*, it stops the
> bed, and it only happens on the **last** life. This is a voice, it plays on
> **every** death, and when they do coincide they are a beat apart — this one on
> the blow, that one once the death has finished being watched.

`SFX_GAIN` **0.47**, which is the *same* level as the other three voices, not a
quieter one: this cut measures −10.8 dBFS where they land at −14.2 to −14.6, so
it is 3.4 dB hotter as a file.

**And `enemyDeath` on the blow that kills** — `enemy-hit-4-oof`, cut.

- ⚠️ **It replaces the knockdown grunt, it does not stack with it.** The blow
  that kills also knocks down, so both tests pass on the same frame, and two
  vocal samples from one body at once is a mess.
- ⚠️ **Read on the transition** (`!wasDead && t.dead`), not on `dead` alone — a
  body stays dead for its whole fade, and a sweep clipping one would announce a
  death that happened seconds ago.
- **A thrown barrel gets it too** — a death should sound like one however it
  arrived. `hitIds` already guarantees one visit per enemy per throw.
- ⚠️ **Bosses are silent** (`voiced: false` on `FlyBoss` and `HorseBoss`) — the
  punch lands, the cry does not.

### Cutting a new sound effect

    python3 tools/build-beat-sfx.py enemy-hit-1              # the loudest event
    python3 tools/build-beat-sfx.py combo-2-5-hits --event last --out combo-finish2
    python3 tools/build-beat-sfx.py combo-1-4-hits --event all --dry-run

**⚠️ A sound borrowed from another game usually still needs cutting.**

    python3 tools/build-beat-sfx.py coin-tick --src assets-v2/flying-dungeon/audio/coin-hit-01.ogg

`--src` reads the take from anywhere in the repo; `name` then only decides what
the cut is called. That file looks like a finished effect and is not one — it
holds a quiet first event and then the actual coin **672 ms in**, so playing it
raw ticks two thirds of a second late. The cut is 340 ms.

The cut always lands in **this** game's `audio/sfx/`, even when the take came
from elsewhere: a cut is a new file, not a view of the original, so it cannot be
read in place the way the Mosca's sheets and her music are.

Takes come from `assets-v2/beatemup-dungeon/audio/`, cuts land in `audio/sfx/`.
Always `--dry-run` first: it prints every event it found with its timing and
peak, and picking the right one is the whole job.

| flag | for |
|---|---|
| `--event` | `loudest` (default), `last`, `all`, or a 1-based number |
| `--out` | output name, when the cut is part of a take |
| `--gap` | ms of quiet that still belongs to the same event |
| `--range` | dB below the file peak that still counts as sound (default 40) |
| `--margin` | dB above the measured noise floor (default 12) |

**⚠️ Do not use `tools/build-sound.py` on these.** It trims silence off both
ENDS and keeps everything between them — right for a musical take, wrong for a
recording that holds a second quiet event, which several of these do.

Wiring a cut effect is two lines: an entry in `CONFIG.SFX`, and a
`sound.play('name')` where it should be heard.

## The front door: two screens

```
loading bar ──► LOGO ──(3s, or a press)──► TITLE ──(a press)──► the fight
```

**`src/logo.js`** — the crawling vermin with the SABOROSA logo over them, then
it hands to the BATIDÃO DE CÔCO title.

| knob (`CONFIG.LOGO`) | what it does |
|---|---|
| `on` | `false` opens straight on the title, exactly as before this screen existed |
| `onRestart` | `false` — a run that ends goes back to the TITLE, not through the logo again |
| `SHEET` | the logo, read in place out of the flying dungeon's folder |
| `wRel` / `yRel` | 0.52 / 0.5 — width as a fraction of the canvas (height follows), and its centre |
| `holdMs` | 3000 — it leaves on its own after this. **0 = wait for a press** |
| `armMs` | 250 — before a press counts. See below |
| `fadeInMs` / `fadeOutMs` | 400 up out of the loading bar's black, 600 down into the title |

**This screen was deleted on 2026-08-21 and asked for again on 08-22** — in
*front* of the photograph this time rather than instead of it. It cost one 30KB
file, because neither asset was ever removed: the frames are the game over
panel's and the logo had been sitting unused since July.

> ⚠️ **It auto-advances and the title after it does not.** That asymmetry is the
> whole reason two screens is not two things to dismiss: the logo is a label
> being shown to you and it leaves on its own; the title is where the game waits
> for you. Making both wait would mean two presses to reach a game that used to
> take one.

> ⚠️ **`armMs` exists because this is the FIRST screen of the session.**
> Everywhere else a press is taken from frame one, on the argument that anyone
> who has seen a screen once must be able to leave it at once. Here, a key still
> down from launching the game would blow through it before it had drawn twice.

**The vermin are `CONFIG.VERMIN_FRAMES`, one list for two screens**, loaded once
under `vermin0..2`, and the *draw* is shared too — `GameOver.renderBackdrop()`.
Sharing the draw rather than copying it means the front door and the game over
panel can never end up on different frames of the same animation, or drift apart
if the art is recut. (Still Life makes exactly this split, for exactly this
reason.) The manifest gates the load on **either** consumer, so turning the game
over panel off does not take the front door's backdrop with it.

## The title screen

### The fruit select

The title screen runs the character select as **stages of itself**, not as a
second screen — there is no cut, the photograph is held throughout, and the walk
at the end is the walk the title has always had, now carrying whoever was chosen.

```
name    the title falls in and waits to be pressed      (unchanged)
lift    the name accelerates up and off the top          SELECT.liftMs
        …a beat of empty screen…                         SELECT.gapMs
ask     ESCOLHA SUA FRUTA falls in, the picture fades
        up, left/right pick                              titleDropMs / SELECT.artFadeMs
chosen  the choice is held, then the prompt lifts and
        the picture fades                                SELECT.chosenHoldMs + liftMs
walk    the chosen hero crosses                          (unchanged)
```

**Controls:** ← / → highlight, any other button confirms. **The left one
(LEBRON) is highlighted when the screen opens** — `SELECT.defaultPick: 0`.

**Three pictures, `CONFIG.SELECT`:** one per hero plus one with nobody
highlighted, keyed **by pack** (`PICKED.coconut`, `PICKED.coconutStrong`) rather
than by slot.

> ⚠️ **The COLOURED coconut is the selected one; the flat yellow one is the
> reject.** The wash is *brighter* than the character's own colours, which reads
> as a highlight and is not one — it was got backwards once already. If the
> pictures ever look inverted in play, this pair of lines in `SELECT.PICKED` is
> the whole of it.

> ⚠️ **`NONE` is no longer reached in normal play.** It is kept as the fallback
> when a hero's own picture fails to load — a missing highlight must cost the
> highlight, never the ability to choose — and `defaultPick: -1` brings it back
> as the opening state. At -1 a confirm does nothing, because an unanswered
> select must never quietly mean "the first one".

> ⚠️ **The art decides the layout.** LEBRON is drawn on the left of the picture
> and IPANEIMA on the right, so ← and → mean the ends of `CONFIG.PLAYER_PACKS`
> and **the two must agree**. Reorder that list without redrawing the art and the
> highlight points at the wrong figure — which looks like an input bug, not a
> list one. A third hero needs a fourth picture, not a code change.

### The confirm punch

Confirming stamps the picture and shakes the panel — **the main game's own
character-select "lock-in"** (`src/screens/select.js` in the repo root), numbers
copied rather than re-tuned: pop 1.25 → 1.0 on an easeOutBack over 400ms, plus a
9px shake decaying over 180ms at 82 / 71 rad/s. `SELECT.PUNCH.on: false` removes
it.

> ⚠️ **It stamps the whole picture, not the chosen coconut** — and that is the
> art, not a shortcut. The main game stamps one fruit because its art is a row of
> separate panels it can clip to; ours is a single drawing of two coconuts whose
> arms overlap. Measured: the thinnest column between them still carries **385
> rows of ink out of 1087**. There is no line to clip on, and a split would slice
> an arm mid-pop.

> ⚠️ **The shake moves the panel and the type, never the photograph.** The main
> game's `intro.js` says why: *"Background and readability darken sit UNDER the
> shake so screen edges never reveal gaps when the foreground jolts."*

> ⚠️ **The main game's trailing fade-to-black is deliberately not copied.** There
> it covers a hand-off to a synchronous stage load; here the hand-off is the
> chosen coconut walking across, which is the thing that was asked for.

> ⚠️ **The beat has to fit inside `chosenHoldMs`.** The pop settles at 400ms
> against a 500ms hold, so it is over before the prompt lifts. Drop the hold
> below the stamp and the pop is cut off mid-bounce.

> ⚠️ **A direction edge beats an any-press on the same frame, and that is the
> only thing that makes this usable on a pad.** On a keyboard the arrows return
> out of `input.js`'s keydown handler before `_anyPress` is set, so they can't
> confirm. On a **gamepad every button sets it, d-pad included** — deliberately,
> so a player hunting for "press anything" doesn't have to find the right button.
> Without the rule, nudging the d-pad would move the highlight *and* commit it in
> one frame.

> ⚠️ **Re-cutting the pictures needs `--no-crop`.** The masters are 7249×4924 /
> 3.1 MB; the `-game.png` copies are 1600×1087 / 0.62 MB, cut with
> `tools/shrink-master.py --max-dim 1600 --no-crop`. The tool crops to the opaque
> bounding box by default and **the three have different bounding boxes**
> (6821 / 6885 / 6886 px wide — the highlighted body reaches further), so cropped
> they each land on their own geometry and the coconuts **jump** every time the
> selection moves. Uncropped they are all 1600×1087 and cannot disagree.

**Rollback:** `SELECT.on: false` gives the old screen to the frame — a press
sends the Tab-chosen hero walking and the game begins. It also drops the three
pictures from the manifest, so nothing is downloaded for a feature that is off.

A photograph of a wall. The name **falls in from off the top of the frame** on
the first frame, and once it has landed **LEBRON walks across the picture**, in
from the left and out to the right. Any button starts the fight — from the first
frame, before any of that has finished.

| knob | what it does |
|---|---|
| `title` | `false` goes straight into the fight |
| `TITLE_BG` | the photograph. Drawn **cover** — it is 4:3 on a 16:9 canvas, so about an eighth is cropped off top and bottom |
| `titleDropAtMs` | 0 — when the fall starts. 0 is the first frame |
| `titleDropMs` | 900 — how long the fall takes. ⚠️ Reads faster than it looks: the fall accelerates, so most of the distance is covered in its last third |
| `titleBouncePx` | 12 — how deep it overshoots on landing. **0 turns the bounce off *and* switches the fall back to eased-out** |
| `titleBounceMs` | 460 — how long it takes to settle |
| `titleBounceCycles` | 1.5 — one dip, one smaller rise back. 2+ starts to jiggle |
| `titleDropFromRel` | 1.0 — how far above its resting place it starts, in screen heights |
| `titleNameFadeMs` | 0 — the drop *is* the entrance. Set it for a fade over the top of it |
| `TITLE_NAME` / `TITLE_SUBNAME` | the two lines. First is heavy and large, second is a gloss under it |
| `TITLE_FONT` | **the flying dungeon's lettering stack**, copied from its `overTitle.family` — heaviest Futura cuts first, geometric stand-ins after |
| `titleNameWeight` / `titleSubWeight` | 900 and 400. The weight difference *is* the hierarchy |
| `titleNameLsPct` / `titleFauxBoldPct` | 3% letter spacing and a 1.5% stroke, both from the same block |
| `titleNameSize` / `titleSubSize` / `titleNameGap` | type sizes and leading, in canvas px |
| `titleNameY` | 0.26 — centre of the block down the canvas. High, because the wall is palest in its upper third |
| `titleNameColor` | `#FAFA30` — the flying dungeon's end-panel yellow, so the two games match |
| `titleFadeOutMs` | to black, once dismissed |

### LEBRON crossing it

| knob | what it does |
|---|---|
| `titleWalk` | `false` and the screen is just the photograph and the name |
| `titleWalkAfterMs` | 250 — ⚠️ **the earliest he may set off**, not when he does. The walk waits for a press (2026-08-24) |
| `titleWalkExitXRel` | 1.06 — **where he counts as gone** and the fade begins. He keeps walking to `titleWalkEndXRel` (1.12) underneath it |

> ⚠️ **The press starts the walk; the walk ends the screen** (2026-08-24). The
> name lands, the screen waits, a press sends him across, and the game begins by
> itself once he is off the edge. One press, and it *buys* the walk rather than
> skipping it. A press made during the drop is **remembered**, not ignored —
> `go` is set and spent the moment the name lands, so he never walks out from
> under falling type.
>
> ⚠️ **The crossing is 7.2 s, and it is now a wait.** 1587 px at
> `titleWalkSpeed` 210. Nobody sat through it before — the walk was scenery and
> any press left immediately — but it is now the whole distance between a click
> and the fight. The 210 is the **ending's** speed so the two walks match, and
> there he only goes to the centre (~3.5 s); raising it here breaks that
> pairing. Shorten the crossing instead (`titleWalkStartXRel` / `ExitXRel`) if
> it needs to come down.

| `titleWalkStartXRel` / `titleWalkEndXRel` | −0.12 / 1.12 — off one edge and clear of the other |
| `titleWalkSpeed` | 210 px/s, the ending screen's, so the two walks match |
| `titleWalkGroundYRel` | **derived, not chosen**: `(beltTopY + beltDepth * playerStartZRel) / 720` = 0.8806. His feet land exactly where they are on the frame the fight starts (y 634). Was 0.93 — 36 px too low. ⚠️ Written as the arithmetic so moving the belt or the spawn depth carries this with it |
| `titleWalkScale` | 1.0 — **exactly his size in the fight** |
| `titleWalkRepeatMs` | 0 — he crosses once. Set it to a gap in ms and he comes round again; a crossing takes about 7 s |

**The bounce and the fall are one move, not two.** With `titleBouncePx > 0` the
fall *accelerates* — it is falling — and the bounce is what absorbs it. With the
bounce off it eases *out* instead, decelerating into place. ⚠️ Mixing them (ease
out, then bounce) reads as two unrelated moves back to back: the type has
already arrived, and then something shakes it. `_dropP()` picks the easing off
that one knob, so you cannot get the mismatched pair by accident.

The bounce itself is a damped sine that starts **downward**. That order is the
read: it arrives, overshoots into the surface, springs back past the line and
settles. Started upward it would leap on contact, which is a flinch rather than
a landing. The damping is squared, so the second dip is much smaller than the
first — at linear decay the two are close enough in size to read as a wobble.

> ⚠️ **He is drawn, not simulated.** Two numbers and a frame clock reading the
> same packs the fight reads — never a `Player`, which is a belt entity with
> depth, a camera, gates, an attack machine and a life total, none of which
> exists on a photograph. `ending.js` makes the same call and its header argues
> it at length. The cost is that this walk is not `Fighter.update`; if the two
> ever visibly disagree, that is why.

> ⚠️ **`titleWalkScale` 1.0 is the house rule, not a default.** A character who
> changes size between screens stops reading as the same character. If he needs
> to fill more of the frame, that is a crop of the photograph — same argument
> `ENDING.scale` makes, where it cost a 1.55 that was wrong on sight.

**The title screen plays MIKE** — the main game's intro theme — since
2026-08-24. ⚠️ This reverses a decision, at the user's request: the *whole*
4m10s song was wired here on 2026-08-22 and removed the same day for not suiting
the screen. What plays now is a **60s loop cut out of the fullest part of it**
(105.1–165.3s of the original), which is a different thing on a screen the
player sees for ten seconds. `CONFIG.TITLE_TRACK`; unset it and the screen is
silent again. See *Cutting a loop out of a song*.

> ⚠️ **It starts on the TITLE, not on the logo** (2026-08-24) — the logo is
> silent. `frontEnter()` stops what the level was playing; `titleMusic()` starts
> the theme, from the three places the title phase can begin.
>
> A cold boot works because the title's press now starts the **walk** rather
> than dismissing the screen: no page can play audio before the visitor has
> interacted, and the press both unlocks the context and leaves seven seconds of
> crossing for the theme to play over. It used to be asked for on the logo
> purely to work around that, back when the press left the screen immediately.

**It used to hold the bare photograph for two seconds** before fading the name
up, on the argument that a picture given time reads as a place while type cut in
at zero turns it into a background. That was overruled on 2026-08-22 — the title
drops in immediately now. `titleDropAtMs` 2000 with `titleDropMs` 0 and
`titleNameFadeMs` 320 is roughly the old screen if it is ever wanted back.

> ⚠️ **No drop shadow, nothing darkened under the type.** House rule for every
> title screen in this project. If the type stops reading, move it to a cleaner
> part of the wall — do not shade the photograph.

**The face is the flying dungeon's**, so the two games' lettering matches — same
stack, same 900 weight, same 3% tracking, same faux-bold stroke. **Futura is not
bundled in either game**, so most machines fall through to Century Gothic, URW
Gothic or Jost; that is a known open problem over there, inherited here. The
stroke exists because those fallbacks are lighter than the cut the design
assumes — without it the words come out visibly thinner on a machine with no
Futura. The stack is **duplicated, not imported**: each game's `config.js` is
self-contained (same as the two sound pipelines and the two cutters), so change
the face in both or neither.

It used to be the **flying dungeon's crawling vermin panel** with the SABOROSA
logo over it, read in place out of that game's folder. Both are gone from this
screen as of 2026-08-21. The logo is still at
`v2:flying-dungeon/saborosa-logo.webp` if it is ever wanted back — that is a
draw call, not a rebuild.

## The baratas

`drawScale` **2.3194** for both, and it got there in four requested steps rather
than by measurement: 1.452 (the cigarettes') × 1.3 × 1.3 × 0.9 × 1.05. Both
sheets cut to an identical 167.8 px body, so the pair is drawn at one number and
there is no ratio to preserve between them.

> ⚠️ **Their reaches have never moved with it**, and that is the standing warning
> on `drawScale`: it is drawn size only. The hurtbox, the punch boxes and the
> charge lane are global or per-attack numbers and none of them knows about it,
> so the picture is now well wider than the boxes underneath it and a swing that
> looks like it grazed one will miss. If that reads wrong in play the fix is
> `ENEMY_COMBOS`' reaches, **not** this number.

Six rows, not the cigarettes' eight — no jump and no knockdown, because a
cockroach does neither. What they have instead is the charge.

    python3 tools/build-beat-enemy-defs.py barata
    python3 tools/build-beat-enemy-defs.py barata2

| row | frames | note |
|---|---|---|
| 1 idle | 4 | |
| 2 walk | 5 | |
| 3 combo | 5 | frame 0 is a guard; **1, 2, 3 are the punches**; 4 is spare |
| 4 hurt | 2 | both cycle |
| 5 death | 3 | frames 1–2 are the hurt pair again — they dedupe to one tile |
| 6 ball | 5 | frame 0 is the tuck, 1–4 spin |

Their `combo1..3` are **one drawing each**, which is why they need per-character
pose overrides — the shared table slices a combo row into wind-up/strike pairs
and would cut every one of these punches in half. `down` borrows the death
row's last frame, the roach on its back.

### The charge — `CONFIG.BARATA_CHARGE`

| knob | what it does |
|---|---|
| `chance` | per **turn**, not per frame. 0.154 / 0.112 |
| `curlMs` | 260 — the tell, and the player's reaction window; the two are the same thing by construction. Halved from 520, which read as a stall. Much lower and the charge stops being answerable |
| `speed` | 3.4 × walk. Nothing outruns it; step out of the lane |
| `damage` | 12 / 15, and it knocks the player down |
| `reachZ` | **the real difficulty dial** — widen it and the move becomes unavoidable |
| `returnMs` | 1500 / 2100 off-screen. This is what the move costs him |
| `minX` / `maxX` | the band he will charge from |
| `exitMarginPx` | how far past the wall counts as gone |

## The flies in the sky

`src/flies.js`, `CONFIG.FLIES`, art borrowed from **Still Life** — the small fly
its swarm is drawn from, read in place out of `assets-v2/flying-dungeon/` like
the Mosca's sheets and the explosion. Added 2026-08-23.

**They are scenery.** No health, no hitbox, no hurt window, no death, no `z`, no
shadow, nothing in the crowd and nothing in `stats`. They cross the band *above*
the belt — the part of the shot the fight cannot reach — **two right-to-left and
one left-to-right** (2026-08-24).

| knob (`CONFIG.FLIES`) | what it does |
|---|---|
| `on` | **`true`. The feature switch** — `false` and the sheet is not even loaded (`manifest.js` gates on it) |
| `count` | **2**. How many cross **right to left**. ⚠️ A *population*, not a rate — see below |
| `countRight` | **1**. How many cross **left to right**. Same rule. Drop this to 0 before touching `count` — the two-leftward baseline is the approved one |
| `sizePx` / `sizeJitter` | **39 px ±12% → a 34–44 px band** (2026-08-24). ⚠️ Read as a *range*, not a size. Was 30 ±28% (22–38 = small/medium/big); the small end was cut (→ 34 ±12%), then the whole band moved up ~15%. ⚠️ Know which axis you are tuning: the **floor** needs both numbers solved as a min/max, the **centre** is `sizePx` alone |
| `topY` / `bottomY` | 64 / 404 — the band, in *screen* y. ⚠️ Both must stay well above `beltTopY` (520) |
| `speed` / `vSpeed` | 118 / 165 world px/s. Each leg rolls 0.55–1.55× of `speed`, always in that fly's own direction |
| `retargetMin` / `retargetMax` | 0.22 / 0.85 s — how long a heading is held. **This is the erratic dial** |
| `wobbleAmp` / `wobbleFreq` | 4 px / 13 rad·s⁻¹ — the fast micro-buzz on top of the wander |
| `maxTilt` / `tiltEase` | 15° / 9 s⁻¹ — how far and how smoothly it banks into a climb or dive |
| `marginPx` | 140 — how far past each screen edge one lives before it is recycled |
| `alpha` | 0.92 — a touch back, so they sit *into* the plate |

### Layering a second voice over a track

The whistle plays **over** the street bed as its own looping source — not baked
into it. Two `AudioBufferSourceNode`s started at the same scheduled
`currentTime`, each pinned to its own length.

```js
MUSIC_LAYERS: { music: [{ key: 'musicWhistle', src: 'v2:.../whistle-song.ogg', gated: true }] }
MUSIC_LOOP:   { music: 5.115, musicWhistle: 7.5735 }
MUSIC_GAIN:   { musicWhistle: 0.64 }
```

> ⚠️ **The "no mixer at runtime" rule does not apply, and this is why.** That
> rule is inherited from the flying dungeon and it is about `<audio>`
> **elements** — three of those started together drift apart within a minute.
> Music here plays through `AudioBufferSourceNode`, which is sample-accurate by
> specification and scheduled against **one** audio clock. Two of them started
> at the same `currentTime` cannot drift; there is no second clock to drift
> against. The constraint was never about layering — it was about the element.

> ⚠️ **A layer need not divide the track's loop.** The music lab flags one that
> doesn't, because it *renders* to a single file and the remainder splices onto
> the head. Nothing is rendered here: each voice loops itself cleanly and the
> two phase against each other. 7.5735 s over 5.115 s means the whistle is never
> in the same place twice — which on this soundtrack is the feel, not a fault.

#### The whistle is the baratas' sound — `WHISTLE_GATE`

`gated: true` means the voice starts **silent**. It comes up while a `barata` or
`barata2` is alive on screen and fades out again when the last one is gone.

| knob | |
|---|---|
| `kinds` | `['barata', 'barata2']` |
| `marginPx` | 160 — ⚠️ **not slop.** They *walk in* from off the edge; a bare screen test would snap the whistle on mid-arrival |
| `fadeSec` | 0.45 both ways |

> ⚠️ **The voice is never started and stopped, only faded.** Restarting it would
> play the melody from its first note every time a roach walked on, and would
> throw away the one property the layer exists to have — it is locked to the
> bed's clock and phases against it. Riding the gain means it surfaces *wherever
> it happens to be*, which is a layer coming out of a mix rather than a cue
> being triggered.

`whistleGate()` is asked **every frame**, and that is correct: a gate reading the
world has to be, and `setLayerOn` is a no-op when it is already where it is being
asked to go. That is the opposite of `bossMusic()`, which *is* edge-triggered —
because its other branch calls `roomMusic()` and would fight the boss room's
theme every frame. It is called from `update()` rather than `loop()`, so only
the play phase moves it.

**Rules the implementation keeps:**

- **Every layer must be decoded before anything starts.** A layer that arrived
  late would begin at whatever moment its decode finished — the one thing the
  arrangement exists to prevent.
- **…but an optional voice can never hold its track hostage.** A failed decode
  is remembered (`failedDecode`) and the bed plays without it. Otherwise a
  broken whistle means a silent street.
- **Layers stop with the track.** They ride the same bus, so the fade takes them
  down — but nothing would ever *stop* them, and the bus comes back up for the
  next track. A whistle left running under the boss theme is what that looks
  like.
- **Each layer's level is its own gain node**, not the bus — the bus carries the
  main track's trim and `stopMusic()` resets it.

### Who owns a track — room, or boss

Two rules, and the difference is which one the player experiences as the change.

| track | scoped to | starts | stops |
|---|---|---|---|
| `music` (the bed) | the **room**, by default — any room with no `music` field | walking through the door | when a room asks for something else, or for `music: false` |
| `musicBoss` (the horse) | the **room** — `ROOMS[2].music` | walking through the door | ⚠️ **when the winning walk-out starts** (`VICTORY_STING`, 2026-08-24). It used to run through everything to the title — that was an explicit request and it was explicitly reversed |
| `musicMosca` (Still Life) | the **boss** — `FlyBoss.musicKey` | she flies in | ⚠️ **when she dies *or breaks off*** — the street gets its bed back |
| *nothing* (the desert) | the **room** — `music: false` | — | the bed is stopped on the way in |

**The horse's is room-scoped because his room opens with a wave of roaches.**
Hanging it on the boss made it arrive a minute late, with the room's first fight
playing under the street's bed.

**The Mosca's is boss-scoped because she is a sub-boss mid-street.** The bed is
already playing, she flies in, and *the switch is the event* — there is no room
change to hang it on. She declares `musicKey`; the horse declares nothing, which
is what "his theme belongs to the room" looks like from the outside. `game.js`
`bossMusic()` is the whole of it — edge-triggered, so it cannot fight the boss
room's theme every frame.

⚠️ **It reverts on `dead`, not on `finished()`.** She has a death fall and a
fade to play out; waiting for those would leave her theme running over her own
corpse.

⚠️ **And on `fleeing`, for the same reason.** She survives her first encounter
(see *The Mosca leaves and comes back*), and her theme belongs to the **fight**,
not to her: held until the segment cleared her away, it played over an empty
street. The bed coming back is also the clearest signal the player gets that the
fight is over rather than paused.

### He walks on at the start of a run

`CONFIG.playerEnterPx` (360, 0 = off). His centre starts 140 px off the left
edge and he walks to his mark in 1.2 s.

- **`state: 'enter'` does the gating**, and it already existed — `canAct()` and
  `vulnerable()` have always tested for it, so the controls are dead and nothing
  can hit him with no new check anywhere. Nothing had ever *set* it before.
- ⚠️ **The pose had to be taught.** `walk()` only promotes `idle` → `walk`,
  which is what keeps `enter` meaning "not yours yet" — so `pose()` returned
  `idle` and he slid on. One line in `pose()`.
- ⚠️ **The walk passes no bounds.** He starts outside the left gate; clamping
  would teleport him to the wall on frame one.
- **It measures from where he would have stood**, so it is called *after* the
  DEV room jump in `start()` — the jump is what puts him on his mark.

### ⚠️ A locked camera freezes the backdrop

The plate is `kind: 'video'` and `_drawVideo` scrubs it from **camera position
only** — when the camera stops, it pauses the element. So a fight that locks the
camera shows one frozen frame for its whole duration.

`setMode('plate', 'play')` does **not** save you: it only touches a source of
kind `film`, and the plate is a `video`, which has no 'play' mode. That call has
been a no-op for as long as the plate has been a video.

**The escape hatch is `lock: false` on the segment** — the camera follows the
player and the footage runs. Both segments in the boss room have it (the roach
wave and, since 2026-08-24, the horse).

> ⚠️ **Do not add it to the Mosca's segment.** She computes her fly-in from the
> camera *at spawn*, so a camera that moved afterwards would land her somewhere
> that is no longer mid-screen — and the street cannot seek backwards anyway
> (keyframes eleven seconds apart, which is why `allowReverse` is the boss
> room's alone). Her backdrop does still freeze during her fight; that is the
> same cause and needs a different answer.

### The crowd — three rings

| ring | who | where |
|---|---|---|
| attacking | up to `maxAttackers` (**3**) | closing in / swinging |
| **understudy** | the nearest without a turn | `enemyReadyRadius` **180**, half orbit speed |
| the rest | everybody else | `enemyCircleRadius` **210**, and they **wander** — `ENEMY_STROLL` |

Every 4–9 s an enemy in the outer ring walks to the far end of the arena from
the player and comes back, so the back of the crowd is not a carousel. ⚠️ The
destination is fixed when it sets off; a stroller can still be handed a turn
(`stroll` is not in the token's skip list), which is the "coming back to check
the fight" half of it.

The middle ring is what stops a freed slot costing a walk across the arena — at
one radius, "nearest" was still 210 px away and the fight breathed in and out.
130 is close enough to step in and still outside `enemyStandoffX` (63), so the
understudy reads as *waiting* rather than crowding.

> ⚠️ **The understudy is sticky** — held until that enemy takes a turn, is hit,
> goes down or dies. Rechosen every frame it ping-pongs between the two nearest
> candidates, and since the flag moves your target radius by 80 px, *both* of
> them lurch between 130 and 210 on alternate frames. That is the jiggle bug
> again, one function away from the fix for it.

> ⚠️ **`maxAttackers: 3` is a difficulty change and the HP table has not moved.**
> This file's own note calls 3 "a beating". It lands on a player whose finisher
> sweeps and whose air attack launches, so judge them together.

**The jiggle had THREE causes** (all fixed 2026-08-24), and each fix made the
next visible:

1. **The orbit direction** — see below.
2. **The understudy flag**, rechosen every frame: it ping-ponged between two
   equally-distant candidates, and the flag moves your target radius by 80 px.
   Sticky now.
3. **The ring radius**, read fresh from the `ready` flag: a promotion
   teleported the target 30 px inward, so any flag change lurched the enemy
   between two circles. `ringR` is eased state now (`enemyRingEase`).
4. **`_seek`'s 1 px arrive threshold** — a deadzone by another name. The orbit
   is an *ellipse*, so the target's speed varies: 1.35 px/frame at the sides,
   **0.47 at the ends** — under the threshold. The understudy stopped dead at
   the two ends, the target crept past 1 px, he stepped onto it and stopped
   again. 0.05 px now.
5. **`walk()` can only move at one speed.** A deadzone does not smooth a follow,
   it *quantises* it — the understudy's target moves at 81 px/s against a walk of
   192, so he sat in the 10 px band for seven frames, jerked 3.2 px, and stopped.
   That is why it was the *fourth* guy: his target is the slowest. `_seek()`
   scales the step down to close the gap exactly instead. ⚠️ It passes the **raw
   delta** to `walk`, not its sign — `walk` normalises, so `(±1, ±1)` makes a
   fighter one pixel out in depth walk a full diagonal and flip back.

**Cause 1** — the orbit direction was
`this.z > player.z`, a direction derived from a position the orbit itself moves
— crossing the player's depth line flipped the sign, which walked the enemy back
across it. `orbitDir` is fixed now, dealt out **alternating by `Crowd.add`**.
⚠️ Seeding it from the spawn position was tried and clumped: all five of the
first arena's cigarettes came out the same way round.

### The bomb

The other half of a barrel's contents, and **it is a `Prop`** — `Bomb extends
Prop`, so it is lifted, carried, thrown, tumbled and reaped by exactly the code
a barrel is. Three overrides: the fuse, the smash, and the frame.

**It goes off four ways, and only the last is its own code:**

| | |
|---|---|
| thrown into an enemy | `combat.propHits` → `smash(true)` |
| thrown, lands on nothing | `Prop.update`, `jumpY <= 0` → `smash(true)` |
| punched where it lies | `Prop.hurt`, `hp <= 0` → `smash(false)` |
| **the fuse runs out** | 8 s, wherever it is |

| knob (`PROPS.bomb`) | |
|---|---|
| `sizePx` | **82** (15% down from 96) — `Prop` derives the hit box from it, so there is no second number |
| `fuseMs` | **8000** |
| `throwSpeed` / `throwDamage` | 700 / 8 — faster and flatter than a barrel; the *blast* is the damage |
| `blastR` | 150 px on the floor plane, **depth weighted ×2** |
| `damage` / `knockback` / `lift` / `knockdown` | 18 / 380 / 150 / true |
| `smashMs` | **1200** — must be ≥ the burst (1121 ms) or the explosion is reaped mid-draw |

> ⚠️ **The fuse runs while it is held.** Picking one up starts a countdown you
> are now carrying, and the throw is how you spend it. Pausing it in his hands
> would make holding a lit bomb the safest thing in the game.

> ⚠️ **It hurts the player too** — that is what makes the 50/50 a gamble and the
> throw a decision rather than a free attack. `Props._blast` is the one place to
> change it. Bosses are not in the *blast* (not in `crowd`) but they **are** hit
> by the throw: `propHits` already concats the boss.

> ⚠️ **`throwDamage` cannot be 0.** `combat.js` reads it as `C.throwDamage || 22`
> — the falsy trap this codebase documents in four other places.

- **`smash()` releases the holder first.** `Prop.smash` nulls its own `holder`
  and stops, which is fine for a barrel because nothing smashes one in your
  hands. A bomb does, every time the fuse wins.
- ⚠️ **`bomb` and `bomb2` are the two FACINGS, not two variants** — fuse to the
  right and fuse to the left. They are hand-drawn views, **not mirrors** (the
  coil and the highlight differ, and the anchors sit at 41% / 59% of the frame),
  so `_frame` picks the *row* from the facing and `draw` passes the pack's
  native side. Letting `sheets.draw` flip one would leave the other unused.
  A resting bomb rolls a facing at birth; carrying or throwing it overwrites it
  with the thrower's.
- **The fuse animation is spread across `fuseMs`**, so the spark reaching the
  casing *is* the detonation.
- **The last 3 seconds panic**: the fuse goes 75 ms → **40 ms** a frame
  (`animPanicS` / `animPanicMs`) and a **red glow blinks** with it. ⚠️ A *step*,
  not a ramp — a threshold is something you can notice; a gradual acceleration
  is only visible in hindsight, by which time it has gone off.
- ⚠️ **The red blinks on the sprite's own frame counter**, not a clock of its
  own — painted on step 0 of the three-frame cycle, so it pulses at exactly a
  third of whatever the fuse is flickering at (**8.6 blinks/s**, 34% of the
  time) and follows `animPanicMs` if that moves. Given its own timer the two
  would drift in and out of phase and read as two effects rather than one alarm.
- ⚠️ **The bomb itself is painted red — not a glow around it.** A halo went in
  first and was wrong. `sheets.draw`'s `flash` pass can't do colour (it is
  `lighter` with the sprite as its own source, and adding a black bomb to itself
  adds nothing), so this is a **masked fill**: the frame is drawn into a shared
  scratch canvas, `source-in` replaces every opaque pixel with flat red, and the
  silhouette is blitted over the bomb. Fuse and spark included.
- ⚠️ **Skipped during the hoist.** `Prop.draw` shifts `drawY` while a prop is
  being lifted, and this pass draws at the plain ground point — rather than copy
  that arithmetic somewhere it could drift, the red just doesn't paint for those
  640 ms. The wick is still flickering.
- ⚠️ **No explosion sound yet** — there is no boom in `CONFIG.SFX`.

### Which rooms get them

`flies: true` on the **room**, the same way `music` and `props` are room data:

```js
{ name: 'street', plate: 'plate', flies: true, ... }
```

The boss room does not have it, and that was the request — it is indoors, and a
fly wandering through the last fight is one more thing to read on a screen that
already has a horse on it. `Flies.enterRoom` is called wherever
`props.enterRoom` is: `start()`, the DEV room jump, and the room fade at its
blackest point.

### How the motion works

A fly is a leftward fly or a rightward one for its whole life — `dir` is rolled
once at layout and kept, across recycles, exactly like `size`. Rightward flies
are the same fly with every x term negated, drawn h-flipped (the art has a nose
and it points left). ⚠️ The mirror is applied *before* the rotate in `draw`,
because flipping the axes also flips the sense of the bank; rotate first and the
rightward flies bank into their dives.

A fly holds a heading for a fraction of a second and then picks another. The
horizontal component is **always** its own way, so the wander can never carry one
backwards; the vertical dart flips sign freely and is what makes the path look
erratic. It bounces off the top and bottom of the band, banks into whichever way
it is going, and buzzes on top of all of it.

Reach the left margin and a fly is **recycled** to just past the right one, at a
fresh height with a fresh heading — everything about it is re-rolled except its
size, which is what keeps it the same fly. So they read as a procession crossing
the shot rather than as a couple of fixed paths on a loop.

> ⚠️ **`count` is a POPULATION, not a spawn rate.** The recycle happens on the
> same frame the fly leaves, so `count` flies are in the band at *all* times and
> no gap ever opens — it is literally "how many can be seen at once". It was 3
> and that read as an infestation; **2** since 2026-08-23.
>
> **If 2 is still too many, this is the wrong knob to keep turning.** At 1 the
> sky is empty for most of a crossing and then has a fly in it, which reads as a
> bug rather than as sparseness. Making them genuinely *infrequent* means a fly
> waiting off-camera before it re-enters — a gap between crossings, which is a
> frequency — and nothing here does that yet.

They live in **world x** at parallax 1.0 (the fighters' axis) and **screen y**,
because the band is defined against the canvas — there is no "up" in world
coords in this game, only `beltTopY`.

> ⚠️ **The recycle test is against the SCREEN, not against a world number.** The
> camera travels several thousand px across the street; a fixed world bound
> would recycle every fly at the same place in the level. There is a second test
> the other way for a camera that moves *left* out from under one.

> ⚠️ **Still Life's `src/fly.js` is 430 lines and this is 200.** Everything that
> file carries beyond the steering is there to be *shot* (health, i-frames,
> knockback, a burst, a corpse that lands on a pile) or to be *rewound* (the leg
> memory, the death snapshot). A beat 'em up has neither gun nor clock. Do not
> port the rest of it across looking for parity.

> ⚠️ **Only the sheet's FIRST rect is used.** The other four are the fly coming
> apart, and nothing here can kill one.

### Where they sit in the stack

A layer, between the plate and the fighters:

```js
{ name: 'plate',    source: 'plate', parallax: 1.0 },
{ name: 'flies',    flies: true },
{ name: 'fighters', entities: true },
```

In practice they overlap nothing — except a jumping coconut at the back of the
belt, who should pass in front of something up by the rooftops.

They tick **above the phase machine**, in `play`, `outro` and `fade`, because the
walk-out and the room fade are both seconds long and both are watched. They stop
with hitstop and on death, because the world does. They take nothing and change
nothing, which is the whole licence for ticking them outside it.

## Barrels and food

`src/prop.js`, `CONFIG.PROPS`, art in `CONFIG.CHARACTERS.barril`. Placed by hand
per ROOM (not per segment) in `CONFIG.ROOMS[n].props`:

```js
props: [
  { kind: 'barrel',  x: 620,  z: 55 },
  { kind: 'coxinha', x: 1900, z: 105 },
  { kind: 'chicken', x: 460,  z: 110 },
]
```

`x` is world space, the same axis the enemies use; `z` is belt depth (0..210). A
barrel at an arena's x is IN that fight; one 200px short of it is on the way in.

**Two barrels in the whole game, and both are in the boss room.** The street had
four; they were removed on request on 2026-08-23 (*"remova todos os barris na
fase principal, mantenha somente na boss room"*), after two earlier thinning
passes had already taken the level from eleven to six. The four entries are
**commented out, not deleted** — where they went took two passes to decide, so
uncommenting is how they come back.

The two drumsticks in the street are untouched: food is its own feature and was
not part of the request.

> ⚠️ **Where the mechanic is taught moved with them.** The barrel at x 1450 sat
> in the opening walk on purpose — the lift and the throw were learned somewhere
> nothing could hit back. The first barrel a player now meets is on the floor of
> the last fight.

> ⚠️ **Barrels are most of the food you actually see** — or they were. At
> `dropChance` 0.35, two barrels are worth well under one extra chicken, so the
> DEV readout's dropped count is now almost always 0 in the street. Count with
> that readout (`2+1 food` = placed + dropped), not with the config.

### The barrel

| knob (`PROPS.barrel`) | what it does |
|---|---|
| `on` | **`true`. The feature switch — `false` removes barrels from the game entirely** |
| `hp` | 5 — **one punch**, and every punch in the game does at least 5 |
| `sizePx` | 110 — drawn height, and what the hit box comes off. ⚠️ Must agree with `CHARACTERS.barril.drawScale` (0.8 × 137) |
| `hitWRel` / `hitZ` | 0.8 / 46 — hurtbox, as a fraction of `sizePx` and in belt px |
| `liftRangeX` / `liftRangeZ` | 74 / 46 — how close he has to be. Generous across, tight in depth |
| `carryYRel` | 0.70 — height of the barrel's **base** while carried, in bodies (96px) |
| `LIFT_ARC.startRel` | 0.3 — how much of the reach passes before the barrel moves (he is still reaching down) |
| `LIFT_ARC.bulgePx` | 34 — how far the path bows above a straight line. This is what makes it an arc |
| `LIFT_ARC.spinDeg` | 90 — upright to flat, over the same window |
| `throwSpeed` / `throwLift` / `throwGravity` | 520 / 120 / 900 — fast and flat, about two thirds of a screen |
| `throwDamage` | 22 — the hardest single blow in the game (a full 5-hit combo is 36) |
| `throwKnockback` / `throwLiftHit` / `throwKnockdown` | 260 / 90 / true |
| `throwReachY` | 130 — ⚠️ how high off the floor it still connects; without it a barrel sails over a head and knocks him down from above it |
| `throwPierce` | `false` — it breaks on the first enemy. `true` carries it through the crowd, a much stronger move |
| `spinMs` / `smashMs` | 90 per tumble frame; 480 for the three break frames |
| `dropChance` | 0.35 — how many barrels have **something** in them. ⚠️ Only reached by PUNCHING one apart; a thrown barrel gives up its contents |
| `bombChance` | 0.5 — and of those, how many are a **bomb** rather than a chicken. So a barrel is 17.5% chicken, 17.5% bomb, 65% empty. ⚠️ Both rolls happen **at birth**, not at the break |

**A placement can overrule both rolls.** On a `ROOMS[].props` barrel entry:

```js
{ kind: 'barrel', x: 430, z: 110, drops: true }               // always something
{ kind: 'barrel', x: 430, z: 110, drops: true, dropKind: 'bomb' }  // always a bomb
{ kind: 'barrel', x: 620, z: 165, drops: false }              // always empty
```

The first test barrel at the top of the street has `drops: true` — at the real
35% you would break four barrels to see one chicken, and that barrel exists to
be broken the moment a run starts. The *kind* is still the honest 50/50.

> **`CONFIG.pickupButton` is `true`.** It was switched off on 2026-08-24 and
> back on the same day. The off pass cost nothing to reverse because the
> machinery was left behind the flag rather than deleted — the lift arc, the
> carry, the throw, `propHits` and the `lift` / `liftThrow` / `carryWalk` poses
> were all still correct, and restoring the whole verb was one boolean.
>
> ⚠️ **It does not clash with food**, which moved to the *punch* button in
> between: punch stoops for food (and throws a held barrel), pickup lifts and
> puts down. The two verbs never wanted the same button.

### The pause screen

**ENTER**, or **START** on the pad. `CONFIG.PAUSE` — `on: false` removes it.

- **Only reachable from the `play` phase.** Pausing a title, a walk-out or the
  results board is meaningless or unhelpful, and every one of those already
  reads "press anything", which Enter is.
- **It is a flag, not a phase.** The play phase has a segment, a crowd, a camera
  and a boss mid-anything; a phase change is the one thing in `game.js` that has
  repeatedly torn state like that in half. `play` stays `play`.
- **Read above everything, including the hitstop return** — otherwise the press
  gets swallowed for a few dozen ms after every punch.
- **The world is drawn, not advanced.** `render()` under a `drawCard` wash, so
  you see the frame you stopped on. ⚠️ And it schedules a frame — leaving
  `loop()` without one is this game's recurring bug, and on a pause screen it
  would look exactly like a pause screen.
- **The press is flushed both ways**, so a punch buffered before the pause does
  not fire on resume.
- **The sound stops with it** — `Sound.setPaused()` suspends the whole
  **AudioContext**, effects included. ⚠️ Not `stopMusic()`: that releases the
  source, so resuming means `playMusic()` from **zero**, which would rewind the
  horse's 4m39s song to the top on every pause. A suspended context freezes its
  own clock, so every voice picks up on the sample it stopped on and the whistle
  keeps its phase against the bed. ⚠️ `_resume()` had to learn about it — it is
  bound to keydown for the autoplay unlock, so the very press that opens the
  pause screen would otherwise un-suspend it a moment later.

`PAUSE.LINES` is the text — line 0 is drawn big, the rest evenly. It is **just
`['PAUSA']`**: a control list was put here and taken back out the same day.
⚠️ **The card appends its own line when dev mode is on** (and after the code
turns it off) — see *Unlocking it in game*. It appends to a **copy**: pushing
onto `CONFIG.PAUSE.LINES` itself would stack a `SABOROSA MODE ON` per pause.
⚠️ Which means the game now tells the player nothing about its controls
anywhere — a decision made twice, in two places, in one day. The itch page is
what is left.

**Controls:** *pickup* (L / E / pad B) lifts a barrel in range — or **puts down**
the one he is holding. *punch* (J / Z / Space) **throws** it.

> ⚠️ **The throw plays `carryThrow`, not `liftThrow`.** The illustrator's row is
> a complete pick-up-*and*-throw — reach, reach forward, arms up, swing,
> follow-through — and **frame 1 is a fist punched straight forward**. Played
> from the top while he is already holding a barrel it replayed the grab, so
> pressing throw threw a punch and *then* heaved. `carryThrow` is frames 2–5:
> arms up, swing, follow-through. If a future sheet re-cuts that row, re-check
> where the arms-up frame lands. He cannot jump
while carrying one; there is no drawing of it.

> ⚠️ **`dropChance` is rolled when the barrel is BUILT, not when it breaks.**
> A barrel either has a chicken in it or it does not — which is what "os barris
> podem conter um frango" describes. Rolled at the break, the same barrel could
> answer differently if anything ever broke it twice.

> ⚠️ **A barrel is not solid.** Everything walks through it. Nothing in this game
> has body collision — fighters pass through each other, which is what keeps a
> five-enemy crowd from wedging the player against a wall — and one solid object
> in a world without collision is where a player gets stuck. Making it solid is
> a mechanic for everything, not a flag on this.

> ⚠️ **One punch is deliberate.** The resolver only ever hits the NEAREST target,
> so a barrel standing between the player and an enemy eats a blow meant for the
> enemy. At two punches every barrel becomes an ambush instead of a thing you
> smash on the way past.

### The hoist

The barrel rides an arc from the floor to over his head across the whole reach
(`PICKUP_MS.heavy`, 640ms — passed in, so the barrel and the animation cannot
drift apart), turning 90° onto its side as it goes. **It used to teleport**: it
sat still for the reach and appeared above him on one frame.

Two things in there that are not obvious:

* **It draws the `side` frame rotated *back* upright, not the upright frame
  rotated forward.** The sheet's side row is the upright row turned a quarter
  turn, so either would look right in motion — but ending on the `side` frame at
  0° means the hoist finishes on exactly the frame the carry uses, with nothing
  to blend. The other way round leaves a seam at the moment it settles, which is
  the moment you are looking at it.
* **Rotating needs the position corrected with it.** A frame is placed by its
  anchor (the base), and rotating about the *middle* swings that anchor away —
  at 90° it lands a half-height to one side, so the barrel draws 40px off from
  where it is. `draw()` works on the centre instead and converts back; at
  `liftQ` 1 the arithmetic collapses to plain `groundY()`, which is what makes
  the handover to the carry exact.

`sheets.draw` grew `pivotY` for this — how far above the ground point to rotate
about. Absent it is 0, which is the old behaviour and still what the horse's
tip-over wants (it falls about its feet).

**A held barrel is not a position, it is an owner.** It reads its x and z off the
holder every frame rather than being pushed around by him — otherwise it
desynchronises the moment anything else moves the player (knockback, the
walk-out, a room fade) and stays where he was.

**`player.carrying` and `prop.holder` are one relationship stored twice**, and
every path that ends a hold must break BOTH ends (`Prop._release()`). Three ways
to orphan a barrel were found and fixed on the day it was built; STATE.md lists
them. If a barrel ever follows the player around invisibly, this is the family.

### Turning barrels off

`PROPS.barrel.on: false`. That is the whole of it, and it was built in on
2026-08-22 against the possibility that the mechanic does not survive
playtesting.

None are laid out, so nothing can be punched apart, lifted or thrown, and the
pickup button goes back to a stoop at empty air — exactly what it did before
barrels existed. Three things it deliberately does **not** do:

* **It does not take the food with it.** Drumsticks are placed by hand and are
  their own feature. What does go is the chicken that would have been *inside* a
  barrel, because there is no barrel.
* **It does not delete the placements.** `ROOMS[n].props` keeps its barrel
  entries, unread. Turning them back on is the same one line.
* **It does not unload the art.** Barrels and food are one sheet.

The gate is in `Props.add()` — the one funnel every prop goes through, including
the chicken a break leaves behind — rather than in the room layout, so nothing
added later can slip past a switch that is supposed to mean "there are no
barrels in this game".

### The food

| knob (`PROPS.food`) | what it does |
|---|---|
| `chickenRel` | 0.5 — half the visible bar (55 HP of 110) |
| `coxinhaRel` | 1/3 — a third of it (37 HP) |
| `rangeX` / `rangeZ` / `rangeY` | 52 / 40 / 60 — reach, and not while jumping over it |
| `bobPx` / `bobRate` | **0 — food sits still.** It bobbed at first and read as not being able to decide whether it was on the floor. Drawn-only either way: `z` never moves, so what can be reached does not breathe |

**Walked over, never picked up with the button.** The button lifts barrels; two
verbs on it means the player who wanted the barrel gets the chicken next to it.
**And it is not eaten at full health** — it stays on the floor rather than being
wasted on the way past.

> ⚠️ **The heal is capped, not banked.** Anything past a full bar is lost; it
> does not roll over into restoring a life. That was asked as a question and
> this is the answer chosen (2026-08-22) — `Pickup.update()` is the one place
> that clamps.

### Re-cutting the sheet

```
python3 tools/build-beat-prop-defs.py barril
python3 tools/build-beat-prop-defs.py barril --dry-run
```

Nine bands off `barril-coconutbash.png` → 29 tiles, 808KB. Three things in that
tool that are not obvious, all argued in its header:

* **It cuts on INK BANDS, not on bodies**, unlike `build-beat-enemy-defs.py`.
  Half this sheet is a barrel exploding; frame three of a break is forty loose
  splinters and not one of them is a "body". Connected components find 200
  frames where the table says 30.
* **The sheet has invisible ghosts on it.** Four bomb outlines in
  near-transparent white sit at the right of the first two rows — ~280 opaque
  pixels against a real frame's 30000. They do not show in a viewer and a column
  scan finds them. `MIN_INK` drops them; the gap to the smallest real frame is
  38×.
* **The anchor is the base, not the bbox centre.** A break expands from 235px of
  barrel to a 572px cloud and does not expand symmetrically — anchored on the
  box centre the pile visibly walks a third of a barrel sideways as it grows.

**The repeats are the illustrator's and are not a mistake.** The four upright
barrels are two drawings and their MIRRORS; rows 4-5 are those two rotated onto
their side; rows 2-3 are the same three break drawings twice. Do not delete rows
from the table to "clean it up" — the table is what proves the sheet has not
changed under us. (Dedupe folds pixel-identical tiles, but not mirrored ones:
the defs have no per-frame flip flag, and `sheets.js` mirrors whole draws by
facing.)

The sheet also carries **six frames of a lit bomb**, cut and named (`bomb`,
`bomb2`) and wired to nothing. There is no bomb mechanic; the art is there for
when there is one.

## Adding an enemy kind

**⚠️ A kind needs an entry in BOTH `ENEMY_COMBOS` and `enemyComboWeights`.**
With a string but no weights, `Enemy._rollCombo` returns 1 and it throws exactly
one hit forever. Nothing errors. It reads in play as "that one has no combo".

The full checklist: `CONFIG.CHARACTERS` (+ `poses` if the sheet differs),
`enemyHealth`, `enemySpeedScale`, `enemyDamage`, `ENEMY_COMBOS`,
`enemyComboWeights`, and a wave to put it in. `assetManifest()` walks
`CHARACTERS`, so the build follows on its own.

**⚠️ A kind with NO attack skips half of that, and CHARUTOBI is the one.** He has
no `ENEMY_COMBOS`, no `enemyComboWeights` and — deliberately — **no `enemyDamage`
entry at all**, because his only damage is `DEATH_BLAST.charutobi`. Writing
`charutobi: 0` there would be worse than leaving him out: the read site is
`CONFIG.enemyDamage[kind] || 6`, so the zero comes back as **6**. What he needs
instead is `CONFIG.SUICIDE_RUSH`, and `Enemy` gives `this.rush = null` to every
kind that is not in it, so no test for the kind exists anywhere in `enemy.js`.

**⚠️ And if the new kind's death row plays past 1320ms, it needs
`corpseFade: false`.** The fade reaches alpha 0 there — `downLandMs` 520 +
`corpseFadeDelayS` + `corpseFadeS` — and anything the death draws after that is
painted at alpha 0 with nothing to say so. Both exploding enemies carry the flag;
espeto's was asked for on looks and has been hiding the arithmetic ever since.


## The coconut's sprites

The player has a sheet drawn for this game, and so does **the cigarette** — see
the next section — and so does his partner, the stub. Only ERKPA is still on a
main-game 9x5 pack, so `sheets.js` carries both formats until he is redrawn too.

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
| 7 | levanta objeto | 4 | `lift` — the heavy hoist, wired to pickup (⚠️ **unreachable** while `pickupButton` is false) |
| 8 | levanta e joga | 5 | `liftThrow` — **cut, not wired** |
| 9 | pega do chao | 2 | `pickGround` — the stoop. **Now wired to the PUNCH button, over food** |
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

**The lift mechanic went all the way in and then back out.** This paragraph used
to say it was half wired, with `_liftTargetHeavy()` returning false and nothing
to pick up — ⚠️ **that has been stale since barrels landed on 2026-08-22**; the
method is gone and the whole verb (find, hoist along an arc, carry, throw,
`propHits`) was built and shipped.

It is now switched **off** instead: `CONFIG.pickupButton` is `false` as of
2026-08-24, so L / E / pad B does nothing. All of it is intact behind that one
flag — see *Barrels and food*. `pickGround` is not orphaned by it, because
taking food plays that stoop off the **punch** button.

---

## The cigarettes' sprites

**They replaced JUIXY and TOM wave for wave.** The orange and the tomato are
gone from the cast and their packs are no longer loaded; every `kind: 'laranja'`
in the level is now `kind: 'cigarro'` and every `kind: 'tomato'` is
`kind: 'cigarro2'`, each with the HP, speed and placements it inherited.

### Cutting the sheets

```
python3 tools/build-beat-enemy-defs.py cigarro      # from the REPO ROOT
python3 tools/build-beat-enemy-defs.py cigarro2
```

```
assets-v2/beatemup-dungeon/cigarro-sprites-fim.png   the illustrator's file
  ->  cigarro-beat-game.png       packed atlas, 40 unique frames for 44 slots
  ->  cigarro-beat-sprites.json   per-frame rects, anchors, bodyH, animations
```

A further villain sheet is a new entry in that tool's `SHEETS` table — source,
output name, which way it faces, its atlas scale, and the row list. Nothing else.

**Match the tool's printed `body` figure, not its `SCALE` constant.** The two
sheets are drawn at different sizes, so `cigarro2` carries `'scale': 0.42` where
`cigarro` uses the shared 0.49; both land near 170px of body, which is what
keeps the sprite downscaled on screen and the texture near the coconut's.

Same failure rule as the coconut's cutter: it **fails loudly** if the body count
or a row's frame count does not match, rather than cutting something plausible
and wrong.

### The 8 rows

**Both sheets have the same eight**, same counts, same order — the illustrator
drew the pair to one plan, which is why the second entry in `SHEETS` is a copy
with two paths and a scale changed.

| row | meaning | frames | animation |
|---|---|---|---|
| 1 | idle | 3 | `idle` |
| 2 | andando | 6 | `walk` |
| 3 | pulando | 6 | `jump` — cut; he never jumps without punching |
| 4 | pulando e socando | 7 | `airPunch` — **wired**, the jump-in |
| 5 | socando | 6 | `combo` — 3 wind-up/strike PAIRS, his string |
| 6 | apanhando | 2 | `hurt` — both frames **cycle**, they do not hold |
| 7 | cai e levanta | 6 | `knockdown` — sliced by phase, see below |
| 8 | morrendo | 8 | `death` |

His punch row needs no pose entries of its own: `combo1`/`combo2`/`combo3` in
the shared `POSE_RAGGED` already slice a row into pairs, and his three pairs land
on them exactly. **Those three entries are now read by two characters with
different rows behind them** — worth knowing before editing them.

### The knockdown row is three poses, not one

Row 7 falls over *and* stands back up, which the coconut's does not. So it is
cut by the knockdown PHASE, in `CONFIG.CHARACTERS.cigarro.poses`:

| pose | frames | driven by |
|---|---|---|
| `downLand` | 0–2 | `downLandMs` — the launch arc |
| `downLie` | 3 | `downLieMs` — flat on the floor |
| `downRise` | 4–5 | `downRiseMs` — getting up |

Each is spread across its own phase, like the jump is across its arc, so
retiming a phase retimes its drawing for free. A pack that declares no phase
poses (the coconut) keeps the single `down` and is untouched.

### The sheet is cut on BODIES, not on ink

The first version banded rows and split frames on empty pixel rows and columns.
That works only while nothing reaches outside its own frame — and the **second**
cigarette's smoke does: it bridges two pairs of rows vertically and welds two
frames horizontally. That method found 6 rows where the art has 8, and a 534px
frame that was two. No gap threshold fixes it; the pixels genuinely touch.

So the sheet is labelled into connected components, and everything over
`BODY_AREA` (15000px) is a character. Measured on both sheets: smallest body
36417px, largest wisp 6312px — a 5.8x gap, and exactly 44 bodies for 44 frame
slots. Rows and frames are found on the **bodies alone**, which never touch each
other, and every loose wisp is then given back to the body nearest it in both
axes. The tool prints how many were re-attached; it should always be all of them.

Frame rectangles **overlap** once smoke is included, so each tile is masked to
its own components rather than cropped out of the sheet — a plain crop would
carry a neighbour's plume into the tile and draw it on the wrong character.

### Three things about this sheet that will bite

**The smoke is part of the animation and must not count as part of him.** It
rises off his ember, it is drawn in the same white as his body, and it is a
third of the frame's height. It is drawn — it is just excluded from the two
measurements it would wreck:

- **how tall he is.** `sheets.js` scales a pack so its idle frame is
  `fighterSizePx`; done on the raw frame that is a two-thirds-height cigarette
  under a full-height plume. The defs carry **`bodyH`** — the idle frame without
  the smoke — and the pack scales on that.
- **where the health bar floats.** `hud.js` puts an enemy's bar above
  `sheets.size().h`; each frame carries **`bh`**, the body's height above its own
  anchor, and `size()` reports that instead of the frame's.

**What separates smoke from body is connectedness and SIZE, not colour.** No
palette test can tell them apart. Inside a tile the body is the **biggest**
component — not the lowest one, which is the obvious rule and is wrong: in the
frames where the stub picks himself up off the floor there is a puff of smoke
drawn *below* him, and anchoring on it drew him hanging in the air above the
ground line.

**His anchor is his BASE, not his whole body.** The coconut's anchor is the
centroid of all of him; a cigarette *leans*, and on the lunging punch his top
travels most of a body-width forward. Taking the centroid of all of him would
slide his feet backwards to pay for the lean, and the punch would visibly lose
reach. The horizontal anchor reads the bottom `BASE_FRAC` (30%) of him only, on
body white, so neither a thrown arm (tan) nor a leaning head (black) can move
his feet.

He faces **right**, like the coconut and unlike the main game's packs. Recorded
in the defs as `native`, never assumed.

---

## The impact burst

Six four-frame bursts — three hand-drawn stars, each in yellow and in red — cut
out of `assets-v2/beatemup-dungeon/effects-porrada-01.png`. One is picked at
random every time a blow connects, whoever throws it. It replaced a starburst
drawn in code.

All the knobs are in `CONFIG.HIT_FX`:

| knob | what it does |
|---|---|
| `on` | `false` drops the effect entirely — it also drops out of the manifest, so the build stops carrying it |
| `sizePx` | size of an ordinary hit's **first** frame; the burst grows ~40% on its own from there |
| `bigSizePx` | the same for a finisher, and for every blow the Mosca lands |
| `chestRel` | how far up the victim the mark is stamped, as a fraction of `fighterSizePx` above the feet |
| `ms` | life of the burst; the four frames divide it evenly |
| `fadeTail` | fraction of that life spent fading out, at the **end** only |
| `mirror` | randomly flip horizontally — twelve marks out of six animations |
| `colorByRole` | **`true` (shipped)**: yellow when the player lands one, red when the player takes one. `false` puts all six in the hat whoever is hit |

`sizePx` and `bigSizePx` are `* BODY_SCALE` like the fighters are, so rescaling
the cast rescales the marks with it.

> ⚠️ **The colour is INFORMATION now**, on request (2026-08-22). The six-variant
> random draw became a three-variant draw *inside* a colour — the variety did not
> go away, it moved. Do not turn it back off to "restore variety".

> ⚠️ **It only works because `_impact` is told which way the blow went.**
> `byPlayer` is passed in rather than derived — combat.js has no idea which of
> two fighters is the player. A new damage path that gets it wrong now tells a
> lie rather than tossing a coin. There are four call sites: the player's
> connects, a boss's contact, the crowd's swings, and a thrown barrel (the
> player's).

**`sizePx` is the reference for the whole pack, not a per-variant target.** The
defs carry one `baseSize` and every frame of every variant scales by the same
factor, so the three stars arrive in the proportions they were drawn (1.00 /
0.88 / 0.78) and each burst still grows across its four frames.

> ⚠️ **Do not normalise the variants to a common size.** It was built that way
> once and taken out: art is wired as drawn. If the spread is unwanted, that is
> a change to the art, not a rescale on the way in.

**The burst holds its first frame through the hitstop.** It runs off the impact
event's clock, and that clock does not advance while the simulation is frozen —
so a finisher shows the solid star for `hitstopMs.finisher` (130ms) *before* its
`ms` begin. That is wanted. Giving the effect a timer of its own would lose it.

### Re-cutting the sheet

```
python3 tools/build-beat-fx-defs.py
```

Writes `effects-porrada-game.png` and `effects-porrada-sprites.json` beside the
master. It asserts 8 column bands and 3 row bands and dies loudly if the sheet
stops matching, which is the point — a mis-banded sheet still produces a working
atlas and the mistake only shows up weeks later as an animation that looks
subtly wrong.

Three things in that tool that are not obvious, all in its header at length:

* **The animation runs along a ROW**, inside one colour block, not down a
  column. Solid → outline → broken → dots.
* **Rows are banded per column, after dropping specks.** The dotted frames are
  disconnected dots and project as up to eleven runs on the raw mask, and a 2px
  speck at y=1133 opens a fourth row band all by itself.
* **The anchor is the frame's centre**, not a ground line — a burst is centred
  on the impact and expands around it. Bbox centre rather than centroid: on one
  variant the centroid sits 13% low and would drag that star down.

### Adding more effect sheets

`effects-porrada-01.png` is numbered because more are expected. A second sheet
needs `SRC`/`BASE` in the cutter parameterised and its own `HIT_FX`-style entry;
the reader (`src/hit-fx.js`) already takes any number of named animations and
groups them by the trailing digits, so `yellow0..2` / `red0..2` becoming
`yellow0..5` costs nothing.

---

## The horse boss

The final boss, in the boss room, **after** the wave of three that already lived
there. Its own class (`src/horse-boss.js`), not an `Enemy` — see STATE.md for
why. All the knobs are `CONFIG.HORSE_BOSS`.

| knob | what it does |
|---|---|
| `health` | 150. A full player combo is 28, so a little over five clean combos |
| `sizePx` | **304** — the drawn body height **and** what the hurtbox is derived from, so picture and target grow together |
| `shadow` | `false` — he is the only character in the game without a ground shadow. `true` puts it back |
| `hitWRel` / `hitZ` | hurtbox, as a fraction of `sizePx` and in belt px. Wide (0.86) because he is longer than he is tall |
| `turnMs` | **460 — the most load-bearing number here.** Seven frames of coming about, during which he cannot attack. It is the fight's only opening |
| `ACTIONS` | **relative weights inside each distance band** — `{charge: 50, kick: 50, approach: 50}`. Far: charge vs approach. Near: kick vs approach |
| `idleMs` | the breath between passes |
| `kickRange` | how close he closes to before throwing the kick |
| `chargeMinRange` | 240 — he may only *roll* a charge from beyond this. **Must sit inside the `approachStop` band** |
| `chargeCooldownMs` | 2400 — no charge for this long after one. Stops every walk-up ending in a charge |
| `chargeNearWeight` / `chargeFarRange` | 0.35 / 600 — the charge's weight **ramps with distance**: about a third of full at the threshold, full from 600 px out |
| `chargeCooldownFarScale` | 0.2 — the cooldown relaxes with distance too, so a player who keeps running gets run at |
| `approachStopMin` / `Max` | 165 / 340 — where an approach settles, rolled each time. **Straddles `chargeMinRange` on purpose** |
| `approachMinTravel` | 95 — an approach must actually go somewhere, or it ends on frame one and re-rolls |
| `approachMs` | fuse on an approach |
| `approachMaxMs` | fuse on closing for a kick, so he can't be led around the room forever |

**The charge gets likelier the further away you are** — that is the point of the
move, and it is what the two ramp knobs above encode. Odds of a charge, by the
distance he is at when he decides (30 simulated minutes):

| distance at the decision | chance he charges |
|---|---|
| under 240 px | 0% — he kicks instead |
| 240–360 px | ~20% |
| 360–520 px | ~45% |
| 520 px + | ~50% |

**How that adds up over a fight**, counted at the DECISION — not by watching
phases, because a turn taken mid-approach re-enters the phase and will inflate
any tally built on that:

| you | charge | kick | approach | charge every |
|---|---|---|---|---|
| run away from him | 35% | 11% | 54% | 7.9 s |
| move around normally | 22% | 27% | 51% | 11.1 s |
| glue yourself to him | 0% | 53% | 47% | never |

Running gets you charged at roughly twice as often as milling about nearby, and
the bottom row is the design working: stay inside 240 px and he kicks. The kick
only knocks you back 70 px (`knockback / knockbackDecay`), so hugging him is a
real choice with a real answer.
| `chargeTellMs` | 420 — stood still, facing you. The only warning |
| `chargeSpeed` | 520, faster than the player runs. Step out of the lane |
| `kickReachX` | **338** — measured off the drawing, see below |
| `chargeReachX` | **218** — likewise |
| `runMs` / `trotAnimMs` / `walkAnimMs` / `kickAnimMs` | per-frame holds; these are the gait |
| `dieMs` | 2000 — the whole death, and what `finished()` waits for |
| `dieTipRad` | the old tip-over. Dead while `DEATH_BOOM.on` is true |
| `DEATH_BOOM` | the explosions he goes up in; see below |

### He is 37% bigger than he was, and so is his reach

Two passes, both asked for flat. 2026-08-22: `drawScale` 1.711 → **2.2243**, so a
234 px animal is drawn at 304 against a 137 px fighter. 2026-08-23: another 5%,
2.2243 → **2.3355**, which is **319 px**.

Three things go with it every time, and the reasoning matters more than the
numbers:

* **`sizePx` 234 → 304 → 319.** The hurtbox comes off it, so the target grows
  with the picture — the pairing this file keeps everywhere.
* **`kickReachX` 260 → 338 → 355 and `chargeReachX` 168 → 218 → 229.** Both
  were *measured off the drawing*; when the drawing grows they have to, or the
  boxes would stop where his hooves and chest used to be.
* **Nothing measured in DEPTH moves** — `hitZ`, `kickReachZ`, `chargeReachZ`.
  The belt is as deep as it was and a 2-D drawing does not get deeper when it
  gets taller.

**That is the recipe for the next one too:** multiply the four numbers, leave the
depths and the decision ranges alone.

> ⚠️ **His decision ranges did not move.** `kickRange` (210) and
> `chargeMinRange` (240) are about the fight's spacing, not about the drawing.
> The practical effect is that a kick he commits to now lands more reliably —
> which is a difficulty change, and it was not separately asked for.

> ⚠️ **The texture is upscaled now.** 1.711 put the atlas on screen at almost
> exactly 1:1, which is what the master was reduced *for*. At 2.3355 there is no
> more detail in it to find, so he may read very slightly softer than the men.
> The fix would be a bigger master through `shrink-master.py`, not a smaller
> number here.

### He blows up

He used to tip over and fade, for want of a death row. Since 2026-08-22 he goes
up in a string of explosions — **Still Life's blast sheet**, read in place, all
twelve frames of it. `CONFIG.HORSE_BOSS.DEATH_BOOM`:

| knob | what it does |
|---|---|
| `on` | `false` brings the tip-over back, unchanged |
| `count` | 7 |
| `startMs` / `everyMs` | 0 / 180 — when the first goes off and how far apart the rest are |
| `spreadXRel` / `spreadYRel` | 0.55 / 0.75 — where they land, as fractions of `sizePx`. Wider than high, because he is |
| `sizePx` | 210 — width of the **peak** frame on screen |
| `sizeJitter` | 0.3 — ± that fraction, per blast |
| `fadeMs` | 620 — how long *he* takes to go. Shorter than the blasts run for, on purpose |

Sheet-side: `BOOM_SHEET`, `BOOM_RECTS` and `boomMs` (78/1.1, ~852 ms for the
twelve frames) at the top of the file, all Still Life's. The machinery is
`src/boom.js`, shared with the Mosca — see below.

### The Mosca goes up too

`CONFIG.flyBossDeathBoom`, same shape and same file (`Booms`), its own numbers:
**five** blasts at **170px** rather than seven at 210.

> ⚠️ **Fewer and smaller because it dies in the AIR.** There is no floor to hide
> the bottom of a blast and nothing else in frame to measure against, so seven
> full-size explosions around a fly read as a screen-filling mess rather than as
> a fly coming apart.

`on: false` gives back its old death intact — the tumble out of the sky and the
slow fade where it lands. Its `finished()` waits for `max(2.0s, the blast span)`
derived from the config, so retiming the string moves it and the level cannot
advance through a blast still on screen.

> ⚠️ **Check the arithmetic if you retime it.** The last blast *starts* at
> `startMs + (count−1) × everyMs` = 1080 and runs 852 ms more, so the string ends
> at 1932 — which is what `dieMs` 2000 is sized for. `finished()` waits for
> `dieMs`, and the level advancing early would cut a blast off mid-frame.

> ⚠️ **The pattern is rolled once, on the frame he dies.** Re-rolled per frame it
> is not an explosion, it is static — the same lesson `hit-fx.js` records. And
> the times are shuffled against the positions deliberately: fired in position
> order the blasts unzip him nose to tail; dealt at random he comes apart.

> ⚠️ **He does not tip while he explodes.** A body toppling *through* the blasts
> reads as two deaths playing at once — the eye follows the rotation and stops
> reading the explosions as what killed him.

### Three things not to change without reading first

**The turn cannot be mirrored.** Row 5 already contains both profiles plus
head-on. Flipping it folds the rotation in half. It is drawn by passing the
pack's native side as the facing, which is also how he gets an idle he has no
row for — he stands in frame 0 or 6 of that row.

**The kick reaches backwards.** `coice` is a hind-leg kick; its box is on the
opposite side to every other attack in the game, which is what makes it the
answer to a player behind him.

**The ranges are coupled and will break the fight if separated.**
`approachStopMin` (165) < `chargeMinRange` (240) < `approachStopMax` (340).
Where an approach settles is rolled inside that band, so it lands on either side
of the charge threshold and you cannot tell from the walk-up what is coming.

* Push `chargeMinRange` **above** the band and no approach ever leaves him far
  enough — the charge starves. That has happened twice, two different ways.
* Push it **below** the band and every approach leaves him able to charge, and
  the sequence comes out `walk > CHARGE > walk > CHARGE`. The walk stops being
  movement and becomes a tell.

**⚠️ Never write a reach by eye.** `kickReachX` was first 132; the hooves reach
300px behind the anchor. Print the row's frame extents from the defs and set the
number against them — this is the same failure the cigarettes' strings still
have.

### Re-cutting the sheet

```
python3 tools/build-beat-enemy-defs.py horse
```

Same cutter as the cigarettes, with three per-sheet options the horse added:
`baseWhite: false` (he is chrome, and the white anchor test does **not** fall
back on him — it would anchor him on whichever leg caught the light),
`bodyArea: 1000` (his smallest frames sit just under the shared 15000), and
`refAnim: 'walk'` (he has no idle row to size the pack from; it must be a
neutral profile, or the whole character shrinks to make room for a pose).

He has **no hurt, knockdown or death row** and that is deliberate. Damage is a
flash, a blink and the impact burst.

---

## HORÁCIO — dying, charging, and coming out of the ground

Stage 2's boss. The pack, the nine beats and the fight's shape are documented in
`CONFIG.HORACIO_BOSS` and `src/horacio-boss.js`; this section is only the three
things changed on **2026-09-03**, and the knobs each one added.

### He goes up now, like the other two bosses

*"when he dies, he needs to blow up like the other bosses with lots of explosion
animations."* Same `Booms` the horse and the Mosca use — nothing was added to
`boom.js` for him, because how many, how far apart and how big were already
config.

```js
DEATH_BOOM: { on: true, count: 8, startMs: 800, everyMs: 55, vanishAt: null,
              spreadXRel: 0.42, spreadYRel: 0.58, baseYRel: 0.16,
              sizePx: 240, sizeJitter: 0.28 },
DEATH_FUSE: { ms: 40, tint: '<the bomb's panic red>', tintAlpha: 0.85 },
dieMs: 2150,          // was 900 — the fuse AND the string finish INSIDE this
```

The whole death, in order:

| ms | |
|---|---|
| 0 | HP hits 0 — **the red flash starts**, at full opacity |
| 800 | first blast — **he is still standing there**, under it |
| 1185 | last blast starts, all 8 alight — **and the body is gone** |
| 2036 | the last blast ends |
| 2150 | `finished()` — the room may advance |

> ⚠️ **There is no `fadeMs` and no `fadeStrobeMs`, and that is the point.** This
> block carried both in turn on the day it was built — a linear fade (620 ms,
> then "as long as the blasts last") and then a strobe whose duty ran down — and
> both were refused: *"remove the stroboscopic thing, but also remove the fading,
> we want it to look like he is blowing up, and we haven't achieved that effect,
> can you make him blow and vanish at once?"* They are **deleted, not switched
> off**, like the emerge rim and the film filter. **An explosion does not make a
> body transparent, it REPLACES it** — both attempts were a boss turning into a
> ghost, one smoothly and one with a flicker, and neither is a thing coming
> apart. He is simply not drawn from `startMs` onward.

> ⚠️ **He goes at `vanishAt` — `null` = "when the LAST blast starts" (1185 ms),
> not when the first one fires.** It was `startMs` for about ten minutes and that
> was too early: *"its vanishing too fast now, even before the explosion effects,
> let him be there during the explosion, but then he vanishes."* The reason is in
> the sheet — **`BOOM_RECTS` frame 0 is the blast still growing**, barely wider
> than nothing — so removing him on the frame the first one fires gave a boss,
> then a spark, then an explosion arriving after he had already gone. *An
> explosion has to cover a thing before it can replace it.*

> ⚠️ **The default is derived so it tracks the string.** Measured at the vanish
> frame, the eight blasts are at sheet frames 5 / 4 / 3 / 3 / 2 / 1 / 0 / 0 —
> frame 4 is the widest of the twelve, so the earliest are at or just past their
> peak and the patch of screen he is standing on is solid explosion. He goes
> **under** the detonation and it clears to nothing. Retuning `count` or
> `everyMs` moves the vanish with the peak instead of stranding it at a time that
> used to be one. A raw ms still wins: later leaves him standing in the thinning
> tail, earlier is the bug above. He is visible under the blasts for **385 ms**.

> ⚠️ **`everyMs` is 55, down from the horse's 165, and that is the other half of
> "we haven't achieved that effect."** At 165 the eight blasts take 1.2 s to all
> arrive — which is the horse's reading *on purpose*, a body coming apart,
> unzipping nose to tail — and it is not what was asked for here. At 55 they are
> all alight by 385 ms and each runs 851, so they overlap almost completely: **one
> detonation made of eight bursts** rather than eight explosions in a row. *The
> stagger is what decides between "blowing up" and "coming apart"* — the count
> and the size are not. Back to 165 for the old reading.

> ⚠️ **The hit blink is suppressed while he is dead.** The killing blow sets
> `hurtT` like any other, so its 60 ms half-alpha flicker used to run through the
> first 300 ms of the red flash — two blinks on different beats over one body,
> which reads as noise rather than as either.

> ⚠️ **He flashes red first, like the charutobi.** *"before he dies, when his HP
> reaches 0, make him blow up like the charutobi, so make him flash red, and them
> he blows up with the several explosions."* Same filter string (which is the
> bomb's panic red), same 40 ms rate, same **one beat lit in three** — copied
> rather than aliased, for the reason both of theirs give.

> ⚠️ **The fuse has no duration of its own: it runs until `DEATH_BOOM.startMs`.**
> "Flash, then blow up" is one number and cannot come apart. A second number
> drifting from the first is either a dead boss standing still doing nothing, or
> a flash carrying on through his own explosion.

> ⚠️ **It is only the tint, where the charutobi's is tint PLUS a tremble.** His
> shudder also swaps two borrowed drawings on the same beat. **HORÁCIO's pack has
> not one animation frame in it**, so there is nothing to swap, and faking it by
> alternating armoured and exposed would flip between a well body and a wounded
> one — which the class header forbids for exactly that reason. *Take the half of
> a borrowed effect the art can support and do not invent the other half.*

> ⚠️ **`dieMs` is a SUM, not a taste call.** The last blast starts at
> `startMs + (count−1) × everyMs` = 800 + 385 = 1185 ms and runs 12 × `boomMs`
> (70.9) = 851 ms more, ending at **2036**. `finished()` waits for `dieMs` and the
> room advances on it — advance early and a blast is cut off mid-frame, the
> failure that once hung the horse's corpse through its outro. **Redo the sum if
> `count`, `everyMs` or `startMs` move** — `startMs` is the fuse, so lengthening
> the red flash pushes this too.

> ⚠️ **The pattern is rolled ON THE BLOW, in `hurt()`, and the reference size is
> `sizePx()` — the body he actually died in.** He can be killed as the joaninha
> mid-theatre (324) or as the grandao mid-stab (449); a fixed reference would
> scatter one body's blasts across the other.

> ⚠️ **His explosions are drawn in a pass of their own (`drawFX`), LAST, after
> every entity.** They cannot live in his `draw()`: he is injected *between two
> bands of the cigarette floor* whenever he is in the ground, and anything drawn
> from inside `draw()` inherits that plane. His arrival dust was already coming
> out **under** the mounds because of it, and the death blasts would have too —
> he is killed at the PEEK more often than anywhere else, and the peek leaves him
> 55% buried for the whole death. *A body under the floor is the effect; an
> explosion under the floor is a bug.* ⚠️ And it is **last** rather than in the
> diggers' dust pass, which anchors to the player's slot in the z sort: that
> works for a digger because a digger is always behind the floor, but the boss is
> drawn from *two different passes* depending on his depth, so any fixed slot
> leaves one case with his own body painted over his own explosions. **The hole
> stays behind** — it is a mark on the floor.

### The charge's contact box was a band around his feet

*"when he is doing the ball attack like charging, the collisions are wrong, they
are too low for his helmet position."*

```js
CHARGE: { hitUpRel: 0.562, hitDownRel: 0.093, ... }   // × sizePx(), from his ground point
```

Measured off the drawing with `CHARGE.sunk` applied, at level 1 (`sizePx` 354):

| | px from his ground point |
|---|---|
| ball ink, top (spike tips) | −234 |
| **ball mass**, top (rows ≥ half the equator's width) | **−199** |
| the equator — right under the helmet | −116 |
| **ball mass**, bottom | **+33** |
| ball ink, bottom (clipped by the floor) | +48 |
| **the old box** (`hitZ` 52, the standing hurtbox) | **−26 … +26** |

> ⚠️ **A 52 px band around his feet, under a ball 280 px tall.** The player was
> hit by the floor beneath him and walked through the helmet untouched.

> ⚠️ **The box grows UPWARD and keeps its floor**, so nothing that connected
> before stops connecting. **Centring it on the helmet — the obvious reading of
> "too low" — is the wrong fix and is worse than the bug:** at the back lane
> (z 68) a box centred 116 px higher sits at z −48, off the belt, where no player
> can ever be. *A box on a belt is a depth; a sprite's height is not depth.*

> ⚠️ **The lanes still mean something, and that was checked.** Against a 380-deep
> belt the safe ground left is: back lane (z 68) **z > 101**, middle (190)
> **z > 223**, front (327) **z < 128**. The front lane is now the dangerous one
> and the back lane the mild one — the honest consequence of a foot-anchored box
> under a body drawn this big. `hitUpRel: 0.66` takes the spike tips as well and
> is bigger in every lane; that is a look call and 0.562 is the conservative half
> of it.

### He jumps out of the ground instead of popping out

*"when he leaves the ground, he is just popping out, we want him to leave like
the other enemies, like giving a little jump outside of the ground, of course
this is only when he is like leaving entirely from the ground and standing
after."*

```js
BALL: { surfaceMs: 560, ... }        // was 300 — this is now the WHOLE movement
RISE: { clearAt: 0.55, hopPx: 67, steps: null, unballAtStart: true },
```

> ⚠️ **The `rise` phase only, which is the point of the "of course".** Every
> other depth change of his ENDS in the ground — the peek stops with his head
> out, the roam holds `roamSunk`, the charge holds `CHARGE.sunk` for its whole
> crossing. `rise` is the only phase that ends with him standing on the floor,
> and its three exits (stab, summon, walk) are exactly the "standing after".

> ⚠️ **The same shape as `Emerge`'s hop, not the same code.** Beat 1 (his
> arrival) reuses `Emerge` outright because it is a digger coming out of a hole;
> this is a body already halfway out moving the rest of the way, with no hole, no
> heave and no dust. What it borrows is what matters — the split, the stepped
> movement and the sine arc — so the two hops read as one creature doing one
> thing twice. `steps: null` means *"whatever the mooks use"* (`EMERGE.steps`, 6)
> rather than repeating the number; he owns **no animation frames at all**, so as
> with a digger holding one drawing, the movement is the only thing there is to
> make choppy.

> ⚠️ **`clearAt` SPLITS `surfaceMs`, it does not add to it.** He has to be OUT
> before he is in the air: run the climb and then a hop on its own clock and the
> arc starts from a body still sunk in the floor, which reads as being winched
> up. 0.55 → 308 ms coming through, 252 ms airborne. ⚠️ **`surfaceMs` went 300 →
> 560** because at 300 the two halves are 165 and 135 ms, and a 135 ms hop is four
> frames — a twitch. 560 is `EMERGE.riseMs` exactly.

> ⚠️ **`hopPx` 67 is `EMERGE.hopPx` (26) scaled to his body, not copied.** He is
> drawn 354 px against a mook's 137, so the same 26 would read as a stumble;
> 26 × (354/136.8) = 67. The ask was *"a little jump"*, and little is relative to
> the thing jumping.

> ⚠️ **`unballAtStart` is a fix, not a preference.** He used to hold the ball for
> the whole climb and flip to the standing drawing on the **last frame** — a
> change of body at the one moment he is fully visible and standing still, which
> is the loudest possible place to put it and was half of what *"just popping
> out"* described. Coming up as the thing he is going to be leaves nothing to
> pop. `false` restores the old order.

### He comes out of the ground facing the camera

```js
outFacing: 0,          // index into the eight drawings; 0 is the front
RISE: { holdMs: 500 }  // ...and how long he keeps it AFTER he lands
```

*"he should always spawn (jump from the ground) looking to the front, WHEN HE IS
jumping from the ground… right now he spawns looking to the front when he is
calling the charutobis, so copy that behavior when jumping out of the ground
always."*

> ⚠️ **Both ways out of the ground, not just the new one.** The `rise` hop AND
> the beat-1 arrival, which used to come up side-on at whoever it found
> (`player.x < this.x ? 6 : 2`). That also removes a snap nobody had reported:
> his very first appearance turned through 90° the instant the arrival finished,
> because the theatre puts him at the front.

> ⚠️ **It is written every frame, not once on entry.** `update` calls
> `_faceToward(player)` before it dispatches to the phase, so a facing set once
> is overwritten on the next frame — which is precisely the bug the theatre hit
> ("he played the whole thing in profile"), and the reason `_summon` sets its own
> pose from inside the phase too.

> ⚠️ **The pose outlasts the jump by `RISE.holdMs`.** It first shipped ending on
> the frame he landed, and that was reported straight back: *"he is looking
> forward, BUT for very small time, right afterwards he already looks at the
> player. make him hold the looking forward position a little bit more, half a
> second more."* **The pose the player is meant to read was over the moment the
> movement was.**

> ⚠️ **It is a debt carried across the phase change, not a longer rise.** The
> `rise` phase has to END when the MOVEMENT ends — stab, summon and walk all
> start their own clocks from it — so buying the pose more time by padding
> `surfaceMs` would have left him hanging in the air for half a second instead.
> This is the *facing alone* outliving the phase that set it. `holdMs: 0` is the
> old behaviour, front only while he is actually moving.

> ⚠️ **It is safe on the stab, which looks like it should not be.** That attack's
> box is `x ± reachX` — symmetric, reaching both ways whatever he faces — so the
> facing there is cosmetic. ⚠️ **If a directional attack is ever added after a
> rise, this is the first thing to check.** The three exits all outlast the hold
> comfortably (stab 940 ms, summon 1120, walk 1700), so it never leaks into the
> next peek.

> ⚠️ **Its own knob, though it equals `SUMMON.signalFacing`.** The summon was
> named as the reference, but they are different beats that happen to agree —
> tying them would mean a pointing drawing (when one is finally made) silently
> changing how he comes out of the ground.

### The third damage tier, and the recoil

The last unused drawing in his pack went in, and nine more arrived the same day.
Two separate things, and they are easy to confuse because both are "he is hurt":

| | says | lasts |
|---|---|---|
| **damage tier** | how far through the fight he is | until his health moves again |
| **recoil** | *that punch, just now* | `hurtMs` (300 ms) |

```js
hurtAt: 0.5,          // under this, the exposed body — the beige creature showing through
nakedAt: 0.25,        // under this, the shell is OFF        <- new
nakedLevel: 0,        // ...and he drops to the joaninha     <- new, and see below
hitPoseMs: null,      // how long the recoil holds; null = as long as the blink
```

*"batidao-boss-espeto-001-F4.png — this file is supposed to be used when the
boss has 25% or less of HP."*

> ⚠️ **`nakedAt` alone would have done nothing, and `nakedLevel` is why.** The
> naked body was drawn for **master 001 only** — a creature with no shell has no
> spike level — so `index[level>0][3]` is null and the lookup falls straight back
> to the armoured body. He fights at level 1 and stabs at level 3, so the tier
> would have been invisible everywhere except mid-theatre. **So losing the last
> of his health is losing his spikes:** under 25 % his body is the joaninha
> whatever the phase asked for. Set `nakedLevel: null` to make the tier inert
> again rather than half-applied.

> ⚠️ **His size and hurtbox follow him down** — `sizeByLevel[0]`, 324 px against
> level 1's 354. That is deliberate and it is one resolver, `bodyLevel()`, read
> by both the drawing and `sizePx()`. A body that shrinks on screen while its
> box stays the old size is the bug where punches connect with air beside him.

> ⚠️ **The stab loses its spikes down here.** Beat 9 sets level 3 *"because the
> grandao does the stabbing"* and under 25 % it draws as the naked joaninha
> lunging. It is the honest read of losing your armour, but it is a **look call**
> and it is the one to revisit first if the ending of the fight reads wrong.

Then the recoil: `damage-sprites/batidao-boss-espeto-hit-*`, states **4/5/6** —
the screwed-shut eyes and gritted teeth of bodies 0/1/3, swapped in for the
length of the blink and swapped straight back.

> ⚠️ **Their `F` numbering is its own and does not match the main pack's.** Hit
> `F3` is the **naked** recoil, not the ball — the ball has no hit drawing at any
> level, so the numbering compacts. Nine files: 4 levels × 2, plus the joaninha's
> naked.

> ⚠️ **There is no recoil for the ball and there should not be** — a tucked ball
> has no face. He is still punchable balled (the peek is the fight's one reliable
> opening) and there the blink alone says it, as it did everywhere before.
> **Except below 25 %, where there is no ball either — see just below.**

#### Below 25 % he has no ball at all (2026-09-04)

*"when he is doing the ball attack, or submerged, do not use the sprites from F3,
because they have the helmet. For this stage, just use his regular sprites."*

Every ball drawing in the pack — the joaninha's included — is a body tucked
**into its shell**, so at the one tier whose whole point is that the shell is
gone, the ball was putting it straight back on. Under `nakedAt` the charge, the
roam, the peek and the submerge all draw the **naked body**, and it picks up the
naked recoil with them (the ball never had one).

> ⚠️ **The test is `st !== 3`, not `_shellGone()`.** It asks *did a naked drawing
> actually come out of `_bodyState`* rather than *is his health low* — so if the
> tier is ever switched off at the level he is in (`nakedLevel: null`, or a
> re-cut that loses the frame) the fallback is the exposed body and **the ball
> correctly wins again**. Gating on health would have stood him up mid-charge
> with no naked art to show for it.

> ⚠️ **The roaming tell changes and it is worth knowing.** At `roamSunk` 0.86 the
> cue that he is under the cigarettes is *a spike tip travelling through them* —
> asked for explicitly. Naked he has no spikes, so it becomes a smooth beige dome
> cresting. Still a cue, softer.

> ⚠️ **`CHARGE.hitUpRel` / `hitDownRel` were measured off the BALL's mass** and
> have not been re-measured against the naked body. The silhouettes are close
> (both round, roughly the same height) so nothing was changed, but it is the
> honest caveat and it sits next to the already-reported oddness with his
> collisions while sunken.

> ⚠️ **It runs through the first 300 ms of his death, unlike the blink.** The
> blink is suppressed while `dead` because two flickers on different beats over
> one body is noise; a held grimace under the death flash is not a flicker, it is
> the blow that did it still on his face.

#### Re-cutting him with the recoils

```
python3 tools/build-beat-horacio-defs.py
```

> ⚠️ **`TARGET_H` now measures the BODY, not the cell, and that was a real bug
> for one run.** The recoils reach ~7 master rows higher than the poses they
> replace, so the shared cell grew — and the same `TARGET_H` came out as scale
> **0.31749 instead of 0.31949**: the entire boss, every level and every state,
> 0.6 % smaller because a hurt frame arrived.

> ⚠️ **`ax` is pinned to the normal bodies for the same reason.** A few recoils
> lean up to 28 master px past the left edge of their cell, so the window is the
> union of both sheets' runs — but the anchor **is** the cell's centre, and
> widening a cell asymmetrically would have slid the whole boss sideways in a
> change that is meant to be invisible until he is punched.

> ⚠️ **The atlases grew to 15.6 MB over four textures** (from 8.9), largest
> 2963 × 2814 — still inside `bigTextureCap` (3200), which is the wall. The
> column count is now *searched* rather than `sqrt(n)`: at level 3 a 6-column
> shelf packs 20 px over the cap and fits comfortably at 7.

---

## Masters arrive too big

Artist exports come at print resolution — the horse boss landed at 27329x7922
and 18 MB. Nothing needs that: the cutters read the master, and what the cutters
write is what the game loads, so a master only has to carry enough pixels that
**no frame is ever upscaled on its way to the screen**.

```
python3 tools/shrink-master.py <sheet.png> --scale 0.25 --dry-run   # measure
python3 tools/shrink-master.py <sheet.png> --scale 0.25             # commit
```

`--dry-run` prints the row bands and the frame height each one would end up
with. **That height is the ceiling on how large the character can ever be
drawn** — pick the scale off it, not off the file size. `--out` writes elsewhere
instead of overwriting.

> ⚠️ **It overwrites in place and the loss is permanent.** Dry-run first.

**Cropping the dead canvas saves almost nothing.** PNG already compresses a
blank region to near zero — on the horse, cropping a third of the width off
saved 0.8 MB of 18. The size is the drawn pixels, and `--scale` is the only real
lever.

The resize is premultiplied, so colour hiding under transparent pixels cannot
bleed into the edges. On the horse that changed nothing (its export is matted on
black, tight to the art) — but a sheet matted on white would fringe badly
without it. Insurance, not a fix.

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
