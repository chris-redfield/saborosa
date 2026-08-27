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

## The projector — built, and switched OFF

**`film: false`. It is off in the shipping build and that is a decision, not a
default.** Still Life's old-film post effect was ported on request, seen, and
turned down the same day — *"it causes a terrible feeling"*. The flicker had
already been softened once (see below) and it still was not wanted, so **another
pass on these numbers is not the answer**.

Everything stays wired: `src/film.js` is that game's file copied unchanged,
`renderFilmed()` in `game.js` still routes every frame through the pass, and
this whole config block is live. Set `film: true` to see it. **Do not delete any
of it to tidy up** — keeping it toggleable was the ask.

What it does when it is on: grain, a brightness flicker, a vignette, vertical
gate weave, the odd scratch, and a rolling frame line that is switched off.

| knob | what it does |
|---|---|
| `film` | **`false` — shipped off.** `true` turns the whole thing on |
| `filmGrain` | 0.11 — grain opacity |
| `filmFlicker` | **0.042** — the brightness dip. Still Life's is 0.06 |
| `filmFlickerMs` | **80** — how long one dip is held, i.e. the **blink rate**. Still Life's is 24 |
| `filmVignette` | 0.22 — corner darkening |
| `filmWeave` | 1.4 — px of vertical gate jitter of the whole picture |
| `filmScratchChance` | **0.028** — per-frame odds of a scratch. Still Life's is 0.04 |
| `filmBarHeight` | 0 — the rolling frame line, off. `filmBarSpeed` / `filmBarDark` size it if it goes on |
| `filmCss` | a CSS grade on the canvas element. Empty. `contrast(1.08)` would add punch; desaturation would be a different effect |

**Three of those no longer match Still Life, deliberately.** On this game's
plate the flicker read as a blink rather than as a lamp, and the knob that was
actually wrong is `filmFlickerMs`: at 24 the value is re-rolled ~42 times a
second, which the eye reads as strobing. At 80 it changes ~12 times a second and
breathes instead. The dip came down 30% with it and the scratch 30% with that.
**Everything else is that game's value for value** — if the grain, the vignette
or the weave move, move them in `flying-dungeon/src/config.js` too. The point of
the request was that the two games look like they came off one projector.

**It is the last thing drawn, over everything — including the HUD.** That is the
one structural difference from Still Life, where the HUD sits outside the film
pass. Here the whole frame is one projected picture, so the health bar grains
and weaves with the fight. `renderFilmed()` in `game.js` is the split point if
that ever needs to change.

Two rules inside `renderFilmed()` that are not obvious:

* **The frame is cleared BEFORE the weave**, in unshifted space — otherwise the
  strip the picture has just moved off keeps last frame's pixels, a smear along
  one edge that looks like a rendering bug rather than like a projector.
* **The overlay is not weaved with the picture.** Grain, vignette, frame line
  and flicker are the *projector*; they stay nailed to the screen while the
  picture moves under them. Drawn inside the translate they would ride along and
  the weave would stop being visible at all.

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

**`hurt` cycles rather than holding**, and it is the exception on purpose. A
flinch drawn as two poses is a shudder, and a shudder frozen on its second frame
reads as a fighter that got stuck. Every other one-shot ends in a state worth
holding — dead, or on the floor; this one ends by standing back up. At `hurtMs`
260 and 100ms a frame that is two frames and a repeat of the first.

**A pack whose knockdown row also stands up** does not use the `down` row above
at all: it is sliced by phase and each slice is spread across its own phase
(`downLandMs` / `downLieMs` / `downRiseMs`), the way the jump is spread across
its arc. That is the cigarette; see his sprite section.

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

## The game over panel

Dying used to dim the fight and put a small PERDEU! over it. It now gets the
**flying dungeon's game over screen** — its three photographed frames of
crawling vermin, looping at ~9.5fps, with the word revealed over them. Same
panel, same timings, same lettering; different word.

The sequence, once the death animation has played out and held:

| | |
|---|---|
| `fadeOutMs` 900 | the fight dips to black |
| `holdMs` 350 | black, alone |
| `fadeInMs` 900 | the panel arrives |
| `title.d1` 1100 | PERDEU! pops |
| `armMs` 500 | then a press counts — 2850 ms in total |

**The black hold is the point.** Cross-fading straight from the belt to the
worms reads as a glitch; a moment of black reads as a cut. That's the other
game's sequencing and there was no reason to differ.

**The press is armed off the reveal**, not off a constant, so retiming the word
moves the arming with it. Without that, a key still held from the last seconds
of the run blows straight past the screen the player is meant to read.

> **The word comes from `RESULTS.LABELS.lost`**, not from the panel's own
> config — so PERDEU! is written in exactly one place. `GAME_OVER.title.words`
> overrides it if the panel ever needs to say something else.

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
| enemies downed | **RANGO** | with a by-name breakdown under it |
| the stamp | **NOTA** | the letter |

The card reads **OBRIGADO POR JOGAR** with **THANK YOU** under it, and the
prompt is *pressione qualquer botão*. Losing shows **PERDEU!**

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
python3 tools/build-street-plate.py     # keyframe every 12
python3 tools/build-desert-plate.py     # keyframe every 12, downscaled, prints the pan
```

**`lock: false` on an arena** makes the camera follow that fight instead of
locking, with the whole room as walls rather than one screen. That is what a
small room wants.

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

```js
DEV: { on: true, punchDamage: 50 },   // top of config.js
```

> ⚠️ **It is OFF — that is the shipping state**, and `package.sh` refuses to
> build while it is `true`. That refusal is the safety net: a forgotten `true`
> costs a failed build rather than a shipped cheat, so turn it back to `false`
> when you are done testing rather than working around the build.

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
```

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
