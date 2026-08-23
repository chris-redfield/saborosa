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
| `groundYRel` | 0.93 — his feet, on the near dirt **in front of** the rock |
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

---

## Rooms

```js
ROOMS: [
  { name: 'street',    plate: 'plate',     startX: 220, endX: 4704, reverse: false, segments: [...] },
  { name: 'boss-room', plate: 'bossPlate', startX: 220, endX: 1617, reverse: true,  segments: [...] },
],
fadeMs: 900,   // the whole room-to-room fade; the swap happens at its midpoint
```

Each room has its own footage and its own camera origin. To add one: add a
`SOURCES` entry for its plate, a `ROOMS` entry pointing at it, and set `endX` so
the camera crosses exactly as much of the shot as exists.

**`reverse: true` needs a plate that can be scrubbed backwards.** Video cannot
play backwards, so reverse means seeking, and a seek decodes from the previous
keyframe. Re-encode the clip with dense keyframes first:

```
python3 tools/build-boss-plate.py     # crops at the pan's turn, keyframe every 3 frames
```

**`lock: false` on an arena** makes the camera follow that fight instead of
locking, with the whole room as walls rather than one screen. That is what a
small room wants.

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

> ⚠️ **It is currently ON, for testing, and `package.sh` refuses to build while
> it is.** That refusal is the safety net — a forgotten `true` costs a failed
> build rather than a shipped cheat — so turn it back to `false` when you are
> done rather than working around the build.

Every player punch does `punchDamage` instead of its own. **Damage and nothing
else** — reach, timing, knockdown, the combo and every enemy's HP behave exactly
as they ship, so what you are testing is the real fight at speed rather than a
different game. At 50: both cigarettes die in one hit, ERKPA and the Mosca in two.

It is applied at the one place the player's damage is read (`combat.playerHits`)
rather than by rewriting `CONFIG.COMBO` — the table documents a 28-damage string
that every enemy's HP is tuned against, and a config that lies about that is
worse than a branch.

**Jumping straight to a room.** Testing a late room by playing to it is how a
late room stops getting tested.

```js
DEV: { startRoom: 1 },   // which room the game boots into
```

The **number keys do the same thing live** — `1` for the street, `2` for the
boss room — with no fade, because sitting through the fade is exactly the
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
so 110 makes each square exactly 5 damage. The boss's 88 is a multiple for the
same reason.

The full-combo total was held at 28 when the combo went from three hits to five,
deliberately — so every enemy's time-to-kill stayed where it was tuned. Raising
it is a real rebalance, not a tweak: at 40 damage a full string one-combos the
stub (40 HP), and at 34 it already one-combos DUDU.

---

## Sound

Three knobs and three pipelines.

| knob | what it does |
|---|---|
| `MUSIC_TRACK` | the looping bed, one file |
| `musicLoopSec` | **6.146** — where the loop wraps. NOT decoration; see below |
| `musicVolume` | 0.55 |
| `SFX` | name → file. `sound.play('hit')` looks the name up here |
| `sfxVolume` | 0.9 — effects sit above the music on purpose |
| `SFX_GAIN` | per-effect trim, multiplied onto `sfxVolume` |
| `sfxHitDetune` | 0.045 — how much each combo link is pitched up. 0 = off |
| `sfxTakeHitRate` | 0.82 — the same punch sample, pitched **down**, for a blow the player *takes*. 1 = both directions sound identical |
| `GAME_OVER_STING` | how the death music is played; see *The game over panel* |

`M` mutes everything, in every phase.

**Taking a punch is the punch sample, on purpose.** It was asked for as "the
porrada noise when the player gets hit, like when he hits the enemies", so it is
the same recording rather than a second one — a fight should sound like one
fight. The pitch is what says which direction the blow went, and it is the only
cue in the fight that has no picture of its own: an enemy's swing stamps the
same impact burst the player's does. It fires from `Combat._takeHitSound()`, the
one place both damage paths (the crowd's swings, a boss's contact) meet. Do not
go far under ~0.7 — a 300 ms crack slowed that far becomes a thud, which reads
as something falling over.

**⚠️ `musicLoopSec` must match the mix.** `AudioBufferSourceNode.loop` with no
bounds wraps at whatever the decoded buffer turned out to be, and decoders
disagree about an Opus file's length by a few ms of padding. Left alone that is
a few ms of silence every 6.1 seconds — an audible tick. If you re-crop the
mix, this number moves with it.

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

### Cutting a new sound effect

    python3 tools/build-beat-sfx.py enemy-hit-1              # the loudest event
    python3 tools/build-beat-sfx.py combo-2-5-hits --event last --out combo-finish2
    python3 tools/build-beat-sfx.py combo-1-4-hits --event all --dry-run

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
| `titleWalkAfterMs` | 250 — when he sets off, counted **from the name landing**, not from the top of the screen |
| `titleWalkStartXRel` / `titleWalkEndXRel` | −0.12 / 1.12 — off one edge and clear of the other |
| `titleWalkSpeed` | 210 px/s, the ending screen's, so the two walks match |
| `titleWalkGroundYRel` | 0.93 — his feet down the canvas: the near dirt |
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
| `colorByRole` | `false` (shipped): colour is part of the random draw. `true`: yellow when the player lands one, red when the player takes one |

`sizePx` and `bigSizePx` are `* BODY_SCALE` like the fighters are, so rescaling
the cast rescales the marks with it.

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

### He is 30% bigger than he was, and so is his reach

Asked for flat on 2026-08-22: `drawScale` 1.711 → **2.2243**, so a 234 px animal
is drawn at 304 against a 137 px fighter.

Three things went with it, and the reasoning matters more than the numbers:

* **`sizePx` 234 → 304.** The hurtbox comes off it, so the target grows with the
  picture — the pairing this file keeps everywhere.
* **`kickReachX` 260 → 338 and `chargeReachX` 168 → 218.** Both were *measured
  off the drawing*; when the drawing grew 30% they had to, or the boxes would
  have stopped where his hooves and chest used to be.
* **Nothing measured in DEPTH moved** — `hitZ`, `kickReachZ`, `chargeReachZ`.
  The belt is as deep as it was and a 2-D drawing does not get deeper when it
  gets taller.

> ⚠️ **His decision ranges did not move.** `kickRange` (210) and
> `chargeMinRange` (240) are about the fight's spacing, not about the drawing.
> The practical effect is that a kick he commits to now lands more reliably —
> which is a difficulty change, and it was not separately asked for.

> ⚠️ **The texture is upscaled now.** 1.711 put the atlas on screen at almost
> exactly 1:1, which is what the master was reduced *for*. At 2.2243 there is no
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
twelve frames) at the top of the file, all Still Life's.

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
